import re
from typing import List, Dict, Any, Optional
from backend.models import ExtractionRule


def is_new_balance_context(text: str, start_pos: int) -> bool:
    """
    Checks if the text preceding start_pos (up to 60 characters) contains 'New Balance' or 'New Bal'.
    """
    if start_pos <= 0 or not text:
        return False
    preceding = text[max(0, start_pos - 60):start_pos]
    return bool(re.search(r'new\s*bal(?:ance)?\b', preceding, re.IGNORECASE))


def clean_extracted_value(val: str, field_key: str = "") -> str:
    """
    Cleans and normalizes extracted values.
    For amount fields, strips currency symbols and labels (e.g. $, USD, US$) to leave strictly numerals.
    """
    if not val:
        return val
    cleaned = str(val).strip()
    fk = field_key.lower().strip()

    if "amount" in fk or "price" in fk or "cost" in fk or "sum" in fk:
        # Strip leading currency symbols/words ($ / USD / US$)
        cleaned = re.sub(r'^(?:USD|\$|US\$|\s)+', '', cleaned, flags=re.IGNORECASE)
        # Strip trailing currency symbols/words ($ / USD / US$)
        cleaned = re.sub(r'(?:USD|\$|US\$|\s)+$', '', cleaned, flags=re.IGNORECASE)

    return cleaned.strip()


def validate_extracted_value(val: str, pattern: str) -> bool:
    """
    Validates if an extracted value matches the configured regex pattern or is non-empty.
    Allows cleaned numeric amounts even if original pattern required explicit $ or USD prefixes.
    """
    if not val or not str(val).strip():
        return False
    if not pattern:
        return True
    try:
        if re.search(pattern, val, re.IGNORECASE):
            return True
        # If val was cleaned of currency symbols ($/USD), test pattern without mandatory currency requirement
        pattern_without_currency = re.sub(r'\\?\$|USD\s*|\bUSD\b', '', pattern, flags=re.IGNORECASE)
        if re.search(pattern_without_currency, val, re.IGNORECASE):
            return True
        if re.match(r'^\d+(?:\.\d{1,4})?$', val.strip()):
            return True
        return False
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
            raw_val = match.group(1) if match.groups() else match.group(0)
            cleaned_val = clean_extracted_value(raw_val.strip(), "amount" if "amount" in pattern.lower() else "")
            return {
                "matched": True,
                "value": cleaned_val,
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


def align_reference_number_and_amount_results(results: List[Dict[str, Any]], text: str) -> List[Dict[str, Any]]:
    """
    Ensures that for every reference_number extracted, there is a corresponding amount aligned by position in text.
    Filters out pseudo-amount matches that are actually substrings of reference numbers (e.g. '260831.11' inside 'MP260831.1111.T1111111').
    """
    if not results or not text:
        return results

    ref_result = next((r for r in results if "reference" in r.get("result_field", "").lower() or "tx" in r.get("result_field", "").lower()), None)
    amt_result = next((r for r in results if "amount" in r.get("result_field", "").lower() or "price" in r.get("result_field", "").lower()), None)

    if not ref_result or not amt_result:
        return results

    ref_vals = ref_result.get("all_values") or [ref_result["value"]]
    amt_vals = amt_result.get("all_values") or [amt_result["value"]]

    if not ref_vals or not amt_vals:
        return results

    # Filter out amount matches that are substrings of any reference number
    clean_amt_vals = [a for a in amt_vals if not any(a in r for r in ref_vals)]
    if not clean_amt_vals:
        clean_amt_vals = amt_vals

    # Positional tracking in text
    ref_pos = []
    for r_val in ref_vals:
        idx = text.find(r_val)
        ref_pos.append({"val": r_val, "idx": idx if idx != -1 else 0})

    amt_pos = []
    for a_val in clean_amt_vals:
        idx = text.find(a_val)
        amt_pos.append({"val": a_val, "idx": idx if idx != -1 else 0})

    ref_pos.sort(key=lambda x: x["idx"])

    aligned_amounts = []
    used_amt_indices = set()

    for r_item in ref_pos:
        best_dist = float('inf')
        best_idx = -1

        for a_idx, a_item in enumerate(amt_pos):
            dist = a_item["idx"] - r_item["idx"]
            if dist < 0:
                dist = abs(dist) + 500  # Penalty for amount appearing before reference number
            if dist < best_dist and a_idx not in used_amt_indices:
                best_dist = dist
                best_idx = a_idx

        if best_idx != -1:
            used_amt_indices.add(best_idx)
            aligned_amounts.append(amt_pos[best_idx]["val"])
        else:
            aligned_amounts.append(clean_amt_vals[0])

    ref_result["all_values"] = [r["val"] for r in ref_pos]
    ref_result["value"] = ref_result["all_values"][0]

    amt_result["all_values"] = aligned_amounts
    amt_result["value"] = amt_result["all_values"][0]

    return results


def process_text_extraction(
    text: str,
    rules: List[ExtractionRule]
) -> List[Dict[str, Any]]:
    """
    Extracts structured values from raw text using company-scoped extraction rules.
    Excludes amount values preceded by 'New Balance:' and strips currency symbols ($/USD) from amounts.
    Aligns every reference_number with its corresponding amount.
    """
    if not text or not rules:
        return []

    results = []
    seen_fields = set()

    for rule in rules:
        if not rule.is_enabled or not rule.pattern:
            continue

        field_key = rule.result_field.lower().strip()
        is_amount = "amount" in field_key or "amount" in rule.name.lower()

        try:
            regex = re.compile(rule.pattern, re.IGNORECASE | re.MULTILINE)
            valid_values = []

            for match in regex.finditer(text):
                if is_amount and is_new_balance_context(text, match.start()):
                    continue
                raw_match = match.group(1) if match.groups() and match.group(1) else match.group(0)
                cleaned = clean_extracted_value(raw_match, field_key)
                if cleaned and cleaned not in valid_values:
                    valid_values.append(cleaned)

            if valid_values:
                val_str = valid_values[0]

                # Basic validation check
                is_valid = validate_extracted_value(val_str, rule.pattern)

                # Deduplicate by result_field
                if field_key in seen_fields:
                    continue
                seen_fields.add(field_key)

                results.append({
                    "rule_id": rule.id,
                    "rule_name": rule.name,
                    "result_field": rule.result_field,
                    "value": val_str,
                    "all_values": valid_values,
                    "is_valid": is_valid,
                    "confidence": 0.95 if is_valid else 0.60,
                    "warning": None if is_valid else "Extracted value does not fully match rule pattern.",
                })
        except Exception:
            continue

    results = align_reference_number_and_amount_results(results, text)
    return results

