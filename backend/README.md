# Backend

This FastAPI service uses SQLModel for ORM persistence, running on **PostgreSQL** in production environments and **SQLite** for local development.

Run locally
-----------

Create a virtualenv, install dependencies, and start the API:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

Database Configuration
----------------------

- **Local Development**: By default, local dev uses `backend/backend_data.db` (SQLite).
- **Production Persistence**: Set the `DATABASE_URL` or `POSTGRES_URL` environment variable to point to a managed PostgreSQL database (Neon, Supabase, Vercel Postgres, AWS RDS, etc.).

API
---

- GET `/health` - returns service status and seeds starter templates when needed
- GET `/templates` - list all templates
- POST `/templates` - create a template
- GET `/templates/{id}` - fetch one template
- PUT `/templates/{id}` - update a template
- DELETE `/templates/{id}` - delete a template
- GET `/export` - export templates as JSON
- POST `/import` - import templates from JSON

