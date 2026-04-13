from decimal import Decimal
from uuid import UUID

from sqlalchemy import func, select, or_, and_, cast, Float
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import ListingStatus, VendorTier
from app.models.listing import Listing, ListingReport
from app.models.locality import Locality
from app.models.report import Report
from app.models.request import RequestAcceptance
from app.models.vendor import Vendor, ServiceArea
from app.models.vendor_profile import VendorProfile, VendorRating


async def search_marketplace(
    db: AsyncSession,
    *,
    city: str | None = None,
    pin_code: str | None = None,
    property_type: str | None = None,
    report_category: str | None = None,
    min_rating: float | None = None,
    vendor_tier: str | None = None,
    result_type: str | None = None,  # "reports", "vendors", or None for both
    page: int = 1,
    page_size: int = 20,
    sort_by: str = "relevance",
    # Map bounds
    min_lat: float | None = None,
    max_lat: float | None = None,
    min_lng: float | None = None,
    max_lng: float | None = None,
) -> dict:
    results = []

    # --- Report listings ---
    if result_type != "vendors":
        report_results = await _search_listings(
            db,
            city=city,
            pin_code=pin_code,
            property_type=property_type,
            min_lat=min_lat,
            max_lat=max_lat,
            min_lng=min_lng,
            max_lng=max_lng,
        )
        results.extend(report_results)

    # --- Vendor results ---
    if result_type != "reports":
        vendor_results = await _search_vendors(
            db,
            city=city,
            min_rating=min_rating,
            vendor_tier=vendor_tier,
        )
        results.extend(vendor_results)

    # Sort
    if sort_by == "rating":
        results.sort(key=lambda r: r.get("avg_rating") or 0, reverse=True)
    elif sort_by == "recency":
        results.sort(key=lambda r: r.get("latest_report_date") or "", reverse=True)
    else:
        # Default: reports first, then vendors
        results.sort(key=lambda r: (0 if r["result_type"] == "report" else 1))

    total = len(results)
    start = (page - 1) * page_size
    page_results = results[start : start + page_size]

    return {
        "results": page_results,
        "total": total,
        "page": page,
        "page_size": page_size,
    }


async def search_map_bounds(
    db: AsyncSession,
    *,
    min_lat: float,
    max_lat: float,
    min_lng: float,
    max_lng: float,
    property_type: str | None = None,
) -> list[dict]:
    return await _search_listings(
        db,
        property_type=property_type,
        min_lat=min_lat,
        max_lat=max_lat,
        min_lng=min_lng,
        max_lng=max_lng,
    )


async def autocomplete_localities(
    db: AsyncSession,
    *,
    query: str,
    limit: int = 10,
) -> list[dict]:
    q = query.strip().lower()
    if not q:
        return []

    result = await db.execute(
        select(Locality)
        .where(
            or_(
                func.lower(Locality.name).contains(q),
                Locality.pin_code.startswith(q),
                func.lower(Locality.city).contains(q),
            )
        )
        .order_by(Locality.city, Locality.name)
        .limit(limit)
    )
    localities = result.scalars().all()

    return [
        {
            "id": str(loc.id),
            "name": loc.name,
            "pin_code": loc.pin_code,
            "city": loc.city,
            "state": loc.state,
            "lat": str(loc.lat) if loc.lat else None,
            "lng": str(loc.lng) if loc.lng else None,
        }
        for loc in localities
    ]


# --- Internal helpers ---


async def _search_listings(
    db: AsyncSession,
    *,
    city: str | None = None,
    pin_code: str | None = None,
    property_type: str | None = None,
    min_lat: float | None = None,
    max_lat: float | None = None,
    min_lng: float | None = None,
    max_lng: float | None = None,
) -> list[dict]:
    query = select(Listing).where(
        Listing.status == ListingStatus.AVAILABLE,
        Listing.is_active == True,
    )

    if city:
        query = query.where(func.lower(Listing.city) == city.lower())
    if pin_code:
        query = query.where(Listing.pin_code == pin_code)
    if property_type:
        query = query.where(Listing.property_type == property_type)
    if min_lat is not None and max_lat is not None:
        query = query.where(
            cast(Listing.latitude, Float) >= min_lat,
            cast(Listing.latitude, Float) <= max_lat,
        )
    if min_lng is not None and max_lng is not None:
        query = query.where(
            cast(Listing.longitude, Float) >= min_lng,
            cast(Listing.longitude, Float) <= max_lng,
        )

    query = query.order_by(Listing.latest_report_date.desc().nullslast())
    result = await db.execute(query.limit(100))
    listings = result.scalars().all()

    # Get vendor info for listings via listing_reports
    items = []
    for listing in listings:
        # Get first vendor for this listing
        vendor_info = await _get_listing_vendor_info(db, listing.id)

        items.append({
            "result_type": "report",
            "listing_id": str(listing.id),
            "pin_code": listing.pin_code,
            "locality_name": listing.macro_location,
            "city": listing.city,
            "property_type": listing.property_type.value if listing.property_type else "",
            "report_count": listing.report_count,
            "latest_report_date": listing.latest_report_date.isoformat() if listing.latest_report_date else None,
            "latitude": str(listing.latitude) if listing.latitude else None,
            "longitude": str(listing.longitude) if listing.longitude else None,
            **(vendor_info or {}),
        })

    return items


