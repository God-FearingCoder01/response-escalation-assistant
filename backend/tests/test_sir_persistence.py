import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session
from backend.main import app, engine, sync_default_data_if_needed
from backend.tests.auth_helpers import get_agent_admin_headers, get_superadmin_headers

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        sync_default_data_if_needed(session)
    yield


def make_company_headers(slug: str):
    res = client.post(
        "/companies",
        headers=get_superadmin_headers(),
        json={"name": slug.title(), "slug": slug, "is_active": True},
    )
    assert res.status_code == 200
    return get_agent_admin_headers(res.json()["id"])


def test_new_company_gets_real_default_shifts_and_edits_persist():
    """Defaults must be real rows so editing/deleting them is saved, not just shown."""
    headers = make_company_headers("persist-shifts")

    shifts = client.get("/sir/shifts", headers=headers).json()
    assert [s["name"] for s in shifts] == ["Morning Shift", "Afternoon Shift", "Night Shift (Graveyard)"]

    # Editing a default row works and survives a reload.
    res = client.put(f"/sir/shifts/{shifts[0]['id']}", headers=headers, json={"name": "Early Shift"})
    assert res.status_code == 200
    reloaded = client.get("/sir/shifts", headers=headers).json()
    assert len(reloaded) == 3
    assert reloaded[0]["name"] == "Early Shift"

    # Deleting one is permanent: the defaults are not re-seeded while rows remain.
    assert client.delete(f"/sir/shifts/{shifts[1]['id']}", headers=headers).status_code == 200
    reloaded = client.get("/sir/shifts", headers=headers).json()
    assert [s["name"] for s in reloaded] == ["Early Shift", "Night Shift (Graveyard)"]

    # A newly added shift is kept alongside the others.
    created = client.post(
        "/sir/shifts",
        headers=headers,
        json={"name": "Weekend Shift", "start_time": "08:00", "end_time": "16:00"},
    )
    assert created.status_code == 200
    reloaded = client.get("/sir/shifts", headers=headers).json()
    assert [s["name"] for s in reloaded][-1] == "Weekend Shift"
    assert len(reloaded) == 3


def test_new_company_gets_real_default_escalation_targets():
    headers = make_company_headers("persist-targets")

    targets = client.get("/sir/targets", headers=headers).json()
    assert len(targets) == 5
    assert targets[0]["name"] == "Technical Support Team"

    assert client.delete(f"/sir/targets/{targets[0]['id']}", headers=headers).status_code == 200
    reloaded = client.get("/sir/targets", headers=headers).json()
    assert len(reloaded) == 4
    assert all(t["name"] != "Technical Support Team" for t in reloaded)
