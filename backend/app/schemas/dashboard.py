from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


# --- Vendor Dashboard ---

class VendorDashboardStats(BaseModel):
    requests_received: int
    requests_accepted: int
    reports_served: int
    reports_listed: int
    downloads: int
    active_listings: int


class LenderEarning(BaseModel):
    lender_id: UUID
    lender_name: str
    total_amount: str


class MonthlyAmount(BaseModel):
    month: str
    total_amount: str


class VendorReceivablesResponse(BaseModel):
    lender_wise: list[LenderEarning]
    month_wise: list[MonthlyAmount]


class ReportEarning(BaseModel):
    report_id: UUID
    property_address: str | None
    report_category: str
    total_amount: str


class VendorEarningsResponse(BaseModel):
    lender_wise: list[LenderEarning]
    report_wise: list[ReportEarning]
    report_wise_total: int
    month_wise: list[MonthlyAmount]


class PendingRequestItem(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    lender_name: str
    property_address: str | None
    report_category: str
    eta_days: int | None
    price: str | None
    vendor_status: str
    accept_deadline: datetime | None
    created_at: datetime


class VendorReportItem(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    report_date: str | None
    property_address: str | None
    report_category: str
    property_type: str | None
    status: str
    valuation_amount: str | None


class PaginatedResponse(BaseModel):
    items: list
    total: int
    page: int
    page_size: int


# --- Lender Dashboard ---

class LenderDashboardStats(BaseModel):
    requests_raised: int
    awaiting_reports: int
    reports_received: int
    reports_accepted: int
    listings_purchased: int


class PayableSummaryTotals(BaseModel):
    pending: str
    billed: str
    paid: str


class PayableTypeAmount(BaseModel):
    payable_type: str
    total_amount: str


class LenderPayablesResponse(BaseModel):
    totals: PayableSummaryTotals
    month_wise: list[MonthlyAmount]
    type_breakdown: list[PayableTypeAmount]


class RecentRequestItem(BaseModel):
    model_config = {"from_attributes": True}

    id: UUID
    property_address: str | None
    report_category: str
    lender_status: str
    vendor_name: str | None
    created_at: datetime


# --- Admin Dashboard ---

class AdminDashboardStats(BaseModel):
    total_vendors: int
    total_lenders: int
    total_reports: int
    total_revenue: str
    pending_payables: str
    open_requests: int


class AdminVendorRow(BaseModel):
    vendor_id: UUID
    vendor_name: str
    city: str | None
    requests_served: int
    reports_uploaded: int
    active_listings: int
    downloads: int
    total_earnings: str
    lender_count: int


class AdminLenderRow(BaseModel):
    lender_id: UUID
    lender_name: str
    city: str | None
    requests_raised: int
    reports_received: int
    listings_purchased: int
    total_payable: str
    total_paid: str
    vendor_count: int


class AdminReportRow(BaseModel):
    report_id: UUID
    report_date: str | None
    vendor_name: str
    lender_name: str | None
    property_address: str | None
    report_category: str
    property_type: str | None
    status: str
    valuation_amount: str | None


class AdminOpenRequestRow(BaseModel):
    request_id: UUID
    lender_name: str
    property_address: str | None
    report_category: str
    lender_status: str
    vendor_name: str | None
    created_at: datetime
    eta_days: int | None
    broadcast_round: int | None
