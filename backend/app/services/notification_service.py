import uuid
from uuid import UUID

from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ws_manager import ws_manager
from app.models.enums import NotificationEventType, NotificationReferenceType
from app.models.notification import Notification
from app.services.notification_preference_service import is_event_enabled


async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    event_type: NotificationEventType,
    title: str,
    message: str,
    reference_id: uuid.UUID,
    reference_type: NotificationReferenceType,
) -> Notification | None:
    if not await is_event_enabled(db, user_id, event_type.value):
        return None

    notification = Notification(
        user_id=user_id,
        event_type=event_type,
        title=title,
        message=message,
        reference_id=reference_id,
        reference_type=reference_type,
    )
    db.add(notification)
    await db.flush()

    await ws_manager.publish(
        str(user_id),
        {
            "type": "notification",
            "data": {
                "id": str(notification.id),
                "event_type": event_type.value,
                "title": title,
                "message": message,
                "reference_id": str(reference_id),
                "reference_type": reference_type.value,
                "created_at": notification.created_at.isoformat(),
            },
        },
    )

    return notification


async def get_notifications(
    db: AsyncSession, *, user_id: UUID, page: int = 1, page_size: int = 20
) -> tuple[list[Notification], int]:
    count_stmt = select(func.count()).select_from(Notification).where(
        Notification.user_id == user_id
    )
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        select(Notification)
        .where(Notification.user_id == user_id)
        .order_by(Notification.created_at.desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    result = await db.execute(stmt)
    return list(result.scalars().all()), total


async def get_unread_count(db: AsyncSession, *, user_id: UUID) -> int:
    stmt = select(func.count()).select_from(Notification).where(
        Notification.user_id == user_id,
        Notification.is_read == False,  # noqa: E712
    )
    return (await db.execute(stmt)).scalar_one()


async def mark_as_read(
    db: AsyncSession, *, notification_id: UUID, user_id: UUID
) -> None:
    stmt = (
        update(Notification)
        .where(Notification.id == notification_id, Notification.user_id == user_id)
        .values(is_read=True)
    )
    await db.execute(stmt)


async def mark_all_as_read(db: AsyncSession, *, user_id: UUID) -> None:
    stmt = (
        update(Notification)
        .where(Notification.user_id == user_id, Notification.is_read == False)  # noqa: E712
        .values(is_read=True)
    )
    await db.execute(stmt)
