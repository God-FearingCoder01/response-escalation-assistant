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
        Suggestion,
        SuggestionCreate,
        SuggestionRead,
        SuggestionUpdate,
        Favorite,
        UsageHistory,
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
        Suggestion,
        SuggestionCreate,
        SuggestionRead,
        SuggestionUpdate,
        Favorite,
        UsageHistory,
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
    "body": "Processing withdrawal of ${amount} from account number {account_number}; on {day}.{month_number}.{year} time {time}hrs. ",
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
        existing = session.exec(
            select(Template).where(
                col(Template.category_type) == template.category_type,
                col(Template.name) == template.name,
                col(Template.category) == template.category,
            )
        ).first()
        if existing:
            raise HTTPException(
                status_code=400,
                detail=f"Template '{template.name}' already exists in this category.",
            )
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
        existing_templates = session.exec(select(Template)).all()
        seen = set(
            (
                (t.category_type or "").strip().lower(),
                (t.category or "").strip().lower(),
                (t.name or "").strip().lower(),
                (t.body or "").strip(),
            )
            for t in existing_templates
        )
        count = 0
        skipped = 0
        now = datetime.now(timezone.utc)
        for item in items:
            key = (
                (item.category_type or "").strip().lower(),
                (item.category or "").strip().lower(),
                (item.name or "").strip().lower(),
                (item.body or "").strip(),
            )
            if key in seen:
                skipped += 1
                continue
            seen.add(key)
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
    return {
        "imported": count,
        "skipped": skipped,
        "message": f"Imported {count} unique template(s) ({skipped} duplicate(s) skipped)",
    }


@app.post("/templates/deduplicate")
def deduplicate_templates():
    with Session(engine) as session:
        all_templates = session.exec(select(Template).order_by(col(Template.id).asc())).all()
        seen = set()
        to_delete = []
        for t in all_templates:
            key = (
                (t.category_type or "").strip().lower(),
                (t.category or "").strip().lower(),
                (t.name or "").strip().lower(),
                (t.body or "").strip(),
            )
            if key in seen:
                to_delete.append(t)
            else:
                seen.add(key)

        for dup in to_delete:
            session.delete(dup)
        session.commit()

        return {
            "status": "success",
            "removed_count": len(to_delete),
            "remaining_count": len(seen),
            "message": f"Cleaned duplicates: Removed {len(to_delete)} duplicate template(s)",
        }


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


# --- SUGGESTION ENDPOINTS ---

@app.get("/suggestions", response_model=List[SuggestionRead])
def get_suggestions():
    with Session(engine) as session:
        statement = select(Suggestion).order_by(col(Suggestion.created_at).desc())
        results = session.exec(statement).all()
        return results


@app.post("/suggestions", response_model=SuggestionRead)
def create_suggestion(payload: SuggestionCreate):
    with Session(engine) as session:
        suggestion = Suggestion.model_validate(payload)
        session.add(suggestion)
        session.commit()
        session.refresh(suggestion)
        return suggestion


@app.post("/suggestions/{suggestion_id}/approve", response_model=TemplateRead)
def approve_suggestion(suggestion_id: int):
    with Session(engine) as session:
        sug = session.get(Suggestion, suggestion_id)
        if not sug:
            raise HTTPException(status_code=404, detail="Suggestion not found")

        new_tpl = Template(
            name=sug.name,
            body=sug.body,
            category_type=sug.category_type,
            category=sug.category,
            subcategory=sug.subcategory,
        )
        session.add(new_tpl)

        sug.status = "approved"
        sug.updated_at = datetime.now(timezone.utc)
        session.add(sug)

        session.commit()
        session.refresh(new_tpl)
        return new_tpl


@app.delete("/suggestions/{suggestion_id}")
def delete_suggestion(suggestion_id: int):
    with Session(engine) as session:
        sug = session.get(Suggestion, suggestion_id)
        if not sug:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        sug.status = "rejected"
        session.delete(sug)
        session.commit()
    return {"ok": True, "message": "Suggestion removed"}


# --- FAVORITES & HISTORY ENDPOINTS ---

@app.get("/favorites/{agent_initials}")
def get_agent_favorites(agent_initials: str):
    with Session(engine) as session:
        initials = agent_initials.upper()
        favs = session.exec(select(Favorite).where(Favorite.agent_initials == initials)).all()
        return [f.template_id for f in favs]


@app.post("/favorites/{agent_initials}/{template_id}")
def toggle_agent_favorite(agent_initials: str, template_id: int):
    with Session(engine) as session:
        initials = agent_initials.upper()
        existing = session.exec(
            select(Favorite).where(
                Favorite.agent_initials == initials,
                Favorite.template_id == template_id
            )
        ).first()

        if existing:
            session.delete(existing)
        else:
            new_fav = Favorite(agent_initials=initials, template_id=template_id)
            session.add(new_fav)

        session.commit()

        all_favs = session.exec(select(Favorite).where(Favorite.agent_initials == initials)).all()
        return [f.template_id for f in all_favs]


@app.get("/history/{agent_initials}")
def get_agent_history(agent_initials: str):
    with Session(engine) as session:
        initials = agent_initials.upper()
        history = session.exec(
            select(UsageHistory)
            .where(UsageHistory.agent_initials == initials)
            .order_by(col(UsageHistory.copied_at).desc())
        ).all()

        counts = {}
        recents = []
        seen = set()

        for h in history:
            counts[h.template_id] = counts.get(h.template_id, 0) + 1
            if h.template_id not in seen:
                seen.add(h.template_id)
                recents.append({
                    "templateId": h.template_id,
                    "timestamp": int(h.copied_at.timestamp() * 1000)
                })

        return {"counts": counts, "recents": recents}


@app.post("/history/{agent_initials}/{template_id}")
def record_agent_copy_history(agent_initials: str, template_id: int):
    with Session(engine) as session:
        initials = agent_initials.upper()
        entry = UsageHistory(agent_initials=initials, template_id=template_id)
        session.add(entry)
        session.commit()
    return {"ok": True}



