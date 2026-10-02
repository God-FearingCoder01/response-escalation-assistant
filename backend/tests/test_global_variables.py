import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, select

from backend.main import app, engine, generate_admin_token, Company, Template, sync_default_data_if_needed
from backend.models import GlobalVariable
from backend.services.template_resolution import resolve_global_variables_in_text

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        sync_default_data_if_needed(session)
    yield


def get_admin_headers(agent_initials="SA"):
    token = generate_admin_token(agent_initials)
    return {"X-Admin-Token": token, "X-Admin-Initials": agent_initials}


# ============================================================
# 1. GLOBAL VARIABLE CRUD & KEY VALIDATION TESTS
# ============================================================

def test_create_global_variable():
    headers = get_admin_headers()
    payload = {
        "company_id": 1,
        "name": "Support WhatsApp",
        "key": "support_whatsapp",
        "value": "+263 77 111 2222",
        "category": "Contact Information",
        "description": "Legacy WhatsApp support contact",
        "value_type": "phone",
        "is_active": True,
    }
    res = client.post("/api/global-variables", headers=headers, json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Support WhatsApp"
    assert data["key"] == "support_whatsapp"
    assert data["value"] == "+263 77 111 2222"
    assert data["company_id"] == 1


def test_key_validation_and_duplicate_prevention():
    headers = get_admin_headers()
    
    # Invalid key with no valid alphanumeric characters
    payload_invalid = {
        "company_id": 1,
        "name": "Invalid Key Symbols",
        "key": "!!!",
        "value": "Bad Value",
        "category": "Contact Information",
    }
    res = client.post("/api/global-variables", headers=headers, json=payload_invalid)
    assert res.status_code == 400
    assert "invalid" in res.json()["detail"].lower() or "format" in res.json()["detail"].lower()

    # Create a valid variable
    payload_valid = {
        "company_id": 1,
        "name": "Unique Test Key",
        "key": "unique_test_key",
        "value": "Test Value",
        "category": "Contact Information",
    }
    res1 = client.post("/api/global-variables", headers=headers, json=payload_valid)
    assert res1.status_code == 200

    # Duplicate key in same company should fail
    res2 = client.post("/api/global-variables", headers=headers, json=payload_valid)
    assert res2.status_code == 400
    assert "already exists" in res2.json()["detail"].lower()


def test_read_and_update_global_variable():
    headers = get_admin_headers()
    
    # List variables
    res_list = client.get("/api/global-variables?company_id=1")
    assert res_list.status_code == 200
    variables = res_list.json()
    assert len(variables) >= 1

    var_id = variables[0]["id"]
    
    # Get by ID
    res_get = client.get(f"/api/global-variables/{var_id}?company_id=1")
    assert res_get.status_code == 200
    assert res_get.json()["id"] == var_id

    # Update variable
    res_update = client.put(
        f"/api/global-variables/{var_id}?company_id=1",
        headers=headers,
        json={"name": "Updated Live Chat", "value": "Live Chat 24/7", "is_active": True}
    )
    assert res_update.status_code == 200
    assert res_update.json()["value"] == "Live Chat 24/7"


def test_deactivate_and_delete_global_variable():
    headers = get_admin_headers()
    
    # Create variable
    payload = {
        "company_id": 1,
        "name": "Temporary Var",
        "key": "temp_var",
        "value": "Temp Value",
        "category": "Test",
    }
    var_data = client.post("/api/global-variables", headers=headers, json=payload).json()
    var_id = var_data["id"]

    # Deactivate
    res_deact = client.put(
        f"/api/global-variables/{var_id}?company_id=1",
        headers=headers,
        json={"is_active": False}
    )
    assert res_deact.status_code == 200
    assert res_deact.json()["is_active"] is False

    # Safe delete (not used in templates)
    res_del = client.delete(f"/api/global-variables/{var_id}?company_id=1", headers=headers)
    assert res_del.status_code == 200


# ============================================================
# 2. MULTI-TENANT ISOLATION TESTS
# ============================================================

def test_company_tenant_isolation():
    headers = get_admin_headers()

    # Create Company B
    comp_b = client.post(
        "/companies",
        headers=headers,
        json={"name": "Company B", "slug": "company-b", "is_active": True}
    ).json()
    company_b_id = comp_b["id"]

    # Create variable in Company A (company_id=1)
    payload_a = {
        "company_id": 1,
        "name": "Secret A",
        "key": "tenant_key",
        "value": "Company A Secret",
        "category": "General",
    }
    var_a = client.post("/api/global-variables", headers=headers, json=payload_a).json()

    # Create same key in Company B (company_id=company_b_id) - allowed since keys are scoped per company
    payload_b = {
        "company_id": company_b_id,
        "name": "Secret B",
        "key": "tenant_key",
        "value": "Company B Secret",
        "category": "General",
    }
    var_b = client.post("/api/global-variables", headers=headers, json=payload_b).json()
    assert var_a["id"] != var_b["id"]

    # Company B listing must not contain Company A's variables
    res_b_list = client.get(f"/api/global-variables?company_id={company_b_id}").json()
    values_b = [v["value"] for v in res_b_list]
    assert "Company A Secret" not in values_b

    # Cross-company update attempt should fail (404)
    res_cross_update = client.put(
        f"/api/global-variables/{var_a['id']}?company_id={company_b_id}",
        headers=headers,
        json={"value": "Hacked Value"}
    )
    assert res_cross_update.status_code == 404


# ============================================================
# 3. USAGE TRACKING & DELETION SAFETY
# ============================================================

def test_usage_tracking_and_delete_protection():
    headers = get_admin_headers()

    # Create variable
    var_data = client.post(
        "/api/global-variables",
        headers=headers,
        json={
            "company_id": 1,
            "name": "Tracked Phone",
            "key": "tracked_phone",
            "value": "+263 70 000 0000",
            "category": "Contact Information",
        }
    ).json()
    var_id = var_data["id"]

    # Create template referencing {tracked_phone}
    tpl_data = client.post(
        "/templates",
        headers=headers,
        json={
            "company_id": 1,
            "name": "Usage Test Template",
            "category_type": "customer_reply",
            "category": "General",
            "subcategory": "Support",
            "body": "Call us at {tracked_phone} for instant support.",
        }
    ).json()

    # Fetch usage
    res_usage = client.get(f"/api/global-variables/{var_id}/usage?company_id=1")
    assert res_usage.status_code == 200
    usage_info = res_usage.json()
    assert usage_info["usage_count"] == 1
    assert usage_info["templates"][0]["id"] == tpl_data["id"]

    # Deleting without force=True should be rejected because it is in use
    res_del_fail = client.delete(f"/api/global-variables/{var_id}?company_id=1", headers=headers)
    assert res_del_fail.status_code == 400
    assert "referenced" in res_del_fail.json()["detail"].lower()

    # Deleting with force=True should succeed
    res_del_force = client.delete(f"/api/global-variables/{var_id}?company_id=1&force=true", headers=headers)
    assert res_del_force.status_code == 200


# ============================================================
# 4. TEMPLATE RESOLUTION TESTS
# ============================================================

def test_template_resolution_active_and_missing():
    with Session(engine) as session:
        # 1. Single active variable
        text1 = "Please contact us via {live_chat}."
        res1 = resolve_global_variables_in_text(text1, 1, session)
        assert "Live Chat" in res1["resolved_text"]
        assert res1["is_fully_resolved"] is True

        # 2. Multiple active variables + standard agent parameter
        text2 = "Hello {customer_name}, reach us at {support_email} or {live_chat}."
        res2 = resolve_global_variables_in_text(text2, 1, session)
        assert "{customer_name}" in res2["resolved_text"]  # Unmodified agent parameter
        assert "support@example.com" in res2["resolved_text"]
        assert "Live Chat" in res2["resolved_text"]

        # 3. Inactive variable handling
        # Deactivate support_phone
        var_phone = session.exec(
            select(GlobalVariable).where(GlobalVariable.company_id == 1, GlobalVariable.key == "support_phone")
        ).first()
        if var_phone:
            var_phone.is_active = False
            session.add(var_phone)
            session.commit()

        text4 = "Call us at {support_phone}."
        res4 = resolve_global_variables_in_text(text4, 1, session)
        assert "⚠️ Reusable info unavailable [support_phone]" in res4["resolved_text"]
        assert res4["is_fully_resolved"] is False


# ============================================================
# 5. EXISTING TEMPLATE MIGRATION TESTS
# ============================================================

def test_template_migration_search_preview_and_apply():
    headers = get_admin_headers()

    # Create 2 templates in Company A with old contact info
    t1 = client.post(
        "/templates",
        headers=headers,
        json={
            "company_id": 1,
            "name": "Deposit Inquiry",
            "category_type": "customer_reply",
            "category": "Payments",
            "subcategory": "Deposit",
            "body": "For deposit help, contact us on WhatsApp at +263 77 999 8888 right away.",
        }
    ).json()

    t2 = client.post(
        "/templates",
        headers=headers,
        json={
            "company_id": 1,
            "name": "Withdrawal Inquiry",
            "category_type": "customer_reply",
            "category": "Payments",
            "subcategory": "Withdrawal",
            "body": "For withdrawal issues, message us on WhatsApp at +263 77 999 8888.",
        }
    ).json()

    # 1. Search templates for Company A
    res_search = client.post(
        "/api/global-variables/migration/search",
        headers=headers,
        json={"company_id": 1, "search_text": "WhatsApp at +263 77 999 8888"}
    )
    assert res_search.status_code == 200
    search_data = res_search.json()
    assert search_data["total_templates"] >= 2
    matched_ids = [t["id"] for t in search_data["matches"]]
    assert t1["id"] in matched_ids
    assert t2["id"] in matched_ids

    # 2. Preview migration for selected template t1 only
    res_preview = client.post(
        "/api/global-variables/migration/preview",
        headers=headers,
        json={
            "company_id": 1,
            "search_text": "WhatsApp at +263 77 999 8888",
            "replace_text": "{live_chat}",
            "template_ids": [t1["id"]],
        }
    )
    assert res_preview.status_code == 200
    preview_data = res_preview.json()
    assert len(preview_data["previews"]) == 1
    assert preview_data["previews"][0]["template_id"] == t1["id"]
    assert "{live_chat}" in preview_data["previews"][0]["proposed_body"]

    # 3. Apply migration to t1 only
    res_apply = client.post(
        "/api/global-variables/migration/apply",
        headers=headers,
        json={
            "company_id": 1,
            "search_text": "WhatsApp at +263 77 999 8888",
            "replace_text": "via {live_chat}",
            "template_ids": [t1["id"]],
        }
    )
    assert res_apply.status_code == 200
    apply_data = res_apply.json()
    assert apply_data["updated_count"] == 1

    # Verify t1 was updated with {live_chat}
    res_t1 = client.get(f"/templates/{t1['id']}").json()
    assert "via {live_chat}" in res_t1["body"]

    # Verify t2 was NOT modified because it was not selected
    res_t2 = client.get(f"/templates/{t2['id']}").json()
    assert "WhatsApp at +263 77 999 8888" in res_t2["body"]


def test_migration_cross_company_safety():
    headers = get_admin_headers()

    # Create Company B
    comp_b = client.post(
        "/companies",
        headers=headers,
        json={"name": "Company C", "slug": "company-c", "is_active": True}
    ).json()
    company_b_id = comp_b["id"]

    # Create template in Company B with shared text
    headers_b = {**headers, "X-Company-ID": str(company_b_id)}
    t_b = client.post(
        "/templates",
        headers=headers_b,
        json={
            "company_id": company_b_id,
            "name": "Company B Template",
            "category_type": "customer_reply",
            "category": "General",
            "subcategory": "Support",
            "body": "Contact support via shared string XYZ.",
        }
    ).json()

    # Company A searches for 'shared string XYZ' -> should return 0 matches
    res_search = client.post(
        "/api/global-variables/migration/search",
        headers=headers,
        json={"company_id": 1, "search_text": "shared string XYZ"}
    ).json()
    assert res_search["total_templates"] == 0

    # Company A attempts to apply migration to Company B's template ID -> updated_count must be 0
    res_apply = client.post(
        "/api/global-variables/migration/apply",
        headers=headers,
        json={
            "company_id": 1,
            "search_text": "shared string XYZ",
            "replace_text": "{live_chat}",
            "template_ids": [t_b["id"]],
        }
    ).json()
    assert res_apply["updated_count"] == 0

    # Verify Company B template is untouched
    res_t_b = client.get(f"/templates/{t_b['id']}", headers=headers_b).json()
    assert res_t_b["body"] == "Contact support via shared string XYZ."
