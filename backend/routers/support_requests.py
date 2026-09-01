from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select, col

from backend.database import engine, ensure_db_initialized
from backend.models import (
    SupportRequest,
    SupportRequestCreate,
    SupportRequestRead,
    SupportRequestUpdate,
)
from backend.security import require_admin

router = APIRouter(tags=["Support Requests"])


@router.post("/support-requests", response_model=SupportRequestRead)
def create_support_request(payload: SupportRequestCreate):
    ensure_db_initialized()
    with Session(engine) as session:
        if not payload.org_name.strip() or not payload.requester_name.strip() or not payload.contact_email.strip():
            raise HTTPException(status_code=400, detail="Organization name, requester name, and contact email are required")
        
        now = datetime.now(timezone.utc)
        req_obj = SupportRequest(
            org_name=payload.org_name.strip(),
            requester_name=payload.requester_name.strip(),
            contact_email=payload.contact_email.strip(),
            request_type=payload.request_type or "new_org_url",
            details=payload.details.strip() if payload.details else "",
            status="pending",
            created_at=now,
            updated_at=now,
        )
        session.add(req_obj)
        session.commit()
        session.refresh(req_obj)
        return req_obj


@router.get("/support-requests", response_model=List[SupportRequestRead], dependencies=[Depends(require_admin)])
def list_support_requests():
    ensure_db_initialized()
    with Session(engine) as session:
        return session.exec(select(SupportRequest).order_by(col(SupportRequest.created_at).desc())).all()


@router.patch("/support-requests/{request_id}", response_model=SupportRequestRead, dependencies=[Depends(require_admin)])
def update_support_request_status(request_id: int, payload: SupportRequestUpdate):
    ensure_db_initialized()
    with Session(engine) as session:
        req_obj = session.get(SupportRequest, request_id)
        if not req_obj:
            raise HTTPException(status_code=404, detail="Support request not found")
        if payload.status:
            req_obj.status = payload.status
        req_obj.updated_at = datetime.now(timezone.utc)
        session.add(req_obj)
        session.commit()
        session.refresh(req_obj)
        return req_obj
