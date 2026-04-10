# Phase 6: Update & Nearby Requests — Design Spec

**Date:** 2026-04-10
**Phase:** 6 of 12
**Goal:** Lenders can request updated reports for existing properties and new reports for nearby properties, using listings as the entry point.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Trigger locations | Update: listing detail + purchased reports. Nearby: listing detail | Maximum flexibility for lenders |
| Vendor context | Full original report context shown on update/nearby requests | Vendor needs to review original work before accepting |
| Nearby access | No need to own reference report; no implicit access granted | Listing is just a "find a vendor" mechanism |
| Update checklist | Predefined checklist items + free-text comments | Structured and easy to implement |
| Report processing | Full OCR pipeline for all submitted reports | Consistent with Phase 4 |
| Architecture | Extend existing request infrastructure, no new models | All enums, fields, and pricing columns already exist |

---

## 1. Backend — Request Service Changes

### 1.1 `create_request()` Extension

The existing `request_service.create_request()` currently hardcodes `request_type=RequestType.NEW`. Extend it to accept:

- `request_type: str = "NEW"` — accepts "NEW", "UPDATE", or "NEARBY"
- `parent_report_id: UUID | None = None` — links to the original report

Behavior changes by request type:

| Aspect | NEW | UPDATE | NEARBY |
|--------|-----|--------|--------|
| Pricing variant | `"NEW"` | `"UPDATE"` | `"NEARBY"` |
| `parent_report_id` | None | Original report ID | Reference report ID |
| Vendor assignment | Specified or broadcast | Original vendor (direct) | Original vendor (direct) |
| `allow_broadcast_on_reject` | Configurable | True | True |
| Property details | From lender input | Copied from parent report | From lender input (new address) |

### 1.2 `accept_report()` — Billing Type Mapping

Replace the hardcoded `PayableType.NEW_REQUEST` with a mapping from request type:

| `request.request_type` | `EarningType` | `PayableType` |
|------------------------|---------------|---------------|
| NEW | REQUEST | NEW_REQUEST |
| UPDATE | REQUEST | UPDATE |
| NEARBY | REQUEST | NEARBY |

`EarningType` stays as `REQUEST` for all three — the distinction is on the payable side for lender invoicing.

### 1.3 Listing Integration

No changes needed. The existing `_create_or_update_listing()` in `accept_report()` already:
- Finds or creates a listing by pin code + property type
- Adds the new report via `ListingReport`
- Updates listing metadata (report_count, latest_report_date)

For UPDATE requests, both the original and updated reports remain in the listing — the original isn't removed since other lenders may have purchased it.

For NEARBY requests, the new report joins the listing matching its pin code + property type (same listing if same pin code, new listing if different).

### 1.4 Update Checklist Constants

Predefined checklist items stored in `app/core/constants.py`:

```
UPDATE_CHECKLIST_ITEMS = {
    "RECHECK_VALUATION": "Recheck valuation amount",
    "VERIFY_BOUNDARIES": "Verify property boundaries",
    "UPDATE_PHOTOS": "Update property photos",
    "VERIFY_OCCUPANCY": "Verify current occupancy",
    "UPDATE_CONSTRUCTION": "Update construction status",
    "VERIFY_LEGAL_STATUS": "Verify legal/title status",
    "OTHER": "Other (see comments)",
}
```

The request's `comments` field stores structured JSON: `{"checklist": ["RECHECK_VALUATION", "VERIFY_BOUNDARIES"], "text": "Please also check the driveway access"}`.

---

## 2. API Endpoints

### 2.1 Lender — Create Update Request

`POST /api/lender/requests/update`

**Request body:**
```json
{
  "report_id": "uuid",
  "checklist": ["RECHECK_VALUATION", "VERIFY_BOUNDARIES"],
  "comments": "Please also check the driveway access"
}
```

**Logic:**
1. Validate report exists and is PUBLISHED
2. Look up report's vendor as `vendor_specified_id`
3. Copy property details from the parent report (address, city, pin_code, area, property_type)
4. Build structured comments: `{"checklist": [...], "text": "..."}`
5. Call `create_request()` with `request_type="UPDATE"`, `parent_report_id=report_id`, copied property details, `vendor_specified_id`, and `report_category` from the parent report
6. Return the created `ReportRequestResponse`

**Auth:** `require_role("LENDER")`

### 2.2 Lender — Create Nearby Request

`POST /api/lender/requests/nearby`

