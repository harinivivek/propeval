from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class VendorConfigResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    vendor_id: UUID
    auto_listing_enabled: bool
    price_threshold: str | None = None
    separate_valuation_legal: bool


class VendorConfigUpdate(BaseModel):
    auto_listing_enabled: bool | None = None
    price_threshold: str | None = None
    separate_valuation_legal: bool | None = None


class ExclusionEntry(BaseModel):
    lender_id: UUID
    lender_name: str
    created_at: datetime


class VendorConfigWithExclusions(BaseModel):
    config: VendorConfigResponse
    exclusions: list[ExclusionEntry]


class AddExclusionRequest(BaseModel):
    lender_id: UUID
