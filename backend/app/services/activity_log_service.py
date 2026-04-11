import logging
import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog
from app.models.user import User

logger = logging.getLogger(__name__)


async def log_activity(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID | None,
    actor_type: str,
    action: str,
    target_type: str,
    target_id: uuid.UUID,
    metadata: dict | None = None,
    ip_address: str | None = None,
) -> None:
    try:
        entry = ActivityLog(
            actor_id=actor_id,
            actor_type=actor_type,
            action=action,
            target_type=target_type,
            target_id=target_id,
            metadata_json=metadata,
            ip_address=ip_address,
        )
        db.add(entry)
        await db.flush()
    except Exception:
        logger.exception("Failed to log activity: %s %s", action, target_id)


async def get_activity_logs(
    db: AsyncSession,
    *,
    action: str | None = None,
    actor_type: str | None = None,
    target_type: str | None = None,
    actor_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[dict], int]:
    query = select(
        ActivityLog,
        User.full_name,
        User.email,
    ).outerjoin(User, ActivityLog.actor_id == User.id)

    count_query = select(func.count(ActivityLog.id))

    if action:
        query = query.where(ActivityLog.action == action)
        count_query = count_query.where(ActivityLog.action == action)
    if actor_type:
        query = query.where(ActivityLog.actor_type == actor_type)
        count_query = count_query.where(ActivityLog.actor_type == actor_type)
    if target_type:
        query = query.where(ActivityLog.target_type == target_type)
        count_query = count_query.where(ActivityLog.target_type == target_type)
    if actor_id:
        query = query.where(ActivityLog.actor_id == actor_id)
        count_query = count_query.where(ActivityLog.actor_id == actor_id)
    if date_from:
        query = query.where(ActivityLog.created_at >= date_from)
        count_query = count_query.where(ActivityLog.created_at >= date_from)
    if date_to:
        query = query.where(ActivityLog.created_at <= date_to)
        count_query = count_query.where(ActivityLog.created_at <= date_to)

    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(ActivityLog.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    rows = result.all()

    logs = []
    for row in rows:
        log = row[0]
        logs.append({
            "id": str(log.id),
            "actor_id": str(log.actor_id) if log.actor_id else None,
            "actor_name": row[1] or "System",
            "actor_email": row[2],
            "actor_type": log.actor_type,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": str(log.target_id),
            "metadata_json": log.metadata_json,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat(),
        })

    return logs, total
