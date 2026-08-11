import os
import hashlib
import json
from pathlib import Path
from sqlalchemy import false
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, TypedDict


def hash_pin(pin: str) -> str:
    if not pin:
        pin = "0000"
    clean_pin = pin.strip()
    salt = "rea_admin_pin_salt_v1"
    return hashlib.sha256(f"{salt}:{clean_pin}".encode("utf-8")).hexdigest()


def verify_pin_hash(pin: str, stored_hash: str | None) -> bool:
    if not pin:
        return False
    clean_pin = pin.strip()
    if not stored_hash or stored_hash == "0000":
        return clean_pin == "0000" or hash_pin(clean_pin) == hash_pin("0000")
    if len(stored_hash) == 64:
        return hash_pin(clean_pin) == stored_hash
    return clean_pin == stored_hash


def generate_admin_token(agent_initials: str, pin_hash: str) -> str:
    salt = "rea_admin_session_salt_v1"
    return hashlib.sha256(f"{salt}:{agent_initials}:{pin_hash}".encode("utf-8")).hexdigest()


from pydantic import BaseModel
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from sqlmodel import Session, select, col

class PinVerifyRequest(BaseModel):
    agent_initials: str
    pin: str


def require_admin(
    x_admin_token: str | None = Header(None, alias="X-Admin-Token"),
    x_admin_initials: str | None = Header(None, alias="X-Admin-Initials"),
    x_admin_pin: str | None = Header(None, alias="X-Admin-PIN"),
):
    token_str = x_admin_token if isinstance(x_admin_token, str) else None
    initials_str = x_admin_initials if isinstance(x_admin_initials, str) else None
    pin_str = x_admin_pin if isinstance(x_admin_pin, str) else None

    if not token_str and not pin_str:
        raise HTTPException(
            status_code=401,
            detail="Admin authorization required: missing X-Admin-Token or X-Admin-PIN header",
        )

    with Session(engine) as session:
        admin_agents = session.exec(select(Agent).where(Agent.is_admin == True)).all()
        if not admin_agents:
            raise HTTPException(status_code=403, detail="No admin profile configured")

        if initials_str:
            filtered = [a for a in admin_agents if a.agent_initials.upper() == initials_str.upper()]
            if filtered:
                admin_agents = filtered

        authenticated = False
        for agent in admin_agents:
            expected_hash = agent.pin or hash_pin("0000")

            if token_str and token_str == generate_admin_token(agent.agent_initials, expected_hash):
                authenticated = True
                break

            if pin_str and verify_pin_hash(pin_str, expected_hash):
                authenticated = True
                break

        if not authenticated:
            raise HTTPException(status_code=403, detail="Invalid or expired admin authorization credentials")


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
]


