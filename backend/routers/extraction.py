from typing import List
from fastapi import APIRouter, Depends
from sqlmodel import Session

from backend.database import engine
from backend.models import Company
from backend.security import get_current_company
from backend.services.extraction_service import get_company_rules, save_company_rules

router = APIRouter(tags=["Smart Extraction Rules"])


@router.get("/api/extraction-rules")
@router.get("/extraction-rules")
def get_extraction_rules(company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        return get_company_rules(session, cid)


@router.post("/api/extraction-rules")
@router.post("/extraction-rules")
def save_extraction_rules(rules: List[dict], company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        return save_company_rules(session, cid, rules)
