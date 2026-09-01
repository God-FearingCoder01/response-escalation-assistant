import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session
from backend.main import app, engine, generate_admin_token, Company, sync_default_data_if_needed

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        sync_default_data_if_needed(session)
    yield


def setup_tenants_and_headers():
    admin_token = generate_admin_token("SA")
    admin_headers = {"X-Admin-Token": admin_token, "X-Admin-Initials": "SA"}

    res_a = client.post(
        "/companies",
        headers=admin_headers,
        json={"name": "Company Alpha", "slug": "comp-alpha", "is_active": True},
    )
    assert res_a.status_code == 200
    comp_a = res_a.json()

    res_b = client.post(
        "/companies",
        headers=admin_headers,
        json={"name": "Company Beta", "slug": "comp-beta", "is_active": True},
    )
    assert res_b.status_code == 200
    comp_b = res_b.json()

    res_g = client.post(
        "/companies",
        headers=admin_headers,
        json={"name": "Company Gamma", "slug": "comp-gamma", "is_active": False},
    )
    assert res_g.status_code == 200
    comp_g = res_g.json()

    headers_a = {"X-Company-ID": str(comp_a["id"]), **admin_headers}
    headers_b = {"X-Company-ID": str(comp_b["id"]), **admin_headers}
    headers_g = {"X-Company-ID": str(comp_g["id"]), **admin_headers}

    return comp_a, comp_b, comp_g, headers_a, headers_b, headers_g


def test_template_cross_tenant_isolation():
    _, comp_b, _, headers_a, headers_b, _ = setup_tenants_and_headers()

    res_tpl_a = client.post(
        "/templates",
        headers=headers_a,
        json={
            "name": "Alpha Template",
            "body": "Alpha body text",
            "category_type": "tech_escalation",
            "category": "Tech",
        },
    )
    assert res_tpl_a.status_code == 200
    tpl_a_id = res_tpl_a.json()["id"]

    res_tpl_b = client.post(
        "/templates",
        headers=headers_b,
        json={
            "name": "Beta Template",
            "body": "Beta body text",
            "category_type": "customer_reply",
            "category": "Billing",
        },
    )
    assert res_tpl_b.status_code == 200
    tpl_b_id = res_tpl_b.json()["id"]

    list_a = client.get("/templates", headers=headers_a).json()
    list_b = client.get("/templates", headers=headers_b).json()
    assert any(t["id"] == tpl_a_id for t in list_a)
    assert not any(t["id"] == tpl_b_id for t in list_a)
    assert any(t["id"] == tpl_b_id for t in list_b)
    assert not any(t["id"] == tpl_a_id for t in list_b)

    assert client.get(f"/templates/{tpl_a_id}", headers=headers_b).status_code == 404
    assert client.get(f"/templates/{tpl_b_id}", headers=headers_a).status_code == 404

    upd_res = client.put(
        f"/templates/{tpl_a_id}",
        headers=headers_b,
        json={"name": "Hacked Template"},
    )
    assert upd_res.status_code == 404

    del_res = client.delete(f"/templates/{tpl_a_id}", headers=headers_b)
    assert del_res.status_code == 404

    verify_a = client.get(f"/templates/{tpl_a_id}", headers=headers_a)
    assert verify_a.status_code == 200
    assert verify_a.json()["name"] == "Alpha Template"


def test_agent_cross_tenant_isolation():
    _, _, _, headers_a, headers_b, _ = setup_tenants_and_headers()

    res_ag_a = client.post(
        "/agents",
        headers=headers_a,
        json={
            "agent": "Agent Alpha Profile",
            "agent_name": "AlphaAgent",
            "agent_initials": "AA",
            "is_admin": False,
            "pin": "1111",
        },
    )
    assert res_ag_a.status_code == 200
    ag_a_id = res_ag_a.json()["id"]

    list_b = client.get("/agents", headers=headers_b).json()
    assert not any(a["id"] == ag_a_id for a in list_b)

    upd_res = client.put(
        f"/agents/{ag_a_id}",
        headers=headers_b,
        json={"agent_name": "HackedAgent"},
    )
    assert upd_res.status_code == 404

    del_res = client.delete(f"/agents/{ag_a_id}", headers=headers_b)
    assert del_res.status_code == 404

    verify_res = client.post(
        "/agents/verify-pin",
        headers=headers_b,
        json={"agent_initials": "AA", "pin": "1111"},
    )
    assert verify_res.status_code == 404


def test_private_note_cross_tenant_isolation():
    _, _, _, headers_a, headers_b, _ = setup_tenants_and_headers()

    headers_a_agent = {**headers_a, "X-Agent-Initials": "AA"}
    headers_b_agent = {**headers_b, "X-Agent-Initials": "AA"}

    res_note = client.post(
        "/private-notes",
        headers=headers_a_agent,
        json={
            "name": "Alpha Note",
            "body": "Secret Alpha notes",
            "category_type": "customer_reply",
        },
    )
    assert res_note.status_code == 200
    note_id = res_note.json()["id"]

    list_b = client.get("/private-notes", headers=headers_b_agent).json()
    assert not any(n["id"] == note_id for n in list_b)

    upd_res = client.put(
        f"/private-notes/{note_id}",
        headers=headers_b_agent,
        json={"name": "Hacked Note"},
    )
    assert upd_res.status_code == 404

    del_res = client.delete(f"/private-notes/{note_id}", headers=headers_b_agent)
    assert del_res.status_code == 404

    use_res = client.post(f"/private-notes/{note_id}/use", headers=headers_b)
    assert use_res.status_code == 404


