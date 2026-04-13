from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.user import User
from app.schemas.price_band import PriceBandCreate, PriceBandResponse
from app.services import price_band_service

router = APIRouter(prefix="/api/admin/price-bands", tags=["admin-price-bands"])


@router.get("", response_model=list[PriceBandResponse])
async def list_price_bands(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await price_band_service.list_price_bands(db)


@router.post("", response_model=PriceBandResponse, status_code=201)
async def create_or_update_price_band(
    body: PriceBandCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    return await price_band_service.create_or_update_price_band(
        db,
        city=body.city,
        property_type=body.property_type,
        report_category=body.report_category,
        min_price=body.min_price,
        max_price=body.max_price,
    )


@router.delete("/{band_id}")
async def delete_price_band(
    band_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("ADMIN")),
):
    await price_band_service.delete_price_band(db, band_id)
    return {"detail": "Price band deleted"}
