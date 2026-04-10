from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.user import User
from app.schemas.dashboard import AdminDashboardStats
from app.services import dashboard_service
from app.services.csv_export_service import generate_csv_response

router = APIRouter(prefix="/api/admin/dashboard", tags=["admin-dashboard"])


@router.get("/stats", response_model=AdminDashboardStats)
async def admin_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    return await dashboard_service.get_admin_dashboard_stats(db)


@router.get("/vendors")
async def admin_vendors(
    city: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    sort_by: str = Query("vendor_name"),
    sort_order: str = Query("asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    items, total = await dashboard_service.get_admin_vendors_table(
        db,
        city_filter=city,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/vendors/export")
async def admin_vendors_export(
    city: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    items, _ = await dashboard_service.get_admin_vendors_table(
        db, city_filter=city,
        date_from=date_from, date_to=date_to, page=1, page_size=10000,
    )
    columns = [
        ("Vendor Name", "vendor_name"),
        ("City", "city"),
        ("Requests Served", "requests_served"),
        ("Reports Uploaded", "reports_uploaded"),
        ("Active Listings", "active_listings"),
        ("Downloads", "downloads"),
        ("Total Earnings", "total_earnings"),
        ("Lender Count", "lender_count"),
    ]
    return generate_csv_response(items, columns, "vendors_export.csv")


@router.get("/lenders")
async def admin_lenders(
    city: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    sort_by: str = Query("lender_name"),
    sort_order: str = Query("asc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    items, total = await dashboard_service.get_admin_lenders_table(
        db,
        city_filter=city,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/lenders/export")
async def admin_lenders_export(
    city: str | None = Query(None),
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    items, _ = await dashboard_service.get_admin_lenders_table(
        db, city_filter=city, date_from=date_from, date_to=date_to,
        page=1, page_size=10000,
    )
    columns = [
        ("Lender Name", "lender_name"),
        ("City", "city"),
        ("Requests Raised", "requests_raised"),
        ("Reports Received", "reports_received"),
        ("Listings Purchased", "listings_purchased"),
        ("Total Payable", "total_payable"),
        ("Total Paid", "total_paid"),
        ("Vendor Count", "vendor_count"),
    ]
    return generate_csv_response(items, columns, "lenders_export.csv")


@router.get("/reports")
async def admin_reports(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    category: str | None = Query(None),
    property_type: str | None = Query(None),
    status: str | None = Query(None),
    vendor: str | None = Query(None),
    lender: str | None = Query(None),
    sort_by: str = Query("report_date"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    items, total = await dashboard_service.get_admin_reports_table(
        db,
        date_from=date_from,
        date_to=date_to,
        category_filter=category,
        property_type_filter=property_type,
        status_filter=status,
        vendor_filter=vendor,
        lender_filter=lender,
        sort_by=sort_by,
        sort_order=sort_order,
        page=page,
        page_size=page_size,
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}


@router.get("/reports/export")
async def admin_reports_export(
    date_from: str | None = Query(None),
    date_to: str | None = Query(None),
    category: str | None = Query(None),
    property_type: str | None = Query(None),
    status: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    items, _ = await dashboard_service.get_admin_reports_table(
        db, date_from=date_from, date_to=date_to,
        category_filter=category, property_type_filter=property_type,
        status_filter=status, page=1, page_size=10000,
    )
    columns = [
        ("Report Date", "report_date"),
        ("Vendor", "vendor_name"),
        ("Lender", "lender_name"),
        ("Address", "property_address"),
        ("Category", "report_category"),
        ("Property Type", "property_type"),
        ("Status", "status"),
        ("Valuation Amount", "valuation_amount"),
    ]
    return generate_csv_response(items, columns, "reports_export.csv")


@router.get("/open-requests")
async def admin_open_requests(
    sort_by: str = Query("created_at"),
    sort_order: str = Query("desc"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("ADMIN")),
):
    items, total = await dashboard_service.get_admin_open_requests(
        db, sort_by=sort_by, sort_order=sort_order, page=page, page_size=page_size
    )
    return {"items": items, "total": total, "page": page, "page_size": page_size}
