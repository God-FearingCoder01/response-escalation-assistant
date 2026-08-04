from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from typing import List
from sqlmodel import select

from .database import create_db_and_tables, engine
from .models import Template


app = FastAPI(title="Response Escalation Assistant API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    create_db_and_tables()


@app.get("/templates", response_model=List[Template])
def list_templates():
    with engine.connect() as conn:
        statement = select(Template)
        results = conn.exec(statement).all()
        return results


@app.post("/templates", response_model=Template)
def create_template(t: Template):
    t.id = None
    with engine.begin() as conn:
        conn.add(t)
    return t


@app.get("/templates/{template_id}", response_model=Template)
def get_template(template_id: int):
    with engine.connect() as conn:
        t = conn.get(Template, template_id)
        if not t:
            raise HTTPException(status_code=404, detail="Template not found")
        return t


@app.put("/templates/{template_id}", response_model=Template)
def update_template(template_id: int, incoming: Template):
    with engine.begin() as conn:
        existing = conn.get(Template, template_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Template not found")
        existing.name = incoming.name
        existing.body = incoming.body
        existing.updated_at = incoming.updated_at
        conn.add(existing)
        return existing


@app.delete("/templates/{template_id}")
def delete_template(template_id: int):
    with engine.begin() as conn:
        existing = conn.get(Template, template_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Template not found")
        conn.delete(existing)
    return {"ok": True}


@app.get("/export")
def export_templates():
    with engine.connect() as conn:
        statement = select(Template)
        results = conn.exec(statement).all()
        return results


@app.post("/import")
def import_templates(items: List[Template]):
    with engine.begin() as conn:
        for it in items:
            it.id = None
            conn.add(it)
    return {"imported": len(items)}
