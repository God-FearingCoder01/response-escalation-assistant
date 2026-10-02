import re
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select, or_

from backend.database import get_session
from backend.models import (
    GlobalVariable,
    GlobalVariableCreate,
    GlobalVariableRead,
    GlobalVariableUpdate,
    Template,
)

router = APIRouter(prefix="/api", tags=["global-variables"])


class MigrationSearchRequest(BaseModel):
    company_id: int = 1
    search_text: str


class MigrationPreviewRequest(BaseModel):
    company_id: int = 1
    search_text: str
    replace_text: str
    template_ids: List[int]


class MigrationApplyRequest(BaseModel):
    company_id: int = 1
    search_text: str
    replace_text: str
    template_ids: List[int]


def sanitize_variable_key(key: str) -> str:
    """
    Sanitizes key to lowercase alphanumeric with underscores.
    """
    if not key:
        return ""
    clean = key.strip().lower().replace("{", "").replace("}", "")
    clean = re.sub(r"\s+", "_", clean)
    clean = re.sub(r"[^a-z0-9_]", "", clean)
    return clean


@router.get("/global-variables", response_model=List[GlobalVariableRead])
def get_global_variables(
    company_id: int = Query(default=1),
    session: Session = Depends(get_session),
):
    """
    Get all global variables for a specific company (tenant isolation enforced).
    """
    statement = (
        select(GlobalVariable)
        .where(GlobalVariable.company_id == company_id)
        .order_by(GlobalVariable.category.asc(), GlobalVariable.name.asc())
    )
    return session.exec(statement).all()


@router.post("/global-variables", response_model=GlobalVariableRead)
def create_global_variable(
    var_in: GlobalVariableCreate,
    session: Session = Depends(get_session),
):
    """
    Create a new company-scoped global variable.
    """
    if not var_in.name or not var_in.key or var_in.value is None:
        raise HTTPException(status_code=400, detail="Variable name, key, and value are required.")

    clean_key = sanitize_variable_key(var_in.key)
    if not clean_key:
        raise HTTPException(status_code=400, detail="Invalid variable key format.")

    # Check key uniqueness within company
    existing = session.exec(
        select(GlobalVariable)
        .where(GlobalVariable.company_id == var_in.company_id)
        .where(GlobalVariable.key == clean_key)
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"A global variable with key '{{{clean_key}}}' already exists for this organization.",
        )

    var_data = var_in.model_dump()
    var_data["key"] = clean_key

    db_var = GlobalVariable.model_validate(var_data)
    session.add(db_var)
    session.commit()
    session.refresh(db_var)
    return db_var


@router.get("/global-variables/{var_id}", response_model=GlobalVariableRead)
def get_global_variable(
    var_id: int,
    company_id: int = Query(default=1),
    session: Session = Depends(get_session),
):
    """
    Get details of a specific global variable (multi-tenant isolated).
    """
    db_var = session.get(GlobalVariable, var_id)
    if not db_var or db_var.company_id != company_id:
        raise HTTPException(status_code=404, detail="Global variable not found for this company.")
    return db_var


@router.put("/global-variables/{var_id}", response_model=GlobalVariableRead)
def update_global_variable(
    var_id: int,
    var_in: GlobalVariableUpdate,
    company_id: int = Query(default=1),
    session: Session = Depends(get_session),
):
    """
    Update a global variable (multi-tenant isolated).
    """
    db_var = session.get(GlobalVariable, var_id)
    if not db_var or db_var.company_id != company_id:
        raise HTTPException(status_code=404, detail="Global variable not found for this company.")

    update_data = var_in.model_dump(exclude_unset=True)

    if "key" in update_data and update_data["key"]:
        clean_key = sanitize_variable_key(update_data["key"])
        if clean_key != db_var.key:
            # Verify new key doesn't clash
            existing = session.exec(
                select(GlobalVariable)
                .where(GlobalVariable.company_id == company_id)
                .where(GlobalVariable.key == clean_key)
                .where(GlobalVariable.id != var_id)
            ).first()
            if existing:
                raise HTTPException(
                    status_code=400,
                    detail=f"Variable key '{{{clean_key}}}' is already in use.",
                )
            update_data["key"] = clean_key

    for key, val in update_data.items():
        setattr(db_var, key, val)

    session.add(db_var)
    session.commit()
    session.refresh(db_var)
    return db_var


@router.delete("/global-variables/{var_id}")
def delete_global_variable(
    var_id: int,
    company_id: int = Query(default=1),
    force: bool = Query(default=False),
    session: Session = Depends(get_session),
):
    """
    Delete a global variable. Prevents accidental deletion if referenced in templates unless force=True.
    """
    db_var = session.get(GlobalVariable, var_id)
    if not db_var or db_var.company_id != company_id:
        raise HTTPException(status_code=404, detail="Global variable not found for this company.")

    placeholder = f"{{{db_var.key}}}"
    # Check template usage
    usage_templates = session.exec(
        select(Template)
        .where(Template.company_id == company_id)
        .where(Template.body.contains(placeholder))
    ).all()

    if usage_templates and not force:
        raise HTTPException(
            status_code=400,
            detail=f"Variable '{{{db_var.key}}}' is currently referenced in {len(usage_templates)} templates. Deactivate it or use force deletion.",
        )

    session.delete(db_var)
    session.commit()
    return {"message": "Global variable deleted successfully", "id": var_id}


