from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.database import engine
from backend.services.seed_service import sync_default_data_if_needed

# Database and seed dependencies
from backend.security import (
    hash_pin,
    verify_pin_hash,
    generate_admin_token,
    verify_admin_token,
    require_admin,
    get_current_company,
    check_pin_rate_limit,
    record_failed_pin_attempt,
    clear_pin_attempts,
    PinVerifyRequest,
)
from backend.models import (
    Company,
    CompanyCreate,
    CompanyRead,
    CompanyUpdate,
    Agent,
    AgentCreate,
    AgentRead,
    AgentUpdate,
    Template,
    TemplateCreate,
    TemplateRead,
    TemplateUpdate,
    Suggestion,
    SuggestionCreate,
    SuggestionRead,
    SuggestionUpdate,
    Favorite,
    UsageHistory,
    SuperAdmin,
    SuperAdminRead,
    SupportRequest,
    SupportRequestCreate,
    SupportRequestRead,
    SupportRequestUpdate,
    ShiftConfig,
    ShiftConfigCreate,
    ShiftConfigRead,
    ShiftConfigUpdate,
    EscalationTarget,
    EscalationTargetCreate,
    EscalationTargetRead,
    ShiftIssue,
    ShiftIssueCreate,
    ShiftIssueRead,
    ShiftIssueUpdate,
    PrivateNote,
    PrivateNoteCreate,
    PrivateNoteRead,
    PrivateNoteUpdate,
    AgentUserData,
    AgentUserDataRead,
)

# Import APIRouters
from backend.routers.health import router as health_router
from backend.routers.superadmin import router as superadmin_router
from backend.routers.templates import router as templates_router
from backend.routers.agents import router as agents_router
from backend.routers.private_notes import router as private_notes_router
from backend.routers.suggestions import router as suggestions_router
from backend.routers.support_requests import router as support_requests_router
from backend.routers.favorites_history import router as favorites_history_router
from backend.routers.translator import router as translator_router
from backend.routers.sir import router as sir_router
from backend.routers.agent_data import router as agent_data_router
from backend.routers.global_variables import router as global_variables_router
from backend.routers.extraction_rules import router as extraction_rules_router
from backend.routers.timetables import router as timetables_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(title="Response Escalation Assistant API", lifespan=lifespan)

_default_cors_origins = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
    "https://response-escalation-assistant.vercel.app",
]
_configured_cors_origins = [
    origin.strip().rstrip("/")
    for origin in os.environ.get("CORS_ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]
_extension_id = os.environ.get("CHROME_EXTENSION_ID", "").strip()
if _extension_id:
    _configured_cors_origins.append(f"chrome-extension://{_extension_id}")

app.add_middleware(
    CORSMiddleware,
    allow_origins=list(dict.fromkeys(_default_cors_origins + _configured_cors_origins)),
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount APIRouters
app.include_router(health_router)
app.include_router(superadmin_router)
app.include_router(templates_router)
app.include_router(agents_router)
app.include_router(private_notes_router)
app.include_router(suggestions_router)
app.include_router(support_requests_router)
app.include_router(favorites_history_router)
app.include_router(translator_router)
app.include_router(sir_router)
app.include_router(agent_data_router)
app.include_router(global_variables_router)
app.include_router(extraction_rules_router)
app.include_router(timetables_router)

