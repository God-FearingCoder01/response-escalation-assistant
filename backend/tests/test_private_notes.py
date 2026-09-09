import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from backend.main import app, engine, PrivateNote

client = TestClient(app)

def test_private_notes_lifecycle_and_privacy():
    headers_sa = {"X-Agent-Initials": "SA", "X-Company-ID": "1"}
    res = client.post(
        "/private-notes",
        json={
            "name": "SA Secret Resolution",
            "body": "Hi {customer_name}, your issue is resolved under code {code}.",
            "category_type": "customer_reply",
            "agent_initials": "SA"
        },
        headers=headers_sa
    )
    assert res.status_code == 200
    note_data = res.json()
    assert note_data["id"] is not None
    assert note_data["name"] == "SA Secret Resolution"
    assert note_data["use_count"] == 0
    note_id = note_data["id"]

    res_list_sa = client.get("/private-notes", headers=headers_sa)
    assert res_list_sa.status_code == 200
    sa_notes = res_list_sa.json()
    assert any(n["id"] == note_id for n in sa_notes)

    headers_cw = {"X-Agent-Initials": "CW", "X-Company-ID": "1"}
    res_list_cw = client.get("/private-notes", headers=headers_cw)
    assert res_list_cw.status_code == 200
    cw_notes = res_list_cw.json()
    assert not any(n["id"] == note_id for n in cw_notes)

    res_use = client.post(f"/private-notes/{note_id}/use", headers=headers_sa)
    assert res_use.status_code == 200
    assert res_use.json()["use_count"] == 1

    res_use2 = client.post(f"/private-notes/{note_id}/use", headers=headers_sa)
    assert res_use2.status_code == 200
    assert res_use2.json()["use_count"] == 2

    res_upd = client.put(
        f"/private-notes/{note_id}",
        json={"submitted_as_suggestion": True},
        headers=headers_sa
    )
    assert res_upd.status_code == 200
    assert res_upd.json()["submitted_as_suggestion"] is True

    res_del = client.delete(f"/private-notes/{note_id}", headers=headers_sa)
    assert res_del.status_code == 200
    assert res_del.json()["ok"] is True

    res_list_sa_after = client.get("/private-notes", headers=headers_sa)
    assert not any(n["id"] == note_id for n in res_list_sa_after.json())


def test_private_note_custom_categories_lifecycle():
    headers_sa = {"X-Agent-Initials": "SA", "X-Company-ID": "1"}
    
    # 1. Create custom category
    res_create = client.post(
        "/private-notes/categories",
        json={"name": "VIP Billing Desk"},
        headers=headers_sa
    )
    assert res_create.status_code == 200
    cat_data = res_create.json()
    assert cat_data["name"] == "VIP Billing Desk"
    assert cat_data["agent_initials"] == "SA"

    # 2. List categories
    res_list = client.get("/private-notes/categories", headers=headers_sa)
    assert res_list.status_code == 200
    cats = res_list.json()
    assert any(c["name"] == "VIP Billing Desk" for c in cats)

    # 3. Agent privacy check (Agent CW should not see SA's custom category)
    headers_cw = {"X-Agent-Initials": "CW", "X-Company-ID": "1"}
    res_list_cw = client.get("/private-notes/categories", headers=headers_cw)
    assert res_list_cw.status_code == 200
    cw_cats = res_list_cw.json()
    assert not any(c["name"] == "VIP Billing Desk" for c in cw_cats)

    # 4. Delete custom category
    res_del = client.delete("/private-notes/categories/VIP%20Billing%20Desk", headers=headers_sa)
    assert res_del.status_code == 200

    # 5. Verify deleted
    res_list_after = client.get("/private-notes/categories", headers=headers_sa)
    assert not any(c["name"] == "VIP Billing Desk" for c in res_list_after.json())

