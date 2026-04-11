from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.schemas.activity_log import ActivityLogListResponse
from app.services import activity_log_service
from app.services.csv_export_service import generate_csv_response

router = APIRouter(
    prefix="/api/admin/activity",
    tags=["admin-activity"],
    dependencies=[Depends(require_role(["ADMIN"]))],
)


@router.get("/", response_model=ActivityLogListResponse)
async def list_activity_logs(
    action: str | None = None,
    actor_type: str | None = None,
    target_type: str | None = None,
    actor_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    logs, total = await activity_log_service.get_activity_logs(
        db,
        action=action,
        actor_type=actor_type,
        target_type=target_type,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return ActivityLogListResponse(
        logs=logs, total=total, page=page, page_size=page_size
    )


@router.get("/export")
async def export_activity_logs(
    action: str | None = None,
    actor_type: str | None = None,
    target_type: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    logs, _ = await activity_log_service.get_activity_logs(
        db,
        action=action,
        actor_type=actor_type,
        target_type=target_type,
        date_from=date_from,
        date_to=date_to,
        page=1,
        page_size=10000,
    )
    columns = [
        ("Timestamp", "created_at"),
        ("User", "actor_name"),
        ("Email", "actor_email"),
        ("Role", "actor_type"),
        ("Action", "action"),
        ("Target Type", "target_type"),
        ("Target ID", "target_id"),
        ("IP Address", "ip_address"),
    ]
    return generate_csv_response(logs, columns, filename="activity_logs.csv")
