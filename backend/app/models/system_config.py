import uuid

from sqlalchemy import ARRAY, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class SystemConfig(BaseModel):
    __tablename__ = "system_config"

    vendors_per_broadcast_round: Mapped[int] = mapped_column(Integer, default=5)
    broadcast_accept_window_minutes: Mapped[int] = mapped_column(Integer, default=30)
    auto_accept_days: Mapped[int] = mapped_column(Integer, default=7)
    max_upload_size_mb: Mapped[int] = mapped_column(Integer, default=20)
    required_report_fields: Mapped[list[str] | None] = mapped_column(
        ARRAY(String), nullable=True
    )
    updated_by: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
