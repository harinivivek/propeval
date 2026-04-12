import uuid

from sqlalchemy import Boolean, ForeignKey, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class LenderConfig(BaseModel):
    __tablename__ = "lender_config"
    __table_args__ = (
        UniqueConstraint("lender_id", name="uq_lender_config_lender"),
    )

    lender_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lenders.id"), index=True
    )


class LenderVendorPreference(BaseModel):
    __tablename__ = "lender_vendor_preferences"
    __table_args__ = (
        UniqueConstraint("lender_id", "vendor_id", name="uq_lender_vendor_pref"),
    )

    lender_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("lenders.id"), index=True
    )
    vendor_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("vendors.id"), index=True
    )
    auto_approve: Mapped[bool] = mapped_column(Boolean, default=False)
