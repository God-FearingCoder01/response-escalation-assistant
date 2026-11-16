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


def make_agent(headers, name, initials, active=True):
    res = client.post(
        "/agents",
        headers=headers,
        json={"agent": name, "agent_name": name, "agent_initials": initials, "is_admin": False, "is_active": active},
    )
    assert res.status_code == 200
    return res.json()["id"]


def order(path="/agents", headers=None):
    return [a["agent_initials"] for a in client.get(path, headers=headers).json()]


def test_new_agents_are_added_to_the_end_of_the_list():
    admin = get_agent_admin_headers(1, "SA")
    before = order()
    make_agent(admin, "Anna", "AN")
    make_agent(admin, "Ben", "BE")
    assert order() == before + ["AN", "BE"]


def test_admin_can_reorder_and_the_welcome_list_follows():
    admin = get_agent_admin_headers(1, "SA")
    a = make_agent(admin, "Anna", "AN")
    b = make_agent(admin, "Ben", "BE")
    c = make_agent(admin, "Cara", "CA")
    everyone = [x["id"] for x in client.get("/agents/all", headers=admin).json()]
    sa = [i for i in everyone if i not in (a, b, c)]

    res = client.put("/agents/reorder", headers=admin, json={"agent_ids": [c, a, b] + sa})
    assert res.status_code == 200
    assert [x["agent_initials"] for x in res.json()][:3] == ["CA", "AN", "BE"]
    assert order()[:3] == ["CA", "AN", "BE"]
    assert order("/agents/all", admin)[:3] == ["CA", "AN", "BE"]


def test_agents_left_out_of_the_request_keep_their_place_after_the_listed_ones():
    admin = get_agent_admin_headers(1, "SA")
    a = make_agent(admin, "Anna", "AN")
    b = make_agent(admin, "Ben", "BE")
    res = client.put("/agents/reorder", headers=admin, json={"agent_ids": [b]})
    assert res.status_code == 200
    assert order()[0] == "BE"
    assert order().index("AN") > order().index("BE")
    assert len(order()) == len(set(order()))
    assert a != b


def test_deactivated_agents_stay_hidden_but_keep_their_position():
    admin = get_agent_admin_headers(1, "SA")
    a = make_agent(admin, "Anna", "AN")
    b = make_agent(admin, "Ben", "BE")
    assert client.put(f"/agents/{a}", headers=admin, json={"is_active": False}).status_code == 200
    assert "AN" not in order()
    assert order("/agents/all", admin).index("AN") < order("/agents/all", admin).index("BE")
    assert b


def test_reorder_rejects_unknown_and_duplicate_ids():
    admin = get_agent_admin_headers(1, "SA")
    a = make_agent(admin, "Anna", "AN")
    assert client.put("/agents/reorder", headers=admin, json={"agent_ids": [a, 99999]}).status_code == 404
    assert client.put("/agents/reorder", headers=admin, json={"agent_ids": [a, a]}).status_code == 400
    assert client.put("/agents/reorder", headers=admin, json={"agent_ids": []}).status_code == 422


def test_only_an_admin_can_reorder():
    admin = get_agent_admin_headers(1, "SA")
    a = make_agent(admin, "Anna", "AN")
    agent_headers = get_agent_admin_headers(1, "AN")
    assert client.put("/agents/reorder", json={"agent_ids": [a]}).status_code in (401, 403)
    assert client.put("/agents/reorder", headers=agent_headers, json={"agent_ids": [a]}).status_code in (401, 403)
