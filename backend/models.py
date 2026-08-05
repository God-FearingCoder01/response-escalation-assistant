from datetime import datetime
from typing import Optional

from sqlmodel import Field, SQLModel


class TemplateBase(SQLModel):
    name: str
    body: str


class Template(TemplateBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    created_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    updated_at: datetime = Field(default_factory=datetime.utcnow, nullable=False)


class TemplateCreate(TemplateBase):
    pass


class TemplateUpdate(TemplateBase):
    pass


class TemplateRead(TemplateBase):
    id: int
    created_at: datetime
    updated_at: datetime
