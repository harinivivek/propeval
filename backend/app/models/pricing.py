import uuid
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Enum as SQLEnum,
    ForeignKey,
    Index,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import PropertyType, ReportCategory


class PricingRule(BaseModel):
    __tablename__ = "pricing_rules"

    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    report_category: Mapped[ReportCategory] = mapped_column(SQLEnum(ReportCategory))
    city: Mapped[str] = mapped_column(String(255))
    area: Mapped[str | None] = mapped_column(String(255), nullable=True)
    property_type: Mapped[PropertyType] = mapped_column(SQLEnum(PropertyType))
    new_request_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    listing_download_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    update_additional_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    nearby_additional_price: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint(
            "lender_id", "report_category", "city", "area", "property_type",
            name="uq_pricing_rule_with_area",
        ),
        Index(
            "uq_pricing_rule_without_area",
            "lender_id", "report_category", "city", "property_type",
            unique=True,
            postgresql_where="area IS NULL",
        ),
    )
