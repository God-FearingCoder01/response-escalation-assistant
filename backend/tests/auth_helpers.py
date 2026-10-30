from sqlmodel import Session, select

from backend.database import engine
from backend.models import Agent
from backend.security import generate_admin_token, generate_agent_token


def get_agent_admin_headers(company_id: int = 1, initials: str = "SA") -> dict[str, str]:
    with Session(engine) as session:
        agent = session.exec(
            select(Agent).where(Agent.company_id == company_id, Agent.agent_initials == initials)
        ).first()
        assert agent is not None, f"Missing test agent {initials} in company {company_id}"
        token = generate_agent_token(agent, company_id)
    return {"X-Agent-Token": token, "X-Company-ID": str(company_id)}


def get_superadmin_headers() -> dict[str, str]:
    return {"X-Admin-Token": generate_admin_token("SUPERADMIN")}
