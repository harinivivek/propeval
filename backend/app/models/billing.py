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
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel
from app.models.enums import EarningType, InvoiceType, PayableType, PaymentStatus


class VendorEarning(BaseModel):
    __tablename__ = "vendor_earnings"

    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id"))
    request_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("report_requests.id"), nullable=True
    )
    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    earning_type: Mapped[EarningType] = mapped_column(SQLEnum(EarningType))
    month: Mapped[str] = mapped_column(String(7))  # "2026-04"


class LenderPayable(BaseModel):
    __tablename__ = "lender_payables"

    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id"))
    request_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("report_requests.id"), nullable=True
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    payable_type: Mapped[PayableType] = mapped_column(SQLEnum(PayableType))
    status: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus), default=PaymentStatus.PENDING
    )
    month: Mapped[str] = mapped_column(String(7))  # "2026-04"


class Invoice(BaseModel):
    __tablename__ = "invoices"

    invoice_type: Mapped[InvoiceType] = mapped_column(SQLEnum(InvoiceType))
    organization_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("organizations.id")
    )
    amount: Mapped[Decimal] = mapped_column(Numeric(10, 2))
    status: Mapped[PaymentStatus] = mapped_column(
        SQLEnum(PaymentStatus), default=PaymentStatus.PENDING
    )
    month: Mapped[str] = mapped_column(String(7))  # "2026-04"
    generated_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    invoice_number: Mapped[str | None] = mapped_column(
        String(30), unique=True, nullable=True
    )
    line_items_count: Mapped[int] = mapped_column(Integer, default=0)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
