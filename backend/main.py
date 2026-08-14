import os
import hashlib
import hmac
import secrets
import base64
import time
import json
import re
import urllib.request
import urllib.parse
from pathlib import Path
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, TypedDict, Optional
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import SQLModel, Field, Session, select, col

SECRET_KEY = os.environ.get("SECRET_KEY", "rea_admin_secret_key_v1_change_in_production").encode("utf-8")
ADMIN_SESSION_EXPIRE_HOURS = int(os.environ.get("ADMIN_SESSION_EXPIRE_HOURS", "12"))
PBKDF2_ITERATIONS = 100000

PIN_FAILED_ATTEMPTS: dict[str, list[float]] = {}
MAX_PIN_ATTEMPTS = 5
PIN_LOCKOUT_WINDOW_SECONDS = 900  # 15 minutes


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
    payload_b64 = base64.urlsafe_b64encode(payload_json).decode("utf-8").rstrip("=")

    signature = hmac.new(SECRET_KEY, payload_b64.encode("utf-8"), hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(signature).decode("utf-8").rstrip("=")

    return f"{payload_b64}.{sig_b64}"


def verify_admin_token(token_str: str) -> dict | None:
    if not token_str or "." not in token_str:
        return None
    try:
        parts = token_str.split(".")
        if len(parts) != 2:
            return None
        payload_b64, sig_b64 = parts[0], parts[1]

        expected_sig = hmac.new(SECRET_KEY, payload_b64.encode("utf-8"), hashlib.sha256).digest()
        expected_sig_b64 = base64.urlsafe_b64encode(expected_sig).decode("utf-8").rstrip("=")

        if not hmac.compare_digest(sig_b64, expected_sig_b64):
            return None

        rem = len(payload_b64) % 4
        padded_b64 = payload_b64 + ("=" * (4 - rem) if rem else "")
        payload_bytes = base64.urlsafe_b64decode(padded_b64)
        payload = json.loads(payload_bytes.decode("utf-8"))

        exp = payload.get("exp")
        if not exp or time.time() >= exp:
            return None

        return payload
    except Exception:
        return None


from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Depends, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, col

class PinVerifyRequest(BaseModel):
    agent_initials: str
    pin: str


class TranslateRequest(BaseModel):
    text: str
    source_lang: str = "en"
    target_lang: str = "sn"


def require_admin(
    x_admin_token: str | None = Header(None, alias="X-Admin-Token"),
    x_admin_initials: str | None = Header(None, alias="X-Admin-Initials"),
    x_admin_pin: str | None = Header(None, alias="X-Admin-PIN"),
    x_company_id: str | None = Header(None, alias="X-Company-ID"),
    x_company_slug: str | None = Header(None, alias="X-Company-Slug"),
):
    token_str = x_admin_token if isinstance(x_admin_token, str) else None
    initials_str = x_admin_initials if isinstance(x_admin_initials, str) else None
    pin_str = x_admin_pin if isinstance(x_admin_pin, str) else None

    if not token_str and not pin_str:
        raise HTTPException(
            status_code=401,
            detail="Admin authorization required: missing X-Admin-Token or X-Admin-PIN header",
        )

    if token_str:
        payload = verify_admin_token(token_str)
        if payload and payload.get("sub") == "SUPERADMIN":
            return

    with Session(engine) as session:
        target_company_id = None
        if x_company_id:
            try:
                target_company_id = int(x_company_id)
            except ValueError:
                pass
        elif x_company_slug:
            comp = session.exec(select(Company).where(Company.slug == x_company_slug.lower(), Company.is_active == True)).first()
            if comp:
                target_company_id = comp.id

        stmt = select(Agent).where(Agent.is_admin == True)
        if target_company_id is not None:
            stmt = stmt.where(Agent.company_id == target_company_id)

        admin_agents = session.exec(stmt).all()
        if not admin_agents and target_company_id is not None:
            admin_agents = session.exec(select(Agent).where(Agent.is_admin == True)).all()

        if not admin_agents:
            raise HTTPException(status_code=403, detail="No admin profile configured")

        if initials_str:
            filtered = [a for a in admin_agents if a.agent_initials.upper() == initials_str.upper()]
            if filtered:
                admin_agents = filtered

        authenticated = False

        if token_str:
            payload = verify_admin_token(token_str)
            if payload:
                token_initials = payload.get("sub")
                if token_initials:
                    for agent in admin_agents:
                        if agent.agent_initials.upper() == token_initials.upper():
                            authenticated = True
                            break

        if not authenticated and pin_str:
            for agent in admin_agents:
                expected_hash = agent.pin or hash_pin("0000")
                if verify_pin_hash(pin_str, expected_hash):
                    authenticated = True
                    break

        if not authenticated:
            raise HTTPException(status_code=403, detail="Invalid or expired admin authorization credentials")


try:
    from .database import create_db_and_tables, engine, ping_database
    from .models import (
        Company,
        CompanyCreate,
        CompanyRead,
        CompanyUpdate,
        Agent,
        AgentCreate,
        AgentRead,
        AgentUpdate,
        Template,
        TemplateCreate,
        TemplateRead,
        TemplateUpdate,
        Suggestion,
        SuggestionCreate,
        SuggestionRead,
        SuggestionUpdate,
        Favorite,
        UsageHistory,
        SuperAdmin,
        SuperAdminRead,
    )
except ImportError:
    from backend.database import create_db_and_tables, engine, ping_database
    from backend.models import (
        Company,
        CompanyCreate,
        CompanyRead,
        CompanyUpdate,
        Agent,
        AgentCreate,
        AgentRead,
        AgentUpdate,
        Template,
        TemplateCreate,
        TemplateRead,
        TemplateUpdate,
        Suggestion,
        SuggestionCreate,
        SuggestionRead,
        SuggestionUpdate,
        Favorite,
        UsageHistory,
        SuperAdmin,
        SuperAdminRead,
    )


DEFAULT_TEMPLATES = [
    # Tech Escalation Templates
    {
    "name": "Self Exclusion",
    "body": "Account {account_number} is requesting to be removed from self exclusion. ",
    "category_type": "tech_escalation",
    "category": "",
    "subcategory": "",
  },
  {
    "name": "Account Verification",
    "body": "Account {account_number} is facing error code 146, kindly assist. ",
    "category_type": "tech_escalation",
    "category": "",
    "subcategory": "",
  },
  {
    "name": "Permanent Deactivation",
    "body": "User {account_number} has requested for the permanent deactivation of his account because {reason}. ",
    "category_type": "tech_escalation",
    "category": "",
    "subcategory": "",
  },
  {
    "name": "Processing Withdrawal",
    "body": "Processing withdrawal of ${amount} from account number {account_number}; on {day}.{month_number}.{year} time {time}hrs. ",
    "category_type": "tech_escalation",
    "category": "",
    "subcategory": "",
  },
  # Customer Reply Templates
  {
    "name": "General Introduction",
    "body": "Hello and welcome to WinBucks. My name is {agent_name}. How may I help you today?",
    "category_type": "customer_reply",
    "category": "Agent Introductions",
    "subcategory": "General",
  },
  {
    "name": "Ecocash Issues 2",
    "body": "We apologize for the inconvenience and appreciate your patience. \nWe are currently experiencing temporary challenges with EcoCash withdrawals. Our team is actively working with the relevant providers to resolve the issue, and pending transactions are expected to be completed within the next 2 hours. \nWhile the issue is being resolved, we kindly recommend using InnBucks or O'mari for faster and instant transactions where possible. Thank you for your patience and understanding.",
    "category_type": "customer_reply",
    "category": "Transactions",
    "subcategory": "Follow-Ups",
  },
  {
    "name": "Ecocash",
    "body": "To deposit using EcoCash, kindly follow these steps: \n1.	Click Deposit. \n2.	Select EcoCash as your payment method. \n3.	Enter the amount you wish to deposit. \n4.	Click Deposit again to proceed. \n5.	Confirm the payment request on your phone. \n6.	Once the payment is successful, refresh your WinBucks account. \n7.	Check your balance to confirm the funds have been credited.",
    "category_type": "customer_reply",
    "category": "Transactions",
    "subcategory": "Deposit",
  },
  {
    "name": "Withdrawal",
    "body": "NB: We use InnBucks, EcoCash, and O'mari only for withdrawals. \n\nTo withdraw, kindly follow these steps: \n1.	Click the Menu button (☰) in the top-right corner of your screen. \n2.	Select Withdraw. \n3.	Choose your preferred withdrawal method. NB: Always double-check the withdrawal method before confirming the withdrawal. \n4.	Enter the amount you wish to withdraw. \n5.	Click Withdraw to submit your request. \n6.	Refresh your account and wait for a notification confirming the transaction. \n\nNB: Always ensure that you open an account with InnBucks, EcoCash, and O’mari using the same number registered with Winbucks for successful withdrawal in future.\n\nNB: Withdrawal requests of $100 or more will be placed under processing. This allows you to contact us so we can review and finalize your transaction in accordance with our policy.",
    "category_type": "customer_reply",
    "category": "Transactions",
    "subcategory": "How to Withdraw",
  },
  {
    "name": "Password Reset",
    "body": "● Click “Forgot Password” and then follow instructions. \n● If your new Password/Verification is not sent to your phone, kindly remove your Sim Card and insert it in another phone then request for a new code again. \n● To change your Password, click on 3 dots at the Bottom Right corner of your screen and do the following: \n\t○ Select Account \n\t○ Click on change password \n\t○ Follow further instructions.",
    "category_type": "customer_reply",
    "category": "Registration, login, verification, and account access",
    "subcategory": "How to reset your password?",
  },
  {
    "name": "Error 146",
    "body": "If you have received Error Code 146, please know that you need to verify your account. \n\nTo verify your account, please do the following: \n● Take 3 pictures \n\t○ First one while holding your national ID next to your face, with both your face and details on the ID very clear.\n\tNB: not a “selfie” but using the back/rear camera. \n\t○ Second one the front of you ID, with details clearly visible \n\t○ Third one the back of your ID, with details clearly visible \n● Send the pictures together with your phone number registered on WinBucks via WhatsApp on, +263713331227  or +263713331227.",
    "category_type": "customer_reply",
    "category": "Registration, login, verification, and account access",
    "subcategory": "Account Verification",
  },
]

class DefaultAgent(TypedDict):
    agent: str
    agent_name: str
    agent_initials: str
    is_admin: bool
    pin: str


DEFAULT_AGENTS: List[DefaultAgent] = [
    { "agent": "System Administrator", "agent_name": "Sys_Admin", "agent_initials": "SA", "is_admin": True, "pin": "0000" },
    { "agent": "Chris Whyt", "agent_name": "Chris", "agent_initials": "CW", "is_admin": False, "pin": "0000" },
]


def sync_default_data_if_needed(session: Session) -> None:
    now = datetime.now(timezone.utc)
    # 1. Default Company (Corp A)
    default_company = session.exec(select(Company).where(Company.id == 1)).first()
    if not default_company:
        default_company = session.exec(select(Company).where(Company.slug == "corp-a")).first()

    if not default_company:
        default_company = Company(
            id=1,
            name="Corp A",
            slug="corp-a",
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        session.add(default_company)
        session.commit()
        session.refresh(default_company)
    else:
        if default_company.name == "Default Organization" or default_company.slug == "default":
            default_company.name = "Corp A"
            default_company.slug = "corp-a"
            session.add(default_company)
            session.commit()

    if default_company.id is None:
        return

    # 2. Ensure default_company (ID #1) has ONLY 2 profiles (SA and VN)
    allowed_initials = [item["agent_initials"] for item in DEFAULT_AGENTS]
    existing_agents = session.exec(select(Agent).where(Agent.company_id == default_company.id)).all()
    for ag in existing_agents:
        if ag.agent_initials not in allowed_initials:
            session.delete(ag)
    session.commit()

    for item in DEFAULT_AGENTS:
        existing = session.exec(
            select(Agent).where(
                Agent.agent_initials == item["agent_initials"],
                Agent.company_id == default_company.id,
            )
        ).first()
        if not existing:
            session.add(
                Agent(
                    agent=item["agent"],
                    agent_name=item["agent_name"],
                    agent_initials=item["agent_initials"],
                    is_admin=item["is_admin"],
                    pin=hash_pin(item["pin"]),
                    company_id=default_company.id,
                    created_at=now,
                    updated_at=now,
                )
            )
        else:
            if item["is_admin"] and not existing.is_admin:
                existing.is_admin = True
                session.add(existing)
            if existing.pin and not existing.pin.startswith("pbkdf2_v1:"):
                existing.pin = hash_pin(existing.pin or "0000")
                session.add(existing)
    session.commit()

    # 3. Seed default templates for default company
    local_templates = session.exec(select(Template).where(Template.company_id == default_company.id)).all()
    if not local_templates:
        for item in DEFAULT_TEMPLATES:
            session.add(
                Template(
                    name=item["name"],
                    body=item["body"],
                    category_type=item["category_type"],
                    category=item.get("category"),
                    subcategory=item.get("subcategory"),
                    company_id=default_company.id,
                    created_at=now,
                    updated_at=now,
                )
            )
        session.commit()

    # 4. Seed default SuperAdmin if not exists
    superadmin = session.exec(select(SuperAdmin)).first()
    if not superadmin:
        session.add(
            SuperAdmin(
                email="gfc.dev@proton.me",
                pin=hash_pin("0000"),
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
    else:
        if superadmin.email == "admin@support.com":
            superadmin.email = "gfc.dev@proton.me"
            session.add(superadmin)
            session.commit()


def get_current_company(
    x_company_id: str | None = Header(None, alias="X-Company-ID"),
    x_company_slug: str | None = Header(None, alias="X-Company-Slug"),
) -> Company:
    ensure_db_initialized()
    with Session(engine) as session:
        if x_company_id:
            try:
                cid = int(x_company_id)
                comp = session.get(Company, cid)
                if comp and comp.is_active:
                    return comp
            except ValueError:
                pass

        if x_company_slug:
            comp = session.exec(
                select(Company).where(Company.slug == x_company_slug.lower(), Company.is_active == True)
            ).first()
            if comp:
                return comp

        comp = session.get(Company, 1)
        if not comp:
            comp = session.exec(select(Company).where(Company.is_active == True)).first()
        if not comp:
            raise HTTPException(status_code=404, detail="No active organization found")
        return comp



_db_initialized = False

def ensure_db_initialized():
    global _db_initialized
    if not _db_initialized:
        try:
            create_db_and_tables()
            with Session(engine) as session:
                sync_default_data_if_needed(session)
            _db_initialized = True
        except Exception:
            _db_initialized = True


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_db_initialized()
    yield


app = FastAPI(title="Response Escalation Assistant API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    with Session(engine) as session:
        ping_database(session)
    return {"status": "ok", "database": "connected", "message": "Backend is ready"}


# --- SUPER ADMIN MODELS & ENDPOINTS ---

class SuperAdminPinVerify(SQLModel):
    pin: str


class SuperAdminPinResetRequest(SQLModel):
    email: str


class SuperAdminPinResetConfirm(SQLModel):
    token: str
    new_pin: str


class SuperAdminSettingsUpdate(SQLModel):
    email: Optional[str] = None
    pin: Optional[str] = None
    current_pin: str


class CompanyAdminPinReset(SQLModel):
    company_id: int
    agent_id: Optional[int] = None
    new_pin: str


@app.post("/superadmin/verify-pin")
def verify_superadmin_pin(payload: SuperAdminPinVerify):
    ensure_db_initialized()
    with Session(engine) as session:
        try:
            sa = session.exec(select(SuperAdmin)).first()
        except Exception:
            create_db_and_tables()
            sync_default_data_if_needed(session)
            sa = session.exec(select(SuperAdmin)).first()

        if not sa:
            now = datetime.now(timezone.utc)
            sa = SuperAdmin(email="gfc.dev@proton.me", pin=hash_pin("0000"), created_at=now, updated_at=now)
            session.add(sa)
            session.commit()
            session.refresh(sa)
        if verify_pin_hash(payload.pin, sa.pin):
            token = generate_admin_token(agent_initials="SUPERADMIN", pin_hash=sa.pin)
            return {"status": "ok", "token": token, "email": sa.email}
        raise HTTPException(status_code=401, detail="Invalid Super Admin 4-digit PIN")


@app.post("/superadmin/request-pin-reset")
def request_superadmin_pin_reset(payload: SuperAdminPinResetRequest):
    with Session(engine) as session:
        sa = session.exec(select(SuperAdmin)).first()
        if not sa:
            raise HTTPException(status_code=404, detail="Super Admin configuration not found")

        input_email = payload.email.strip().lower()
        if input_email != sa.email.strip().lower():
            raise HTTPException(status_code=400, detail="Provided email does not match registered Super Admin email.")

        reset_token = secrets.token_hex(16)
        sa.reset_token = reset_token
        session.add(sa)
        session.commit()

        return {
            "status": "ok",
            "message": f"PIN reset authorized for Super Admin email {sa.email}.",
            "reset_token": reset_token,
        }


@app.post("/superadmin/reset-pin")
def reset_superadmin_pin(payload: SuperAdminPinResetConfirm):
    with Session(engine) as session:
        sa = session.exec(select(SuperAdmin).where(SuperAdmin.reset_token == payload.token)).first()
        if not sa or not payload.token:
            raise HTTPException(status_code=400, detail="Invalid or expired reset token")

        clean_pin = payload.new_pin.strip()
        if len(clean_pin) != 4 or not clean_pin.isdigit():
            raise HTTPException(status_code=400, detail="Super Admin PIN must be exactly 4 digits")

        sa.pin = hash_pin(clean_pin)
        sa.reset_token = None
        sa.updated_at = datetime.now(timezone.utc)
        session.add(sa)
        session.commit()
        return {"status": "ok", "message": "Super Admin PIN reset successfully!"}


@app.post("/superadmin/update-settings")
def update_superadmin_settings(payload: SuperAdminSettingsUpdate):
    with Session(engine) as session:
        sa = session.exec(select(SuperAdmin)).first()
        if not sa:
            raise HTTPException(status_code=404, detail="Super Admin record not found")

        if not verify_pin_hash(payload.current_pin, sa.pin):
            raise HTTPException(status_code=401, detail="Current Super Admin PIN is incorrect")

        if payload.email and payload.email.strip():
            sa.email = payload.email.strip().lower()

        if payload.pin and payload.pin.strip():
            clean_pin = payload.pin.strip()
            if len(clean_pin) != 4 or not clean_pin.isdigit():
                raise HTTPException(status_code=400, detail="New Super Admin PIN must be exactly 4 digits")
            sa.pin = hash_pin(clean_pin)

        sa.updated_at = datetime.now(timezone.utc)
        session.add(sa)
        session.commit()
        return {"status": "ok", "message": "Super Admin settings updated successfully!", "email": sa.email}


@app.post("/superadmin/reset-company-admin-pin")
def reset_company_admin_pin(payload: CompanyAdminPinReset):
    ensure_db_initialized()
    with Session(engine) as session:
        clean_pin = payload.new_pin.strip()
        if len(clean_pin) != 4 or not clean_pin.isdigit():
            raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits")

        try:
            cid = int(payload.company_id)
        except (ValueError, TypeError):
            raise HTTPException(status_code=400, detail="Invalid company_id")

        comp = session.get(Company, cid)
        if not comp:
            raise HTTPException(status_code=404, detail="Company not found")

        stmt = select(Agent).where(Agent.company_id == comp.id, Agent.is_admin == True)
        if payload.agent_id:
            try:
                aid = int(payload.agent_id)
                stmt = stmt.where(Agent.id == aid)
            except (ValueError, TypeError):
                pass

        admin_agents = session.exec(stmt).all()
        if not admin_agents:
            admin_agents = session.exec(select(Agent).where(Agent.company_id == comp.id)).all()

        now = datetime.now(timezone.utc)
        hashed = hash_pin(clean_pin)

        if not admin_agents:
            # Auto-provision default Sys_Admin agent if company has no agent records yet
            new_admin = Agent(
                agent="System Administrator",
                agent_name="Sys_Admin",
                agent_initials="SA",
                is_admin=True,
                pin=hashed,
                company_id=comp.id,
                created_at=now,
                updated_at=now,
            )
            session.add(new_admin)
            session.commit()
            return {
                "status": "ok",
                "message": f"Created and set Admin PIN to '{clean_pin}' for company '{comp.name}'",
                "agents_updated": 1,
            }

        for agent in admin_agents:
            agent.pin = hashed
            agent.is_admin = True
            agent.updated_at = now
            session.add(agent)

        session.commit()
        return {
            "status": "ok",
            "message": f"Successfully reset Admin PIN to '{clean_pin}' for company '{comp.name}'",
            "agents_updated": len(admin_agents),
        }


# --- COMPANY / ORGANIZATION ENDPOINTS ---

@app.get("/companies/by-slug/{slug}", response_model=CompanyRead)
def get_company_by_slug(slug: str):
    with Session(engine) as session:
        comp = session.exec(select(Company).where(Company.slug == slug.strip().lower())).first()
        if not comp:
            raise HTTPException(status_code=404, detail="Company not found")
        return CompanyRead.model_validate(comp)


@app.get("/companies", response_model=List[CompanyRead])
def list_companies():
    with Session(engine) as session:
        return session.exec(select(Company).order_by(col(Company.id).asc())).all()


@app.post("/companies", response_model=CompanyRead, dependencies=[Depends(require_admin)])
def create_company(payload: CompanyCreate):
    ensure_db_initialized()
    with Session(engine) as session:
        if not payload.name or not payload.name.strip():
            raise HTTPException(status_code=400, detail="Organization name cannot be empty")

        raw_slug = payload.slug.strip() if payload.slug else payload.name.strip()
        slug = re.sub(r"[^a-z0-9\-]", "", raw_slug.lower())
        if not slug:
            raise HTTPException(status_code=400, detail="Organization URL slug must contain alphanumeric characters (e.g. winbucks)")

        existing = session.exec(select(Company).where(Company.slug == slug)).first()
        if existing:
            raise HTTPException(status_code=400, detail=f"Organization with URL slug '{slug}' already exists")

        now = datetime.now(timezone.utc)
        comp = Company(
            name=payload.name.strip(),
            slug=slug,
            is_active=payload.is_active,
            created_at=now,
            updated_at=now,
        )
        session.add(comp)
        session.commit()
        session.refresh(comp)
        assert comp.id is not None

        # Seed default agents for new company (Sys_Admin and Chris Whyt)
        for item in DEFAULT_AGENTS:
            session.add(
                Agent(
                    agent=item["agent"],
                    agent_name=item["agent_name"],
                    agent_initials=item["agent_initials"],
                    is_admin=item["is_admin"],
                    pin=hash_pin(item["pin"]),
                    company_id=comp.id,
                    created_at=now,
                    updated_at=now,
                )
            )

        # Seed default starter templates for new company
        for item in DEFAULT_TEMPLATES:
            session.add(
                Template(
                    name=item["name"],
                    body=item["body"],
                    category_type=item["category_type"],
                    category=item.get("category"),
                    subcategory=item.get("subcategory"),
                    company_id=comp.id,
                    created_at=now,
                    updated_at=now,
                )
            )
        session.commit()
        session.refresh(comp)
        return CompanyRead.model_validate(comp)


@app.get("/companies/{company_id}", response_model=CompanyRead)
def get_company(company_id: int):
    with Session(engine) as session:
        comp = session.get(Company, company_id)
        if not comp:
            raise HTTPException(status_code=404, detail="Company not found")
        return CompanyRead.model_validate(comp)


@app.put("/companies/{company_id}", response_model=CompanyRead, dependencies=[Depends(require_admin)])
def update_company(company_id: int, payload: CompanyUpdate):
    with Session(engine) as session:
        comp = session.get(Company, company_id)
        if not comp:
            raise HTTPException(status_code=404, detail="Company not found")
        if payload.name is not None:
            comp.name = payload.name.strip()
        if payload.slug is not None:
            new_slug = payload.slug.strip().lower()
            existing = session.exec(select(Company).where(Company.slug == new_slug, Company.id != company_id)).first()
            if existing:
                raise HTTPException(status_code=400, detail=f"Company slug '{new_slug}' is already taken")
            comp.slug = new_slug
        if payload.is_active is not None:
            comp.is_active = payload.is_active
        comp.updated_at = datetime.now(timezone.utc)
        session.add(comp)
        session.commit()
        session.refresh(comp)
        return CompanyRead.model_validate(comp)


# --- TEMPLATE ENDPOINTS ---

@app.get("/templates", response_model=List[TemplateRead])
def list_templates(company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        return session.exec(
            select(Template)
            .where(Template.company_id == company.id)
            .order_by(col(Template.updated_at).desc())
        ).all()


@app.post("/templates", response_model=TemplateRead, dependencies=[Depends(require_admin)])
def create_template(template: TemplateCreate, company: Company = Depends(get_current_company)):
    if company.id is None:
        raise HTTPException(status_code=400, detail="Invalid company ID")
    with Session(engine) as session:
        existing = session.exec(
            select(Template).where(
                col(Template.company_id) == company.id,
                col(Template.category_type) == template.category_type,
                col(Template.name) == template.name,
                col(Template.category) == template.category,
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Template '{template.name}' already exists in this category.",
            )
        now = datetime.now(timezone.utc)
        db_template = Template(
            name=template.name,
            body=template.body,
            category_type=template.category_type,
            category=template.category,
            subcategory=template.subcategory,
            company_id=company.id,
            created_at=now,
            updated_at=now,
        )
        session.add(db_template)
        session.commit()
        session.refresh(db_template)
        return db_template


@app.get("/templates/{template_id}", response_model=TemplateRead)
def get_template(template_id: int, company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        template = session.get(Template, template_id)
        if not template or template.company_id != company.id:
            raise HTTPException(status_code=404, detail="Template not found")
        return template


@app.put("/templates/{template_id}", response_model=TemplateRead, dependencies=[Depends(require_admin)])
def update_template(template_id: int, incoming: TemplateUpdate, company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        existing = session.get(Template, template_id)
        if not existing or existing.company_id != company.id:
            raise HTTPException(status_code=404, detail="Template not found")
        if incoming.name is not None:
            existing.name = incoming.name
        if incoming.body is not None:
            existing.body = incoming.body
        if incoming.category_type is not None:
            existing.category_type = incoming.category_type
        if incoming.category is not None:
            existing.category = incoming.category
        if incoming.subcategory is not None:
            existing.subcategory = incoming.subcategory
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing


@app.delete("/templates/{template_id}", dependencies=[Depends(require_admin)])
def delete_template(template_id: int, company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        existing = session.get(Template, template_id)
        if not existing or existing.company_id != company.id:
            raise HTTPException(status_code=404, detail="Template not found")
        session.delete(existing)
        session.commit()
    return {"ok": True, "message": "Template deleted"}


@app.get("/export", response_model=List[TemplateRead])
def export_templates(company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        return session.exec(
            select(Template)
            .where(Template.company_id == company.id)
            .order_by(col(Template.updated_at).desc())
        ).all()


@app.post("/import", dependencies=[Depends(require_admin)])
def import_templates(items: List[TemplateCreate], company: Company = Depends(get_current_company)):
    if company.id is None:
        raise HTTPException(status_code=400, detail="Invalid company ID")
    with Session(engine) as session:
        existing_templates = session.exec(
            select(Template).where(Template.company_id == company.id)
        ).all()
        seen = set(
            (
                (t.category_type or "").strip().lower(),
                (t.category or "").strip().lower(),
                (t.name or "").strip().lower(),
                (t.body or "").strip(),
            )
            for t in existing_templates
        )
        count = 0
        skipped = 0
        now = datetime.now(timezone.utc)
        for item in items:
            key = (
                (item.category_type or "").strip().lower(),
                (item.category or "").strip().lower(),
                (item.name or "").strip().lower(),
                (item.body or "").strip(),
            )
            if key in seen:
                skipped += 1
                continue
            seen.add(key)
            session.add(
                Template(
                    name=item.name,
                    body=item.body,
                    category_type=item.category_type,
                    category=item.category,
                    subcategory=item.subcategory,
                    company_id=company.id,
                    created_at=now,
                    updated_at=now,
                )
            )
            count += 1
        session.commit()
    return {
        "imported": count,
        "skipped": skipped,
        "message": f"Imported {count} unique template(s) ({skipped} duplicate(s) skipped)",
    }


@app.post("/templates/deduplicate", dependencies=[Depends(require_admin)])
def deduplicate_templates(company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        all_templates = session.exec(
            select(Template)
            .where(Template.company_id == company.id)
            .order_by(col(Template.id).asc())
        ).all()
        seen = set()
        to_delete = []
        for t in all_templates:
            key = (
                (t.category_type or "").strip().lower(),
                (t.category or "").strip().lower(),
                (t.name or "").strip().lower(),
                (t.body or "").strip(),
            )
            if key in seen:
                to_delete.append(t)
            else:
                seen.add(key)

        for dup in to_delete:
            session.delete(dup)
        session.commit()

        return {
            "status": "success",
            "removed_count": len(to_delete),
            "remaining_count": len(seen),
            "message": f"Cleaned duplicates: Removed {len(to_delete)} duplicate template(s)",
        }


# Agent endpoints
@app.get("/agents", response_model=List[AgentRead])
def list_agents(company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        return session.exec(
            select(Agent).where(Agent.company_id == company.id).order_by(col(Agent.id).asc())
        ).all()


@app.post("/agents", response_model=AgentRead, dependencies=[Depends(require_admin)])
def create_agent(agent: AgentCreate, company: Company = Depends(get_current_company)):
    if company.id is None:
        raise HTTPException(status_code=400, detail="Invalid company ID")
    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        db_agent = Agent(
            agent=agent.agent,
            agent_name=agent.agent_name,
            agent_initials=agent.agent_initials.upper(),
            is_admin=agent.is_admin,
            pin=hash_pin(agent.pin or "0000"),
            company_id=company.id,
            created_at=now,
            updated_at=now,
        )
        session.add(db_agent)
        session.commit()
        session.refresh(db_agent)
        return db_agent


@app.put("/agents/{agent_id}", response_model=AgentRead, dependencies=[Depends(require_admin)])
def update_agent(agent_id: int, incoming: AgentUpdate, company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        existing = session.get(Agent, agent_id)
        if not existing or existing.company_id != company.id:
            raise HTTPException(status_code=404, detail="Agent not found")
        if (existing.agent_initials == "SA" or existing.agent_name == "Sys_Admin") and incoming.is_admin is False:
            raise HTTPException(
                status_code=400,
                detail="Security Protection: System Admin profile (Sys_Admin / SA) must retain admin privileges.",
            )
        if incoming.agent is not None:
            existing.agent = incoming.agent
        if incoming.agent_name is not None:
            existing.agent_name = incoming.agent_name
        if incoming.agent_initials is not None:
            existing.agent_initials = incoming.agent_initials.upper()
        if incoming.is_admin is not None:
            existing.is_admin = incoming.is_admin
        if incoming.pin:
            existing.pin = hash_pin(incoming.pin)
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing


@app.delete("/agents/{agent_id}", dependencies=[Depends(require_admin)])
def delete_agent(agent_id: int, company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        existing = session.get(Agent, agent_id)
        if not existing or existing.company_id != company.id:
            raise HTTPException(status_code=404, detail="Agent not found")
        if existing.agent_initials == "SA" or existing.agent_name == "Sys_Admin":
            raise HTTPException(
                status_code=400,
                detail="Security Protection: The System Admin profile (Sys_Admin / SA) cannot be deleted to ensure platform admin access remains available.",
            )
        if existing.is_admin:
            admin_count = len(
                session.exec(select(Agent).where(Agent.company_id == company.id, Agent.is_admin == True)).all()
            )
            if admin_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Security Protection: Cannot delete the last remaining System Admin profile on the platform.",
                )
        session.delete(existing)
        session.commit()
    return {"ok": True, "message": "Agent deleted"}


@app.post("/agents/verify-pin")
def verify_agent_pin(req: PinVerifyRequest, request: Request, company: Company = Depends(get_current_company)):
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{client_ip}:{company.id}:{req.agent_initials.upper()}"
    check_pin_rate_limit(rate_key)

    with Session(engine) as session:
        agent = session.exec(
            select(Agent).where(
                Agent.company_id == company.id,
                Agent.agent_initials == req.agent_initials.upper(),
            )
        ).first()
        if not agent:
            agent = session.exec(
                select(Agent).where(
                    Agent.company_id == company.id,
                    Agent.is_admin == True,
                )
            ).first()
        if not agent:
            record_failed_pin_attempt(rate_key)
            raise HTTPException(status_code=404, detail="Agent profile not found")

        agent_read = AgentRead.model_validate(agent)

        if not agent.is_admin:
            clear_pin_attempts(rate_key)
            return {"valid": True, "agent": agent_read}

        expected_hash = agent.pin or hash_pin("0000")

        if verify_pin_hash(req.pin, expected_hash):
            clear_pin_attempts(rate_key)
            if not agent.pin or not agent.pin.startswith("pbkdf2_v1:"):
                agent.pin = hash_pin(req.pin)
                session.add(agent)
                try: session.commit()
                except Exception: session.rollback()

            token = generate_admin_token(agent.agent_initials)
            return {"valid": True, "agent": agent_read, "token": token}
        else:
            record_failed_pin_attempt(rate_key)
            return {"valid": False, "detail": "Incorrect 4-digit Security PIN"}


# --- SUGGESTION ENDPOINTS ---

@app.get("/suggestions", response_model=List[SuggestionRead])
def get_suggestions(company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        return session.exec(
            select(Suggestion)
            .where(Suggestion.company_id == company.id)
            .order_by(col(Suggestion.created_at).desc())
        ).all()


@app.post("/suggestions", response_model=SuggestionRead)
def create_suggestion(payload: SuggestionCreate, company: Company = Depends(get_current_company)):
    if company.id is None:
        raise HTTPException(status_code=400, detail="Invalid company ID")
    with Session(engine) as session:
        suggestion = Suggestion.model_validate(payload)
        suggestion.company_id = company.id
        session.add(suggestion)
        session.commit()
        session.refresh(suggestion)
        return suggestion


@app.post("/suggestions/{suggestion_id}/approve", response_model=TemplateRead, dependencies=[Depends(require_admin)])
def approve_suggestion(suggestion_id: int, company: Company = Depends(get_current_company)):
    if company.id is None:
        raise HTTPException(status_code=400, detail="Invalid company ID")
    with Session(engine) as session:
        sug = session.get(Suggestion, suggestion_id)
        if not sug or sug.company_id != company.id:
            raise HTTPException(status_code=404, detail="Suggestion not found")

        new_tpl = Template(
            name=sug.name,
            body=sug.body,
            category_type=sug.category_type,
            category=sug.category,
            subcategory=sug.subcategory,
            company_id=company.id,
        )
        session.add(new_tpl)

        sug.status = "approved"
        sug.updated_at = datetime.now(timezone.utc)
        session.add(sug)

        session.commit()
        session.refresh(new_tpl)
        return new_tpl


@app.post("/suggestions/{suggestion_id}/reject", response_model=SuggestionRead, dependencies=[Depends(require_admin)])
def reject_suggestion(suggestion_id: int, company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        sug = session.get(Suggestion, suggestion_id)
        if not sug or sug.company_id != company.id:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        sug.status = "rejected"
        sug.updated_at = datetime.now(timezone.utc)
        session.add(sug)
        session.commit()
        session.refresh(sug)
        return sug


@app.delete("/suggestions/{suggestion_id}", dependencies=[Depends(require_admin)])
def delete_suggestion(suggestion_id: int, company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        sug = session.get(Suggestion, suggestion_id)
        if not sug or sug.company_id != company.id:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        session.delete(sug)
        session.commit()
    return {"ok": True, "message": "Suggestion permanently deleted"}


# --- FAVORITES & HISTORY ENDPOINTS ---

@app.get("/favorites/{agent_initials}")
def get_agent_favorites(agent_initials: str, company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        initials = agent_initials.upper()
        favs = session.exec(
            select(Favorite).where(
                Favorite.company_id == company.id,
                Favorite.agent_initials == initials,
            )
        ).all()
        return [f.template_id for f in favs]


@app.post("/favorites/{agent_initials}/{template_id}")
def toggle_agent_favorite(agent_initials: str, template_id: int, company: Company = Depends(get_current_company)):
    if company.id is None:
        raise HTTPException(status_code=400, detail="Invalid company ID")
    with Session(engine) as session:
        initials = agent_initials.upper()
        existing = session.exec(
            select(Favorite).where(
                Favorite.company_id == company.id,
                Favorite.agent_initials == initials,
                Favorite.template_id == template_id,
            )
        ).first()

        if existing:
            session.delete(existing)
        else:
            new_fav = Favorite(company_id=company.id, agent_initials=initials, template_id=template_id)
            session.add(new_fav)

        session.commit()

        all_favs = session.exec(
            select(Favorite).where(
                Favorite.company_id == company.id,
                Favorite.agent_initials == initials,
            )
        ).all()
        return [f.template_id for f in all_favs]


@app.get("/history/{agent_initials}")
def get_agent_history(agent_initials: str, company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        initials = agent_initials.upper()
        history = session.exec(
            select(UsageHistory)
            .where(
                UsageHistory.company_id == company.id,
                UsageHistory.agent_initials == initials,
            )
            .order_by(col(UsageHistory.copied_at).desc())
        ).all()

        counts = {}
        recents = []
        seen = set()

        for h in history:
            counts[h.template_id] = counts.get(h.template_id, 0) + 1
            if h.template_id not in seen:
                seen.add(h.template_id)
                recents.append({
                    "templateId": h.template_id,
                    "timestamp": int(h.copied_at.timestamp() * 1000)
                })

        return {"counts": counts, "recents": recents}


@app.post("/history/{agent_initials}/{template_id}")
def record_agent_copy_history(agent_initials: str, template_id: int, company: Company = Depends(get_current_company)):
    if company.id is None:
        raise HTTPException(status_code=400, detail="Invalid company ID")
    with Session(engine) as session:
        initials = agent_initials.upper()
        entry = UsageHistory(company_id=company.id, agent_initials=initials, template_id=template_id)
        session.add(entry)
        session.commit()
    return {"ok": True}


# --- MULTILINGUAL TRANSLATION ENDPOINT (English <-> Shona / IsiNdebele) ---

SUPPORT_DICTIONARY_SHONA = {
    "hello": "mhoroi",
    "hi": "mhoro",
    "good morning": "mangwanani",
    "good afternoon": "masikati",
    "good evening": "manheru",
    "thank you": "tatenda",
    "thank you very much": "tatenda chaizvo",
    "you are welcome": "tinozvitenda",
    "please": "ndapota",
    "sorry for the inconvenience": "tine urombo nekukanganisika",
    "how can i help you today?": "ndingagone kukubatsirai sei nhasi?",
    "how can i help you": "ndingagone kukubatsirai sei",
    "account number": "nhamba yeakaundi",
    "phone number": "nhamba yerunhare",
    "email address": "kero ye-email",
    "reference number": "nhamba dereferensi",
    "ticket number": "nhamba yetikiti",
    "customer care": "rutsigiro rwatengi",
    "support team": "chikwata cherutsigiro",
    "technical support": "rutsigiro rweunyanzvi",
    "technical team": "chikwata cheunyanzvi",
    "network team": "chikwata chesainzi yetiweki",
    "escalated": "zvatumirwa kune vanobatsira vamberi",
    "your ticket has been escalated": "tikiti renyu rakwidziridzwa kune vanobatsira mberi",
    "your query has been escalated to technical support": "mubvunzo wenyu watumirwa kune vakwidzi veunyanzvi",
    "we are currently investigating the issue": "parizvino tiri kuferefeta dambudziko iri",
    "connection issue": "dambudziko riine chekuita nekubatana kwewebhu",
    "internet down": "internet haisi kushanda",
    "slow connection": "internet iri kunonoka",
    "no signal": "hapana chikwangwani mesainzi",
    "router": "mugadzirisi wandandaro (router)",
    "please restart your router": "ndapota dzimurayi nekutangidza router yenyu",
    "turn off the router for 30 seconds": "dzimurai router kwemasekonzi makumi matatu",
    "fibre connection": "kubatana kwefibre",
    "power light": "mwenje wesimba",
    "red light": "mwenje mupfumbu/mupfuwira",
    "resolved": "zvatadzoreredzwa panzvimbo",
    "the issue has been resolved": "dambudziko ragadziriswa",
    "service restored": "basa radzoreredzwa",
    "payment": "mubhadharo",
    "invoice": "nhoroondo yemubhadharo (invoice)",
    "balance": "mhedzisiro yemari",
    "thank you for choosing us": "tinokutendai nekusarudza isu",
}

SUPPORT_DICTIONARY_NDEBELE = {
    "hello": "salibonani",
    "hi": "salibonani",
    "good morning": "sabona",
    "good afternoon": "litshonile",
    "good evening": "litshonile",
    "thank you": "siyabonga",
    "thank you very much": "siyabonga kakhulu",
    "you are welcome": "wamukelekile",
    "please": "cela",
    "sorry for the inconvenience": "siyaxolisa ngokuhlupheka",
    "how can i help you today?": "ngingakusiza njani lamuhla?",
    "how can i help you": "ngingakusiza njani",
    "account number": "inombolo ye-akhawunti",
    "phone number": "inombolo yocingo",
    "email address": "ikheli le-eyili",
    "ticket number": "inombolo yetikiti",
    "reference number": "inombolo yokukhomba",
    "technical support": "usizo lwethekhinikhali",
    "technical team": "iqembu lethekhinikhali",
    "support team": "iqembu losizo",
    "customer care": "usizo lwabathengi",
    "escalated": "itshiyiwe kubasizi abaphezulu",
    "your ticket has been escalated": "itikiti lakho lisiwe eqenjini lethu eliphezulu lethekhinikhali",
    "your query has been escalated to technical support": "umbuzo wakho udluliselwe eqenjini lethekhinikhali",
    "we are currently investigating the issue": "kusakhangelwa inkinga le okwakhathesi",
    "connection issue": "inkinga yokuxhumana kwewebhu",
    "internet down": "iyinthanethi kayisebenzi",
    "slow connection": "iyinthanethi inyenyezela",
    "no signal": "kakulamaza",
    "router": "i-router",
    "please restart your router": "cela ucime i-router yakho okwemizuzwana engamashumi amathathu uyivuse njalo",
    "turn off the router for 30 seconds": "cima i-router okwemizuzwana engamashumi amathathu",
    "fibre connection": "ukuxhumana kwe-fibre",
    "resolved": "kulungisisiwe",
    "the issue has been resolved": "inkinga yakho ilungisisiwe",
    "service restored": "inkonzo ibuyiselwe",
    "payment": "inkokhelo",
    "invoice": "i-invoysi",
    "balance": "ibhalansi",
    "thank you for choosing us": "siyabonga ngokukhetha thina",
}

REVERSE_SHONA = {v.lower(): k for k, v in SUPPORT_DICTIONARY_SHONA.items()}
REVERSE_NDEBELE = {v.lower(): k for k, v in SUPPORT_DICTIONARY_NDEBELE.items()}


@app.post("/translate")
def translate_text(req: TranslateRequest):
    if not req.text or not req.text.strip():
        return {"translatedText": "", "source": req.source_lang, "target": req.target_lang}

    clean_text = req.text.strip()
    src = (req.source_lang or "en").lower()
    tgt = (req.target_lang or "sn").lower()
    norm_text = clean_text.lower().rstrip(".?!,")

    # 1. Direct dictionary match check
    if src == "en" and tgt == "sn" and norm_text in SUPPORT_DICTIONARY_SHONA:
        return {"translatedText": SUPPORT_DICTIONARY_SHONA[norm_text], "source": src, "target": tgt, "provider": "dictionary"}
    if src == "sn" and tgt == "en" and norm_text in REVERSE_SHONA:
        return {"translatedText": REVERSE_SHONA[norm_text], "source": src, "target": tgt, "provider": "dictionary"}
    if src == "en" and tgt == "nd" and norm_text in SUPPORT_DICTIONARY_NDEBELE:
        return {"translatedText": SUPPORT_DICTIONARY_NDEBELE[norm_text], "source": src, "target": tgt, "provider": "dictionary"}
    if src == "nd" and tgt == "en" and norm_text in REVERSE_NDEBELE:
        return {"translatedText": REVERSE_NDEBELE[norm_text], "source": src, "target": tgt, "provider": "dictionary"}

    # 2. MyMemory API with language pair fallbacks (zu/nr for Ndebele)
    lang_pairs = [f"{src}|{tgt}"]
    if tgt == "nd":
        lang_pairs.extend([f"{src}|zu", f"{src}|nr"])
    elif src == "nd":
        lang_pairs.extend([f"zu|{tgt}", f"nr|{tgt}"])

    for lp in lang_pairs:
        try:
            encoded_query = urllib.parse.quote(clean_text)
            url = f"https://api.mymemory.translated.net/get?q={encoded_query}&langpair={lp}"
            req_obj = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"})
            with urllib.request.urlopen(req_obj, timeout=5) as resp:
                data = json.loads(resp.read().decode("utf-8"))
                resp_data = data.get("responseData", {})
                translated = resp_data.get("translatedText")
                match_val = resp_data.get("match", 0) or 0

                if translated and isinstance(translated, str) and translated.strip():
                    t_clean = translated.strip()
                    t_lower = t_clean.lower()

                    bad_keywords = ["mymemory warning", "is not available", "query length limit", "no valid translation", "invalid language pair"]
                    if any(bk in t_lower for bk in bad_keywords):
                        continue

                    if match_val >= 0.35 and t_clean.upper() != clean_text.upper():
                        if lp.endswith("|zu") and tgt == "nd":
                            t_clean = (
                                t_clean.replace("Sawubona", "Salibonani")
                                .replace("sawubona", "salibonani")
                                .replace("kanjani", "njani")
                            )
                        return {
                            "translatedText": t_clean,
                            "source": src,
                            "target": tgt,
                            "provider": f"mymemory_{lp}",
                        }
        except Exception as e:
            print(f"Translation API error for {lp}:", e)

    # 3. Partial phrase dictionary substitution fallback
    dict_map = (
        SUPPORT_DICTIONARY_NDEBELE if (src == "en" and tgt == "nd") else
        SUPPORT_DICTIONARY_SHONA if (src == "en" and tgt == "sn") else
        REVERSE_NDEBELE if (src == "nd" and tgt == "en") else
        REVERSE_SHONA if (src == "sn" and tgt == "en") else {}
    )

    phrase = clean_text
    substituted = False
    for k in sorted(dict_map.keys(), key=len, reverse=True):
        val = dict_map[k]
        pattern = re.compile(r"\b" + re.escape(k) + r"\b", re.IGNORECASE)
        if pattern.search(phrase):
            phrase = pattern.sub(val, phrase)
            substituted = True

    if substituted:
        return {"translatedText": phrase, "source": src, "target": tgt, "provider": "dictionary_partial"}

    return {
        "translatedText": clean_text,
        "source": src,
        "target": tgt,
        "provider": "fallback",
    }





