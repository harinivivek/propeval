from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_db, require_role
from app.models.lender import LenderUser
from app.models.user import User
from app.schemas.dashboard import LenderDashboardStats, LenderPayablesResponse
from app.services import dashboard_service

router = APIRouter(prefix="/api/lender/dashboard", tags=["lender-dashboard"])


async def _get_lender_id(db: AsyncSession, user_id):
    from fastapi import HTTPException
    stmt = select(LenderUser.lender_id).where(LenderUser.user_id == user_id)
    result = await db.execute(stmt)
    lender_id = result.scalar_one_or_none()
    if not lender_id:
        raise HTTPException(status_code=404, detail="Lender not found")
    return lender_id


@router.get("/stats", response_model=LenderDashboardStats)
async def lender_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    return await dashboard_service.get_lender_dashboard_stats(db, lender_id=lender_id)


@router.get("/payables")
async def lender_payables(
    fy_year: int | None = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    return await dashboard_service.get_lender_payables_summary(
        db, lender_id=lender_id, fy_year=fy_year
    )


@router.get("/recent-requests")
async def lender_recent_requests(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role("LENDER")),
):
    lender_id = await _get_lender_id(db, current_user.id)
    return await dashboard_service.get_lender_recent_requests(
        db, lender_id=lender_id, limit=limit
    )
