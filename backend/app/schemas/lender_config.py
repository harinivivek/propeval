from uuid import UUID

from pydantic import BaseModel


class LenderConfigResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    lender_id: UUID


class VendorPreferenceEntry(BaseModel):
    vendor_id: UUID
    vendor_name: str
    auto_approve: bool


class LenderConfigWithPreferences(BaseModel):
    config: LenderConfigResponse
    vendor_preferences: list[VendorPreferenceEntry]


class SetVendorPreferenceRequest(BaseModel):
    auto_approve: bool
