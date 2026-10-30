import hashlib
from datetime import datetime, timezone
from typing import List
import secrets
from fastapi import APIRouter, HTTPException, Depends, Request, Header
from sqlmodel import Session, select, col

from backend.database import engine
from backend.models import (
    Company,
    Agent,
    AgentCreate,
    AgentRead,
    AgentUpdate,
)
from backend.security import (
    hash_pin,
    hash_setup_pin,
    is_setup_pin_hash,
    verify_pin_hash,
    generate_admin_token,
    require_admin,
    get_current_company,
    get_client_ip,
    check_pin_rate_limit,
    record_failed_pin_attempt,
    clear_pin_attempts,
    PinVerifyRequest,
    generate_agent_token,
    verify_agent_token,
    require_agent_session,
)
from backend.bootstrap import AGENT_BOOTSTRAP_PIN

router = APIRouter(tags=["Agents"])


class PinChangeRequest(PinVerifyRequest):
    pin: str | None = None
    new_pin: str


class AgentProvisioned(AgentRead):
    setup_pin: str | None = None


def _new_setup_pin(previous_pin_hash: str | None = None) -> str:
    pin = f"{secrets.randbelow(10000):04d}"
    while pin in {"0000", AGENT_BOOTSTRAP_PIN} or (
        previous_pin_hash is not None and verify_pin_hash(pin, previous_pin_hash)
    ):
        pin = f"{secrets.randbelow(10000):04d}"
    return pin


