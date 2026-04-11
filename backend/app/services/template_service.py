import os
import uuid as uuid_mod
from uuid import UUID

from fastapi import HTTPException, UploadFile
from PIL import Image
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import (
    LOGO_ALLOWED_TYPES,
    LOGO_MAX_HEIGHT,
    LOGO_MAX_SIZE_MB,
    LOGO_MAX_WIDTH,
    LOGOS_DIR,
    MEDIA_ROOT,
)
from app.models.template import ReportTemplate
from app.schemas.template import TemplateConfig
from app.services.activity_log_service import log_activity


async def create_template(
    db: AsyncSession,
    lender_id: UUID,
    name: str,
    config_json: TemplateConfig,
) -> ReportTemplate:
    await _deactivate_all(db, lender_id)

    template = ReportTemplate(
        lender_id=lender_id,
        name=name,
        is_active=True,
        config_json=config_json.model_dump(),
    )
    db.add(template)
    await db.flush()

    await log_activity(
        db,
        actor_id=lender_id,
        actor_type="LENDER",
        action="TEMPLATE_CREATED",
        target_type="TEMPLATE",
        target_id=template.id,
    )

    return template


async def update_template(
    db: AsyncSession,
    template_id: UUID,
    lender_id: UUID,
    name: str | None = None,
    config_json: TemplateConfig | None = None,
) -> ReportTemplate:
    template = await _get_owned_template(db, template_id, lender_id)

    if name is not None:
        template.name = name
    if config_json is not None:
        template.config_json = config_json.model_dump()
        _invalidate_cache_for_template(template_id)

    await db.flush()

    await log_activity(
        db,
        actor_id=lender_id,
        actor_type="LENDER",
        action="TEMPLATE_UPDATED",
        target_type="TEMPLATE",
        target_id=template.id,
    )

    return template


async def upload_logo(
    db: AsyncSession,
    template_id: UUID,
    lender_id: UUID,
    file: UploadFile,
) -> ReportTemplate:
    if file.content_type not in LOGO_ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Logo must be PNG or JPEG")

    contents = await file.read()
    if len(contents) > LOGO_MAX_SIZE_MB * 1024 * 1024:
        raise HTTPException(status_code=400, detail=f"Logo must be under {LOGO_MAX_SIZE_MB}MB")

    template = await _get_owned_template(db, template_id, lender_id)

    logo_dir = os.path.join(MEDIA_ROOT, LOGOS_DIR, str(lender_id))
    os.makedirs(logo_dir, exist_ok=True)

    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "png"
    logo_filename = f"{uuid_mod.uuid4().hex}.{ext}"
    logo_full_path = os.path.join(logo_dir, logo_filename)

    with open(logo_full_path, "wb") as f:
        f.write(contents)

    img = Image.open(logo_full_path)
    img.thumbnail((LOGO_MAX_WIDTH, LOGO_MAX_HEIGHT))
    img.save(logo_full_path)

    relative_path = os.path.join(LOGOS_DIR, str(lender_id), logo_filename)
    template.logo_path = relative_path
    _invalidate_cache_for_template(template_id)
    await db.flush()
    return template


async def get_active_template(
    db: AsyncSession, lender_id: UUID
) -> ReportTemplate | None:
    result = await db.execute(
        select(ReportTemplate).where(
            ReportTemplate.lender_id == lender_id,
            ReportTemplate.is_active == True,
        )
    )
    return result.scalar_one_or_none()


async def list_templates(
    db: AsyncSession, lender_id: UUID
) -> list[ReportTemplate]:
    result = await db.execute(
        select(ReportTemplate)
        .where(ReportTemplate.lender_id == lender_id)
        .order_by(ReportTemplate.created_at.desc())
    )
    return list(result.scalars().all())


async def activate_template(
    db: AsyncSession, template_id: UUID, lender_id: UUID
) -> ReportTemplate:
    template = await _get_owned_template(db, template_id, lender_id)
    await _deactivate_all(db, lender_id)
    template.is_active = True
    await db.flush()
    return template


async def delete_template(
    db: AsyncSession, template_id: UUID, lender_id: UUID
) -> None:
    template = await _get_owned_template(db, template_id, lender_id)
    if template.is_active:
        raise HTTPException(status_code=400, detail="Cannot delete the active template")
    await db.delete(template)
    _invalidate_cache_for_template(template_id)
    await db.flush()


async def _get_owned_template(
    db: AsyncSession, template_id: UUID, lender_id: UUID
) -> ReportTemplate:
    result = await db.execute(
        select(ReportTemplate).where(
            ReportTemplate.id == template_id,
            ReportTemplate.lender_id == lender_id,
        )
    )
    template = result.scalar_one_or_none()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    return template


async def _deactivate_all(db: AsyncSession, lender_id: UUID) -> None:
    await db.execute(
        update(ReportTemplate)
        .where(
            ReportTemplate.lender_id == lender_id,
            ReportTemplate.is_active == True,
        )
        .values(is_active=False)
    )


def _invalidate_cache_for_template(template_id: UUID) -> None:
    from app.core.constants import RENDERED_DIR

    rendered_dir = os.path.join(MEDIA_ROOT, RENDERED_DIR)
    if not os.path.exists(rendered_dir):
        return
    prefix = str(template_id)
    for filename in os.listdir(rendered_dir):
        if prefix in filename:
            os.remove(os.path.join(rendered_dir, filename))
