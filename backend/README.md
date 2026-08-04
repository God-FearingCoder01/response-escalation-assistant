# Backend

This FastAPI service stores response templates in SQLite using SQLModel.

Run locally
-----------

Create a virtualenv, install dependencies, and start the API:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt
uvicorn backend.main:app --reload --port 8000
```

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

Notes
-----

The database file is `backend_data.db` in the project root.
For production, switch to a managed database and run the app behind a process manager or container.
