from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Database and seed dependencies
from backend.database import engine, ensure_db_initialized, create_db_and_tables, ping_database, get_session
from backend.services.seed_service import sync_default_data_if_needed, DEFAULT_TEMPLATES, DEFAULT_AGENTS, DEFAULT_COMPANY_NAME, DEFAULT_COMPANY_SLUG
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
from backend.routers.extraction import router as extraction_router
from backend.routers.sir import router as sir_router
from backend.routers.agent_data import router as agent_data_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    ensure_db_initialized()
    yield


app = FastAPI(title="Response Escalation Assistant API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
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
app.include_router(extraction_router)
app.include_router(sir_router)
app.include_router(agent_data_router)
