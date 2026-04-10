# Phase 4: OCR & Report Processing — Design Spec

**Date:** 2026-04-10
**Phase:** 4 of 12
**Goal:** Uploaded reports are OCR'd via Claude API, structured data extracted, and editable by vendors before publishing.

---

## Decisions

| Decision | Choice |
|----------|--------|
| OCR engine | Claude API (vision capabilities) via Anthropic SDK |
| Extraction schema | Flexible — anchor fields + Claude decides additional relevant fields |
| Bulk upload UX | Multi-file picker + batched async Celery processing |
| Vendor edit UX | Key-value form with "View Original" button, vendors can add fields |
| Mandatory validation | Global fixed required fields now, schema supports per-lender later |
| Architecture | Service abstraction layer (`OcrProvider` interface + `ClaudeOcrProvider`) |
| Model for extraction | Claude Sonnet (cost-effective for structured extraction) |

---

## 1. OCR Service Architecture

### Service Layer Structure

```
app/services/ocr/
├── __init__.py
├── base.py              # OcrProvider abstract base class
├── claude_provider.py   # Claude API vision implementation
└── ocr_service.py       # OcrService — orchestrates extraction
```

### OcrProvider (Abstract Base)

```python
class OcrProvider(ABC):
    @abstractmethod
    async def extract(self, pdf_path: str) -> ExtractionResult:
        """Extract structured data from a PDF file."""
        ...
```

**ExtractionResult dataclass:**
- `anchor_fields: dict` — known important fields
- `additional_fields: dict` — whatever else Claude finds relevant
- `confidence: float` — overall confidence score
- `raw_text: str` — full text content
- `page_count: int`
- `usage: dict` — token usage for cost tracking

### ClaudeOcrProvider

- Converts PDF pages to images using PyMuPDF (`fitz`)
- Sends pages to Claude API (Sonnet) with a structured extraction prompt
- Prompt asks for:
  - Anchor fields: address, property_type, valuation_amount, built_up_area, owner_name
  - Any other relevant fields Claude identifies from the document
  - Confidence score (0-1) per field
  - Field type inference (text, number, date, currency)
- Handles multi-page PDFs by sending all pages in a single request (up to `OCR_MAX_PAGES`)
- Returns `ExtractionResult`

### OcrService

- Takes a `Report` instance, calls the active provider
- Stores result in `report.content_json`
- Updates report status: `UPLOADED → PROCESSING → READY_TO_PUBLISH`
- On failure: sets status to `EXTRACTION_FAILED`, logs error with details

### content_json Structure

```json
{
  "extraction_version": 1,
  "provider": "claude",
  "model": "claude-sonnet-4-6",
  "anchor_fields": {
    "property_address": {"value": "123 MG Road, Bengaluru", "confidence": 0.95, "type": "text"},
    "property_type": {"value": "residential", "confidence": 0.99, "type": "text"},
    "valuation_amount": {"value": 5500000, "confidence": 0.88, "type": "currency"},
    "built_up_area": {"value": "1200 sqft", "confidence": 0.92, "type": "text"},
    "owner_name": {"value": "Rajesh Kumar", "confidence": 0.90, "type": "text"}
  },
  "additional_fields": {
    "construction_year": {"value": "2015", "confidence": 0.82, "type": "text"},
    "plot_number": {"value": "A-123", "confidence": 0.91, "type": "text"},
    "boundaries_north": {"value": "Road 40ft", "confidence": 0.78, "type": "text"}
  },
  "raw_text": "...",
  "extracted_at": "2026-04-10T10:30:00Z",
  "page_count": 4,
  "usage": {"input_tokens": 12500, "output_tokens": 800}
}
```

---

## 2. Celery Tasks & Async Processing

### Single Report Processing

**Task:** `process_report_ocr(report_id: UUID)` in `app/jobs/ocr_tasks.py`

