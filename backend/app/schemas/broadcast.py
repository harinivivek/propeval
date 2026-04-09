# backend/app/schemas/broadcast.py
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class BroadcastInfo(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    broadcast_round: int
    vendor_count: int
    accept_deadline: datetime
    status: str


class RejectionInput(BaseModel):
    reason: str  # LOW_PRICE | NOT_AVAILABLE | DO_NOT_WANT_TO_SHARE
    message: str | None = None
