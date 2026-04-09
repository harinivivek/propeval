# backend/app/schemas/polling.py
from datetime import datetime

from pydantic import BaseModel


class PollResponse(BaseModel):
    incoming_requests: int = 0
    updated_requests: int = 0
    last_checked: datetime
