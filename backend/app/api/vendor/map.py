from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.enums import ReportStatus
from app.models.report import Report
from app.models.vendor import VendorUser
from app.models.user import User

router = APIRouter(prefix="/api/vendor/map", tags=["vendor-map"])


async def _get_vendor_id(db: AsyncSession, user_id: UUID) -> UUID:
    result = await db.execute(
        select(VendorUser.vendor_id).where(VendorUser.user_id == user_id)
    )
    vendor_id = result.scalar_one_or_none()
    if not vendor_id:
        raise HTTPException(status_code=404, detail="Vendor not found")
    return vendor_id


@router.get("/")
async def vendor_map_data(
    city: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("VENDOR")),
):
    vendor_id = await _get_vendor_id(db, current_user.id)

    own_query = select(Report).where(
        Report.vendor_id == vendor_id,
        Report.latitude.isnot(None),
        Report.longitude.isnot(None),
        Report.is_active == True,
    )
    if city:
        own_query = own_query.where(Report.city == city)
    own_result = await db.execute(own_query)
    own_reports = own_result.scalars().all()

    comp_query = (
        select(
            Report.pin_code,
            Report.city,
            func.avg(Report.latitude).label("latitude"),
            func.avg(Report.longitude).label("longitude"),
            func.count(Report.id).label("report_count"),
        )
        .where(
            Report.vendor_id != vendor_id,
            Report.status == ReportStatus.PUBLISHED,
            Report.latitude.isnot(None),
            Report.longitude.isnot(None),
            Report.is_active == True,
        )
        .group_by(Report.pin_code, Report.city)
    )
    if city:
        comp_query = comp_query.where(Report.city == city)
    comp_result = await db.execute(comp_query)
    competitor_rows = comp_result.all()

    return {
        "own_reports": [
            {
                "report_id": str(r.id),
                "latitude": float(r.latitude),
                "longitude": float(r.longitude),
                "property_address": r.property_address,
                "city": r.city,
                "property_type": r.property_type.value if r.property_type else None,
                "report_category": r.report_category.value if r.report_category else None,
                "status": r.status.value if r.status else None,
                "report_date": r.report_date.isoformat() if r.report_date else None,
            }
            for r in own_reports
        ],
        "competitor_areas": [
            {
                "pin_code": row.pin_code,
                "city": row.city,
                "latitude": float(row.latitude),
                "longitude": float(row.longitude),
                "report_count": row.report_count,
            }
            for row in competitor_rows
        ],
    }
