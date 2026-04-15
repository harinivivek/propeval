# Broadcast configuration
VENDORS_PER_BROADCAST_ROUND = 5
BROADCAST_ACCEPT_WINDOW_MINUTES = 30

# Auto-accept
AUTO_ACCEPT_DAYS = 7

# Polling
POLL_INTERVAL_SECONDS = 30

# File upload
MEDIA_ROOT = "/app/media"
REPORTS_DIR = "reports"
MAX_UPLOAD_SIZE_MB = 20
ALLOWED_CONTENT_TYPES = ["application/pdf"]

# OCR & extraction
REQUIRED_REPORT_FIELDS = ["property_address", "property_type", "valuation_amount"]
OCR_BATCH_DELAY_SECONDS = 2
MAX_BULK_UPLOAD_FILES = 50

# Report extraction section definitions (ordered)
REPORT_SECTIONS = [
    {"key": "general", "label": "(a) General"},
    {"key": "locality", "label": "(b) Locality"},
    {"key": "property", "label": "(c) Property"},
    {"key": "boundaries", "label": "(d) Boundaries"},
    {"key": "structural_details", "label": "(e) Structural Details"},
    {"key": "quality_of_construction", "label": "(f) Quality of Construction"},
    {"key": "technical_approvals", "label": "(g) Technical Approvals"},
    {"key": "valuation_fair_market", "label": "(h) Valuation — Fair Market Value"},
    {"key": "valuation_land_building", "label": "(i) Valuation — Land & Building Method"},
    {"key": "recommended_valuation", "label": "(j) Recommended Valuation"},
    {"key": "remarks", "label": "(k) Remarks"},
    {"key": "google_location", "label": "(l) Google Location"},
    {"key": "photos", "label": "(m) Photos"},
]

