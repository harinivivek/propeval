from uuid import UUID

from sqlalchemy import Boolean, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.enums import NotificationEventType, NotificationReferenceType


class Notification(BaseModel):
    __tablename__ = "notifications"

    user_id: Mapped[UUID] = mapped_column(ForeignKey("users.id"), index=True)
    event_type: Mapped[NotificationEventType] = mapped_column(
        String(50), index=True
    )
    title: Mapped[str] = mapped_column(String(255))
    message: Mapped[str] = mapped_column(Text)
    reference_id: Mapped[UUID] = mapped_column()
    reference_type: Mapped[NotificationReferenceType] = mapped_column(String(20))
    is_read: Mapped[bool] = mapped_column(Boolean, default=False, index=True)
