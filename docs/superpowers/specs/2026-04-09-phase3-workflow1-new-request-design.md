# Phase 3: Workflow 1 — New Report Request (Design Spec)

**Date:** 2026-04-09
**Phase:** 3 (Weeks 5-7)
**Goal:** End-to-end flow from lender request to vendor report submission, review, acceptance, billing, and listing creation.

---

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Real-time notifications | Polling (30s interval) | WebSocket deferred to Phase 10. Polling is simple, no new infrastructure |
| Vendor selection | Optional filtered dropdown | Empty = broadcast. Selected = direct assign with broadcast fallback on reject |
| Broadcast config | Hardcoded constants | Admin config UI planned for Phase 12. Constants easy to swap later |
| Report processing | Skip to UPLOADED status | OCR pipeline is Phase 4. No fake processing step |
| Listing creation | On report acceptance | Accumulates data for Phase 5 marketplace. Always auto-list for now |
| Service architecture | Service-per-domain | Matches existing pattern (pricing_service, auth_service, etc.) |

---

## 1. Backend Services

### 1.1 request_service.py (new)

Lender request lifecycle management.

**Functions:**
- `create_request(db, lender_id, lender_user_id, branch_id, data)` — Validates property details, calls `pricing_service.get_price()` to calculate price, creates `ReportRequest` with `lender_status=SENT`. If `vendor_specified_id` is set, calls `broadcast_service.assign_direct()`. Otherwise calls `broadcast_service.start_broadcast()`.
- `list_requests(db, lender_id, filters)` — Paginated request list with status/date/category filters. Returns requests scoped to lender.
- `get_request(db, request_id, user)` — Full request detail with status timeline, vendor info, broadcast info, report info. Access scoped by role.
- `accept_report(db, request_id, lender_user_id)` — Sets `lender_status=ACCEPTED`, `vendor_status=ACCEPTED`. Calls `billing_service.create_billing_entries()`. Creates Listing + ListingReport.
- `reject_report(db, request_id, lender_user_id, comments)` — Sets `lender_status=SENT_FOR_REVIEW`, `vendor_status=REVISION`. Creates `ReportRevision` with comments.

**Status enforcement:** Each transition validates the current status before changing. Invalid transitions raise `InvalidStatusTransition` error.

### 1.2 broadcast_service.py (new)

Vendor selection and broadcast round management.

**Functions:**
- `assign_direct(db, request, vendor_id)` — Sets `vendor_status=INCOMING` for the specified vendor. No broadcast created.
- `start_broadcast(db, request_id)` — Queries `ServiceArea` for matching vendors (city + area + service_type). Creates `RequestBroadcast` with first N vendors, sets `accept_deadline = now + BROADCAST_ACCEPT_WINDOW_MINUTES`.
- `advance_broadcast_round(db, request_id)` — Called by Celery when deadline expires. If more vendors available, creates next `RequestBroadcast` round. If exhausted, request stays in SENT status (lender sees "No vendor available").
- `accept_request(db, request_id, vendor_id)` — Creates `RequestAcceptance`, sets `vendor_status=PENDING`, `lender_status=AWAITED`, `broadcast_status=ACCEPTED`.
- `reject_request(db, request_id, vendor_id, reason)` — Records rejection reason. If specified vendor + `allow_broadcast_on_reject` → calls `start_broadcast()`. If broadcast vendor → marks vendor out of current round. If all vendors in round rejected → immediately advance to next round.
- `get_eligible_vendors(db, city, area, service_type, exclude_request_id?)` — Queries ServiceArea for matching vendors, excluding any already rejected for this request. Returns list for dropdown or broadcast selection.

**Vendor Selection Query:**
```sql
SELECT DISTINCT v.id, v.name
FROM vendor v
JOIN service_area sa ON sa.vendor_id = v.id
WHERE sa.city = :city
  AND sa.service_type = :report_category
  AND (sa.areas IS NULL OR :area = ANY(sa.areas))
  AND v.is_active = true
  AND v.id NOT IN (
    SELECT unnest(rb.vendor_ids) FROM request_broadcast rb
    WHERE rb.request_id = :request_id AND rb.status = 'EXPIRED'
  )
ORDER BY v.created_at
```

