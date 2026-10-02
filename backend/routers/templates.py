from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from sqlmodel import Session, select, col

from backend.database import engine
from backend.models import (
    Company,
    Template,
    TemplateCreate,
    TemplateRead,
    TemplateUpdate,
)
from backend.security import get_current_company, require_admin

router = APIRouter(tags=["Templates"])


class BatchDeletePayload(BaseModel):
    template_ids: List[int]


@router.get("/templates", response_model=List[TemplateRead])
def list_templates(company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        return session.exec(
            select(Template)
            .where(Template.company_id == cid)
            .order_by(col(Template.updated_at).desc())
        ).all()


@router.post("/templates", response_model=TemplateRead, dependencies=[Depends(require_admin)])
def create_template(template: TemplateCreate, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        existing = session.exec(
            select(Template).where(
                col(Template.company_id) == cid,
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
            placeholder_config=template.placeholder_config,
            company_id=cid,
            created_at=now,
            updated_at=now,
        )
        session.add(db_template)
        session.commit()
        session.refresh(db_template)
        return db_template


@router.get("/templates/{template_id}", response_model=TemplateRead)
def get_template(template_id: int, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        template = session.get(Template, template_id)
        if not template or template.company_id != cid:
            raise HTTPException(status_code=404, detail="Template not found")
        return template


@router.put("/templates/{template_id}", response_model=TemplateRead, dependencies=[Depends(require_admin)])
def update_template(template_id: int, incoming: TemplateUpdate, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        existing = session.get(Template, template_id)
        if not existing or existing.company_id != cid:
            raise HTTPException(status_code=404, detail="Template not found")
        if incoming.name is not None:
            existing.name = incoming.name
        if incoming.body is not None:
            existing.body = incoming.body
        if incoming.category_type is not None:
            existing.category_type = incoming.category_type
        if incoming.category is not None:
            existing.category = incoming.category
        if incoming.subcategory is not None:
            existing.subcategory = incoming.subcategory
        if incoming.placeholder_config is not None:
            existing.placeholder_config = incoming.placeholder_config
        existing.updated_at = datetime.now(timezone.utc)
        session.add(existing)
        session.commit()
        session.refresh(existing)
        return existing


@router.delete("/templates/{template_id}", dependencies=[Depends(require_admin)])
def delete_template(template_id: int, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        existing = session.get(Template, template_id)
        if not existing or existing.company_id != cid:
            raise HTTPException(status_code=404, detail="Template not found")
        session.delete(existing)
        session.commit()
    return {"ok": True, "message": "Template deleted"}


@router.post("/templates/batch-delete", dependencies=[Depends(require_admin)])
def batch_delete_templates(payload: BatchDeletePayload, company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        templates_to_delete = session.exec(
            select(Template)
            .where(Template.company_id == cid)
            .where(col(Template.id).in_(payload.template_ids))
        ).all()
        count = len(templates_to_delete)
        for t in templates_to_delete:
            session.delete(t)
        session.commit()
        return {"ok": True, "count": count, "message": f"Deleted {count} template(s)"}


@router.get("/export", response_model=List[TemplateRead])
def export_templates(company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        return session.exec(
            select(Template)
            .where(Template.company_id == cid)
            .order_by(col(Template.updated_at).desc())
        ).all()


@router.post("/import", dependencies=[Depends(require_admin)])
def import_templates(items: List[TemplateCreate], company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        existing_templates = session.exec(
            select(Template).where(Template.company_id == cid)
        ).all()

        seen_bodies = set((t.body or "").replace("\r\n", "\n").strip() for t in existing_templates if (t.body or "").strip())
        seen_name_empty_bodies = set((t.name or "").strip().lower() for t in existing_templates if not (t.body or "").strip() and (t.name or "").strip())

        count = 0
        skipped = 0
        now = datetime.now(timezone.utc)
        for item in items:
            body_key = (item.body or "").replace("\r\n", "\n").strip()
            name_key = (item.name or "").strip().lower()

            is_duplicate = False
            if body_key:
                if body_key in seen_bodies:
                    is_duplicate = True
                else:
                    seen_bodies.add(body_key)
            elif name_key:
                if name_key in seen_name_empty_bodies:
                    is_duplicate = True
                else:
                    seen_name_empty_bodies.add(name_key)

            if is_duplicate:
                skipped += 1
                continue

            session.add(
                Template(
                    name=item.name,
                    body=item.body,
                    category_type=item.category_type,
                    category=item.category,
                    subcategory=item.subcategory,
                    company_id=cid,
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


@router.post("/templates/deduplicate", dependencies=[Depends(require_admin)])
def deduplicate_templates(company: Company = Depends(get_current_company)):
    cid = company.id if company and company.id else 1
    with Session(engine) as session:
        all_templates = session.exec(
            select(Template)
            .where(Template.company_id == cid)
            .order_by(col(Template.id).asc())
        ).all()

        seen_bodies = set()
        seen_name_empty_bodies = set()
        to_delete = []

        for t in all_templates:
            body_key = (t.body or "").replace("\r\n", "\n").strip()
            name_key = (t.name or "").strip().lower()

            if body_key:
                # Deduplicate by template body content (regardless of template name differences)
                if body_key in seen_bodies:
                    to_delete.append(t)
                else:
                    seen_bodies.add(body_key)
            elif name_key:
                # If body is empty, deduplicate by template name
                if name_key in seen_name_empty_bodies:
                    to_delete.append(t)
                else:
                    seen_name_empty_bodies.add(name_key)

        for dup in to_delete:
            session.delete(dup)
        session.commit()

        remaining_count = len(seen_bodies) + len(seen_name_empty_bodies)
        return {
            "status": "success",
            "removed_count": len(to_delete),
            "remaining_count": remaining_count,
            "message": f"Cleaned duplicates: Removed {len(to_delete)} duplicate template(s)",
        }
