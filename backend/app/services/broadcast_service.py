from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.constants import BROADCAST_ACCEPT_WINDOW_MINUTES, VENDORS_PER_BROADCAST_ROUND
from app.models.enums import (
    BroadcastStatus,
    LenderRequestStatus,
    ServiceType,
    VendorRequestStatus,
)
from app.models.request import ReportRequest, RequestAcceptance, RequestBroadcast
from app.models.vendor import ServiceArea, Vendor


class NoVendorsAvailableError(Exception):
    pass


async def get_eligible_vendors(
    db: AsyncSession,
    *,
    city: str,
    area: str | None = None,
    report_category: str,
    exclude_request_id: UUID | None = None,
) -> list[Vendor]:
    """Find vendors matching city/area/service_type, excluding already-broadcast ones."""
    service_type = ServiceType(report_category)

    stmt = (
        select(Vendor)
        .join(ServiceArea, ServiceArea.vendor_id == Vendor.id)
        .where(
            ServiceArea.city == city,
            ServiceArea.service_type == service_type,
        )
    )

    # Match area: vendor covers specific area OR serves entire city (areas is NULL)
    if area:
        stmt = stmt.where(
            (ServiceArea.areas.is_(None)) | (ServiceArea.areas.any(area))
        )

    # Exclude vendors already broadcast for this request
    if exclude_request_id:
        subq = (
            select(func.unnest(RequestBroadcast.vendor_ids))
            .where(RequestBroadcast.request_id == exclude_request_id)
            .scalar_subquery()
        )
        stmt = stmt.where(Vendor.id.not_in(subq))

    stmt = stmt.distinct().order_by(Vendor.created_at)
    result = await db.execute(stmt)
    return list(result.scalars().all())


async def assign_direct(
    db: AsyncSession,
    *,
    request: ReportRequest,
    vendor_id: UUID,
) -> None:
    """Assign a request directly to a specified vendor (no broadcast)."""
    request.vendor_specified_id = vendor_id
    request.vendor_status = VendorRequestStatus.INCOMING
    await db.flush()


async def start_broadcast(
    db: AsyncSession,
    *,
    request: ReportRequest,
) -> RequestBroadcast:
    """Start broadcast round 1 for a request."""
    vendors = await get_eligible_vendors(
        db,
        city=request.city,
        area=request.area,
        report_category=request.report_category.value,
        exclude_request_id=request.id,
    )

    if not vendors:
        raise NoVendorsAvailableError(
            f"No vendors available for city={request.city}, "
            f"area={request.area}, category={request.report_category}"
        )

    batch = vendors[:VENDORS_PER_BROADCAST_ROUND]
    deadline = datetime.now(timezone.utc) + timedelta(minutes=BROADCAST_ACCEPT_WINDOW_MINUTES)

    broadcast = RequestBroadcast(
        request_id=request.id,
        vendor_ids=[v.id for v in batch],
        broadcast_round=1,
        accept_deadline=deadline,
        status=BroadcastStatus.ACTIVE,
    )
    db.add(broadcast)

    request.vendor_status = VendorRequestStatus.INCOMING
    await db.flush()
    return broadcast


async def advance_broadcast_round(
    db: AsyncSession,
    *,
    request: ReportRequest,
    current_broadcast: RequestBroadcast,
) -> RequestBroadcast | None:
    """Expire current round and start next if vendors available."""
    current_broadcast.status = BroadcastStatus.EXPIRED
    await db.flush()

    vendors = await get_eligible_vendors(
        db,
        city=request.city,
        area=request.area,
        report_category=request.report_category.value,
        exclude_request_id=request.id,
    )

    if not vendors:
        return None

    batch = vendors[:VENDORS_PER_BROADCAST_ROUND]
    deadline = datetime.now(timezone.utc) + timedelta(minutes=BROADCAST_ACCEPT_WINDOW_MINUTES)

    next_broadcast = RequestBroadcast(
        request_id=request.id,
        vendor_ids=[v.id for v in batch],
        broadcast_round=current_broadcast.broadcast_round + 1,
        accept_deadline=deadline,
        status=BroadcastStatus.ACTIVE,
    )
    db.add(next_broadcast)

    request.vendor_status = VendorRequestStatus.INCOMING
    await db.flush()
    return next_broadcast


async def accept_request(
    db: AsyncSession,
    *,
    request: ReportRequest,
    vendor_id: UUID,
) -> RequestAcceptance:
    """Vendor accepts a request."""
    acceptance = RequestAcceptance(
        request_id=request.id,
        vendor_id=vendor_id,
    )
    db.add(acceptance)

    request.vendor_status = VendorRequestStatus.PENDING
    request.lender_status = LenderRequestStatus.AWAITED

    # Mark active broadcast as ACCEPTED
    result = await db.execute(
        select(RequestBroadcast).where(
            RequestBroadcast.request_id == request.id,
            RequestBroadcast.status == BroadcastStatus.ACTIVE,
        )
    )
    active_broadcast = result.scalar_one_or_none()
    if active_broadcast:
        active_broadcast.status = BroadcastStatus.ACCEPTED

    await db.flush()
    return acceptance


async def reject_request(
    db: AsyncSession,
    *,
    request: ReportRequest,
    vendor_id: UUID,
    reason: str,
    message: str | None = None,
) -> str:
    """Vendor rejects a request. Returns action taken."""
    if (
        request.vendor_specified_id == vendor_id
        and request.allow_broadcast_on_reject
    ):
        request.vendor_specified_id = None
        try:
            await start_broadcast(db, request=request)
            return "broadcast_started"
        except NoVendorsAvailableError:
            request.vendor_status = VendorRequestStatus.DENIED
            await db.flush()
            return "no_vendors"

    request.vendor_status = VendorRequestStatus.DENIED
    await db.flush()
    return "rejected"