### 1.3 report_service.py (new)

Vendor report upload and revision management.

**Functions:**
- `upload_report(db, request_id, vendor_id, file, metadata)` — Validates file (PDF only, max 20MB). Saves to `/app/media/reports/{vendor_id}/{report_id}/`. Creates `Report` with `status=UPLOADED`, populates property fields from request. Updates `vendor_status=SENT`, `lender_status=RECEIVED`.
- `submit_revision(db, report_id, vendor_id, file, comments)` — Creates `ReportRevision` (auto-incremented revision_number). Saves new PDF alongside previous (not overwritten). Updates Report with latest file path. Resets `vendor_status=SENT`, `lender_status=RECEIVED`.
- `get_report(db, report_id, user)` — Full report detail scoped by role. Includes revision history.
- `download_report(db, report_id, user)` — Auth-checked file download. Validates user has access (owning lender, uploading vendor, or admin).

### 1.4 billing_service.py (new)

Billing entry creation on report acceptance.

**Functions:**
- `create_billing_entries(db, request, report, vendor_id)` — Creates:
  - `VendorEarning`: vendor_id, report_id, request_id, lender_id, amount=request.price, earning_type=REQUEST, month=YYYY-MM from acceptance date
  - `LenderPayable`: lender_id, report_id, request_id, amount=request.price, payable_type=NEW_REQUEST, status=PENDING, month=same

---

## 2. Celery Jobs

### 2.1 jobs/auto_accept.py

**Schedule:** Daily (already configured in celery_app beat schedule).

**Logic:** Find `ReportRequest` where `lender_status=RECEIVED` and `updated_at < now - 7 days`. For each, execute the same flow as manual accept: set statuses, create billing entries, create listing.

### 2.2 jobs/broadcast_rotation.py

**Schedule:** Every 5 minutes (already configured in celery_app beat schedule).

**Logic:** Find `RequestBroadcast` where `status=ACTIVE` and `accept_deadline < now`. For each, call `broadcast_service.advance_broadcast_round()`.

---

## 3. API Routes

### 3.1 api/lender/requests.py — prefix `/api/lender/requests`

All endpoints require `Depends(require_role("LENDER"))`.

| Method | Path | Description |
|--------|------|-------------|
| POST | `/` | Create new request. Body: property details, report_category, vendor_specified_id (optional), allow_broadcast_on_reject. Returns request with calculated price. |
| GET | `/` | List requests. Query params: status, report_category, property_type, page, per_page. |
| GET | `/{id}` | Request detail with timeline, vendor info, broadcast info, report. |
| GET | `/vendors` | Get eligible vendors. Query params: city, area, report_category. For the vendor dropdown. |
| POST | `/{id}/accept` | Accept uploaded report. Triggers billing + listing creation. |
| POST | `/{id}/reject` | Send back for revision. Body: comments (required). |

### 3.2 api/vendor/requests.py — prefix `/api/vendor/requests`

All endpoints require `Depends(require_role("VENDOR"))`.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/` | List requests. Query params: status (incoming/pending/completed), page, per_page. |
| GET | `/{id}` | Request detail with property info, deadline, action buttons context. |
| POST | `/{id}/accept` | Accept incoming request. |
| POST | `/{id}/reject` | Reject request. Body: reason (enum), optional message. |
| POST | `/{id}/upload` | Upload report PDF. Multipart: file + optional metadata (valuation_amount, report_date). |
| POST | `/{id}/revise` | Submit revised report. Multipart: file + comments. |

### 3.3 api/common/polling.py — prefix `/api/notifications`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/poll` | Returns unread counts by type. Auth required. Response: `{incoming_requests: N, updated_requests: N}`. Uses `updated_at` comparison with last-poll timestamp (passed as query param). |

### 3.4 api/reports/download.py — prefix `/api/reports`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/{id}/download` | Auth-checked PDF download. Validates user has access to the report. Returns FileResponse. |

---

## 4. Pydantic Schemas

### 4.1 schemas/request.py (extend existing)

