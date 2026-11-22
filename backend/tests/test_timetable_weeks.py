import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session

from backend.main import app, engine, sync_default_data_if_needed
from backend.tests.auth_helpers import get_agent_admin_headers

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        sync_default_data_if_needed(session)
    yield


def admin():
    return get_agent_admin_headers(1, "SA")


def add_agent(initials="PA"):
    res = client.post(
        "/agents",
        headers=admin(),
        json={"agent": f"Plain {initials}", "agent_name": f"Plain {initials}", "agent_initials": initials, "is_admin": False},
    )
    assert res.status_code == 200
    return get_agent_admin_headers(1, initials)


def december_payload(*dates, initials=("SA",), shift="7a.m-4p.m"):
    return {
        "year": 2026,
        "month": 12,
        "source_filename": "december.xlsx",
        "schedules": [
            {"agent_initials": who, "entries": [{"date": d, "shift": shift} for d in dates]} for who in initials
        ],
    }


def test_december_timetable_keeps_days_from_neighbouring_months():
    dates = ["2026-11-29", "2026-11-30", "2026-12-01", "2026-12-31", "2027-01-01", "2027-01-02"]
    res = client.post("/timetables/import", headers=admin(), json=december_payload(*dates))
    assert res.status_code == 200

    mine = client.get("/timetables/me", params={"year": 2026, "month": 12}, headers=admin())
    assert mine.status_code == 200
    assert [e["date"] for e in mine.json()["entries"]] == dates


def test_days_far_outside_the_weeks_of_the_month_are_rejected():
    for bad in ("2026-11-20", "2027-01-15"):
        res = client.post("/timetables/import", headers=admin(), json=december_payload("2026-12-02", bad))
        assert res.status_code == 400
        assert "outside" in res.json()["detail"]


def test_a_five_week_month_imports_every_day():
    from datetime import date, timedelta

    start = date(2026, 11, 29)
    dates = [(start + timedelta(days=i)).isoformat() for i in range(35)]  # Nov 29 .. Jan 2
    res = client.post("/timetables/import", headers=admin(), json=december_payload(*dates))
    assert res.status_code == 200
    mine = client.get("/timetables/me", params={"year": 2026, "month": 12}, headers=admin()).json()
    assert len(mine["entries"]) == 35


def test_shift_mates_for_a_november_day_use_the_december_timetable():
    other = add_agent("PA")
    payload = december_payload("2026-11-29", "2026-12-02", initials=("SA", "PA"))
    assert client.post("/timetables/import", headers=admin(), json=payload).status_code == 200

    res = client.get("/timetables/shift-mates", params={"date": "2026-11-29"}, headers=admin())
    assert res.status_code == 200
    data = res.json()
    assert data["shift"] == "7a.m-4p.m"
    assert [c["agent_initials"] for c in data["coworkers"]] == ["PA"]
    assert other  # the second agent exists and is active


def test_shift_mates_prefer_the_months_own_timetable():
    november = {
        "year": 2026,
        "month": 11,
        "source_filename": "november.xlsx",
        "schedules": [{"agent_initials": "SA", "entries": [{"date": "2026-11-29", "shift": "2p.m-10p.m"}]}],
    }
    assert client.post("/timetables/import", headers=admin(), json=november).status_code == 200
    assert client.post("/timetables/import", headers=admin(), json=december_payload("2026-11-29")).status_code == 200
    res = client.get("/timetables/shift-mates", params={"date": "2026-11-29"}, headers=admin())
    assert res.json()["shift"] == "2p.m-10p.m"
