from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class TemplateSectionField(BaseModel):
    key: str
    label: str
    enabled: bool = True
    order: int


class TemplateHeader(BaseModel):
    bank_name: str
    primary_color: str = "#1a3b5c"
    secondary_color: str = "#f0f4f8"
    show_logo: bool = True
    subtitle: str = "Property Valuation Report"


class TemplateFooter(BaseModel):
    text: str = "Confidential - For internal use only"
    show_page_numbers: bool = True


class TemplateConfig(BaseModel):
    header: TemplateHeader
    sections: list[TemplateSectionField]
    footer: TemplateFooter


class TemplateCreate(BaseModel):
    name: str
    config_json: TemplateConfig


class TemplateUpdate(BaseModel):
    name: str | None = None
    config_json: TemplateConfig | None = None


class TemplateResponse(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    lender_id: UUID
    name: str
    is_active: bool
    logo_path: str | None = None
    config_json: dict
    created_at: datetime
    updated_at: datetime


class TemplateListResponse(BaseModel):
    templates: list[TemplateResponse]


class TemplateFieldOption(BaseModel):
    key: str
    label: str
