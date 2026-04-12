from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user
from app.models.enums import LenderRequestStatus, VendorRequestStatus
from app.models.request import ReportRequest, RequestAcceptance, RequestBroadcast
from app.models.user import User
from app.models.lender import LenderUser
from app.models.vendor import VendorUser
from app.schemas.polling import PollResponse

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/poll", response_model=PollResponse)
async def poll(
    since: datetime | None = Query(None),
    db: AsyncSession = Depends(get_db),
    # Intentionally uses get_current_user (not require_role) — serves all
    # authenticated users and filters data by user_type at runtime.
    current_user: User = Depends(get_current_user),
):
    now = datetime.now(timezone.utc)
    if not since:
        since = datetime.min.replace(tzinfo=timezone.utc)

    incoming = 0
    updated = 0

    if current_user.user_type == "VENDOR":
        result = await db.execute(
            select(VendorUser).where(VendorUser.user_id == current_user.id)
        )
        vu = result.scalar_one_or_none()
        if vu:
            count_result = await db.execute(
                select(func.count(ReportRequest.id)).where(
                    ReportRequest.vendor_status == VendorRequestStatus.INCOMING,
                    ReportRequest.updated_at > since,
                    (
                        (ReportRequest.vendor_specified_id == vu.vendor_id)
                        | ReportRequest.id.in_(
                            select(RequestBroadcast.request_id).where(
                                RequestBroadcast.vendor_ids.any(vu.vendor_id)
                            )
                        )
                    ),
                )
            )
            incoming = count_result.scalar() or 0

    elif current_user.user_type == "LENDER":
        result = await db.execute(
            select(LenderUser).where(LenderUser.user_id == current_user.id)
        )
        lu = result.scalar_one_or_none()
        if lu:
            count_result = await db.execute(
                select(func.count(ReportRequest.id)).where(
                    ReportRequest.lender_id == lu.lender_id,
                    ReportRequest.updated_at > since,
                )
            )
            updated = count_result.scalar() or 0

    return PollResponse(
        incoming_requests=incoming,
        updated_requests=updated,
        last_checked=now,
    )
