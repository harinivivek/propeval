from datetime import datetime, timezone
from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import (
    ReportStatus,
    VendorTier,
)
from app.models.report import Report, ReportRevision
from app.models.vendor import Vendor, ServiceArea
from app.models.vendor_profile import VendorProfile, VendorRating


async def get_or_create_profile(db: AsyncSession, vendor_id: UUID) -> VendorProfile:
    result = await db.execute(
        select(VendorProfile).where(VendorProfile.vendor_id == vendor_id)
    )
    profile = result.scalar_one_or_none()
    if profile is None:
        profile = VendorProfile(vendor_id=vendor_id)
        db.add(profile)
        await db.flush()
    return profile


async def update_profile(
    db: AsyncSession, vendor_id: UUID, *, updates: dict
) -> VendorProfile:
    profile = await get_or_create_profile(db, vendor_id)
    for key, value in updates.items():
        if value is not None and hasattr(profile, key):
            setattr(profile, key, value)
    profile.profile_completeness = _calculate_completeness(profile)
    await db.flush()
    return profile


async def upload_profile_photo(
    db: AsyncSession, vendor_id: UUID, file_path: str
) -> VendorProfile:
    profile = await get_or_create_profile(db, vendor_id)
    profile.display_photo = file_path
    profile.profile_completeness = _calculate_completeness(profile)
    await db.flush()
    return profile


async def get_public_profile(db: AsyncSession, vendor_id: UUID) -> dict | None:
    result = await db.execute(
        select(VendorProfile, Vendor.name)
        .join(Vendor, Vendor.id == VendorProfile.vendor_id)
        .where(VendorProfile.vendor_id == vendor_id)
    )
    row = result.first()
    if not row:
        return None

    profile = row.VendorProfile
    vendor_name = row.name

    stats = await _get_vendor_stats(db, vendor_id)
    areas = await _get_service_areas(db, vendor_id)

    return {
        "vendor_id": str(vendor_id),
        "vendor_name": vendor_name,
        "display_photo": profile.display_photo,
        "bio": profile.bio,
        "founding_year": profile.founding_year,
        "certifications": profile.certifications,
        "specialization_tags": profile.specialization_tags,
        "quality_score": str(profile.quality_score),
        "vendor_tier": profile.vendor_tier.value if profile.vendor_tier else "NEW",
        "profile_completeness": profile.profile_completeness,
        **stats,
        "service_areas": areas,
    }


