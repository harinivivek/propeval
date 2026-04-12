from datetime import date
from decimal import Decimal
from uuid import UUID

from sqlalchemy import case, distinct, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.billing import Invoice, LenderPayable, VendorEarning
from app.models.enums import InvoiceType as InvType
from app.models.lender import Lender
from app.models.listing import Listing, ListingReport
from app.models.purchase import ReportPurchase
from app.models.report import Report
from app.models.request import ReportRequest, RequestAcceptance, RequestBroadcast
from app.models.vendor import Vendor


def _get_fy_range(fy_year: int | None = None) -> tuple[str, str]:
    """Return (start_month, end_month) strings for the Indian financial year.
    If fy_year is None, uses current date to determine FY.
    fy_year=2026 means Apr 2026 - Mar 2027.
    """
    if fy_year is None:
        today = date.today()
        fy_year = today.year if today.month >= 4 else today.year - 1
    return f"{fy_year}-04", f"{fy_year + 1}-03"


async def get_vendor_dashboard_stats(
    db: AsyncSession, *, vendor_id: UUID
) -> dict:
    requests_received = (await db.execute(
        select(func.count()).select_from(RequestAcceptance)
        .where(RequestAcceptance.vendor_id == vendor_id)
    )).scalar_one()

    requests_accepted = (await db.execute(
        select(func.count()).select_from(ReportRequest)
        .join(RequestAcceptance, RequestAcceptance.request_id == ReportRequest.id)
        .where(
            RequestAcceptance.vendor_id == vendor_id,
            ReportRequest.vendor_status == "ACCEPTED",
        )
    )).scalar_one()

    reports_served = (await db.execute(
        select(func.count()).select_from(Report)
        .join(RequestAcceptance, RequestAcceptance.report_id == Report.id)
        .where(
            RequestAcceptance.vendor_id == vendor_id,
            Report.status == "PUBLISHED",
        )
    )).scalar_one()

    reports_listed = (await db.execute(
        select(func.count()).select_from(Report)
        .where(Report.vendor_id == vendor_id, Report.listing_approved == True)  # noqa: E712
    )).scalar_one()

    downloads = (await db.execute(
        select(func.count()).select_from(ReportPurchase)
        .join(Report, Report.id == ReportPurchase.report_id)
        .where(Report.vendor_id == vendor_id)
    )).scalar_one()

    active_listings = (await db.execute(
        select(func.count(distinct(Listing.id)))
        .select_from(Listing)
        .join(ListingReport, ListingReport.listing_id == Listing.id)
        .join(Report, Report.id == ListingReport.report_id)
        .where(Report.vendor_id == vendor_id, Listing.status == "AVAILABLE")
    )).scalar_one()

    return {
        "requests_received": requests_received,
        "requests_accepted": requests_accepted,
        "reports_served": reports_served,
        "reports_listed": reports_listed,
        "downloads": downloads,
        "active_listings": active_listings,
    }


async def get_vendor_receivables(
    db: AsyncSession, *, vendor_id: UUID, fy_year: int | None = None
) -> dict:
    fy_start, fy_end = _get_fy_range(fy_year)

    lender_wise_stmt = (
        select(
            VendorEarning.lender_id,
            Lender.name.label("lender_name"),
            func.sum(VendorEarning.amount).label("total_amount"),
        )
        .join(Lender, Lender.id == VendorEarning.lender_id)
        .where(
            VendorEarning.vendor_id == vendor_id,
            VendorEarning.month >= fy_start,
            VendorEarning.month <= fy_end,
        )
        .group_by(VendorEarning.lender_id, Lender.name)
        .order_by(func.sum(VendorEarning.amount).desc())
    )
    lender_rows = (await db.execute(lender_wise_stmt)).all()

    month_wise_stmt = (
        select(
            VendorEarning.month,
            func.sum(VendorEarning.amount).label("total_amount"),
        )
        .where(
            VendorEarning.vendor_id == vendor_id,
            VendorEarning.month >= fy_start,
            VendorEarning.month <= fy_end,
        )
        .group_by(VendorEarning.month)
        .order_by(VendorEarning.month)
    )
    month_rows = (await db.execute(month_wise_stmt)).all()

    month_wise = [
        {"month": r.month, "total_amount": str(r.total_amount)}
        for r in month_rows
    ]

    # Enrich month_wise with invoice data
    vendor_org_result = await db.execute(
        select(Vendor.organization_id).where(Vendor.id == vendor_id)
    )
    vendor_org_id = vendor_org_result.scalar_one_or_none()

    if vendor_org_id:
        for item in month_wise:
            inv_result = await db.execute(
                select(Invoice).where(
                    Invoice.organization_id == vendor_org_id,
                    Invoice.month == item["month"],
                    Invoice.invoice_type == InvType.RECEIVABLE,
                )
            )
            inv = inv_result.scalar_one_or_none()
            item["invoice_number"] = inv.invoice_number if inv else None
            item["invoice_status"] = inv.status.value if inv else None

    return {
        "lender_wise": [
            {"lender_id": str(r.lender_id), "lender_name": r.lender_name, "total_amount": str(r.total_amount)}
            for r in lender_rows
        ],
        "month_wise": month_wise,
    }


