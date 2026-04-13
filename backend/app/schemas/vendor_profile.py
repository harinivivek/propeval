from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field


# --- Profile Schemas ---


class VendorProfileUpdate(BaseModel):
    bio: str | None = None
    founding_year: int | None = None
    certifications: dict | None = None
    specialization_tags: list[str] | None = None


class VendorProfileResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    vendor_id: UUID
    display_photo: str | None = None
    bio: str | None = None
    founding_year: int | None = None
    certifications: dict | None = None
    specialization_tags: list[str] | None = None
    quality_score: str  # Decimal serialized as string
    vendor_tier: str
    tier_changed_at: datetime | None = None
    profile_completeness: int
    created_at: datetime
    updated_at: datetime


class VendorPublicProfileResponse(BaseModel):
    model_config = {"from_attributes": True}
    vendor_id: UUID
    vendor_name: str
    display_photo: str | None = None
    bio: str | None = None
    founding_year: int | None = None
    certifications: dict | None = None
    specialization_tags: list[str] | None = None
    quality_score: str
    vendor_tier: str
    profile_completeness: int
    # Aggregated stats
    total_completed_jobs: int = 0
    avg_rating: float | None = None
    total_ratings: int = 0
    first_time_acceptance_rate: float | None = None
    avg_turnaround_hours: float | None = None
    on_time_delivery_rate: float | None = None
    service_areas: list[dict] = []


class PortfolioItemResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    property_type: str
    report_category: str
    city: str
    area: str | None = None
    completed_at: datetime | None = None


class PortfolioResponse(BaseModel):
    items: list[PortfolioItemResponse]
    total: int
    page: int
    page_size: int


# --- Rating Schemas ---


class VendorRatingCreate(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    report_request_id: UUID


class VendorRatingResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    lender_user_id: UUID
    vendor_id: UUID
    report_request_id: UUID
    rating: int
    created_at: datetime


class VendorRatingSummary(BaseModel):
    vendor_id: UUID
    avg_rating: float | None = None
    total_ratings: int = 0
    rating_distribution: dict[str, int] = {}  # {"1": 5, "2": 3, ...}


# --- Tier Schemas ---


class TierProgressResponse(BaseModel):
    current_tier: str
    tier_changed_at: datetime | None = None
    quality_score: str
    completed_jobs: int
    avg_rating: float | None = None
    first_time_acceptance_rate: float | None = None
    on_time_delivery_rate: float | None = None
    avg_response_hours: float | None = None
    # Next tier requirements
    next_tier: str | None = None
    next_tier_requirements: dict | None = None


class AdminTierOverride(BaseModel):
    vendor_tier: str
    reason: str | None = None
