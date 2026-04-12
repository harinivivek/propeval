from uuid import UUID

from pydantic import BaseModel


class LenderCreate(BaseModel):
    name: str
    city: str | None = None


class LenderUpdate(BaseModel):
    name: str | None = None
    city: str | None = None


class LenderResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    name: str
    city: str | None = None
    organization_id: UUID


class BranchCreate(BaseModel):
    name: str
    city: str | None = None


class BranchResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    lender_id: UUID
    name: str
    city: str | None = None


class LenderUserCreate(BaseModel):
    email: str
    mobile: str
    full_name: str
    password: str
    role: str
    branch_ids: list[str] | None = None


class LenderUserResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    user_id: UUID
    lender_id: UUID
    role: str
    branch_ids: list[UUID] | None = None
