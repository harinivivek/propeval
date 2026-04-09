# PropEval - Development Phases & Milestones

## Phase 0: Project Scaffolding & Infrastructure (Week 1)

**Goal:** Runnable skeleton with CI/CD, Docker, and empty portals.

- [ ] Initialize monorepo structure (backend/ + frontend/)
- [ ] Backend: FastAPI project with pyproject.toml (Poetry), config, async DB setup
- [ ] Frontend: Next.js 15 + TypeScript + Tailwind 4 + shadcn/ui
- [ ] PostgreSQL 16 + Redis 7 in Docker Compose (local + dev)
- [ ] Alembic setup with initial migration
- [ ] Celery + Celery Beat configuration with Redis broker
- [ ] Makefile with dev commands (start, migrate, seed, test)
- [ ] GitHub Actions CI (lint, test, build)
- [ ] Cloudflare Tunnel config for dev environment
- [ ] CLAUDE.md with project conventions

**Deliverable:** `docker compose up` runs all services, frontend shows login page shell.

---

## Phase 1: Auth, Users & Account Management (Weeks 2-3)

**Goal:** All three user types can log in and land on their respective portals.

### 1A: Core Auth (Week 2)
- [ ] User model + Organization model + Role/UserRole models
- [ ] Lender, LenderBranch, LenderUser models
- [ ] Vendor, VendorUser, ServiceArea models
- [ ] All enums (UserType, LenderRole, VendorRole, AdminRole, etc.)
- [ ] JWT auth (access + refresh tokens)
- [ ] Email + password login
- [ ] Mobile + OTP login (OTP service integration)
- [ ] Forgot password flow (email + mobile)
- [ ] Login API + login page UI
- [ ] Portal routing: detect user type → redirect to correct portal
- [ ] Dual-role users (GTR) → portal selector prompt

### 1B: RBAC & Account Management (Week 3)
- [ ] Role-based permission system (require_role, require_page_access)
- [ ] Admin: Create/manage lender accounts (name, users, roles, POC, branches)
- [ ] Admin: Create/manage vendor accounts (name, users, services, areas, POC)
- [ ] Lender settings: Add users with branch/role assignment
- [ ] Vendor settings: Add users with role assignment
- [ ] No self-signup — onboarding by GTR admin only
- [ ] Seed script for GTR admin user

**Deliverable:** All user types can log in, see empty dashboards, manage users/settings.

---

## Phase 2: Pricing & Report Models (Week 4)

**Goal:** Pricing engine ready, report/listing/request data models in place.

- [ ] PricingRule model (per lender × city × property type × area × report category)
- [ ] PricingVariant: new request, listing download, update additional, nearby additional
- [ ] Admin UI: Configure pricing per lender
- [ ] Pricing service: Calculate price for any request combination
- [ ] Report model with full field set (type, status, property details, content JSON, file path)
- [ ] ReportRevision model
- [ ] Listing model + ListingReport junction
- [ ] Macro-location grouping logic (geo-based listing aggregation)
- [ ] ReportRequest model with all workflow types and statuses
- [ ] RequestBroadcast + RequestAcceptance models
- [ ] Billing models: VendorEarning, LenderPayable, Invoice
- [ ] All Alembic migrations for Phase 2 models

**Deliverable:** Full data layer for reports, listings, requests, pricing, and billing.

---

## Phase 3: Workflow 1 — New Report Request (Weeks 5-7)

**Goal:** End-to-end flow from lender request to vendor report submission and acceptance.

### 3A: Lender Request Flow (Week 5)
- [ ] Lender: "Raise Request" form (property details, report type, vendor selection)
- [ ] Price display + confirmation before submission
- [ ] Request service: create request, set status, assign vendor or trigger broadcast
- [ ] Lender requests page: pending/active/completed table with filters
- [ ] Lender request detail page with status timeline

