# Phase 8: Templates & Report Formatting — Design Spec

**Date:** 2026-04-10
**Status:** Approved
**Scope:** Custom report templates for lenders with branding + field selection, HTML-to-PDF rendering

---

## 1. Overview

Lenders can configure custom report templates that control branding (logo, colors, header/footer) and field selection/ordering. When downloading a report, lenders choose between their custom template format or the vendor's original PDF. Vendors have no template configuration — their uploaded PDFs remain as-is.

### Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Template scope | Branding + field selection | Banks need logo/colors and field control, not freeform document authoring |
| Editor approach | Form-based builder | Simpler than TipTap, predictable PDF output, faster to build |
| PDF generation | HTML → PDF (WeasyPrint) | Reuses web tech, Jinja2 templates, good print CSS support |
| Upload capability | Logo only | Full HTML upload adds sanitization complexity with little value |
| Download behavior | Lender chooses per-download | Some reports have diagrams/photos best viewed in original PDF |
| Fallback (no template) | Original PDF | Zero-risk default, current behavior preserved |

---

## 2. Data Model

### ReportTemplate

New model inheriting from `BaseModel` (UUID PK + timestamps).

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | Auto-generated PK |
| `lender_id` | UUID (FK → lenders.id) | Required |
| `name` | String(100) | e.g. "ABCL Standard" |
| `is_active` | Boolean | Only one active per lender |
| `logo_path` | String, nullable | Relative path in `/app/media/logos/{lender_id}/` |
| `config_json` | JSONB | Structured template configuration (see below) |
| `created_at` | DateTime | From BaseModel |
| `updated_at` | DateTime | From BaseModel |

**Constraint:** Application-level enforcement of one active template per lender (deactivate previous on activation).

### config_json Structure

```json
{
  "header": {
    "bank_name": "ABCL Bank",
    "primary_color": "#1a3b5c",
    "secondary_color": "#f0f4f8",
    "show_logo": true,
    "subtitle": "Property Valuation Report"
  },
  "sections": [
    { "key": "property_address", "label": "Property Address", "enabled": true, "order": 1 },
    { "key": "property_type", "label": "Property Type", "enabled": true, "order": 2 },
    { "key": "valuation_amount", "label": "Valuation Amount", "enabled": true, "order": 3 },
    { "key": "plot_extent_sqft", "label": "Plot Area (sq ft)", "enabled": false, "order": 4 },
    { "key": "built_up_sqft", "label": "Built-up Area (sq ft)", "enabled": false, "order": 5 },
    { "key": "loan_applicant_name", "label": "Applicant Name", "enabled": true, "order": 6 },
    { "key": "report_date", "label": "Report Date", "enabled": true, "order": 7 }
  ],
  "footer": {
    "text": "Confidential - For internal use only",
    "show_page_numbers": true
  }
}
```

### Available Report Fields

Static list of fields the template can reference. Values sourced from Report model columns and `content_json` anchor/additional fields:

| Key | Source | Default Label |
|-----|--------|---------------|
| `property_address` | Report.property_address | Property Address |
| `property_type` | Report.property_type | Property Type |
| `valuation_amount` | Report.valuation_amount | Valuation Amount |
| `plot_extent_sqft` | Report.plot_extent_sqft | Plot Area (sq ft) |
| `built_up_sqft` | Report.built_up_sqft | Built-up Area (sq ft) |
| `loan_applicant_name` | Report.loan_applicant_name | Applicant Name |
| `report_date` | Report.report_date | Report Date |
| `city` | Report.city | City |
| `pin_code` | Report.pin_code | PIN Code |
| `latitude` | Report.latitude | Latitude |
| `longitude` | Report.longitude | Longitude |
| `report_category` | Report.report_category | Report Category |
| `expiry_date` | Report.expiry_date | Expiry Date |

Fields from `content_json.anchor_fields` and `content_json.additional_fields` are also available — the template builder shows all fields that exist on the report, with the above as the default/guaranteed set.

---

## 3. Backend Services

### Template Service (`app/services/template_service.py`)

| Function | Description |
|----------|-------------|
| `create_template(db, lender_id, name, config_json, logo_path?)` | Creates template, deactivates previous active |
| `update_template(db, template_id, config_json?, name?)` | Updates config or name |
| `upload_logo(db, template_id, file)` | Saves logo to `media/logos/{lender_id}/`, updates `logo_path`. Resizes to max 200x80px. |
| `get_active_template(db, lender_id)` | Returns active template or None |
| `list_templates(db, lender_id)` | All templates (active + archived) ordered by created_at desc |
| `activate_template(db, template_id)` | Deactivates current active, activates this one |
| `delete_template(db, template_id)` | Only if not active. Raises error otherwise. |

### PDF Render Service (`app/services/pdf_render_service.py`)

| Function | Description |
|----------|-------------|
| `render_report_pdf(report, template)` | Merges report data into template, returns PDF bytes |

Rendering pipeline:
1. Extract field values from `Report` model columns + `content_json`
2. Filter to enabled fields in `config_json.sections`, ordered by `order`
3. Render Jinja2 master template (`backend/app/templates/report_master.html`) with field data + header/footer config
4. Logo embedded as base64 data URI in HTML
5. Convert HTML → PDF via WeasyPrint with A4 page size, CSS `@page` rules
6. Return PDF bytes

