from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


class LocalityResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    name: str
    pin_code: str
    city: str
    state: str
    lat: str | None = None
    lng: str | None = None


class MarketplaceReportResult(BaseModel):
    result_type: str = "report"
    listing_id: str
    pin_code: str
    locality_name: str | None = None
    city: str
    property_type: str
    report_count: int
    latest_report_date: str | None = None
    vendor_name: str | None = None
    vendor_id: str | None = None
    vendor_tier: str | None = None
    avg_rating: float | None = None
    total_ratings: int = 0
    price: str | None = None
    latitude: str | None = None
    longitude: str | None = None


class MarketplaceVendorResult(BaseModel):
    result_type: str = "vendor"
    vendor_id: str
    vendor_name: str
    display_photo: str | None = None
    vendor_tier: str
    specialization_tags: list[str] | None = None
    avg_rating: float | None = None
    total_ratings: int = 0
    total_completed_jobs: int = 0
    avg_turnaround_hours: float | None = None
    quality_score: str = "0"
    service_areas: list[str] = []
    latitude: str | None = None
    longitude: str | None = None


class MarketplaceSearchResponse(BaseModel):
    results: list[MarketplaceReportResult | MarketplaceVendorResult]
    total: int
    page: int
    page_size: int
