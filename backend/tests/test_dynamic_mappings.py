import json
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select, SQLModel

from backend.main import app, engine, generate_admin_token, sync_default_data_if_needed
from backend.models import Template

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    SQLModel.metadata.drop_all(engine)
    SQLModel.metadata.create_all(engine)
    with Session(engine) as session:
        sync_default_data_if_needed(session)
    yield


def get_admin_headers(company_id=1, initials="SA"):
    token = generate_admin_token(initials)
    return {
        "X-Admin-Token": token,
        "X-Admin-Initials": initials,
        "X-Company-ID": str(company_id),
    }


def test_1to_m_and_silenced_mapping_template_creation():
    headers = get_admin_headers()
    payload = {
        "name": "Withdrawal Status Mapping Test",
        "body": "{withdrawal_type} {payment_method} withdrawal of ${amount} from account number {account_number}; on {date} time {time}hrs.",
        "category_type": "tech_escalation",
        "category": "Payment Escalations",
        "subcategory": "Withdrawal",
        "placeholder_config": json.dumps({
            "withdrawal_type": {
                "control_type": "combobox",
                "mapped_target": "payment_method",
                "options": ["Processing", "Pending"],
                "mapping": {
                    "Processing": "",
                    "Pending": ["Ecocash", "Innbucks", "Omari"]
                }
            }
        })
    }

    res = client.post("/templates", headers=headers, json=payload)
    assert res.status_code == 200, res.text
    data = res.json()
    assert data["name"] == "Withdrawal Status Mapping Test"

    parsed = json.loads(data["placeholder_config"])
    assert "withdrawal_type" in parsed
    assert parsed["withdrawal_type"]["mapping"]["Processing"] == ""
    assert parsed["withdrawal_type"]["mapping"]["Pending"] == ["Ecocash", "Innbucks", "Omari"]