CLOUD_STORE_FILE = Path("/tmp/cloud_store.json") if (os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME")) else (Path(__file__).resolve().parent / "cloud_store.json")


def get_cloud_store() -> dict:
    try:
        if CLOUD_STORE_FILE.exists():
            with open(CLOUD_STORE_FILE, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        print("Error reading cloud store:", e)
    return {}


def save_cloud_store(cloud: dict) -> None:
    try:
        CLOUD_STORE_FILE.parent.mkdir(parents=True, exist_ok=True)
        with open(CLOUD_STORE_FILE, "w", encoding="utf-8") as f:
            json.dump(cloud, f, ensure_ascii=False, indent=2)
    except Exception as e:
        print("Error saving cloud store:", e)


# Helper to sync template list to Cloud Store
def sync_templates_to_cloud(session: Session):
    try:
        all_tpls = session.exec(select(Template).order_by(col(Template.id).asc())).all()
        cloud = get_cloud_store()
        cloud["templates"] = [
            {
                "id": t.id,
                "name": t.name,
                "body": t.body,
                "category_type": t.category_type,
                "category": t.category,
                "subcategory": t.subcategory,
                "created_at": t.created_at.isoformat() if t.created_at else None,
                "updated_at": t.updated_at.isoformat() if t.updated_at else None,
            }
            for t in all_tpls
        ]
        save_cloud_store(cloud)
    except Exception as e:
        print("Cloud template sync error:", e)


def sync_default_data_if_needed(session: Session) -> None:
    now = datetime.now(timezone.utc)
    # Seed default agents if missing
    for item in DEFAULT_AGENTS:
        existing = session.exec(select(Agent).where(Agent.agent_initials == item["agent_initials"])).first()
        if not existing:
            session.add(
                Agent(
                    agent=item["agent"],
                    agent_name=item["agent_name"],
                    agent_initials=item["agent_initials"],
                    is_admin=item["is_admin"],
                    pin=hash_pin(item["pin"]),
                    created_at=now,
                    updated_at=now,
                )
            )
    session.commit()

    # Seed default templates ONLY IF both local database and cloud store have no templates
    cloud = get_cloud_store()
    cloud_templates = cloud.get("templates", [])
    local_templates = session.exec(select(Template)).all()

    if not local_templates and not cloud_templates:
        for item in DEFAULT_TEMPLATES:
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
        sync_templates_to_cloud(session)



@asynccontextmanager
async def lifespan(app: FastAPI):
    create_db_and_tables()
    with Session(engine) as session:
        sync_default_data_if_needed(session)
    yield


app = FastAPI(title="Response Escalation Assistant API", lifespan=lifespan)


ALLOWED_ORIGINS = [
    "https://response-escalation-assistant.vercel.app",
    "http://localhost:5173",
    "http://localhost:3000",
    "http://127.0.0.1:5173",
    "http://127.0.0.1:3000",
]

env_origins = os.environ.get("ALLOWED_ORIGINS")
if env_origins:
    extra_origins = [o.strip() for o in env_origins.split(",") if o.strip()]
    for eo in extra_origins:
        if eo not in ALLOWED_ORIGINS:
            ALLOWED_ORIGINS.append(eo)

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
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
        local_templates = session.exec(select(Template).order_by(col(Template.updated_at).desc())).all()
        cloud = get_cloud_store()
        cloud_templates = cloud.get("templates", [])

        if cloud_templates:
            local_map = {t.id: t for t in local_templates if t.id}
            modified = False
            now = datetime.now(timezone.utc)
            cloud_ids = set()

            for ct in cloud_templates:
                t_id = ct.get("id")
                if not t_id:
                    continue
                cloud_ids.add(t_id)
                if t_id in local_map:
                    lt = local_map[t_id]
                    if (
                        lt.name != ct.get("name")
                        or lt.body != ct.get("body")
                        or lt.category_type != ct.get("category_type")
                        or lt.category != ct.get("category")
                        or lt.subcategory != ct.get("subcategory")
                    ):
                        lt.name = ct.get("name", lt.name)
                        lt.body = ct.get("body", lt.body)
                        lt.category_type = ct.get("category_type", lt.category_type)
                        lt.category = ct.get("category", lt.category)
                        lt.subcategory = ct.get("subcategory", lt.subcategory)
                        lt.updated_at = now
                        session.add(lt)
                        modified = True
                else:
                    session.add(
                        Template(
                            id=t_id,
                            name=ct.get("name", "Untitled"),
                            body=ct.get("body", ""),
                            category_type=ct.get("category_type", "tech_escalation"),
                            category=ct.get("category"),
                            subcategory=ct.get("subcategory"),
                            created_at=now,
                            updated_at=now,
                        )
                    )
                    modified = True

            for lt in local_templates:
                if lt.id and lt.id not in cloud_ids:
                    session.delete(lt)
                    modified = True

            if modified:
                try:
                    session.commit()
                except Exception:
                    session.rollback()
            return session.exec(select(Template).order_by(col(Template.updated_at).desc())).all()

        return local_templates


@app.post("/templates", response_model=TemplateRead, dependencies=[Depends(require_admin)])
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
        sync_templates_to_cloud(session)
        return db_template


@app.get("/templates/{template_id}", response_model=TemplateRead)
def get_template(template_id: int):
    with Session(engine) as session:
        template = session.get(Template, template_id)
        if not template:
            raise HTTPException(status_code=404, detail="Template not found")
        return template


@app.put("/templates/{template_id}", response_model=TemplateRead, dependencies=[Depends(require_admin)])
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
        sync_templates_to_cloud(session)
        return existing


@app.delete("/templates/{template_id}", dependencies=[Depends(require_admin)])
def delete_template(template_id: int):
    with Session(engine) as session:
        existing = session.get(Template, template_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Template not found")
        session.delete(existing)
        session.commit()
        sync_templates_to_cloud(session)
    return {"ok": True, "message": "Template deleted"}


@app.get("/export", response_model=List[TemplateRead])
def export_templates():
    with Session(engine) as session:
        return session.exec(select(Template).order_by(col(Template.updated_at).desc())).all()


@app.post("/import", dependencies=[Depends(require_admin)])
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
        sync_templates_to_cloud(session)
    return {
        "imported": count,
        "skipped": skipped,
        "message": f"Imported {count} unique template(s) ({skipped} duplicate(s) skipped)",
    }


@app.post("/templates/deduplicate", dependencies=[Depends(require_admin)])
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
        sync_templates_to_cloud(session)

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


@app.post("/agents", response_model=AgentRead, dependencies=[Depends(require_admin)])
def create_agent(agent: AgentCreate):
    with Session(engine) as session:
        now = datetime.now(timezone.utc)
        db_agent = Agent(
            agent=agent.agent,
            agent_name=agent.agent_name,
            agent_initials=agent.agent_initials.upper(),
            is_admin=agent.is_admin,
            pin=hash_pin(agent.pin or "0000"),
            created_at=now,
            updated_at=now,
        )
        session.add(db_agent)
        session.commit()
        session.refresh(db_agent)
        return db_agent


@app.put("/agents/{agent_id}", response_model=AgentRead, dependencies=[Depends(require_admin)])
def update_agent(agent_id: int, incoming: AgentUpdate):
    with Session(engine) as session:
        existing = session.get(Agent, agent_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Agent not found")
        if incoming.agent is not None:
            existing.agent = incoming.agent
        if incoming.agent_name is not None:
            existing.agent_name = incoming.agent_name
        if incoming.agent_initials is not None:
            existing.agent_initials = incoming.agent_initials.upper()
        if incoming.is_admin is not None:
            existing.is_admin = incoming.is_admin
        if incoming.pin:
            existing.pin = hash_pin(incoming.pin)
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing


@app.delete("/agents/{agent_id}", dependencies=[Depends(require_admin)])
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

        agent_read = AgentRead.model_validate(agent)

        if not agent.is_admin:
            return {"valid": True, "agent": agent_read}

        expected_hash = agent.pin or hash_pin("0000")

        if verify_pin_hash(req.pin, expected_hash):
            hashed_input = hash_pin(req.pin)
            if agent.pin != hashed_input:
                agent.pin = hashed_input
                session.add(agent)
                try: session.commit()
                except Exception: session.rollback()
            current_hash = agent.pin or hashed_input
            token = generate_admin_token(agent.agent_initials, current_hash)
            return {"valid": True, "agent": agent_read, "token": token}
        else:
            return {"valid": False, "detail": "Incorrect 4-digit Security PIN"}


# --- SUGGESTION ENDPOINTS ---

@app.get("/suggestions", response_model=List[SuggestionRead])
def get_suggestions():
    with Session(engine) as session:
        return session.exec(select(Suggestion).order_by(col(Suggestion.created_at).desc())).all()


@app.post("/suggestions", response_model=SuggestionRead)
def create_suggestion(payload: SuggestionCreate):
    with Session(engine) as session:
        suggestion = Suggestion.model_validate(payload)
        session.add(suggestion)
        session.commit()
        session.refresh(suggestion)
        return suggestion


@app.post("/suggestions/{suggestion_id}/approve", response_model=TemplateRead, dependencies=[Depends(require_admin)])
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
        sync_templates_to_cloud(session)
        return new_tpl


@app.post("/suggestions/{suggestion_id}/reject", response_model=SuggestionRead, dependencies=[Depends(require_admin)])
def reject_suggestion(suggestion_id: int):
    with Session(engine) as session:
        sug = session.get(Suggestion, suggestion_id)
        if not sug:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        sug.status = "rejected"
        sug.updated_at = datetime.now(timezone.utc)
        session.add(sug)
        session.commit()
        session.refresh(sug)
        return sug


@app.delete("/suggestions/{suggestion_id}", dependencies=[Depends(require_admin)])
def delete_suggestion(suggestion_id: int):
    with Session(engine) as session:
        sug = session.get(Suggestion, suggestion_id)
        if not sug:
            raise HTTPException(status_code=404, detail="Suggestion not found")
        sug.status = "rejected"
        sug.updated_at = datetime.now(timezone.utc)
        session.add(sug)
        session.commit()
    return {"ok": True, "message": "Suggestion status updated to rejected"}


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



