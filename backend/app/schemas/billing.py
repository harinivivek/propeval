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
    invoice_number: str | None = None
    line_items_count: int = 0
    notes: str | None = None


class InvoiceWithOrgResponse(InvoiceResponse):
    org_name: str = ""


class InvoiceStatusUpdate(BaseModel):
    status: str  # PaymentStatus value: BILLED or PAID


class BulkStatusUpdate(BaseModel):
    invoice_ids: list[UUID]
    status: str  # PaymentStatus value


class GenerateInvoicesRequest(BaseModel):
    month: str  # Format: YYYY-MM


class BillingEntryResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    report_id: UUID
    request_id: UUID | None = None
    amount: Decimal
    entry_type: str
    created_at: datetime


class BillingEntriesWithInvoice(BaseModel):
    entries: list[BillingEntryResponse]
    invoice_number: str | None = None
    invoice_status: str | None = None


class InvoiceDetailResponse(InvoiceWithOrgResponse):
    entries: list[BillingEntryResponse] = []
