from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import require_role
from app.models.lender import LenderUser
from app.models.purchase import ReportPurchase
from app.models.report import Report
from app.models.user import User
from app.schemas.listing import ListingBrowseResponse, ListingDetailResponse
from app.schemas.purchase import PurchasedReportsResponse, PurchaseResponse
from app.services import listing_service

router = APIRouter(prefix="/api/lender/listings", tags=["lender-listings"])


async def _get_lender_id(db: AsyncSession, user_id: UUID) -> UUID:
    result = await db.execute(
        select(LenderUser).where(LenderUser.user_id == user_id)
    )
    lu = result.scalar_one_or_none()
    if not lu:
        raise HTTPException(status_code=400, detail="User not associated with a lender")
    return lu.lender_id


@router.get("/", response_model=ListingBrowseResponse)
async def browse_listings(
    city: str | None = Query(None),
    pin_code: str | None = Query(None),
    property_type: str | None = Query(None),
    report_category: str | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    return await listing_service.get_listings(
        db,
        city=city,
        pin_code=pin_code,
        property_type=property_type,
        report_category=report_category,
        page=page,
        page_size=page_size,
    )


@router.get("/purchases", response_model=PurchasedReportsResponse)
async def get_purchased_reports(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    return await listing_service.get_purchased_reports(
        db,
        lender_id,
        page=page,
        page_size=page_size,
    )


@router.get("/purchases/{purchase_id}/download")
async def download_purchased_report(
    purchase_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)

    purchase_result = await db.execute(
        select(ReportPurchase).where(
            ReportPurchase.id == purchase_id,
            ReportPurchase.lender_id == lender_id,
        )
    )
    purchase = purchase_result.scalar_one_or_none()
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")

    report_result = await db.execute(
        select(Report).where(Report.id == purchase.report_id)
    )
    report = report_result.scalar_one_or_none()
    if not report or not report.uploaded_file_path:
        raise HTTPException(status_code=404, detail="Report file not found")

    return FileResponse(
        report.uploaded_file_path,
        media_type="application/pdf",
        filename=f"report-{report.id}.pdf",
    )


@router.get("/{listing_id}", response_model=ListingDetailResponse)
async def get_listing_detail(
    listing_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    try:
        return await listing_service.get_listing_detail(db, listing_id, lender_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.post("/{listing_id}/reports/{report_id}/purchase", response_model=PurchaseResponse)
async def purchase_report(
    listing_id: UUID,
    report_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    try:
        return await listing_service.purchase_report(
            db,
            report_id=report_id,
            listing_id=listing_id,
            lender_id=lender_id,
            user_id=current_user.id,
        )
    except ValueError as e:
        status_code = 409 if "Already purchased" in str(e) else 400
        raise HTTPException(status_code=status_code, detail=str(e))
