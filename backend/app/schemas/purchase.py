from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel

from app.schemas.report import ReportResponse


class PurchaseResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    report_id: UUID
    listing_id: UUID
    lender_id: UUID
    price: Decimal
    created_at: datetime


class PurchasedReportItem(BaseModel):
    purchase: PurchaseResponse
    report: ReportResponse


class PurchasedReportsResponse(BaseModel):
    items: list[PurchasedReportItem]
    total: int
    page: int
    page_size: int
