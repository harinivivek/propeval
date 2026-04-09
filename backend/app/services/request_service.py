from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    LenderRequestStatus,
    ListingStatus,
    PropertyType,
    ReportCategory,
    RequestType,
    VendorRequestStatus,
)
from app.models.listing import Listing, ListingReport
from app.models.report import Report, ReportRevision
from app.models.request import ReportRequest, RequestBroadcast
from app.services import billing_service, broadcast_service, pricing_service


class InvalidStatusTransition(Exception):
    pass


async def create_request(
    db: AsyncSession,
    *,
    lender_id: UUID,
    lender_user_id: UUID,
    branch_id: UUID | None = None,
    report_category: str,
    property_address: str,
    city: str,
    area: str | None = None,
    pin_code: str | None = None,
    property_type: str,
    plot_extent_sqft: Decimal | None = None,
    built_up_sqft: Decimal | None = None,
    loan_applicant_name: str,
    vendor_specified_id: UUID | None = None,
    allow_broadcast_on_reject: bool = True,
    comments: str | None = None,
) -> ReportRequest:
    """Create a new report request with pricing, then assign or broadcast."""
    # Calculate price
    price_result = await pricing_service.get_price(
        db,
        lender_id=lender_id,
        report_category=report_category,
        city=city,
        area=area,
        property_type=property_type,
        request_type="NEW",
    )

    request = ReportRequest(
        lender_id=lender_id,
        lender_user_id=lender_user_id,
        branch_id=branch_id,
        request_type=RequestType.NEW,
        report_category=ReportCategory(report_category),
        property_type=PropertyType(property_type),
        property_address=property_address,
        city=city,
        area=area,
        plot_extent_sqft=plot_extent_sqft,
        loan_applicant_name=loan_applicant_name,
        price=price_result.amount,
        vendor_specified_id=vendor_specified_id,
        allow_broadcast_on_reject=allow_broadcast_on_reject,
        comments=comments,
        lender_status=LenderRequestStatus.SENT,
    )
    db.add(request)
    await db.flush()

    # Assign to vendor or broadcast
    if vendor_specified_id:
        await broadcast_service.assign_direct(
            db, request=request, vendor_id=vendor_specified_id,
        )
    else:
        await broadcast_service.start_broadcast(db, request=request)

    await db.refresh(request)
    return request


async def list_requests(
    db: AsyncSession,
    *,
    lender_id: UUID | None = None,
    vendor_id: UUID | None = None,
    status_filter: str | None = None,
    report_category: str | None = None,
    property_type: str | None = None,
    page: int = 1,
    per_page: int = 20,
) -> list[ReportRequest]:
    """List requests scoped by lender or vendor."""
    stmt = select(ReportRequest)

    if lender_id:
        stmt = stmt.where(ReportRequest.lender_id == lender_id)

    if status_filter:
        if status_filter == "pending":
            stmt = stmt.where(
                ReportRequest.lender_status.in_([
                    LenderRequestStatus.SENT,
                    LenderRequestStatus.AWAITED,
                ])
            )
        elif status_filter == "active":
            stmt = stmt.where(
                ReportRequest.lender_status.in_([
                    LenderRequestStatus.RECEIVED,
                    LenderRequestStatus.SENT_FOR_REVIEW,
                ])
            )
        elif status_filter == "completed":
            stmt = stmt.where(
                ReportRequest.lender_status == LenderRequestStatus.ACCEPTED
            )

    if report_category:
        stmt = stmt.where(
            ReportRequest.report_category == ReportCategory(report_category)
        )
    if property_type:
        stmt = stmt.where(
            ReportRequest.property_type == PropertyType(property_type)
        )

    stmt = stmt.order_by(ReportRequest.created_at.desc())
    stmt = stmt.offset((page - 1) * per_page).limit(per_page)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def get_request(db: AsyncSession, request_id: UUID) -> ReportRequest | None:
    result = await db.execute(
        select(ReportRequest).where(ReportRequest.id == request_id)
    )
    return result.scalar_one_or_none()


async def accept_report(
    db: AsyncSession,
    *,
    request: ReportRequest,
    report: Report,
    vendor_id: UUID,
) -> None:
    """Lender accepts the report — billing + listing."""
    if request.lender_status not in (
        LenderRequestStatus.RECEIVED,
    ):
        raise InvalidStatusTransition(
            f"Cannot accept from status {request.lender_status}"
        )

    request.lender_status = LenderRequestStatus.ACCEPTED
    request.vendor_status = VendorRequestStatus.ACCEPTED
    report.listing_approved = True

    # Create billing entries
    await billing_service.create_billing_entries(
        db, request=request, report=report, vendor_id=vendor_id,
    )

    # Create or update listing
    await _create_or_update_listing(db, report=report)

    await db.flush()


async def reject_report(
    db: AsyncSession,
    *,
    request: ReportRequest,
    report: Report,
    comments: str,
) -> ReportRevision:
    """Lender sends report back for revision."""
    if request.lender_status not in (
        LenderRequestStatus.RECEIVED,
    ):
        raise InvalidStatusTransition(
            f"Cannot reject from status {request.lender_status}"
        )

    request.lender_status = LenderRequestStatus.SENT_FOR_REVIEW
    request.vendor_status = VendorRequestStatus.REVISION

    # Get next revision number
    result = await db.execute(
        select(func.coalesce(func.max(ReportRevision.revision_number), 0))
        .where(ReportRevision.report_id == report.id)
    )
    max_rev = result.scalar()

    revision = ReportRevision(
        report_id=report.id,
        revision_number=max_rev + 1,
        comments=comments,
    )
    db.add(revision)
    await db.flush()
    return revision


async def _create_or_update_listing(
    db: AsyncSession,
    *,
    report: Report,
) -> Listing:
    """Find or create a listing for this report's location."""
    macro = report.macro_location or report.city or "Unknown"

    result = await db.execute(
        select(Listing).where(
            Listing.city == report.city,
            Listing.macro_location == macro,
            Listing.property_type == report.property_type,
            Listing.is_active == True,
        )
    )
    listing = result.scalar_one_or_none()

    if not listing:
        listing = Listing(
            macro_location=macro,
            city=report.city,
            property_type=report.property_type,
            status=ListingStatus.AVAILABLE,
            report_count=0,
        )
        db.add(listing)
        await db.flush()

    listing.report_count += 1
    listing.latest_report_date = report.report_date

    lr = ListingReport(
        listing_id=listing.id,
        report_id=report.id,
    )
    db.add(lr)
    await db.flush()
    return listing
