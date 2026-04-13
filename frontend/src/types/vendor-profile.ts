export interface VendorProfile {
  id: string;
  vendor_id: string;
  display_photo: string | null;
  bio: string | null;
  founding_year: number | null;
  certifications: Record<string, string> | null;
  specialization_tags: string[] | null;
  quality_score: string;
  vendor_tier: "NEW" | "VERIFIED" | "TOP_VALUER";
  tier_changed_at: string | null;
  profile_completeness: number;
  created_at: string;
  updated_at: string;
}

export interface VendorPublicProfile {
  vendor_id: string;
  vendor_name: string;
  display_photo: string | null;
  bio: string | null;
  founding_year: number | null;
  certifications: Record<string, string> | null;
  specialization_tags: string[] | null;
  quality_score: string;
  vendor_tier: "NEW" | "VERIFIED" | "TOP_VALUER";
  profile_completeness: number;
  total_completed_jobs: number;
  avg_rating: number | null;
  total_ratings: number;
  first_time_acceptance_rate: number | null;
  avg_turnaround_hours: number | null;
  on_time_delivery_rate: number | null;
  service_areas: ServiceAreaInfo[];
}

export interface ServiceAreaInfo {
  city: string;
  areas: string[] | null;
  service_type: string | null;
}

export interface PortfolioItem {
  id: string;
  property_type: string;
  report_category: string;
  city: string;
  area: string | null;
  completed_at: string | null;
}

export interface PortfolioResponse {
  items: PortfolioItem[];
  total: number;
  page: number;
  page_size: number;
}

export interface VendorRating {
  id: string;
  lender_user_id: string;
  vendor_id: string;
  report_request_id: string;
  rating: number;
  created_at: string;
}

export interface VendorRatingSummary {
  vendor_id: string;
  avg_rating: number | null;
  total_ratings: number;
  rating_distribution: Record<string, number>;
}

export interface TierProgress {
  current_tier: "NEW" | "VERIFIED" | "TOP_VALUER";
  tier_changed_at: string | null;
  quality_score: string;
  completed_jobs: number;
  avg_rating: number | null;
  first_time_acceptance_rate: number | null;
  on_time_delivery_rate: number | null;
  avg_response_hours: number | null;
  next_tier: string | null;
  next_tier_requirements: {
    min_completed_jobs?: number;
    min_quality_score?: number;
    max_response_hours?: number;
    current_completed_jobs?: number;
    current_quality_score?: string;
    current_avg_response_hours?: number | null;
  } | null;
}
