from uuid import UUID

from pydantic import BaseModel


class VendorCreate(BaseModel):
    name: str
    office_city: str | None = None
    office_area: str | None = None
    services: list[str] | None = None


class VendorUpdate(BaseModel):
    name: str | None = None
    office_city: str | None = None
    office_area: str | None = None
    services: list[str] | None = None


class VendorResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    name: str
    office_city: str | None = None
    office_area: str | None = None
    services: list[str] | None = None
    organization_id: UUID


class VendorUserCreate(BaseModel):
    email: str
    mobile: str
    full_name: str
    password: str
    role: str


class VendorUserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    user_id: UUID
    vendor_id: UUID
    role: str


class ServiceAreaCreate(BaseModel):
    city: str
    areas: list[str] | None = None
    service_type: str = "VALUATION"


class ServiceAreaResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    vendor_id: UUID
    city: str
    areas: list[str] | None = None
    service_type: str
