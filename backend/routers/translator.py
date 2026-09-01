from fastapi import APIRouter
from pydantic import BaseModel

from backend.services.translator_service import translate_text

router = APIRouter(tags=["Translator"])


class TranslateRequest(BaseModel):
    text: str
    target_lang: str  # "shona" / "sn" or "ndebele" / "nde"
    source_lang: str | None = "en"


@router.post("/translate")
def handle_translation(req: TranslateRequest):
    translated = translate_text(req.text, req.target_lang)
    provider = "dictionary" if translated != req.text else "backend"
    return {
        "status": "ok",
        "original_text": req.text,
        "translated_text": translated,
        "translatedText": translated,
        "target_lang": req.target_lang,
        "provider": provider,
    }

