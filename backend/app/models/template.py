import uuid

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class ReportTemplate(BaseModel):
    __tablename__ = "report_templates"

    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    name: Mapped[str] = mapped_column(String(100))
    is_active: Mapped[bool] = mapped_column(Boolean, default=False)
    logo_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    config_json: Mapped[dict] = mapped_column(JSONB)
