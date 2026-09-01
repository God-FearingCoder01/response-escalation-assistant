from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends, Request
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
    verify_pin_hash,
    generate_admin_token,
    require_admin,
    get_current_company,
    check_pin_rate_limit,
    record_failed_pin_attempt,
    clear_pin_attempts,
    PinVerifyRequest,
)

router = APIRouter(tags=["Agents"])


@router.get("/agents", response_model=List[AgentRead])
def list_agents(company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        return session.exec(
            select(Agent).where(Agent.company_id == cid).order_by(col(Agent.id).asc())
        ).all()


@router.post("/agents", response_model=AgentRead, dependencies=[Depends(require_admin)])
def create_agent(agent: AgentCreate, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        db_agent = Agent(
            agent=agent.agent,
            agent_name=agent.agent_name,
            agent_initials=agent.agent_initials.upper(),
            is_admin=agent.is_admin,
            is_active=agent.is_active,
            pin=hash_pin(agent.pin or "0000"),
            company_id=cid,
            created_at=now,
            updated_at=now,
        )
        session.add(db_agent)
        session.commit()
        session.refresh(db_agent)
        return db_agent


@router.put("/agents/{agent_id}", response_model=AgentRead, dependencies=[Depends(require_admin)])
def update_agent(agent_id: int, incoming: AgentUpdate, company: Company = Depends(get_current_company)):
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
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing


@router.delete("/agents/{agent_id}", dependencies=[Depends(require_admin)])
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


@router.post("/agents/verify-pin")
def verify_agent_pin(req: PinVerifyRequest, request: Request, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    client_ip = request.client.host if request.client else "unknown"
    rate_key = f"{client_ip}:{cid}:{req.agent_initials.upper()}"
    check_pin_rate_limit(rate_key)

    with Session(engine) as session:
        agent = session.exec(
            select(Agent).where(
                Agent.company_id == cid,
                Agent.agent_initials == req.agent_initials.upper(),
            )
        ).first()
        if not agent:
            record_failed_pin_attempt(rate_key)
            raise HTTPException(status_code=404, detail="Agent profile not found in this organization")

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
