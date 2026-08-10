import json
import ssl
import urllib.request
import hashlib
from sqlalchemy import false
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from typing import List, TypedDict

CLOUD_BLOB_URL = "https://jsonblob.com/api/jsonBlob/019fea6b-fb22-75ae-81fc-afcedcb15781"


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


def get_cloud_store() -> dict:
    try:
        ctx = ssl._create_unverified_context()
        req = urllib.request.Request(
            CLOUD_BLOB_URL,
            headers={"User-Agent": "Mozilla/5.0", "Accept": "application/json"}
        )
        with urllib.request.urlopen(req, context=ctx, timeout=4) as res:
            if res.status == 200:
                data = json.loads(res.read().decode("utf-8"))
                if isinstance(data, dict):
                    return data
    except Exception as e:
        print("Cloud read fallback:", e)
    return {}


def save_cloud_store(data: dict) -> bool:
    try:
        ctx = ssl._create_unverified_context()
        req = urllib.request.Request(
            CLOUD_BLOB_URL,
            data=json.dumps(data).encode("utf-8"),
            headers={"User-Agent": "Mozilla/5.0", "Content-Type": "application/json"},
            method="PUT"
        )
        with urllib.request.urlopen(req, context=ctx, timeout=4) as res:
            return res.status in (200, 201, 204)
    except Exception as e:
        print("Cloud write fallback:", e)
        return False


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

        cloud = get_cloud_store()
        cloud_agents = cloud.get("agents", [])

        authenticated = False
        for agent in admin_agents:
            expected_hash = agent.pin or hash_pin("0000")
            for ca in cloud_agents:
                if ca.get("agent_initials") == agent.agent_initials and ca.get("pin"):
                    expected_hash = ca["pin"]
                    break

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
  { "agent": "System Admin", "agent_name": "Sys_Admin", "agent_initials": "SA", "is_admin": True, "pin": "0000" },
]


def sync_default_data_if_needed(session: Session) -> None:
    # Seed or update default agents while preserving customized PINs
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
        local_tpls = session.exec(select(Template).order_by(col(Template.updated_at).desc())).all()
        cloud = get_cloud_store()
        cloud_tpls = cloud.get("templates", [])

        if cloud_tpls:
            local_ids = {t.id for t in local_tpls if t.id}
            modified = False
            now = datetime.now(timezone.utc)
            for ct in cloud_tpls:
                if ct.get("id") and ct["id"] not in local_ids:
                    t_obj = Template(
                        id=ct["id"],
                        name=ct["name"],
                        body=ct["body"],
                        category_type=ct.get("category_type", "customer_reply"),
                        category=ct.get("category"),
                        subcategory=ct.get("subcategory"),
                        created_at=now,
                        updated_at=now,
                    )
                    session.add(t_obj)
                    modified = True
            if modified:
                try:
                    session.commit()
                except Exception:
                    session.rollback()
            return session.exec(select(Template).order_by(col(Template.updated_at).desc())).all()

        return local_tpls


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
        return existing


@app.delete("/templates/{template_id}", dependencies=[Depends(require_admin)])
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

        return {
            "status": "success",
            "removed_count": len(to_delete),
            "remaining_count": len(seen),
            "message": f"Cleaned duplicates: Removed {len(to_delete)} duplicate template(s)",
        }


# Helper to sync agent list to Cloud Store
def sync_agents_to_cloud(session: Session):
    try:
        all_agents = session.exec(select(Agent).order_by(col(Agent.id).asc())).all()
        cloud = get_cloud_store()
        cloud["agents"] = [
            {
                "id": a.id,
                "agent": a.agent,
                "agent_name": a.agent_name,
                "agent_initials": a.agent_initials,
                "is_admin": a.is_admin,
                "pin": a.pin if (a.pin and len(a.pin) == 64) else hash_pin(a.pin or "0000"),
            }
            for a in all_agents
        ]
        save_cloud_store(cloud)
    except Exception as e:
        print("Cloud agent sync error:", e)


# Agent endpoints
@app.get("/agents", response_model=List[AgentRead])
def list_agents():
    with Session(engine) as session:
        local_agents = session.exec(select(Agent).order_by(col(Agent.id).asc())).all()
        cloud = get_cloud_store()
        cloud_agents = cloud.get("agents", [])

        if cloud_agents:
            cloud_by_initials = {ca["agent_initials"]: ca for ca in cloud_agents if ca.get("agent_initials")}
            modified = False
            for la in local_agents:
                if la.agent_initials in cloud_by_initials:
                    ca = cloud_by_initials[la.agent_initials]
                    if ca.get("pin") and la.pin != ca["pin"]:
                        la.pin = ca["pin"]
                        session.add(la)
                        modified = True
                    if "is_admin" in ca and la.is_admin != ca["is_admin"]:
                        la.is_admin = ca["is_admin"]
                        session.add(la)
                        modified = True
            if modified:
                try:
                    session.commit()
                except Exception:
                    session.rollback()
            return session.exec(select(Agent).order_by(col(Agent.id).asc())).all()

        return local_agents


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
        sync_agents_to_cloud(session)
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
        sync_agents_to_cloud(session)
        return existing


