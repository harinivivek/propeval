from datetime import datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ReportRequestCreate(BaseModel):
    """Used internally / by admin — preserves Phase 2 schema."""
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


class ReportRequestCreateInput(BaseModel):
    """Lender form input for creating a new request."""
    report_category: str
    property_address: str
    city: str
    area: str | None = None
    pin_code: str | None = None
    property_type: str
    plot_extent_sqft: Decimal | None = None
    built_up_sqft: Decimal | None = None
    loan_applicant_name: str
    vendor_specified_id: UUID | None = None
    allow_broadcast_on_reject: bool = True
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
    built_up_sqft: Decimal | None = None
    loan_applicant_name: str | None = None
    city: str | None = None
    area: str | None = None
    pin_code: str | None = None
    eta_days: int | None = None
    price: Decimal | None = None
    vendor_specified_id: UUID | None = None
    allow_broadcast_on_reject: bool
    parent_report_id: UUID | None = None
    comments: str | None = None
    lender_status: str
    vendor_status: str | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None


class ReportRequestDetail(ReportRequestResponse):
    """Extended response for detail page."""
    vendor_name: str | None = None
    broadcast_round: int | None = None
    broadcast_deadline: datetime | None = None
    broadcast_status: str | None = None
    report_id: UUID | None = None
    report_status: str | None = None
    report_file_path: str | None = None


class EligibleVendorResponse(BaseModel):
    id: UUID
    name: str
    city: str | None = None
    areas: list[str] | None = None


class RejectReportInput(BaseModel):
    comments: str


class UpdateRequestInput(BaseModel):
    report_id: UUID
    checklist: list[str]
    comments: str | None = None


class NearbyRequestInput(BaseModel):
    report_id: UUID
    property_address: str
    city: str
    pin_code: str
    area: str | None = None
    report_category: str
    comments: str | None = None
