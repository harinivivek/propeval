from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db, require_role
from app.models.user import User
from app.models.vendor import VendorUser
from app.models.request import RequestAcceptance
from app.schemas.vendor_profile import (
    VendorRatingCreate,
    VendorRatingResponse,
    VendorRatingSummary,
)
from app.services import vendor_profile_service, vendor_rating_service

router = APIRouter(prefix="/api/lender/vendors", tags=["lender-vendors"])


@router.get("/{vendor_id}/profile")
async def get_vendor_public_profile(
    vendor_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    profile = await vendor_profile_service.get_public_profile(db, vendor_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Vendor profile not found")
    return profile


@router.get("/{vendor_id}/portfolio")
async def get_vendor_portfolio(
    vendor_id: UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    return await vendor_profile_service.get_vendor_portfolio(
        db, vendor_id, page=page, page_size=page_size
    )


@router.post("/{vendor_id}/rate", response_model=VendorRatingResponse, status_code=201)
async def rate_vendor(
    vendor_id: UUID,
    body: VendorRatingCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    try:
        rating = await vendor_rating_service.submit_rating(
            db,
            lender_user_id=current_user.id,
            vendor_id=vendor_id,
            report_request_id=body.report_request_id,
            rating=body.rating,
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

    # Recalculate quality score and check tier promotion
    await vendor_profile_service.recalculate_quality_score(db, vendor_id)
    await vendor_profile_service.check_tier_promotion(db, vendor_id)

    return rating


@router.get("/{vendor_id}/ratings", response_model=VendorRatingSummary)
async def get_vendor_ratings(
    vendor_id: UUID,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    return await vendor_rating_service.get_rating_summary(db, vendor_id)
