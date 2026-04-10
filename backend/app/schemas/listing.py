from datetime import date
from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class ListingResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    macro_location: str
    city: str
    pin_code: str
    property_type: str
    status: str
    report_count: int
    vendor_count: int
    latest_report_date: date | None = None


class ListingBrowseResponse(BaseModel):
    listings: list[ListingResponse]
    total: int
    page: int
    page_size: int


class RedactedReportPreview(BaseModel):
    id: UUID
    report_category: str
    locality: str | None = None
    city: str | None = None
    pin_code: str | None = None
    property_type: str | None = None
    plot_extent_sqft: int | None = None
    built_up_sqft: int | None = None
    report_date: date | None = None
    latitude: float | None = None
    longitude: float | None = None
    content_preview: dict | None = None
    is_purchased: bool = False


class ListingDetailResponse(BaseModel):
    listing: ListingResponse
    reports: list[RedactedReportPreview]


class VendorListingReportItem(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    report_category: str
    property_address: str | None = None
    city: str | None = None
    pin_code: str | None = None
    property_type: str | None = None
    report_date: date | None = None
    status: str
    listing_approved: bool


class VendorListingGroup(BaseModel):
    listing: ListingResponse
    reports: list[VendorListingReportItem]


class VendorListingsResponse(BaseModel):
    groups: list[VendorListingGroup]
    total: int
    page: int
    page_size: int