@app.delete("/agents/{agent_id}", dependencies=[Depends(require_admin)])
def delete_agent(agent_id: int):
    with Session(engine) as session:
        existing = session.get(Agent, agent_id)
        if not existing:
            raise HTTPException(status_code=404, detail="Agent not found")
        session.delete(existing)
        session.commit()
        sync_agents_to_cloud(session)
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

        expected_hash = agent.pin or hash_pin("0000")
        cloud = get_cloud_store()
        cloud_agents = cloud.get("agents", [])
        for ca in cloud_agents:
            if ca.get("agent_initials") == agent.agent_initials and ca.get("pin"):
                expected_hash = ca["pin"]
                break

        if verify_pin_hash(req.pin, expected_hash):
            hashed_input = hash_pin(req.pin)
            if agent.pin != hashed_input:
                agent.pin = hashed_input
                session.add(agent)
                try: session.commit()
                except Exception: session.rollback()
            token = generate_admin_token(agent.agent_initials, expected_hash)
            return {"valid": True, "agent": agent, "token": token}
        else:
            return {"valid": False, "detail": "Incorrect 4-digit Security PIN"}


# --- SUGGESTION ENDPOINTS ---

@app.get("/suggestions", response_model=List[SuggestionRead])
def get_suggestions():
    with Session(engine) as session:
        statement = select(Suggestion).order_by(col(Suggestion.created_at).desc())
        local_sugs = session.exec(statement).all()

        cloud = get_cloud_store()
        cloud_sugs = cloud.get("suggestions", [])

        if cloud_sugs:
            local_ids = {s.id for s in local_sugs if s.id}
            modified = False
            now = datetime.now(timezone.utc)
            for cs in cloud_sugs:
                if cs.get("id") and cs["id"] not in local_ids:
                    s_obj = Suggestion(
                        id=cs["id"],
                        name=cs["name"],
                        body=cs["body"],
                        category_type=cs.get("category_type", "customer_reply"),
                        category=cs.get("category"),
                        subcategory=cs.get("subcategory"),
                        suggested_by_name=cs.get("suggested_by_name", "Support Agent"),
                        suggested_by_initials=cs.get("suggested_by_initials", "SA"),
                        status=cs.get("status", "pending"),
                        created_at=now,
                        updated_at=now,
                    )
                    session.add(s_obj)
                    modified = True
            if modified:
                try:
                    session.commit()
                except Exception:
                    session.rollback()
            return session.exec(select(Suggestion).order_by(col(Suggestion.created_at).desc())).all()

        return local_sugs


@app.post("/suggestions", response_model=SuggestionRead)
def create_suggestion(payload: SuggestionCreate):
    with Session(engine) as session:
        suggestion = Suggestion.model_validate(payload)
        session.add(suggestion)
        session.commit()
        session.refresh(suggestion)

        # Sync with Cloud Store for Vercel multi-instance persistence
        cloud = get_cloud_store()
        curr_list = cloud.get("suggestions", [])
        s_dict = {
            "id": suggestion.id,
            "name": suggestion.name,
            "body": suggestion.body,
            "category_type": suggestion.category_type,
            "category": suggestion.category,
            "subcategory": suggestion.subcategory,
            "suggested_by_name": suggestion.suggested_by_name,
            "suggested_by_initials": suggestion.suggested_by_initials,
            "status": suggestion.status,
            "created_at": suggestion.created_at.isoformat(),
            "updated_at": suggestion.updated_at.isoformat(),
        }
        cloud["suggestions"] = [s_dict] + [s for s in curr_list if s.get("id") != suggestion.id]
        save_cloud_store(cloud)

        return suggestion


