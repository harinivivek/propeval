from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    LenderRequestStatus,
    ListingStatus,
    PayableType,
    PropertyType,
    ReportCategory,
    RequestType,
    VendorRequestStatus,
)
from app.models.enums import NotificationEventType, NotificationReferenceType
from app.models.listing import Listing, ListingReport
from app.models.report import Report, ReportRevision
from app.models.request import ReportRequest, RequestBroadcast
from app.models.lender import LenderUser
from app.models.vendor import VendorUser
from app.services import billing_service, broadcast_service, notification_service, pricing_service
from app.services.activity_log_service import log_activity


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
    request_type: str = "NEW",
    parent_report_id: UUID | None = None,
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
        request_type=request_type,
    )

    request = ReportRequest(
        lender_id=lender_id,
        lender_user_id=lender_user_id,
        branch_id=branch_id,
        request_type=RequestType(request_type),
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
        parent_report_id=parent_report_id,
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

    await log_activity(
        db,
        actor_id=lender_user_id,
        actor_type="LENDER",
        action="REQUEST_CREATED",
        target_type="REQUEST",
        target_id=request.id,
        metadata={"request_type": request.request_type.value},
    )

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
    _PAYABLE_TYPE_MAP = {
        RequestType.NEW: PayableType.NEW_REQUEST,
        RequestType.UPDATE: PayableType.UPDATE,
        RequestType.NEARBY: PayableType.NEARBY,
    }
    payable_type = _PAYABLE_TYPE_MAP.get(request.request_type, PayableType.NEW_REQUEST)

    await billing_service.create_billing_entries(
        db, request=request, report=report, vendor_id=vendor_id,
        payable_type=payable_type,
    )

    # Create or update listing
    await _create_or_update_listing(db, report=report)

    await db.flush()

    # Notify vendor users that their acceptance was confirmed
    vendor_users_stmt = select(VendorUser.user_id).where(VendorUser.vendor_id == vendor_id)
    vendor_user_ids = (await db.execute(vendor_users_stmt)).scalars().all()
    for user_id in vendor_user_ids:
        await notification_service.create_notification(
            db,
            user_id=user_id,
            event_type=NotificationEventType.REQUEST_ACCEPTED,
            title="Request accepted",
            message=f"Your acceptance for the {request.report_category.value} request has been confirmed",
            reference_id=request.id,
            reference_type=NotificationReferenceType.REQUEST,
        )

    await log_activity(
        db,
        actor_id=vendor_id,
        actor_type="VENDOR",
        action="REQUEST_ACCEPTED",
        target_type="REQUEST",
        target_id=request.id,
    )


async def check_auto_approve(
    db: AsyncSession,
    *,
    request: ReportRequest,
    report: Report,
    vendor_id: UUID,
) -> bool:
    """Check if lender has auto-approve enabled for this vendor. If yes, auto-accept."""
    from app.services.lender_config_service import is_auto_approve

    if not await is_auto_approve(db, request.lender_id, vendor_id):
        return False

    # Auto-accept: same logic as manual accept
    request.lender_status = LenderRequestStatus.ACCEPTED
    request.vendor_status = VendorRequestStatus.ACCEPTED
    report.listing_approved = True

    _PAYABLE_TYPE_MAP = {
        RequestType.NEW: PayableType.NEW_REQUEST,
        RequestType.UPDATE: PayableType.UPDATE,
        RequestType.NEARBY: PayableType.NEARBY,
    }
    payable_type = _PAYABLE_TYPE_MAP.get(request.request_type, PayableType.NEW_REQUEST)

    await billing_service.create_billing_entries(
        db, request=request, report=report, vendor_id=vendor_id,
        payable_type=payable_type,
    )

    await _create_or_update_listing(db, report=report)
    await db.flush()

    # Notify lender users about auto-approve
    lender_users_stmt = select(LenderUser.user_id).where(
        LenderUser.lender_id == request.lender_id
    )
    lender_user_ids = (await db.execute(lender_users_stmt)).scalars().all()
    for user_id in lender_user_ids:
        await notification_service.create_notification(
            db,
            user_id=user_id,
            event_type=NotificationEventType.REQUEST_ACCEPTED,
            title="Report auto-approved",
            message="Report was auto-approved based on your vendor preferences",
            reference_id=request.id,
            reference_type=NotificationReferenceType.REQUEST,
        )

    await log_activity(
        db,
        actor_id=vendor_id,
        actor_type="SYSTEM",
        action="REPORT_AUTO_APPROVED",
        target_type="REQUEST",
        target_id=request.id,
    )

    # Check auto-listing
    await _check_auto_listing(db, report=report, vendor_id=vendor_id)

    return True


async def _check_auto_listing(
    db: AsyncSession,
    *,
    report: Report,
    vendor_id: UUID,
) -> None:
    """If vendor has auto-listing enabled, auto-list the accepted report."""
    from app.services.vendor_config_service import get_vendor_config

    config = await get_vendor_config(db, vendor_id)
    if not config.auto_listing_enabled:
        return

    # Reuse existing listing logic
    await _create_or_update_listing(db, report=report)


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

    # Notify vendor users that a revision has been requested
    vendor_users_stmt = select(VendorUser.user_id).where(VendorUser.vendor_id == report.vendor_id)
    vendor_user_ids = (await db.execute(vendor_users_stmt)).scalars().all()
    for user_id in vendor_user_ids:
        await notification_service.create_notification(
            db,
            user_id=user_id,
            event_type=NotificationEventType.REVISION_REQUESTED,
            title="Revision requested",
            message=f"A revision has been requested for the report at {report.property_address or 'a property'}",
            reference_id=report.id,
            reference_type=NotificationReferenceType.REPORT,
        )

    await log_activity(
        db,
        actor_id=request.lender_user_id,
        actor_type="LENDER",
        action="REPORT_REVISION_REQUESTED",
        target_type="REPORT",
        target_id=report.id,
    )

    return revision


async def _create_or_update_listing(
    db: AsyncSession,
    *,
    report: Report,
) -> Listing:
    """Find or create a listing for this report's location."""
    macro = report.macro_location or report.city or "Unknown"

    pin_code = report.pin_code or ""
    result = await db.execute(
        select(Listing).where(
            Listing.pin_code == pin_code,
            Listing.property_type == report.property_type,
        )
    )
    listing = result.scalar_one_or_none()

    if not listing:
        listing = Listing(
            macro_location=macro,
            city=report.city or "",
            pin_code=pin_code,
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
