export interface VendorDashboardStats {
  requests_received: number;
  requests_accepted: number;
  reports_served: number;
  reports_listed: number;
  downloads: number;
  active_listings: number;
}

export interface LenderEarning {
  lender_id: string;
  lender_name: string;
  total_amount: string;
}

export interface MonthlyAmount {
  month: string;
  total_amount: string;
}

export interface VendorReceivablesResponse {
  lender_wise: LenderEarning[];
  month_wise: MonthlyAmount[];
}

export interface ReportEarning {
  report_id: string;
  property_address: string | null;
  report_category: string;
  total_amount: string;
}

export interface VendorEarningsResponse {
  lender_wise: LenderEarning[];
  report_wise: ReportEarning[];
  report_wise_total: number;
  month_wise: MonthlyAmount[];
}

export interface PendingRequestItem {
  id: string;
  lender_name: string;
  property_address: string | null;
  report_category: string;
  eta_days: number | null;
  price: string | null;
  vendor_status: string;
  accept_deadline: string | null;
  created_at: string;
}

export interface VendorReportItem {
  id: string;
  report_date: string | null;
  property_address: string | null;
  report_category: string;
  property_type: string | null;
  status: string;
  valuation_amount: string | null;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export interface LenderDashboardStats {
  requests_raised: number;
  awaiting_reports: number;
  reports_received: number;
  reports_accepted: number;
  listings_purchased: number;
}

export interface PayableSummaryTotals {
  pending: string;
  billed: string;
  paid: string;
}

export interface PayableTypeAmount {
  payable_type: string;
  total_amount: string;
}

export interface LenderPayablesResponse {
  totals: PayableSummaryTotals;
  month_wise: MonthlyAmount[];
  type_breakdown: PayableTypeAmount[];
}

export interface RecentRequestItem {
  id: string;
  property_address: string | null;
  report_category: string;
  lender_status: string;
  vendor_name: string | null;
  created_at: string;
}

export interface AdminDashboardStats {
  total_vendors: number;
  total_lenders: number;
  total_reports: number;
  total_revenue: string;
  pending_payables: string;
  open_requests: number;
}

export interface AdminVendorRow {
  vendor_id: string;
  vendor_name: string;
  city: string | null;
  requests_served: number;
  reports_uploaded: number;
  active_listings: number;
  downloads: number;
  total_earnings: string;
  lender_count: number;
}

export interface AdminLenderRow {
  lender_id: string;
  lender_name: string;
  city: string | null;
  requests_raised: number;
  reports_received: number;
  listings_purchased: number;
  total_payable: string;
  total_paid: string;
  vendor_count: number;
}

export interface AdminReportRow {
  report_id: string;
  report_date: string | null;
  vendor_name: string;
  lender_name: string | null;
  property_address: string | null;
  report_category: string;
  property_type: string | null;
  status: string;
  valuation_amount: string | null;
}

export interface AdminOpenRequestRow {
  request_id: string;
  lender_name: string;
  property_address: string | null;
  report_category: string;
  lender_status: string;
  vendor_name: string | null;
  created_at: string;
  eta_days: number | null;
  broadcast_round: number | null;
}
