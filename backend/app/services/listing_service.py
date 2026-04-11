from datetime import date, datetime
from decimal import Decimal
from math import ceil, floor
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    EarningType,
    ListingStatus,
    NotificationEventType,
    NotificationReferenceType,
    PayableType,
    PropertyType,
    ReportCategory,
    ReportStatus,
)
from app.models.listing import Listing, ListingReport
from app.models.purchase import ReportPurchase
from app.models.report import Report
from app.models.vendor import VendorUser
from app.services import notification_service
from app.schemas.listing import (
    ListingBrowseResponse,
    ListingDetailResponse,
    ListingResponse,
    RedactedReportPreview,
    VendorListingGroup,
    VendorListingReportItem,
    VendorListingsResponse,
)
from app.schemas.purchase import (
    PurchasedReportItem,
    PurchasedReportsResponse,
    PurchaseResponse,
)
from app.schemas.report import ReportResponse
from app.services.billing_service import create_listing_purchase_entries
from app.services.pricing_service import PricingNotFoundError, get_price


SAFE_CONTENT_FIELDS = {
    "construction_type",
    "number_of_floors",
    "land_use_zone",
    "boundary_north",
    "boundary_south",
    "boundary_east",
    "boundary_west",
    "property_description",
    "building_age",
    "road_width",
    "property_usage",
}


def _redact_address(address: str | None) -> str | None:
    if not address:
        return None
    parts = [p.strip() for p in address.split(",")]
    if len(parts) <= 1:
        return None
    return ", ".join(parts[1:])


def _round_to_nearest_100(value: Decimal | None) -> int | None:
    if value is None:
        return None
    return round(int(value) / 100) * 100


def _round_coord(value: Decimal | None) -> float | None:
    if value is None:
        return None
    return round(float(value), 2)


def _extract_safe_content(content_json: dict | None) -> dict | None:
    if not content_json:
        return None
    preview: dict = {}
    for section in ("anchor_fields", "additional_fields"):
        fields = content_json.get(section, {})
        for key, field_data in fields.items():
            if key in SAFE_CONTENT_FIELDS and isinstance(field_data, dict):
                preview[key] = field_data.get("value")
    return preview if preview else None


def redact_report_for_listing(
    report: Report, is_purchased: bool = False
) -> RedactedReportPreview:
    return RedactedReportPreview(
        id=report.id,
        report_category=report.report_category.value if hasattr(report.report_category, "value") else str(report.report_category),
        locality=_redact_address(report.property_address),
        city=report.city,
        pin_code=report.pin_code,
        property_type=report.property_type.value if hasattr(report.property_type, "value") else str(report.property_type) if report.property_type else None,
        plot_extent_sqft=_round_to_nearest_100(report.plot_extent_sqft),
        built_up_sqft=_round_to_nearest_100(report.built_up_sqft),
        report_date=report.report_date,
        latitude=_round_coord(report.latitude),
        longitude=_round_coord(report.longitude),
        content_preview=_extract_safe_content(report.content_json),
        is_purchased=is_purchased,
    )


async def _find_or_create_listing(
    db: AsyncSession, report: Report
) -> Listing:
    result = await db.execute(
        select(Listing).where(
            Listing.pin_code == report.pin_code,
            Listing.property_type == report.property_type,
        )
    )
    listing = result.scalar_one_or_none()
    if listing:
        return listing

    locality = _redact_address(report.property_address) or report.city or ""
    listing = Listing(
        macro_location=locality,
        city=report.city or "",
        pin_code=report.pin_code or "",
        property_type=report.property_type,
        status=ListingStatus.AVAILABLE,
        report_count=0,
        vendor_count=0,
    )
    db.add(listing)
    await db.flush()
    return listing