async def get_vendor_portfolio(
    db: AsyncSession, vendor_id: UUID, *, page: int = 1, page_size: int = 20
) -> dict:
    base_query = (
        select(Report)
        .where(
            Report.vendor_id == vendor_id,
            Report.status == ReportStatus.PUBLISHED,
        )
    )

    count_result = await db.execute(
        select(func.count()).select_from(base_query.subquery())
    )
    total = count_result.scalar() or 0

    result = await db.execute(
        base_query
        .order_by(Report.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    reports = result.scalars().all()

    items = []
    for r in reports:
        items.append({
            "id": str(r.id),
            "property_type": r.property_type or "",
            "report_category": r.report_category or "",
            "city": r.city or "",
            "area": r.area or None,
            "completed_at": r.created_at.isoformat() if r.created_at else None,
        })

    return {
        "items": items,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def get_tier_progress(db: AsyncSession, vendor_id: UUID) -> dict:
    profile = await get_or_create_profile(db, vendor_id)
    stats = await _get_vendor_stats(db, vendor_id)

    current_tier = profile.vendor_tier.value if profile.vendor_tier else "NEW"
    next_tier = None
    next_requirements = None

    if current_tier == "NEW":
        next_tier = "VERIFIED"
        next_requirements = {
            "min_completed_jobs": 10,
            "min_quality_score": 60,
            "current_completed_jobs": stats["total_completed_jobs"],
            "current_quality_score": str(profile.quality_score),
        }
    elif current_tier == "VERIFIED":
        next_tier = "TOP_VALUER"
        next_requirements = {
            "min_completed_jobs": 50,
            "min_quality_score": 80,
            "max_response_hours": 24,
            "current_completed_jobs": stats["total_completed_jobs"],
            "current_quality_score": str(profile.quality_score),
            "current_avg_response_hours": stats.get("avg_turnaround_hours"),
        }

    return {
        "current_tier": current_tier,
        "tier_changed_at": profile.tier_changed_at.isoformat() if profile.tier_changed_at else None,
        "quality_score": str(profile.quality_score),
        "completed_jobs": stats["total_completed_jobs"],
        "avg_rating": stats.get("avg_rating"),
        "first_time_acceptance_rate": stats.get("first_time_acceptance_rate"),
        "on_time_delivery_rate": stats.get("on_time_delivery_rate"),
        "avg_response_hours": stats.get("avg_turnaround_hours"),
        "next_tier": next_tier,
        "next_tier_requirements": next_requirements,
    }


async def recalculate_quality_score(db: AsyncSession, vendor_id: UUID) -> Decimal:
    stats = await _get_vendor_stats(db, vendor_id)
    profile = await get_or_create_profile(db, vendor_id)

    # Composite score (0-100) weighted:
    # Lender star rating average: 30%
    # First-time acceptance rate: 25%
    # On-time delivery rate: 20%
    # Revision rate (inverse): 15%
    # OCR completeness: 10%

    score = Decimal("0.00")

    # Rating component (30%) - scale 1-5 to 0-100
    avg_rating = stats.get("avg_rating")
    if avg_rating is not None:
        rating_score = Decimal(str((avg_rating - 1) / 4 * 100))
        score += rating_score * Decimal("0.30")

    # First-time acceptance rate (25%)
    ftar = stats.get("first_time_acceptance_rate")
    if ftar is not None:
        score += Decimal(str(ftar)) * Decimal("0.25")

    # On-time delivery rate (20%)
    otdr = stats.get("on_time_delivery_rate")
    if otdr is not None:
        score += Decimal(str(otdr)) * Decimal("0.20")

    # Revision rate inverse (15%) - lower revision rate = higher score
    revision_rate = stats.get("revision_rate", 0)
    if revision_rate is not None:
        inverse_revision = max(0, 100 - revision_rate)
        score += Decimal(str(inverse_revision)) * Decimal("0.15")

    # OCR completeness (10%) - default 80 if no data
    score += Decimal("80") * Decimal("0.10")

    score = min(Decimal("100.00"), max(Decimal("0.00"), score.quantize(Decimal("0.01"))))
    profile.quality_score = score
    await db.flush()

    return score


async def check_tier_promotion(db: AsyncSession, vendor_id: UUID) -> str | None:
    profile = await get_or_create_profile(db, vendor_id)
    stats = await _get_vendor_stats(db, vendor_id)
    quality = float(profile.quality_score)
    jobs = stats["total_completed_jobs"]
    promoted_to = None

    if profile.vendor_tier == VendorTier.NEW:
        if jobs >= 10 and quality >= 60:
            profile.vendor_tier = VendorTier.VERIFIED
            profile.tier_changed_at = datetime.now(timezone.utc)
            profile.tier_warning_sent_at = None
            promoted_to = "VERIFIED"

    elif profile.vendor_tier == VendorTier.VERIFIED:
        avg_resp = stats.get("avg_turnaround_hours") or 999
        if jobs >= 50 and quality >= 80 and avg_resp < 24:
            profile.vendor_tier = VendorTier.TOP_VALUER
            profile.tier_changed_at = datetime.now(timezone.utc)
            profile.tier_warning_sent_at = None
            promoted_to = "TOP_VALUER"

    if promoted_to:
        await db.flush()

    return promoted_to


async def admin_set_tier(
    db: AsyncSession, vendor_id: UUID, tier: str
) -> VendorProfile:
    profile = await get_or_create_profile(db, vendor_id)
    profile.vendor_tier = VendorTier(tier)
    profile.tier_changed_at = datetime.now(timezone.utc)
    profile.tier_warning_sent_at = None
    await db.flush()
    return profile


# --- Internal helpers ---


def _calculate_completeness(profile: VendorProfile) -> int:
    total = 0
    if profile.display_photo:
        total += 20
    if profile.bio:
        total += 25
    if profile.founding_year:
        total += 15
    if profile.certifications:
        total += 25
    if profile.specialization_tags and len(profile.specialization_tags) > 0:
        total += 15
    return total


async def _get_vendor_stats(db: AsyncSession, vendor_id: UUID) -> dict:
    # Total completed jobs (published reports by this vendor)
    completed_q = await db.execute(
        select(func.count())
        .select_from(Report)
        .where(
            Report.vendor_id == vendor_id,
            Report.status == ReportStatus.PUBLISHED,
        )
    )
    total_completed = completed_q.scalar() or 0

    # Average rating
    rating_q = await db.execute(
        select(
            func.avg(VendorRating.rating),
            func.count(VendorRating.id),
        ).where(VendorRating.vendor_id == vendor_id)
    )
    rating_row = rating_q.first()
    avg_rating = round(float(rating_row[0]), 2) if rating_row and rating_row[0] else None
    total_ratings = rating_row[1] if rating_row else 0

    # First-time acceptance rate (reports without revisions)
    if total_completed > 0:
        revised_count_q = await db.execute(
            select(func.count(func.distinct(ReportRevision.report_id)))
            .select_from(ReportRevision)
            .join(Report, Report.id == ReportRevision.report_id)
            .where(Report.vendor_id == vendor_id)
        )
        revised_count = revised_count_q.scalar() or 0
        ftar = round((total_completed - revised_count) / total_completed * 100, 1)
        revision_rate = round(revised_count / total_completed * 100, 1)
    else:
        ftar = None
        revision_rate = 0

    # Average turnaround hours (acceptance to report upload)
    avg_turnaround = None
    on_time_rate = None

    return {
        "total_completed_jobs": total_completed,
        "avg_rating": avg_rating,
        "total_ratings": total_ratings,
        "first_time_acceptance_rate": ftar,
        "avg_turnaround_hours": avg_turnaround,
        "on_time_delivery_rate": on_time_rate,
        "revision_rate": revision_rate,
    }


async def _get_service_areas(db: AsyncSession, vendor_id: UUID) -> list[dict]:
    result = await db.execute(
        select(ServiceArea).where(ServiceArea.vendor_id == vendor_id)
    )
    areas = result.scalars().all()
    return [
        {
            "city": a.city,
            "areas": a.areas,
            "service_type": a.service_type.value if a.service_type else None,
        }
        for a in areas
    ]