@router.get("/global-variables/{var_id}/usage")
def get_global_variable_usage(
    var_id: int,
    company_id: int = Query(default=1),
    session: Session = Depends(get_session),
):
    """
    Get list of templates currently referencing a global variable.
    """
    db_var = session.get(GlobalVariable, var_id)
    if not db_var or db_var.company_id != company_id:
        raise HTTPException(status_code=404, detail="Global variable not found for this company.")

    placeholder = f"{{{db_var.key}}}"
    usage_templates = session.exec(
        select(Template)
        .where(Template.company_id == company_id)
        .where(Template.body.contains(placeholder))
        .order_by(Template.name.asc())
    ).all()

    return {
        "variable_id": var_id,
        "key": db_var.key,
        "name": db_var.name,
        "usage_count": len(usage_templates),
        "templates": [
            {
                "id": t.id,
                "name": t.name,
                "category_type": t.category_type,
                "category": t.category,
                "subcategory": t.subcategory,
                "body_snippet": (t.body[:120] + "...") if len(t.body) > 120 else t.body,
            }
            for t in usage_templates
        ],
    }


# --- EXISTING TEMPLATE MIGRATION ENDPOINTS ---

@router.post("/global-variables/migration/search")
def search_templates_for_migration(
    req: MigrationSearchRequest,
    session: Session = Depends(get_session),
):
    """
    Search company templates containing exact text or pattern to migrate into a global variable.
    Strictly isolated to req.company_id.
    """
    if not req.search_text or not req.search_text.strip():
        raise HTTPException(status_code=400, detail="Search text is required.")

    query_str = req.search_text.strip()
    
    # Strictly query current tenant templates
    templates = session.exec(
        select(Template)
        .where(Template.company_id == req.company_id)
        .where(Template.body.contains(query_str))
        .order_by(Template.name.asc())
    ).all()

    matches = []
    for t in templates:
        matches.append({
            "id": t.id,
            "name": t.name,
            "category_type": t.category_type,
            "category": t.category,
            "subcategory": t.subcategory,
            "body": t.body,
            "occurrence_count": t.body.count(query_str),
        })

    return {
        "query": query_str,
        "company_id": req.company_id,
        "total_templates": len(matches),
        "matches": matches,
    }


@router.post("/global-variables/migration/preview")
def preview_template_migration(
    req: MigrationPreviewRequest,
    session: Session = Depends(get_session),
):
    """
    Generate side-by-side BEFORE / AFTER transformation previews for selected templates.
    """
    if not req.search_text or not req.replace_text or not req.template_ids:
        return {"previews": [], "total_count": 0}

    search_str = req.search_text
    replace_str = req.replace_text

    templates = session.exec(
        select(Template)
        .where(Template.company_id == req.company_id)
        .where(Template.id.in_(req.template_ids))
    ).all()

    previews = []
    for t in templates:
        if search_str in t.body:
            proposed_body = t.body.replace(search_str, replace_str)
            previews.append({
                "template_id": t.id,
                "name": t.name,
                "category_type": t.category_type,
                "category": t.category,
                "original_body": t.body,
                "proposed_body": proposed_body,
                "has_changes": t.body != proposed_body,
            })

    return {
        "previews": previews,
        "total_count": len(previews),
    }


@router.post("/global-variables/migration/apply")
def apply_template_migration(
    req: MigrationApplyRequest,
    session: Session = Depends(get_session),
):
    """
    Atomically apply global variable replacement to selected tenant templates.
    """
    if not req.search_text or not req.replace_text or not req.template_ids:
        raise HTTPException(status_code=400, detail="Search text, replace text, and template IDs are required.")

    search_str = req.search_text
    replace_str = req.replace_text

    # Execute atomic query & update restricted to req.company_id
    templates = session.exec(
        select(Template)
        .where(Template.company_id == req.company_id)
        .where(Template.id.in_(req.template_ids))
    ).all()

    updated_ids = []
    try:
        for t in templates:
            if search_str in t.body:
                t.body = t.body.replace(search_str, replace_str)
                session.add(t)
                updated_ids.append(t.id)

        session.commit()
        return {
            "success": True,
            "updated_count": len(updated_ids),
            "updated_template_ids": updated_ids,
            "message": f"Successfully updated {len(updated_ids)} template(s).",
        }
    except Exception as e:
        session.rollback()
        raise HTTPException(status_code=500, detail=f"Migration transaction failed: {str(e)}")