@app.post("/suggestions/{suggestion_id}/approve", response_model=TemplateRead, dependencies=[Depends(require_admin)])
def approve_suggestion(suggestion_id: int):
    with Session(engine) as session:
        sug = session.get(Suggestion, suggestion_id)
        if not sug:
            cloud = get_cloud_store()
            cloud_sugs = cloud.get("suggestions", [])
            target = next((s for s in cloud_sugs if s.get("id") == suggestion_id), None)
            if not target:
                raise HTTPException(status_code=404, detail="Suggestion not found")
            sug = Suggestion(
                id=target["id"],
                name=target["name"],
                body=target["body"],
                category_type=target.get("category_type", "customer_reply"),
                category=target.get("category"),
                subcategory=target.get("subcategory"),
                suggested_by_name=target.get("suggested_by_name", "Support Agent"),
                suggested_by_initials=target.get("suggested_by_initials", "SA"),
                status="pending",
            )
            session.add(sug)
            session.commit()
            session.refresh(sug)

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

        # Update cloud store so all Vercel instances see the approved template and updated suggestion status!
        cloud = get_cloud_store()
        cloud_sugs = cloud.get("suggestions", [])
        for cs in cloud_sugs:
            if cs.get("id") == suggestion_id:
                cs["status"] = "approved"
                cs["updated_at"] = datetime.now(timezone.utc).isoformat()

        cloud_tpls = cloud.get("templates", [])
        tpl_dict = {
            "id": new_tpl.id,
            "name": new_tpl.name,
            "body": new_tpl.body,
            "category_type": new_tpl.category_type,
            "category": new_tpl.category,
            "subcategory": new_tpl.subcategory,
            "created_at": new_tpl.created_at.isoformat(),
            "updated_at": new_tpl.updated_at.isoformat(),
        }
        cloud["suggestions"] = cloud_sugs
        cloud["templates"] = [tpl_dict] + [t for t in cloud_tpls if t.get("id") != new_tpl.id]
        save_cloud_store(cloud)

        return new_tpl


@app.post("/suggestions/{suggestion_id}/reject", response_model=SuggestionRead, dependencies=[Depends(require_admin)])
def reject_suggestion(suggestion_id: int):
    with Session(engine) as session:
        sug = session.get(Suggestion, suggestion_id)
        if not sug:
            cloud = get_cloud_store()
            cloud_sugs = cloud.get("suggestions", [])
            target = next((s for s in cloud_sugs if s.get("id") == suggestion_id), None)
            if not target:
                raise HTTPException(status_code=404, detail="Suggestion not found")
            sug = Suggestion(
                id=target["id"],
                name=target["name"],
                body=target["body"],
                category_type=target.get("category_type", "customer_reply"),
                category=target.get("category"),
                subcategory=target.get("subcategory"),
                suggested_by_name=target.get("suggested_by_name", "Support Agent"),
                suggested_by_initials=target.get("suggested_by_initials", "SA"),
                status="rejected",
            )
            session.add(sug)
            session.commit()
            session.refresh(sug)
        else:
            sug.status = "rejected"
            sug.updated_at = datetime.now(timezone.utc)
            session.add(sug)
            session.commit()
            session.refresh(sug)

        cloud = get_cloud_store()
        cloud_sugs = cloud.get("suggestions", [])
        for cs in cloud_sugs:
            if cs.get("id") == suggestion_id:
                cs["status"] = "rejected"
                cs["updated_at"] = datetime.now(timezone.utc).isoformat()
        cloud["suggestions"] = cloud_sugs
        save_cloud_store(cloud)

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
        local_list = [f.template_id for f in favs]

        cloud = get_cloud_store()
        cloud_favs = cloud.get("favorites", {}).get(initials, [])
        if cloud_favs:
            return list(dict.fromkeys(local_list + cloud_favs))
        return local_list


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
        fav_list = [f.template_id for f in all_favs]

        cloud = get_cloud_store()
        if "favorites" not in cloud:
            cloud["favorites"] = {}
        cloud["favorites"][initials] = fav_list
        save_cloud_store(cloud)

        return fav_list


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

        cloud = get_cloud_store()
        cloud_hist = cloud.get("history", {}).get(initials, {})
        c_counts = cloud_hist.get("counts", {})
        c_recents = cloud_hist.get("recents", [])

        for tid_str, count in c_counts.items():
            try:
                tid = int(tid_str)
                counts[tid] = max(counts.get(tid, 0), count)
            except Exception:
                pass

        if c_recents and not recents:
            recents = c_recents

        return {"counts": counts, "recents": recents}


@app.post("/history/{agent_initials}/{template_id}")
def record_agent_copy_history(agent_initials: str, template_id: int):
    with Session(engine) as session:
        initials = agent_initials.upper()
        entry = UsageHistory(agent_initials=initials, template_id=template_id)
        session.add(entry)
        session.commit()

        cloud = get_cloud_store()
        if "history" not in cloud:
            cloud["history"] = {}
        if initials not in cloud["history"]:
            cloud["history"][initials] = {"counts": {}, "recents": []}

        h_data = cloud["history"][initials]
        c_map = h_data.get("counts", {})
        t_key = str(template_id)
        c_map[t_key] = (c_map.get(t_key) or 0) + 1

        r_list = [r for r in h_data.get("recents", []) if r.get("templateId") != template_id]
        new_recents = [{"templateId": template_id, "timestamp": int(datetime.now(timezone.utc).timestamp() * 1000)}] + r_list

        h_data["counts"] = c_map
        h_data["recents"] = new_recents[:30]
        cloud["history"][initials] = h_data
        save_cloud_store(cloud)

    return {"ok": True}



