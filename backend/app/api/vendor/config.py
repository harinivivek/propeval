from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.models.vendor import Vendor, VendorUser
from app.models.lender import Lender
from app.models.user import Organization
from app.schemas.vendor_config import (
    AddExclusionRequest,
    VendorConfigResponse,
    VendorConfigUpdate,
    VendorConfigWithExclusions,
)
from app.services import vendor_config_service

router = APIRouter(prefix="/api/vendor/settings", tags=["vendor-config"])


async def _get_vendor_id(db: AsyncSession, user_id: UUID) -> UUID:
    result = await db.execute(
        select(VendorUser.vendor_id).where(VendorUser.user_id == user_id)
    )
    vendor_id = result.scalar_one_or_none()
    if not vendor_id:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor_id


@router.get("/config", response_model=VendorConfigWithExclusions)
async def get_vendor_config(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    config = await vendor_config_service.get_vendor_config(db, vendor_id)
    exclusions = await vendor_config_service.get_vendor_exclusions(db, vendor_id)
    return VendorConfigWithExclusions(
        config=VendorConfigResponse.model_validate(config),
        exclusions=exclusions,
    )


@router.put("/config", response_model=VendorConfigResponse)
async def update_vendor_config(
    body: VendorConfigUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    updates = body.model_dump(exclude_unset=True)
    config = await vendor_config_service.update_vendor_config(
        db, vendor_id, updates=updates
    )
    return config


@router.post("/exclusions", status_code=201)
async def add_exclusion(
    body: AddExclusionRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    try:
        await vendor_config_service.add_vendor_exclusion(
            db, vendor_id, body.lender_id
        )
    except ValueError as e:
        raise HTTPException(status_code=409, detail=str(e))
    return {"detail": "Exclusion added"}


@router.delete("/exclusions/{lender_id}")
async def remove_exclusion(
    lender_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    await vendor_config_service.remove_vendor_exclusion(db, vendor_id, lender_id)
    return {"detail": "Exclusion removed"}


@router.get("/lenders")
async def list_lenders(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("VENDOR")),
):
    """Lightweight lender list for exclusion dropdown."""
    result = await db.execute(
        select(Lender.id, Organization.name)
        .join(Organization, Organization.id == Lender.organization_id)
        .order_by(Organization.name)
    )
    return [{"id": str(row.id), "name": row.name} for row in result.all()]
