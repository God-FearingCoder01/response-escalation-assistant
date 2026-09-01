from typing import List
from fastapi import APIRouter

from backend.services.extraction_service import get_rules, save_rules

router = APIRouter(tags=["Smart Extraction Rules"])


@router.get("/api/extraction-rules")
@router.get("/extraction-rules")
def get_extraction_rules():
    return get_rules()


@router.post("/api/extraction-rules")
@router.post("/extraction-rules")
def save_extraction_rules(rules: List[dict]):
    return save_rules(rules)
