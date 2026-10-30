from fastapi.testclient import TestClient
from sqlmodel import Session, select
from backend.main import app, engine, Company, Agent, SuperAdmin
from backend.bootstrap import SUPERADMIN_BOOTSTRAP_PIN
from backend.tests.auth_helpers import get_superadmin_headers

client = TestClient(app)


def test_superadmin_flow():
    headers = get_superadmin_headers()
    res = client.post("/superadmin/verify-pin", json={"pin": SUPERADMIN_BOOTSTRAP_PIN})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "token" in data
    assert "email" in data

    res_bad = client.post("/superadmin/verify-pin", json={"pin": "9999"})
    assert res_bad.status_code == 401

    res_req = client.post("/superadmin/request-pin-reset", headers=headers, json={"email": data["email"]})
    assert res_req.status_code == 200
    req_data = res_req.json()
    assert "reset_token" in req_data
    token = req_data["reset_token"]

    res_reset = client.post("/superadmin/reset-pin", headers=headers, json={"token": token, "new_pin": "1234"})
    assert res_reset.status_code == 200

    res_v2 = client.post("/superadmin/verify-pin", json={"pin": "1234"})
    assert res_v2.status_code == 200

    res_upd = client.post(
        "/superadmin/update-settings",
        headers=headers,
        json={"current_pin": "1234", "email": "gfc.dev@proton.me", "pin": "6284"},
    )
    assert res_upd.status_code == 200
    assert res_upd.json()["email"] == "gfc.dev@proton.me"
    assert client.post("/superadmin/verify-pin", json={"pin": "0000"}).status_code == 401

    with Session(engine) as session:
        comp = session.exec(select(Company)).first()
        assert comp is not None
        comp_id = comp.id

    res_comp_pin = client.post(
        "/superadmin/reset-company-admin-pin",
        headers=headers,
        json={"company_id": comp_id, "new_pin": "5555"},
    )
    assert res_comp_pin.status_code == 200
    assert res_comp_pin.json()["status"] == "ok"


def test_legacy_superadmin_setup_pin_is_rotated_during_seed_sync():
    from backend.services.seed_service import sync_default_data_if_needed

    with Session(engine) as session:
        sa = session.exec(select(SuperAdmin)).first()
        sa.pin = "0000"
        session.add(sa)
        session.commit()
        sync_default_data_if_needed(session)
        session.refresh(sa)
    assert client.post("/superadmin/verify-pin", json={"pin": "0000"}).status_code == 401
    assert client.post("/superadmin/verify-pin", json={"pin": SUPERADMIN_BOOTSTRAP_PIN}).status_code == 200
