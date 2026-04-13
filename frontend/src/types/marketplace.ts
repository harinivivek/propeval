export interface MarketplaceReportResult {
  result_type: "report";
  listing_id: string;
  pin_code: string;
  locality_name: string | null;
  city: string;
  property_type: string;
  report_count: number;
  latest_report_date: string | null;
  vendor_name: string | null;
  vendor_id: string | null;
  vendor_tier: string | null;
  avg_rating: number | null;
  total_ratings: number;
  price: string | null;
  latitude: string | null;
  longitude: string | null;
}

export interface MarketplaceVendorResult {
  result_type: "vendor";
  vendor_id: string;
  vendor_name: string;
  display_photo: string | null;
  vendor_tier: string;
  specialization_tags: string[] | null;
  avg_rating: number | null;
  total_ratings: number;
  total_completed_jobs: number;
  avg_turnaround_hours: number | null;
  quality_score: string;
  service_areas: string[];
  latitude: string | null;
  longitude: string | null;
}

export type MarketplaceResult = MarketplaceReportResult | MarketplaceVendorResult;

export interface MarketplaceSearchResponse {
  results: MarketplaceResult[];
  total: number;
  page: number;
  page_size: number;
}

export interface LocalityOption {
  id: string;
  name: string;
  pin_code: string;
  city: string;
  state: string;
  lat: string | null;
  lng: string | null;
}
