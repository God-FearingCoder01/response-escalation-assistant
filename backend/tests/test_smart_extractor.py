import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session, select

from backend.main import app, engine, generate_admin_token, sync_default_data_if_needed
from backend.models import ExtractionRule, Template
from backend.services.extraction_service import (
    process_text_extraction,
    evaluate_rule_pattern,
    validate_extracted_value,
)

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
# 1. RULE CRUD & MULTI-TENANCY ISOLATION TESTS
# ============================================================

def test_create_and_read_extraction_rule():
    headers = get_admin_headers()
    payload = {
        "company_id": 1,
        "name": "Custom Ticket ID",
        "result_field": "ticket_id",
        "extraction_method": "regex",
        "pattern": r"TICK-\d{6}",
        "description": "Extracts TICK-123456 ticket numbers",
        "is_enabled": True,
    }
    res = client.post("/api/extraction-rules", headers=headers, json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["name"] == "Custom Ticket ID"
    assert data["result_field"] == "ticket_id"
    assert data["pattern"] == r"TICK-\d{6}"
    assert data["company_id"] == 1


def test_extraction_rules_persistence_and_update():
    headers = get_admin_headers()
    
    # Create rule
    rule_data = client.post(
        "/api/extraction-rules",
        headers=headers,
        json={
            "company_id": 1,
            "name": "Invoice Number",
            "result_field": "invoice_no",
            "extraction_method": "regex",
            "pattern": r"INV-\d{5}",
            "is_enabled": True,
        }
    ).json()

    rule_id = rule_data["id"]

    # Update rule
    res_update = client.put(
        f"/api/extraction-rules/{rule_id}?company_id=1",
        headers=headers,
        json={"pattern": r"INV-\d{6}", "is_enabled": False}
    )
    assert res_update.status_code == 200
    assert res_update.json()["pattern"] == r"INV-\d{6}"
    assert res_update.json()["is_enabled"] is False

    # Fetch rule to verify persistence
    res_get = client.get(f"/api/extraction-rules/{rule_id}?company_id=1")
    assert res_get.status_code == 200
    assert res_get.json()["pattern"] == r"INV-\d{6}"


def test_extraction_rules_tenant_isolation():
    headers = get_admin_headers()

    # Create Company B
    comp_b = client.post(
        "/companies",
        headers=headers,
        json={"name": "Company B", "slug": "company-b", "is_active": True}
    ).json()
    company_b_id = comp_b["id"]

    # Create rule in Company A
    rule_a = client.post(
        "/api/extraction-rules",
        headers=headers,
        json={
            "company_id": 1,
            "name": "Secret A Rule",
            "result_field": "secret_a_field",
            "extraction_method": "regex",
            "pattern": r"SECRETA-\d+",
            "is_enabled": True,
        }
    ).json()

    # Company B listing must NOT contain Company A's rules
    res_b_list = client.get(f"/api/extraction-rules?company_id={company_b_id}").json()
    fields_b = [r["result_field"] for r in res_b_list]
    assert "secret_a_field" not in fields_b

    # Cross-company update attempt should fail (404)
    res_cross_update = client.put(
        f"/api/extraction-rules/{rule_a['id']}?company_id={company_b_id}",
        headers=headers,
        json={"name": "Hacked Rule"}
    )
    assert res_cross_update.status_code == 404


# ============================================================
# 2. EXTRACTION ENGINE & VALIDATION TESTS
# ============================================================

def test_process_text_extraction_single_and_multiple_matches():
    with Session(engine) as session:
        rules = [
            ExtractionRule(id=101, company_id=1, name="Transaction Ref", result_field="reference_number", pattern=r"MP\d{6}\.\d{4}\.T\d{7}", is_enabled=True),
            ExtractionRule(id=102, company_id=1, name="Amount", result_field="amount", pattern=r"\$\d+\.\d{2}", is_enabled=True),
            ExtractionRule(id=103, company_id=1, name="Date", result_field="date", pattern=r"\d{2}/\d{2}/\d{4}", is_enabled=True),
            ExtractionRule(id=104, company_id=1, name="Disabled Rule", result_field="disabled_field", pattern=r"XYZ\d+", is_enabled=False),
        ]

        text = "Payment confirmation. Ref: MP260831.1923.T7382831. Amount: $45.50 on 31/08/2026. Extra XYZ123."
        results = process_text_extraction(text, rules)

        assert len(results) == 3
        
        # Verify Ref Number
        ref_item = next(r for r in results if r["result_field"] == "reference_number")
        assert ref_item["value"] == "MP260831.1923.T7382831"
        assert ref_item["is_valid"] is True

        # Verify Amount
        amt_item = next(r for r in results if r["result_field"] == "amount")
        assert amt_item["value"] == "45.50"
        assert amt_item["is_valid"] is True

        # Verify Date
        date_item = next(r for r in results if r["result_field"] == "date")
        assert date_item["value"] == "31/08/2026"
        assert date_item["is_valid"] is True

        # Disabled rule must not produce a result
        assert not any(r["result_field"] == "disabled_field" for r in results)


def test_pasted_text_bypasses_ocr_and_processes_successfully():
    headers = get_admin_headers()

    # Call process endpoint with pasted customer text
    raw_pasted_text = "Hello, customer says transaction reference is MP998877.1234.T1122334 with amount $100.00."
    res = client.post(
        "/api/extraction-rules/process",
        headers=headers,
        json={"company_id": 1, "text": raw_pasted_text}
    )
    assert res.status_code == 200
    data = res.json()
    assert data["extracted_count"] >= 2
    
    values = [r["value"] for r in data["results"]]
    assert "MP998877.1234.T1122334" in values
    assert "100.00" in values


def test_no_match_scenarios_handled_cleanly():
    with Session(engine) as session:
        rules = [
            ExtractionRule(id=201, company_id=1, name="Transaction Ref", result_field="reference_number", pattern=r"MP\d{6}\.\d{4}\.T\d{7}", is_enabled=True),
        ]
        text = "Hello, I need help with my account password."
        results = process_text_extraction(text, rules)
        assert len(results) == 0


def test_validation_and_imperfect_format_detection():
    val_correct = validate_extracted_value("MP260831.1923.T7382831", r"MP\d{6}\.\d{4}\.T\d{7}")
    assert val_correct is True

    val_typo = validate_extracted_value("MP260831.1923.T73828I1", r"MP\d{6}\.\d{4}\.T\d{7}")
    assert val_typo is False


def test_admin_pattern_rule_tester_endpoint():
    headers = get_admin_headers()

    # Valid test match
    res_match = client.post(
        "/api/extraction-rules/test",
        headers=headers,
        json={
            "pattern": r"MP\d{6}\.\d{4}\.T\d{7}",
            "test_input": "Reference is MP260831.1923.T7382831 for payment.",
        }
    )
    assert res_match.status_code == 200
    assert res_match.json()["matched"] is True
    assert res_match.json()["value"] == "MP260831.1923.T7382831"

    # Invalid regex test error
    res_bad_regex = client.post(
        "/api/extraction-rules/test",
        headers=headers,
        json={"pattern": r"[Unclosed bracket", "test_input": "Test text"}
    )
    assert res_bad_regex.status_code == 200
    assert res_bad_regex.json()["matched"] is False
    assert "Invalid regular expression" in res_bad_regex.json()["error"]


# ============================================================
# 3. REGRESSION SAFETY & FEATURE INDEPENDENCE TESTS
# ============================================================

def test_extractable_fields_and_templates_remain_unaffected():
    headers = get_admin_headers()

    # Normal template CRUD works
    tpl = client.post(
        "/templates",
        headers=headers,
        json={
            "company_id": 1,
            "name": "Extractor Regression Template",
            "category_type": "customer_reply",
            "category": "General",
            "subcategory": "Support",
            "body": "Hello {customer_name}, reference is {reference_number}.",
        }
    ).json()

    assert tpl["id"] > 0
    assert tpl["body"] == "Hello {customer_name}, reference is {reference_number}."


def test_amount_extraction_excludes_new_balance_and_strips_currency_symbols():
    rules = [
        ExtractionRule(
            id=301,
            company_id=1,
            name="Amount",
            result_field="amount",
            pattern=r"(?:\$|USD\s*)?(\d+(?:\.\d{2})?)",
            is_enabled=True,
        )
    ]

    # Test text containing transaction amount and New Balance amount
    text = "Successful transaction of USD 75.00 on your account. New Balance: $250.00."
    results = process_text_extraction(text, rules)

    assert len(results) == 1
    amt_item = results[0]
    assert amt_item["result_field"] == "amount"
    # Must be 75.00 (numerals only, excluding New Balance $250.00 and excluding USD symbol)
    assert amt_item["value"] == "75.00"
    assert "250.00" not in amt_item["all_values"]


def test_multiple_reference_numbers_align_with_corresponding_amounts():
    rules = [
        ExtractionRule(id=401, company_id=1, name="Transaction Ref", result_field="reference_number", pattern=r"MP\d{6}\.\d{4}\.T\d{7}", is_enabled=True),
        ExtractionRule(id=402, company_id=1, name="Amount", result_field="amount", pattern=r"(?:\$|USD\s*)?(\d+(?:\.\d{2})?)", is_enabled=True),
    ]

    text = (
        "Tx 1: Ref MP260831.1111.T1111111 Amount: $50.00. "
        "Tx 2: Ref MP260831.2222.T2222222 Amount: $125.00. "
    )
    results = process_text_extraction(text, rules)

    assert len(results) == 2
    ref_item = next(r for r in results if r["result_field"] == "reference_number")
    amt_item = next(r for r in results if r["result_field"] == "amount")

    # Verify order alignment: Ref #1 pairs with Amount #1, Ref #2 pairs with Amount #2
    assert ref_item["all_values"] == ["MP260831.1111.T1111111", "MP260831.2222.T2222222"]
    assert amt_item["all_values"] == ["50.00", "125.00"]
    assert ref_item["value"] == "MP260831.1111.T1111111"
    assert amt_item["value"] == "50.00"