async def _update_listing_metadata(db: AsyncSession, listing: Listing) -> None:
    report_count_result = await db.execute(
        select(func.count()).select_from(ListingReport).where(
            ListingReport.listing_id == listing.id
        )
    )
    listing.report_count = report_count_result.scalar_one()

    vendor_count_result = await db.execute(
        select(func.count(func.distinct(Report.vendor_id)))
        .select_from(ListingReport)
        .join(Report, Report.id == ListingReport.report_id)
        .where(ListingReport.listing_id == listing.id)
    )
    listing.vendor_count = vendor_count_result.scalar_one()

    latest_date_result = await db.execute(
        select(func.max(Report.report_date))
        .select_from(ListingReport)
        .join(Report, Report.id == ListingReport.report_id)
        .where(ListingReport.listing_id == listing.id)
    )
    listing.latest_report_date = latest_date_result.scalar_one()

    if listing.report_count == 0:
        listing.status = ListingStatus.ARCHIVED
    elif listing.status == ListingStatus.ARCHIVED:
        listing.status = ListingStatus.AVAILABLE

    await db.flush()


async def list_report(
    db: AsyncSession, report_id: UUID, vendor_id: UUID
) -> Listing:
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_active == True)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise ValueError("Report not found")
    if report.vendor_id != vendor_id:
        raise PermissionError("Not your report")
    if report.status != ReportStatus.PUBLISHED:
        raise ValueError("Report must be published before listing")
    if not report.pin_code:
        raise ValueError("Report must have a pin code to be listed")
    if report.listing_approved:
        raise ValueError("Report is already listed")

    listing = await _find_or_create_listing(db, report)

    lr = ListingReport(
        listing_id=listing.id,
        report_id=report.id,
    )
    db.add(lr)
    report.listing_approved = True
    await db.flush()

    await _update_listing_metadata(db, listing)
    return listing


async def delist_report(
    db: AsyncSession, report_id: UUID, vendor_id: UUID
) -> None:
    result = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_active == True)
    )
    report = result.scalar_one_or_none()
    if not report:
        raise ValueError("Report not found")
    if report.vendor_id != vendor_id:
        raise PermissionError("Not your report")
    if not report.listing_approved:
        raise ValueError("Report is not listed")

    lr_result = await db.execute(
        select(ListingReport).where(ListingReport.report_id == report_id)
    )
    lr = lr_result.scalar_one_or_none()
    if not lr:
        raise ValueError("Listing report entry not found")

    listing_id = lr.listing_id
    await db.delete(lr)
    report.listing_approved = False
    await db.flush()

    listing_result = await db.execute(
        select(Listing).where(Listing.id == listing_id)
    )
    listing = listing_result.scalar_one_or_none()
    if listing:
        await _update_listing_metadata(db, listing)


