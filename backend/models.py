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
    pin: Optional[str] = "0000"




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


class SuggestionBase(SQLModel):
    name: str
    body: str
    category_type: str = "tech_escalation"  # "tech_escalation" or "customer_reply"
    category: Optional[str] = None
    subcategory: Optional[str] = None
    suggested_by_name: str
    suggested_by_initials: str
    status: str = "pending"  # "pending", "approved", "rejected"


class Suggestion(SuggestionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=get_utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=get_utc_now, nullable=False)


class SuggestionCreate(SuggestionBase):
    pass


class SuggestionUpdate(SQLModel):
    name: Optional[str] = None
    body: Optional[str] = None
    category_type: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    status: Optional[str] = None


class SuggestionRead(SuggestionBase):
    id: int
    created_at: datetime
    updated_at: datetime


class Favorite(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    agent_initials: str = Field(index=True)
    template_id: int = Field(index=True)
    created_at: datetime = Field(default_factory=get_utc_now, nullable=False)


class UsageHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    agent_initials: str = Field(index=True)
    template_id: int = Field(index=True)
    copied_at: datetime = Field(default_factory=get_utc_now, nullable=False)




