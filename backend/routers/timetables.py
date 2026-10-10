import json
from datetime import datetime, timezone
from typing import Optional

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field as PydanticField
from sqlmodel import Session, select, col

from backend.database import engine
from backend.models import Agent, Company, MonthlyTimetable
from backend.security import get_current_company, require_admin

router = APIRouter(prefix="/timetables", tags=["Timetables"])


class TimetableAgent(BaseModel):
    agent_initials: str
    entries: list[dict]


class TimetableImport(BaseModel):
    year: int = PydanticField(ge=2000, le=2200)
    month: int = PydanticField(ge=1, le=12)
    source_filename: str = PydanticField(min_length=1, max_length=255)
    schedules: list[TimetableAgent] = PydanticField(min_length=1)


def _archive_item(record: MonthlyTimetable) -> dict:
    try:
        schedules = json.loads(record.schedules_json)
    except (TypeError, json.JSONDecodeError):
        schedules = []
    return {
        "id": record.id,
        "year": record.year,
        "month": record.month,
        "source_filename": record.source_filename,
        "uploaded_by": record.uploaded_by,
        "created_at": record.created_at.isoformat(),
        "agent_count": len(schedules),
    }


def _latest_timetable(session: Session, company_id: int, year: int, month: int):
    return session.exec(
        select(MonthlyTimetable)
        .where(
            MonthlyTimetable.company_id == company_id,
            MonthlyTimetable.year == year,
            MonthlyTimetable.month == month,
        )
        .order_by(col(MonthlyTimetable.id).desc())
    ).first()


@router.post("/import", dependencies=[Depends(require_admin)])
def import_timetable(payload: TimetableImport, company: Company = Depends(get_current_company),
                     x_admin_initials: Optional[str] = Header(None, alias="X-Admin-Initials")):
    cid = company.id or 1
    with Session(engine) as session:
        roster = session.exec(select(Agent).where(Agent.company_id == cid)).all()
        by_initials = {agent.agent_initials.strip().upper(): agent for agent in roster}
        clean_schedules = []
        seen_agents = set()
        for schedule in payload.schedules:
            initials = schedule.agent_initials.strip().upper()
            agent = by_initials.get(initials)
            if not agent or agent.is_active is False:
                raise HTTPException(status_code=400, detail=f"Unknown or inactive agent: {initials}")
            if initials in seen_agents:
                raise HTTPException(status_code=400, detail=f"Duplicate schedule for {initials}")
            seen_agents.add(initials)
            seen_dates = set()
            entries = []
            for entry in schedule.entries:
                date = str(entry.get("date", ""))
                shift = str(entry.get("shift", "")).strip()[:80]
                try:
                    parsed = datetime.strptime(date, "%Y-%m-%d")
                except ValueError:
                    raise HTTPException(status_code=400, detail=f"Invalid schedule date for {initials}")
                if parsed.year != payload.year or parsed.month != payload.month:
                    raise HTTPException(status_code=400, detail=f"Schedule date is outside the selected month for {initials}")
                if date in seen_dates or not shift:
                    raise HTTPException(status_code=400, detail=f"Duplicate or empty shift entry for {initials}")
                seen_dates.add(date)
                entries.append({"date": date, "shift": shift})
            if not entries:
                raise HTTPException(status_code=400, detail=f"No schedule entries for {initials}")
            clean_schedules.append({"agent_initials": initials, "agent_name": agent.agent_name, "entries": entries})

        record = MonthlyTimetable(
            company_id=cid,
            year=payload.year,
            month=payload.month,
            source_filename=payload.source_filename,
            uploaded_by=(x_admin_initials or "Admin").strip().upper(),
            schedules_json=json.dumps(clean_schedules, ensure_ascii=False),
            created_at=datetime.now(timezone.utc),
        )
        session.add(record)
        session.commit()
        session.refresh(record)
        return _archive_item(record)


@router.get("/archive")
def list_timetable_archive(company: Company = Depends(get_current_company),
                           x_agent_initials: Optional[str] = Header(None, alias="X-Agent-Initials")):
    if not x_agent_initials:
        raise HTTPException(status_code=401, detail="Agent profile required")
    cid = company.id or 1
    with Session(engine) as session:
        agent = session.exec(select(Agent).where(
            Agent.company_id == cid,
            Agent.agent_initials == x_agent_initials.strip().upper(),
            Agent.is_active == True,
        )).first()
        if not agent:
            raise HTTPException(status_code=403, detail="Agent profile is not active in this organization")
        rows = session.exec(select(MonthlyTimetable).where(
            MonthlyTimetable.company_id == cid
        ).order_by(col(MonthlyTimetable.year).desc(), col(MonthlyTimetable.month).desc(), col(MonthlyTimetable.id).desc())).all()
        # Only list months that contain an entry for this agent.
        result, seen = [], set()
        for row in rows:
            key = (row.year, row.month)
            if key in seen:
                continue
            try:
                schedules = json.loads(row.schedules_json)
            except (TypeError, json.JSONDecodeError):
                continue
            if any(item.get("agent_initials", "").upper() == agent.agent_initials.upper() for item in schedules):
                result.append(_archive_item(row))
                seen.add(key)
        return result


