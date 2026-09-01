# REA Backend API Services 🚀

This FastAPI backend service uses **SQLModel** / **SQLAlchemy** for ORM persistence, running on **PostgreSQL** in production environments (`DATABASE_URL` / `POSTGRES_URL`) and falling back to **SQLite** (`backend/backend_data.db`) for local development.

---

## 🏗️ Architecture & Component Design

The backend is structured into modular layers:

```
backend/
├── main.py                     # Light FastAPI app initialization, CORS, and APIRouter mounting
├── database.py                 # Engine configuration, connection pooling, dialect migrations & get_session
├── models.py                   # SQLModel table definitions & Pydantic request/response schemas
├── security.py                 # PIN hashing, rate-limiting, token auth & get_current_company dependency
├── services/                   # Business domain services
│   ├── seed_service.py         # Default organization, starter templates & agent profile seeding
│   ├── translator_service.py   # Shona & Ndebele dictionaries & sentence translation engine
│   └── extraction_service.py   # Smart parameter extraction rules & state management
├── routers/                    # 12 Modular FastAPI APIRouters
│   ├── health.py               # GET /health (Database health ping & readiness)
│   ├── superadmin.py           # Super Admin authentication, PIN reset & company provisioning
│   ├── templates.py            # Organization template CRUD, import/export & deduplication
│   ├── agents.py               # Agent roster management & 4-digit PIN verification
│   ├── private_notes.py        # Agent-private notes & usage counters
│   ├── suggestions.py          # Template suggestions & admin approval lifecycle
│   ├── support_requests.py     # Public workspace requests & admin resolution workflow
│   ├── favorites_history.py    # Agent template favorites & copy usage history
│   ├── translator.py           # Multilingual Shona/Ndebele response translator
│   ├── extraction.py           # Smart parameter extraction rule management
│   ├── sir.py                  # Shift Issue Register (Shifts, Escalation Targets, Shift Issues)
│   └── agent_data.py           # Cross-device agent user data synchronization
└── tests/                      # Pytest automated test package (30 tests)
    ├── test_database.py        # Database URL parsing & ping tests
    ├── test_main.py            # Core app health, auth & CRUD lifecycle tests
    ├── test_multitenancy.py    # Multi-tenant data isolation tests
    ├── test_private_notes.py   # Private notes lifecycle & agent privacy tests
    ├── test_superadmin.py      # Super Admin PIN reset & company management tests
    └── test_tenant_isolation_aggressive.py # Aggressive multi-tenant isolation tests
```

---

## 🗄️ Database Configuration & Dialect Safety

- **Local Development**: When `DATABASE_URL` is omitted, the application uses SQLite at `backend/backend_data.db`.
- **Production Persistence**: Set `DATABASE_URL` (or `POSTGRES_URL`, `POSTGRES_URL_NON_POOLING`) to a PostgreSQL connection string (e.g. Neon, Supabase, Vercel Postgres, AWS RDS).
- **Automatic Dialect Normalization**: Connection strings starting with `postgres://` are automatically normalized to `postgresql://`.
- **Connection Pooling**: PostgreSQL connections utilize connection pooling (`pool_size=10`, `max_overflow=20`, `pool_recycle=300`, `pool_pre_ping=True`).
- **Dialect-Agnostic Migrations**: Column additions check table metadata using SQLAlchemy `inspect(engine)` prior to executing `ALTER TABLE ... ADD COLUMN`, preventing dialect errors across both SQLite and PostgreSQL.

---

## 🧪 Running Automated Tests

Run the full Pytest test suite from the repository root:

```bash
# Activate virtual environment
source .venv/bin/activate  # Or .venv\Scripts\activate on Windows

# Run all 30 backend tests
python -m pytest
```

---

## 🔒 Security & Tenant Isolation

- **PIN Security**: 4-digit PIN credentials are hashed using PBKDF2 with SHA-256 (`PBKDF2_ITERATIONS=100000`).
- **Rate-Limiting**: PIN verification enforces 5 failed attempts per 15-minute sliding window per client IP/agent profile before returning `429 Too Many Requests`.
- **Tenant Context Isolation**: `get_current_company` resolves tenant context strictly from `X-Company-ID` or `X-Company-Slug`. Requests targeting deactivated tenants return `403 Forbidden`.
- **Sanitized PIN Responses**: Administrative PIN resets confirm success without leaking raw credential values.
