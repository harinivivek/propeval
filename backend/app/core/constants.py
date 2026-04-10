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
