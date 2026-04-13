from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.user import User
from app.models.vendor import VendorUser
from app.schemas.price_band import VendorPricingUpsert
from app.services import price_band_service

router = APIRouter(prefix="/api/vendor/pricing", tags=["vendor-pricing"])


async def _get_vendor_id(db: AsyncSession, user_id: UUID) -> UUID:
    result = await db.execute(
        select(VendorUser.vendor_id).where(VendorUser.user_id == user_id)
    )
    vendor_id = result.scalar_one_or_none()
    if not vendor_id:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor_id


@router.get("")
async def get_vendor_pricing(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    return await price_band_service.get_vendor_pricing(db, vendor_id)


@router.put("")
async def update_vendor_pricing(
    body: list[VendorPricingUpsert],
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    items = [item.model_dump() for item in body]
    try:
        results = await price_band_service.upsert_vendor_pricing(
            db, vendor_id, items=items
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    return {"detail": f"Updated {len(results)} pricing entries"}
