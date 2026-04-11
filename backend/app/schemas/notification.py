from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class NotificationResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    user_id: UUID
    event_type: str
    title: str
    message: str
    reference_id: UUID
    reference_type: str
    is_read: bool
    created_at: datetime


class NotificationListResponse(BaseModel):
    notifications: list[NotificationResponse]
    total: int
    page: int
    page_size: int


class UnreadCountResponse(BaseModel):
    count: int


class NotificationPreferenceItem(BaseModel):
    event_type: str
    enabled: bool


class NotificationPreferencesResponse(BaseModel):
    preferences: list[NotificationPreferenceItem]


class NotificationPreferenceUpdate(BaseModel):
    event_type: str
    enabled: bool
