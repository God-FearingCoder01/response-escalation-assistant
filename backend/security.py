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

from backend.database import engine, ensure_db_initialized
from backend.models import Agent, AuthAttemptState, Company

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
MAX_PIN_ATTEMPTS = 5
PIN_LOCKOUT_WINDOW_SECONDS = 900


def _as_utc_aware(value: datetime) -> datetime:
    """Normalize database datetimes before comparing lockout timestamps."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


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
        if state and (now - window_started_at).total_seconds() >= PIN_LOCKOUT_WINDOW_SECONDS:
            state.failed_attempts = 0
            state.window_started_at = now
            state.blocked_until = None
            session.add(state)
            session.commit()


def record_failed_pin_attempt(key: str):
    now = datetime.now(timezone.utc)
    with Session(engine) as session:
        state = session.get(AuthAttemptState, key)
        if not state:
            state = AuthAttemptState(key=key, failed_attempts=0, window_started_at=now)
        elif (now - _as_utc_aware(state.window_started_at)).total_seconds() >= PIN_LOCKOUT_WINDOW_SECONDS:
            state.failed_attempts = 0
            state.window_started_at = now
            state.blocked_until = None
        state.failed_attempts += 1
        if state.failed_attempts >= MAX_PIN_ATTEMPTS:
            state.blocked_until = now + timedelta(seconds=PIN_LOCKOUT_WINDOW_SECONDS)
        session.add(state)
        session.commit()


def clear_pin_attempts(key: str):
    with Session(engine) as session:
        state = session.get(AuthAttemptState, key)
        if state:
            session.delete(state)
            session.commit()


def hash_pin(pin: str, salt: str | None = None) -> str:
    clean_pin = (pin or "0000").strip()
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac("sha256", clean_pin.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS)
    return f"pbkdf2_v1:{salt}:{digest.hex()}"


def verify_pin_hash(pin: str, stored_hash: str | None) -> bool:
    if not pin:
        return False
    clean_pin = pin.strip()
    if not stored_hash or stored_hash == "0000":
        return clean_pin == "0000"
    if stored_hash.startswith("pbkdf2_v1:"):
        parts = stored_hash.split(":")
        if len(parts) == 3:
            _, salt, expected = parts
            actual = hashlib.pbkdf2_hmac("sha256", clean_pin.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS).hex()
            return hmac.compare_digest(actual, expected)
    if len(stored_hash) == 64:
        unsalted = hashlib.sha256(clean_pin.encode("utf-8")).hexdigest()
        legacy_salted = hashlib.sha256(f"rea_admin_pin_salt_v1:{clean_pin}".encode("utf-8")).hexdigest()
        return hmac.compare_digest(legacy_salted, stored_hash) or hmac.compare_digest(unsalted, stored_hash)
    return hmac.compare_digest(clean_pin, stored_hash)


def base64_url_encode(data: bytes) -> str:
    import base64
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def base64_url_decode(value: str) -> bytes:
    import base64
    return base64.urlsafe_b64decode(value + "=" * ((4 - len(value) % 4) % 4))


def _pin_fingerprint(agent: Agent) -> str:
    return hashlib.sha256((agent.pin or "0000").encode("utf-8")).hexdigest()


def generate_agent_token(agent: Agent, company_id: int, pin_setup: bool = False) -> str:
    now = int(time.time())
    claims = {
        "sub": agent.agent_initials.upper(),
        "cid": int(company_id),
        "admin": bool(agent.is_admin),
        "pin": _pin_fingerprint(agent),
        "setup": bool(pin_setup),
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
    ensure_db_initialized()
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
    if int(claims.get("cid", 0)) != int(company.id or 0):
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
        if not agent or claims.get("pin") != _pin_fingerprint(agent):
            raise HTTPException(status_code=401, detail="Agent session is no longer valid. Please sign in again.")
        return {
            "agent_initials": initials,
            "agent_name": agent.agent_name,
            "is_admin": bool(agent.is_admin),
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
            if agent and agent.is_admin and claims.get("pin") == _pin_fingerprint(agent):
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