### 3B: Vendor Broadcast & Acceptance (Week 6)
- [ ] Broadcast service: select vendors by area + service type
- [ ] Broadcast rotation Celery job (N vendors per round, T-minute window)
- [ ] WebSocket notification: incoming request popup for vendors
- [ ] Vendor: incoming request popup with primary fields + timer
- [ ] Vendor: accept/reject request flow
- [ ] Reject reason capture (low price, not available, don't want to share)
- [ ] Nudge message on low-price rejection
- [ ] If vendor specified + rejects + allow_broadcast → trigger open broadcast

### 3C: Report Submission & Review (Week 7)
- [ ] Vendor: upload report (PDF) against accepted request
- [ ] Report status timeline (Uploaded → Processing → Ready → Published → Archived)
- [ ] Lender: report received popup notification
- [ ] Lender: report detail page with full view + download
- [ ] Lender: accept report OR send back for revision with comments
- [ ] Vendor: revision notification popup + revise & resubmit flow
- [ ] Auto-accept Celery job: accept if not reviewed in 7 days
- [ ] Billing: on acceptance → create VendorEarning + LenderPayable entries
- [ ] Report → Listing: auto-list or vendor-approved (per vendor config)

**Deliverable:** Complete Workflow 1 functional end-to-end.

---

## Phase 4: OCR & Report Processing (Week 8)

**Goal:** Uploaded reports are OCR'd, structured data extracted, and editable.

- [ ] OCR service: extract text + fields from PDF reports
- [ ] Structured data mapping: property value, area, directions, adjacent details
- [ ] Celery task: async OCR processing on upload
- [ ] Vendor: report detail page with extracted data (editable)
- [ ] Vendor: download warning if extracted info was edited but file is old
- [ ] Vendor: bulk upload UI (for initial 500-1000 report onboarding)
- [ ] Celery batch job: process bulk uploads in batches
- [ ] Image/file resize on upload (storage optimization)
- [ ] Mandatory field validation before allowing report publish

**Deliverable:** Reports uploaded → auto-extracted → vendor reviews/edits → published.

---

## Phase 5: Listings Marketplace (Weeks 9-10)

**Goal:** Lenders can browse, filter, and purchase reports from listings.

### 5A: Listing Pages (Week 9)
- [ ] Listing service: auto-group reports by macro-location
- [ ] PII redaction in listing views (no exact address, no total sqft, sanitized photos)
- [ ] Lender: listings page with filter (location, date, property type)
- [ ] Listing card: macro-address, property type, report count, age indicator
- [ ] Click listing → primary details (no valuation figures)
- [ ] Priority ordering: latest first, tiered by age, then vendor reputation
- [ ] Vendor: listings page with exact micro-location
- [ ] Vendor: manage listing status (draft / available / archived)

### 5B: Listing Purchase — Workflow 2.1 (Week 10)
- [ ] Purchase service: show price + confirmation dialog
- [ ] Multi-select reports (valuation + legal separately or together)
- [ ] Auto-download if vendor permits → immediate access
- [ ] If not → send approval request to vendor
- [ ] Vendor: approve/deny download request
- [ ] Report rendered in lender's template (if configured) or standard
- [ ] Lender: purchased reports page (view/download anytime)
- [ ] Billing: create earning + payable entries on purchase

**Deliverable:** Full listings marketplace with browse, filter, purchase, and download.

---

## Phase 6: Workflows 2.2 & 2.3 — Update & Nearby Requests (Week 11)

**Goal:** Lenders can request updated or nearby-property reports from listings.

### 6A: Workflow 2.2 — Updated Report
- [ ] Lender: from report detail page → "Request Update" button
- [ ] Update request form: checklist of update items + comments
- [ ] Price display (additional update price) + confirmation
- [ ] Vendor notification + acceptance + submit updated report
- [ ] Listing auto-updated with latest report
- [ ] Billing entries for additional price

### 6B: Workflow 2.3 — Nearby Property Report
- [ ] Lender: from listing page → "Request Nearby Report" button
- [ ] Nearby request form: new property address + comments
- [ ] Price display (new_request_price − listing_download_price) + confirmation
- [ ] Vendor notification + acceptance + submit new report
- [ ] New report added to listing
- [ ] Billing entries for differential price

**Deliverable:** All three workflow types fully operational.

---

## Phase 7: Dashboards & Analytics (Weeks 12-13)

**Goal:** All portals have functional dashboards with key metrics.

### 7A: Vendor Dashboard (Week 12)
- [ ] Notification bell (top-right, all pages)
- [ ] Smart upload shortcut (top-right)
- [ ] Number widgets: requests received/accepted/served, reports listed, downloads, active listings
- [ ] Receivables: lender-wise total, month-wise breakdown
- [ ] Earnings: lender-wise bar chart, report-wise table (top 10, paginated), month-wise
- [ ] Reports table: searchable, filterable, sortable with report detail links
- [ ] Pending requests table (highlighted)

### 7B: Lender Dashboard + Admin Dashboard (Week 13)
- [ ] Lender dashboard: raise request shortcut, payables summary, reports raised/awaited/received/accepted
- [ ] Admin dashboard: vendor-wise receivables/earnings, lender-wise payables/paid/billed
- [ ] Admin: reports list with export to CSV (for billing)
- [ ] Admin: list of lenders table (requests served, downloads, revenue, vendor counts) with filters + export
- [ ] Admin: list of vendors table (requests served, downloads, revenue, lender counts) with filters + export
- [ ] Admin: open requests monitoring page (status, ETA timer, assigned vendors, reject on behalf)
- [ ] All filter by date, report category, column-level filtering

**Deliverable:** All three portals have data-rich dashboards.

---

## Phase 8: Templates & Report Formatting (Week 14)

**Goal:** Lenders and vendors can configure custom report templates.

- [ ] ReportTemplate model + service
- [ ] Lender settings: drag-and-drop template editor (TipTap-based)
- [ ] One active template per lender, archive old on new upload
- [ ] Upload template option
- [ ] Vendor settings: template preference (own format or standard)
- [ ] Template rendering: merge report JSON data → formatted PDF in requester's template
- [ ] Download generates report in the viewer's preferred format
- [ ] Standard template fallback when no custom template configured

**Deliverable:** Custom-branded report downloads for both lenders and vendors.

---

## Phase 9: Map Views (Week 15)

**Goal:** Interactive map views for both lenders and vendors.

- [ ] Integrate Leaflet/Mapbox with property location geocoding
- [ ] Vendor map view: own reports in green, competitors in red (count only)
- [ ] Vendor: identify gaps (areas with no reports) as earning opportunities
- [ ] Lender: listing map view with macro-location markers
- [ ] Map filters matching listing page filters
- [ ] Click marker → listing detail popup

**Deliverable:** Airbnb-style map views for listings and vendor coverage.

---

## Phase 10: Notifications & Real-Time (Week 16)

**Goal:** Full WebSocket notification system + audit logging.

- [ ] WebSocket server integration (FastAPI WebSocket or Socket.IO)
- [ ] Notification provider in frontend (global popup system)
- [ ] Vendor popups: incoming request, revision request (on any logged-in page)
- [ ] Lender popups: report submitted (on any logged-in page)
- [ ] Notification bell with unread count + notification list
- [ ] Notification preferences in settings
- [ ] ActivityLog: capture all significant lender/vendor/admin actions
- [ ] Admin: view activity logs with filters

**Deliverable:** Real-time notifications and comprehensive audit trail.

---

## Phase 11: Mobile PWA for Vendors (Weeks 17-18)

**Goal:** Vendor mobile experience with offline support.

- [ ] PWA manifest + service worker setup in Next.js
- [ ] Push notification registration (Firebase Cloud Messaging)
- [ ] Mandatory notification ON check
- [ ] Mobile-optimized vendor screens:
  - [ ] Incoming requests with accept/reject
  - [ ] Pending requests list
  - [ ] Report upload with form rendering (vendor template or standard)
  - [ ] Small dashboard (pending requests, receivables table)
- [ ] Service worker: cache data for offline report filling
- [ ] Sync queued data when network restored

**Deliverable:** Vendors can accept requests and upload reports from mobile, even offline.

---

## Phase 12: Billing, Invoicing & Polish (Weeks 19-20)

**Goal:** Billing flows complete, edge cases handled, production-ready.

- [ ] Monthly billing generation Celery job
- [ ] Admin: invoice generation + export for lenders and vendors
- [ ] Lender: payables view (month-wise, lender-wise)
- [ ] Vendor: receivables/earnings view with detailed breakdown
- [ ] Admin: filter reports by vendor/lender for billing reconciliation
- [ ] System config UI: broadcast params, acceptance rules, validation rules
- [ ] Vendor config: auto-listing toggle, lender exclusions, price threshold preferences
- [ ] Vendor config: separate settings for valuation vs legal (if provides both)
- [ ] Lender config: auto-approve toggle per vendor
- [ ] Edge case: vendor provides both valuation + legal → differentiated in all views
- [ ] Storage optimization: enforce image/PDF size limits
- [ ] Performance: pagination, lazy loading, query optimization
- [ ] Security audit: PII redaction verification, RBAC enforcement, input validation

**Deliverable:** Production-ready platform with complete billing and configuration.

---

## Summary Timeline

| Phase | Scope | Duration | Cumulative |
|-------|-------|----------|------------|
| **0** | Scaffolding & Infrastructure | 1 week | Week 1 |
| **1** | Auth, Users & Accounts | 2 weeks | Week 3 |
| **2** | Pricing & Data Models | 1 week | Week 4 |
| **3** | Workflow 1 — New Requests | 3 weeks | Week 7 |
| **4** | OCR & Report Processing | 1 week | Week 8 |
| **5** | Listings Marketplace | 2 weeks | Week 10 |
| **6** | Workflows 2.2 & 2.3 | 1 week | Week 11 |
| **7** | Dashboards & Analytics | 2 weeks | Week 13 |
| **8** | Templates & Formatting | 1 week | Week 14 |
| **9** | Map Views | 1 week | Week 15 |
| **10** | Notifications & Real-Time | 1 week | Week 16 |
| **11** | Mobile PWA | 2 weeks | Week 18 |
| **12** | Billing, Config & Polish | 2 weeks | Week 20 |

**Total estimated: ~20 weeks (5 months)**

---

## MVP Recommendation

For a **Minimum Viable Product**, prioritize Phases 0-6 (11 weeks):
- Auth + accounts
- Pricing engine
- All 3 core workflows
- OCR + report processing
- Listings marketplace

This gives you a fully functional marketplace. Dashboards, templates, maps, mobile, and billing polish can follow iteratively.
