from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.schemas.system_config import SystemConfigResponse, SystemConfigUpdate
from app.services import system_config_service
from app.services.activity_log_service import log_activity

router = APIRouter(prefix="/api/admin/system-config", tags=["admin-system-config"])


@router.get("", response_model=SystemConfigResponse)
async def get_system_config(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    config = await system_config_service.get_system_config(db)
    return config


@router.put("", response_model=SystemConfigResponse)
async def update_system_config(
    body: SystemConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    updates = body.model_dump(exclude_unset=True)
    config = await system_config_service.update_system_config(
        db, updates=updates, updated_by=current_user.id
    )

    await log_activity(
        db,
        actor_id=current_user.id,
        actor_type="ADMIN",
        action="SYSTEM_CONFIG_UPDATED",
        target_type="SYSTEM_CONFIG",
        target_id=config.id,
        metadata={"updated_fields": list(updates.keys())},
    )

    return config
