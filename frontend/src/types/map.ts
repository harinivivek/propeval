export interface ListingMapItem {
  listing_id: string;
  latitude: number;
  longitude: number;
  macro_location: string;
  city: string;
  pin_code: string;
  property_type: string;
  report_count: number;
  vendor_count: number;
  latest_report_date: string | null;
}

export interface ListingMapResponse {
  items: ListingMapItem[];
}

export interface VendorOwnReport {
  report_id: string;
  latitude: number;
  longitude: number;
  property_address: string;
  city: string;
  property_type: string | null;
  report_category: string | null;
  status: string | null;
  report_date: string | null;
}

export interface CompetitorArea {
  pin_code: string;
  city: string;
  latitude: number;
  longitude: number;
  report_count: number;
}

export interface VendorMapResponse {
  own_reports: VendorOwnReport[];
  competitor_areas: CompetitorArea[];
}
