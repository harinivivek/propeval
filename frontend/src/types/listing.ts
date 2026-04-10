import { Report } from "./report";

export interface ListingResponse {
  id: string;
  macro_location: string;
  city: string;
  pin_code: string;
  property_type: string;
  status: string;
  report_count: number;
  vendor_count: number;
  latest_report_date: string | null;
}

export interface ListingBrowseResponse {
  listings: ListingResponse[];
  total: number;
  page: number;
  page_size: number;
}

export interface RedactedReportPreview {
  id: string;
  report_category: string;
  locality: string | null;
  city: string | null;
  pin_code: string | null;
  property_type: string | null;
  plot_extent_sqft: number | null;
  built_up_sqft: number | null;
  report_date: string | null;
  latitude: number | null;
  longitude: number | null;
  content_preview: Record<string, string | number | null> | null;
  is_purchased: boolean;
}

export interface ListingDetailResponse {
  listing: ListingResponse;
  reports: RedactedReportPreview[];
}

export interface VendorListingReportItem {
  id: string;
  report_category: string;
  property_address: string | null;
  city: string | null;
  pin_code: string | null;
  property_type: string | null;
  report_date: string | null;
  status: string;
  listing_approved: boolean;
}

export interface VendorListingGroup {
  listing: ListingResponse;
  reports: VendorListingReportItem[];
}

export interface VendorListingsResponse {
  groups: VendorListingGroup[];
  total: number;
  page: number;
  page_size: number;
}

export interface PurchaseResponse {
  id: string;
  report_id: string;
  listing_id: string;
  lender_id: string;
  price: string;
  created_at: string;
}

export interface PurchasedReportItem {
  purchase: PurchaseResponse;
  report: Report;
}

export interface PurchasedReportsResponse {
  items: PurchasedReportItem[];
  total: number;
  page: number;
  page_size: number;
}