```python
# Existing: ReportRequestCreate, ReportRequestResponse (from Phase 2)
# Add/modify:

class ReportRequestCreateInput:
    """Form input from lender"""
    report_category: ReportCategory
    property_address: str
    city: str
    area: str | None
    pin_code: str | None
    property_type: PropertyType
    plot_extent_sqft: float | None
    built_up_sqft: float | None
    loan_applicant_name: str
    vendor_specified_id: UUID | None  # optional vendor selection
    allow_broadcast_on_reject: bool = True
    comments: str | None

class ReportRequestDetail:
    """Full request detail for detail page"""
    # All ReportRequestResponse fields plus:
    vendor_name: str | None
    broadcast_info: BroadcastInfo | None
    report: ReportBrief | None
    revisions: list[RevisionSummary]
    status_timeline: list[StatusEvent]

class RequestListFilters:
    status: str | None  # pending/active/completed
    report_category: str | None
    property_type: str | None
    page: int = 1
    per_page: int = 20

class EligibleVendor:
    id: UUID
    name: str
    city: str
    areas: list[str] | None
```

### 4.2 schemas/report.py (extend existing)

```python
class ReportUploadMeta:
    """Optional metadata with upload"""
    valuation_amount: Decimal | None
    report_date: date | None

class RevisionSummary:
    revision_number: int
    comments: str | None
    created_at: datetime
```

### 4.3 schemas/broadcast.py (new)

```python
class BroadcastInfo:
    round: int
    vendor_count: int
    deadline: datetime
    status: str

class RejectionInput:
    reason: RejectionReason  # LOW_PRICE | NOT_AVAILABLE | DO_NOT_WANT_TO_SHARE
    message: str | None
```

### 4.4 schemas/polling.py (new)

```python
class PollResponse:
    incoming_requests: int
    updated_requests: int
    last_checked: datetime
```

---

## 5. Frontend Types

### 5.1 types/request.ts

```typescript
interface ReportRequest {
  id: string;
  lender_id: string;
  lender_user_id: string;
  branch_id: string | null;
  request_type: 'NEW' | 'UPDATE' | 'NEARBY';
  report_category: 'VALUATION' | 'LEGAL';
  property_address: string;
  city: string;
  area: string | null;
  pin_code: string | null;
  property_type: 'RESIDENTIAL' | 'COMMERCIAL' | 'INDUSTRIAL' | 'AGRICULTURAL';
  plot_extent_sqft: number | null;
  built_up_sqft: number | null;
  loan_applicant_name: string;
  price: string; // Decimal as string
  vendor_specified_id: string | null;
  allow_broadcast_on_reject: boolean;
  lender_status: LenderRequestStatus;
  vendor_status: VendorRequestStatus | null;
  comments: string | null;
  created_at: string;
  updated_at: string;
}

type LenderRequestStatus = 'DRAFT' | 'SENT' | 'AWAITED' | 'RECEIVED' | 'ACCEPTED' | 'SENT_FOR_REVIEW' | 'REJECTED';
type VendorRequestStatus = 'INCOMING' | 'DENIED' | 'PENDING' | 'SENT' | 'ACCEPTED' | 'REVISION';
type RejectionReason = 'LOW_PRICE' | 'NOT_AVAILABLE' | 'DO_NOT_WANT_TO_SHARE';

interface ReportRequestCreate {
  report_category: 'VALUATION' | 'LEGAL';
  property_address: string;
  city: string;
  area?: string;
  pin_code?: string;
  property_type: string;
  plot_extent_sqft?: number;
  built_up_sqft?: number;
  loan_applicant_name: string;
  vendor_specified_id?: string;
  allow_broadcast_on_reject?: boolean;
  comments?: string;
}

interface EligibleVendor {
  id: string;
  name: string;
  city: string;
  areas: string[] | null;
}

interface RequestFilters {
  status?: string;
  report_category?: string;
  property_type?: string;
  page?: number;
  per_page?: number;
}
```

### 5.2 types/report.ts

