import base64
import binascii
import re
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from backend.security import require_admin, require_agent_session
from backend.services import ai_service
from backend.services.redaction import Redactor

router = APIRouter(tags=["Ask REA"])

MAX_MESSAGE_CHARS = 4000
MAX_TOTAL_CHARS = 16000
MAX_MESSAGES = 12
MAX_HIDE_TERMS = 10
# Screenshots. Vercel rejects request bodies over about 4.5 MB, so the whole request is kept
# well below that; the browser shrinks screenshots before sending (see imageAttachments.js).
MAX_IMAGES = 3
MAX_IMAGE_B64_CHARS = 1_400_000   # about 1 MB of image per screenshot
MAX_TOTAL_IMAGE_B64_CHARS = 3_000_000
_IMAGE_SIGNATURES = {
    "image/png": (b"\x89PNG\r\n\x1a\n",),
    "image/jpeg": (b"\xff\xd8\xff",),
    "image/webp": (b"RIFF",),
}


class AskImage(BaseModel):
    mime: Literal["image/png", "image/jpeg", "image/webp"]
    data: str = Field(min_length=16, max_length=MAX_IMAGE_B64_CHARS)

    @model_validator(mode="after")
    def _check_image(self):
        try:
            raw = base64.b64decode(self.data, validate=True)
        except (binascii.Error, ValueError):
            raise ValueError("An attached screenshot could not be read.")
        if not any(raw.startswith(sig) for sig in _IMAGE_SIGNATURES[self.mime]):
            raise ValueError("An attached file is not a valid image.")
        if self.mime == "image/webp" and raw[8:12] != b"WEBP":
            raise ValueError("An attached file is not a valid image.")
        return self


class AskMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)
    # Only the agent can attach screenshots.
    images: List[AskImage] = Field(default_factory=list, max_length=MAX_IMAGES)

    @model_validator(mode="after")
    def _images_only_from_agent(self):
        if self.images and self.role != "user":
            raise ValueError("Only the agent can attach screenshots.")
        return self


class AskRequest(BaseModel):
    mode: Literal["reply", "advice", "escalation"] = "reply"
    channel: Optional[Literal["chat", "email", "whatsapp", "social"]] = None
    messages: List[AskMessage] = Field(min_length=1, max_length=MAX_MESSAGES)
    # Names (or any other words) the agent wants hidden from the AI provider.
    hide_terms: List[str] = Field(default_factory=list, max_length=MAX_HIDE_TERMS)

    @field_validator("hide_terms")
    @classmethod
    def _clean_terms(cls, terms: List[str]) -> List[str]:
        return [t.strip()[:60] for t in terms if t and len(t.strip()) >= 2]

    @model_validator(mode="after")
    def _check_conversation(self):
        if self.messages[-1].role != "user":
            raise ValueError("The last message must come from the agent.")
        if sum(len(m.content) for m in self.messages) > MAX_TOTAL_CHARS:
            raise ValueError("The conversation is too long. Start a new one.")
        images = [img for m in self.messages for img in m.images]
        if len(images) > MAX_IMAGES:
            raise ValueError(f"You can attach up to {MAX_IMAGES} screenshots.")
        if sum(len(img.data) for img in images) > MAX_TOTAL_IMAGE_B64_CHARS:
            raise ValueError("The screenshots are too large. Use smaller or fewer screenshots.")
        return self


_OPTION_LABEL = re.compile(r"^\s*(?:\*\*)?\s*(?:option|reply|response|version)\s*\d+\s*[:.)-]?\s*(?:\*\*)?\s*", re.IGNORECASE)


def _clean_option(part: str) -> str:
    """Trim an option and drop a leading "Option 2:" label or wrapping quotes if the model added them."""
    text = _OPTION_LABEL.sub("", part.strip()).strip()
    if len(text) > 1 and text[0] in "\"\u201c" and text[-1] in "\"\u201d" and not any(c in text[1:-1] for c in "\"\u201c\u201d"):
        text = text[1:-1].strip()
    return text


@router.get("/ask-rea/status")
def ask_rea_status(_agent: dict = Depends(require_agent_session)):
    return {"enabled": ai_service.is_enabled(), "hourly_limit": ai_service.hourly_limit()}


@router.post("/ask-rea")
def ask_rea(req: AskRequest, agent: dict = Depends(require_agent_session)):
    if not ai_service.is_enabled():
        raise HTTPException(status_code=503, detail="Ask REA is not available right now. Please contact your administrator.")

    allowed, remaining, retry_after = ai_service.consume_quota(agent["company_id"], agent["agent_initials"])
    if not allowed:
        raise HTTPException(
            status_code=429,
            detail="You have reached the hourly limit for Ask REA. Please try again later.",
            headers={"Retry-After": str(retry_after)},
        )

    # One Redactor for the whole conversation so the same customer detail keeps the same
    # placeholder across turns. Only redacted text is ever sent to a provider.
    redactor = Redactor(req.hide_terms)
    # Text is redacted. Screenshots cannot be: the agent is told on screen to cover private
    # details before attaching one.
    safe_messages = []
    for m in req.messages:
        safe = {"role": m.role, "content": redactor.redact(m.content)}
        if m.images:
            safe["images"] = [{"mime": img.mime, "data": img.data} for img in m.images]
        safe_messages.append(safe)
    has_images = any("images" in m for m in safe_messages)
    system = ai_service.build_system_prompt(req.mode, req.channel, has_images=has_images)

    try:
        reply, provider = ai_service.generate(system, safe_messages)
    except ai_service.AIUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    restored = redactor.restore(reply)
    options = (
        [_clean_option(part) for part in restored.split("---OPTION---") if _clean_option(part)]
        if req.mode == "reply"
        else []
    )
    if req.mode == "reply" and len(options) < 2:
        options = [restored]
    return {
        "reply": "\n\n".join(options) if options else restored,
        "options": options,
        "provider": provider,
        "redactions": redactor.summary(),
        "remaining_requests": remaining,
    }


@router.post("/ask-rea/diagnose", dependencies=[Depends(require_admin)])
def ask_rea_diagnose(_agent: dict = Depends(require_agent_session)):
    """Administrators only: try each configured provider once and report why one fails.

    Sends a fixed test sentence (no customer data) and returns, per provider and model,
    whether it answered plus the provider's own short error message. Never returns keys.
    """
    providers = ai_service.configured_providers()
    return {
        "enabled": ai_service.is_enabled(),
        "configured": [ai_service.DISPLAY_NAMES.get(p.name, p.name) for p in providers],
        "results": ai_service.diagnose(),
    }
