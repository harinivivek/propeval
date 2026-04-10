from datetime import date, datetime
from decimal import Decimal
from math import ceil, floor
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    EarningType,
    ListingStatus,
    PayableType,
    PropertyType,
    ReportCategory,
    ReportStatus,
)
from app.models.listing import Listing, ListingReport
from app.models.purchase import ReportPurchase
from app.models.report import Report
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