```typescript
interface Report {
  id: string;
  vendor_id: string;
  report_category: 'VALUATION' | 'LEGAL';
  status: 'UPLOADED' | 'PROCESSING' | 'READY_TO_PUBLISH' | 'PUBLISHED' | 'ARCHIVED';
  property_address: string;
  city: string;
  property_type: string;
  valuation_amount: string | null;
  report_date: string | null;
  uploaded_file_path: string;
  created_at: string;
}

interface ReportRevision {
  revision_number: number;
  comments: string | null;
  created_at: string;
}
```

### 5.3 types/broadcast.ts

```typescript
interface BroadcastInfo {
  round: number;
  vendor_count: number;
  deadline: string;
  status: 'ACTIVE' | 'EXPIRED' | 'ACCEPTED';
}
```

---

## 6. Frontend Pages

### 6.1 Lender Pages

**`/lender/requests/page.tsx`** — Request list
- Tab bar: All / Pending / Active / Completed
- Desktop: filterable table (date, property, city, category, status, vendor, price)
- Mobile: card list with status badge, property summary
- "Raise Request" CTA button (top-right)
- Polling badge: shows count of requests with new activity
- Components in `_components/`: `request-table.tsx`, `request-card.tsx`, `request-filters.tsx`

**`/lender/requests/new/page.tsx`** — Raise Request form
- Multi-step form:
  - Step 1: Property details (address, city, area, property_type, plot_extent_sqft, built_up_sqft, loan_applicant_name, pin_code)
  - Step 2: Report config (report_category selector, preferred vendor dropdown — filtered by city+area+category — optional, allow_broadcast_on_reject toggle shown when vendor selected)
  - Step 3: Price confirmation (calls pricing API, displays calculated price, confirm/cancel)
- On submit → POST to create request → redirect to detail page
- Responsive: single-column on mobile, two-column on desktop
- Components in `_components/`: `property-form.tsx`, `report-config-form.tsx`, `price-confirmation.tsx`, `vendor-selector.tsx`

**`/lender/requests/[id]/page.tsx`** — Request detail
- Status timeline: horizontal on desktop, vertical on mobile (SENT → AWAITED → RECEIVED → ACCEPTED)
- Property details card
- Vendor info card (once assigned)
- Broadcast info (round, deadline countdown — visible during broadcast)
- Report section (when uploaded): PDF preview link, download button, Accept / Send Back buttons
- Send Back dialog: textarea for revision comments (required)
- Revision history section: list with comments and dates
- Components in `_components/`: `status-timeline.tsx`, `property-details-card.tsx`, `report-section.tsx`, `revision-history.tsx`

### 6.2 Vendor Pages

**`/vendor/requests/page.tsx`** — Request list
- Tab bar: Incoming / Pending / Completed
- Incoming: requests awaiting accept/reject, countdown timer for broadcast deadline
- Pending: accepted requests awaiting upload
- Completed: submitted/accepted requests
- Desktop: table. Mobile: cards with prominent action buttons
- Polling: every 30s, badge on "Requests" nav item
- Components in `_components/`: `request-table.tsx`, `request-card.tsx`, `countdown-timer.tsx`

