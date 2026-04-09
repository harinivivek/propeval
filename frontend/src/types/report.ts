export type ReportStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "READY_TO_PUBLISH"
  | "PUBLISHED"
  | "ARCHIVED";

export interface Report {
  id: string;
  vendor_id: string;
  report_category: "VALUATION" | "LEGAL";
  status: ReportStatus;
  property_address: string | null;
  macro_location: string | null;
  city: string | null;
  pin_code: string | null;
  property_type: string | null;
  plot_extent_sqft: string | null;
  built_up_sqft: string | null;
  valuation_amount: string | null;
  loan_applicant_name: string | null;
  report_date: string | null;
  expiry_date: string | null;
  uploaded_file_path: string | null;
  listing_approved: boolean;
  is_active: boolean;
}

export interface ReportRevision {
  revision_number: number;
  comments: string | null;
  created_at: string;
}
