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
    assert data["database"] == "connected"


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
    assert "." in data["token"]

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
    token = generate_admin_token("SA")
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


def test_expired_and_tampered_admin_tokens():
    # 1. Expired token -> 403 Forbidden
    expired_token = generate_admin_token("SA", expires_in_seconds=-10)
    res_exp = client.post(
        "/templates",
        headers={"X-Admin-Token": expired_token, "X-Admin-Initials": "SA"},
        json={
            "name": "Expired Test",
            "body": "Test body",
            "category_type": "customer_reply",
            "category": "Test"
        }
    )
    assert res_exp.status_code == 403

    # 2. Tampered token -> 403 Forbidden
    valid_token = generate_admin_token("SA")
    tampered_token = valid_token[:-4] + "XXXX"
    res_tampered = client.post(
        "/templates",
        headers={"X-Admin-Token": tampered_token, "X-Admin-Initials": "SA"},
        json={
            "name": "Tampered Test",
            "body": "Test body",
            "category_type": "customer_reply",
            "category": "Test"
        }
    )
    assert res_tampered.status_code == 403


def test_pin_verification_rate_limiting():
    # Attempt 5 invalid PINs for agent 'SA_LIMIT_TEST'
    agent_initials = "SA_LIMIT_TEST"
    for _ in range(5):
        client.post(
            "/agents/verify-pin",
            json={"agent_initials": agent_initials, "pin": "9999"}
        )

    # 6th attempt triggers 429 Too Many Requests
    res_limit = client.post(
        "/agents/verify-pin",
        json={"agent_initials": agent_initials, "pin": "9999"}
    )
    assert res_limit.status_code == 429
    assert "Too many failed PIN verification attempts" in res_limit.json()["detail"]


def test_pbkdf2_pin_hashing_and_upgrade():
    # Test PBKDF2 hash generation
    h = hash_pin("1234")
    assert h.startswith("pbkdf2_v1:")

    # Verify PIN against PBKDF2 hash
    from backend.main import verify_pin_hash
    assert verify_pin_hash("1234", h) is True
    assert verify_pin_hash("9999", h) is False


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


def test_suggestion_approval_lifecycle():
    token = generate_admin_token("SA", hash_pin("0000"))
    headers = {"X-Admin-Token": token, "X-Admin-Initials": "SA"}

    # 1. Create a suggestion
    sug_res = client.post(
        "/suggestions",
        json={
            "name": "Suggested Refund Template",
            "body": "Your refund of ${amount} has been processed.",
            "category_type": "customer_reply",
            "category": "Billing",
            "subcategory": "Refunds",
            "suggested_by_name": "TestAgent",
            "suggested_by_initials": "TA"
        }
    )
    assert sug_res.status_code == 200
    sug = sug_res.json()
    sug_id = sug["id"]
    assert sug["status"] == "pending"

    # 2. Approve suggestion -> Creates new Template
    appr_res = client.post(f"/suggestions/{sug_id}/approve", headers=headers)
    assert appr_res.status_code == 200
    tpl = appr_res.json()
    assert tpl["name"] == "Suggested Refund Template"

    # 3. Verify suggestion list reflects approved status
    list_res = client.get("/suggestions")
    assert list_res.status_code == 200
    suggestions = list_res.json()
    approved_sug = next(s for s in suggestions if s["id"] == sug_id)
    assert approved_sug["status"] == "approved"


def test_multilingual_translate_endpoint():
    # 1. Shona dictionary translation
    res_sn = client.post("/translate", json={"text": "Hello", "source_lang": "en", "target_lang": "sn"})
    assert res_sn.status_code == 200
    data_sn = res_sn.json()
    assert data_sn["translatedText"].lower() == "mhoroi"
    assert data_sn["provider"] == "dictionary"

    # 2. IsiNdebele dictionary translation
    res_nd = client.post("/translate", json={"text": "Thank you", "source_lang": "en", "target_lang": "nd"})
    assert res_nd.status_code == 200
    data_nd = res_nd.json()
    assert data_nd["translatedText"].lower() == "siyabonga"
    assert data_nd["provider"] == "dictionary"

    # 3. Dynamic sentence translation for IsiNdebele
    res_dynamic = client.post("/translate", json={"text": "Your request is being processed.", "source_lang": "en", "target_lang": "nd"})
    assert res_dynamic.status_code == 200
    data_dyn = res_dynamic.json()
    assert len(data_dyn["translatedText"]) > 0
    assert data_dyn["translatedText"] != "Your request is being processed."


def test_support_request_flow():
    # 1. Public submission of support request
    res = client.post("/support-requests", json={
        "org_name": "Acme Corp",
        "requester_name": "John Doe",
        "contact_email": "john@acme.com",
        "request_type": "new_org_url",
        "details": "Need workspace access setup"
    })
    assert res.status_code == 200
    data = res.json()
    assert data["org_name"] == "Acme Corp"
    assert data["status"] == "pending"
    req_id = data["id"]

    # 2. Get support requests list (Admin authorization required)
    admin_token = generate_admin_token("SA")
    list_res = client.get("/support-requests", headers={"X-Admin-Token": admin_token})
    assert list_res.status_code == 200
    reqs = list_res.json()
    assert any(r["id"] == req_id for r in reqs)

    # 3. Patch status to resolved
    patch_res = client.patch(f"/support-requests/{req_id}", json={"status": "resolved"}, headers={"X-Admin-Token": admin_token})
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "resolved"



