import hashlib
import hmac
import json
import os
import secrets
import time
from datetime import datetime, timedelta, timezone

from fastapi import Depends, Header, HTTPException, Request
from pydantic import BaseModel
from sqlmodel import Session, select
from sqlalchemy import case
from sqlalchemy.dialects.postgresql import insert as pg_insert
from sqlalchemy.dialects.sqlite import insert as sqlite_insert

from backend.database import engine
from backend.models import Agent, AuthAttemptState, Company
from backend.bootstrap import AGENT_BOOTSTRAP_PIN

_configured_secret = os.environ.get("SECRET_KEY", "")
_development_secret = "rea_admin_secret_key_v1_change_in_production"
_example_secret = "replace-with-a-unique-random-secret-at-least-32-characters"
if (os.environ.get("VERCEL") or os.environ.get("ENVIRONMENT", "").lower() == "production") and (
    len(_configured_secret) < 32 or _configured_secret in {_development_secret, _example_secret}
):
    raise RuntimeError("Set SECRET_KEY to a unique random value of at least 32 characters in production.")
SECRET_KEY = (_configured_secret or _development_secret).encode("utf-8")
ADMIN_SESSION_EXPIRE_HOURS = int(os.environ.get("ADMIN_SESSION_EXPIRE_HOURS", "12"))
AGENT_SESSION_EXPIRE_HOURS = int(os.environ.get("AGENT_SESSION_EXPIRE_HOURS", "8"))
PBKDF2_ITERATIONS = 100000
_pin_pepper_value = os.environ.get("PIN_PEPPER", "")
if (os.environ.get("VERCEL") or os.environ.get("ENVIRONMENT", "").lower() == "production") and len(_pin_pepper_value) < 32:
    raise RuntimeError("Set PIN_PEPPER to a unique random value of at least 32 characters in production.")
PIN_PEPPER = (_pin_pepper_value or SECRET_KEY.decode("utf-8")).encode("utf-8")
MAX_PIN_ATTEMPTS = 5
PIN_LOCKOUT_WINDOW_SECONDS = 900


def _as_utc_aware(value: datetime) -> datetime:
    """Normalize database datetimes before comparing lockout timestamps."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def get_client_ip(request: Request) -> str:
    """Use Vercel's proxy-overwritten client IP header on hosted deployments."""
    if os.environ.get("VERCEL") or os.environ.get("VERCEL_ENV"):
        forwarded = request.headers.get("x-vercel-forwarded-for") or request.headers.get("x-forwarded-for")
        if forwarded:
            address = forwarded.split(",", 1)[0].strip()
            if address:
                return address
    return request.client.host if request.client else "unknown"


class PinVerifyRequest(BaseModel):
    agent_initials: str
    pin: str


def check_pin_rate_limit(key: str):
    now = datetime.now(timezone.utc)
    with Session(engine) as session:
        state = session.get(AuthAttemptState, key)
        blocked_until = _as_utc_aware(state.blocked_until) if state and state.blocked_until else None
        window_started_at = _as_utc_aware(state.window_started_at) if state else None
        if blocked_until and blocked_until > now:
            remaining = max(1, int((blocked_until - now).total_seconds()))
            raise HTTPException(status_code=429, detail=f"Too many failed PIN verification attempts. Try again in {remaining} seconds.")


def record_failed_pin_attempt(key: str):
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(seconds=PIN_LOCKOUT_WINDOW_SECONDS)
    dialect = engine.dialect.name
    insert = pg_insert if dialect == "postgresql" else sqlite_insert if dialect == "sqlite" else None
    if insert is None:
        raise RuntimeError(f"Atomic PIN throttling is unsupported for database dialect {dialect!r}.")
    base = insert(AuthAttemptState).values(
        key=key,
        failed_attempts=1,
        window_started_at=now,
        blocked_until=None,
    )
    expired = AuthAttemptState.window_started_at <= cutoff
    next_attempts = case(
        (expired, 1),
        else_=AuthAttemptState.failed_attempts + 1,
    )
    statement = base.on_conflict_do_update(
        index_elements=[AuthAttemptState.key],
        set_={
            "failed_attempts": next_attempts,
            "window_started_at": case((expired, now), else_=AuthAttemptState.window_started_at),
            "blocked_until": case(
                (next_attempts >= MAX_PIN_ATTEMPTS, now + timedelta(seconds=PIN_LOCKOUT_WINDOW_SECONDS)),
                else_=None,
            ),
        },
    )
    with Session(engine) as session:
        session.execute(statement)
        session.commit()


