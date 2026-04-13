from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.schemas.vendor_profile import AdminTierOverride, VendorProfileResponse
from app.services import vendor_profile_service

router = APIRouter(prefix="/api/admin/vendors", tags=["admin-vendor-tiers"])


@router.put("/{vendor_id}/tier", response_model=VendorProfileResponse)
async def admin_override_tier(
    vendor_id: UUID,
    body: AdminTierOverride,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    valid_tiers = {"NEW", "VERIFIED", "TOP_VALUER"}
    if body.vendor_tier not in valid_tiers:
        raise HTTPException(status_code=400, detail=f"Invalid tier. Must be one of: {valid_tiers}")

    profile = await vendor_profile_service.admin_set_tier(
        db, vendor_id, body.vendor_tier
    )
    return profile
