import re
import secrets
from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import SQLModel, Session, select, col

from backend.database import engine, ensure_db_initialized, create_db_and_tables
from backend.models import (
    Company,
    CompanyCreate,
    CompanyRead,
    CompanyUpdate,
    SuperAdmin,
    Agent,
    Template,
)
from backend.security import (
    hash_pin,
    verify_pin_hash,
    generate_admin_token,
    require_admin,
)
from backend.services.seed_service import (
    DEFAULT_AGENTS,
    DEFAULT_TEMPLATES,
    sync_default_data_if_needed,
)

router = APIRouter(tags=["SuperAdmin & Organizations"])


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


@router.post("/superadmin/verify-pin")
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


@router.post("/superadmin/request-pin-reset")
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


@router.post("/superadmin/reset-pin")
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


@router.post("/superadmin/update-settings")
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


@router.post("/superadmin/reset-company-admin-pin")
def reset_company_admin_pin(payload: CompanyAdminPinReset):
    ensure_db_initialized()
    try:
        with Session(engine) as session:
            if not payload.new_pin or not isinstance(payload.new_pin, str):
                raise HTTPException(status_code=400, detail="New PIN is required")
            clean_pin = payload.new_pin.strip()
            if len(clean_pin) != 4 or not clean_pin.isdigit():
                raise HTTPException(status_code=400, detail="PIN must be exactly 4 digits")

            cid = payload.company_id

            comp = session.get(Company, cid)
            if not comp or comp.id is None:
                raise HTTPException(status_code=404, detail="Company not found")

            company_id_val = comp.id

            stmt = select(Agent).where(Agent.company_id == company_id_val, Agent.is_admin == True)
            if payload.agent_id is not None:
                stmt = stmt.where(Agent.id == payload.agent_id)

            admin_agents = session.exec(stmt).all()
            if not admin_agents:
                admin_agents = session.exec(select(Agent).where(Agent.company_id == company_id_val)).all()

            now = datetime.now(timezone.utc)
            hashed = hash_pin(clean_pin)

            if not admin_agents:
                new_admin = Agent(
                    agent="System Administrator",
                    agent_name="Sys_Admin",
                    agent_initials="SA",
                    is_admin=True,
                    pin=hashed,
                    company_id=company_id_val,
                    created_at=now,
                    updated_at=now,
                )
                session.add(new_admin)
                session.commit()
                return {
                    "status": "ok",
                    "message": f"Created Admin profile and set Admin PIN for company '{comp.name}'",
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
                "message": f"Successfully reset Admin PIN for company '{comp.name}'",
                "agents_updated": len(admin_agents),
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to reset PIN: {str(e)}")


@router.get("/companies/by-slug/{slug}", response_model=CompanyRead)
def get_company_by_slug(slug: str):
    with Session(engine) as session:
        comp = session.exec(select(Company).where(Company.slug == slug.strip().lower())).first()
        if not comp:
            raise HTTPException(status_code=404, detail="Company not found")
        return CompanyRead.model_validate(comp)


@router.get("/companies", response_model=List[CompanyRead])
def list_companies():
    with Session(engine) as session:
        return session.exec(select(Company).order_by(col(Company.id).asc())).all()


@router.post("/companies", response_model=CompanyRead, dependencies=[Depends(require_admin)])
def create_company(payload: CompanyCreate):
    ensure_db_initialized()
    with Session(engine) as session:
        if not payload.name or not payload.name.strip():
            raise HTTPException(status_code=400, detail="Organization name cannot be empty")

        raw_slug = payload.slug.strip() if payload.slug else payload.name.strip()
        slug = re.sub(r"[^a-z0-9\-]", "", raw_slug.lower())
        if not slug:
            raise HTTPException(status_code=400, detail="Organization URL slug must contain alphanumeric characters (e.g. corp-a)")

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
        if comp.id is None:
            raise HTTPException(status_code=500, detail="Failed to retrieve company ID after creation")
        comp_id_val = comp.id

        for item in DEFAULT_AGENTS:
            session.add(
                Agent(
                    agent=item["agent"],
                    agent_name=item["agent_name"],
                    agent_initials=item["agent_initials"],
                    is_admin=item["is_admin"],
                    pin=hash_pin(item["pin"]),
                    company_id=comp_id_val,
                    created_at=now,
                    updated_at=now,
                )
            )

        for item in DEFAULT_TEMPLATES:
            session.add(
                Template(
                    name=item["name"],
                    body=item["body"],
                    category_type=item["category_type"],
                    category=item.get("category"),
                    subcategory=item.get("subcategory"),
                    company_id=comp_id_val,
                    created_at=now,
                    updated_at=now,
                )
            )
        session.commit()
        session.refresh(comp)
        return CompanyRead.model_validate(comp)


@router.get("/companies/{company_id}", response_model=CompanyRead)
def get_company(company_id: int):
    with Session(engine) as session:
        comp = session.get(Company, company_id)
        if not comp:
            raise HTTPException(status_code=404, detail="Company not found")
        return CompanyRead.model_validate(comp)


@router.put("/companies/{company_id}", response_model=CompanyRead, dependencies=[Depends(require_admin)])
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
        if payload.reporting_week_start is not None:
            comp.reporting_week_start = payload.reporting_week_start.strip()
        if payload.logo_url is not None:
            comp.logo_url = payload.logo_url
        comp.updated_at = datetime.now(timezone.utc)
        session.add(comp)
        session.commit()
        session.refresh(comp)
        return CompanyRead.model_validate(comp)