def test_suggestion_cross_tenant_isolation():
    _, _, _, headers_a, headers_b, _ = setup_tenants_and_headers()

    res_sug = client.post(
        "/suggestions",
        headers=headers_a,
        json={
            "name": "Alpha Suggestion",
            "body": "Add new Alpha template",
            "category_type": "tech_escalation",
            "suggested_by_name": "Agent A",
            "suggested_by_initials": "AA",
        },
    )
    assert res_sug.status_code == 200
    sug_id = res_sug.json()["id"]

    list_b = client.get("/suggestions", headers=headers_b).json()
    assert not any(s["id"] == sug_id for s in list_b)

    app_res = client.post(f"/suggestions/{sug_id}/approve", headers=headers_b)
    assert app_res.status_code == 404

    rej_res = client.post(f"/suggestions/{sug_id}/reject", headers=headers_b)
    assert rej_res.status_code == 404

    del_res = client.delete(f"/suggestions/{sug_id}", headers=headers_b)
    assert del_res.status_code == 404


def test_favorites_and_history_cross_tenant_isolation():
    _, _, _, headers_a, headers_b, _ = setup_tenants_and_headers()

    tpl_a = client.post(
        "/templates",
        headers=headers_a,
        json={"name": "Alpha Tpl", "body": "Body", "category_type": "tech_escalation"},
    ).json()

    fav_res = client.post(f"/favorites/CW/{tpl_a['id']}", headers=headers_b)
    assert fav_res.status_code == 404

    hist_res = client.post(f"/history/CW/{tpl_a['id']}", headers=headers_b)
    assert hist_res.status_code == 404

    fav_valid = client.post(f"/favorites/CW/{tpl_a['id']}", headers=headers_a)
    assert fav_valid.status_code == 200
    assert tpl_a["id"] in fav_valid.json()

    fav_b = client.get("/favorites/CW", headers=headers_b).json()
    assert tpl_a["id"] not in fav_b


def test_sir_cross_tenant_isolation():
    _, _, _, headers_a, headers_b, _ = setup_tenants_and_headers()

    shift_a = client.post(
        "/sir/shifts",
        headers=headers_a,
        json={"name": "Alpha Shift", "start_time": "08:00", "end_time": "16:00"},
    ).json()
    assert client.put(f"/sir/shifts/{shift_a['id']}", headers=headers_b, json={"name": "Hacked Shift"}).status_code == 404
    assert client.delete(f"/sir/shifts/{shift_a['id']}", headers=headers_b).status_code == 404
    list_shifts_b = client.get("/sir/shifts", headers=headers_b).json()
    assert not any(s["id"] == shift_a["id"] for s in list_shifts_b)

    target_a = client.post(
        "/sir/targets",
        headers=headers_a,
        json={"name": "Alpha Target"},
    ).json()
    assert client.delete(f"/sir/targets/{target_a['id']}", headers=headers_b).status_code == 404
    list_targets_b = client.get("/sir/targets", headers=headers_b).json()
    assert not any(t["id"] == target_a["id"] for t in list_targets_b)

    issue_a = client.post(
        "/sir/issues",
        headers=headers_a,
        json={
            "title": "Alpha Outage",
            "time_noticed": "10:00",
            "description": "Fibre cut",
            "actions_taken": "Notified ISP",
            "logged_by_name": "Alice",
            "logged_by_initials": "AA",
        },
    ).json()
    assert client.put(f"/sir/issues/{issue_a['id']}", headers=headers_b, json={"title": "Hacked Title"}).status_code == 404
    assert client.delete(f"/sir/issues/{issue_a['id']}", headers=headers_b).status_code == 404
    list_issues_b = client.get("/sir/issues", headers=headers_b).json()
    assert not any(i["id"] == issue_a["id"] for i in list_issues_b)


def test_agent_user_data_cross_tenant_isolation():
    _, _, _, headers_a, headers_b, _ = setup_tenants_and_headers()

    save_a = client.post(
        "/api/agent-data",
        headers=headers_a,
        json={
            "agent_initials": "CW",
            "favorites": ["1", "2"],
            "recently_used": ["1"],
        },
    )
    assert save_a.status_code == 200

    get_b = client.get("/api/agent-data?agent_initials=CW", headers=headers_b).json()
    assert get_b["favorites"] == []
    assert get_b["recently_used"] == []


def test_deactivated_tenant_access_blocked():
    _, _, comp_g, _, _, headers_g = setup_tenants_and_headers()

    assert client.get("/templates", headers=headers_g).status_code == 403
    assert client.get("/agents", headers=headers_g).status_code == 403
    assert client.get("/private-notes", headers={**headers_g, "X-Agent-Initials": "SA"}).status_code == 403
    assert client.get("/suggestions", headers=headers_g).status_code == 403
    assert client.get("/sir/shifts", headers=headers_g).status_code == 403
    assert client.get("/sir/targets", headers=headers_g).status_code == 403
    assert client.get("/sir/issues", headers=headers_g).status_code == 403

    slug_headers = {"X-Company-Slug": comp_g["slug"]}
    assert client.get("/templates", headers=slug_headers).status_code == 403
