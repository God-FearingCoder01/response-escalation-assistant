import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, select

from backend.main import app, engine, Agent, sync_default_data_if_needed
from backend.models import (
    AgentUserData,
    Favorite,
    PrivateNote,
    PrivateNoteCategory,
    UsageHistory,
)
from backend.tests.auth_helpers import get_agent_admin_headers

client = TestClient(app)

PERSONAL_MODELS = (Favorite, UsageHistory, PrivateNote, PrivateNoteCategory, AgentUserData)


@pytest.fixture(autouse=True)
def setup_db():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        sync_default_data_if_needed(session)
    yield


def _create_agent(headers, initials, name):
    res = client.post(
        "/agents",
        headers=headers,
        json={"agent": name, "agent_name": name, "agent_initials": initials, "is_admin": False, "pin": "1357"},
    )
    assert res.status_code == 200, res.text
    return res.json()["id"]


def _seed_personal_data(initials, company_id=1):
    with Session(engine) as session:
        session.add(Favorite(company_id=company_id, agent_initials=initials, template_id=1))
        session.add(UsageHistory(company_id=company_id, agent_initials=initials, template_id=1))
        session.add(PrivateNote(company_id=company_id, agent_initials=initials, name="n", body="b"))
        session.add(PrivateNoteCategory(company_id=company_id, agent_initials=initials, name="Cat"))
        session.add(AgentUserData(company_id=company_id, agent_initials=initials))
        session.commit()


def _count_personal_rows(initials, company_id=1):
    with Session(engine) as session:
        return sum(
            len(
                session.exec(
                    select(model).where(model.company_id == company_id, model.agent_initials == initials)
                ).all()
            )
            for model in PERSONAL_MODELS
        )


def test_delete_agent_removes_personal_data():
    headers = get_agent_admin_headers()
    agent_id = _create_agent(headers, "ZZ", "Zed")
    _seed_personal_data("ZZ")
    assert _count_personal_rows("ZZ") == len(PERSONAL_MODELS)

    res = client.delete(f"/agents/{agent_id}", headers=headers)
    assert res.status_code == 200
    body = res.json()
    assert body["ok"] is True
    assert body["removed"] == {
        "favorites": 1,
        "history": 1,
        "private_notes": 1,
        "note_categories": 1,
        "saved_data": 1,
    }

    assert _count_personal_rows("ZZ") == 0
    with Session(engine) as session:
        assert session.get(Agent, agent_id) is None


def test_delete_agent_leaves_other_agents_data_untouched():
    headers = get_agent_admin_headers()
    agent_id = _create_agent(headers, "ZZ", "Zed")
    _seed_personal_data("ZZ")
    _seed_personal_data("SA")
    before = _count_personal_rows("SA")

    assert client.delete(f"/agents/{agent_id}", headers=headers).status_code == 200
    assert _count_personal_rows("SA") == before


def test_delete_agent_leaves_other_companies_data_untouched():
    headers = get_agent_admin_headers()
    agent_id = _create_agent(headers, "ZZ", "Zed")
    _seed_personal_data("ZZ", company_id=1)
    _seed_personal_data("ZZ", company_id=2)

    assert client.delete(f"/agents/{agent_id}", headers=headers).status_code == 200
    assert _count_personal_rows("ZZ", company_id=1) == 0
    assert _count_personal_rows("ZZ", company_id=2) == len(PERSONAL_MODELS)


def test_delete_agent_keeps_data_when_initials_are_shared():
    headers = get_agent_admin_headers()
    first_id = _create_agent(headers, "ZZ", "Zed One")
    _create_agent(headers, "ZZ", "Zed Two")
    _seed_personal_data("ZZ")

    res = client.delete(f"/agents/{first_id}", headers=headers)
    assert res.status_code == 200
    assert res.json()["removed"] == {}
    assert _count_personal_rows("ZZ") == len(PERSONAL_MODELS)
