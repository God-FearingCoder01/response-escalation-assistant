from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

try:
    from .database import create_db_and_tables, engine
    from .models import Template, TemplateCreate, TemplateRead, TemplateUpdate
except ImportError:
    from database import create_db_and_tables, engine
    from models import Template, TemplateCreate, TemplateRead, TemplateUpdate


DEFAULT_TEMPLATES = [
    {
        "name": "Withdrawal Delay",
        "body": "Hi {customer_name}, your withdrawal {reference_no} is under review. ETA: {eta}.",
    },
    {
        "name": "KYC Pending",
        "body": "Hi {customer_name}, your account verification is still pending. Please upload: {required_docs}.",
    },
    {
        "name": "Bonus Not Received",
        "body": "Hi {customer_name}, we checked your bonus request for promo {promo_code}. Status: {status}.",
    },
]


def seed_default_templates_if_empty(session: Session) -> None:
    has_templates = session.exec(select(Template.id).limit(1)).first() is not None
    if has_templates:
        return

    now = datetime.now(timezone.utc)
    for item in DEFAULT_TEMPLATES:
        session.add(
            Template(
                name=item["name"],
                body=item["body"],
                created_at=now,
                updated_at=now,
            )
        )
    session.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    with Session(engine) as session:
        seed_default_templates_if_empty(session)
    yield


app = FastAPI(title="Response Escalation Assistant API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    with Session(engine) as session:
        seed_default_templates_if_empty(session)
    return {"status": "ok", "message": "Backend is ready"}


@app.get("/templates", response_model=List[TemplateRead])
def list_templates():
    with Session(engine) as session:
        return session.exec(select(Template).order_by(Template.updated_at.desc())).all()


@app.post("/templates", response_model=TemplateRead)
def create_template(template: TemplateCreate):
    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        db_template = Template(
            name=template.name,
            body=template.body,
            created_at=now,
            updated_at=now,
        )
        session.add(db_template)
        session.commit()
        session.refresh(db_template)
        return db_template


@app.get("/templates/{template_id}", response_model=TemplateRead)
def get_template(template_id: int):
    with Session(engine) as session:
        template = session.get(Template, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        return template


@app.put("/templates/{template_id}", response_model=TemplateRead)
def update_template(template_id: int, incoming: TemplateUpdate):
    with Session(engine) as session:
        existing = session.get(Template, template_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Template not found")
        existing.name = incoming.name
        existing.body = incoming.body
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing


@app.delete("/templates/{template_id}")
def delete_template(template_id: int):
    with Session(engine) as session:
        existing = session.get(Template, template_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Template not found")
        session.delete(existing)
        session.commit()
    return {"ok": True, "message": "Template deleted"}


@app.get("/export", response_model=List[TemplateRead])
def export_templates():
    with Session(engine) as session:
        return session.exec(select(Template).order_by(Template.updated_at.desc())).all()


@app.post("/import")
def import_templates(items: List[TemplateCreate]):
    with Session(engine) as session:
        count = 0
        now = datetime.now(timezone.utc)
        for item in items:
            session.add(
                Template(
                    name=item.name,
                    body=item.body,
                    created_at=now,
                    updated_at=now,
                )
            )
            count += 1
        session.commit()
    return {"imported": count, "message": f"Imported {count} template(s)"}

