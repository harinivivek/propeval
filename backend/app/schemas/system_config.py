from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class SystemConfigResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    vendors_per_broadcast_round: int
    broadcast_accept_window_minutes: int
    auto_accept_days: int
    max_upload_size_mb: int
    required_report_fields: list[str] | None
    updated_by: UUID | None
    updated_at: datetime


class SystemConfigUpdate(BaseModel):
    vendors_per_broadcast_round: int | None = None
    broadcast_accept_window_minutes: int | None = None
    auto_accept_days: int | None = None
    max_upload_size_mb: int | None = None
    required_report_fields: list[str] | None = None
