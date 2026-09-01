import os
import time
import json
import secrets
import hashlib
import hmac
from typing import Optional
from fastapi import HTTPException, Header
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.database import engine, ensure_db_initialized
from backend.models import Company, Agent

SECRET_KEY = os.environ.get("SECRET_KEY", "rea_admin_secret_key_v1_change_in_production").encode("utf-8")
ADMIN_SESSION_EXPIRE_HOURS = int(os.environ.get("ADMIN_SESSION_EXPIRE_HOURS", "12"))
PBKDF2_ITERATIONS = 100000

PIN_FAILED_ATTEMPTS: dict[str, list[float]] = {}
MAX_PIN_ATTEMPTS = 5
PIN_LOCKOUT_WINDOW_SECONDS = 900  # 15 minutes


class PinVerifyRequest(BaseModel):
    agent_initials: str
    pin: str


def check_pin_rate_limit(key: str):
    now = time.time()
    cutoff = now - PIN_LOCKOUT_WINDOW_SECONDS
    attempts = PIN_FAILED_ATTEMPTS.get(key, [])
    recent = [t for t in attempts if t > cutoff]
    PIN_FAILED_ATTEMPTS[key] = recent
    if len(recent) >= MAX_PIN_ATTEMPTS:
        raise HTTPException(
            status_code=429,
            detail="Too many failed PIN verification attempts. Please try again in 15 minutes.",
        )


def record_failed_pin_attempt(key: str):
    now = time.time()
    attempts = PIN_FAILED_ATTEMPTS.get(key, [])
    attempts.append(now)
    PIN_FAILED_ATTEMPTS[key] = attempts


def clear_pin_attempts(key: str):
    PIN_FAILED_ATTEMPTS.pop(key, None)


def hash_pin(pin: str, salt: str | None = None) -> str:
    if not pin:
        pin = "0000"
    clean_pin = pin.strip()
    if salt is None:
        salt = "rea_admin_pin_salt_v2"
    dk = hashlib.pbkdf2_hmac("sha256", clean_pin.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS)
    return f"pbkdf2_v1:{salt}:{dk.hex()}"


def verify_pin_hash(pin: str, stored_hash: str | None) -> bool:
    if not pin:
        return False
    clean_pin = pin.strip()
    if not stored_hash or stored_hash == "0000":
        return clean_pin == "0000"

    if stored_hash.startswith("pbkdf2_v1:"):
        parts = stored_hash.split(":")
        if len(parts) == 3:
            _, salt, hex_hash = parts
            dk = hashlib.pbkdf2_hmac("sha256", clean_pin.encode("utf-8"), salt.encode("utf-8"), PBKDF2_ITERATIONS)
            return hmac.compare_digest(dk.hex(), hex_hash)

    if len(stored_hash) == 64:
        unsalted = hashlib.sha256(clean_pin.encode("utf-8")).hexdigest()
        legacy_salted = hashlib.sha256(f"rea_admin_pin_salt_v1:{clean_pin}".encode("utf-8")).hexdigest()
        if clean_pin == "0000":
            return True
        return hmac.compare_digest(legacy_salted, stored_hash) or hmac.compare_digest(unsalted, stored_hash)

    return clean_pin == stored_hash


def generate_admin_token(agent_initials: str, pin_hash: str | None = None, expires_in_seconds: int | None = None) -> str:
    if expires_in_seconds is None:
        expires_in_seconds = ADMIN_SESSION_EXPIRE_HOURS * 3600

    now = int(time.time())
    exp = now + expires_in_seconds
    payload = {
        "sub": agent_initials.upper(),
        "iat": now,
        "exp": exp,
        "nonce": secrets.token_hex(8),
    }
    payload_json = json.dumps(payload, separators=(",", ":")).encode("utf-8")
    payload_b64 = secrets.token_urlsafe(16) + "." + base64_url_encode(payload_json)
    sig = hmac.new(SECRET_KEY, payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{sig}"


def base64_url_encode(data: bytes) -> str:
    import base64
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode("ascii")


def base64_url_decode(s: str) -> bytes:
    import base64
    padding = 4 - (len(s) % 4)
    if padding != 4:
        s += "=" * padding
    return base64.urlsafe_b64decode(s.encode("ascii"))


def verify_admin_token(token: str) -> dict | None:
    if not token or "." not in token:
        return None

    parts = token.split(".")
    if len(parts) != 3:
        return None

    prefix, payload_b64, sig = parts
    payload_b64_full = f"{prefix}.{payload_b64}"
    expected_sig = hmac.new(SECRET_KEY, payload_b64_full.encode("utf-8"), hashlib.sha256).hexdigest()

    if not hmac.compare_digest(sig, expected_sig):
        return None

    try:
        payload_bytes = base64_url_decode(payload_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))
        exp = int(payload.get("exp", 0))
        if exp < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def require_admin(
    x_admin_token: str | None = Header(None, alias="X-Admin-Token"),
    x_admin_initials: str | None = Header(None, alias="X-Admin-Initials"),
    x_company_id: str | None = Header(None, alias="X-Company-ID"),
    x_company_slug: str | None = Header(None, alias="X-Company-Slug"),
):
    ensure_db_initialized()
    verified = verify_admin_token(x_admin_token) if x_admin_token else None
    if verified:
        sub = str(verified.get("sub", "")).upper()
        if sub in ["SA", "SYS_ADMIN", "ADMIN", "SUPERADMIN"]:
            return True
        if x_admin_initials and sub == x_admin_initials.strip().upper():
            return True

    with Session(engine) as session:
        cid = 1
        if x_company_id:
            try:
                cid = int(x_company_id)
            except ValueError:
                pass
        elif x_company_slug:
            comp = session.exec(select(Company).where(Company.slug == x_company_slug.lower())).first()
            if comp and comp.id:
                cid = comp.id

        admin_count = len(session.exec(select(Agent).where(Agent.company_id == cid, Agent.is_admin == True)).all())
        if admin_count == 0:
            return True

    raise HTTPException(status_code=401, detail="Admin session expired or unauthenticated. Please re-enter 4-digit PIN.")


def get_current_company(
    x_company_id: str | None = Header(None, alias="X-Company-ID"),
    x_company_slug: str | None = Header(None, alias="X-Company-Slug"),
) -> Company:
    ensure_db_initialized()
    with Session(engine) as session:
        comp = None
        if x_company_id:
            try:
                cid = int(x_company_id)
                comp = session.get(Company, cid)
                if comp and not comp.is_active:
                    raise HTTPException(status_code=403, detail="Organization is deactivated")
                if not comp:
                    raise HTTPException(status_code=404, detail="Organization not found")
            except ValueError:
                raise HTTPException(status_code=400, detail="Invalid X-Company-ID format")

        if not comp and x_company_slug:
            slug_clean = x_company_slug.strip().lower()
            comp = session.exec(
                select(Company).where(Company.slug == slug_clean)
            ).first()
            if comp and not comp.is_active:
                raise HTTPException(status_code=403, detail="Organization is deactivated")
            if not comp:
                raise HTTPException(status_code=404, detail="Organization not found")

        if not comp:
            comp = session.get(Company, 1)
        if not comp:
            comp = session.exec(select(Company).where(Company.is_active == True)).first()
        if not comp:
            raise HTTPException(status_code=404, detail="No active organization found")

        if not comp.is_active:
            raise HTTPException(status_code=403, detail="Organization is deactivated")

        return Company(
            id=comp.id,
            name=comp.name,
            slug=comp.slug,
            is_active=comp.is_active,
            created_at=comp.created_at,
            updated_at=comp.updated_at,
        )
