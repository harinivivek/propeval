import uuid
from decimal import Decimal

from sqlalchemy import (
    Enum as SQLEnum,
    ForeignKey,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.enums import PropertyType, ReportCategory


class PriceBand(BaseModel):
    __tablename__ = "price_bands"
    __table_args__ = (
        UniqueConstraint(
            "city", "property_type", "report_category",
            name="uq_price_band_city_type_category"
        ),
    )

    city: Mapped[str] = mapped_column(String(255))
    property_type: Mapped[PropertyType] = mapped_column(SQLEnum(PropertyType))
    report_category: Mapped[ReportCategory] = mapped_column(SQLEnum(ReportCategory))
    min_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
    max_price: Mapped[Decimal] = mapped_column(Numeric(12, 2))


class VendorPricing(BaseModel):
    __tablename__ = "vendor_pricing"
    __table_args__ = (
        UniqueConstraint(
            "vendor_id", "city", "property_type", "report_category",
            name="uq_vendor_pricing_vendor_city_type_category"
        ),
    )

    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id"), index=True
    )
    city: Mapped[str] = mapped_column(String(255))
    property_type: Mapped[PropertyType] = mapped_column(SQLEnum(PropertyType))
    report_category: Mapped[ReportCategory] = mapped_column(SQLEnum(ReportCategory))
    price: Mapped[Decimal] = mapped_column(Numeric(12, 2))
