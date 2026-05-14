export type ReportStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "EXTRACTION_FAILED"
  | "READY_TO_PUBLISH"
  | "PUBLISHED"
  | "ARCHIVED";

export interface ExtractedField {
  value: string | number | null;
  confidence: number;
  type: "text" | "number" | "currency" | "date";
  original?: string | number | null;
  edited?: boolean;
}

export interface ContentJson {
  extraction_version: number;
  provider: string;
  model: string;
  anchor_fields: Record<string, ExtractedField>;
  additional_fields: Record<string, ExtractedField>;
  raw_text: string;
  extracted_at: string;
  page_count: number;
  usage: { input_tokens: number; output_tokens: number };
}

export interface Report {
  id: string;
  request_id: string | null;
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
  content_json: ContentJson | null;
  listing_approved: boolean;
  is_active: boolean;
  latitude?: string | null;
  longitude?: string | null;
}

export interface ReportRevision {
  revision_number: number;
  comments: string | null;
  created_at: string;
}
