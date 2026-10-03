import re
from typing import List, Dict, Any, Optional
from backend.models import ExtractionRule


def validate_extracted_value(val: str, pattern: str) -> bool:
    """
    Validates if an extracted value matches the configured regex pattern or is non-empty.
    """
    if not val or not val.strip():
        return False
    if not pattern:
        return True
    try:
        match = re.search(pattern, val, re.IGNORECASE)
        return bool(match)
    except Exception:
        return True


def evaluate_rule_pattern(pattern: str, test_input: str) -> Dict[str, Any]:
    """
    Evaluates an extraction rule pattern against sample input text without saving.
    """
    if not pattern:
        return {"matched": False, "value": None, "error": "Pattern cannot be empty"}
    if not test_input:
        return {"matched": False, "value": None, "error": "Test input cannot be empty"}

    try:
        regex = re.compile(pattern, re.IGNORECASE | re.MULTILINE)
        match = regex.search(test_input)
        if match:
            extracted_val = match.group(1) if match.groups() else match.group(0)
            return {
                "matched": True,
                "value": extracted_val.strip(),
                "error": None
            }
        else:
            return {
                "matched": False,
                "value": None,
                "error": "No match found for pattern"
            }
    except re.error as e:
        return {
            "matched": False,
            "value": None,
            "error": f"Invalid regular expression: {str(e)}"
        }


def process_text_extraction(
    text: str,
    rules: List[ExtractionRule]
) -> List[Dict[str, Any]]:
    """
    Extracts structured values from raw text using company-scoped extraction rules.
    """
    if not text or not rules:
        return []

    results = []
    seen_fields = set()

    for rule in rules:
        if not rule.is_enabled or not rule.pattern:
            continue

        try:
            regex = re.compile(rule.pattern, re.IGNORECASE | re.MULTILINE)
            matches = regex.findall(text)

            if matches:
                # Get first match
                raw_match = matches[0]
                if isinstance(raw_match, tuple):
                    extracted_val = raw_match[0] if raw_match[0] else "".join(raw_match)
                else:
                    extracted_val = raw_match

                val_str = str(extracted_val).strip()

                # Basic validation check
                is_valid = validate_extracted_value(val_str, rule.pattern)

                # Deduplicate by result_field
                field_key = rule.result_field.lower()
                if field_key in seen_fields:
                    continue
                seen_fields.add(field_key)

                results.append({
                    "rule_id": rule.id,
                    "rule_name": rule.name,
                    "result_field": rule.result_field,
                    "value": val_str,
                    "is_valid": is_valid,
                    "confidence": 0.95 if is_valid else 0.60,
                    "warning": None if is_valid else "Extracted value does not fully match rule pattern.",
                })
        except Exception:
            continue

    return results
