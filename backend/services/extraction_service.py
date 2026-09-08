import json
from typing import List
from sqlmodel import Session, select
from backend.models import ExtractionRule

DEFAULT_EXTRACTION_RULES_DATA: List[dict] = [
    {
        "id": "rule_1",
        "name": "Deposit Confirmation Message",
        "description": "Mobile money deposit receipt / merchant payment reference (e.g. MP260831.1341.T9283748)",
        "method": "pattern",
        "pattern": "MP[A-Za-z0-9.\\-_$%@#&=]{15,25}",
        "prefix": "MP",
        "valueType": "alphanumeric",
        "valueTypes": ["numbers", "letters", "symbols"],
        "lengthMode": "variable",
        "minLength": 15,
        "maxLength": 25,
        "constantLength": 20,
        "result_label": "Ecocash Merchant Payment",
        "target_placeholder": "transaction_number",
        "is_active": True,
    },
    {
        "id": "rule_2",
        "name": "Innbucks Transaction",
        "description": "Innbucks wallet transaction code / receipt id (e.g. INN-48291039)",
        "method": "pattern",
        "pattern": "INN-\\d{8,10}",
        "prefix": "INN-",
        "valueType": "numbers",
        "valueTypes": ["numbers"],
        "lengthMode": "variable",
        "minLength": 8,
        "maxLength": 10,
        "constantLength": 8,
        "result_label": "Innbucks trans id",
        "target_placeholder": "transaction_number",
        "is_active": True,
    },
    {
        "id": "rule_3",
        "name": "Customer Account Number",
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


def get_company_rules(db: Session, company_id: int) -> List[dict]:
    statement = select(ExtractionRule).where(ExtractionRule.company_id == company_id)
    rules = db.exec(statement).all()

    if not rules:
        for d in DEFAULT_EXTRACTION_RULES_DATA:
            v_types = json.dumps(d.get("valueTypes", [])) if isinstance(d.get("valueTypes"), list) else None
            db_rule = ExtractionRule(
                rule_id=str(d.get("id")),
                name=str(d.get("name")),
                description=d.get("description"),
                method=d.get("method", "pattern"),
                pattern=d.get("pattern"),
                prefix=d.get("prefix"),
                valueType=d.get("valueType"),
                valueTypes=v_types,
                lengthMode=d.get("lengthMode", "variable"),
                minLength=d.get("minLength", 1),
                maxLength=d.get("maxLength", 25),
                constantLength=d.get("constantLength", 8),
                keyword=d.get("keyword"),
                result_label=d.get("result_label"),
                target_placeholder=d.get("target_placeholder"),
                is_active=d.get("is_active", True),
                company_id=company_id,
            )
            db.add(db_rule)
        db.commit()
        rules = db.exec(statement).all()

    result = []
    for r in rules:
        rule_dict = {
            "id": r.rule_id,
            "name": r.name,
            "description": r.description,
            "method": r.method,
            "pattern": r.pattern,
            "prefix": r.prefix,
            "valueType": r.valueType,
            "valueTypes": json.loads(r.valueTypes) if r.valueTypes else [r.valueType] if r.valueType else [],
            "lengthMode": r.lengthMode,
            "minLength": r.minLength,
            "maxLength": r.maxLength,
            "constantLength": r.constantLength,
            "keyword": r.keyword,
            "result_label": r.result_label,
            "target_placeholder": r.target_placeholder,
            "is_active": r.is_active,
        }
        result.append(rule_dict)

    return result


def save_company_rules(db: Session, company_id: int, rules_data: List[dict]) -> List[dict]:
    statement = select(ExtractionRule).where(ExtractionRule.company_id == company_id)
    existing = db.exec(statement).all()
    for e in existing:
        db.delete(e)
    db.commit()

    for d in rules_data:
        v_types = json.dumps(d.get("valueTypes", [])) if isinstance(d.get("valueTypes"), list) else None
        db_rule = ExtractionRule(
            rule_id=str(d.get("id", f"rule_{d.get('name', 'custom')}")),
            name=str(d.get("name", "Custom Rule")),
            description=d.get("description"),
            method=d.get("method", "pattern"),
            pattern=d.get("pattern"),
            prefix=d.get("prefix"),
            valueType=d.get("valueType"),
            valueTypes=v_types,
            lengthMode=d.get("lengthMode", "variable"),
            minLength=d.get("minLength", 1),
            maxLength=d.get("maxLength", 25),
            constantLength=d.get("constantLength", 8),
            keyword=d.get("keyword"),
            result_label=d.get("result_label"),
            target_placeholder=d.get("target_placeholder"),
            is_active=d.get("is_active", True),
            company_id=company_id,
        )
        db.add(db_rule)

    db.commit()
    return get_company_rules(db, company_id)


def reset_company_rules(db: Session, company_id: int) -> List[dict]:
    return save_company_rules(db, company_id, DEFAULT_EXTRACTION_RULES_DATA)


def get_rules() -> List[dict]:
    return DEFAULT_EXTRACTION_RULES_DATA


def save_rules(rules: List[dict]) -> List[dict]:
    global DEFAULT_EXTRACTION_RULES_DATA
    DEFAULT_EXTRACTION_RULES_DATA = rules
    return DEFAULT_EXTRACTION_RULES_DATA

