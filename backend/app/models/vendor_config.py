import uuid
from decimal import Decimal

from sqlalchemy import Boolean, ForeignKey, Numeric, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class VendorConfig(BaseModel):
    __tablename__ = "vendor_config"
    __table_args__ = (
        UniqueConstraint("vendor_id", name="uq_vendor_config_vendor"),
    )

    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id"), index=True
    )
    auto_listing_enabled: Mapped[bool] = mapped_column(Boolean, default=False)
    price_threshold: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    separate_valuation_legal: Mapped[bool] = mapped_column(Boolean, default=False)


class VendorLenderExclusion(BaseModel):
    __tablename__ = "vendor_lender_exclusions"
    __table_args__ = (
        UniqueConstraint("vendor_id", "lender_id", name="uq_vendor_lender_exclusion"),
    )

    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id"), index=True
    )
    lender_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lenders.id"), index=True
    )
