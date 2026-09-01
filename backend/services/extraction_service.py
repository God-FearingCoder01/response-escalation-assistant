from typing import List, Dict

DEFAULT_EXTRACTION_RULES_DATA: List[dict] = [
    {
        "id": "rule_1",
        "name": "Deposit Code",
        "description": "Standard deposit confirmation reference",
        "method": "pattern",
        "pattern": "DEP-[A-Z0-9]{8}",
        "prefix": "DEP-",
        "valueType": "alphanumeric",
        "valueTypes": ["alphanumeric"],
        "lengthMode": "constant",
        "minLength": 8,
        "maxLength": 8,
        "constantLength": 8,
        "result_label": "Deposit Code",
        "target_placeholder": "deposit_code",
        "is_active": True,
    },
    {
        "id": "rule_2",
        "name": "Transaction Reference",
        "description": "Payment gateway transaction reference (e.g. TXN-99887766)",
        "method": "pattern",
        "pattern": "TXN-\\d{8}",
        "prefix": "TXN-",
        "valueType": "numbers",
        "valueTypes": ["numbers"],
        "lengthMode": "constant",
        "minLength": 8,
        "maxLength": 8,
        "constantLength": 8,
        "result_label": "Transaction Reference",
        "target_placeholder": "transaction_reference",
        "is_active": True,
    },
    {
        "id": "rule_3",
        "name": "Account Number",
        "description": "Customer account identifier (e.g. ACC-482913)",
        "method": "pattern",
        "pattern": "ACC-\\d{6}",
        "prefix": "ACC-",
        "valueType": "numbers",
        "valueTypes": ["numbers"],
        "lengthMode": "constant",
        "minLength": 6,
        "maxLength": 6,
        "constantLength": 6,
        "result_label": "Account Number",
        "target_placeholder": "account_number",
        "is_active": True,
    },
    {
        "id": "rule_4",
        "name": "Phone Number",
        "description": "Mobile phone number (e.g. 0771234567)",
        "method": "pattern",
        "pattern": "07\\d{8}",
        "prefix": "07",
        "valueType": "numbers",
        "valueTypes": ["numbers"],
        "lengthMode": "constant",
        "minLength": 8,
        "maxLength": 8,
        "constantLength": 8,
        "result_label": "Phone Number",
        "target_placeholder": "phone_number",
        "is_active": True,
    },
    {
        "id": "rule_5",
        "name": "Amount",
        "description": "Monetary amount shown on confirmation (e.g. $25.00)",
        "method": "pattern",
        "pattern": "\\$[0-9,]+(\\.[0-9]{2})?",
        "prefix": "$",
        "valueType": "amount",
        "valueTypes": ["amount"],
        "lengthMode": "variable",
        "minLength": 1,
        "maxLength": 10,
        "constantLength": 5,
        "result_label": "Amount",
        "target_placeholder": "amount",
        "is_active": True,
    },
]


def get_rules() -> List[dict]:
    return DEFAULT_EXTRACTION_RULES_DATA


def save_rules(rules: List[dict]) -> List[dict]:
    global DEFAULT_EXTRACTION_RULES_DATA
    DEFAULT_EXTRACTION_RULES_DATA = rules
    return DEFAULT_EXTRACTION_RULES_DATA
