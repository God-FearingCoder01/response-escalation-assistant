import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, select

from backend.main import app, engine, Company, Template, Agent, sync_default_data_if_needed
from backend.tests.auth_helpers import get_agent_admin_headers, get_superadmin_headers

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        sync_default_data_if_needed(session)
    yield


def test_company_creation_and_listing():
    headers = get_superadmin_headers()

    res_a = client.post(
        "/companies",
        headers=headers,
        json={"name": "Company A", "slug": "company-a", "is_active": True}
    )
    assert res_a.status_code == 200
    comp_a = res_a.json()
    assert comp_a["slug"] == "company-a"
    assert comp_a["id"] > 1

    res_b = client.post(
        "/companies",
        headers=headers,
        json={"name": "Company B", "slug": "company-b", "is_active": True}
    )
    assert res_b.status_code == 200
    comp_b = res_b.json()
    assert comp_b["slug"] == "company-b"

    res_list = client.get("/companies", headers=headers)
    assert res_list.status_code == 200
    companies = res_list.json()
    assert len(companies) >= 3


def test_tenant_data_isolation():
    headers_admin = get_superadmin_headers()

    comp_a = client.post(
        "/companies",
        headers=headers_admin,
        json={"name": "Company Alpha", "slug": "company-alpha", "is_active": True}
    ).json()

    comp_b = client.post(
        "/companies",
        headers=headers_admin,
        json={"name": "Company Beta", "slug": "company-beta", "is_active": True}
    ).json()

    headers_comp_a = get_agent_admin_headers(comp_a["id"])
    headers_comp_b = get_agent_admin_headers(comp_b["id"])

    tpl_a = client.post(
        "/templates",
        headers=headers_comp_a,
        json={
            "name": "Alpha Special Escalation",
            "body": "Company Alpha escalation details.",
            "category_type": "tech_escalation",
            "category": "Alpha Only"
        }
    )
    assert tpl_a.status_code == 200

    tpl_b = client.post(
        "/templates",
        headers=headers_comp_b,
        json={
            "name": "Beta Special Escalation",
            "body": "Company Beta escalation details.",
            "category_type": "tech_escalation",
            "category": "Beta Only"
        }
    )
    assert tpl_b.status_code == 200

    get_a = client.get("/templates", headers=headers_comp_a)
    assert get_a.status_code == 200
    names_a = [t["name"] for t in get_a.json()]
    assert "Alpha Special Escalation" in names_a
    assert "Beta Special Escalation" not in names_a

    get_b = client.get("/templates", headers=headers_comp_b)
    assert get_b.status_code == 200
    names_b = [t["name"] for t in get_b.json()]
    assert "Beta Special Escalation" in names_b
    assert "Alpha Special Escalation" not in names_b


def test_agent_isolation_per_company():
    headers_admin = get_superadmin_headers()

    comp_a = client.post(
        "/companies",
        headers=headers_admin,
        json={"name": "Corp X", "slug": "corp-x", "is_active": True}
    ).json()

    res_agent = client.post(
        "/agents",
        headers=get_agent_admin_headers(comp_a["id"]),
        json={
            "agent": "Alice Alpha",
            "agent_name": "Alice",
            "agent_initials": "AA",
            "is_admin": False,
            "pin": "1234"
        }
    )
    assert res_agent.status_code == 200

    agents_a = client.get("/agents", headers=get_agent_admin_headers(comp_a["id"])).json()
    initials_a = [a["agent_initials"] for a in agents_a]
    assert "AA" in initials_a

    agents_def = client.get("/agents", headers=get_agent_admin_headers(1)).json()
    initials_def = [a["agent_initials"] for a in agents_def]
    assert "AA" not in initials_def
