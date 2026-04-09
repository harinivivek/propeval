export type LenderRequestStatus =
  | "DRAFT"
  | "SENT"
  | "AWAITED"
  | "RECEIVED"
  | "ACCEPTED"
  | "SENT_FOR_REVIEW"
  | "REJECTED";

export type VendorRequestStatus =
  | "INCOMING"
  | "DENIED"
  | "PENDING"
  | "SENT"
  | "ACCEPTED"
  | "REVISION";

export type RejectionReason =
  | "LOW_PRICE"
  | "NOT_AVAILABLE"
  | "DO_NOT_WANT_TO_SHARE";

export interface ReportRequest {
  id: string;
  lender_id: string;
  lender_user_id: string;
  branch_id: string | null;
  request_type: "NEW" | "UPDATE" | "NEARBY";
  report_category: "VALUATION" | "LEGAL";
  num_reports_needed: number;
  property_address: string | null;
  property_type: "RESIDENTIAL" | "COMMERCIAL" | "INDUSTRIAL" | "AGRICULTURAL";
  plot_extent_sqft: string | null;
  built_up_sqft: string | null;
  loan_applicant_name: string | null;
  city: string | null;
  area: string | null;
  pin_code: string | null;
  eta_days: number | null;
  price: string | null;
  vendor_specified_id: string | null;
  allow_broadcast_on_reject: boolean;
  parent_report_id: string | null;
  comments: string | null;
  lender_status: LenderRequestStatus;
  vendor_status: VendorRequestStatus | null;
  created_at: string;
  updated_at: string;
}

export interface ReportRequestCreate {
  report_category: "VALUATION" | "LEGAL";
  property_address: string;
  city: string;
  area?: string;
  pin_code?: string;
  property_type: string;
  plot_extent_sqft?: number;
  built_up_sqft?: number;
  loan_applicant_name: string;
  vendor_specified_id?: string;
  allow_broadcast_on_reject?: boolean;
  comments?: string;
}

export interface EligibleVendor {
  id: string;
  name: string;
  city: string | null;
  areas: string[] | null;
}

export interface RequestFilters {
  status?: string;
  report_category?: string;
  property_type?: string;
  page?: number;
  per_page?: number;
}

export interface PollResponse {
  incoming_requests: number;
  updated_requests: number;
  last_checked: string;
}
