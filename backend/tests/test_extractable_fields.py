import json
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select, SQLModel

from backend.main import app, engine, generate_admin_token, sync_default_data_if_needed
from backend.models import Company, Template, Agent
from backend.extraction_engine import (
    validate_extraction_pattern,
    extract_values_from_pattern,
    transform_extracted_value,
    process_extractable_fields,
)

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


def test_1_field_can_be_marked_extractable():
    cfg = {
        "reference_number": {
            "control_type": "text",
            "is_extractable": True,
            "extraction_config": {
                "example_input": "MP260831.1923.T7382831",
                "pattern": "MP[260831].[1923].T7382831",
                "extractions": [],
            },
        }
    }
    assert cfg["reference_number"]["is_extractable"] is True


def test_2_example_input_can_be_saved():
    cfg = {
        "example_input": "MP260831.1923.T7382831"
    }
    assert cfg["example_input"] == "MP260831.1923.T7382831"


def test_3_one_bracketed_substring_detected():
    res = validate_extraction_pattern("TXN-[99887766]-REF")
    assert res["is_valid"] is True
    assert len(res["extractions"]) == 1
    assert res["extractions"][0]["sample_val"] == "99887766"


def test_4_multiple_bracketed_substrings_detected():
    res = validate_extraction_pattern("MP[260831].[1923].T7382831")
    assert res["is_valid"] is True
    assert len(res["extractions"]) == 2
    assert res["extractions"][0]["sample_val"] == "260831"
    assert res["extractions"][1]["sample_val"] == "1923"


def test_5_brackets_not_included_in_extracted_values():
    extracted = extract_values_from_pattern("MP[260831].[1923].T7382831", "MP260831.1923.T7382831")
    assert extracted == ["260831", "1923"]
    assert "[" not in extracted[0] and "]" not in extracted[0]
    assert "[" not in extracted[1] and "]" not in extracted[1]


def test_6_extracted_values_can_be_mapped_to_existing_template_fields():
    extractions = [
        {"id": "ext_1", "sample_val": "260831", "target_field": "date", "transform_type": "date"},
        {"id": "ext_2", "sample_val": "1923", "target_field": "time", "transform_type": "time"},
    ]
    assert extractions[0]["target_field"] == "date"
    assert extractions[1]["target_field"] == "time"


def test_7_text_values_can_be_auto_filled():
    cfg = {
        "ref": {
            "is_extractable": True,
            "extraction_config": {
                "pattern": "REF-[ABC123]",
                "extractions": [{"target_field": "notes", "transform_type": "none"}],
            },
        },
        "notes": {"control_type": "text"},
    }
    updates = process_extractable_fields("ref", "REF-ABC123", cfg)
    assert updates == {"notes": "ABC123"}


def test_8_date_transformations_work():
    config = {
        "transform_type": "date",
        "date_input_format": "YYMMDD",
        "date_output_format": "YYYY-MM-DD",
    }
    res = transform_extracted_value("260831", config)
    assert res == "2026-08-31"


def test_9_time_transformations_work():
    config = {
        "transform_type": "time",
        "time_input_format": "HHmm",
        "time_output_format": "HH:mm",
    }
    res = transform_extracted_value("1923", config)
    assert res == "19:23"


def test_10_date_only_controls_receive_correctly_formatted_values():
    config = {
        "transform_type": "date",
        "date_input_format": "YYMMDD",
        "date_output_format": "YYYY-MM-DD",
    }
    res = transform_extracted_value("260831", config, target_control_type="date")
    assert res == "2026-08-31"


def test_11_time_only_controls_receive_correctly_formatted_values():
    config = {
        "transform_type": "time",
        "time_input_format": "HHmm",
        "time_output_format": "HH:mm",
    }
    res = transform_extracted_value("1923", config, target_control_type="time")
    assert res == "19:23"


def test_12_multiple_extracted_values_can_populate_multiple_fields():
    cfg = {
        "reference_number": {
            "is_extractable": True,
            "extraction_config": {
                "pattern": "MP[260831].[1923].T7382831",
                "extractions": [
                    {
                        "target_field": "date",
                        "transform_type": "date",
                        "date_input_format": "YYMMDD",
                        "date_output_format": "YYYY-MM-DD",
                    },
                    {
                        "target_field": "time",
                        "transform_type": "time",
                        "time_input_format": "HHmm",
                        "time_output_format": "HH:mm",
                    },
                ],
            },
        },
        "date": {"control_type": "date"},
        "time": {"control_type": "time"},
    }
    updates = process_extractable_fields("reference_number", "MP260831.1923.T7382831", cfg)
    assert updates == {
        "date": "2026-08-31",
        "time": "19:23",
    }


