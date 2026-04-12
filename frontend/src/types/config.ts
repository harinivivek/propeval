export interface SystemConfigResponse {
  id: string;
  vendors_per_broadcast_round: number;
  broadcast_accept_window_minutes: number;
  auto_accept_days: number;
  max_upload_size_mb: number;
  required_report_fields: string[] | null;
  updated_by: string | null;
  updated_at: string;
}

export interface SystemConfigUpdate {
  vendors_per_broadcast_round?: number;
  broadcast_accept_window_minutes?: number;
  auto_accept_days?: number;
  max_upload_size_mb?: number;
  required_report_fields?: string[];
}

export interface VendorConfigResponse {
  id: string;
  vendor_id: string;
  auto_listing_enabled: boolean;
  price_threshold: string | null;
  separate_valuation_legal: boolean;
}

export interface ExclusionEntry {
  lender_id: string;
  lender_name: string;
  created_at: string;
}

export interface VendorConfigWithExclusions {
  config: VendorConfigResponse;
  exclusions: ExclusionEntry[];
}

export interface VendorPreferenceEntry {
  vendor_id: string;
  vendor_name: string;
  auto_approve: boolean;
}

export interface LenderConfigResponse {
  id: string;
  lender_id: string;
}

export interface LenderConfigWithPreferences {
  config: LenderConfigResponse;
  vendor_preferences: VendorPreferenceEntry[];
}
