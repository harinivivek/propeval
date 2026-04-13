import uuid
from datetime import date
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    Date,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import ListingStatus, PropertyType


class Listing(BaseModel):
    __tablename__ = "listings"

    macro_location: Mapped[str] = mapped_column(String(255))
    city: Mapped[str] = mapped_column(String(255))
    pin_code: Mapped[str] = mapped_column(String(10))
    property_type: Mapped[PropertyType] = mapped_column(SQLEnum(PropertyType))
    status: Mapped[ListingStatus] = mapped_column(
        SQLEnum(ListingStatus), default=ListingStatus.DRAFT
    )
    report_count: Mapped[int] = mapped_column(Integer, default=0)
    vendor_count: Mapped[int] = mapped_column(Integer, default=0)
    latest_report_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    locality_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("localities.id"), nullable=True, index=True
    )

    listing_reports: Mapped[list["ListingReport"]] = relationship(
        back_populates="listing"
    )

    __table_args__ = (
        UniqueConstraint("pin_code", "property_type", name="uq_listing_pin_code_property_type"),
    )


class ListingReport(BaseModel):
    __tablename__ = "listing_reports"

    listing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("listings.id"))
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id"))
    display_order: Mapped[int] = mapped_column(Integer, default=0)

    listing: Mapped[Listing] = relationship(back_populates="listing_reports")

    __table_args__ = (
        UniqueConstraint("report_id", name="uq_listing_report_report_id"),
    )