def clear_pin_attempts(key: str):
    with Session(engine) as session:
        state = session.get(AuthAttemptState, key)
        if state:
            session.delete(state)
            session.commit()


def hash_pin(pin: str, salt: str | None = None) -> str:
    clean_pin = (pin or "").strip()
    if not clean_pin:
        raise ValueError("PIN cannot be empty")
    salt = salt or secrets.token_hex(16)
    peppered_pin = hmac.new(PIN_PEPPER, clean_pin.encode("utf-8"), hashlib.sha256).digest()
    digest = hashlib.pbkdf2_hmac("sha256", peppered_pin, salt.encode("utf-8"), PBKDF2_ITERATIONS)
    return f"pbkdf2_v2:{salt}:{digest.hex()}"


def hash_setup_pin(pin: str) -> str:
    """Hash a one-time PIN and persist that it must be changed before use."""
    if pin == "0000":
        raise ValueError("The setup PIN cannot be 0000")
    return f"setup_v1:{hash_pin(pin)}"


def is_setup_pin_hash(stored_hash: str | None) -> bool:
    return bool(stored_hash and stored_hash.startswith("setup_v1:"))


def verify_pin_hash(pin: str, stored_hash: str | None) -> bool:
    if not pin:
        return False
    clean_pin = pin.strip()
    if stored_hash is not None and stored_hash.startswith("setup_v1:"):
        stored_hash = stored_hash[len("setup_v1:"):]
    if stored_hash and stored_hash.startswith(("pbkdf2_v2:", "pbkdf2_legacy_v1:")):
        parts = stored_hash.split(":")
        if len(parts) == 3:
            scheme, salt, expected = parts
            if scheme == "pbkdf2_v2":
                secret_pin = hmac.new(PIN_PEPPER, clean_pin.encode("utf-8"), hashlib.sha256).digest()
                actual = hashlib.pbkdf2_hmac("sha256", secret_pin, salt.encode("utf-8"), PBKDF2_ITERATIONS).hex()
            else:
                legacy_digest = hashlib.pbkdf2_hmac("sha256", clean_pin.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS)
                actual = hmac.new(PIN_PEPPER, legacy_digest, hashlib.sha256).hexdigest()
            return hmac.compare_digest(actual, expected)
    # Plaintext, SHA-256 and old PBKDF2 rows are converted by the deployment migration.
    return False


def migrate_recoverable_legacy_pin(
    stored_hash: str | None,
    bootstrap_pin: str = AGENT_BOOTSTRAP_PIN,
    require_setup: bool = True,
) -> str | None:
    """Return a peppered hash for recoverable pre-PBKDF2 PIN rows, else None."""
    if not stored_hash:
        return None
    setup_required = stored_hash.startswith("setup_v1:")
    legacy_hash = stored_hash[len("setup_v1:"):] if setup_required else stored_hash
    if legacy_hash.startswith(("pbkdf2_v2:", "pbkdf2_legacy_v1:")):
        return None
    if legacy_hash.startswith("pbkdf2_v1:"):
        parts = legacy_hash.split(":")
        if len(parts) != 3:
            return None
        _, salt, expected = parts
        try:
            wrapped = hmac.new(PIN_PEPPER, bytes.fromhex(expected), hashlib.sha256).hexdigest()
        except ValueError:
            return None
        upgraded = f"pbkdf2_legacy_v1:{salt}:{wrapped}"
        return f"setup_v1:{upgraded}" if setup_required else upgraded
    if setup_required:
        return None
    if legacy_hash.isdigit() and len(legacy_hash) == 4:
        if legacy_hash == "0000":
            return hash_setup_pin(bootstrap_pin) if require_setup else hash_pin(bootstrap_pin)
        return hash_pin(legacy_hash)
    if len(legacy_hash) == 64:
        for number in range(10000):
            candidate = f"{number:04d}"
            unsalted = hashlib.sha256(candidate.encode("utf-8")).hexdigest()
            legacy_salted = hashlib.sha256(f"rea_admin_pin_salt_v1:{candidate}".encode("utf-8")).hexdigest()
            if hmac.compare_digest(unsalted, legacy_hash) or hmac.compare_digest(legacy_salted, legacy_hash):
                if candidate == "0000":
                    return hash_setup_pin(bootstrap_pin) if require_setup else hash_pin(bootstrap_pin)
                return hash_pin(candidate)
    return None


