import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    Boolean,
    DateTime,
    Enum as SQLEnum,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import (
    BroadcastStatus,
    LenderRequestStatus,
    PropertyType,
    ReportCategory,
    RequestType,
    VendorRequestStatus,
)


class ReportRequest(BaseModel):
    __tablename__ = "report_requests"

    lender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("lenders.id"))
    lender_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    branch_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("lender_branches.id"), nullable=True
    )
    request_type: Mapped[RequestType] = mapped_column(SQLEnum(RequestType))
    report_category: Mapped[ReportCategory] = mapped_column(SQLEnum(ReportCategory))
    num_reports_needed: Mapped[int] = mapped_column(Integer, default=1)
    property_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    property_type: Mapped[PropertyType] = mapped_column(SQLEnum(PropertyType))
    plot_extent_sqft: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    loan_applicant_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    area: Mapped[str | None] = mapped_column(String(255), nullable=True)
    eta_days: Mapped[int | None] = mapped_column(Integer, nullable=True)
    price: Mapped[Decimal | None] = mapped_column(Numeric(10, 2), nullable=True)
    vendor_specified_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("vendors.id"), nullable=True
    )
    allow_broadcast_on_reject: Mapped[bool] = mapped_column(Boolean, default=True)
    parent_report_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("reports.id"), nullable=True
    )
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)
    lender_status: Mapped[LenderRequestStatus] = mapped_column(
        SQLEnum(LenderRequestStatus), default=LenderRequestStatus.DRAFT
    )
    vendor_status: Mapped[VendorRequestStatus | None] = mapped_column(
        SQLEnum(VendorRequestStatus), nullable=True
    )

    broadcasts: Mapped[list["RequestBroadcast"]] = relationship(
        back_populates="request"
    )
    acceptances: Mapped[list["RequestAcceptance"]] = relationship(
        back_populates="request"
    )


class RequestBroadcast(BaseModel):
    __tablename__ = "request_broadcasts"

    request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("report_requests.id"))
    vendor_ids: Mapped[list[uuid.UUID] | None] = mapped_column(
        ARRAY(UUID(as_uuid=True)), nullable=True
    )
    broadcast_round: Mapped[int] = mapped_column(Integer)
    accept_deadline: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    status: Mapped[BroadcastStatus] = mapped_column(
        SQLEnum(BroadcastStatus), default=BroadcastStatus.ACTIVE
    )

    request: Mapped[ReportRequest] = relationship(back_populates="broadcasts")


class RequestAcceptance(BaseModel):
    __tablename__ = "request_acceptances"

    request_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("report_requests.id"))
    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    accepted_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    report_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("reports.id"), nullable=True
    )

    request: Mapped[ReportRequest] = relationship(back_populates="acceptances")
