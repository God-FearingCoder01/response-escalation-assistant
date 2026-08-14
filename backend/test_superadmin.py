from fastapi.testclient import TestClient
from sqlmodel import Session, select
from backend.main import app, engine, Company, Agent, SuperAdmin, hash_pin

client = TestClient(app)


def test_superadmin_flow():
    # 1. Test Super Admin PIN verification with default PIN 0000
    res = client.post("/superadmin/verify-pin", json={"pin": "0000"})
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "token" in data
    assert "email" in data

    # Test invalid PIN
    res_bad = client.post("/superadmin/verify-pin", json={"pin": "9999"})
    assert res_bad.status_code == 401

    # 2. Test request PIN reset with registered email
    res_req = client.post("/superadmin/request-pin-reset", json={"email": data["email"]})
    assert res_req.status_code == 200
    req_data = res_req.json()
    assert "reset_token" in req_data
    token = req_data["reset_token"]

    # Test confirm PIN reset with token
    res_reset = client.post("/superadmin/reset-pin", json={"token": token, "new_pin": "1234"})
    assert res_reset.status_code == 200

    # Verify new PIN 1234 works
    res_v2 = client.post("/superadmin/verify-pin", json={"pin": "1234"})
    assert res_v2.status_code == 200

    # 3. Test update Super Admin credentials (email & PIN back to 0000)
    res_upd = client.post(
        "/superadmin/update-settings",
        json={"current_pin": "1234", "email": "gfc.dev@proton.me", "pin": "0000"},
    )
    assert res_upd.status_code == 200
    assert res_upd.json()["email"] == "gfc.dev@proton.me"

    # 4. Test resetting Company Admin PIN from Super Admin
    with Session(engine) as session:
        comp = session.exec(select(Company)).first()
        assert comp is not None
        comp_id = comp.id

    res_comp_pin = client.post(
        "/superadmin/reset-company-admin-pin",
        json={"company_id": comp_id, "new_pin": "5555"},
    )
    assert res_comp_pin.status_code == 200
    assert res_comp_pin.json()["status"] == "ok"
