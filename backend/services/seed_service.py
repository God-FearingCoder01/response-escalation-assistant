import os
from datetime import datetime, timezone
from typing import List, TypedDict
from sqlmodel import Session, select

from backend.models import (
    Company,
    Agent,
    Template,
    ShiftConfig,
    EscalationTarget,
    SuperAdmin,
)
from backend.security import hash_pin

DEFAULT_COMPANY_NAME = os.environ.get("DEFAULT_COMPANY_NAME", "Default").strip()
DEFAULT_COMPANY_SLUG = os.environ.get("DEFAULT_COMPANY_SLUG", "default").strip().lower()

class DefaultAgent(TypedDict):
    agent: str
    agent_name: str
    agent_initials: str
    is_admin: bool
    pin: str


DEFAULT_AGENTS: List[DefaultAgent] = [
    {"agent": "System Administrator", "agent_name": "Sys_Admin", "agent_initials": "SA", "is_admin": True, "pin": "0000"},
    {"agent": "Chris Whyt", "agent_name": "Chris", "agent_initials": "CW", "is_admin": False, "pin": "0000"},
]

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
        "body": "Hello and welcome. My name is {agent_name}. How may I help you today?",
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
        "body": "To deposit using EcoCash, kindly follow these steps: \n1.	Click Deposit. \n2.	Select EcoCash as your payment method. \n3.	Enter the amount you wish to deposit. \n4.	Click Deposit again to proceed. \n5.	Confirm the payment request on your phone. \n6.	Once the payment is successful, refresh your account. \n7.	Check your balance to confirm the funds have been credited.",
        "category_type": "customer_reply",
        "category": "Transactions",
        "subcategory": "Deposit",
    },
    {
        "name": "Withdrawal",
        "body": "NB: We use InnBucks, EcoCash, and O'mari only for withdrawals. \n\nTo withdraw, kindly follow these steps: \n1.	Click the Menu button (☰) in the top-right corner of your screen. \n2.	Select Withdraw. \n3.	Choose your preferred withdrawal method. NB: Always double-check the withdrawal method before confirming the withdrawal. \n4.	Enter the amount you wish to withdraw. \n5.	Click Withdraw to submit your request. \n6.	Refresh your account and wait for a notification confirming the transaction. \n\nNB: Always ensure that you open an account with InnBucks, EcoCash, and O’mari using the same number registered with our organization for successful withdrawal in future.\n\nNB: Withdrawal requests of $100 or more will be placed under processing. This allows you to contact us so we can review and finalize your transaction in accordance with our policy.",
        "category_type": "customer_reply",
        "category": "Transactions",
        "subcategory": "Withdrawal",
    },
]


def sync_default_data_if_needed(session: Session) -> None:
    now = datetime.now(timezone.utc)
    # 1. Default Company
    default_company = session.exec(select(Company).where(Company.id == 1)).first()
    if not default_company:
        default_company = session.exec(select(Company).where(Company.slug == DEFAULT_COMPANY_SLUG)).first()

    if not default_company:
        default_company = Company(
            id=1,
            name=DEFAULT_COMPANY_NAME,
            slug=DEFAULT_COMPANY_SLUG,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        session.add(default_company)
        session.commit()
        session.refresh(default_company)
    else:
        if default_company.name in ["Corp A", "Default Organization"] or default_company.slug in ["corp-a", "default-organization"]:
            default_company.name = DEFAULT_COMPANY_NAME
            default_company.slug = DEFAULT_COMPANY_SLUG
            session.add(default_company)
            session.commit()

    if default_company.id is None:
        return

    # 2. Seed default agents for default_company (ID #1) ONLY if no agents exist yet
    existing_agents = session.exec(select(Agent).where(Agent.company_id == default_company.id)).all()
    if not existing_agents:
        for item in DEFAULT_AGENTS:
            session.add(
                Agent(
                    agent=item["agent"],
                    agent_name=item["agent_name"],
                    agent_initials=item["agent_initials"],
                    is_admin=item["is_admin"],
                    pin=hash_pin(item["pin"]),
                    company_id=default_company.id,
                    created_at=now,
                    updated_at=now,
                )
            )
        session.commit()

    # 3. Seed default templates for default_company (ID #1) ONLY if no templates exist yet
    existing_templates = session.exec(select(Template).where(Template.company_id == default_company.id)).all()
    if not existing_templates:
        for item in DEFAULT_TEMPLATES:
            session.add(
                Template(
                    name=item["name"],
                    body=item["body"],
                    category_type=item["category_type"],
                    category=item.get("category"),
                    subcategory=item.get("subcategory"),
                    company_id=default_company.id,
                    created_at=now,
                    updated_at=now,
                )
            )
        session.commit()

    # 4. Seed default SIR Shift Configurations and Escalation Targets if none exist
    local_shifts = session.exec(select(ShiftConfig).where(ShiftConfig.company_id == default_company.id)).all()
    if not local_shifts:
        default_shifts = [
            {"name": "Morning Shift", "start_time": "07:00", "end_time": "15:00"},
            {"name": "Afternoon Shift", "start_time": "15:00", "end_time": "23:00"},
            {"name": "Night Shift (Graveyard)", "start_time": "23:00", "end_time": "07:00"},
        ]
        for s in default_shifts:
            session.add(
                ShiftConfig(
                    name=s["name"],
                    start_time=s["start_time"],
                    end_time=s["end_time"],
                    is_active=True,
                    company_id=default_company.id,
                    created_at=now,
                    updated_at=now,
                )
            )
        session.commit()

    local_targets = session.exec(select(EscalationTarget).where(EscalationTarget.company_id == default_company.id)).all()
    if not local_targets:
        default_targets = [
            "Technical Support Team",
            "Billing & Accounts Team",
            "Network Engineering",
            "Level 2 Support Manager",
            "ISP Provider",
        ]
        for t in default_targets:
            session.add(
                EscalationTarget(
                    name=t,
                    company_id=default_company.id,
                    created_at=now,
                    updated_at=now,
                )
            )
        session.commit()

    # 5. Seed default SuperAdmin if not exists
    superadmin = session.exec(select(SuperAdmin)).first()
    if not superadmin:
        session.add(
            SuperAdmin(
                email="gfc.dev@proton.me",
                pin=hash_pin("0000"),
                created_at=now,
                updated_at=now,
            )
        )
        session.commit()
    else:
        if superadmin.email == "admin@support.com":
            superadmin.email = "gfc.dev@proton.me"
            session.add(superadmin)
            session.commit()
