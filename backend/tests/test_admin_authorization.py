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


def test_non_admin_agent_cannot_use_admin_endpoints():
    admin_headers = get_agent_admin_headers(1, "SA")
    created = client.post(
        "/agents",
        headers=admin_headers,
        json={"agent": "Plain Agent", "agent_name": "Plain", "agent_initials": "PA", "is_admin": False},
    )
    assert created.status_code == 200

    agent_headers = get_agent_admin_headers(1, "PA")  # a valid session for a NON-admin agent
    shift = {"name": "Sneaky Shift", "start_time": "01:00", "end_time": "02:00"}

    # Reading is allowed for any signed-in agent; changing configuration is not.
    assert client.get("/sir/shifts", headers=agent_headers).status_code == 200
    assert client.post("/sir/shifts", headers=agent_headers, json=shift).status_code in (401, 403)
    assert client.post(
        "/agents",
        headers=agent_headers,
        json={"agent": "Other", "agent_name": "Other", "agent_initials": "OT", "is_admin": True},
    ).status_code in (401, 403)

    # The real admin still can.
    assert client.post("/sir/shifts", headers=admin_headers, json=shift).status_code == 200
