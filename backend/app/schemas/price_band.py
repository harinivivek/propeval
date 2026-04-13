from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class PriceBandCreate(BaseModel):
    city: str
    property_type: str
    report_category: str
    min_price: str
    max_price: str


class PriceBandResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    city: str
    property_type: str
    report_category: str
    min_price: str
    max_price: str
    created_at: datetime
    updated_at: datetime


class VendorPricingUpsert(BaseModel):
    city: str
    property_type: str
    report_category: str
    price: str


class VendorPricingResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    vendor_id: UUID
    city: str
    property_type: str
    report_category: str
    price: str
    created_at: datetime
    updated_at: datetime


class VendorPricingWithBand(BaseModel):
    id: UUID
    city: str
    property_type: str
    report_category: str
    price: str
    min_price: str | None = None
    max_price: str | None = None