SECTION_FIELD_LABELS: dict[str, str] = {
    # (a) General
    "customer_id": "Customer ID",
    "property_address_with_floor_pin": "Property Address (Floor & PIN)",
    "nearest_landmark": "Nearest Landmark",
    "cooperative_housing_society": "Co-operative Housing Society",
    "builder_developer": "Builder / Developer",
    "contact_detail": "Contact Detail",
    "case_type": "Case Type",
    "current_owner_name": "Current Owner Name",
    "address_of_property": "Address of Property",
    "date_of_inspection": "Date of Inspection",
    # (b) Locality
    "ward_no_municipal_land_no": "Ward No / Municipal Land No",
    "vicinity": "Vicinity",
    "type_property_as_per_approvals": "Type of Property (per Approvals)",
    "proximity_civic_amenities": "Proximity to Civic Amenities",
    "nearest_railway_station": "Nearest Railway Station",
    "nearest_bus_stop": "Nearest Bus Stop",
    "nearest_hospital": "Nearest Hospital",
    "conditions_of_approach": "Conditions of Approach",
    "plot_demarcated_at_site": "Plot Demarcated at Site",
    "land_freehold_or_leasehold": "Freehold / Leasehold",
    "identified_through_person_met": "Identified Through (Person Met)",
    # (c) Property
    "property_usage_observation": "Property Usage (Site Observation)",
    "additional_amenities": "Additional Amenities",
    "no_of_stories": "No. of Stories",
    "occupied_by": "Occupied By",
    "relationship_occupant_customer": "Occupant Relationship with Customer",
    "name_on_society_board": "Name on Society Board",
    "within_municipal_limits": "Within Municipal Limits",
    # (d) Boundaries
    "north_as_per_deed": "North (per Deed)",
    "south_as_per_deed": "South (per Deed)",
    "east_as_per_deed": "East (per Deed)",
    "west_as_per_deed": "West (per Deed)",
    "north_as_per_site": "North (per Site)",
    "south_as_per_site": "South (per Site)",
    "east_as_per_site": "East (per Site)",
    "west_as_per_site": "West (per Site)",
    "boundaries_match": "Boundaries Match Documentation",
    # (e) Structural Details
    "type_of_structure": "Type of Structure",
    "no_of_floors": "No. of Floors",
    "no_of_wings": "No. of Wings",
    "no_of_flats_each_floor": "No. of Flats per Floor",
    "no_of_lifts": "No. of Lifts",
    "internal_composition": "Internal Composition",
    "age_of_property": "Age of Property",
    "estimated_future_life": "Estimated Future Life",
    "construction_stage": "Construction Stage",
    "recommendation": "Recommendation",
    # (f) Quality of Construction
    "beam_column_structure": "Beam & Column Structure",
    "appearance_maintenance": "Appearance & Maintenance",
    "flooring_finishing": "Flooring & Finishing",
    "roofing_terracing": "Roofing & Terracing",
    "quality_fixtures_fittings": "Fixtures & Fittings Quality",
    # (g) Technical Approvals
    "layout_plan_details": "Layout Plan Details",
    "approved_plan_details": "Approved Plan (No. & Date)",
    "construction_permission": "Construction Permission (No. & Date)",
    "legal_document_details": "Legal Document Details",
    "violations_observed": "Violations Observed",
    "structure_confirming_byelaws": "Confirms Local Byelaws",
    # (h) Valuation — Fair Market Value
    "area_as_per_measurement": "Area (per Measurement)",
    "area_as_per_agreement": "Area (per Agreement)",
    "area_as_per_approved_plan": "Area (per Approved Plan)",
    "area_considered_for_valuation": "Area Considered for Valuation",
    "rate_per_sqft": "Rate (per Sq.Ft.)",
    "fair_market_value_unit": "(A) Fair Market Value of Unit",
    "car_parks_count": "No. of Car Parks",
    "car_park_rate": "Rate per Car Park",
    "parking_value": "(B) Value of Parking",
    "one_time_acquisition_cost": "(C) One Time Acquisition Cost",
    "final_value_comparison_method": "Final Value — Comparison Method (A+B+C)",
    # (i) Valuation — Land & Building
    "land_area_as_per_plan": "Land Area (per Plan)",
    "land_area_as_per_deed": "Land Area (per Deed)",
    "land_area_as_per_measurement": "Land Area (per Measurement)",
    "land_area_considered": "Land Area Considered",
    "land_rate": "Land Rate",
    "land_value": "(A) Land Value",
    "area_measurement_lb": "Area (per Measurement)",
    "area_agreement_lb": "Area (per Agreement)",
    "area_approved_plan_lb": "Area (per Approved Plan)",
    "area_considered_lb": "Area Considered",
    "loading": "Loading (%)",
    "built_up_area_lb": "Built-up Area",
    "construction_rate": "Construction Rate",
    "construction_cost_completion": "(B) Construction Cost at Completion",
    "current_construction_stage_pct": "(C) Current Construction Stage (%)",
    "proportionate_construction_cost": "(D) Proportionate Construction Cost (B×C)",
    "value_land_building_current": "Value — L&B Current Date (A+D)",
    "value_land_building_completion": "Value — L&B on Completion (A+B)",
    # (j) Recommended Valuation
    "stage_of_construction": "Stage of Construction",
    "stage_percentage": "Stage (%)",
    "recommended_disbursement_pct": "Recommended Disbursement (%)",
    "recommended_mortgage_valuation": "Recommended Mortgage Valuation",
    "realizable_value": "Realizable Value",
    "distressed_valuation_80pct": "Distressed Valuation (@80%)",
    "rental_value_per_month": "Rental Value (per Month)",
    "longitude_latitude": "Longitude & Latitude",
    "reconstruction_cost_insurable": "Reconstruction / Insurable Value",
    # (k) Remarks
    "remarks": "Remarks",
    # (l) Google Location
    "google_location_url": "Google Location",
    # (m) Photos
    "photos_description": "Photos Description",
}

# Update request checklist items
UPDATE_CHECKLIST_ITEMS = {
    "RECHECK_VALUATION": "Recheck valuation amount",
    "VERIFY_BOUNDARIES": "Verify property boundaries",
    "UPDATE_PHOTOS": "Update property photos",
    "VERIFY_OCCUPANCY": "Verify current occupancy",
    "UPDATE_CONSTRUCTION": "Update construction status",
    "VERIFY_LEGAL_STATUS": "Verify legal/title status",
    "OTHER": "Other (see comments)",
}

# Templates
LOGOS_DIR = "logos"
RENDERED_DIR = "rendered"
LOGO_MAX_WIDTH = 200
LOGO_MAX_HEIGHT = 80
LOGO_MAX_SIZE_MB = 2
LOGO_ALLOWED_TYPES = ["image/png", "image/jpeg"]

TEMPLATE_FIELDS = [
    {"key": "property_address", "label": "Property Address"},
    {"key": "property_type", "label": "Property Type"},
    {"key": "valuation_amount", "label": "Valuation Amount"},
    {"key": "plot_extent_sqft", "label": "Plot Area (sq ft)"},
    {"key": "built_up_sqft", "label": "Built-up Area (sq ft)"},
    {"key": "loan_applicant_name", "label": "Applicant Name"},
    {"key": "report_date", "label": "Report Date"},
    {"key": "city", "label": "City"},
    {"key": "pin_code", "label": "PIN Code"},
    {"key": "latitude", "label": "Latitude"},
    {"key": "longitude", "label": "Longitude"},
    {"key": "report_category", "label": "Report Category"},
    {"key": "expiry_date", "label": "Expiry Date"},
]
