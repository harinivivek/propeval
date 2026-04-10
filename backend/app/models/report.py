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
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import BaseModel
from app.models.enums import PropertyType, ReportCategory, ReportStatus


class Report(BaseModel):
    __tablename__ = "reports"

    vendor_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("vendors.id"))
    report_category: Mapped[ReportCategory] = mapped_column(SQLEnum(ReportCategory))
    status: Mapped[ReportStatus] = mapped_column(
        SQLEnum(ReportStatus), default=ReportStatus.UPLOADED
    )
    property_address: Mapped[str | None] = mapped_column(String(500), nullable=True)
    macro_location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    pin_code: Mapped[str | None] = mapped_column(String(10), nullable=True)
    property_type: Mapped[PropertyType | None] = mapped_column(
        SQLEnum(PropertyType), nullable=True
    )
    plot_extent_sqft: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    built_up_sqft: Mapped[Decimal | None] = mapped_column(
        Numeric(12, 2), nullable=True
    )
    valuation_amount: Mapped[Decimal | None] = mapped_column(
        Numeric(14, 2), nullable=True
    )
    loan_applicant_name: Mapped[str | None] = mapped_column(
        String(255), nullable=True
    )
    report_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    expiry_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    content_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    uploaded_file_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(10, 7), nullable=True)
    listing_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    bulk_upload_job_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("bulk_upload_jobs.id"), nullable=True
    )

    revisions: Mapped[list["ReportRevision"]] = relationship(back_populates="report")


class ReportRevision(BaseModel):
    __tablename__ = "report_revisions"

    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id"))
    revision_number: Mapped[int] = mapped_column(Integer)
    changes_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)

    report: Mapped[Report] = relationship(back_populates="revisions")