- Triggered automatically after report upload (dispatched by report_service)
- Flow: load report → set status `PROCESSING` → call `OcrService.extract()` → save `content_json` → set status `READY_TO_PUBLISH` or `EXTRACTION_FAILED`
- Retry policy: 3 attempts with exponential backoff (30s, 60s, 120s)
- Timeout: 5 minutes per report (`OCR_TASK_TIMEOUT` setting)

### Batch Processing

**Task:** `process_bulk_upload(vendor_id: UUID, report_ids: list[UUID])` in `app/jobs/ocr_tasks.py`

- Triggered after bulk upload completes
- Processes reports in batches of 5 (`OCR_BATCH_SIZE` setting)
- Short delay between batches to respect Claude API rate limits
- Updates `BulkUploadJob` record with progress after each batch

### Integration with Existing Upload Flow

- **Current:** upload → status `UPLOADED` → done
- **New:** upload → status `UPLOADED` → Celery task dispatched → status `PROCESSING` → extraction → `READY_TO_PUBLISH` or `EXTRACTION_FAILED`

---

## 3. New Data Models

### BulkUploadJob

| Field | Type | Purpose |
|-------|------|---------|
| id | UUID | PK (from BaseModel) |
| vendor_id | FK → Vendor | Who initiated the bulk upload |
| total_reports | Integer | Total files uploaded |
| processed_count | Integer | Successfully extracted |
| failed_count | Integer | Failed extraction |
| status | BulkUploadStatus enum | `PENDING`, `IN_PROGRESS`, `COMPLETED`, `PARTIALLY_FAILED` |
| created_at | timestamp | From BaseModel |
| updated_at | timestamp | From BaseModel |

### Enum Changes

- **ReportStatus:** Add `EXTRACTION_FAILED` after `PROCESSING`
- **New enum:** `BulkUploadStatus` — `PENDING`, `IN_PROGRESS`, `COMPLETED`, `PARTIALLY_FAILED`

---

## 4. Vendor UI — Extraction Review & Edit

### Report Detail Page States

Based on report status, vendor sees one of three views:

1. **PROCESSING** — spinner with "Extracting report data..." message. Auto-refreshes via existing `use-polling` hook.
2. **EXTRACTION_FAILED** — error banner with "Retry Extraction" button + option to fill fields manually.
3. **READY_TO_PUBLISH** — extracted data displayed for review and editing.

### Edit Experience (Key-Value Form)

- **Anchor fields section** — always shown at top with required badges on mandatory fields
- **Additional fields section** — Claude-extracted fields rendered as editable inputs
- **Confidence indicators** per field:
  - Green (≥ 90%) — high confidence
  - Yellow (60-89%) — review recommended
  - Red (< 60%) — likely needs correction
- **"Add Field" button** — vendor adds custom key-value pairs (label + value text inputs)
- **"View Original" button** — opens PDF in modal or new tab for cross-referencing
- **"Save Draft"** — saves edits to `content_json` without status change
- **"Publish"** — validates mandatory fields → transitions to `PUBLISHED`

### Field Type Rendering

Claude's extraction includes field types. The form renders appropriate inputs:
- `text` → text input
- `number` → numeric input (numeric keyboard on mobile)
- `currency` → number input with ₹ prefix
- `date` → date picker

### Edit Tracking

When vendor edits an extracted field, the original value is preserved:
```json
{
  "property_address": {
    "value": "124 MG Road, Bengaluru",
    "original": "123 MG Road, Bengaluru",
    "confidence": 0.95,
    "type": "text",
    "edited": true
  }
}
```

If any field has `edited: true`, downloads include a notice: "Some extracted fields were manually edited by the vendor."

### Bulk Upload Page (`/vendor/reports/bulk-upload`)

- Multi-file picker accepting multiple PDFs (max 50 per batch)
- Upload progress bar per file
- After upload, redirects to batch status page showing:
  - Overall progress (X of Y processed)
  - Per-report status (processing / done / failed)
  - Links to individual report detail pages once processed
- Failed reports can be retried individually or as a group

