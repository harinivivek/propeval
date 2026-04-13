from datetime import datetime, timedelta, timezone
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import LenderRequestStatus
from app.models.request import ReportRequest, RequestAcceptance
from app.models.vendor_profile import VendorRating


async def submit_rating(
    db: AsyncSession,
    *,
    lender_user_id: UUID,
    vendor_id: UUID,
    report_request_id: UUID,
    rating: int,
) -> VendorRating:
    # Validate the request exists and is accepted
    req_result = await db.execute(
        select(ReportRequest).where(ReportRequest.id == report_request_id)
    )
    request = req_result.scalar_one_or_none()
    if not request:
        raise ValueError("Request not found")
    if request.lender_status != LenderRequestStatus.ACCEPTED:
        raise ValueError("Can only rate after report is accepted")

    # Check rating window (30 days after acceptance)
    if request.updated_at:
        window_end = request.updated_at + timedelta(days=30)
        if datetime.now(timezone.utc) > window_end:
            raise ValueError("Rating window has expired (30 days)")

    # Validate vendor was assigned to this request
    acc_result = await db.execute(
        select(RequestAcceptance).where(
            RequestAcceptance.request_id == report_request_id,
            RequestAcceptance.vendor_id == vendor_id,
        )
    )
    if not acc_result.scalar_one_or_none():
        raise ValueError("Vendor was not assigned to this request")

    # Upsert: one rating per request
    existing_result = await db.execute(
        select(VendorRating).where(
            VendorRating.report_request_id == report_request_id
        )
    )
    existing = existing_result.scalar_one_or_none()

    if existing:
        existing.rating = rating
        existing.lender_user_id = lender_user_id
        await db.flush()
        return existing

    vendor_rating = VendorRating(
        lender_user_id=lender_user_id,
        vendor_id=vendor_id,
        report_request_id=report_request_id,
        rating=rating,
    )
    db.add(vendor_rating)
    await db.flush()
    return vendor_rating


async def get_vendor_ratings(
    db: AsyncSession,
    vendor_id: UUID,
    *,
    page: int = 1,
    page_size: int = 20,
) -> dict:
    base_query = select(VendorRating).where(VendorRating.vendor_id == vendor_id)

    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        base_query.order_by(VendorRating.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    ratings = result.scalars().all()

    return {
        "items": ratings,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def get_rating_summary(db: AsyncSession, vendor_id: UUID) -> dict:
    result = await db.execute(
        select(
            func.avg(VendorRating.rating),
            func.count(VendorRating.id),
        ).where(VendorRating.vendor_id == vendor_id)
    )
    row = result.first()
    avg_rating = round(float(row[0]), 2) if row and row[0] else None
    total = row[1] if row else 0

    # Distribution
    dist_result = await db.execute(
        select(VendorRating.rating, func.count(VendorRating.id))
        .where(VendorRating.vendor_id == vendor_id)
        .group_by(VendorRating.rating)
    )
    distribution = {str(i): 0 for i in range(1, 6)}
    for r_val, count in dist_result.all():
        distribution[str(r_val)] = count

    return {
        "vendor_id": str(vendor_id),
        "avg_rating": avg_rating,
        "total_ratings": total,
        "rating_distribution": distribution,
    }
