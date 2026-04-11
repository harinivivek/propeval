from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import NotificationEventType
from app.models.notification import NotificationPreference

import uuid

ALL_EVENT_TYPES = [e.value for e in NotificationEventType]


async def get_preferences(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id
        )
    )
    prefs = {p.event_type: p.enabled for p in result.scalars().all()}
    return [
        {"event_type": et, "enabled": prefs.get(et, True)}
        for et in ALL_EVENT_TYPES
    ]


async def is_event_enabled(
    db: AsyncSession, user_id: uuid.UUID, event_type: str
) -> bool:
    result = await db.execute(
        select(NotificationPreference.enabled).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.event_type == event_type,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return True
    return row


async def update_preference(
    db: AsyncSession, user_id: uuid.UUID, event_type: str, enabled: bool
) -> dict:
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.event_type == event_type,
        )
    )
    pref = result.scalar_one_or_none()
    if pref:
        pref.enabled = enabled
    else:
        pref = NotificationPreference(
            user_id=user_id, event_type=event_type, enabled=enabled
        )
        db.add(pref)
    await db.flush()
    return {"event_type": event_type, "enabled": enabled}
