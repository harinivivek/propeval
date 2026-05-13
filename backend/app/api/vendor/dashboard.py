from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.user import User
from app.models.vendor import VendorUser
from app.schemas.dashboard import VendorDashboardStats, VendorReceivablesResponse, VendorEarningsResponse
from app.services import dashboard_service

router = APIRouter(prefix="/api/vendor/dashboard", tags=["vendor-dashboard"])


async def _get_vendor_id(db: AsyncSession, user_id) -> str:
    from sqlalchemy import select
    stmt = select(VendorUser.vendor_id).where(VendorUser.user_id == user_id)
    result = await db.execute(stmt)
    vendor_user = result.scalar_one_or_none()
    if not vendor_user:
        from fastapi import HTTPException
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor_user


@router.get("/stats", response_model=VendorDashboardStats)
async def vendor_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    return await dashboard_service.get_vendor_dashboard_stats(db, vendor_id=vendor_id)


@router.get("/receivables")
async def vendor_receivables(
    fy_year: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    return await dashboard_service.get_vendor_receivables(db, vendor_id=vendor_id, fy_year=fy_year)


@router.get("/earnings")
async def vendor_earnings(
    fy_year: int | None = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    return await dashboard_service.get_vendor_earnings_analytics(
        db, vendor_id=vendor_id, fy_year=fy_year, page=page, page_size=page_size
    )


@router.get("/pending-requests")
async def vendor_pending_requests(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    return await dashboard_service.get_vendor_pending_requests(db, vendor_id=vendor_id)


@router.get("/reports")
async def vendor_reports(
    search: str | None = Query(None),
    status: str | None = Query(
        None,
        description="Single ReportStatus or comma-separated list, e.g. READY_TO_PUBLISH,PUBLISHED",
    ),
    category: str | None = Query(None),
    property_type: str | None = Query(None),
    sort_by: str = Query("report_date"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)
    items, total = await dashboard_service.get_vendor_reports_table(
        db,
        vendor_id=vendor_id,
        search=search,
        status_filter=status,
        category_filter=category,
        property_type_filter=property_type,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}
