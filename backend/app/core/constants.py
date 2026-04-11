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
