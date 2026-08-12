import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, select

from backend.main import app, engine, hash_pin, generate_admin_token, Agent, Template, sync_default_data_if_needed

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        sync_default_data_if_needed(session)
    yield


def test_health_check():
    response = client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


def test_admin_pin_verification():
    # Verify default Sys_Admin PIN ('0000')
    response = client.post(
        "/agents/verify-pin",
        json={"agent_initials": "SA", "pin": "0000"}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert "token" in data
    assert len(data["token"]) == 64

    # Verify invalid PIN
    response_invalid = client.post(
        "/agents/verify-pin",
        json={"agent_initials": "SA", "pin": "9999"}
    )
    assert response_invalid.status_code == 200
    assert response_invalid.json()["valid"] is False


def test_admin_authorization_headers():
    # 1. Missing headers on admin route -> 401 Unauthorized
    response_unauth = client.post("/templates", json={
        "name": "Unauthorized Test",
        "body": "Test body",
        "category_type": "customer_reply",
        "category": "Test"
    })
    assert response_unauth.status_code == 401

    # 2. Invalid headers -> 403 Forbidden
    response_forbidden = client.post(
        "/templates",
        headers={"X-Admin-Token": "invalid_token_string", "X-Admin-Initials": "SA"},
        json={
            "name": "Forbidden Test",
            "body": "Test body",
            "category_type": "customer_reply",
            "category": "Test"
        }
    )
    assert response_forbidden.status_code == 403

    # 3. Valid Admin token -> 200 OK
    token = generate_admin_token("SA", hash_pin("0000"))
    response_valid = client.post(
        "/templates",
        headers={"X-Admin-Token": token, "X-Admin-Initials": "SA"},
        json={
            "name": "Authorized Test Template",
            "body": "Test body content",
            "category_type": "customer_reply",
            "category": "Test Category"
        }
    )
    assert response_valid.status_code == 200
    assert response_valid.json()["name"] == "Authorized Test Template"


def test_template_crud_lifecycle():
    token = generate_admin_token("SA", hash_pin("0000"))
    headers = {"X-Admin-Token": token, "X-Admin-Initials": "SA"}

    # 1. Create Template
    create_res = client.post(
        "/templates",
        headers=headers,
        json={
            "name": "CRUD Test Template",
            "body": "Hello {customer_name}, your request is processed.",
            "category_type": "customer_reply",
            "category": "Testing",
            "subcategory": "CRUD"
        }
    )
    assert create_res.status_code == 200
    tpl = create_res.json()
    tpl_id = tpl["id"]

    # 2. Read Template by ID
    get_res = client.get(f"/templates/{tpl_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "CRUD Test Template"

    # 3. Update Template
    put_res = client.put(
        f"/templates/{tpl_id}",
        headers=headers,
        json={
            "name": "CRUD Updated Template",
            "body": "Updated body for {customer_name}.",
            "category_type": "customer_reply",
            "category": "Testing",
            "subcategory": "CRUD Updated"
        }
    )
    assert put_res.status_code == 200
    assert put_res.json()["name"] == "CRUD Updated Template"

    # 4. Delete Template
    del_res = client.delete(f"/templates/{tpl_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["ok"] is True

    # 5. Confirm Deletion
    get_deleted = client.get(f"/templates/{tpl_id}")
    assert get_deleted.status_code == 404


def test_template_import_and_deduplicate():
    token = generate_admin_token("SA", hash_pin("0000"))
    headers = {"X-Admin-Token": token, "X-Admin-Initials": "SA"}

    items_to_import = [
        {
            "name": "Imported Template 1",
            "body": "Body text 1",
            "category_type": "customer_reply",
            "category": "Import Test"
        },
        {
            "name": "Imported Template 2",
            "body": "Body text 2",
            "category_type": "tech_escalation",
            "category": "Import Test"
        }
    ]

    import_res = client.post("/import", headers=headers, json=items_to_import)
    assert import_res.status_code == 200
    assert import_res.json()["imported"] >= 1

    # Re-importing exact same items skips duplicates
    reimport_res = client.post("/import", headers=headers, json=items_to_import)
    assert reimport_res.status_code == 200
    assert reimport_res.json()["skipped"] == 2

    # Deduplication endpoint
    dedup_res = client.post("/templates/deduplicate", headers=headers)
    assert dedup_res.status_code == 200
    assert dedup_res.json()["status"] == "success"


def test_sys_admin_protection():
    token = generate_admin_token("SA", hash_pin("0000"))
    headers = {"X-Admin-Token": token, "X-Admin-Initials": "SA"}

    with Session(engine) as session:
        sa_agent = session.exec(select(Agent).where(Agent.agent_initials == "SA")).first()
        assert sa_agent is not None

        # Attempt to delete Sys_Admin profile -> 400 Bad Request
        del_res = client.delete(f"/agents/{sa_agent.id}", headers=headers)
        assert del_res.status_code == 400
        assert "Sys_Admin" in del_res.json()["detail"]
