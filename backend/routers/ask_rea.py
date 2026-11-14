from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field, field_validator, model_validator

from backend.security import require_agent_session
from backend.services import ai_service
from backend.services.redaction import Redactor

router = APIRouter(tags=["Ask REA"])

MAX_MESSAGE_CHARS = 4000
MAX_TOTAL_CHARS = 16000
MAX_MESSAGES = 12
MAX_HIDE_TERMS = 10


class AskMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(min_length=1, max_length=MAX_MESSAGE_CHARS)


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
        return self


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
    safe_messages = [{"role": m.role, "content": redactor.redact(m.content)} for m in req.messages]
    system = ai_service.build_system_prompt(req.mode, req.channel)

    try:
        reply, provider = ai_service.generate(system, safe_messages)
    except ai_service.AIUnavailable as exc:
        raise HTTPException(status_code=503, detail=str(exc))

    return {
        "reply": redactor.restore(reply),
        "provider": provider,
        "redactions": redactor.summary(),
        "remaining_requests": remaining,
    }
