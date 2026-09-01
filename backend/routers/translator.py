from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.translator_service import translate_text

router = APIRouter(tags=["Translator"])


class TranslateRequest(BaseModel):
    text: str
    target_lang: str  # "shona" or "ndebele"


@router.post("/translate")
def handle_translation(req: TranslateRequest):
    translated = translate_text(req.text, req.target_lang)
    return {
        "status": "ok",
        "original_text": req.text,
        "translated_text": translated,
        "target_lang": req.target_lang,
    }
