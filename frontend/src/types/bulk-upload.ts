export type BulkUploadStatus =
  | "PENDING"
  | "IN_PROGRESS"
  | "COMPLETED"
  | "PARTIALLY_FAILED";

export interface BulkUploadJob {
  id: string;
  vendor_id: string;
  total_reports: number;
  processed_count: number;
  failed_count: number;
  status: BulkUploadStatus;
  created_at: string;
  updated_at: string;
}

export interface BulkUploadReportStatus {
  report_id: string;
  status: string;
  property_address: string | null;
}
