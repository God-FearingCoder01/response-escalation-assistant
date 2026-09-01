from datetime import datetime, timezone
from typing import List, Optional
from fastapi import APIRouter, HTTPException, Depends, Header
from sqlmodel import Session, select, col

from backend.database import engine
from backend.models import (
    Company,
    PrivateNote,
    PrivateNoteCreate,
    PrivateNoteRead,
    PrivateNoteUpdate,
)
from backend.security import get_current_company

router = APIRouter(tags=["Private Notes"])


@router.get("/private-notes", response_model=List[PrivateNoteRead])
def list_private_notes(
    agent_initials: Optional[str] = Header(None, alias="X-Agent-Initials"),
    company: Company = Depends(get_current_company),
):
    cid = company.id if company and company.id else 1
    if not agent_initials:
        return []
    with Session(engine) as session:
        notes = session.exec(
            select(PrivateNote)
            .where(PrivateNote.company_id == cid)
            .where(PrivateNote.agent_initials == agent_initials.upper())
            .order_by(col(PrivateNote.updated_at).desc())
        ).all()
        today = datetime.now(timezone.utc).date()
        for n in notes:
            if n.updated_at and n.updated_at.date() < today:
                n.use_count = 0
        return notes


@router.post("/private-notes", response_model=PrivateNoteRead)
def create_private_note(
    note: PrivateNoteCreate,
    agent_initials: Optional[str] = Header(None, alias="X-Agent-Initials"),
    company: Company = Depends(get_current_company),
):
    cid = company.id if company and company.id else 1
    init = (note.agent_initials or agent_initials or "SA").upper()
    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        db_note = PrivateNote(
            name=note.name,
            body=note.body,
            category_type=note.category_type or "customer_reply",
            category=note.category or "Personal Notes",
            subcategory=note.subcategory,
            placeholder_config=note.placeholder_config,
            use_count=note.use_count or 0,
            submitted_as_suggestion=note.submitted_as_suggestion or False,
            agent_initials=init,
            company_id=cid,
            created_at=now,
            updated_at=now,
        )
        session.add(db_note)
        session.commit()
        session.refresh(db_note)
        return db_note


@router.put("/private-notes/{note_id}", response_model=PrivateNoteRead)
def update_private_note(
    note_id: int,
    incoming: PrivateNoteUpdate,
    agent_initials: Optional[str] = Header(None, alias="X-Agent-Initials"),
    company: Company = Depends(get_current_company),
):
    cid = company.id if company and company.id else 1
    init = (agent_initials or "").upper()
    with Session(engine) as session:
        existing = session.get(PrivateNote, note_id)
        if not existing or existing.company_id != cid:
            raise HTTPException(status_code=404, detail="Private note not found")
        if init and existing.agent_initials != init:
            raise HTTPException(status_code=403, detail="Not authorized to edit this private note")
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
        if incoming.placeholder_config is not None:
            existing.placeholder_config = incoming.placeholder_config
        if incoming.use_count is not None:
            existing.use_count = incoming.use_count
        if incoming.submitted_as_suggestion is not None:
            existing.submitted_as_suggestion = incoming.submitted_as_suggestion
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing


@router.delete("/private-notes/{note_id}")
def delete_private_note(
    note_id: int,
    agent_initials: Optional[str] = Header(None, alias="X-Agent-Initials"),
    company: Company = Depends(get_current_company),
):
    cid = company.id if company and company.id else 1
    init = (agent_initials or "").upper()
    with Session(engine) as session:
        existing = session.get(PrivateNote, note_id)
        if not existing or existing.company_id != cid:
            raise HTTPException(status_code=404, detail="Private note not found")
        if init and existing.agent_initials != init:
            raise HTTPException(status_code=403, detail="Not authorized to delete this private note")
        session.delete(existing)
        session.commit()
    return {"ok": True, "message": "Private note deleted"}


@router.post("/private-notes/{note_id}/use", response_model=PrivateNoteRead)
def track_private_note_usage(
    note_id: int,
    company: Company = Depends(get_current_company),
):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        existing = session.get(PrivateNote, note_id)
        if not existing or existing.company_id != cid:
            raise HTTPException(status_code=404, detail="Private note not found")
        now = datetime.now(timezone.utc)
        if existing.updated_at and existing.updated_at.date() < now.date():
            existing.use_count = 1
        else:
            existing.use_count = (existing.use_count or 0) + 1
        existing.updated_at = now
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing
