export interface PricingRule {
  id: string;
  lender_id: string;
  report_category: string;
  city: string;
  area: string | null;
  property_type: string;
  new_request_price: string;
  listing_download_price: string;
  update_additional_price: string;
  nearby_additional_price: string;
  is_active: boolean;
}

export interface PricingRuleCreate {
  lender_id: string;
  report_category: string;
  city: string;
  area?: string | null;
  property_type: string;
  new_request_price: string;
  listing_download_price: string;
  update_additional_price: string;
  nearby_additional_price: string;
}
