from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select, col

from backend.database import engine
from backend.models import (
    Company,
    ShiftConfig,
    ShiftConfigCreate,
    ShiftConfigRead,
    ShiftConfigUpdate,
    EscalationTarget,
    EscalationTargetCreate,
    EscalationTargetRead,
    ShiftIssue,
    ShiftIssueCreate,
    ShiftIssueRead,
    ShiftIssueUpdate,
)
from backend.security import get_current_company, require_admin

router = APIRouter(tags=["Shift Issue Register"])


@router.get("/sir/shifts", response_model=List[ShiftConfigRead])
def list_sir_shifts(company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        return session.exec(
            select(ShiftConfig)
            .where(ShiftConfig.company_id == cid)
            .order_by(col(ShiftConfig.id).asc())
        ).all()


@router.post("/sir/shifts", response_model=ShiftConfigRead, dependencies=[Depends(require_admin)])
def create_sir_shift(payload: ShiftConfigCreate, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        shift = ShiftConfig(
            name=payload.name.strip(),
            start_time=payload.start_time.strip(),
            end_time=payload.end_time.strip(),
            is_active=payload.is_active,
            company_id=cid,
            created_at=now,
            updated_at=now,
        )
        session.add(shift)
        session.commit()
        session.refresh(shift)
        return shift


@router.put("/sir/shifts/{shift_id}", response_model=ShiftConfigRead, dependencies=[Depends(require_admin)])
def update_sir_shift(shift_id: int, incoming: ShiftConfigUpdate, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        existing = session.get(ShiftConfig, shift_id)
        if not existing or existing.company_id != cid:
            raise HTTPException(status_code=404, detail="Shift configuration not found")
        if incoming.name is not None:
            existing.name = incoming.name.strip()
        if incoming.start_time is not None:
            existing.start_time = incoming.start_time.strip()
        if incoming.end_time is not None:
            existing.end_time = incoming.end_time.strip()
        if incoming.is_active is not None:
            existing.is_active = incoming.is_active
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing


@router.delete("/sir/shifts/{shift_id}", dependencies=[Depends(require_admin)])
def delete_sir_shift(shift_id: int, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        existing = session.get(ShiftConfig, shift_id)
        if not existing or existing.company_id != cid:
            raise HTTPException(status_code=404, detail="Shift configuration not found")
        session.delete(existing)
        session.commit()
    return {"ok": True, "message": "Shift configuration deleted"}


@router.get("/sir/targets", response_model=List[EscalationTargetRead])
def list_sir_targets(company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        return session.exec(
            select(EscalationTarget)
            .where(EscalationTarget.company_id == cid)
            .order_by(col(EscalationTarget.id).asc())
        ).all()


@router.post("/sir/targets", response_model=EscalationTargetRead, dependencies=[Depends(require_admin)])
def create_sir_target(payload: EscalationTargetCreate, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        target = EscalationTarget(
            name=payload.name.strip(),
            company_id=cid,
            created_at=now,
            updated_at=now,
        )
        session.add(target)
        session.commit()
        session.refresh(target)
        return target


@router.delete("/sir/targets/{target_id}", dependencies=[Depends(require_admin)])
def delete_sir_target(target_id: int, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        existing = session.get(EscalationTarget, target_id)
        if not existing or existing.company_id != cid:
            raise HTTPException(status_code=404, detail="Escalation target not found")
        session.delete(existing)
        session.commit()
    return {"ok": True, "message": "Escalation target deleted"}


@router.get("/sir/issues", response_model=List[ShiftIssueRead])
def list_sir_issues(company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        return session.exec(
            select(ShiftIssue)
            .where(ShiftIssue.company_id == cid)
            .order_by(col(ShiftIssue.created_at).desc())
        ).all()


@router.post("/sir/issues", response_model=ShiftIssueRead)
def create_sir_issue(payload: ShiftIssueCreate, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        
        count = len(session.exec(select(ShiftIssue).where(ShiftIssue.company_id == cid)).all())
        ref_no = f"SIR-{1001 + count}"

        issue = ShiftIssue(
            reference_no=ref_no,
            title=payload.title.strip(),
            time_noticed=payload.time_noticed.strip(),
            description=payload.description.strip(),
            actions_taken=payload.actions_taken.strip(),
            customer_response=payload.customer_response.strip() if payload.customer_response else None,
            status=payload.status or "Ongoing",
            escalated_to=payload.escalated_to.strip() if payload.escalated_to else "None",
            additional_notes=payload.additional_notes.strip() if payload.additional_notes else None,
            carry_forward=payload.carry_forward,
            next_shift_instructions=payload.next_shift_instructions.strip() if payload.next_shift_instructions else None,
            logged_by_name=payload.logged_by_name or "Support Agent",
            logged_by_initials=(payload.logged_by_initials or "SA").upper(),
            shift_name=payload.shift_name,
            company_id=cid,
            created_at=now,
            updated_at=now,
        )
        session.add(issue)
        session.commit()
        session.refresh(issue)
        return issue


@router.put("/sir/issues/{issue_id}", response_model=ShiftIssueRead)
def update_sir_issue(issue_id: int, incoming: ShiftIssueUpdate, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        existing = session.get(ShiftIssue, issue_id)
        if not existing or existing.company_id != cid:
            raise HTTPException(status_code=404, detail="Shift issue not found")

        if incoming.title is not None:
            existing.title = incoming.title.strip()
        if incoming.time_noticed is not None:
            existing.time_noticed = incoming.time_noticed.strip()
        if incoming.description is not None:
            existing.description = incoming.description.strip()
        if incoming.actions_taken is not None:
            existing.actions_taken = incoming.actions_taken.strip()
        if incoming.customer_response is not None:
            existing.customer_response = incoming.customer_response.strip() if incoming.customer_response else None
        if incoming.status is not None:
            existing.status = incoming.status
        if incoming.escalated_to is not None:
            existing.escalated_to = incoming.escalated_to.strip()
        if incoming.additional_notes is not None:
            existing.additional_notes = incoming.additional_notes.strip() if incoming.additional_notes else None
        if incoming.carry_forward is not None:
            existing.carry_forward = incoming.carry_forward
        if incoming.next_shift_instructions is not None:
            existing.next_shift_instructions = incoming.next_shift_instructions.strip() if incoming.next_shift_instructions else None

        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing


@router.delete("/sir/issues/{issue_id}")
def delete_sir_issue(issue_id: int, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        existing = session.get(ShiftIssue, issue_id)
        if not existing or existing.company_id != cid:
            raise HTTPException(status_code=404, detail="Shift issue not found")
        session.delete(existing)
        session.commit()
    return {"ok": True, "message": "Shift issue deleted"}