@router.get("/agents", response_model=List[AgentRead])
def list_agents(company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        return session.exec(
            select(Agent).where(Agent.company_id == cid, Agent.is_active == True).order_by(col(Agent.id).asc())
        ).all()


@router.post("/agents", response_model=AgentProvisioned, dependencies=[Depends(require_agent_session), Depends(require_admin)])
def create_agent(agent: AgentCreate, company: Company = Depends(get_current_company)):
    if agent.pin is not None and (not agent.pin.isdigit() or len(agent.pin) != 4):
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 numeric digits")
    if agent.pin in {"0000", AGENT_BOOTSTRAP_PIN}:
        raise HTTPException(status_code=400, detail="The setup PIN cannot be used as an agent PIN")
    setup_pin = None if agent.pin else _new_setup_pin()
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        db_agent = Agent(
            agent=agent.agent,
            agent_name=agent.agent_name,
            agent_initials=agent.agent_initials.upper(),
            is_admin=agent.is_admin,
            is_active=agent.is_active,
            pin=hash_pin(agent.pin) if agent.pin else hash_setup_pin(setup_pin),
            company_id=cid,
            created_at=now,
            updated_at=now,
        )
        session.add(db_agent)
        session.commit()
        session.refresh(db_agent)
        result = AgentRead.model_validate(db_agent).model_dump()
        result["setup_pin"] = setup_pin
        return result


@router.put("/agents/{agent_id}", response_model=AgentRead, dependencies=[Depends(require_agent_session), Depends(require_admin)])
def update_agent(agent_id: int, incoming: AgentUpdate, company: Company = Depends(get_current_company)):
    if incoming.pin is not None and incoming.pin and (not incoming.pin.isdigit() or len(incoming.pin) != 4):
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 numeric digits")
    if incoming.pin in {"0000", AGENT_BOOTSTRAP_PIN}:
        raise HTTPException(status_code=400, detail="The setup PIN cannot be used as an agent PIN")
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        existing = session.get(Agent, agent_id)
        if not existing or existing.company_id != cid:
            raise HTTPException(status_code=404, detail="Agent not found")
        if (existing.agent_initials == "SA" or existing.agent_name == "Sys_Admin") and incoming.is_admin is False:
            raise HTTPException(
                status_code=400,
                detail="Security Protection: System Admin profile (Sys_Admin / SA) must retain admin privileges.",
            )
        if (existing.agent_initials == "SA" or existing.agent_name == "Sys_Admin") and incoming.is_active is False:
            raise HTTPException(
                status_code=400,
                detail="Security Protection: System Admin profile (Sys_Admin / SA) cannot be deactivated.",
            )
        if incoming.agent is not None:
            existing.agent = incoming.agent
        if incoming.agent_name is not None:
            existing.agent_name = incoming.agent_name
        if incoming.agent_initials is not None:
            existing.agent_initials = incoming.agent_initials.upper()
        if incoming.is_admin is not None:
            existing.is_admin = incoming.is_admin
        if incoming.is_active is not None:
            existing.is_active = incoming.is_active
        if incoming.pin:
            existing.pin = hash_pin(incoming.pin)
            existing.token_version = (existing.token_version or 1) + 1
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing


@router.delete("/agents/{agent_id}", dependencies=[Depends(require_agent_session), Depends(require_admin)])
def delete_agent(agent_id: int, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        existing = session.get(Agent, agent_id)
        if not existing or existing.company_id != cid:
            raise HTTPException(status_code=404, detail="Agent not found")
        if existing.agent_initials == "SA" or existing.agent_name == "Sys_Admin":
            raise HTTPException(
                status_code=400,
                detail="Security Protection: The System Admin profile (Sys_Admin / SA) cannot be deleted to ensure platform admin access remains available.",
            )
        if existing.is_admin:
            admin_count = len(
                session.exec(select(Agent).where(Agent.company_id == cid, Agent.is_admin == True)).all()
            )
            if admin_count <= 1:
                raise HTTPException(
                    status_code=400,
                    detail="Security Protection: Cannot delete the last remaining System Admin profile on the platform.",
                )
        session.delete(existing)
        session.commit()
    return {"ok": True, "message": "Agent deleted"}


@router.post("/agents/{agent_id}/reset-pin", dependencies=[Depends(require_agent_session), Depends(require_admin)])
def reset_agent_pin(agent_id: int, company: Company = Depends(get_current_company)):
    """Reset a non-admin agent's PIN to the one-time setup PIN."""
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        agent = session.get(Agent, agent_id)
        if not agent or agent.company_id != cid or not agent.is_active:
            raise HTTPException(status_code=404, detail="Active agent profile not found")
        if agent.is_admin:
            raise HTTPException(status_code=403, detail="Admins cannot reset another admin profile's PIN.")
        setup_pin = _new_setup_pin(agent.pin)
        agent.pin = hash_setup_pin(setup_pin)
        agent.token_version = (agent.token_version or 1) + 1
        agent.updated_at = datetime.now(timezone.utc)
        session.add(agent)
        session.commit()
        session.refresh(agent)
        return {"ok": True, "agent": AgentRead.model_validate(agent), "setup_pin": setup_pin}


@router.post("/agents/verify-pin")
def verify_agent_pin(req: PinVerifyRequest, request: Request, company: Company = Depends(get_current_company)):
    if not req.pin.isdigit() or len(req.pin) != 4:
        raise HTTPException(status_code=400, detail="PIN must be exactly 4 numeric digits")
    cid = company.id if company and company.id else 1
    client_ip = get_client_ip(request)
    rate_key = hashlib.sha256(f"{cid}:{req.agent_initials.strip().upper()}:{client_ip}".encode()).hexdigest()
    check_pin_rate_limit(rate_key)

    with Session(engine) as session:
        agent = session.exec(
            select(Agent).where(
                Agent.company_id == cid,
                Agent.agent_initials == req.agent_initials.upper(),
                Agent.is_active == True,
            )
        ).first()
        if not agent:
            record_failed_pin_attempt(rate_key)
            return {"valid": False, "detail": "Invalid profile or PIN"}

        if verify_pin_hash(req.pin, agent.pin):
            clear_pin_attempts(rate_key)
            if is_setup_pin_hash(agent.pin):
                token = generate_agent_token(agent, cid, pin_setup=True)
                return {
                    "valid": True,
                    "pin_change_required": True,
                    "token": token,
                    "setup_token": token,
                    "agent": AgentRead.model_validate(agent),
                }
            if not agent.pin or not agent.pin.startswith("setup_v1:pbkdf2_v2:") and not agent.pin.startswith("pbkdf2_v2:"):
                agent.pin = hash_pin(req.pin)
                agent.token_version = (agent.token_version or 1) + 1
                session.add(agent)
                session.commit()
                session.refresh(agent)
            return {"valid": True, "pin_change_required": False, "agent": AgentRead.model_validate(agent), "token": generate_agent_token(agent, cid)}
        else:
            record_failed_pin_attempt(rate_key)
            return {"valid": False, "detail": "Incorrect 4-digit Security PIN"}


@router.post("/agents/change-pin")
def change_agent_pin(
    req: PinChangeRequest,
    request: Request,
    x_agent_token: str | None = Header(None, alias="X-Agent-Token"),
    company: Company = Depends(get_current_company),
):
    if not req.new_pin.isdigit() or len(req.new_pin) != 4 or req.new_pin in {"0000", AGENT_BOOTSTRAP_PIN}:
        raise HTTPException(status_code=400, detail="Choose a new PIN of 4 numeric digits; setup PINs cannot be reused.")
    claims = verify_agent_token(x_agent_token)
    if not claims or int(claims.get("cid", 0)) != int(company.id or 0):
        raise HTTPException(status_code=401, detail="PIN setup session expired. Please sign in again.")
    initials = req.agent_initials.strip().upper()
    client_ip = get_client_ip(request)
    rate_key = hashlib.sha256(f"{company.id}:{initials}:{client_ip}".encode()).hexdigest()
    check_pin_rate_limit(rate_key)
    if initials != str(claims.get("sub", "")).upper():
        raise HTTPException(status_code=403, detail="Agent profile does not match the active session.")
    with Session(engine) as session:
        agent = session.exec(select(Agent).where(
            Agent.company_id == company.id,
            Agent.agent_initials == initials,
            Agent.is_active == True,
        )).first()
        if not agent or int(claims.get("tv", 0)) != int(agent.token_version or 1):
            raise HTTPException(status_code=401, detail="PIN setup session is no longer valid.")
        if claims.get("setup"):
            if not is_setup_pin_hash(agent.pin) or verify_pin_hash(req.new_pin, agent.pin):
                raise HTTPException(status_code=401, detail="This PIN setup session has already been used.")
        else:
            if not req.pin or not req.pin.isdigit() or len(req.pin) != 4:
                raise HTTPException(status_code=400, detail="Current PIN must be exactly 4 numeric digits")
            if is_setup_pin_hash(agent.pin) or not verify_pin_hash(req.pin, agent.pin):
                record_failed_pin_attempt(rate_key)
                raise HTTPException(status_code=401, detail="Current PIN is incorrect.")
        clear_pin_attempts(rate_key)
        agent.pin = hash_pin(req.new_pin)
        agent.token_version = (agent.token_version or 1) + 1
        agent.updated_at = datetime.now(timezone.utc)
        session.add(agent)
        session.commit()
        session.refresh(agent)
        return {"agent": AgentRead.model_validate(agent), "token": generate_agent_token(agent, company.id)}


@router.get("/agents/session")
def get_agent_session(session_data: dict = Depends(require_agent_session)):
    return {"valid": True, **session_data}
