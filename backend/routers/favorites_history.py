from datetime import datetime, timezone
from fastapi import APIRouter, HTTPException, Depends
from sqlmodel import Session, select, col

from backend.database import engine
from backend.models import Company, Favorite, UsageHistory, Template
from backend.security import get_current_company

router = APIRouter(tags=["Favorites & History"])


@router.get("/favorites/{agent_initials}")
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


@router.post("/favorites/{agent_initials}/{template_id}")
def toggle_agent_favorite(agent_initials: str, template_id: int, company: Company = Depends(get_current_company)):
    if company.id is None:
        raise HTTPException(status_code=400, detail="Invalid company ID")
    with Session(engine) as session:
        tpl = session.get(Template, template_id)
        if not tpl or tpl.company_id != company.id:
            raise HTTPException(status_code=404, detail="Template not found in this organization")

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


@router.get("/history/{agent_initials}")
def get_agent_history(agent_initials: str, company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        initials = agent_initials.upper()
        now = datetime.now(timezone.utc)
        start_of_today = datetime(now.year, now.month, now.day, tzinfo=timezone.utc)

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
            if h.copied_at and h.copied_at >= start_of_today:
                counts[h.template_id] = counts.get(h.template_id, 0) + 1
            if h.template_id not in seen:
                seen.add(h.template_id)
                recents.append({
                    "templateId": h.template_id,
                    "timestamp": int(h.copied_at.timestamp() * 1000)
                })

        return {"counts": counts, "recents": recents}


@router.post("/history/{agent_initials}/{template_id}")
def record_agent_copy_history(agent_initials: str, template_id: int, company: Company = Depends(get_current_company)):
    if company.id is None:
        raise HTTPException(status_code=400, detail="Invalid company ID")
    with Session(engine) as session:
        tpl = session.get(Template, template_id)
        if not tpl or tpl.company_id != company.id:
            raise HTTPException(status_code=404, detail="Template not found in this organization")

        initials = agent_initials.upper()
        entry = UsageHistory(company_id=company.id, agent_initials=initials, template_id=template_id)
        session.add(entry)
        session.commit()
    return {"ok": True}
