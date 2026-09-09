import json
from datetime import datetime, timezone
from typing import List, Optional, Any
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.database import engine
from backend.models import Company, AgentUserData
from backend.security import get_current_company

router = APIRouter(tags=["Agent User Data"])


class SaveAgentDataPayload(BaseModel):
    agent_initials: str
    favorites: Optional[List[Any]] = None
    recently_used: Optional[List[Any]] = None
    usage_counts: Optional[dict] = None
    private_notes: Optional[List[dict]] = None
    translation_history: Optional[List[dict]] = None
    custom_categories: Optional[List[str]] = None


@router.get("/api/agent-data")
@router.get("/agent-data")
def get_agent_user_data(agent_initials: str, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    init = agent_initials.strip().upper()
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    with Session(engine) as session:
        record = session.exec(
            select(AgentUserData)
            .where(AgentUserData.company_id == cid)
            .where(AgentUserData.agent_initials == init)
        ).first()

        if not record:
            record = AgentUserData(
                company_id=cid,
                agent_initials=init,
                favorites_json="[]",
                recently_used_json="[]",
                usage_counts_json="{}",
                usage_date=today_str,
                private_notes_json="[]",
                translation_history_json="[]",
                custom_categories_json="[]",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )
            session.add(record)
            session.commit()
            session.refresh(record)

        if record.usage_date != today_str:
            record.usage_counts_json = "{}"
            record.usage_date = today_str
            record.updated_at = datetime.now(timezone.utc)
            session.add(record)
            session.commit()
            session.refresh(record)

        try:
            favs = json.loads(record.favorites_json or "[]")
        except Exception:
            favs = []

        try:
            recents = json.loads(record.recently_used_json or "[]")
        except Exception:
            recents = []

        try:
            counts = json.loads(record.usage_counts_json or "{}")
        except Exception:
            counts = {}

        try:
            notes = json.loads(record.private_notes_json or "[]")
        except Exception:
            notes = []

        try:
            history = json.loads(record.translation_history_json or "[]")
        except Exception:
            history = []

        try:
            cats = json.loads(getattr(record, "custom_categories_json", "[]") or "[]")
        except Exception:
            cats = []

        return {
            "agent_initials": init,
            "company_id": cid,
            "favorites": favs,
            "recently_used": recents,
            "usage_counts": counts,
            "usage_date": record.usage_date,
            "private_notes": notes,
            "translation_history": history,
            "custom_categories": cats,
        }


@router.post("/api/agent-data")
@router.post("/agent-data")
def save_agent_user_data(payload: SaveAgentDataPayload, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    init = payload.agent_initials.strip().upper()
    today_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    with Session(engine) as session:
        record = session.exec(
            select(AgentUserData)
            .where(AgentUserData.company_id == cid)
            .where(AgentUserData.agent_initials == init)
        ).first()

        if not record:
            record = AgentUserData(
                company_id=cid,
                agent_initials=init,
                favorites_json="[]",
                recently_used_json="[]",
                usage_counts_json="{}",
                usage_date=today_str,
                private_notes_json="[]",
                translation_history_json="[]",
                custom_categories_json="[]",
                created_at=datetime.now(timezone.utc),
                updated_at=datetime.now(timezone.utc),
            )

        if payload.favorites is not None:
            record.favorites_json = json.dumps(payload.favorites)
        if payload.recently_used is not None:
            record.recently_used_json = json.dumps(payload.recently_used)
        if payload.usage_counts is not None:
            if record.usage_date != today_str:
                record.usage_counts_json = json.dumps(payload.usage_counts)
                record.usage_date = today_str
            else:
                record.usage_counts_json = json.dumps(payload.usage_counts)
        if payload.private_notes is not None:
            record.private_notes_json = json.dumps(payload.private_notes)
        if payload.translation_history is not None:
            record.translation_history_json = json.dumps(payload.translation_history)
        if payload.custom_categories is not None:
            record.custom_categories_json = json.dumps(payload.custom_categories)

        record.updated_at = datetime.now(timezone.utc)
        session.add(record)
        session.commit()
        session.refresh(record)

        return {"status": "ok", "message": "Agent user data synchronized successfully"}