---

## 5. Mandatory Field Validation

### Global Required Fields

Hardcoded in `app/core/constants.py`:
```python
REQUIRED_REPORT_FIELDS = ["property_address", "property_type", "valuation_amount"]
```

### Validation Points

1. **Frontend** — Publish button disabled with tooltip listing missing fields
2. **Backend** — `report_service.validate_for_publish()` checks before status transition to `PUBLISHED`

### Future Per-Lender Extension

The schema supports future extension: required fields stored as a list, currently sourced from constants. A future `LenderReportConfig` table can override the global list per lender.

---

## 6. Image/File Optimization

### PDF Compression (Post-Upload)

- Lightweight Celery task runs after upload, before OCR extraction
- Uses `pikepdf` for lossless PDF optimization (removes duplicate objects, compresses streams)
- If embedded images > 2MB each, downscale to 150 DPI
- Original file preserved with `_original` suffix for audit trail
- Optimized version becomes the serving copy (smaller file = faster Claude API call)

---

## 7. Configuration

### New Settings (`app/core/config.py`)

| Setting | Default | Purpose |
|---------|---------|---------|
| `ANTHROPIC_API_KEY` | required | Claude API authentication |
| `OCR_MODEL` | `claude-sonnet-4-6` | Model used for extraction |
| `OCR_MAX_PAGES` | 20 | Max pages sent per report |
| `OCR_BATCH_SIZE` | 5 | Concurrent reports in bulk processing |
| `OCR_TASK_TIMEOUT` | 300 | Seconds per report extraction |

### Cost Considerations

- ~$0.01-0.05 per report page with Sonnet
- 500-report bulk upload at ~4 pages avg = ~$20-100
- Token usage logged per extraction in `content_json.usage` for cost monitoring

---

## 8. API Endpoints

### New Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | `/api/vendor/reports/bulk-upload` | Upload multiple PDFs, create standalone reports + BulkUploadJob |
| GET | `/api/vendor/reports/bulk-jobs` | List vendor's bulk upload jobs |
| GET | `/api/vendor/reports/bulk-jobs/{job_id}` | Bulk job status + per-report progress |
| POST | `/api/vendor/reports/{report_id}/retry-extraction` | Retry failed OCR extraction |
| PUT | `/api/vendor/reports/{report_id}/extracted-data` | Save edited extraction data |
| POST | `/api/vendor/reports/{report_id}/publish` | Validate and publish report |
| GET | `/api/vendor/reports/{report_id}/pdf` | Serve report PDF for "View Original" cross-referencing |

### Important: Standalone vs Request-Linked Reports

- **Request-linked reports:** Created via `POST /api/vendor/requests/{request_id}/upload` as part of Workflow 1. Tied to a specific lender request.
- **Standalone reports:** Created via bulk upload. Not tied to any request. These go through the same OCR extraction pipeline and, once published, become available as listings directly (per vendor's auto-listing config from Phase 3).
- Both types share the same `Report` model, OCR pipeline, and edit UI. The distinction is whether `request_id` is null.

### Modified Endpoints

- `POST /api/vendor/requests/{request_id}/upload` — after existing upload logic, dispatches `process_report_ocr` Celery task

---

## 9. Frontend Pages

### New Pages

| Path | Purpose |
|------|---------|
| `/vendor/reports/bulk-upload` | Multi-file upload UI |
| `/vendor/reports/bulk-jobs/[id]` | Batch processing status |

### Modified Pages

| Path | Changes |
|------|---------|
| `/vendor/requests/[id]` | Add extraction status display, edit form, confidence indicators, "View Original", "Add Field", publish validation |

---

## 10. Dependencies

### New Python Packages

- `anthropic` — Claude API SDK
- `PyMuPDF` (`fitz`) — PDF to image conversion
- `pikepdf` — PDF lossless compression/optimization

### No New Frontend Packages Required

Existing stack (shadcn/ui components, Tailwind) covers all UI needs.
