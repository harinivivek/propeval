from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ReportRequestCreate(BaseModel):
    lender_id: UUID
    request_type: str
    report_category: str
    property_address: str | None = None
    property_type: str
    plot_extent_sqft: Decimal | None = None
    loan_applicant_name: str | None = None
    city: str | None = None
    area: str | None = None
    eta_days: int | None = None
    vendor_specified_id: UUID | None = None
    allow_broadcast_on_reject: bool = True
    parent_report_id: UUID | None = None
    comments: str | None = None


class ReportRequestResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    lender_id: UUID
    lender_user_id: UUID
    branch_id: UUID | None = None
    request_type: str
    report_category: str
    num_reports_needed: int
    property_address: str | None = None
    property_type: str
    plot_extent_sqft: Decimal | None = None
    loan_applicant_name: str | None = None
    city: str | None = None
    area: str | None = None
    eta_days: int | None = None
    price: Decimal | None = None
    vendor_specified_id: UUID | None = None
    allow_broadcast_on_reject: bool
    parent_report_id: UUID | None = None
    comments: str | None = None
    lender_status: str
    vendor_status: str | None = None
