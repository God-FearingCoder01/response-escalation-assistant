import re
from typing import Dict, Any, List, Optional, Tuple
from sqlmodel import Session, select
from backend.models import GlobalVariable


def resolve_global_variables_in_text(
    text: str,
    company_id: int,
    session: Optional[Session] = None,
    prefetched_vars: Optional[List[Any]] = None,
) -> Dict[str, Any]:
    """
    Resolves Global Variables ({key}) inside template text for a specific company tenant.
    
    If a referenced Global Variable does not exist, is inactive, or has an empty value,
    it marks the text as partially unresolved and inserts a clear professional warning.
    """
    if not text:
        return {
            "resolved_text": "",
            "unresolved_variables": [],
            "is_fully_resolved": True,
        }

    # Fetch active variables if session provided and prefetched_vars not given
    variables = prefetched_vars
    if variables is None and session is not None:
        variables = session.exec(
            select(GlobalVariable).where(GlobalVariable.company_id == company_id)
        ).all()

    if variables is None:
        variables = []

    # Map variables by key
    vars_by_key = {}
    for v in variables:
        key = getattr(v, "key", "") if hasattr(v, "key") else v.get("key", "")
        if key:
            vars_by_key[key.lower()] = v

    unresolved = []
    
    # Regex to find all bracket placeholders like {live_chat}
    matches = re.finditer(r"\{([a-zA-Z0-9_]+)\}", text)
    resolved_text = text

    # Process replacements
    for match in matches:
        placeholder = match.group(0)  # e.g. "{live_chat}"
        key = match.group(1).lower()  # e.g. "live_chat"

        if key in vars_by_key:
            v_obj = vars_by_key[key]
            is_active = getattr(v_obj, "is_active", True) if hasattr(v_obj, "is_active") else v_obj.get("is_active", True)
            val = getattr(v_obj, "value", "") if hasattr(v_obj, "value") else v_obj.get("value", "")

            if is_active and val is not None and str(val).strip() != "":
                resolved_text = resolved_text.replace(placeholder, str(val))
            else:
                unresolved_reason = "inactive" if not is_active else "empty"
                unresolved.append({"key": key, "placeholder": placeholder, "reason": unresolved_reason})
                warning_label = f"⚠️ Reusable info unavailable [{key}]"
                resolved_text = resolved_text.replace(placeholder, warning_label)

    return {
        "resolved_text": resolved_text,
        "unresolved_variables": unresolved,
        "is_fully_resolved": len(unresolved) == 0,
    }
