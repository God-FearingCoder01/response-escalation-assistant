import re
from typing import Dict, Any, List, Optional, Tuple

def validate_extraction_pattern(pattern: str) -> Dict[str, Any]:
    """
    Validates a bracketed pattern string like 'MP[260831].[1923].T7382831'.
    Rejects unmatched brackets, empty brackets, and nested brackets.
    """
    if not pattern or not isinstance(pattern, str):
        return {"is_valid": False, "error": "Pattern string is required."}

    in_bracket = False
    current_token = ""
    segments = []
    extractions = []

    for char in pattern:
        if char == "[":
            if in_bracket:
                return {"is_valid": False, "error": "Nested brackets are not allowed"}
            if current_token:
                segments.append({"type": "literal", "value": current_token})
                current_token = ""
            in_bracket = True
        elif char == "]":
            if not in_bracket:
                return {"is_valid": False, "error": "Unmatched closing bracket ']'"}
            if not current_token.strip():
                return {"is_valid": False, "error": "Empty extraction bracket '[]'"}
            idx = len(extractions)
            extractions.append({"index": idx, "sample_val": current_token})
            segments.append({"type": "extraction", "value": current_token, "index": idx})
            current_token = ""
            in_bracket = False
        else:
            current_token += char

    if in_bracket:
        return {"is_valid": False, "error": "Unmatched opening bracket '['"}

    if current_token:
        segments.append({"type": "literal", "value": current_token})

    if not extractions:
        return {
            "is_valid": False,
            "error": "Please wrap at least one extracted substring in [square brackets].",
        }

    return {
        "is_valid": True,
        "segments": segments,
        "extractions": extractions,
    }


def extract_values_from_pattern(pattern: str, input_value: str) -> List[str]:
    """
    Dynamically extracts matching substrings from input_value based on pattern.
    """
    if not pattern or not input_value:
        return []

    validation = validate_extraction_pattern(pattern)
    if not validation["is_valid"]:
        return []

    def build_regex(relax_literal_numbers=False):
        regex_str = "^"
        for seg in validation["segments"]:
            if seg["type"] == "literal":
                esc = re.escape(seg["value"])
                if relax_literal_numbers:
                    esc = re.sub(r"\d+", r"\\d+", esc)
                regex_str += esc
            elif seg["type"] == "extraction":
                sample = seg["value"].strip()
                if sample.isdigit():
                    regex_str += f"(\\d{{{len(sample)}}})"
                elif sample.isalnum():
                    regex_str += r"([A-Za-z0-9_-]+)"
                else:
                    regex_str += r"(.+?)"
        regex_str += "$"
        return regex_str

    try:
        trimmed_input = input_value.strip()

        # Attempt 1: Strict match
        m1 = re.match(build_regex(False), trimmed_input)
        if m1:
            return list(m1.groups())

        # Attempt 2: Relax literal numbers
        m2 = re.match(build_regex(True), trimmed_input)
        if m2:
            return list(m2.groups())

        # Attempt 3: Flexible fallback regex
        fallback_regex = "^"
        for seg in validation["segments"]:
            if seg["type"] == "literal":
                fallback_regex += re.sub(r"\d+", r".+", re.escape(seg["value"]))
            else:
                fallback_regex += r"(.+?)"
        fallback_regex += "$"
        m3 = re.match(fallback_regex, trimmed_input)
        if m3:
            return list(m3.groups())

        return []
    except Exception:
        return []


def transform_extracted_value(
    raw_value: str, config: Dict[str, Any], target_control_type: str = "text"
) -> str:
    """
    Transforms extracted substring into formatted output string based on date/time format rules.
    """
    if raw_value is None:
        return ""
    str_val = str(raw_value).strip()
    if not str_val:
        return ""

    transform_type = config.get("transform_type", "none")

    if transform_type == "none":
        return str_val

    if transform_type == "date":
        input_fmt = config.get("date_input_format", "YYMMDD")
        output_fmt = config.get("date_output_format", "YYYY-MM-DD")

        year, month, day = "", "", ""

        if input_fmt == "YYMMDD" and len(str_val) >= 6 and str_val.isdigit():
            year = "20" + str_val[:2]
            month = str_val[2:4]
            day = str_val[4:6]
        elif input_fmt == "YYYYMMDD" and len(str_val) >= 8 and str_val.isdigit():
            year = str_val[:4]
            month = str_val[4:6]
            day = str_val[6:8]
        elif input_fmt == "DDMMYY" and len(str_val) >= 6 and str_val.isdigit():
            day = str_val[:2]
            month = str_val[2:4]
            year = "20" + str_val[4:6]
        elif input_fmt == "DDMMYYYY" and len(str_val) >= 8 and str_val.isdigit():
            day = str_val[:2]
            month = str_val[2:4]
            year = str_val[4:8]
        else:
            m = re.match(r"^(\d{2})[/.\-](\d{2})[/.\-](\d{4})$", str_val)
            if m:
                day, month, year = m.group(1), m.group(2), m.group(3)
            else:
                m_iso = re.match(r"^(\d{4})[/.\-](\d{2})[/.\-](\d{2})$", str_val)
                if m_iso:
                    year, month, day = m_iso.group(1), m_iso.group(2), m_iso.group(3)

        if year and month and day:
            if output_fmt == "YYYY-MM-DD":
                return f"{year}-{month}-{day}"
            elif output_fmt == "DD/MM/YYYY":
                return f"{day}/{month}/{year}"
            elif output_fmt == "DD.MM.YYYY":
                return f"{day}.{month}.{year}"
            elif output_fmt == "YYYY/MM/DD":
                return f"{year}/{month}/{day}"
            return f"{year}-{month}-{day}"

        return str_val

    if transform_type == "time":
        input_fmt = config.get("time_input_format", "HHmm")
        output_fmt = config.get("time_output_format", "HH:mm")

        hours, minutes = "", ""
        if input_fmt == "HHmm" and len(str_val) >= 4 and str_val.isdigit():
            hours = str_val[:2]
            minutes = str_val[2:4]
        elif ":" in str_val:
            parts = str_val.split(":")
            hours = parts[0].zfill(2)
            minutes = parts[1].zfill(2) if len(parts) > 1 else "00"

        if hours and minutes:
            if output_fmt == "HH:mm":
                return f"{hours}:{minutes}"
            elif output_fmt == "HH:mm:ss":
                return f"{hours}:{minutes}:00"
            return f"{hours}:{minutes}"

        return str_val

    return str_val


def process_extractable_fields(
    source_field_key: str, raw_input_value: str, placeholder_configs: Dict[str, Any]
) -> Dict[str, str]:
    """
    Processes extractable field logic at runtime and returns dictionary of updates for target fields.
    """
    if not source_field_key or not raw_input_value or not placeholder_configs:
        return {}

    cfg = placeholder_configs.get(source_field_key, {})
    if not cfg.get("is_extractable") or "extraction_config" not in cfg:
        return {}

    ext_cfg = cfg["extraction_config"]
    pattern = ext_cfg.get("pattern", "")
    extractions = ext_cfg.get("extractions", [])

    if not pattern or not extractions:
        return {}

    extracted_vals = extract_values_from_pattern(pattern, raw_input_value)
    if not extracted_vals:
        return {}

    updates = {}
    for idx, ext in enumerate(extractions):
        if idx < len(extracted_vals):
            raw_val = extracted_vals[idx]
            target_field = ext.get("target_field")
            if target_field:
                target_ctrl = placeholder_configs.get(target_field, {}).get("control_type", "text")
                final_val = transform_extracted_value(raw_val, ext, target_ctrl)
                updates[target_field] = final_val

    return updates