**Request body:**
```json
{
  "report_id": "uuid",
  "property_address": "123 New Street, Locality",
  "city": "Bengaluru",
  "pin_code": "560034",
  "area": "Koramangala",
  "report_category": "VALUATION",
  "comments": "Property is two blocks east of the reference address"
}
```

**Logic:**
1. Validate reference report exists (no ownership check required)
2. Look up report's vendor as `vendor_specified_id`
3. Call `create_request()` with `request_type="NEARBY"`, `parent_report_id=report_id`, lender-provided property details, `vendor_specified_id`, and lender-provided `report_category`
4. Return the created `ReportRequestResponse`

**Auth:** `require_role("LENDER")`

### 2.3 No Changes to Vendor Endpoints

UPDATE/NEARBY requests appear in the vendor's request list via the same existing query logic (they match on `vendor_specified_id` or `RequestAcceptance.vendor_id`). No new vendor endpoints needed.

---

## 3. Pydantic Schemas

### 3.1 New Input Schemas

```python
class UpdateRequestInput(BaseModel):
    report_id: UUID
    checklist: list[str]
    comments: str | None = None

class NearbyRequestInput(BaseModel):
    report_id: UUID
    property_address: str
    city: str
    pin_code: str
    area: str | None = None
    report_category: str
    comments: str | None = None
```

### 3.2 Response Schema

No new response schemas — both endpoints return the existing `ReportRequestResponse`.

---

## 4. Frontend — Lender Side

### 4.1 Update Request Dialog Component

A modal dialog triggered by "Request Update" buttons. Contains:
- Report context header: locality, property type, report date (read-only)
- Predefined checklist with checkboxes (7 items from constants)
- Free-text comments textarea
- Price note: "Price per your lender pricing agreement"
- "Submit Update Request" button
- On success: toast confirmation, redirect to `/lender/requests`

### 4.2 Nearby Request Dialog Component

A modal dialog triggered by "Request Nearby Report" button. Contains:
- Reference listing context: macro-location, city, pin code (read-only)
- Form fields: property address (required text input), city (pre-filled, editable), pin code (pre-filled, editable), area (optional text input), report category (dropdown: Valuation/Legal)
- Free-text comments textarea
- Price note: "Price per your lender pricing agreement"
- "Submit Nearby Request" button
- On success: toast confirmation, redirect to `/lender/requests`

### 4.3 Button Placement

**Listing detail page (`/lender/listings/[id]`):**
- Each report preview card gets a "Request Update" button (alongside Buy/Download)
- The listing header area gets a "Request Nearby Report" button

**Purchased reports page (`/lender/listings/purchases`):**
- Each purchased report row gets a "Request Update" button

### 4.4 Lender Request Detail Enhancement

When viewing an UPDATE or NEARBY request on `/lender/requests/[id]`:
- Show a badge: "Update Request" (orange) or "Nearby Request" (blue)
- Show a "Related Report" section with the parent report's basic info (address, type, date)
- For UPDATE: show the submitted checklist items as a readable list

---

## 5. Frontend — Vendor Side

### 5.1 Vendor Request Detail — Parent Report Context

When a vendor views an UPDATE or NEARBY request on `/vendor/requests/[id]`:

**Parent report context section** (appears at top of page when `parent_report_id` is set):
- Header: "Update request for previous report" or "Nearby property request"
- Original report details: property address, city, pin code, property type, report category, report date
- For UPDATE: the lender's checklist rendered as a readable list with the free-text comments
- For NEARBY: both the original address and the new requested address displayed side-by-side for clarity

### 5.2 Vendor Request List — Type Badges

On the vendor requests list page, add visual badges for request type:
- NEW: no badge (default)
- UPDATE: orange "Update" badge
- NEARBY: blue "Nearby" badge

### 5.3 No Changes to Upload/OCR Flow

The vendor's report upload, OCR processing, extraction review, and publish workflow remains unchanged. Once the vendor accepts an update/nearby request, they follow the exact same report submission flow as new requests.

---

## 6. Out of Scope (Deferred)

- **Vendor rejection analytics** — tracking why vendors reject update/nearby requests → Phase 7
- **Auto-pricing display** — showing exact price before submission → requires a price-check endpoint, deferred
- **Notification popups** — real-time vendor notifications for incoming update/nearby requests → Phase 10
- **Update history** — showing chain of updates for a property → not needed for MVP
