from datetime import date
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
