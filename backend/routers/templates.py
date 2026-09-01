from datetime import datetime, timezone
from typing import List
from fastapi import APIRouter, HTTPException, Depends
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
