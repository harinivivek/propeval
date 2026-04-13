import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import VendorTier


class VendorProfile(BaseModel):
    __tablename__ = "vendor_profiles"
    __table_args__ = (
        UniqueConstraint("vendor_id", name="uq_vendor_profile_vendor"),
    )

    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id"), index=True
    )
    display_photo: Mapped[str | None] = mapped_column(String(500), nullable=True)
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    founding_year: Mapped[int | None] = mapped_column(Integer, nullable=True)
    certifications: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    specialization_tags: Mapped[list | None] = mapped_column(JSONB, nullable=True)
    quality_score: Mapped[Decimal] = mapped_column(
        Numeric(5, 2), default=Decimal("0.00")
    )
    vendor_tier: Mapped[VendorTier] = mapped_column(
        SQLEnum(VendorTier), default=VendorTier.NEW
    )
    tier_changed_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    tier_warning_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    profile_completeness: Mapped[int] = mapped_column(Integer, default=0)

    vendor: Mapped["Vendor"] = relationship(back_populates="profile")


class VendorRating(BaseModel):
    __tablename__ = "vendor_ratings"
    __table_args__ = (
        UniqueConstraint(
            "report_request_id", name="uq_vendor_rating_request"
        ),
    )

    lender_user_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("users.id"), index=True
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id"), index=True
    )
    report_request_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("report_requests.id"), index=True
    )
    rating: Mapped[int] = mapped_column(Integer)
