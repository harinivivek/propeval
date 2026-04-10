import uuid
from decimal import Decimal

from sqlalchemy import (
    ForeignKey,
    Numeric,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class ReportPurchase(BaseModel):
    __tablename__ = "report_purchases"

    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id"))
    listing_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("listings.id"))
    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    purchased_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    price: Mapped[Decimal] = mapped_column(Numeric(10, 2))

    __table_args__ = (
        UniqueConstraint("report_id", "lender_id", name="uq_purchase_report_lender"),
    )
