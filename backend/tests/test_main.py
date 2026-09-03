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

    # 2. Invalid headers -> 401 Unauthorized
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
    assert response_forbidden.status_code == 401

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
    # 1. Expired token -> 401 Unauthorized
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
    assert res_exp.status_code == 401

    # 2. Tampered token -> 401 Unauthorized
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
    assert res_tampered.status_code == 401


def test_pin_verification_rate_limiting():
    agent_initials = "SA_LIMIT_TEST"
    for _ in range(5):
        client.post(
            "/agents/verify-pin",
            json={"agent_initials": agent_initials, "pin": "9999"}
        )

    res_limit = client.post(
        "/agents/verify-pin",
        json={"agent_initials": agent_initials, "pin": "9999"}
    )
    assert res_limit.status_code == 429
    assert "Too many failed PIN verification attempts" in res_limit.json()["detail"]


def test_pbkdf2_pin_hashing_and_upgrade():
    h = hash_pin("1234")
    assert h.startswith("pbkdf2_v1:")

    from backend.security import verify_pin_hash
    assert verify_pin_hash("1234", h) is True
    assert verify_pin_hash("9999", h) is False


def test_template_crud_lifecycle():
    token = generate_admin_token("SA", hash_pin("0000"))
    headers = {"X-Admin-Token": token, "X-Admin-Initials": "SA"}

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

    get_res = client.get(f"/templates/{tpl_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "CRUD Test Template"

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

    del_res = client.delete(f"/templates/{tpl_id}", headers=headers)
    assert del_res.status_code == 200
    assert del_res.json()["ok"] is True

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

    reimport_res = client.post("/import", headers=headers, json=items_to_import)
    assert reimport_res.status_code == 200
    assert reimport_res.json()["skipped"] == 2

    dedup_res = client.post("/templates/deduplicate", headers=headers)
    assert dedup_res.status_code == 200
    assert dedup_res.json()["status"] == "success"


def test_sys_admin_protection():
    token = generate_admin_token("SA", hash_pin("0000"))
    headers = {"X-Admin-Token": token, "X-Admin-Initials": "SA"}

    with Session(engine) as session:
        sa_agent = session.exec(select(Agent).where(Agent.agent_initials == "SA")).first()
        assert sa_agent is not None

        del_res = client.delete(f"/agents/{sa_agent.id}", headers=headers)
        assert del_res.status_code == 400
        assert "Sys_Admin" in del_res.json()["detail"]


def test_suggestion_approval_lifecycle():
    token = generate_admin_token("SA", hash_pin("0000"))
    headers = {"X-Admin-Token": token, "X-Admin-Initials": "SA"}

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

    appr_res = client.post(f"/suggestions/{sug_id}/approve", headers=headers)
    assert appr_res.status_code == 200
    tpl = appr_res.json()
    assert tpl["name"] == "Suggested Refund Template"

    list_res = client.get("/suggestions")
    assert list_res.status_code == 200
    suggestions = list_res.json()
    approved_sug = next(s for s in suggestions if s["id"] == sug_id)
    assert approved_sug["status"] == "approved"


def test_multilingual_translate_endpoint():
    res_sn = client.post("/translate", json={"text": "Hello", "target_lang": "shona"})
    assert res_sn.status_code == 200
    data_sn = res_sn.json()
    translated_sn = data_sn.get("translated_text") or data_sn.get("translatedText") or ""
    assert translated_sn.lower() == "mhoroi"

    res_nd = client.post("/translate", json={"text": "Thank you", "target_lang": "ndebele"})
    assert res_nd.status_code == 200
    data_nd = res_nd.json()
    translated_nd = data_nd.get("translated_text") or data_nd.get("translatedText") or ""
    assert translated_nd.lower() == "siyabonga"


def test_support_request_flow():
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

    admin_token = generate_admin_token("SA")
    list_res = client.get("/support-requests", headers={"X-Admin-Token": admin_token})
    assert list_res.status_code == 200
    reqs = list_res.json()
    assert any(r["id"] == req_id for r in reqs)

    patch_res = client.patch(f"/support-requests/{req_id}", json={"status": "resolved"}, headers={"X-Admin-Token": admin_token})
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "resolved"


def test_agent_user_data_sync_and_daily_reset():
    res_get = client.get("/api/agent-data?agent_initials=AK")
    assert res_get.status_code == 200
    data = res_get.json()
    assert data["agent_initials"] == "AK"
    assert data["favorites"] == []
    assert data["recently_used"] == []

    res_save = client.post("/api/agent-data", json={
        "agent_initials": "AK",
        "favorites": ["1", "3", "priv_101"],
        "recently_used": [{"templateId": 5, "timestamp": 12345}, "2"],
        "usage_counts": {"1": 12, "3": 5},
        "translation_history": [{"id": 1, "sourceText": "Hello", "translatedText": "Mhoro"}]
    })
    assert res_save.status_code == 200
    assert res_save.json()["status"] == "ok"

    res_verify = client.get("/api/agent-data?agent_initials=AK")
    assert res_verify.status_code == 200
    synced = res_verify.json()
    assert synced["favorites"] == ["1", "3", "priv_101"]
    assert synced["recently_used"] == [{"templateId": 5, "timestamp": 12345}, "2"]
    assert synced["usage_counts"] == {"1": 12, "3": 5}
    assert len(synced["translation_history"]) == 1


def test_extraction_rules_api():
    res = client.get("/api/extraction-rules")
    assert res.status_code == 200
    rules = res.json()
    assert isinstance(rules, list)
    assert len(rules) >= 5
    rule1 = next((r for r in rules if r["id"] == "rule_1"), None)
    assert rule1 is not None
    assert rule1["prefix"] == "MP"
    assert rule1["target_placeholder"] == "transaction_number"

    # Save updated rules
    new_rules = rules + [{
        "id": "rule_test_99",
        "name": "Custom Test Rule",
        "method": "pattern",
        "pattern": "TEST-\\d{5}",
        "is_active": True
    }]
    res_save = client.post("/api/extraction-rules", json=new_rules)
    assert res_save.status_code == 200
    updated = res_save.json()
    assert any(r["id"] == "rule_test_99" for r in updated)

