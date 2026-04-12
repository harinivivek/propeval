# Phase 12A: Billing & Invoicing — Design Spec

**Date:** 2026-04-12
**Status:** Approved
**Scope:** Monthly invoice generation, invoice lifecycle management, admin billing page, enhanced vendor/lender billing views

---

## 1. Overview

Phase 12A completes the billing loop. The existing foundation — VendorEarning, LenderPayable, and Invoice models, billing service, dashboard aggregations — handles entry creation. This phase adds invoice generation, lifecycle management (PENDING → BILLED → PAID), admin billing controls, and enhanced vendor/lender views with drill-down detail.

**What's included:**
1. Monthly invoice generation Celery job with manual trigger
2. Structured invoice numbering (GTR-PAY/RCV-YYYY-MM-NNNN)
3. Invoice status lifecycle with admin controls
4. Dedicated admin billing page with bulk operations
5. Enhanced vendor receivables and lender payables views with drill-down and CSV export
6. Notifications and activity logging for billing events

**What's NOT included (deferred to Phase 12B/C):**
- Payment gateway integration (Razorpay/Stripe)
- PDF invoice rendering
- Tax calculations (GST/TDS)
- System config UI (broadcast params, acceptance rules)
- Vendor/lender config (auto-listing, exclusions, thresholds)
- Storage optimization, performance tuning, security audit

## 2. Invoice Generation

### 2.1 Monthly Celery Job

**Task:** `app.jobs.billing_tasks.generate_monthly_invoices`

**Schedule:** Celery Beat crontab — 1st of each month at 02:00 AM

**Logic:**
1. Determine target month (previous month from current date)
2. Check if invoices already exist for target month — if yes, skip (idempotent)
3. Aggregate VendorEarning rows grouped by `vendor_id` for the target month
4. For each vendor with earnings: create one Invoice (type=RECEIVABLE, status=PENDING)
5. Aggregate LenderPayable rows grouped by `lender_id` for the target month
6. For each lender with payables: create one Invoice (type=PAYABLE, status=PENDING)
7. Assign sequential invoice numbers to all created invoices
8. Cache `line_items_count` on each invoice
9. Send in-app notifications to each organization
10. Log INVOICE_GENERATED activity for each invoice

**Error handling:** If generation fails mid-way, no partial invoices are committed (single transaction). Celery retry with exponential backoff (max 3 retries).

### 2.2 Manual Trigger

**Endpoint:** `POST /api/admin/billing/generate`

**Body:** `{ "month": "2026-03" }`

**Behavior:**
- Calls the same generation logic as the Celery job
- Idempotent — if invoices exist for the month, returns them without duplicating
- Returns list of generated (or existing) invoices
- Useful for: catch-up after late billing entries, regeneration after corrections, first-time setup

### 2.3 Invoice Number Format

- **Lender payables:** `GTR-PAY-YYYY-MM-NNNN` (e.g., `GTR-PAY-2026-03-0001`)
- **Vendor receivables:** `GTR-RCV-YYYY-MM-NNNN` (e.g., `GTR-RCV-2026-03-0001`)
- Sequential counter per month per type
- Generated via DB query: `SELECT MAX(invoice_number) FROM invoices WHERE month = ? AND invoice_type = ?`, parse the NNNN suffix, increment

### 2.4 Linking Invoices to Line Items

No new FK columns needed. Invoices link to their underlying entries via:
- `Invoice.organization_id` = `VendorEarning.vendor_id` (for RECEIVABLE) or `LenderPayable.lender_id` (for PAYABLE)
- `Invoice.month` = `VendorEarning.month` or `LenderPayable.month`

The dashboard service already queries by these dimensions. Invoice detail views join on the same criteria.

## 3. Invoice Lifecycle

### 3.1 Status Transitions

```
PENDING → BILLED → PAID
                  ↓
              BILLED (reversal)
```

| From | To | Trigger | Meaning |
|------|----|---------|---------|
| PENDING | BILLED | Admin action | Invoice sent to organization |
| BILLED | PAID | Admin action | Payment received and confirmed |
| PAID | BILLED | Admin action | Payment reversal (bounced/error) |

- No deletion — invoices are permanent records
- Transitions enforced in billing service (invalid transitions return 400)
- Each transition logged as INVOICE_STATUS_UPDATED activity

### 3.2 Bulk Status Updates

Admin can select multiple invoices and apply a single status change. Validation runs per-invoice — valid transitions succeed, invalid ones are skipped with a warning in the response.

## 4. Admin Billing Page

### 4.1 Page Layout (`/admin/billing`)

New top-level admin page, added to admin sidebar navigation.

**Header row:**
- Month selector dropdown (defaults to current month, navigable to any past month)
- "Generate Invoices" button (calls manual trigger, disabled if invoices already exist for selected month)

**Summary cards row:**
- Total Payables (sum of PAYABLE invoices for selected month)
- Total Receivables (sum of RECEIVABLE invoices for selected month)
- Pending count
- Paid count

**Two tabs:** Lender Payables | Vendor Receivables

