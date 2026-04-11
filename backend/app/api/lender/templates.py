from uuid import UUID

from fastapi import APIRouter, Depends, UploadFile, File, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import TEMPLATE_FIELDS
from app.core.deps import get_db, require_role
from app.models.lender import LenderUser
from app.models.user import User
from app.schemas.template import (
    TemplateCreate,
    TemplateFieldOption,
    TemplateListResponse,
    TemplateResponse,
    TemplateUpdate,
)
from app.services import template_service

router = APIRouter(prefix="/api/lender/templates", tags=["lender-templates"])


async def _get_lender_id(db: AsyncSession, user_id: UUID) -> UUID:
    result = await db.execute(
        select(LenderUser).where(LenderUser.user_id == user_id)
    )
    lu = result.scalar_one_or_none()
    if not lu:
        raise HTTPException(status_code=400, detail="User not associated with a lender")
    return lu.lender_id


@router.get("/fields", response_model=list[TemplateFieldOption])
async def get_available_fields(
    current_user: User = Depends(require_role("LENDER")),
):
    return [TemplateFieldOption(**f) for f in TEMPLATE_FIELDS]


@router.get("/", response_model=TemplateListResponse)
async def list_templates(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    templates = await template_service.list_templates(db, lender_id)
    return TemplateListResponse(templates=templates)


@router.get("/active", response_model=TemplateResponse)
async def get_active_template(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    template = await template_service.get_active_template(db, lender_id)
    if not template:
        raise HTTPException(status_code=404, detail="No active template")
    return template


@router.post("/", response_model=TemplateResponse, status_code=201)
async def create_template(
    payload: TemplateCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    return await template_service.create_template(
        db,
        lender_id=lender_id,
        name=payload.name,
        config_json=payload.config_json,
    )


@router.put("/{template_id}", response_model=TemplateResponse)
async def update_template(
    template_id: UUID,
    payload: TemplateUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    return await template_service.update_template(
        db,
        template_id=template_id,
        lender_id=lender_id,
        name=payload.name,
        config_json=payload.config_json,
    )


@router.post("/{template_id}/logo", response_model=TemplateResponse)
async def upload_logo(
    template_id: UUID,
    file: UploadFile = File(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    return await template_service.upload_logo(
        db, template_id=template_id, lender_id=lender_id, file=file
    )


@router.patch("/{template_id}/activate", response_model=TemplateResponse)
async def activate_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    return await template_service.activate_template(db, template_id, lender_id)


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    await template_service.delete_template(db, template_id, lender_id)