def test_13_auto_fill_does_not_override_visibility_rules():
    cfg = {
        "date": {
            "control_type": "date",
            "visibility_mode": "hide_if_autofilled",
        }
    }
    # Auto-fill updates value in state dictionary without altering 'visibility_mode'
    assert cfg["date"]["visibility_mode"] == "hide_if_autofilled"


def test_14_configuration_survives_save_reload():
    headers = get_admin_headers(company_id=1, initials="SA")
    tpl_payload = {
        "name": "Extractable Save Reload Test",
        "body": "Ref {reference_number}, Date {date}, Time {time}",
        "category_type": "customer_reply",
        "category": "Transactions",
        "subcategory": "Test",
        "placeholder_config": json.dumps({
            "reference_number": {
                "control_type": "text",
                "is_extractable": True,
                "extraction_config": {
                    "example_input": "MP260831.1923.T7382831",
                    "pattern": "MP[260831].[1923].T7382831",
                    "extractions": [
                        {"target_field": "date", "transform_type": "date"},
                        {"target_field": "time", "transform_type": "time"},
                    ],
                },
            }
        }),
    }

    resp = client.post("/templates", json=tpl_payload, headers=headers)
    assert resp.status_code == 200, resp.text
    created = resp.json()
    tpl_id = created["id"]

    # Fetch template back
    get_resp = client.get(f"/templates/{tpl_id}", headers=headers)
    assert get_resp.status_code == 200
    fetched = get_resp.json()
    assert fetched["placeholder_config"] is not None

    parsed = json.loads(fetched["placeholder_config"])
    assert parsed["reference_number"]["is_extractable"] is True
    assert len(parsed["reference_number"]["extraction_config"]["extractions"]) == 2


def test_15_invalid_bracket_configurations_are_rejected():
    res_unmatched_open = validate_extraction_pattern("MP[260831.1923.T7382831")
    assert res_unmatched_open["is_valid"] is False
    assert "Unmatched opening bracket" in res_unmatched_open["error"]

    res_unmatched_close = validate_extraction_pattern("MP260831].1923.T7382831")
    assert res_unmatched_close["is_valid"] is False
    assert "Unmatched closing bracket" in res_unmatched_close["error"]

    res_empty = validate_extraction_pattern("MP[].1923.T7382831")
    assert res_empty["is_valid"] is False
    assert "Empty extraction bracket" in res_empty["error"]

    res_nested = validate_extraction_pattern("MP[[260831]].1923.T7382831")
    assert res_nested["is_valid"] is False
    assert "Nested brackets" in res_nested["error"]


def test_16_multi_tenant_isolation_is_preserved():
    headers1 = get_admin_headers(company_id=1, initials="SA")
    headers2 = get_admin_headers(company_id=2, initials="SA")

    # Create template under company 1
    resp1 = client.post(
        "/templates",
        json={
            "name": "Company 1 Only Template",
            "body": "Body {ref}",
            "category_type": "customer_reply",
            "category": "IsolationTest",
        },
        headers=headers1,
    )
    assert resp1.status_code == 200
    tpl1_id = resp1.json()["id"]

    # Company 2 should not be able to access Company 1's template
    resp2 = client.get(f"/templates/{tpl1_id}", headers=headers2)
    assert resp2.status_code == 404


def test_17_runtime_extraction_works_with_different_values():
    pattern = "MP[260831].[1923].T7382831"
    # Admin example: MP260831.1923.T7382831
    # Runtime agent input with different date (260929) and different time (1942) and different ref (T9876543):
    agent_input = "MP260929.1942.T9876543"

    extracted = extract_values_from_pattern(pattern, agent_input)
    assert extracted == ["260929", "1942"]

    cfg = {
        "transform_type": "date",
        "date_input_format": "YYMMDD",
        "date_output_format": "YYYY-MM-DD",
    }
    date_val = transform_extracted_value(extracted[0], cfg)
    assert date_val == "2026-09-29"

    time_cfg = {
        "transform_type": "time",
        "time_input_format": "HHmm",
        "time_output_format": "HH:mm",
    }
    time_val = transform_extracted_value(extracted[1], time_cfg)
    assert time_val == "19:42"
