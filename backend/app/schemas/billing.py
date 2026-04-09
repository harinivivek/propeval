from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class VendorEarningResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    vendor_id: UUID
    report_id: UUID
    request_id: UUID | None = None
    lender_id: UUID
    amount: Decimal
    earning_type: str
    month: str


class LenderPayableResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    lender_id: UUID
    report_id: UUID
    request_id: UUID | None = None
    amount: Decimal
    payable_type: str
    status: str
    month: str


class InvoiceResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    invoice_type: str
    organization_id: UUID
    amount: Decimal
    status: str
    month: str
    generated_at: datetime | None = None
