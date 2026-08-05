from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List

# pyrefly: ignore [missing-import]
from fastapi import FastAPI, HTTPException
# pyrefly: ignore [missing-import]
from fastapi.middleware.cors import CORSMiddleware
# pyrefly: ignore [missing-import]
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
    # Tech Escalation Templates
    {
        "name": "Self Exclusion Request",
        "body": "Account {customer_name} is requesting to be removed from self exclusion. #{agent_name}",
        "category_type": "tech_escalation",
        "category": "Account Escalations",
        "subcategory": "Self Exclusion",
    },
    {
        "name": "Account Verification Error 146",
        "body": "Account {account_number} is facing error code 146, kindly assist. #{agent_name}",
        "category_type": "tech_escalation",
        "category": "Account Escalations",
        "subcategory": "Verification",
    },
    {
        "name": "Permanent Deactivation Request",
        "body": "User {account_number} has requested for the permanent deactivation of his account because {reason}. #{agent_name}",
        "category_type": "tech_escalation",
        "category": "Account Escalations",
        "subcategory": "Deactivation",
    },
    {
        "name": "Withdrawal Processing Escalation",
        "body": "Processing withdrawal of ${amount} from account number {account_number}; on {day}.{month}.2026 time {time}hrs. #{agent_name}",
        "category_type": "tech_escalation",
        "category": "Payment Escalations",
        "subcategory": "Withdrawal",
    },
    # Customer Reply Templates
    {
        "name": "Standard Welcome Greeting",
        "body": "Hi {customer_name}, my name is {agent_name} from Customer Support. How may I assist you today?",
        "category_type": "customer_reply",
        "category": "Agent Introductions",
        "subcategory": "Welcome",
    },
    {
        "name": "Follow-up Response Greeting",
        "body": "Hello {customer_name}, thank you for reaching back out. I'm {agent_name} and I'll be glad to continue assisting you.",
        "category_type": "customer_reply",
        "category": "Agent Introductions",
        "subcategory": "Follow-up",
    },
    {
        "name": "Deposit Under Review",
        "body": "Hi {customer_name}, your deposit of ${amount} is currently being processed by our financial partner. Reference: {reference_no}.",
        "category_type": "customer_reply",
        "category": "Transactions",
        "subcategory": "Deposit",
    },
    {
        "name": "Withdrawal Status Update",
        "body": "Hi {customer_name}, your withdrawal request for ${amount} (Ref: {reference_no}) has been approved and sent to your account.",
        "category_type": "customer_reply",
        "category": "Transactions",
        "subcategory": "Withdrawal",
    },
    {
        "name": "Password Reset Instructions",
        "body": "Hi {customer_name}, a password reset link has been dispatched to your registered email address. Please follow the instructions to secure your account.",
        "category_type": "customer_reply",
        "category": "Security",
        "subcategory": "Password Reset",
    },
    {
        "name": "KYC Document Request",
        "body": "Hi {customer_name}, to complete your account verification, please upload your proof of ID and address in the portal.",
        "category_type": "customer_reply",
        "category": "Security",
        "subcategory": "Verification",
    },
    {
        "name": "Game Cache Troubleshooting",
        "body": "Hi {customer_name}, if you're experiencing display issues with {game_title}, please clear your browser cache or switch to Google Chrome.",
        "category_type": "customer_reply",
        "category": "Games",
        "subcategory": "Troubleshooting",
    },
]

DEFAULT_AGENTS = [
    {"agent": "Vuyo Ndlovu", "agent_name": "Vuyo", "agent_initials": "VN", "is_admin": False},
    {"agent": "Kilian D", "agent_name": "Kilian", "agent_initials": "KD", "is_admin": False},
    {"agent": "Thembi Sibanda", "agent_name": "Thembi", "agent_initials": "TS", "is_admin": False},
    {"agent": "Kudzi Honde", "agent_name": "Kudzi", "agent_initials": "KH", "is_admin": False},
    {"agent": "System Admin", "agent_name": "System Admin", "agent_initials": "SA", "is_admin": True},
]


def sync_default_data_if_needed(session: Session) -> None:
    # 1. Purge old sample agents if they exist
    old_agents = session.exec(
        select(Agent).where(Agent.agent_name.in_(["Sarah Smith", "John Doe", "Alex Vance"]))
    ).all()
    for a in old_agents:
        session.delete(a)
    session.commit()

    # 2. Seed or update user's default agents
    now = datetime.now(timezone.utc)
    for item in DEFAULT_AGENTS:
        existing = session.exec(select(Agent).where(Agent.agent_initials == item["agent_initials"])).first()
        if existing:
            existing.agent = item["agent"]
            existing.agent_name = item["agent_name"]
            existing.is_admin = item["is_admin"]
            existing.updated_at = now
            session.add(existing)
        else:
            session.add(
                Agent(
                    agent=item["agent"],
                    agent_name=item["agent_name"],
                    agent_initials=item["agent_initials"],
                    is_admin=item["is_admin"],
                    created_at=now,
                    updated_at=now,
                )
            )
    session.commit()

    # 3. Seed or update user's default templates
    for item in DEFAULT_TEMPLATES:
        existing = session.exec(select(Template).where(Template.name == item["name"])).first()
        if existing:
            existing.body = item["body"]
            existing.category_type = item["category_type"]
            existing.category = item.get("category")
            existing.subcategory = item.get("subcategory")
            existing.updated_at = now
            session.add(existing)
        else:
            session.add(
                Template(
                    name=item["name"],
                    body=item["body"],
                    category_type=item["category_type"],
                    category=item.get("category"),
                    subcategory=item.get("subcategory"),
                    created_at=now,
                    updated_at=now,
                )
            )
    session.commit()



@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    with Session(engine) as session:
        sync_default_data_if_needed(session)
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
            category_type=template.category_type,
            category=template.category,
            subcategory=template.subcategory,
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
        existing.category_type = incoming.category_type
        existing.category = incoming.category
        existing.subcategory = incoming.subcategory
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
                    category_type=item.category_type,
                    category=item.category,
                    subcategory=item.subcategory,
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
            agent=agent.agent,
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
        existing.agent = incoming.agent
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