@router.get("/me")
def get_my_timetable(year: int, month: int, company: Company = Depends(get_current_company),
                     x_agent_initials: Optional[str] = Header(None, alias="X-Agent-Initials")):
    if not x_agent_initials:
        raise HTTPException(status_code=401, detail="Agent profile required")
    if month < 1 or month > 12:
        raise HTTPException(status_code=400, detail="Month must be from 1 to 12")
    cid = company.id or 1
    with Session(engine) as session:
        agent = session.exec(select(Agent).where(
            Agent.company_id == cid,
            Agent.agent_initials == x_agent_initials.strip().upper(),
            Agent.is_active == True,
        )).first()
        if not agent:
            raise HTTPException(status_code=403, detail="Agent profile is not active in this organization")
        record = _latest_timetable(session, cid, year, month)
        if not record:
            raise HTTPException(status_code=404, detail="No timetable has been uploaded for this month")
        schedules = json.loads(record.schedules_json)
        mine = next((item for item in schedules if item.get("agent_initials", "").upper() == agent.agent_initials.upper()), None)
        if not mine:
            raise HTTPException(status_code=404, detail="No timetable is available for your profile for this month")
        return {"year": year, "month": month, "entries": mine["entries"], "imported_at": record.created_at.isoformat()}


@router.get("/shift-mates")
def get_shift_mates(date: str, company: Company = Depends(get_current_company),
                    x_agent_initials: Optional[str] = Header(None, alias="X-Agent-Initials")):
    if not x_agent_initials:
        raise HTTPException(status_code=401, detail="Agent profile required")
    try:
        selected_date = datetime.strptime(date, "%Y-%m-%d").date()
    except ValueError:
        raise HTTPException(status_code=400, detail="Date must use YYYY-MM-DD format")

    cid = company.id or 1
    with Session(engine) as session:
        agent = session.exec(select(Agent).where(
            Agent.company_id == cid,
            Agent.agent_initials == x_agent_initials.strip().upper(),
            Agent.is_active == True,
        )).first()
        if not agent:
            raise HTTPException(status_code=403, detail="Agent profile is not active in this organization")
        record = _latest_timetable(session, cid, selected_date.year, selected_date.month)
        if not record:
            raise HTTPException(status_code=404, detail="No timetable has been uploaded for this month")

        schedules = json.loads(record.schedules_json)
        mine = next((item for item in schedules if item.get("agent_initials", "").upper() == agent.agent_initials.upper()), None)
        if not mine:
            raise HTTPException(status_code=404, detail="No timetable is available for your profile for this month")
        own_entry = next((item for item in mine.get("entries", []) if item.get("date") == date), None)
        if not own_entry or own_entry.get("shift", "").strip().lower() in {"off", "leave", "holiday"}:
            return {"date": date, "shift": own_entry.get("shift") if own_entry else None, "coworkers": []}

        shift_key = " ".join(own_entry.get("shift", "").split()).casefold()
        coworkers = []
        for schedule in schedules:
            if schedule.get("agent_initials", "").upper() == agent.agent_initials.upper():
                continue
            matching = next((item for item in schedule.get("entries", [])
                             if item.get("date") == date and " ".join(item.get("shift", "").split()).casefold() == shift_key), None)
            if matching:
                coworkers.append({
                    "agent_name": schedule.get("agent_name") or schedule.get("agent_initials"),
                    "agent_initials": schedule.get("agent_initials"),
                })
        return {"date": date, "shift": own_entry["shift"], "coworkers": coworkers}


@router.get("/admin/archive", dependencies=[Depends(require_admin)])
def list_admin_timetable_archive(company: Company = Depends(get_current_company)):
    with Session(engine) as session:
        rows = session.exec(select(MonthlyTimetable).where(
            MonthlyTimetable.company_id == (company.id or 1)
        ).order_by(col(MonthlyTimetable.id).desc())).all()
        return [_archive_item(row) for row in rows]