### 4.2 Invoice Table (per tab)

| Column | Description |
|--------|-------------|
| Checkbox | For bulk selection |
| Invoice Number | GTR-PAY/RCV-YYYY-MM-NNNN |
| Organization | Lender or vendor name |
| Amount | Formatted currency |
| Line Items | Count of underlying entries |
| Status | Badge (amber=PENDING, blue=BILLED, green=PAID) |
| Generated | Date of invoice generation |
| Actions | Status update dropdown |

**Bulk action bar** (visible when items selected): "Mark as Billed" | "Mark as Paid" buttons

**Row click** → expandable detail showing underlying entries:

| Column | Description |
|--------|-------------|
| Report ID | Link to report |
| Request ID | Link to request (if applicable) |
| Type | NEW_REQUEST / LISTING_DOWNLOAD / UPDATE / NEARBY |
| Amount | Entry amount |
| Date | Entry created_at |

### 4.3 CSV Export

- "Export Invoices" button: Downloads invoice summary for selected month (invoice_number, org, amount, status, generated_at)
- Per-invoice "Export Detail" in expanded row: Downloads line items for that specific invoice

### 4.4 Responsive Design

- Desktop: Full table with all columns
- Mobile (< md): Card-based layout with invoice number, org name, amount, status badge, expand arrow
- Bulk actions: Sticky bottom bar on mobile when items selected

## 5. Enhanced Vendor & Lender Views

### 5.1 Vendor Receivables Enhancement

**Existing component:** `frontend/src/app/vendor/dashboard/_components/receivables-section.tsx`

**Enhancements to month-wise table:**
- New column: Invoice Status — badge showing PENDING/BILLED/PAID or "Not Generated" (gray)
- New column: Invoice Number — displayed when invoice exists
- Clickable month rows → expand to show individual VendorEarning entries:

| Column | Description |
|--------|-------------|
| Report ID | Link to report detail |
| Lender | Lender name |
| Type | REQUEST / LISTING_DOWNLOAD |
| Amount | Entry amount |
| Date | Entry created_at |

- "Download CSV" button per month row

**New API endpoint:**
- `GET /api/vendor/billing/entries?month=YYYY-MM` — Returns individual earning rows for the authenticated vendor for the given month, plus invoice status/number if an invoice exists

### 5.2 Lender Payables Enhancement

**Existing component:** `frontend/src/app/lender/dashboard/_components/payables-section.tsx`

**Enhancements to month-wise table:**
- New column: Invoice Number
- New column: Invoice Status badge
- Clickable month rows → expand to show individual LenderPayable entries:

| Column | Description |
|--------|-------------|
| Report ID | Link to report detail |
| Request Type | NEW_REQUEST / LISTING_DOWNLOAD / UPDATE / NEARBY |
| Amount | Entry amount |
| Date | Entry created_at |

- "Download CSV" button per month row

**New API endpoint:**
- `GET /api/lender/billing/entries?month=YYYY-MM` — Returns individual payable rows for the authenticated lender for the given month, plus invoice status/number if an invoice exists

### 5.3 Badge Color Scheme

| Status | Color | Tailwind |
|--------|-------|----------|
| PENDING | Amber | `bg-amber-100 text-amber-800` |
| BILLED | Blue | `bg-blue-100 text-blue-800` |
| PAID | Green | `bg-green-100 text-green-800` |
| Not Generated | Gray | `bg-gray-100 text-gray-500` |

## 6. Model Changes

### 6.1 Invoice Model Updates

Add to existing `Invoice` model in `backend/app/models/billing.py`:

| Field | Type | Notes |
|-------|------|-------|
| invoice_number | Text, unique, nullable | Populated on generation |
| line_items_count | Integer, default 0 | Cached count for display |
| notes | Text, nullable | Optional admin notes |

Existing fields unchanged: id, invoice_type, organization_id, amount, status, month, generated_at, created_at, updated_at.

### 6.2 Enum Additions

Add to `ActivityAction` enum in `backend/app/models/enums.py`:
- `INVOICE_GENERATED`
- `INVOICE_STATUS_UPDATED`

### 6.3 Migration

Alembic migration: add `invoice_number`, `line_items_count`, `notes` columns to `invoices` table.

## 7. Backend Services & API

### 7.1 Billing Service Enhancements

`backend/app/services/billing_service.py` — new functions:

| Function | Description |
|----------|-------------|
| `generate_invoices_for_month(db, month)` | Core generation: aggregate entries, create invoices, assign numbers |
| `update_invoice_status(db, invoice_id, new_status)` | Single status update with transition validation |
| `bulk_update_invoice_status(db, invoice_ids, new_status)` | Batch update, skips invalid transitions |
| `get_invoice_with_entries(db, invoice_id)` | Invoice + underlying earning/payable rows |
| `get_invoices(db, month, type, status)` | Filtered invoice list |
| `generate_invoice_number(db, invoice_type, month)` | Next sequential number for type+month |
| `get_org_billing_entries(db, org_id, month, entry_type)` | Individual entries for vendor/lender drill-down |