**`/vendor/requests/[id]/page.tsx`** — Request detail + actions
- **Incoming state:** Property details + Accept (green) / Reject (red) buttons. Reject shows reason picker (Low Price / Not Available / Don't Want to Share). Low-price nudge message displayed.
- **Pending state:** Property details + Upload section (PDF file picker, optional metadata: valuation_amount, report_date). Upload button.
- **Revision state:** Previous revision comments displayed prominently, re-upload section.
- **Completed state:** Report summary, billing amount.
- Components in `_components/`: `incoming-actions.tsx`, `upload-section.tsx`, `rejection-reason-picker.tsx`, `revision-notice.tsx`

### 6.3 Navigation Updates

- **Lender layout** (`app/lender/layout.tsx`): Add "Requests" nav item between Dashboard and Settings. Include polling badge.
- **Vendor layout** (`app/vendor/layout.tsx`): Add "Requests" nav item between Dashboard and Settings. Include polling badge.

---

## 7. File Upload & Storage

### 7.1 Upload Flow

```
Vendor selects PDF → POST /api/vendor/requests/{id}/upload (multipart/form-data)
→ Backend:
  1. Validate: PDF only (MIME + extension), max 20MB
  2. Generate path: /app/media/reports/{vendor_id}/{report_id}/{report_id}_{timestamp}.pdf
  3. Save file to disk
  4. Create Report record (status=UPLOADED, uploaded_file_path=relative path)
  5. Update request statuses (vendor_status=SENT, lender_status=RECEIVED)
  6. Return report summary
```

### 7.2 Revision Upload

Same as upload but:
- Creates `ReportRevision` record (revision_number auto-incremented)
- Saves new PDF alongside previous: `{report_id}_rev{N}_{timestamp}.pdf`
- Report record updated with latest file path (previous versions preserved)

### 7.3 Download

`GET /api/reports/{id}/download` — Auth required. Validates user access (owning lender, uploading vendor, or admin). Returns `FileResponse` with `Content-Disposition: attachment`.

### 7.4 Storage Config

Constants in `core/constants.py`:
- `MEDIA_ROOT = "/app/media"`
- `REPORTS_DIR = "reports"`
- `MAX_UPLOAD_SIZE_MB = 20`
- `ALLOWED_CONTENT_TYPES = ["application/pdf"]`

---

## 8. Data Flow & Status Transitions

### 8.1 End-to-End Flow

```
LENDER                          SYSTEM                          VENDOR
──────                          ──────                          ──────
Fill form → Submit
                                Calculate price (pricing_service)
                                Create ReportRequest
                                  lender_status = SENT

                                Vendor specified?
                                  YES → vendor_status = INCOMING (direct)
                                  NO  → start_broadcast (round 1)

                                                                Poll → sees incoming
                                                                Accept or Reject?

                                                    ACCEPT:
                                                      RequestAcceptance created
                                                      vendor_status = PENDING
                                                      lender_status = AWAITED

                                                      Upload report PDF
                                                      Report created (UPLOADED)
                                                      vendor_status = SENT
                                                      lender_status = RECEIVED

                                                    REJECT:
                                                      Reason captured
                                                      Specified + allow_broadcast → broadcast
                                                      Broadcast vendor → mark out, continue

Poll → sees RECEIVED
Accept or Send Back?

  ACCEPT:
    lender_status = ACCEPTED
    vendor_status = ACCEPTED
    → create VendorEarning + LenderPayable
    → create Listing + ListingReport

  SEND BACK:
    lender_status = SENT_FOR_REVIEW
    vendor_status = REVISION
    → ReportRevision with comments
                                                                Re-upload revised report
                                                                vendor_status = SENT
                                                                lender_status = RECEIVED
                                                                (cycle repeats)

                                AUTO-ACCEPT (7 days, Celery):
                                  lender_status=RECEIVED + >7 days
                                  → same as manual accept
```

### 8.2 Lender Status Transitions

| From | To | Trigger |
|------|----|---------|
| — | SENT | Request created |
| SENT | AWAITED | Vendor accepts request |
| AWAITED | RECEIVED | Vendor uploads report |
| RECEIVED | ACCEPTED | Lender accepts (or auto-accept at 7 days) |
| RECEIVED | SENT_FOR_REVIEW | Lender sends back with comments |
| SENT_FOR_REVIEW | RECEIVED | Vendor re-uploads revised report |

### 8.3 Vendor Status Transitions

| From | To | Trigger |
|------|----|---------|
| — | INCOMING | Request assigned or broadcast |
| INCOMING | PENDING | Vendor accepts |
| INCOMING | DENIED | Vendor rejects |
| PENDING | SENT | Vendor uploads report |
| SENT | ACCEPTED | Lender accepts |
| SENT | REVISION | Lender sends back for revision |
| REVISION | SENT | Vendor re-uploads |

### 8.4 Broadcast Status Transitions

| From | To | Trigger |
|------|----|---------|
| — | ACTIVE | Broadcast round created |
| ACTIVE | ACCEPTED | Any vendor in round accepts |
| ACTIVE | EXPIRED | Deadline passed (Celery advances to next round) |

### 8.5 Broadcast Round Logic

```
Round 1: First 5 eligible vendors → RequestBroadcast(round=1, deadline=now+30min)
  ├─ Any vendor accepts → broadcast_status=ACCEPTED, done
  ├─ All 5 reject before deadline → immediately advance to Round 2
  └─ Deadline expires (Celery check) → advance to Round 2

Round N: Next 5 vendors → RequestBroadcast(round=N, deadline=now+30min)
  └─ Same logic

Final: No more eligible vendors → request stays SENT
  → Lender sees "No vendor available" message in UI
```

### 8.6 Listing Creation on Acceptance

```
On report ACCEPTED:
  1. Look for existing Listing: city + macro_location + property_type match
  2. Found → create ListingReport(listing_id, report_id)
     → increment listing.report_count, update listing.latest_report_date
  3. Not found → create new Listing + ListingReport
  4. Set report.listing_approved = true
```

---

## 9. Polling Mechanism

### 9.1 Endpoint

`GET /api/notifications/poll?since={ISO timestamp}`

Returns counts of items updated since the provided timestamp:
```json
{
  "incoming_requests": 2,
  "updated_requests": 1,
  "last_checked": "2026-04-09T10:30:00Z"
}
```

- For vendors: `incoming_requests` = count of requests with `vendor_status=INCOMING` and `updated_at > since`
- For lenders: `updated_requests` = count of requests with `lender_status` changed since last poll
- Frontend stores `last_checked` and passes it as `since` on next poll

### 9.2 Frontend Integration

- `hooks/use-polling.ts` — custom hook, calls `/poll` every 30 seconds
- Updates badge count on "Requests" nav item
- On tab/window focus, polls immediately (catch up after being away)
- Stops polling when tab is hidden (visibility API)

---

## 10. Constants

All broadcast and upload constants in `core/constants.py`:

```python
# Broadcast
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
```

---

## 11. New Files Summary

### Backend
- `app/services/request_service.py` — Request lifecycle
- `app/services/broadcast_service.py` — Broadcast + vendor selection
- `app/services/report_service.py` — Report upload + revision
- `app/services/billing_service.py` — Billing entry creation
- `app/api/lender/requests.py` — Lender request endpoints (6)
- `app/api/vendor/requests.py` — Vendor request endpoints (6)
- `app/api/common/polling.py` — Polling endpoint
- `app/api/common/download.py` — Report download endpoint
- `app/jobs/auto_accept.py` — Auto-accept Celery task
- `app/jobs/broadcast_rotation.py` — Broadcast rotation Celery task
- `app/core/constants.py` — Shared constants
- `app/schemas/broadcast.py` — Broadcast schemas
- `app/schemas/polling.py` — Polling schemas

### Backend (modified)
- `app/schemas/request.py` — Add ReportRequestCreateInput, ReportRequestDetail, EligibleVendor
- `app/schemas/report.py` — Add ReportUploadMeta, RevisionSummary
- `app/main.py` — Register 4 new routers
- `app/jobs/celery_app.py` — Wire up actual task imports

### Frontend
- `src/types/request.ts` — Request types
- `src/types/report.ts` — Report types
- `src/types/broadcast.ts` — Broadcast types
- `src/hooks/use-polling.ts` — Polling hook
- `src/app/lender/requests/page.tsx` + `_components/`
- `src/app/lender/requests/new/page.tsx` + `_components/`
- `src/app/lender/requests/[id]/page.tsx` + `_components/`
- `src/app/vendor/requests/page.tsx` + `_components/`
- `src/app/vendor/requests/[id]/page.tsx` + `_components/`

### Frontend (modified)
- `src/app/lender/layout.tsx` — Add Requests nav
- `src/app/vendor/layout.tsx` — Add Requests nav

---

## 12. Out of Scope (Deferred)

| Item | Deferred To | Reason |
|------|-------------|--------|
| WebSocket notifications | Phase 10 | Polling sufficient for Phase 3 |
| OCR/report processing pipeline | Phase 4 | Reports go straight to UPLOADED |
| Vendor auto-list config | Phase 12 | Always auto-list for now |
| Database-backed broadcast config | Phase 12 | Hardcoded constants for now |
| Macro-location grouping service | Phase 5 | Listings created with report's macro_location field |
| Report template rendering | Phase 8 | Raw PDF download only |
| Notification preferences | Phase 10 | All users get polled updates |
