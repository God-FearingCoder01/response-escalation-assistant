# Backend (FastAPI + SQLite)

This is a minimal FastAPI backend using SQLite (via SQLModel) to store templates.

Run locally
---------

Create a virtualenv, install deps and run uvicorn:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

API
---

- GET `/templates` — list templates
- POST `/templates` — create template (send JSON matching the Template model)
- GET `/templates/{id}` — get single template
- PUT `/templates/{id}` — update template
- DELETE `/templates/{id}` — delete template
- GET `/export` — export templates as JSON
- POST `/import` — import templates JSON

Notes
-----

This is intentionally simple and stores data in `backend_data.db` in the project root. For production, consider using a managed Postgres/MySQL database and running with a process manager or container.