### 7.2 Admin Billing API

New router: `backend/app/api/admin/billing.py`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/billing/invoices` | List invoices (query: month, type, status) |
| GET | `/api/admin/billing/invoices/{id}` | Invoice detail with line items |
| PATCH | `/api/admin/billing/invoices/{id}/status` | Update single invoice status |
| POST | `/api/admin/billing/invoices/bulk-status` | Bulk status update |
| POST | `/api/admin/billing/generate` | Trigger invoice generation for a month |
| GET | `/api/admin/billing/export` | CSV export (query: month, type, detail=bool) |

All endpoints require admin role.

### 7.3 Vendor Billing API

New router: `backend/app/api/vendor/billing.py`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/vendor/billing/entries` | Individual earning entries (query: month) |
| GET | `/api/vendor/billing/export` | CSV export for a month |

### 7.4 Lender Billing API

New router: `backend/app/api/lender/billing.py`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/lender/billing/entries` | Individual payable entries (query: month) |
| GET | `/api/lender/billing/export` | CSV export for a month |

### 7.5 Pydantic Schemas

`backend/app/schemas/billing.py` (new file):

- `InvoiceResponse` — id, invoice_number, invoice_type, organization_id, org_name, amount, status, month, line_items_count, generated_at, notes
- `InvoiceDetailResponse` — InvoiceResponse + list of entries
- `InvoiceStatusUpdate` — status (PaymentStatus)
- `BulkStatusUpdate` — invoice_ids (list[UUID]), status (PaymentStatus)
- `GenerateInvoicesRequest` — month (str, format YYYY-MM)
- `BillingEntryResponse` — id, report_id, request_id, amount, entry_type, created_at
- `BillingEntriesWithInvoice` — entries list + invoice_number + invoice_status (nullable)

## 8. Celery Job

### 8.1 Billing Tasks

New file: `backend/app/jobs/billing_tasks.py`

- `generate_monthly_invoices()` — Celery task, called by beat schedule or manual trigger
- Uses `get_async_session_context()` pattern (consistent with existing tasks)
- Wraps `billing_service.generate_invoices_for_month()`

### 8.2 Beat Schedule Addition

In `backend/app/jobs/celery_app.py`, add to beat_schedule:

```python
"generate-monthly-invoices": {
    "task": "app.jobs.billing_tasks.generate_monthly_invoices",
    "schedule": crontab(day_of_month=1, hour=2, minute=0),
}
```

## 9. Notifications & Activity Logging

### 9.1 Notifications

On invoice generation, for each organization:
- **Event type:** `INVOICE_GENERATED` (add to notification event types)
- **Title:** "Invoice Generated"
- **Body:** "Your invoice for {month} has been generated: {invoice_number}, Amount: ₹{amount}"
- Delivered via existing notification service + WebSocket

On status change to PAID:
- **Event type:** `PAYMENT_CONFIRMED`
- **Title:** "Payment Confirmed"
- **Body:** "Payment received for invoice {invoice_number}"

Both respect notification preferences (opt-out pattern).

### 9.2 Activity Logging

| Action | When | Metadata |
|--------|------|----------|
| INVOICE_GENERATED | Each invoice created | invoice_number, org_id, amount, month |
| INVOICE_STATUS_UPDATED | Each status change | invoice_number, old_status, new_status |

## 10. Files to Create/Modify

### New Files (Backend — 2)
- `backend/app/api/admin/billing.py` — Admin billing API (6 endpoints)
- `backend/app/jobs/billing_tasks.py` — Monthly invoice generation Celery task

### New Files (Frontend — 3)
- `frontend/src/app/admin/billing/page.tsx` — Admin billing page
- `frontend/src/app/admin/billing/_components/invoice-table.tsx` — Invoice table with expandable rows
- `frontend/src/types/billing.ts` — TypeScript types for invoice responses

### Modified Files (Backend — 8)
- `backend/app/models/billing.py` — Add invoice_number, line_items_count, notes to Invoice
- `backend/app/models/enums.py` — Add INVOICE_GENERATED, INVOICE_STATUS_UPDATED to ActivityAction
- `backend/app/schemas/billing.py` — Add invoice and billing entry schemas
- `backend/app/services/billing_service.py` — Add generation, status management, query functions
- `backend/app/api/vendor/billing.py` — Add vendor billing entries and export endpoints
- `backend/app/api/lender/billing.py` — New lender billing endpoints (2)
- `backend/app/main.py` — Register admin billing and lender billing routers
- `backend/app/jobs/celery_app.py` — Add billing task to beat schedule

### Modified Files (Frontend — 3)
- `frontend/src/app/vendor/dashboard/_components/receivables-section.tsx` — Add invoice status, expandable rows, CSV
- `frontend/src/app/lender/dashboard/_components/payables-section.tsx` — Add invoice status, expandable rows, CSV
- `frontend/src/app/admin/layout.tsx` — Add Billing nav item to admin sidebar

### Migration
- Alembic migration: add `invoice_number`, `line_items_count`, `notes` to invoices table