async def get_listings(
    db: AsyncSession,
    *,
    city: str | None = None,
    pin_code: str | None = None,
    property_type: str | None = None,
    report_category: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> ListingBrowseResponse:
    stmt = select(Listing).where(
        Listing.status == ListingStatus.AVAILABLE,
        Listing.report_count > 0,
    )
    if city:
        stmt = stmt.where(Listing.city == city)
    if pin_code:
        stmt = stmt.where(Listing.pin_code == pin_code)
    if property_type:
        stmt = stmt.where(Listing.property_type == PropertyType(property_type))

    if report_category:
        cat = ReportCategory(report_category)
        stmt = stmt.where(
            Listing.id.in_(
                select(ListingReport.listing_id)
                .join(Report, Report.id == ListingReport.report_id)
                .where(Report.report_category == cat)
            )
        )

    count_result = await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )
    total = count_result.scalar_one()

    stmt = stmt.order_by(Listing.latest_report_date.desc().nullslast())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    listings = list(result.scalars().all())

    return ListingBrowseResponse(
        listings=[ListingResponse.model_validate(l) for l in listings],
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_listing_detail(
    db: AsyncSession,
    listing_id: UUID,
    lender_id: UUID,
) -> ListingDetailResponse:
    listing_result = await db.execute(
        select(Listing).where(Listing.id == listing_id)
    )
    listing = listing_result.scalar_one_or_none()
    if not listing:
        raise ValueError("Listing not found")

    reports_result = await db.execute(
        select(Report)
        .join(ListingReport, ListingReport.report_id == Report.id)
        .where(
            ListingReport.listing_id == listing_id,
            Report.status == ReportStatus.PUBLISHED,
            Report.is_active == True,
        )
        .order_by(Report.report_date.desc().nullslast())
    )
    reports = list(reports_result.scalars().all())

    purchased_ids: set = set()
    if reports:
        purchased_result = await db.execute(
            select(ReportPurchase.report_id).where(
                ReportPurchase.lender_id == lender_id,
                ReportPurchase.report_id.in_([r.id for r in reports]),
            )
        )
        purchased_ids = set(purchased_result.scalars().all())

    previews = [
        redact_report_for_listing(r, is_purchased=(r.id in purchased_ids))
        for r in reports
    ]

    return ListingDetailResponse(
        listing=ListingResponse.model_validate(listing),
        reports=previews,
    )


async def purchase_report(
    db: AsyncSession,
    *,
    report_id: UUID,
    listing_id: UUID,
    lender_id: UUID,
    user_id: UUID,
) -> PurchaseResponse:
    lr_result = await db.execute(
        select(ListingReport).where(
            ListingReport.listing_id == listing_id,
            ListingReport.report_id == report_id,
        )
    )
    if not lr_result.scalar_one_or_none():
        raise ValueError("Report is not in this listing")

    existing = await db.execute(
        select(ReportPurchase).where(
            ReportPurchase.report_id == report_id,
            ReportPurchase.lender_id == lender_id,
        )
    )
    if existing.scalar_one_or_none():
        raise ValueError("Already purchased")

    report_result = await db.execute(
        select(Report).where(Report.id == report_id, Report.is_active == True)
    )
    report = report_result.scalar_one_or_none()
    if not report:
        raise ValueError("Report not found")

    try:
        price_result = await get_price(
            db,
            lender_id=lender_id,
            report_category=report.report_category.value if hasattr(report.report_category, "value") else str(report.report_category),
            city=report.city or "",
            area=None,
            property_type=report.property_type.value if hasattr(report.property_type, "value") else str(report.property_type),
            request_type="LISTING_DOWNLOAD",
        )
    except PricingNotFoundError:
        raise ValueError("No pricing rule configured for this report. Contact admin.")

    purchase = ReportPurchase(
        report_id=report_id,
        listing_id=listing_id,
        lender_id=lender_id,
        purchased_by=user_id,
        price=price_result.amount,
    )
    db.add(purchase)
    await db.flush()

    await create_listing_purchase_entries(
        db,
        report_id=report_id,
        vendor_id=report.vendor_id,
        lender_id=lender_id,
        amount=price_result.amount,
    )

    # Notify vendor users that their report was purchased/downloaded
    vendor_users_stmt = select(VendorUser.user_id).where(VendorUser.vendor_id == report.vendor_id)
    vendor_user_ids = (await db.execute(vendor_users_stmt)).scalars().all()
    for user_id in vendor_user_ids:
        await notification_service.create_notification(
            db,
            user_id=user_id,
            event_type=NotificationEventType.LISTING_DOWNLOADED,
            title="Report downloaded",
            message=f"A lender has purchased your report for {report.property_address or 'a property'}",
            reference_id=report.id,
            reference_type=NotificationReferenceType.REPORT,
        )

    return PurchaseResponse.model_validate(purchase)


async def get_purchased_reports(
    db: AsyncSession,
    lender_id: UUID,
    *,
    page: int = 1,
    page_size: int = 20,
) -> PurchasedReportsResponse:
    stmt = select(ReportPurchase).where(
        ReportPurchase.lender_id == lender_id
    )

    count_result = await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )
    total = count_result.scalar_one()

    stmt = stmt.order_by(ReportPurchase.created_at.desc())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    purchases = list(result.scalars().all())

    report_ids = [p.report_id for p in purchases]
    reports_result = await db.execute(
        select(Report).where(Report.id.in_(report_ids))
    ) if report_ids else None
    reports_map = {r.id: r for r in (reports_result.scalars().all() if reports_result else [])}

    items = []
    for p in purchases:
        report = reports_map.get(p.report_id)
        if report:
            items.append(PurchasedReportItem(
                purchase=PurchaseResponse.model_validate(p),
                report=ReportResponse.model_validate(report),
            ))

    return PurchasedReportsResponse(
        items=items,
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_vendor_listings(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    city: str | None = None,
    property_type: str | None = None,
    page: int = 1,
    page_size: int = 20,
) -> VendorListingsResponse:
    listing_ids_stmt = (
        select(ListingReport.listing_id)
        .join(Report, Report.id == ListingReport.report_id)
        .where(Report.vendor_id == vendor_id)
        .distinct()
    )

    stmt = select(Listing).where(Listing.id.in_(listing_ids_stmt))
    if city:
        stmt = stmt.where(Listing.city == city)
    if property_type:
        stmt = stmt.where(Listing.property_type == PropertyType(property_type))

    count_result = await db.execute(
        select(func.count()).select_from(stmt.subquery())
    )
    total = count_result.scalar_one()

    stmt = stmt.order_by(Listing.latest_report_date.desc().nullslast())
    stmt = stmt.offset((page - 1) * page_size).limit(page_size)
    result = await db.execute(stmt)
    listings = list(result.scalars().all())

    listing_ids = [l.id for l in listings]
    all_reports_result = await db.execute(
        select(Report, ListingReport.listing_id)
        .join(ListingReport, ListingReport.report_id == Report.id)
        .where(
            ListingReport.listing_id.in_(listing_ids),
            Report.vendor_id == vendor_id,
        )
        .order_by(Report.report_date.desc().nullslast())
    ) if listing_ids else None

    reports_by_listing: dict[UUID, list[Report]] = {lid: [] for lid in listing_ids}
    if all_reports_result:
        for report, lid in all_reports_result.all():
            reports_by_listing.setdefault(lid, []).append(report)

    groups = []
    for listing in listings:
        reports = reports_by_listing.get(listing.id, [])
        groups.append(VendorListingGroup(
            listing=ListingResponse.model_validate(listing),
            reports=[VendorListingReportItem.model_validate(r) for r in reports],
        ))

    return VendorListingsResponse(
        groups=groups,
        total=total,
        page=page,
        page_size=page_size,
    )


async def get_listings_map_data(
    db: AsyncSession,
    city: str | None = None,
    pin_code: str | None = None,
    property_type: str | None = None,
    report_category: str | None = None,
) -> dict:
    query = select(Listing).where(
        Listing.status == ListingStatus.AVAILABLE,
        Listing.report_count > 0,
        Listing.latitude.isnot(None),
        Listing.longitude.isnot(None),
    )

    if city:
        query = query.where(Listing.city == city)
    if pin_code:
        query = query.where(Listing.pin_code == pin_code)
    if property_type:
        query = query.where(Listing.property_type == property_type)
    if report_category:
        query = query.where(
            Listing.id.in_(
                select(ListingReport.listing_id)
                .join(Report, Report.id == ListingReport.report_id)
                .where(Report.report_category == report_category)
            )
        )

    result = await db.execute(query)
    listings = result.scalars().all()

    return {
        "items": [
            {
                "listing_id": str(lst.id),
                "latitude": float(lst.latitude),
                "longitude": float(lst.longitude),
                "macro_location": lst.macro_location,
                "city": lst.city,
                "pin_code": lst.pin_code,
                "property_type": lst.property_type.value if lst.property_type else None,
                "report_count": lst.report_count,
                "vendor_count": lst.vendor_count,
                "latest_report_date": lst.latest_report_date.isoformat() if lst.latest_report_date else None,
            }
            for lst in listings
        ]
    }


async def get_listable_reports(
    db: AsyncSession,
    vendor_id: UUID,
) -> list[VendorListingReportItem]:
    result = await db.execute(
        select(Report).where(
            Report.vendor_id == vendor_id,
            Report.status == ReportStatus.PUBLISHED,
            Report.listing_approved == False,
            Report.is_active == True,
            Report.pin_code.isnot(None),
        ).order_by(Report.report_date.desc().nullslast())
    )
    reports = list(result.scalars().all())
    return [VendorListingReportItem.model_validate(r) for r in reports]
