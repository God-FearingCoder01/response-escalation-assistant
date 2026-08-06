from sqlalchemy import false
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, TypedDict


from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, col

class PinVerifyRequest(BaseModel):
    agent_initials: str
    pin: str


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
    from backend.database import create_db_and_tables, engine
    from backend.models import (
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
    "name": "Self Exclusion",
    "body": "Account {account_number} is requesting to be removed from self exclusion. ",
    "category_type": "tech_escalation",
    "category": "",
    "subcategory": "",
  },
  {
    "name": "Account Verification",
    "body": "Account {account_number} is facing error code 146, kindly assist. ",
    "category_type": "tech_escalation",
    "category": "",
    "subcategory": "",
  },
  {
    "name": "Permanent Deactivation",
    "body": "User {account_number} has requested for the permanent deactivation of his account because {reason}. ",
    "category_type": "tech_escalation",
    "category": "",
    "subcategory": "",
  },
  {
    "name": "Processing Withdrawal",
    "body": "Processing withdrawal of ${amount} from account number {account_number}; on {day}.{month}.{year} time {time}hrs. ",
    "category_type": "tech_escalation",
    "category": "",
    "subcategory": "",
  },
  # Customer Reply Templates
  {
    "name": "General Introduction",
    "body": "Hello and welcome to WinBucks. My name is {agent_name}. How may I help you today?",
    "category_type": "customer_reply",
    "category": "Agent Introductions",
    "subcategory": "General",
  },
  {
    "name": "Ecocash Issues 2",
    "body": "We apologize for the inconvenience and appreciate your patience. \nWe are currently experiencing temporary challenges with EcoCash withdrawals. Our team is actively working with the relevant providers to resolve the issue, and pending transactions are expected to be completed within the next 2 hours. \nWhile the issue is being resolved, we kindly recommend using InnBucks or O'mari for faster and instant transactions where possible. Thank you for your patience and understanding.",
    "category_type": "customer_reply",
    "category": "Transactions",
    "subcategory": "Follow-Ups",
  },
  {
    "name": "Ecocash",
    "body": "To deposit using EcoCash, kindly follow these steps: \n1.	Click Deposit. \n2.	Select EcoCash as your payment method. \n3.	Enter the amount you wish to deposit. \n4.	Click Deposit again to proceed. \n5.	Confirm the payment request on your phone. \n6.	Once the payment is successful, refresh your WinBucks account. \n7.	Check your balance to confirm the funds have been credited.",
    "category_type": "customer_reply",
    "category": "Transactions",
    "subcategory": "Deposit",
  },
  {
    "name": "Withdrawal",
    "body": "NB: We use InnBucks, EcoCash, and O'mari only for withdrawals. \n\nTo withdraw, kindly follow these steps: \n1.	Click the Menu button (☰) in the top-right corner of your screen. \n2.	Select Withdraw. \n3.	Choose your preferred withdrawal method. NB: Always double-check the withdrawal method before confirming the withdrawal. \n4.	Enter the amount you wish to withdraw. \n5.	Click Withdraw to submit your request. \n6.	Refresh your account and wait for a notification confirming the transaction. \n\nNB: Always ensure that you open an account with InnBucks, EcoCash, and O’mari using the same number registered with Winbucks for successful withdrawal in future.\n\nNB: Withdrawal requests of $100 or more will be placed under processing. This allows you to contact us so we can review and finalize your transaction in accordance with our policy.",
    "category_type": "customer_reply",
    "category": "Transactions",
    "subcategory": "How to Withdraw",
  },
  {
    "name": "Password Reset",
    "body": "● Click “Forgot Password” and then follow instructions. \n● If your new Password/Verification is not sent to your phone, kindly remove your Sim Card and insert it in another phone then request for a new code again. \n● To change your Password, click on 3 dots at the Bottom Right corner of your screen and do the following: \n\t○ Select Account \n\t○ Click on change password \n\t○ Follow further instructions.",
    "category_type": "customer_reply",
    "category": "Registration, login, verification, and account access",
    "subcategory": "How to reset your password?",
  },
  {
    "name": "Error 146",
    "body": "If you have received Error Code 146, please know that you need to verify your account. \n\nTo verify your account, please do the following: \n● Take 3 pictures \n\t○ First one while holding your national ID next to your face, with both your face and details on the ID very clear.\n\tNB: not a “selfie” but using the back/rear camera. \n\t○ Second one the front of you ID, with details clearly visible \n\t○ Third one the back of your ID, with details clearly visible \n● Send the pictures together with your phone number registered on WinBucks via WhatsApp on, +263713331227  or +263713331227.",
    "category_type": "customer_reply",
    "category": "Registration, login, verification, and account access",
    "subcategory": "Account Verification",
  },
]

