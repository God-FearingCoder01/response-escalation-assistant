import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, select

from backend.main import app, engine, generate_admin_token, Company, Template, Agent, sync_default_data_if_needed

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        sync_default_data_if_needed(session)
    yield


def test_company_creation_and_listing():
    token = generate_admin_token("SA")
    headers = {"X-Admin-Token": token, "X-Admin-Initials": "SA"}

    # 1. Create Company A
    res_a = client.post(
        "/companies",
        headers=headers,
        json={"name": "Company A", "slug": "company-a", "is_active": True}
    )
    assert res_a.status_code == 200
    comp_a = res_a.json()
    assert comp_a["slug"] == "company-a"
    assert comp_a["id"] > 1

    # 2. Create Company B
    res_b = client.post(
        "/companies",
        headers=headers,
        json={"name": "Company B", "slug": "company-b", "is_active": True}
    )
    assert res_b.status_code == 200
    comp_b = res_b.json()
    assert comp_b["slug"] == "company-b"

    # 3. List all companies
    res_list = client.get("/companies")
    assert res_list.status_code == 200
    companies = res_list.json()
    assert len(companies) >= 3  # Default + A + B


def test_tenant_data_isolation():
    token = generate_admin_token("SA")
    headers_admin = {"X-Admin-Token": token, "X-Admin-Initials": "SA"}

    # Create Company A
    comp_a = client.post(
        "/companies",
        headers=headers_admin,
        json={"name": "Company Alpha", "slug": "company-alpha", "is_active": True}
    ).json()

    # Create Company B
    comp_b = client.post(
        "/companies",
        headers=headers_admin,
        json={"name": "Company Beta", "slug": "company-beta", "is_active": True}
    ).json()

    headers_comp_a = {"X-Company-ID": str(comp_a["id"]), **headers_admin}
    headers_comp_b = {"X-Company-ID": str(comp_b["id"]), **headers_admin}

    # Add custom template to Company A
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

    # Add custom template to Company B
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

    # Retrieve templates for Company A -> Must contain Alpha template, MUST NOT contain Beta template
    get_a = client.get("/templates", headers={"X-Company-ID": str(comp_a["id"])})
    assert get_a.status_code == 200
    names_a = [t["name"] for t in get_a.json()]
    assert "Alpha Special Escalation" in names_a
    assert "Beta Special Escalation" not in names_a

    # Retrieve templates for Company B -> Must contain Beta template, MUST NOT contain Alpha template
    get_b = client.get("/templates", headers={"X-Company-ID": str(comp_b["id"])})
    assert get_b.status_code == 200
    names_b = [t["name"] for t in get_b.json()]
    assert "Beta Special Escalation" in names_b
    assert "Alpha Special Escalation" not in names_b


def test_agent_isolation_per_company():
    token = generate_admin_token("SA")
    headers_admin = {"X-Admin-Token": token, "X-Admin-Initials": "SA"}

    comp_a = client.post(
        "/companies",
        headers=headers_admin,
        json={"name": "Corp X", "slug": "corp-x", "is_active": True}
    ).json()

    # Create agent in Corp A
    res_agent = client.post(
        "/agents",
        headers={"X-Company-ID": str(comp_a["id"]), **headers_admin},
        json={
            "agent": "Alice Alpha",
            "agent_name": "Alice",
            "agent_initials": "AA",
            "is_admin": False,
            "pin": "1234"
        }
    )
    assert res_agent.status_code == 200

    # Verify agent exists in Corp A list
    agents_a = client.get("/agents", headers={"X-Company-ID": str(comp_a["id"])}).json()
    initials_a = [a["agent_initials"] for a in agents_a]
    assert "AA" in initials_a

    # Verify agent DOES NOT exist in Default Company list
    agents_def = client.get("/agents", headers={"X-Company-ID": "1"}).json()
    initials_def = [a["agent_initials"] for a in agents_def]
    assert "AA" not in initials_def
