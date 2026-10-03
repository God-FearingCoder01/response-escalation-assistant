import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlmodel import Session, select

from backend.database import get_session
from backend.models import (
    Company,
    ExtractionRule,
    ExtractionRuleCreate,
    ExtractionRuleRead,
    ExtractionRuleUpdate,
    get_utc_now,
)
from backend.security import require_admin
from backend.services.extraction_service import (
    process_text_extraction,
    evaluate_rule_pattern,
)

router = APIRouter(prefix="/api/extraction-rules", tags=["Smart Extractor Rules"])
logger = logging.getLogger("rea_extraction_rules")


class RuleTestRequest(BaseModel):
    pattern: str
    test_input: str


class ExtractionProcessRequest(BaseModel):
    company_id: int = 1
    text: str


@router.get("", response_model=List[ExtractionRuleRead])
def get_extraction_rules(
    company_id: int = Query(default=1),
    enabled_only: bool = Query(default=False),
    session: Session = Depends(get_session),
):
    """
    Get all company-scoped extraction rules (tenant-isolated).
    Auto-seeds default rules into database if none exist yet for the company.
    """
    try:
        statement = select(ExtractionRule).where(ExtractionRule.company_id == company_id)
        rules = session.exec(statement).all()

        # If this company tenant has zero extraction rules in DB, seed defaults ONCE if company exists & not yet seeded
        if not rules and not enabled_only:
            from backend.services.seed_service import seed_company_extraction_rules_if_needed
            company_exists = session.get(Company, company_id)
            if company_exists:
                seed_company_extraction_rules_if_needed(session, company_id)
                rules = session.exec(statement).all()

        if enabled_only:
            rules = [r for r in rules if r.is_enabled]

        return sorted(rules, key=lambda x: x.name or "")
    except Exception:
        logger.exception("Failed to load extraction rules for company_id=%s", company_id)
        raise HTTPException(status_code=500, detail="Failed to load extraction rules.")


@router.post("", response_model=ExtractionRuleRead)
def create_extraction_rule(
    rule_in: ExtractionRuleCreate,
    session: Session = Depends(get_session),
    _: bool = Depends(require_admin),
):
    """
    Create a new company-scoped extraction rule (Admin protected).
    """
    if not rule_in.name or not rule_in.result_field or not rule_in.pattern:
        raise HTTPException(status_code=400, detail="Rule name, result field, and pattern are required.")

    clean_result_field = rule_in.result_field.strip().replace("{", "").replace("}", "").lower()
    if not clean_result_field:
        raise HTTPException(status_code=400, detail="Result field key cannot be empty.")

    clean_pattern = rule_in.pattern.strip()
    try:
        import re
        re.compile(clean_pattern)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid regular expression pattern: {str(e)}")

    comp = session.get(Company, rule_in.company_id)
    if not comp:
        comp = session.get(Company, 1)
        if comp and comp.id:
            rule_in.company_id = comp.id
        else:
            comp = session.exec(select(Company)).first()
            if comp and comp.id:
                rule_in.company_id = comp.id
            else:
                raise HTTPException(status_code=400, detail=f"Organization ID {rule_in.company_id} does not exist.")

    # Check for duplicate result_field within same company
    existing = session.exec(
        select(ExtractionRule)
        .where(ExtractionRule.company_id == rule_in.company_id)
        .where(ExtractionRule.result_field == clean_result_field)
    ).first()

    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"An extraction rule for result field '{clean_result_field}' already exists for this organization. You can edit the existing rule instead."
        )

    db_rule = ExtractionRule(
        name=rule_in.name.strip(),
        result_field=clean_result_field,
        extraction_method=rule_in.extraction_method or "regex",
        pattern=clean_pattern,
        description=rule_in.description.strip() if rule_in.description else None,
        is_enabled=rule_in.is_enabled,
        company_id=rule_in.company_id,
        created_at=get_utc_now(),
        updated_at=get_utc_now(),
    )
    session.add(db_rule)
    session.commit()
    session.refresh(db_rule)
    return db_rule


