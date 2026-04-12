import logging
import uuid

from pywebpush import WebPushException, webpush
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.models.push_subscription import PushSubscription

logger = logging.getLogger(__name__)


async def subscribe(
    db: AsyncSession,
    user_id: uuid.UUID,
    endpoint: str,
    p256dh: str,
    auth: str,
) -> None:
    result = await db.execute(
        select(PushSubscription).where(PushSubscription.endpoint == endpoint)
    )
    existing = result.scalar_one_or_none()
    if existing:
        existing.user_id = user_id
        existing.p256dh = p256dh
        existing.auth = auth
    else:
        sub = PushSubscription(
            user_id=user_id,
            endpoint=endpoint,
            p256dh=p256dh,
            auth=auth,
        )
        db.add(sub)
    await db.flush()


async def unsubscribe(db: AsyncSession, endpoint: str) -> None:
    await db.execute(
        delete(PushSubscription).where(PushSubscription.endpoint == endpoint)
    )
    await db.flush()


async def send_push_to_users(
    db: AsyncSession,
    user_ids: list[uuid.UUID],
    title: str,
    body: str,
    url: str = "/vendor/requests",
) -> None:
    if not settings.VAPID_PRIVATE_KEY or not settings.VAPID_PUBLIC_KEY:
        logger.warning("VAPID keys not configured, skipping push")
        return

    result = await db.execute(
        select(PushSubscription).where(
            PushSubscription.user_id.in_(user_ids)
        )
    )
    subscriptions = result.scalars().all()

    import json

    payload = json.dumps({
        "title": title,
        "body": body,
        "icon": "/icons/icon-192.png",
        "badge": "/icons/badge-72.png",
        "data": {"url": url},
    })

    dead_endpoints = []

    for sub in subscriptions:
        try:
            webpush(
                subscription_info={
                    "endpoint": sub.endpoint,
                    "keys": {"p256dh": sub.p256dh, "auth": sub.auth},
                },
                data=payload,
                vapid_private_key=settings.VAPID_PRIVATE_KEY,
                vapid_claims={"sub": settings.VAPID_SUBJECT},
            )
        except WebPushException as e:
            if e.response and e.response.status_code in (404, 410):
                dead_endpoints.append(sub.endpoint)
            else:
                logger.exception("Push failed for endpoint %s", sub.endpoint[:50])

    if dead_endpoints:
        await db.execute(
            delete(PushSubscription).where(
                PushSubscription.endpoint.in_(dead_endpoints)
            )
        )
        await db.flush()
        logger.info("Cleaned %d dead push subscriptions", len(dead_endpoints))
