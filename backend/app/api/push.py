from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.core.deps import get_current_user
from app.schemas.push import (
    PushSubscribeRequest,
    PushUnsubscribeRequest,
    VapidKeyResponse,
)
from app.services import push_service

router = APIRouter(
    prefix="/api/push",
    tags=["push"],
)


@router.get("/vapid-key", response_model=VapidKeyResponse)
async def get_vapid_key(
    current_user=Depends(get_current_user),
):
    return VapidKeyResponse(public_key=settings.VAPID_PUBLIC_KEY)


@router.post("/subscribe")
async def subscribe(
    body: PushSubscribeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await push_service.subscribe(
        db,
        user_id=current_user.id,
        endpoint=body.endpoint,
        p256dh=body.keys.p256dh,
        auth=body.keys.auth,
    )
    return {"status": "subscribed"}


@router.post("/unsubscribe")
async def unsubscribe(
    body: PushUnsubscribeRequest,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    await push_service.unsubscribe(db, body.endpoint)
    return {"status": "unsubscribed"}