@router.get("/{rule_id}", response_model=ExtractionRuleRead)
def get_extraction_rule(
    rule_id: int,
    company_id: int = Query(default=1),
    session: Session = Depends(get_session),
):
    """
    Get details of a single extraction rule with tenant validation.
    """
    rule = session.get(ExtractionRule, rule_id)
    if not rule or rule.company_id != company_id:
        raise HTTPException(status_code=404, detail="Extraction rule not found.")
    return rule


@router.put("/{rule_id}", response_model=ExtractionRuleRead)
def update_extraction_rule(
    rule_id: int,
    rule_in: ExtractionRuleUpdate,
    company_id: Optional[int] = Query(default=None),
    session: Session = Depends(get_session),
    _: bool = Depends(require_admin),
):
    """
    Update an existing extraction rule (Admin protected).
    """
    db_rule = session.get(ExtractionRule, rule_id)
    if not db_rule:
        raise HTTPException(status_code=404, detail="Extraction rule not found.")

    if company_id is not None and db_rule.company_id != company_id:
        raise HTTPException(status_code=404, detail="Extraction rule not found for this organization.")

    update_data = rule_in.model_dump(exclude_unset=True) if hasattr(rule_in, "model_dump") else rule_in.dict(exclude_unset=True)
    for field, value in update_data.items():
        if field == "result_field" and value:
            clean_field = str(value).strip().replace("{", "").replace("}", "").lower()
            setattr(db_rule, field, clean_field)
        elif field == "name" and value:
            setattr(db_rule, field, str(value).strip())
        elif field == "pattern" and value:
            clean_pat = str(value).strip()
            try:
                import re
                re.compile(clean_pat)
            except Exception as e:
                raise HTTPException(status_code=400, detail=f"Invalid regular expression pattern: {str(e)}")
            setattr(db_rule, field, clean_pat)
        elif value is not None:
            setattr(db_rule, field, value)

    db_rule.updated_at = get_utc_now()
    session.add(db_rule)
    session.commit()
    session.refresh(db_rule)
    return db_rule


@router.delete("/{rule_id}")
def delete_extraction_rule(
    rule_id: int,
    company_id: Optional[int] = Query(default=None),
    session: Session = Depends(get_session),
    _: bool = Depends(require_admin),
):
    """
    Delete an extraction rule (Admin protected).
    """
    db_rule = session.get(ExtractionRule, rule_id)
    if not db_rule:
        raise HTTPException(status_code=404, detail="Extraction rule not found.")

    if company_id is not None and db_rule.company_id != company_id:
        raise HTTPException(status_code=404, detail="Extraction rule not found for this organization.")

    session.delete(db_rule)
    session.commit()
    return {"message": "Extraction rule deleted successfully", "id": rule_id}


@router.post("/test")
def test_extraction_rule(
    req: RuleTestRequest,
    _: bool = Depends(require_admin),
):
    """
    Live test an extraction pattern against sample input text (Admin protected).
    """
    return evaluate_rule_pattern(req.pattern, req.test_input)


@router.post("/process")
def process_text_extraction_endpoint(
    req: ExtractionProcessRequest,
    session: Session = Depends(get_session),
):
    """
    Process input text using all active extraction rules for the given company tenant.
    """
    try:
        rules = session.exec(
            select(ExtractionRule)
            .where(ExtractionRule.company_id == req.company_id)
            .where(ExtractionRule.is_enabled == True)
        ).all()

        if not rules:
            from backend.services.seed_service import get_default_extraction_rules_seed
            rules = get_default_extraction_rules_seed(req.company_id)
            rules = [r for r in rules if r.is_enabled]

        extracted_results = process_text_extraction(req.text, rules)
        return {
            "text": req.text,
            "company_id": req.company_id,
            "rules_applied": len(rules),
            "extracted_count": len(extracted_results),
            "results": extracted_results,
        }
    except Exception:
        from backend.services.seed_service import get_default_extraction_rules_seed
        fallback_rules = get_default_extraction_rules_seed(req.company_id)
        fallback_rules = [r for r in fallback_rules if r.is_enabled]
        extracted_results = process_text_extraction(req.text, fallback_rules)
        return {
            "text": req.text,
            "company_id": req.company_id,
            "rules_applied": len(fallback_rules),
            "extracted_count": len(extracted_results),
            "results": extracted_results,
        }
