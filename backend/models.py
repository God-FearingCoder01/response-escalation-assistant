from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class TemplateBase(SQLModel):
    name: str
    body: str
    category_type: str = "tech_escalation"  # "tech_escalation" or "customer_reply"
    category: Optional[str] = None
    subcategory: Optional[str] = None


class Template(TemplateBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=get_utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=get_utc_now, nullable=False)


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(TemplateBase):
    pass


class TemplateRead(TemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime



class AgentBase(SQLModel):
    agent_name: str
    agent: Optional[str] = None
    agent_initials: str
    is_admin: bool = False



class Agent(AgentBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=get_utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=get_utc_now, nullable=False)


class AgentCreate(AgentBase):
    pass


class AgentUpdate(AgentBase):
    pass


class AgentRead(AgentBase):
    id: int
    created_at: datetime
    updated_at: datetime


