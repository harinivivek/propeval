from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.user import User
from app.services import marketplace_service

router = APIRouter(prefix="/api/marketplace", tags=["marketplace"])


@router.get("/search")
async def marketplace_search(
    city: str | None = None,
    pin_code: str | None = None,
    property_type: str | None = None,
    report_category: str | None = None,
    min_rating: float | None = None,
    vendor_tier: str | None = None,
    result_type: str | None = Query(None, description="reports, vendors, or null for both"),
    sort_by: str = Query("relevance", description="relevance, rating, recency"),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    return await marketplace_service.search_marketplace(
        db,
        city=city,
        pin_code=pin_code,
        property_type=property_type,
        report_category=report_category,
        min_rating=min_rating,
        vendor_tier=vendor_tier,
        result_type=result_type,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
    )


@router.get("/map-bounds")
async def marketplace_map_bounds(
    min_lat: float = Query(...),
    max_lat: float = Query(...),
    min_lng: float = Query(...),
    max_lng: float = Query(...),
    property_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    return await marketplace_service.search_map_bounds(
        db,
        min_lat=min_lat,
        max_lat=max_lat,
        min_lng=min_lng,
        max_lng=max_lng,
        property_type=property_type,
    )


@router.get("/localities/autocomplete")
async def locality_autocomplete(
    q: str = Query("", min_length=1),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_role("LENDER")),
):
    return await marketplace_service.autocomplete_localities(
        db, query=q, limit=limit
    )
