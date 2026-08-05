from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select

try:
    from .database import create_db_and_tables, engine
    from .models import (
        Agent,
        AgentCreate,
        AgentRead,
        AgentUpdate,
        Template,
        TemplateCreate,
        TemplateRead,
        TemplateUpdate,
    )
except ImportError:
    from database import create_db_and_tables, engine
    from models import (
        Agent,
        AgentCreate,
        AgentRead,
        AgentUpdate,
        Template,
        TemplateCreate,
        TemplateRead,
        TemplateUpdate,
    )


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

DEFAULT_AGENTS = [
    {"agent_name": "Sarah Smith", "agent_initials": "SS", "is_admin": False},
    {"agent_name": "John Doe", "agent_initials": "JD", "is_admin": False},
    {"agent_name": "Alex Vance", "agent_initials": "AV", "is_admin": False},
    {"agent_name": "System Admin", "agent_initials": "SA", "is_admin": True},
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


def seed_default_agents_if_empty(session: Session) -> None:
    has_agents = session.exec(select(Agent.id).limit(1)).first() is not None
    if has_agents:
        return

    now = datetime.now(timezone.utc)
    for item in DEFAULT_AGENTS:
        session.add(
            Agent(
                agent_name=item["agent_name"],
                agent_initials=item["agent_initials"],
                is_admin=item["is_admin"],
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
        seed_default_agents_if_empty(session)
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
        seed_default_agents_if_empty(session)
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


# Agent endpoints
@app.get("/agents", response_model=List[AgentRead])
def list_agents():
    with Session(engine) as session:
        return session.exec(select(Agent).order_by(Agent.id.asc())).all()


@app.post("/agents", response_model=AgentRead)
def create_agent(agent: AgentCreate):
    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        db_agent = Agent(
            agent_name=agent.agent_name,
            agent_initials=agent.agent_initials.upper(),
            is_admin=agent.is_admin,
            created_at=now,
            updated_at=now,
        )
        session.add(db_agent)
        session.commit()
        session.refresh(db_agent)
        return db_agent


@app.put("/agents/{agent_id}", response_model=AgentRead)
def update_agent(agent_id: int, incoming: AgentUpdate):
    with Session(engine) as session:
        existing = session.get(Agent, agent_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Agent not found")
        existing.agent_name = incoming.agent_name
        existing.agent_initials = incoming.agent_initials.upper()
        existing.is_admin = incoming.is_admin
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing


@app.delete("/agents/{agent_id}")
def delete_agent(agent_id: int):
    with Session(engine) as session:
        existing = session.get(Agent, agent_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Agent not found")
        session.delete(existing)
        session.commit()
    return {"ok": True, "message": "Agent deleted"}
