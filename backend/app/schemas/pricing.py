from decimal import Decimal
from uuid import UUID

from pydantic import BaseModel


class PricingRuleCreate(BaseModel):
    lender_id: UUID
    report_category: str
    city: str
    area: str | None = None
    property_type: str
    new_request_price: Decimal
    listing_download_price: Decimal
    update_additional_price: Decimal
    nearby_additional_price: Decimal


class PricingRuleUpdate(BaseModel):
    city: str | None = None
    area: str | None = None
    property_type: str | None = None
    report_category: str | None = None
    new_request_price: Decimal | None = None
    listing_download_price: Decimal | None = None
    update_additional_price: Decimal | None = None
    nearby_additional_price: Decimal | None = None


class PricingRuleResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    lender_id: UUID
    report_category: str
    city: str
    area: str | None = None
    property_type: str
    new_request_price: Decimal
    listing_download_price: Decimal
    update_additional_price: Decimal
    nearby_additional_price: Decimal
    is_active: bool


class PriceCalculationRequest(BaseModel):
    lender_id: UUID
    report_category: str
    city: str
    area: str | None = None
    property_type: str
    request_type: str


class PriceCalculationResponse(BaseModel):
    amount: Decimal
    rule_id: UUID
    matched_area: str | None = None