async def _get_listing_vendor_info(db: AsyncSession, listing_id: UUID) -> dict | None:
    result = await db.execute(
        select(
            Vendor.id,
            Vendor.name,
            VendorProfile.vendor_tier,
            VendorProfile.quality_score,
        )
        .select_from(ListingReport)
        .join(Report, Report.id == ListingReport.report_id)
        .join(Vendor, Vendor.id == Report.vendor_id)
        .outerjoin(VendorProfile, VendorProfile.vendor_id == Vendor.id)
        .where(ListingReport.listing_id == listing_id)
        .limit(1)
    )
    row = result.first()
    if not row:
        return None

    # Get rating info
    rating_result = await db.execute(
        select(
            func.avg(VendorRating.rating),
            func.count(VendorRating.id),
        ).where(VendorRating.vendor_id == row.id)
    )
    rating_row = rating_result.first()

    return {
        "vendor_id": str(row.id),
        "vendor_name": row.name,
        "vendor_tier": row.vendor_tier.value if row.vendor_tier else "NEW",
        "avg_rating": round(float(rating_row[0]), 2) if rating_row and rating_row[0] else None,
        "total_ratings": rating_row[1] if rating_row else 0,
    }


async def _search_vendors(
    db: AsyncSession,
    *,
    city: str | None = None,
    min_rating: float | None = None,
    vendor_tier: str | None = None,
) -> list[dict]:
    query = (
        select(
            Vendor.id,
            Vendor.name,
            VendorProfile.display_photo,
            VendorProfile.vendor_tier,
            VendorProfile.specialization_tags,
            VendorProfile.quality_score,
        )
        .join(VendorProfile, VendorProfile.vendor_id == Vendor.id)
    )

    if vendor_tier:
        query = query.where(VendorProfile.vendor_tier == VendorTier(vendor_tier))

    result = await db.execute(query.limit(100))
    vendors = result.all()

    items = []
    for v in vendors:
        # Check city match via service areas
        if city:
            area_result = await db.execute(
                select(ServiceArea).where(
                    ServiceArea.vendor_id == v.id,
                    func.lower(ServiceArea.city) == city.lower(),
                )
            )
            if not area_result.scalar_one_or_none():
                continue

        # Get service area cities
        areas_result = await db.execute(
            select(ServiceArea.city).where(ServiceArea.vendor_id == v.id).distinct()
        )
        area_cities = [row[0] for row in areas_result.all()]

        # Get rating
        rating_result = await db.execute(
            select(
                func.avg(VendorRating.rating),
                func.count(VendorRating.id),
            ).where(VendorRating.vendor_id == v.id)
        )
        rating_row = rating_result.first()
        avg_rating = round(float(rating_row[0]), 2) if rating_row and rating_row[0] else None

        if min_rating and (avg_rating is None or avg_rating < min_rating):
            continue

        # Completed jobs count
        from app.models.enums import LenderRequestStatus
        from app.models.request import ReportRequest
        jobs_result = await db.execute(
            select(func.count())
            .select_from(RequestAcceptance)
            .join(ReportRequest, ReportRequest.id == RequestAcceptance.request_id)
            .where(
                RequestAcceptance.vendor_id == v.id,
                ReportRequest.lender_status == LenderRequestStatus.ACCEPTED,
            )
        )
        total_jobs = jobs_result.scalar() or 0

        items.append({
            "result_type": "vendor",
            "vendor_id": str(v.id),
            "vendor_name": v.name,
            "display_photo": v.display_photo,
            "vendor_tier": v.vendor_tier.value if v.vendor_tier else "NEW",
            "specialization_tags": v.specialization_tags,
            "avg_rating": avg_rating,
            "total_ratings": rating_row[1] if rating_row else 0,
            "total_completed_jobs": total_jobs,
            "quality_score": str(v.quality_score) if v.quality_score else "0",
            "service_areas": area_cities,
        })

    return items
