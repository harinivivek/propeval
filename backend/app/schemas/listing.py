from datetime import date
from uuid import UUID

from pydantic import BaseModel


class ListingResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    macro_location: str
    city: str
    property_type: str
    status: str
    report_count: int
    latest_report_date: date | None = None
    is_active: bool


class ListingBrief(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    macro_location: str
    city: str
    property_type: str
    report_count: int
    latest_report_date: date | None = None
