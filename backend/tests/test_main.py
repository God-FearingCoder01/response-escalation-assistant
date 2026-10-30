import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, select

from backend.main import app, engine, hash_pin, generate_admin_token, Agent, Template, sync_default_data_if_needed
from backend.bootstrap import AGENT_BOOTSTRAP_PIN
from backend.models import AgentUserData
from backend.security import generate_agent_token
from backend.tests.auth_helpers import get_agent_admin_headers, get_superadmin_headers

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
    # Seeded Sys_Admin uses a private bootstrap PIN and can only enter setup.
    response = client.post(
        "/agents/verify-pin",
        json={"agent_initials": "SA", "pin": AGENT_BOOTSTRAP_PIN}
    )
    assert response.status_code == 200
    data = response.json()
    assert data["valid"] is True
    assert data["pin_change_required"] is True
    assert "token" in data
    assert "." in data["token"]

    changed = client.post(
        "/agents/change-pin",
        headers={"X-Agent-Token": data["setup_token"]},
        json={"agent_initials": "SA", "new_pin": "2468"},
    )
    assert changed.status_code == 200
    assert client.post("/agents/verify-pin", json={"agent_initials": "SA", "pin": "2468"}).json()["pin_change_required"] is False

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
    headers = get_agent_admin_headers()
    response_valid = client.post(
        "/templates",
        headers=headers,
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
    assert h.startswith("pbkdf2_v2:")

    from backend.security import verify_pin_hash
    assert verify_pin_hash("1234", h) is True
    assert verify_pin_hash("9999", h) is False


def test_template_crud_lifecycle():
    headers = get_agent_admin_headers()

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

    get_res = client.get(f"/templates/{tpl_id}", headers=headers)
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

    get_deleted = client.get(f"/templates/{tpl_id}", headers=headers)
    assert get_deleted.status_code == 404


def test_template_import_and_deduplicate():
    headers = get_agent_admin_headers()

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


def test_deduplicate_templates_differing_names():
    headers = get_agent_admin_headers()

    # Create two templates with different names but exact same body content
    same_body = "Identical body content for deduplication test"
    t1 = client.post("/templates", headers=headers, json={
        "name": "Template Title Alpha",
        "body": same_body,
        "category_type": "customer_reply",
        "category": "Dedup Test 1"
    })
    t2 = client.post("/templates", headers=headers, json={
        "name": "Template Title Beta",
        "body": same_body,
        "category_type": "customer_reply",
        "category": "Dedup Test 2"
    })
    assert t1.status_code == 200
    assert t2.status_code == 200

    dedup_res = client.post("/templates/deduplicate", headers=headers)
    assert dedup_res.status_code == 200
    assert dedup_res.json()["status"] == "success"
    assert dedup_res.json()["removed_count"] >= 1


def test_batch_delete_templates():
    headers = get_agent_admin_headers()

    items_to_import = [
        {
            "name": "Batch Delete Tpl 1",
            "body": "Body text B1",
            "category_type": "customer_reply",
            "category": "Batch Test"
        },
        {
            "name": "Batch Delete Tpl 2",
            "body": "Body text B2",
            "category_type": "customer_reply",
            "category": "Batch Test"
        }
    ]
    import_res = client.post("/import", headers=headers, json=items_to_import)
    assert import_res.status_code == 200

    all_tpls = client.get("/templates", headers=headers).json()
    batch_ids = [t["id"] for t in all_tpls if t.get("category") == "Batch Test"]
    assert len(batch_ids) == 2

    batch_del_res = client.post("/templates/batch-delete", headers=headers, json={"template_ids": batch_ids})
    assert batch_del_res.status_code == 200
    assert batch_del_res.json()["ok"] is True
    assert batch_del_res.json()["count"] == 2


def test_sys_admin_protection():
    headers = get_agent_admin_headers()

    with Session(engine) as session:
        sa_agent = session.exec(select(Agent).where(Agent.agent_initials == "SA")).first()
        assert sa_agent is not None

        del_res = client.delete(f"/agents/{sa_agent.id}", headers=headers)
        assert del_res.status_code == 400
        assert "Sys_Admin" in del_res.json()["detail"]


def test_suggestion_approval_lifecycle():
    headers = get_agent_admin_headers()

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

    list_res = client.get("/suggestions", headers=get_agent_admin_headers())
    assert list_res.status_code == 200
    suggestions = list_res.json()
    approved_sug = next(s for s in suggestions if s["id"] == sug_id)
    assert approved_sug["status"] == "approved"


def test_multilingual_translate_endpoint():
    headers = get_agent_admin_headers()
    res_sn = client.post("/translate", headers=headers, json={"text": "Hello", "target_lang": "shona"})
    assert res_sn.status_code == 200
    data_sn = res_sn.json()
    translated_sn = data_sn.get("translated_text") or data_sn.get("translatedText") or ""
    assert translated_sn.lower() == "mhoroi"

    res_nd = client.post("/translate", headers=headers, json={"text": "Thank you", "target_lang": "ndebele"})
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

    superadmin_headers = get_superadmin_headers()
    list_res = client.get("/support-requests", headers=superadmin_headers)
    assert list_res.status_code == 200
    reqs = list_res.json()
    assert any(r["id"] == req_id for r in reqs)

    patch_res = client.patch(f"/support-requests/{req_id}", json={"status": "resolved"}, headers=superadmin_headers)
    assert patch_res.status_code == 200
    assert patch_res.json()["status"] == "resolved"


def test_agent_user_data_sync_and_daily_reset():
    with Session(engine) as session:
        agent = Agent(
            agent="Test Agent",
            agent_name="Test Agent",
            agent_initials="AK",
            is_admin=False,
            pin=hash_pin("2468"),
            company_id=1,
        )
        session.add(agent)
        session.commit()
        session.refresh(agent)
        headers = {"X-Agent-Token": generate_agent_token(agent, 1)}

    res_get = client.get("/api/agent-data", headers=headers)
    assert res_get.status_code == 200
    data = res_get.json()
    assert data["agent_initials"] == "AK"
    assert data["favorites"] == []
    assert data["recently_used"] == []

    res_save = client.post("/api/agent-data", headers=headers, json={
        "agent_initials": "OTHER",
        "favorites": ["1", "3", "priv_101"],
        "recently_used": [{"templateId": 5, "timestamp": 12345}, "2"],
        "usage_counts": {"1": 12, "3": 5},
        "translation_history": [{"id": 1, "sourceText": "Hello", "translatedText": "Mhoro"}]
    })
    assert res_save.status_code == 200
    assert res_save.json()["status"] == "ok"

    res_verify = client.get("/api/agent-data", headers=headers)
    assert res_verify.status_code == 200
    synced = res_verify.json()
    assert synced["favorites"] == ["1", "3", "priv_101"]
    assert synced["recently_used"] == [{"templateId": 5, "timestamp": 12345}, "2"]
    assert synced["usage_counts"] == {"1": 12, "3": 5}
    assert len(synced["translation_history"]) == 1
    assert synced["agent_initials"] == "AK"
    assert client.get("/api/agent-data?agent_initials=OTHER", headers=headers).status_code == 403


def test_agent_data_and_translation_reject_anonymous_requests():
    assert client.get("/api/agent-data").status_code == 401
    assert client.post("/api/agent-data", json={"agent_initials": "SA", "private_notes": ["x"]}).status_code == 401
    assert client.post("/translate", json={"text": "hello", "target_lang": "sn"}).status_code == 401


def test_agent_data_get_does_not_create_a_database_row():
    with Session(engine) as session:
        agent = Agent(
            agent="Read Only Agent",
            agent_name="Read Only",
            agent_initials="RO",
            is_admin=False,
            pin=hash_pin("2468"),
            company_id=1,
        )
        session.add(agent)
        session.commit()
        session.refresh(agent)
        headers = {"X-Agent-Token": generate_agent_token(agent, 1)}
        before = session.exec(select(AgentUserData)).all()
        assert len(before) == 0

    response = client.get("/api/agent-data", headers=headers)
    assert response.status_code == 200
    with Session(engine) as session:
        assert session.exec(select(AgentUserData)).all() == []


def test_new_and_reset_agent_pins_are_random_and_setup_only():
    admin_headers = get_agent_admin_headers()
    created = client.post(
        "/agents",
        headers=admin_headers,
        json={"agent": "New Agent", "agent_name": "New", "agent_initials": "NA", "is_admin": False},
    )
    assert created.status_code == 200
    created_data = created.json()
    first_setup_pin = created_data["setup_pin"]
    assert first_setup_pin != "0000"

    setup_login = client.post("/agents/verify-pin", json={"agent_initials": "NA", "pin": first_setup_pin})
    assert setup_login.json()["pin_change_required"] is True
    setup_token = setup_login.json()["setup_token"]
    changed = client.post(
        "/agents/change-pin",
        headers={"X-Agent-Token": setup_token},
        json={"agent_initials": "NA", "new_pin": "8462"},
    )
    assert changed.status_code == 200
    assert client.post("/agents/verify-pin", json={"agent_initials": "NA", "pin": first_setup_pin}).json()["valid"] is False

    reset = client.post(f"/agents/{created_data['id']}/reset-pin", headers=admin_headers)
    assert reset.status_code == 200
    reset_setup_pin = reset.json()["setup_pin"]
    assert reset_setup_pin != "0000"
    assert reset_setup_pin != first_setup_pin
    reset_login = client.post("/agents/verify-pin", json={"agent_initials": "NA", "pin": reset_setup_pin})
    assert reset_login.json()["pin_change_required"] is True


def test_authenticated_translation_works_and_uses_session():
    headers = get_agent_admin_headers()
    result = client.post("/translate", headers=headers, json={"text": "hello", "target_lang": "sn"})
    assert result.status_code == 200
    assert result.json()["provider"] == "dictionary"




