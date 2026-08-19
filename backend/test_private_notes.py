import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select
from backend.main import app, engine, PrivateNote

client = TestClient(app)

def test_private_notes_lifecycle_and_privacy():
    # 1. Create a private note for Agent SA
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

    # 2. Agent SA lists private notes - should see the note
    res_list_sa = client.get("/private-notes", headers=headers_sa)
    assert res_list_sa.status_code == 200
    sa_notes = res_list_sa.json()
    assert any(n["id"] == note_id for n in sa_notes)

    # 3. Privacy check: Agent CW lists private notes - should NOT see SA's private note
    headers_cw = {"X-Agent-Initials": "CW", "X-Company-ID": "1"}
    res_list_cw = client.get("/private-notes", headers=headers_cw)
    assert res_list_cw.status_code == 200
    cw_notes = res_list_cw.json()
    assert not any(n["id"] == note_id for n in cw_notes)

    # 4. Increment usage counter
    res_use = client.post(f"/private-notes/{note_id}/use", headers=headers_sa)
    assert res_use.status_code == 200
    assert res_use.json()["use_count"] == 1

    res_use2 = client.post(f"/private-notes/{note_id}/use", headers=headers_sa)
    assert res_use2.status_code == 200
    assert res_use2.json()["use_count"] == 2

    # 5. Update private note
    res_upd = client.put(
        f"/private-notes/{note_id}",
        json={"submitted_as_suggestion": True},
        headers=headers_sa
    )
    assert res_upd.status_code == 200
    assert res_upd.json()["submitted_as_suggestion"] is True

    # 6. Delete private note
    res_del = client.delete(f"/private-notes/{note_id}", headers=headers_sa)
    assert res_del.status_code == 200
    assert res_del.json()["ok"] is True

    # Confirm deletion
    res_list_sa_after = client.get("/private-notes", headers=headers_sa)
    assert not any(n["id"] == note_id for n in res_list_sa_after.json())
