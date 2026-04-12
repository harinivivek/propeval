from datetime import datetime, timedelta, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.services.system_config_service import get_config_values
from app.models.enums import (
    BroadcastStatus,
    LenderRequestStatus,
    ServiceType,
    VendorRequestStatus,
)
from app.models.enums import NotificationEventType, NotificationReferenceType
from app.models.request import ReportRequest, RequestAcceptance, RequestBroadcast
from app.models.vendor import ServiceArea, Vendor, VendorUser
from app.services import notification_service, push_service
from app.services.activity_log_service import log_activity


class NoVendorsAvailableError(Exception):
    pass


async def get_eligible_vendors(
    db: AsyncSession,
    *,
    city: str,
    area: str | None = None,
    report_category: str,
    exclude_request_id: UUID | None = None,
    request_price: Decimal | None = None,
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
    vendors = list(result.scalars().all())

    # Filter by vendor price threshold (batch query instead of N+1)
    if request_price is not None:
        from app.models.vendor_config import VendorConfig
        vendor_ids = [v.id for v in vendors]
        if vendor_ids:
            config_result = await db.execute(
                select(VendorConfig).where(VendorConfig.vendor_id.in_(vendor_ids))
            )
            config_map = {c.vendor_id: c for c in config_result.scalars().all()}
            vendors = [
                v for v in vendors
                if v.id not in config_map
                or config_map[v.id].price_threshold is None
                or request_price >= config_map[v.id].price_threshold
            ]

    return vendors


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
    config = await get_config_values()

    vendors = await get_eligible_vendors(
        db,
        city=request.city,
        area=request.area,
        report_category=request.report_category.value,
        exclude_request_id=request.id,
        request_price=request.price,
    )

    if not vendors:
        raise NoVendorsAvailableError(
            f"No vendors available for city={request.city}, "
            f"area={request.area}, category={request.report_category}"
        )

    batch = vendors[:config["vendors_per_broadcast_round"]]
    deadline = datetime.now(timezone.utc) + timedelta(minutes=config["broadcast_accept_window_minutes"])

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

    # Batch-fetch all vendor users for notification
    vendor_ids = [v.id for v in batch]
    vu_result = await db.execute(
        select(VendorUser.vendor_id, VendorUser.user_id)
        .where(VendorUser.vendor_id.in_(vendor_ids))
    )
    vendor_user_map: dict = {}
    for row in vu_result.all():
        vendor_user_map.setdefault(row.vendor_id, []).append(row.user_id)

    all_notified_user_ids = []
    for vid in vendor_ids:
        for user_id in vendor_user_map.get(vid, []):
            await notification_service.create_notification(
                db,
                user_id=user_id,
                event_type=NotificationEventType.NEW_BROADCAST,
                title="New request broadcast",
                message=f"{request.report_category.value} report request for {request.property_address or 'a property'}",
                reference_id=request.id,
                reference_type=NotificationReferenceType.REQUEST,
            )
            all_notified_user_ids.append(user_id)

    await push_service.send_push_to_users(
        db,
        user_ids=all_notified_user_ids,
        title="New Request Available",
        body=f"{request.report_category.value} report request",
        url="/vendor/requests",
    )

    await log_activity(
        db,
        actor_id=None,
        actor_type="SYSTEM",
        action="REQUEST_CREATED",
        target_type="REQUEST",
        target_id=request.id,
        metadata={"broadcast_round": 1},
    )

    return broadcast


async def advance_broadcast_round(
    db: AsyncSession,
    *,
    request: ReportRequest,
    current_broadcast: RequestBroadcast,
) -> RequestBroadcast | None:
    """Expire current round and start next if vendors available."""
    config = await get_config_values()

    current_broadcast.status = BroadcastStatus.EXPIRED
    await db.flush()

    vendors = await get_eligible_vendors(
        db,
        city=request.city,
        area=request.area,
        report_category=request.report_category.value,
        exclude_request_id=request.id,
        request_price=request.price,
    )

    if not vendors:
        return None

    batch = vendors[:config["vendors_per_broadcast_round"]]
    deadline = datetime.now(timezone.utc) + timedelta(minutes=config["broadcast_accept_window_minutes"])

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

    # Batch-fetch all vendor users for notification
    next_vendor_ids = [v.id for v in batch]
    vu_result = await db.execute(
        select(VendorUser.vendor_id, VendorUser.user_id)
        .where(VendorUser.vendor_id.in_(next_vendor_ids))
    )
    vendor_user_map: dict = {}
    for row in vu_result.all():
        vendor_user_map.setdefault(row.vendor_id, []).append(row.user_id)

    all_notified_user_ids = []
    for vid in next_vendor_ids:
        for user_id in vendor_user_map.get(vid, []):
            await notification_service.create_notification(
                db,
                user_id=user_id,
                event_type=NotificationEventType.NEW_BROADCAST,
                title="New request broadcast",
                message=f"{request.report_category.value} report request for {request.property_address or 'a property'}",
                reference_id=request.id,
                reference_type=NotificationReferenceType.REQUEST,
            )
            all_notified_user_ids.append(user_id)

    await push_service.send_push_to_users(
        db,
        user_ids=all_notified_user_ids,
        title="New Request Available",
        body=f"{request.report_category.value} report request",
        url="/vendor/requests",
    )

    await log_activity(
        db,
        actor_id=None,
        actor_type="SYSTEM",
        action="REQUEST_CREATED",
        target_type="REQUEST",
        target_id=request.id,
        metadata={"broadcast_round": next_broadcast.broadcast_round},
    )

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
