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


def initials(agents):
    return {a["agent_initials"] for a in agents}


def test_deactivated_agent_is_hidden_from_welcome_but_kept_for_admin_and_data_survives():
    admin_headers = get_agent_admin_headers(1, "SA")
    created = client.post(
        "/agents",
        headers=admin_headers,
        json={"agent": "Away Agent", "agent_name": "Away", "agent_initials": "AW", "is_admin": False},
    )
    assert created.status_code == 200
    agent_id = created.json()["id"]

    agent_headers = get_agent_admin_headers(1, "AW")
    note = client.post(
        "/private-notes",
        headers=agent_headers,
        json={
            "name": "My shift note",
            "body": "Hi {customer_name}, I am looking into this.",
            "category_type": "customer_reply",
            "agent_initials": "AW",
        },
    )
    assert note.status_code == 200
    note_id = note.json()["id"]

    # Deactivate
    res = client.put(f"/agents/{agent_id}", headers=admin_headers, json={"is_active": False})
    assert res.status_code == 200
    assert res.json()["is_active"] is False

    # Hidden from the public list used by the Welcome screen...
    assert "AW" not in initials(client.get("/agents").json())
    # ...but still listed for an admin, flagged as inactive, so it can be reactivated.
    all_agents = client.get("/agents/all", headers=admin_headers).json()
    assert {a["agent_initials"]: a["is_active"] for a in all_agents}["AW"] is False
    # The full list is not available to a deactivated (or any non-admin) agent.
    assert client.get("/agents/all", headers=agent_headers).status_code in (401, 403)
    assert client.get("/private-notes", headers=agent_headers).status_code == 401

    # Reactivate: the profile is back on the Welcome list and the personal note is intact.
    res = client.put(f"/agents/{agent_id}", headers=admin_headers, json={"is_active": True})
    assert res.status_code == 200
    assert "AW" in initials(client.get("/agents").json())
    notes = client.get("/private-notes", headers=agent_headers)
    assert notes.status_code == 200
    assert any(n["id"] == note_id for n in notes.json())
