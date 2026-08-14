from datetime import datetime, timezone
from typing import Optional

from sqlmodel import Field, SQLModel


def get_utc_now() -> datetime:
    return datetime.now(timezone.utc)


class CompanyBase(SQLModel):
    name: str = Field(index=True)
    slug: str = Field(unique=True, index=True)
    is_active: bool = True


class Company(CompanyBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=get_utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=get_utc_now, nullable=False)


class CompanyCreate(CompanyBase):
    pass


class CompanyUpdate(SQLModel):
    name: Optional[str] = None
    slug: Optional[str] = None
    is_active: Optional[bool] = None


class CompanyRead(CompanyBase):
    id: int
    created_at: datetime
    updated_at: datetime


class TemplateBase(SQLModel):
    name: str
    body: str
    category_type: str = "tech_escalation"  # "tech_escalation" or "customer_reply"
    category: Optional[str] = None
    subcategory: Optional[str] = None
    company_id: int = Field(default=1, foreign_key="company.id", index=True)


class Template(TemplateBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=get_utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=get_utc_now, nullable=False)


class TemplateCreate(TemplateBase):
    company_id: int = 1


class TemplateUpdate(SQLModel):
    name: Optional[str] = None
    body: Optional[str] = None
    category_type: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    company_id: Optional[int] = None


class TemplateRead(TemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime


class AgentBase(SQLModel):
    agent_name: str
    agent: Optional[str] = None
    agent_initials: str
    is_admin: bool = False
    company_id: int = Field(default=1, foreign_key="company.id", index=True)


class Agent(AgentBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    pin: Optional[str] = Field(default=None, nullable=True)
    created_at: datetime = Field(default_factory=get_utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=get_utc_now, nullable=False)


class AgentCreate(AgentBase):
    pin: Optional[str] = "0000"
    company_id: int = 1


class AgentUpdate(SQLModel):
    agent_name: Optional[str] = None
    agent: Optional[str] = None
    agent_initials: Optional[str] = None
    is_admin: Optional[bool] = None
    pin: Optional[str] = None
    company_id: Optional[int] = None


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
    company_id: int = Field(default=1, foreign_key="company.id", index=True)


class Suggestion(SuggestionBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=get_utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=get_utc_now, nullable=False)


class SuggestionCreate(SuggestionBase):
    company_id: int = 1


class SuggestionUpdate(SQLModel):
    name: Optional[str] = None
    body: Optional[str] = None
    category_type: Optional[str] = None
    category: Optional[str] = None
    subcategory: Optional[str] = None
    status: Optional[str] = None
    company_id: Optional[int] = None


class SuggestionRead(SuggestionBase):
    id: int
    created_at: datetime
    updated_at: datetime


class Favorite(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(default=1, foreign_key="company.id", index=True)
    agent_initials: str = Field(index=True)
    template_id: int = Field(index=True)
    created_at: datetime = Field(default_factory=get_utc_now, nullable=False)


class UsageHistory(SQLModel, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    company_id: int = Field(default=1, foreign_key="company.id", index=True)
    agent_initials: str = Field(index=True)
    template_id: int = Field(index=True)
    copied_at: datetime = Field(default_factory=get_utc_now, nullable=False)


class SuperAdminBase(SQLModel):
    email: str = Field(index=True)


class SuperAdmin(SuperAdminBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    pin: str
    reset_token: Optional[str] = None
    created_at: datetime = Field(default_factory=get_utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=get_utc_now, nullable=False)


class SuperAdminRead(SuperAdminBase):
    id: int
    updated_at: datetime


class SupportRequestBase(SQLModel):
    org_name: str
    requester_name: str
    contact_email: str
    request_type: str = "new_org_url"  # "new_org_url", "credential_reset", "technical_support"
    details: str
    status: str = "pending"  # "pending", "resolved"


class SupportRequest(SupportRequestBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=get_utc_now, nullable=False)
    updated_at: datetime = Field(default_factory=get_utc_now, nullable=False)


class SupportRequestCreate(SupportRequestBase):
    pass


class SupportRequestUpdate(SQLModel):
    status: Optional[str] = None


class SupportRequestRead(SupportRequestBase):
    id: int
    created_at: datetime
    updated_at: datetime





