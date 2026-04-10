from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.user import User
from app.models.vendor import VendorUser
from app.schemas.listing import VendorListingReportItem, VendorListingsResponse
from app.services import listing_service

router = APIRouter(prefix="/api/vendor/listings", tags=["vendor-listings"])


async def _get_vendor_id(db: AsyncSession, user_id: UUID) -> UUID:
    result = await db.execute(
        select(VendorUser).where(VendorUser.user_id == user_id)
    )
    vu = result.scalar_one_or_none()
    if not vu:
        raise HTTPException(status_code=400, detail="User not associated with a vendor")
    return vu.vendor_id


@router.get("/", response_model=VendorListingsResponse)
async def get_vendor_listings(
    city: str | None = Query(None),
    property_type: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    return await listing_service.get_vendor_listings(
        db,
        vendor_id,
        city=city,
        property_type=property_type,
        page=page,
        page_size=page_size,
    )


@router.get("/listable-reports", response_model=list[VendorListingReportItem])
async def get_listable_reports(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    return await listing_service.get_listable_reports(db, vendor_id)


@router.post("/reports/{report_id}/list", status_code=200)
async def list_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    try:
        listing = await listing_service.list_report(db, report_id, vendor_id)
        return {"message": "Report listed", "listing_id": str(listing.id)}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/reports/{report_id}/delist", status_code=200)
async def delist_report(
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    try:
        await listing_service.delist_report(db, report_id, vendor_id)
        return {"message": "Report delisted"}
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
