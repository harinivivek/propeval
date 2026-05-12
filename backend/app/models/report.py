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

    # --- Extracted Fields (Property Appraisal Report) ---
    # General
    customer_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    nearest_landmark: Mapped[str | None] = mapped_column(String(255), nullable=True)
    society_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    builder_developer: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_detail: Mapped[str | None] = mapped_column(String(255), nullable=True)
    case_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    inspection_date: Mapped[date | None] = mapped_column(Date, nullable=True)

    # Locality
    ward_no: Mapped[str | None] = mapped_column(String(100), nullable=True)
    vicinity: Mapped[str | None] = mapped_column(String(500), nullable=True)
    property_type_approvals: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nearest_railway_station: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nearest_bus_stop: Mapped[str | None] = mapped_column(String(255), nullable=True)
    nearest_hospital: Mapped[str | None] = mapped_column(String(255), nullable=True)
    tenure_type: Mapped[str | None] = mapped_column(String(100), nullable=True)

    # Property Details
    usage_observed: Mapped[str | None] = mapped_column(String(255), nullable=True)
    no_of_stories: Mapped[int | None] = mapped_column(Integer, nullable=True)
    occupied_by: Mapped[str | None] = mapped_column(String(255), nullable=True)
    within_municipal_limits: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Boundaries
    north_deed: Mapped[str | None] = mapped_column(String(255), nullable=True)
    south_deed: Mapped[str | None] = mapped_column(String(255), nullable=True)
    east_deed: Mapped[str | None] = mapped_column(String(255), nullable=True)
    west_deed: Mapped[str | None] = mapped_column(String(255), nullable=True)
    north_site: Mapped[str | None] = mapped_column(String(255), nullable=True)
    south_site: Mapped[str | None] = mapped_column(String(255), nullable=True)
    east_site: Mapped[str | None] = mapped_column(String(255), nullable=True)
    west_site: Mapped[str | None] = mapped_column(String(255), nullable=True)
    boundaries_match: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Structural
    structure_type: Mapped[str | None] = mapped_column(String(255), nullable=True)
    no_of_floors: Mapped[int | None] = mapped_column(Integer, nullable=True)
    no_of_wings: Mapped[int | None] = mapped_column(Integer, nullable=True)
    flats_per_floor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    no_of_lifts: Mapped[int | None] = mapped_column(Integer, nullable=True)
    internal_composition: Mapped[str | None] = mapped_column(Text, nullable=True)
    age_of_property: Mapped[str | None] = mapped_column(String(100), nullable=True)
    future_life: Mapped[str | None] = mapped_column(String(100), nullable=True)
    construction_stage: Mapped[str | None] = mapped_column(String(255), nullable=True)
    recommendation: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Quality of Construction
    quality_maintenance: Mapped[str | None] = mapped_column(String(255), nullable=True)
    quality_finishing: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Technical Approvals
    approved_plan_no_date: Mapped[str | None] = mapped_column(String(255), nullable=True)
    violations_observed: Mapped[str | None] = mapped_column(Text, nullable=True)
    conforms_to_byelaws: Mapped[bool | None] = mapped_column(Boolean, nullable=True)

    # Valuation (FMV)
    rate_per_sqft: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    final_comparison_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)

    # Recommended Valuation
    stage_pct: Mapped[Decimal | None] = mapped_column(Numeric(5, 2), nullable=True)
    realizable_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    distressed_valuation: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    rental_value: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)
    reconstruction_cost: Mapped[Decimal | None] = mapped_column(Numeric(14, 2), nullable=True)

    # Additional
    remarks: Mapped[str | None] = mapped_column(Text, nullable=True)

    revisions: Mapped[list["ReportRevision"]] = relationship(back_populates="report")


class ReportRevision(BaseModel):
    __tablename__ = "report_revisions"

    report_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("reports.id"))
    revision_number: Mapped[int] = mapped_column(Integer)
    changes_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    comments: Mapped[str | None] = mapped_column(Text, nullable=True)

    report: Mapped[Report] = relationship(back_populates="revisions")
