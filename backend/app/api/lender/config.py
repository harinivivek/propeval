from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.lender import LenderUser
from app.models.user import User
from app.schemas.lender_config import (
    LenderConfigResponse,
    LenderConfigWithPreferences,
    SetVendorPreferenceRequest,
)
from app.services import lender_config_service

router = APIRouter(prefix="/api/lender/settings", tags=["lender-config"])


async def _get_lender_id(db: AsyncSession, user_id: UUID) -> UUID:
    result = await db.execute(
        select(LenderUser.lender_id).where(LenderUser.user_id == user_id)
    )
    lender_id = result.scalar_one_or_none()
    if not lender_id:
        raise HTTPException(status_code=404, detail="Lender not found")
    return lender_id


@router.get("/config", response_model=LenderConfigWithPreferences)
async def get_lender_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    config = await lender_config_service.get_lender_config(db, lender_id)
    preferences = await lender_config_service.get_vendor_preferences(db, lender_id)
    return LenderConfigWithPreferences(
        config=LenderConfigResponse.model_validate(config),
        vendor_preferences=preferences,
    )


@router.put("/vendors/{vendor_id}/preference")
async def set_vendor_preference(
    vendor_id: UUID,
    body: SetVendorPreferenceRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    await lender_config_service.set_vendor_preference(
        db, lender_id, vendor_id, body.auto_approve
    )
    return {"detail": "Preference updated"}