**Caching:** Rendered PDFs cached at `media/rendered/{report_id}_{template_id}.pdf`. Cache invalidated when:
- Template `config_json` or `logo_path` changes (delete all cached PDFs for that template)
- Report `content_json` changes (delete cached PDF for that report)

**Performance:** Rendering happens synchronously on download. WeasyPrint is fast for single-page structured reports. No Celery task needed.

### Jinja2 Master Template (`backend/app/templates/report_master.html`)

Clean, print-optimized HTML/CSS layout:
- `@page` CSS rules for A4 margins, headers, footers
- Header section: logo (left), bank name + subtitle (right), colored banner using `primary_color`
- Body section: table of field label/value pairs, ordered per config
- Footer section: custom text + page numbers
- Professional styling with `secondary_color` for alternating rows

---

## 4. API Endpoints

### Template Router (`app/api/lender/templates.py`)

Prefix: `/api/lender/templates`
Auth: `require_role("LENDER")`

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/` | List all templates for lender |
| `GET` | `/active` | Get active template (or 404) |
| `POST` | `/` | Create new template |
| `PUT` | `/{id}` | Update template config/name |
| `POST` | `/{id}/logo` | Upload logo (multipart/form-data) |
| `PATCH` | `/{id}/activate` | Set as active template |
| `DELETE` | `/{id}` | Delete inactive template |

### Download Endpoint Changes

Modify two existing download endpoints to accept `?format=template` query param:

**`GET /api/reports/{report_id}/download`** (`app/api/common/download.py`):
- Add optional `format` query param (`original` | `template`, default `original`)
- If `format=template`: check `current_user.user_type == LENDER`, resolve lender_id via LenderUser join, get active template, render PDF. If user is not a lender or has no template, fall back to original.
- If `format=original`: serve original file (current behavior)
- Vendors and admins always get the original PDF regardless of `format` param

**`GET /api/lender/listings/{listing_id}/reports/{report_id}/download`** (`app/api/lender/listings.py`):
- Same `?format=template` param and logic

---

## 5. Frontend — Lender Template Settings

### Settings Page Changes

Add "Report Template" tab to lender settings page alongside existing "Users" tab.

**Tab structure:** `Users | Report Template`

### Template Builder Component (`app/lender/settings/_components/template-builder.tsx`)

Three card sections:

**1. Header Config**
- Logo upload dropzone (drag or click, shows preview thumbnail, accepts PNG/JPG, max 2MB)
- Bank name text input (pre-filled from org name)
- Subtitle text input
- Primary color hex input with color swatch preview
- Secondary color hex input with color swatch preview

**2. Field Selection & Ordering**
- List of all available report fields
- Each field row: drag handle | checkbox (enable/disable) | editable label text | field key (read-only, muted)
- Drag-to-reorder via `@dnd-kit/sortable`
- Disabled fields shown at bottom, grayed out, still reorderable

**3. Footer Config**
- Custom footer text input (single line)
- "Show page numbers" toggle switch

**Actions:**
- "Save Template" primary button — creates or updates active template
- "Template History" link — expandable section showing archived templates with name, date, and "Activate" button

### Template Types (`frontend/src/types/template.ts`)

```typescript
interface TemplateSection {
  key: string;
  label: string;
  enabled: boolean;
  order: number;
}

interface TemplateConfig {
  header: {
    bank_name: string;
    primary_color: string;
    secondary_color: string;
    show_logo: boolean;
    subtitle: string;
  };
  sections: TemplateSection[];
  footer: {
    text: string;
    show_page_numbers: boolean;
  };
}

interface ReportTemplate {
  id: string;
  lender_id: string;
  name: string;
  is_active: boolean;
  logo_path: string | null;
  config_json: TemplateConfig;
  created_at: string;
  updated_at: string;
}
```

---

## 6. Frontend — Download Button Changes

### DownloadButton Component (`frontend/src/components/download-button.tsx`)

Replaces current download links/buttons on:
- Lender request detail page
- Lender purchased report page

**Behavior:**
- On mount, checks if lender has active template (via cached API call or parent prop)
- **No template:** Single "Download PDF" button (current behavior)
- **Has template:** Split-button dropdown:
  - Primary action: "Download (My Template)" — calls download endpoint with `?format=template`
  - Secondary action: "Download (Original)" — calls download endpoint without format param
- Uses fetch + blob + Authorization header pattern (same as CSV export, no JWT in URL)

---

## 7. Vendor Settings

No template configuration for vendors. Add a read-only info note in vendor settings:

> "Reports you upload are stored in their original PDF format. Lenders with custom templates will see a formatted version when they download."

This is informational only — no new vendor API endpoints or models.

---

## 8. Dependencies

### Backend
- `weasyprint` — HTML → PDF conversion
- `Jinja2` — already available via FastAPI/Starlette
- `Pillow` — logo resizing (already available for image processing)

### Frontend
- `@dnd-kit/core` + `@dnd-kit/sortable` — drag-and-drop field reordering

---

## 9. Out of Scope

- Vendor-side template configuration
- GTR standard/default template (fallback is always original PDF)
- Batch re-rendering of existing reports when template changes
- Live preview in the template builder
- Full HTML template upload
- DOCX or other format support
- Template versioning beyond active/archived status
