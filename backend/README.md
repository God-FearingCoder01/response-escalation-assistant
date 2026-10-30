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
│   └── translator_service.py   # Shona & Ndebele dictionaries & sentence translation engine
├── routers/                    # 11 Modular FastAPI APIRouters
│   ├── health.py               # GET /health (Database health ping & readiness)
│   ├── superadmin.py           # Super Admin authentication, PIN reset & company provisioning
│   ├── templates.py            # Organization template CRUD, import/export & deduplication
│   ├── agents.py               # Agent roster management & 4-digit PIN verification
│   ├── private_notes.py        # Agent-private notes & usage counters
│   ├── suggestions.py          # Template suggestions & admin approval lifecycle
│   ├── support_requests.py     # Public workspace requests & admin resolution workflow
│   ├── favorites_history.py    # Agent template favorites & copy usage history
│   ├── translator.py           # Multilingual Shona/Ndebele response translator
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
- **Bootstrap PINs**: Set private four-digit `SUPERADMIN_BOOTSTRAP_PIN` and `AGENT_BOOTSTRAP_PIN` environment variables before starting the backend. Startup fails if either is missing, malformed, or set to `0000`. Seeded superadmin PINs use the configured value; seeded agent PINs use the configured value and require an immediate PIN change. Legacy `0000` agent PINs are rotated to the agent bootstrap PIN and require a PIN change.
- **PIN protection and CORS**: Set a unique `PIN_PEPPER` (at least 32 random characters) in production. Set `CORS_ALLOWED_ORIGINS` to a comma-separated list of trusted web origins and `CHROME_EXTENSION_ID` to the published extension ID if it calls the API directly.
- **Schema deployment**: Run `npm run db:migrate` (or `python -m alembic upgrade head`) against the target database before deploying backend code. Local development uses the root `.env`; set its database URL and PIN variables, install `backend/requirements.txt`, then run the migration command before `npm run backend`. Requests and `/health` do not create tables, migrate, or seed. Keep `PIN_PEPPER` stable after deployment; changing it requires rotating affected PINs.
- **Automatic Dialect Normalization**: Connection strings starting with `postgres://` are automatically normalized to `postgresql://`.
- **Connection Pooling**: PostgreSQL connections utilize connection pooling (`pool_size=10`, `max_overflow=20`, `pool_recycle=300`, `pool_pre_ping=True`).
- **Versioned Migrations**: Alembic revisions are applied with `python -m alembic upgrade head` before deployment. Schema setup and seed data are not run from request handlers or health checks.

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

- **PIN Security**: PINs are HMAC-peppered with `PIN_PEPPER` before PBKDF2-SHA256. The Alembic deployment migration upgrades plaintext and SHA-256 rows and wraps old PBKDF2 verifiers with the pepper without changing users' PINs. Legacy wrapped PBKDF2 hashes are rehashed to the current scheme at sign-in. Agent tokens carry a `token_version`, never a PIN hash.
- **Rate-Limiting**: PIN verification enforces 5 failed attempts per 15-minute window per client IP/profile pair, so public initials cannot lock out an account from every IP. Failed-attempt increments use an atomic database upsert; Vercel deployments use Vercel's overwritten forwarded-client-IP header.
- **Tenant Context Isolation**: `get_current_company` resolves tenant context strictly from `X-Company-ID` or `X-Company-Slug`. Requests targeting deactivated tenants return `403 Forbidden`.
- **Sanitized PIN Responses**: Administrative PIN resets confirm success without leaking raw credential values.
