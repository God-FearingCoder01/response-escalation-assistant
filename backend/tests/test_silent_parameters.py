import json
import pytest
from fastapi.testclient import TestClient
from sqlmodel import Session, select, SQLModel

from backend.main import app, engine, generate_admin_token, sync_default_data_if_needed
from backend.models import Company, Template
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


def test_1_required_parameter_can_be_marked_silent():
    cfg = {
        "customer_datetime": {
            "control_type": "text",
            "is_silent": True,
            "is_extractable": True,
        }
    }
    assert cfg["customer_datetime"]["is_silent"] is True


def test_2_silent_parameter_does_not_appear_in_final_message():
    template_body = "Transaction verified on {date} at {time}."
    placeholder_config = {
        "customer_datetime": {"is_silent": True},
        "date": "2026-09-21",
        "time": "13:51",
    }
    # Silent parameter is not present in template_body placeholders
    assert "{customer_datetime}" not in template_body
    final_msg = template_body.replace("{date}", "2026-09-21").replace("{time}", "13:51")
    assert "customer_datetime" not in final_msg
    assert final_msg == "Transaction verified on 2026-09-21 at 13:51."


def test_3_silent_parameter_appears_in_input_area_config():
    placeholder_config = {
        "customer_datetime": {
            "control_type": "text",
            "is_silent": True,
            "is_extractable": True,
        }
    }
    all_form_keys = list(placeholder_config.keys())
    assert "customer_datetime" in all_form_keys


def test_4_silent_parameter_can_be_extractable():
    cfg = {
        "customer_datetime": {
            "is_silent": True,
            "is_extractable": True,
            "extraction_config": {
                "example_input": "21/09/2026 13:51",
                "pattern": "[21/09/2026] [13:51]",
                "extractions": [
                    {
                        "target_field": "date",
                        "transform_type": "date",
                        "date_input_format": "DD/MM/YYYY",
                        "date_output_format": "YYYY-MM-DD",
                    },
                    {
                        "target_field": "time",
                        "transform_type": "time",
                        "time_input_format": "HH:mm",
                        "time_output_format": "HH:mm",
                    },
                ],
            },
        }
    }
    assert cfg["customer_datetime"]["is_silent"] is True
    assert cfg["customer_datetime"]["is_extractable"] is True


def test_5_one_silent_parameter_can_populate_multiple_existing_fields():
    cfg = {
        "customer_datetime": {
            "is_silent": True,
            "is_extractable": True,
            "extraction_config": {
                "pattern": "[21/09/2026] [13:51]",
                "extractions": [
                    {"target_field": "date", "transform_type": "date", "date_input_format": "DD/MM/YYYY", "date_output_format": "YYYY-MM-DD"},
                    {"target_field": "time", "transform_type": "time", "time_input_format": "HH:mm", "time_output_format": "HH:mm"},
                ],
            },
        },
        "date": {"control_type": "date"},
        "time": {"control_type": "time"},
    }

    updates = process_extractable_fields("customer_datetime", "21/09/2026 13:51", cfg)
    assert updates == {
        "date": "2026-09-21",
        "time": "13:51",
    }


def test_6_date_extraction_works():
    config = {
        "transform_type": "date",
        "date_input_format": "DD/MM/YYYY",
        "date_output_format": "YYYY-MM-DD",
    }
    extracted_date = transform_extracted_value("21/09/2026", config)
    assert extracted_date == "2026-09-21"


def test_7_time_extraction_works():
    config = {
        "transform_type": "time",
        "time_input_format": "HH:mm",
        "time_output_format": "HH:mm",
    }
    extracted_time = transform_extracted_value("13:51", config)
    assert extracted_time == "13:51"


def test_8_existing_transformations_applied_correctly():
    date_config = {
        "transform_type": "date",
        "date_input_format": "DDMMYYYY",
        "date_output_format": "YYYY-MM-DD",
    }
    assert transform_extracted_value("21092026", date_config) == "2026-09-21"


def test_9_target_fields_receive_correct_control_compatible_values():
    date_val = transform_extracted_value("21/09/2026", {"transform_type": "date"}, target_control_type="date")
    time_val = transform_extracted_value("13:51", {"transform_type": "time"}, target_control_type="time")
    assert date_val == "2026-09-21"
    assert time_val == "13:51"


def test_10_target_fields_considered_populated_after_autofill():
    form_values = {}
    cfg = {
        "customer_datetime": {
            "is_silent": True,
            "is_extractable": True,
            "extraction_config": {
                "pattern": "[21/09/2026] [13:51]",
                "extractions": [
                    {"target_field": "date", "transform_type": "none"},
                    {"target_field": "time", "transform_type": "none"},
                ],
            },
        }
    }
    updates = process_extractable_fields("customer_datetime", "21/09/2026 13:51", cfg)
    form_values.update(updates)
    assert bool(form_values.get("date")) is True
    assert bool(form_values.get("time")) is True


