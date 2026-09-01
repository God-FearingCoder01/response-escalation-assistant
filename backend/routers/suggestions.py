from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select, col

from backend.database import engine
from backend.models import (
    Company,
    Suggestion,
    SuggestionCreate,
    SuggestionRead,
    Template,
    TemplateRead,
)
from backend.security import get_current_company, require_admin

router = APIRouter(tags=["Suggestions"])


@router.get("/suggestions", response_model=List[SuggestionRead])
def get_suggestions(company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        return session.exec(
            select(Suggestion)
            .where(Suggestion.company_id == cid)
            .order_by(col(Suggestion.created_at).desc())
        ).all()


@router.post("/suggestions", response_model=SuggestionRead)
def create_suggestion(payload: SuggestionCreate, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        suggestion = Suggestion(
            name=payload.name.strip(),
            body=payload.body.strip(),
            category_type=payload.category_type or "tech_escalation",
            category=payload.category.strip() if payload.category else None,
            subcategory=payload.subcategory.strip() if payload.subcategory else None,
            suggested_by_name=payload.suggested_by_name or "Support Agent",
            suggested_by_initials=(payload.suggested_by_initials or "SA").upper(),
            status=payload.status or "pending",
            company_id=cid,
            created_at=now,
            updated_at=now,
        )
        session.add(suggestion)
        session.commit()
        session.refresh(suggestion)
        return suggestion


@router.post("/suggestions/{suggestion_id}/approve", response_model=TemplateRead, dependencies=[Depends(require_admin)])
def approve_suggestion(suggestion_id: int, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        sug = session.get(Suggestion, suggestion_id)
        if not sug or sug.company_id != cid:
            raise HTTPException(status_code=404, detail="Suggestion not found")

        now = datetime.now(timezone.utc)
        new_tpl = Template(
            name=sug.name,
            body=sug.body,
            category_type=sug.category_type,
            category=sug.category,
            subcategory=sug.subcategory,
            company_id=cid,
            created_at=now,
            updated_at=now,
        )
        session.add(new_tpl)

        sug.status = "approved"
        sug.updated_at = now
        session.add(sug)

        session.commit()
        session.refresh(new_tpl)
        return new_tpl


@router.post("/suggestions/{suggestion_id}/reject", response_model=SuggestionRead, dependencies=[Depends(require_admin)])
def reject_suggestion(suggestion_id: int, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        sug = session.get(Suggestion, suggestion_id)
        if not sug or sug.company_id != cid:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        sug.status = "rejected"
        sug.updated_at = datetime.now(timezone.utc)
        session.add(sug)
        session.commit()
        session.refresh(sug)
        return sug


@router.delete("/suggestions/{suggestion_id}", dependencies=[Depends(require_admin)])
def delete_suggestion(suggestion_id: int, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        sug = session.get(Suggestion, suggestion_id)
        if not sug or sug.company_id != cid:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        session.delete(sug)
        session.commit()
    return {"ok": True, "message": "Suggestion permanently deleted"}
