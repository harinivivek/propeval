from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.deps import get_current_user, get_db
from app.models.user import User
from app.schemas.notification import (
    NotificationListResponse,
    NotificationPreferenceItem,
    NotificationPreferenceUpdate,
    NotificationPreferencesResponse,
    NotificationResponse,
    UnreadCountResponse,
)
from app.services import notification_preference_service, notification_service

router = APIRouter(prefix="/api/notifications", tags=["notifications"])


@router.get("/", response_model=NotificationListResponse)
async def list_notifications(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    notifications, total = await notification_service.get_notifications(
        db, user_id=current_user.id, page=page, page_size=page_size
    )
    return NotificationListResponse(
        notifications=[NotificationResponse.model_validate(n) for n in notifications],
        total=total,
        page=page,
        page_size=page_size,
    )


@router.get("/unread-count", response_model=UnreadCountResponse)
async def unread_count(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    count = await notification_service.get_unread_count(db, user_id=current_user.id)
    return UnreadCountResponse(count=count)


@router.patch("/{notification_id}/read")
async def mark_read(
    notification_id: UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await notification_service.mark_as_read(
        db, notification_id=notification_id, user_id=current_user.id
    )
    return {"status": "ok"}


@router.patch("/read-all")
async def mark_all_read(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    await notification_service.mark_all_as_read(db, user_id=current_user.id)
    return {"status": "ok"}


@router.get("/preferences", response_model=NotificationPreferencesResponse)
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    prefs = await notification_preference_service.get_preferences(db, current_user.id)
    return NotificationPreferencesResponse(
        preferences=[NotificationPreferenceItem(**p) for p in prefs]
    )


@router.patch("/preferences")
async def update_preference(
    body: NotificationPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await notification_preference_service.update_preference(
        db, current_user.id, body.event_type, body.enabled
    )
    return result
