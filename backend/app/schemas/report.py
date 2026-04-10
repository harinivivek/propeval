from datetime import date, datetime
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ReportCreate(BaseModel):
    vendor_id: UUID
    report_category: str
    property_address: str | None = None
    macro_location: str | None = None
    city: str | None = None
    pin_code: str | None = None
    property_type: str | None = None
    plot_extent_sqft: Decimal | None = None
    built_up_sqft: Decimal | None = None
    valuation_amount: Decimal | None = None
    loan_applicant_name: str | None = None
    report_date: date | None = None
    uploaded_file_path: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None


class ReportResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    vendor_id: UUID
    report_category: str
    status: str
    property_address: str | None = None
    macro_location: str | None = None
    city: str | None = None
    pin_code: str | None = None
    property_type: str | None = None
    plot_extent_sqft: Decimal | None = None
    built_up_sqft: Decimal | None = None
    valuation_amount: Decimal | None = None
    loan_applicant_name: str | None = None
    report_date: date | None = None
    expiry_date: date | None = None
    uploaded_file_path: str | None = None
    latitude: Decimal | None = None
    longitude: Decimal | None = None
    content_json: dict | None = None
    listing_approved: bool
    is_active: bool


class ReportBrief(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    report_category: str
    city: str | None = None
    macro_location: str | None = None
    property_type: str | None = None
    status: str
    report_date: date | None = None


class ReportUploadMeta(BaseModel):
    """Optional metadata submitted with report upload."""
    valuation_amount: Decimal | None = None
    report_date: date | None = None


class RevisionSummary(BaseModel):
    model_config = {"from_attributes": True}

    revision_number: int
    comments: str | None = None
    created_at: datetime | None = None


class ReportDetail(ReportResponse):
    """Extended response with revision history."""
    revisions: list[RevisionSummary] = []


class ExtractedFieldUpdate(BaseModel):
    value: str | int | float | None = None
    confidence: float | None = None
    type: str = "text"
    original: str | int | float | None = None
    edited: bool = False


class ExtractedDataUpdate(BaseModel):
    """Payload for updating extracted report data."""
    anchor_fields: dict[str, ExtractedFieldUpdate] = {}
    additional_fields: dict[str, ExtractedFieldUpdate] = {}