class DefaultAgent(TypedDict):
    agent: str
    agent_name: str
    agent_initials: str
    is_admin: bool
    pin: str


DEFAULT_AGENTS: List[DefaultAgent] = [
   { "agent": "Vuyolwenkosi Ndlovu", "agent_name": "Vuyo", "agent_initials": "VN", "is_admin": False, "pin": "0000" },
  { "agent": "Kilian D", "agent_name": "Kilian", "agent_initials": "KD", "is_admin": False, "pin": "0000" },
  { "agent": "Thembi Sibanda", "agent_name": "Thembie", "agent_initials": "TS", "is_admin": False, "pin": "0000" },
  { "agent": "Kudzi Honde", "agent_name": "Kudzie", "agent_initials": "KH", "is_admin": False, "pin": "0000" },
  { "agent": "System Admin", "agent_name": "Sys_Admin", "agent_initials": "SA", "is_admin": True, "pin": "0000" },
]


def sync_default_data_if_needed(session: Session) -> None:
    # 1. Purge old sample agents if they exist
    old_agents = session.exec(
        select(Agent).where(col(Agent.agent_name).in_(["Vuyo Ndlovu", "Kilian D", "Thembi Sibanda", "Kudzi Honde", "Sys_Admin"]))
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
            if not existing.pin:
                existing.pin = item["pin"]
            existing.updated_at = now
            session.add(existing)
        else:
            session.add(
                Agent(
                    agent=item["agent"],
                    agent_name=item["agent_name"],
                    agent_initials=item["agent_initials"],
                    is_admin=item["is_admin"],
                    pin=item["pin"],
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
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health_check():
    with Session(engine) as session:
        sync_default_data_if_needed(session)
    return {"status": "ok", "message": "Backend is ready"}


@app.get("/templates", response_model=List[TemplateRead])
def list_templates():
    with Session(engine) as session:
        return session.exec(select(Template).order_by(col(Template.updated_at).desc())).all()


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
        return session.exec(select(Template).order_by(col(Template.updated_at).desc())).all()


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
        return session.exec(select(Agent).order_by(col(Agent.id).asc())).all()


@app.post("/agents", response_model=AgentRead)
def create_agent(agent: AgentCreate):
    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        db_agent = Agent(
            agent=agent.agent,
            agent_name=agent.agent_name,
            agent_initials=agent.agent_initials.upper(),
            is_admin=agent.is_admin,
            pin=agent.pin or "0000",
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
        if incoming.pin:
            existing.pin = incoming.pin
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


@app.post("/agents/verify-pin")
def verify_agent_pin(req: PinVerifyRequest):
    with Session(engine) as session:
        agent = session.exec(select(Agent).where(Agent.agent_initials == req.agent_initials.upper())).first()
        if not agent:
            agent = session.exec(select(Agent).where(Agent.is_admin == True)).first()
        if not agent:
            raise HTTPException(status_code=404, detail="Agent profile not found")

        if not agent.is_admin:
            return {"valid": True, "agent": agent}

        expected_pin = agent.pin or "0000"
        if req.pin == expected_pin:
            return {"valid": True, "agent": agent}
        else:
            return {"valid": False, "detail": "Incorrect 4-digit Security PIN"}