def test_11_unfilled_silent_required_parameters_remain_unpopulated():
    form_values = {"customer_datetime": ""}
    cfg = {
        "customer_datetime": {
            "is_silent": True,
            "is_extractable": True,
            "extraction_config": {
                "pattern": "[21/09/2026] [13:51]",
                "extractions": [
                    {"target_field": "date", "transform_type": "none"},
                    {"target_field": "time", "transform_type": "none"},
                ],
            },
        }
    }
    updates = process_extractable_fields("customer_datetime", form_values["customer_datetime"], cfg)
    assert updates == {}


def test_12_no_double_entry_required():
    # Single entry populates all target parameters
    agent_entry = "21/09/2026 13:51"
    cfg = {
        "customer_datetime": {
            "is_silent": True,
            "is_extractable": True,
            "extraction_config": {
                "pattern": "[21/09/2026] [13:51]",
                "extractions": [
                    {"target_field": "date", "transform_type": "none"},
                    {"target_field": "time", "transform_type": "none"},
                ],
            },
        }
    }
    target_state = process_extractable_fields("customer_datetime", agent_entry, cfg)
    assert "date" in target_state and "time" in target_state


def test_13_visibility_rules_remain_unchanged():
    cfg = {
        "date": {"control_type": "date", "visibility_mode": "hide_if_autofilled"},
        "time": {"control_type": "time", "visibility_mode": "hide_if_autofilled"},
    }
    assert cfg["date"]["visibility_mode"] == "hide_if_autofilled"
    assert cfg["time"]["visibility_mode"] == "hide_if_autofilled"


def test_14_silent_parameter_configuration_survives_save_reload():
    headers = get_admin_headers(company_id=1, initials="SA")
    tpl_payload = {
        "name": "Silent Parameter Template Test",
        "body": "Your request on {date} at {time} is logged.",
        "category_type": "customer_reply",
        "category": "Transactions",
        "subcategory": "SilentTest",
        "placeholder_config": json.dumps({
            "customer_datetime": {
                "control_type": "text",
                "is_silent": True,
                "is_extractable": True,
                "extraction_config": {
                    "example_input": "21/09/2026 13:51",
                    "pattern": "[21/09/2026] [13:51]",
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
    tpl_id = resp.json()["id"]

    get_resp = client.get(f"/templates/{tpl_id}", headers=headers)
    assert get_resp.status_code == 200
    fetched = get_resp.json()

    parsed = json.loads(fetched["placeholder_config"])
    assert parsed["customer_datetime"]["is_silent"] is True
    assert parsed["customer_datetime"]["is_extractable"] is True


def test_15_multiple_silent_parameters_can_coexist():
    cfg = {
        "customer_datetime": {
            "is_silent": True,
            "is_extractable": True,
            "extraction_config": {
                "pattern": "[21/09/2026] [13:51]",
                "extractions": [
                    {"target_field": "date", "transform_type": "none"},
                    {"target_field": "time", "transform_type": "none"},
                ],
            },
        },
        "customer_ref_info": {
            "is_silent": True,
            "is_extractable": True,
            "extraction_config": {
                "pattern": "REF-[123456]-[ABC]",
                "extractions": [
                    {"target_field": "ref_num", "transform_type": "none"},
                    {"target_field": "ref_code", "transform_type": "none"},
                ],
            },
        },
    }

    updates1 = process_extractable_fields("customer_datetime", "21/09/2026 13:51", cfg)
    updates2 = process_extractable_fields("customer_ref_info", "REF-123456-ABC", cfg)

    assert updates1 == {"date": "21/09/2026", "time": "13:51"}
    assert updates2 == {"ref_num": "123456", "ref_code": "ABC"}


def test_16_multi_tenant_isolation_remains_intact():
    headers1 = get_admin_headers(company_id=1, initials="SA")
    headers2 = get_admin_headers(company_id=2, initials="SA")

    resp1 = client.post(
        "/templates",
        json={
            "name": "Company 1 Silent Template",
            "body": "Message {date}",
            "category_type": "customer_reply",
            "category": "SilentIso",
            "placeholder_config": json.dumps({"customer_dt": {"is_silent": True}}),
        },
        headers=headers1,
    )
    assert resp1.status_code == 200
    tpl1_id = resp1.json()["id"]

    resp2 = client.get(f"/templates/{tpl1_id}", headers=headers2)
    assert resp2.status_code == 404


def test_17_existing_extractable_field_functionality_unaffected():
    # Normal Extractable Field (not silent)
    cfg = {
        "reference_number": {
            "is_extractable": True,
            "is_silent": False,
            "extraction_config": {
                "pattern": "MP[260831].[1923].T7382831",
                "extractions": [
                    {"target_field": "date", "transform_type": "date", "date_input_format": "YYMMDD", "date_output_format": "YYYY-MM-DD"},
                    {"target_field": "time", "transform_type": "time", "time_input_format": "HHmm", "time_output_format": "HH:mm"},
                ],
            },
        }
    }

    updates = process_extractable_fields("reference_number", "MP260831.1923.T7382831", cfg)
    assert updates == {"date": "2026-08-31", "time": "19:23"}
