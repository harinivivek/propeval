from uuid import UUID
from pydantic import BaseModel


class UserCreate(BaseModel):
    email: str
    mobile: str
    full_name: str
    password: str
    user_type: str
    organization_id: UUID | None = None


class UserUpdate(BaseModel):
    email: str | None = None
    mobile: str | None = None
    full_name: str | None = None
    is_active: bool | None = None


class UserResponse(BaseModel):
    model_config = {"from_attributes": True}
    id: UUID
    email: str
    mobile: str
    full_name: str
    user_type: str
    is_active: bool
    organization_id: UUID | None = None