def base64_url_encode(data: bytes) -> str:
    import base64
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def base64_url_decode(value: str) -> bytes:
    import base64
    return base64.urlsafe_b64decode(value + "=" * ((4 - len(value) % 4) % 4))


def generate_agent_token(agent: Agent, company_id: int, pin_setup: bool = False) -> str:
    now = int(time.time())
    claims = {
        "sub": agent.agent_initials.upper(),
        "cid": company_id,
        "admin": agent.is_admin,
        "tv": agent.token_version,
        "setup": pin_setup,
        "iat": now,
        "exp": now + (600 if pin_setup else AGENT_SESSION_EXPIRE_HOURS * 3600),
        "nonce": secrets.token_hex(16),
    }
    encoded = base64_url_encode(json.dumps(claims, separators=(",", ":")).encode("utf-8"))
    signature = hmac.new(SECRET_KEY, encoded.encode("ascii"), hashlib.sha256).hexdigest()
    return f"{encoded}.{signature}"


def verify_agent_token(token: str | None) -> dict | None:
    if not token or token.count(".") != 1:
        return None
    encoded, signature = token.split(".", 1)
    expected = hmac.new(SECRET_KEY, encoded.encode("ascii"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None
    try:
        claims = json.loads(base64_url_decode(encoded).decode("utf-8"))
        if int(claims.get("exp", 0)) <= int(time.time()) or not claims.get("sub") or not claims.get("cid"):
            return None
        return claims
    except Exception:
        return None


def generate_admin_token(agent_initials: str, pin_hash: str | None = None, expires_in_seconds: int | None = None) -> str:
    """Legacy token retained for the separate super-admin recovery flow."""
    expires_in_seconds = expires_in_seconds or ADMIN_SESSION_EXPIRE_HOURS * 3600
    payload = {"sub": agent_initials.upper(), "iat": int(time.time()), "exp": int(time.time()) + expires_in_seconds, "nonce": secrets.token_hex(8)}
    payload_b64 = secrets.token_urlsafe(16) + "." + base64_url_encode(json.dumps(payload, separators=(",", ":")).encode("utf-8"))
    sig = hmac.new(SECRET_KEY, payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{sig}"


def verify_admin_token(token: str | None) -> dict | None:
    if not token or token.count(".") != 2:
        return None
    prefix, payload_b64, signature = token.split(".", 2)
    signed = f"{prefix}.{payload_b64}"
    expected = hmac.new(SECRET_KEY, signed.encode("utf-8"), hashlib.sha256).hexdigest()
    if not hmac.compare_digest(signature, expected):
        return None
    try:
        claims = json.loads(base64_url_decode(payload_b64).decode("utf-8"))
        return claims if int(claims.get("exp", 0)) > int(time.time()) else None
    except Exception:
        return None


def get_current_company(
    x_company_id: str | None = Header(None, alias="X-Company-ID"),
    x_company_slug: str | None = Header(None, alias="X-Company-Slug"),
) -> Company:
    with Session(engine) as session:
        comp = None
        if x_company_id:
            try:
                comp = session.get(Company, int(x_company_id))
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid X-Company-ID format")
            if not comp:
                raise HTTPException(status_code=404, detail="Organization not found")
        elif x_company_slug:
            comp = session.exec(select(Company).where(Company.slug == x_company_slug.strip().lower())).first()
            if not comp:
                raise HTTPException(status_code=404, detail="Organization not found")
        else:
            comp = session.get(Company, 1) or session.exec(select(Company).where(Company.is_active == True)).first()
            if not comp:
                raise HTTPException(status_code=404, detail="No active organization found")
        if not comp.is_active:
            raise HTTPException(status_code=403, detail="Organization is deactivated")
        return Company(id=comp.id, name=comp.name, slug=comp.slug, is_active=comp.is_active, created_at=comp.created_at, updated_at=comp.updated_at)


def require_agent_session(
    request: Request,
    x_agent_token: str | None = Header(None, alias="X-Agent-Token"),
    x_agent_initials: str | None = Header(None, alias="X-Agent-Initials"),
    company: Company = Depends(get_current_company),
):
    claims = verify_agent_token(x_agent_token)
    if not claims or claims.get("setup"):
        raise HTTPException(status_code=401, detail="Agent authentication required. Please sign in again.")
    if int(claims.get("cid", 0)) != (company.id or 0):
        raise HTTPException(status_code=403, detail="Agent session does not belong to this organization.")
    initials = str(claims.get("sub", "")).strip().upper()
    supplied_identity = (x_agent_initials or "").strip().upper()
    if supplied_identity and supplied_identity != initials:
        raise HTTPException(status_code=403, detail="Agent identity does not match the authenticated session.")
    requested_identity = request.path_params.get("agent_initials") or request.query_params.get("agent_initials")
    if requested_identity and requested_identity.strip().upper() != initials:
        raise HTTPException(status_code=403, detail="Agent identity does not match the authenticated session.")
    with Session(engine) as session:
        agent = session.exec(select(Agent).where(
            Agent.company_id == company.id,
            Agent.agent_initials == initials,
            Agent.is_active == True,
        )).first()
        if not agent or int(claims.get("tv", 0)) != int(agent.token_version or 1):
            raise HTTPException(status_code=401, detail="Agent session is no longer valid. Please sign in again.")
        return {
            "agent_initials": initials,
            "agent_name": agent.agent_name,
            "is_admin": agent.is_admin,
            "company_id": company.id,
        }


def optional_agent_session(
    request: Request,
    x_agent_token: str | None = Header(None, alias="X-Agent-Token"),
    x_agent_initials: str | None = Header(None, alias="X-Agent-Initials"),
    company: Company = Depends(get_current_company),
) -> dict | None:
    # Anonymous use is allowed only when no credential was supplied. Invalid
    # credentials must not silently downgrade to the anonymous path.
    if not x_agent_token and not x_agent_initials:
        return None
    return require_agent_session(request, x_agent_token, x_agent_initials, company)




def require_admin(
    x_agent_token: str | None = Header(None, alias="X-Agent-Token"),
    x_admin_token: str | None = Header(None, alias="X-Admin-Token"),
    x_company_id: str | None = Header(None, alias="X-Company-ID"),
    x_company_slug: str | None = Header(None, alias="X-Company-Slug"),
):
    claims = verify_agent_token(x_agent_token)
    if claims and not claims.get("setup"):
        cid = int(claims.get("cid", 0))
        initials = str(claims.get("sub", "")).upper()
        with Session(engine) as session:
            requested_company_id = None
            if x_company_id:
                try:
                    requested_company_id = int(x_company_id)
                except ValueError:
                    raise HTTPException(status_code=400, detail="Invalid X-Company-ID format")
            elif x_company_slug:
                company = session.exec(select(Company).where(Company.slug == x_company_slug.strip().lower())).first()
                requested_company_id = company.id if company else None
            if requested_company_id is not None and requested_company_id != cid:
                raise HTTPException(status_code=403, detail="Admin session does not belong to this organization.")
            agent = session.exec(select(Agent).where(
                Agent.company_id == cid,
                Agent.agent_initials == initials,
                Agent.is_active == True,
            )).first()
            if agent and agent.is_admin and int(claims.get("tv", 0)) == int(agent.token_version or 1):
                return True

    legacy = verify_admin_token(x_admin_token)
    if legacy and str(legacy.get("sub", "")).upper() == "SUPERADMIN":
        return True

    raise HTTPException(status_code=401, detail="Admin session expired or unauthenticated. Please re-enter 4-digit PIN.")


def require_superadmin(
    x_admin_token: str | None = Header(None, alias="X-Admin-Token"),
):
    claims = verify_admin_token(x_admin_token)
    if not claims or str(claims.get("sub", "")).upper() != "SUPERADMIN":
        raise HTTPException(status_code=401, detail="Super Admin authentication required.")
    return True