async def get_vendor_earnings_analytics(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    fy_year: int | None = None,
    page: int = 1,
    page_size: int = 10,
) -> dict:
    fy_start, fy_end = _get_fy_range(fy_year)

    lender_wise_stmt = (
        select(
            VendorEarning.lender_id,
            Lender.name.label("lender_name"),
            func.sum(VendorEarning.amount).label("total_amount"),
        )
        .join(Lender, Lender.id == VendorEarning.lender_id)
        .where(
            VendorEarning.vendor_id == vendor_id,
            VendorEarning.month >= fy_start,
            VendorEarning.month <= fy_end,
        )
        .group_by(VendorEarning.lender_id, Lender.name)
        .order_by(func.sum(VendorEarning.amount).desc())
    )
    lender_rows = (await db.execute(lender_wise_stmt)).all()

    report_count_stmt = (
        select(func.count(distinct(VendorEarning.report_id)))
        .where(
            VendorEarning.vendor_id == vendor_id,
            VendorEarning.month >= fy_start,
            VendorEarning.month <= fy_end,
        )
    )
    report_wise_total = (await db.execute(report_count_stmt)).scalar_one()

    report_wise_stmt = (
        select(
            VendorEarning.report_id,
            Report.property_address,
            Report.report_category,
            func.sum(VendorEarning.amount).label("total_amount"),
        )
        .join(Report, Report.id == VendorEarning.report_id)
        .where(
            VendorEarning.vendor_id == vendor_id,
            VendorEarning.month >= fy_start,
            VendorEarning.month <= fy_end,
        )
        .group_by(VendorEarning.report_id, Report.property_address, Report.report_category)
        .order_by(func.sum(VendorEarning.amount).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    report_rows = (await db.execute(report_wise_stmt)).all()

    month_wise_stmt = (
        select(
            VendorEarning.month,
            func.sum(VendorEarning.amount).label("total_amount"),
        )
        .where(
            VendorEarning.vendor_id == vendor_id,
            VendorEarning.month >= fy_start,
            VendorEarning.month <= fy_end,
        )
        .group_by(VendorEarning.month)
        .order_by(VendorEarning.month)
    )
    month_rows = (await db.execute(month_wise_stmt)).all()

    return {
        "lender_wise": [
            {"lender_id": str(r.lender_id), "lender_name": r.lender_name, "total_amount": str(r.total_amount)}
            for r in lender_rows
        ],
        "report_wise": [
            {
                "report_id": str(r.report_id),
                "property_address": r.property_address,
                "report_category": r.report_category.value if hasattr(r.report_category, "value") else str(r.report_category),
                "total_amount": str(r.total_amount),
            }
            for r in report_rows
        ],
        "report_wise_total": report_wise_total,
        "month_wise": [
            {"month": r.month, "total_amount": str(r.total_amount)}
            for r in month_rows
        ],
    }


async def get_vendor_pending_requests(
    db: AsyncSession, *, vendor_id: UUID
) -> list[dict]:
    stmt = (
        select(
            ReportRequest.id,
            Lender.name.label("lender_name"),
            ReportRequest.property_address,
            ReportRequest.report_category,
            ReportRequest.eta_days,
            ReportRequest.price,
            ReportRequest.vendor_status,
            RequestBroadcast.accept_deadline,
            ReportRequest.created_at,
        )
        .join(Lender, Lender.id == ReportRequest.lender_id)
        .join(RequestBroadcast, RequestBroadcast.request_id == ReportRequest.id)
        .where(
            ReportRequest.vendor_status.in_(["INCOMING", "PENDING"]),
            RequestBroadcast.vendor_ids.any(str(vendor_id)),
            RequestBroadcast.status == "ACTIVE",
        )
        .order_by(RequestBroadcast.accept_deadline.asc())
    )
    rows = (await db.execute(stmt)).all()

    return [
        {
            "id": str(r.id),
            "lender_name": r.lender_name,
            "property_address": r.property_address,
            "report_category": r.report_category.value if hasattr(r.report_category, "value") else str(r.report_category),
            "eta_days": r.eta_days,
            "price": str(r.price) if r.price else None,
            "vendor_status": r.vendor_status.value if hasattr(r.vendor_status, "value") else str(r.vendor_status),
            "accept_deadline": r.accept_deadline.isoformat() if r.accept_deadline else None,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


async def get_vendor_reports_table(
    db: AsyncSession,
    *,
    vendor_id: UUID,
    search: str | None = None,
    status_filter: str | None = None,
    category_filter: str | None = None,
    property_type_filter: str | None = None,
    sort_by: str = "report_date",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    base = select(Report).where(Report.vendor_id == vendor_id, Report.is_active == True)  # noqa: E712

    if search:
        base = base.where(
            Report.property_address.ilike(f"%{search}%")
            | Report.loan_applicant_name.ilike(f"%{search}%")
        )
    if status_filter:
        base = base.where(Report.status == status_filter)
    if category_filter:
        base = base.where(Report.report_category == category_filter)
    if property_type_filter:
        base = base.where(Report.property_type == property_type_filter)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    sort_map = {
        "report_date": Report.report_date,
        "property_address": Report.property_address,
        "status": Report.status,
        "report_category": Report.report_category,
        "property_type": Report.property_type,
        "valuation_amount": Report.valuation_amount,
    }
    sort_col = sort_map.get(sort_by, Report.report_date)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()

    stmt = base.order_by(order).offset((page - 1) * page_size).limit(page_size)
    reports = (await db.execute(stmt)).scalars().all()

    return [
        {
            "id": str(r.id),
            "report_date": str(r.report_date) if r.report_date else None,
            "property_address": r.property_address,
            "report_category": r.report_category.value if hasattr(r.report_category, "value") else str(r.report_category),
            "property_type": r.property_type.value if r.property_type and hasattr(r.property_type, "value") else (str(r.property_type) if r.property_type else None),
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "valuation_amount": str(r.valuation_amount) if r.valuation_amount else None,
        }
        for r in reports
    ], total


# ---------------------------------------------------------------------------
# Lender functions
# ---------------------------------------------------------------------------

async def get_lender_dashboard_stats(
    db: AsyncSession, *, lender_id: UUID
) -> dict:
    requests_raised = (await db.execute(
        select(func.count()).select_from(ReportRequest)
        .where(ReportRequest.lender_id == lender_id)
    )).scalar_one()

    awaiting_reports = (await db.execute(
        select(func.count()).select_from(ReportRequest)
        .where(ReportRequest.lender_id == lender_id, ReportRequest.lender_status == "AWAITED")
    )).scalar_one()

    reports_received = (await db.execute(
        select(func.count()).select_from(ReportRequest)
        .where(ReportRequest.lender_id == lender_id, ReportRequest.lender_status == "RECEIVED")
    )).scalar_one()

    reports_accepted = (await db.execute(
        select(func.count()).select_from(ReportRequest)
        .where(ReportRequest.lender_id == lender_id, ReportRequest.lender_status == "ACCEPTED")
    )).scalar_one()

    listings_purchased = (await db.execute(
        select(func.count()).select_from(ReportPurchase)
        .where(ReportPurchase.lender_id == lender_id)
    )).scalar_one()

    return {
        "requests_raised": requests_raised,
        "awaiting_reports": awaiting_reports,
        "reports_received": reports_received,
        "reports_accepted": reports_accepted,
        "listings_purchased": listings_purchased,
    }


async def get_lender_payables_summary(
    db: AsyncSession, *, lender_id: UUID, fy_year: int | None = None
) -> dict:
    fy_start, fy_end = _get_fy_range(fy_year)

    totals_stmt = (
        select(
            func.coalesce(
                func.sum(case((LenderPayable.status == "PENDING", LenderPayable.amount))),
                Decimal("0"),
            ).label("pending"),
            func.coalesce(
                func.sum(case((LenderPayable.status == "BILLED", LenderPayable.amount))),
                Decimal("0"),
            ).label("billed"),
            func.coalesce(
                func.sum(case((LenderPayable.status == "PAID", LenderPayable.amount))),
                Decimal("0"),
            ).label("paid"),
        )
        .where(LenderPayable.lender_id == lender_id)
    )
    totals = (await db.execute(totals_stmt)).one()

    month_wise_stmt = (
        select(
            LenderPayable.month,
            func.sum(LenderPayable.amount).label("total_amount"),
        )
        .where(
            LenderPayable.lender_id == lender_id,
            LenderPayable.month >= fy_start,
            LenderPayable.month <= fy_end,
        )
        .group_by(LenderPayable.month)
        .order_by(LenderPayable.month)
    )
    month_rows = (await db.execute(month_wise_stmt)).all()

    type_stmt = (
        select(
            LenderPayable.payable_type,
            func.sum(LenderPayable.amount).label("total_amount"),
        )
        .where(
            LenderPayable.lender_id == lender_id,
            LenderPayable.month >= fy_start,
            LenderPayable.month <= fy_end,
        )
        .group_by(LenderPayable.payable_type)
    )
    type_rows = (await db.execute(type_stmt)).all()

    month_wise = [
        {"month": r.month, "total_amount": str(r.total_amount)}
        for r in month_rows
    ]

    # Enrich month_wise with invoice data
    lender_org_result = await db.execute(
        select(Lender.organization_id).where(Lender.id == lender_id)
    )
    lender_org_id = lender_org_result.scalar_one_or_none()

    if lender_org_id:
        for item in month_wise:
            inv_result = await db.execute(
                select(Invoice).where(
                    Invoice.organization_id == lender_org_id,
                    Invoice.month == item["month"],
                    Invoice.invoice_type == InvType.PAYABLE,
                )
            )
            inv = inv_result.scalar_one_or_none()
            item["invoice_number"] = inv.invoice_number if inv else None
            item["invoice_status"] = inv.status.value if inv else None

    return {
        "totals": {
            "pending": str(totals.pending),
            "billed": str(totals.billed),
            "paid": str(totals.paid),
        },
        "month_wise": month_wise,
        "type_breakdown": [
            {
                "payable_type": r.payable_type.value if hasattr(r.payable_type, "value") else str(r.payable_type),
                "total_amount": str(r.total_amount),
            }
            for r in type_rows
        ],
    }


async def get_lender_recent_requests(
    db: AsyncSession, *, lender_id: UUID, limit: int = 10
) -> list[dict]:
    stmt = (
        select(
            ReportRequest.id,
            ReportRequest.property_address,
            ReportRequest.report_category,
            ReportRequest.lender_status,
            ReportRequest.created_at,
            Vendor.name.label("vendor_name"),
        )
        .outerjoin(RequestAcceptance, RequestAcceptance.request_id == ReportRequest.id)
        .outerjoin(Vendor, Vendor.id == RequestAcceptance.vendor_id)
        .where(ReportRequest.lender_id == lender_id)
        .order_by(ReportRequest.created_at.desc())
        .limit(limit)
    )
    rows = (await db.execute(stmt)).all()

    return [
        {
            "id": str(r.id),
            "property_address": r.property_address,
            "report_category": r.report_category.value if hasattr(r.report_category, "value") else str(r.report_category),
            "lender_status": r.lender_status.value if hasattr(r.lender_status, "value") else str(r.lender_status),
            "vendor_name": r.vendor_name,
            "created_at": r.created_at.isoformat(),
        }
        for r in rows
    ]


# ---------------------------------------------------------------------------
# Admin functions
# ---------------------------------------------------------------------------

async def get_admin_dashboard_stats(db: AsyncSession) -> dict:
    total_vendors = (await db.execute(
        select(func.count()).select_from(Vendor)
    )).scalar_one()

    total_lenders = (await db.execute(
        select(func.count()).select_from(Lender)
    )).scalar_one()

    total_reports = (await db.execute(
        select(func.count()).select_from(Report)
    )).scalar_one()

    total_revenue = (await db.execute(
        select(func.coalesce(func.sum(LenderPayable.amount), Decimal("0")))
    )).scalar_one()

    pending_payables = (await db.execute(
        select(func.coalesce(func.sum(LenderPayable.amount), Decimal("0")))
        .where(LenderPayable.status == "PENDING")
    )).scalar_one()

    open_requests = (await db.execute(
        select(func.count()).select_from(ReportRequest)
        .where(ReportRequest.lender_status.in_(["SENT", "AWAITED"]))
    )).scalar_one()

    return {
        "total_vendors": total_vendors,
        "total_lenders": total_lenders,
        "total_reports": total_reports,
        "total_revenue": str(total_revenue),
        "pending_payables": str(pending_payables),
        "open_requests": open_requests,
    }


async def get_admin_vendors_table(
    db: AsyncSession,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    city_filter: str | None = None,
    sort_by: str = "vendor_name",
    sort_order: str = "asc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    # Compute total_earnings as a scalar subquery to avoid SUM(DISTINCT amount)
    # deduplication bug caused by multi-table joins.
    earnings_subq = (
        select(func.coalesce(func.sum(VendorEarning.amount), Decimal("0")))
        .where(VendorEarning.vendor_id == Vendor.id)
        .correlate(Vendor)
        .scalar_subquery()
    )

    base = (
        select(
            Vendor.id.label("vendor_id"),
            Vendor.name.label("vendor_name"),
            Vendor.office_city.label("city"),
            func.count(distinct(RequestAcceptance.id)).label("requests_served"),
            func.count(distinct(Report.id)).label("reports_uploaded"),
            earnings_subq.label("total_earnings"),
        )
        .outerjoin(RequestAcceptance, RequestAcceptance.vendor_id == Vendor.id)
        .outerjoin(Report, Report.vendor_id == Vendor.id)
        .group_by(Vendor.id, Vendor.name, Vendor.office_city)
    )

    if city_filter:
        base = base.where(Vendor.office_city.ilike(f"%{city_filter}%"))
    if date_from:
        base = base.where(Vendor.created_at >= date_from)
    if date_to:
        base = base.where(Vendor.created_at <= date_to)

    count_stmt = select(func.count()).select_from(Vendor)
    if city_filter:
        count_stmt = count_stmt.where(Vendor.office_city.ilike(f"%{city_filter}%"))
    if date_from:
        count_stmt = count_stmt.where(Vendor.created_at >= date_from)
    if date_to:
        count_stmt = count_stmt.where(Vendor.created_at <= date_to)
    total = (await db.execute(count_stmt)).scalar_one()

    sort_map = {
        "vendor_name": Vendor.name,
        "city": Vendor.office_city,
        "total_earnings": func.coalesce(func.sum(VendorEarning.amount), Decimal("0")),
    }
    sort_col = sort_map.get(sort_by, Vendor.name)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()

    stmt = base.order_by(order).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).all()

    result = []
    for r in rows:
        downloads = (await db.execute(
            select(func.count()).select_from(ReportPurchase)
            .join(Report, Report.id == ReportPurchase.report_id)
            .where(Report.vendor_id == r.vendor_id)
        )).scalar_one()

        active_listings = (await db.execute(
            select(func.count(distinct(Listing.id)))
            .select_from(Listing)
            .join(ListingReport, ListingReport.listing_id == Listing.id)
            .join(Report, Report.id == ListingReport.report_id)
            .where(Report.vendor_id == r.vendor_id, Listing.status == "AVAILABLE")
        )).scalar_one()

        lender_count = (await db.execute(
            select(func.count(distinct(VendorEarning.lender_id)))
            .where(VendorEarning.vendor_id == r.vendor_id)
        )).scalar_one()

        result.append({
            "vendor_id": str(r.vendor_id),
            "vendor_name": r.vendor_name,
            "city": r.city,
            "requests_served": r.requests_served,
            "reports_uploaded": r.reports_uploaded,
            "active_listings": active_listings,
            "downloads": downloads,
            "total_earnings": str(r.total_earnings),
            "lender_count": lender_count,
        })

    return result, total


async def get_admin_lenders_table(
    db: AsyncSession,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    city_filter: str | None = None,
    sort_by: str = "lender_name",
    sort_order: str = "asc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    count_stmt = select(func.count()).select_from(Lender)
    if city_filter:
        count_stmt = count_stmt.where(Lender.city.ilike(f"%{city_filter}%"))
    if date_from:
        count_stmt = count_stmt.where(Lender.created_at >= date_from)
    if date_to:
        count_stmt = count_stmt.where(Lender.created_at <= date_to)
    total = (await db.execute(count_stmt)).scalar_one()

    base = (
        select(
            Lender.id.label("lender_id"),
            Lender.name.label("lender_name"),
            Lender.city,
        )
    )
    if city_filter:
        base = base.where(Lender.city.ilike(f"%{city_filter}%"))
    if date_from:
        base = base.where(Lender.created_at >= date_from)
    if date_to:
        base = base.where(Lender.created_at <= date_to)

    sort_map = {
        "lender_name": Lender.name,
        "city": Lender.city,
    }
    sort_col = sort_map.get(sort_by, Lender.name)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()

    stmt = base.order_by(order).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).all()

    result = []
    for r in rows:
        requests_raised = (await db.execute(
            select(func.count()).select_from(ReportRequest)
            .where(ReportRequest.lender_id == r.lender_id)
        )).scalar_one()

        reports_received = (await db.execute(
            select(func.count()).select_from(ReportRequest)
            .where(
                ReportRequest.lender_id == r.lender_id,
                ReportRequest.lender_status.in_(["RECEIVED", "ACCEPTED"]),
            )
        )).scalar_one()

        listings_purchased = (await db.execute(
            select(func.count()).select_from(ReportPurchase)
            .where(ReportPurchase.lender_id == r.lender_id)
        )).scalar_one()

        payable_stmt = select(
            func.coalesce(func.sum(LenderPayable.amount), Decimal("0")).label("total"),
            func.coalesce(
                func.sum(case((LenderPayable.status == "PAID", LenderPayable.amount))),
                Decimal("0"),
            ).label("paid"),
        ).where(LenderPayable.lender_id == r.lender_id)
        payable_row = (await db.execute(payable_stmt)).one()

        vendor_count = (await db.execute(
            select(func.count(distinct(RequestAcceptance.vendor_id)))
            .select_from(RequestAcceptance)
            .join(ReportRequest, ReportRequest.id == RequestAcceptance.request_id)
            .where(ReportRequest.lender_id == r.lender_id)
        )).scalar_one()

        result.append({
            "lender_id": str(r.lender_id),
            "lender_name": r.lender_name,
            "city": r.city,
            "requests_raised": requests_raised,
            "reports_received": reports_received,
            "listings_purchased": listings_purchased,
            "total_payable": str(payable_row.total),
            "total_paid": str(payable_row.paid),
            "vendor_count": vendor_count,
        })

    return result, total


async def get_admin_reports_table(
    db: AsyncSession,
    *,
    date_from: str | None = None,
    date_to: str | None = None,
    category_filter: str | None = None,
    property_type_filter: str | None = None,
    status_filter: str | None = None,
    vendor_filter: str | None = None,
    lender_filter: str | None = None,
    sort_by: str = "report_date",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    base = (
        select(
            Report.id.label("report_id"),
            Report.report_date,
            Vendor.name.label("vendor_name"),
            Report.property_address,
            Report.report_category,
            Report.property_type,
            Report.status,
            Report.valuation_amount,
        )
        .join(Vendor, Vendor.id == Report.vendor_id)
    )

    if category_filter:
        base = base.where(Report.report_category == category_filter)
    if property_type_filter:
        base = base.where(Report.property_type == property_type_filter)
    if status_filter:
        base = base.where(Report.status == status_filter)
    if date_from:
        base = base.where(Report.report_date >= date_from)
    if date_to:
        base = base.where(Report.report_date <= date_to)

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    sort_map = {
        "report_date": Report.report_date,
        "property_address": Report.property_address,
        "status": Report.status,
        "report_category": Report.report_category,
        "property_type": Report.property_type,
        "valuation_amount": Report.valuation_amount,
        "vendor_name": Vendor.name,
    }
    sort_col = sort_map.get(sort_by, Report.report_date)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()

    stmt = base.order_by(order).offset((page - 1) * page_size).limit(page_size)
    rows = (await db.execute(stmt)).all()

    result = []
    for r in rows:
        lender_name_stmt = (
            select(Lender.name)
            .select_from(RequestAcceptance)
            .join(ReportRequest, ReportRequest.id == RequestAcceptance.request_id)
            .join(Lender, Lender.id == ReportRequest.lender_id)
            .where(RequestAcceptance.report_id == r.report_id)
            .limit(1)
        )
        lender_name = (await db.execute(lender_name_stmt)).scalar_one_or_none()

        result.append({
            "report_id": str(r.report_id),
            "report_date": str(r.report_date) if r.report_date else None,
            "vendor_name": r.vendor_name,
            "lender_name": lender_name,
            "property_address": r.property_address,
            "report_category": r.report_category.value if hasattr(r.report_category, "value") else str(r.report_category),
            "property_type": r.property_type.value if r.property_type and hasattr(r.property_type, "value") else None,
            "status": r.status.value if hasattr(r.status, "value") else str(r.status),
            "valuation_amount": str(r.valuation_amount) if r.valuation_amount else None,
        })

    return result, total


async def get_admin_open_requests(
    db: AsyncSession,
    *,
    sort_by: str = "created_at",
    sort_order: str = "desc",
    page: int = 1,
    page_size: int = 20,
) -> tuple[list[dict], int]:
    base = (
        select(ReportRequest)
        .where(ReportRequest.lender_status.in_(["SENT", "AWAITED"]))
    )

    count_stmt = select(func.count()).select_from(base.subquery())
    total = (await db.execute(count_stmt)).scalar_one()

    sort_map = {
        "created_at": ReportRequest.created_at,
        "property_address": ReportRequest.property_address,
        "lender_status": ReportRequest.lender_status,
        "eta_days": ReportRequest.eta_days,
    }
    sort_col = sort_map.get(sort_by, ReportRequest.created_at)
    order = sort_col.desc() if sort_order == "desc" else sort_col.asc()

    stmt = (
        select(
            ReportRequest.id.label("request_id"),
            Lender.name.label("lender_name"),
            ReportRequest.property_address,
            ReportRequest.report_category,
            ReportRequest.lender_status,
            ReportRequest.created_at,
            ReportRequest.eta_days,
            Vendor.name.label("vendor_name"),
            RequestBroadcast.broadcast_round,
        )
        .join(Lender, Lender.id == ReportRequest.lender_id)
        .outerjoin(RequestAcceptance, RequestAcceptance.request_id == ReportRequest.id)
        .outerjoin(Vendor, Vendor.id == RequestAcceptance.vendor_id)
        .outerjoin(
            RequestBroadcast,
            (RequestBroadcast.request_id == ReportRequest.id)
            & (RequestBroadcast.status == "ACTIVE"),
        )
        .where(ReportRequest.lender_status.in_(["SENT", "AWAITED"]))
        .order_by(order)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    rows = (await db.execute(stmt)).all()

    return [
        {
            "request_id": str(r.request_id),
            "lender_name": r.lender_name,
            "property_address": r.property_address,
            "report_category": r.report_category.value if hasattr(r.report_category, "value") else str(r.report_category),
            "lender_status": r.lender_status.value if hasattr(r.lender_status, "value") else str(r.lender_status),
            "vendor_name": r.vendor_name,
            "created_at": r.created_at.isoformat(),
            "eta_days": r.eta_days,
            "broadcast_round": r.broadcast_round,
        }
        for r in rows
    ], total
