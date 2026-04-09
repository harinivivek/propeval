# PropEval - Property Valuation & Legal Reports Marketplace

## Architecture Document

### Tech Stack (following SV-Platform patterns)

| Layer | Technology |
|-------|-----------|
| **Backend** | Python 3.12, FastAPI, SQLAlchemy 2.0 (async), Alembic, Celery + Redis |
| **Frontend** | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS 4, shadcn/ui |
| **Database** | PostgreSQL 16 |
| **Cache/Queue** | Redis 7, Celery with Celery Beat for scheduled jobs |
| **Auth** | JWT (python-jose), bcrypt, role-based access control (RBAC) |
| **OCR/Document** | PyMuPDF, python-docx, Tesseract OCR for report extraction |
| **Maps** | Leaflet / Mapbox for property map views |
| **Charts** | Recharts for dashboard analytics |
| **Rich Text** | TipTap for report template editing |
| **Notifications** | WebSocket (real-time popups), Firebase Cloud Messaging (mobile push) |
| **Mobile** | PWA (Next.js) with service workers for offline vendor support |
| **Infrastructure** | Docker Compose, Cloudflare Tunnel |
| **CI/CD** | GitHub Actions |

---

### Project Structure

```
propeval/
├── backend/
│   ├── app/
│   │   ├── api/                    # FastAPI routers
│   │   │   ├── auth.py             # Login, OTP, forgot password
│   │   │   ├── lender/
│   │   │   │   ├── dashboard.py    # Lender dashboard
│   │   │   │   ├── requests.py     # Raise/manage report requests
│   │   │   │   ├── listings.py     # Browse/filter/purchase listings
│   │   │   │   ├── reports.py      # View/download/review reports
│   │   │   │   ├── purchased.py    # Purchased reports history
│   │   │   │   └── settings.py     # Users, templates, preferences
│   │   │   ├── vendor/
│   │   │   │   ├── dashboard.py    # Vendor dashboard
│   │   │   │   ├── requests.py     # Incoming/pending requests
│   │   │   │   ├── reports.py      # Upload/manage/detail reports
│   │   │   │   ├── listings.py     # Manage listings (draft/publish/archive)
│   │   │   │   ├── upload.py       # Bulk upload + smart upload
│   │   │   │   └── settings.py     # Users, preferences, auto-approve config
│   │   │   ├── admin/              # Get-It-Right admin
│   │   │   │   ├── accounts.py     # Lender + vendor account management
│   │   │   │   ├── pricing.py      # Per-lender pricing configuration
│   │   │   │   ├── dashboard.py    # Admin dashboard + analytics
│   │   │   │   ├── reports.py      # Reports list for billing/export
│   │   │   │   ├── monitoring.py   # Open requests monitoring
│   │   │   │   └── settings.py     # System configurations
│   │   │   └── common/
│   │   │       ├── notifications.py
│   │   │       └── search.py
│   │   ├── core/
│   │   │   ├── config.py           # Pydantic Settings
│   │   │   ├── database.py         # Async SQLAlchemy engine + session
│   │   │   ├── deps.py             # Auth/DB dependency injection
│   │   │   ├── security.py         # JWT, bcrypt, OTP
│   │   │   └── permissions.py      # RBAC role/page permission checks
│   │   ├── models/
│   │   │   ├── enums.py            # All enums (UserType, ReportStatus, etc.)
│   │   │   ├── user.py             # User, Organization, Role, UserRole
│   │   │   ├── lender.py           # Lender, LenderBranch, LenderUser
│   │   │   ├── vendor.py           # Vendor, VendorUser, ServiceArea
│   │   │   ├── report.py           # Report, ReportContent, ReportRevision
│   │   │   ├── listing.py          # Listing, ListingReport
│   │   │   ├── request.py          # ReportRequest, RequestBroadcast, RequestAcceptance
│   │   │   ├── pricing.py          # PricingRule, PricingVariant
│   │   │   ├── billing.py          # Invoice, Payment, Receivable, Payable
│   │   │   ├── template.py         # ReportTemplate
│   │   │   ├── notification.py     # Notification
│   │   │   └── activity_log.py     # ActivityLog
│   │   ├── schemas/
│   │   │   ├── auth.py
│   │   │   ├── lender.py
│   │   │   ├── vendor.py
│   │   │   ├── report.py
│   │   │   ├── listing.py
│   │   │   ├── request.py
│   │   │   ├── pricing.py
│   │   │   ├── billing.py
│   │   │   └── notification.py
│   │   ├── services/
│   │   │   ├── auth_service.py     # Login, OTP, password reset
│   │   │   ├── request_service.py  # Workflow 1: new request orchestration
│   │   │   ├── broadcast_service.py # Vendor broadcast + acceptance logic
│   │   │   ├── report_service.py   # Report upload, OCR, extraction, revision
│   │   │   ├── listing_service.py  # Listing creation, grouping by macro-location
│   │   │   ├── purchase_service.py # Workflow 2.1: listing download/purchase
│   │   │   ├── update_service.py   # Workflow 2.2: updated report request
│   │   │   ├── nearby_service.py   # Workflow 2.3: nearby property request
│   │   │   ├── pricing_service.py  # Price calculation per lender/city/type/area
│   │   │   ├── billing_service.py  # Payables, receivables, earnings tracking
│   │   │   ├── ocr_service.py      # PDF/image OCR + structured data extraction
│   │   │   ├── template_service.py # Report template rendering
│   │   │   ├── notification_service.py # WebSocket + push notifications
│   │   │   └── export_service.py   # CSV export for admin dashboards
│   │   └── jobs/
│   │       ├── ocr_tasks.py        # Async OCR processing for bulk uploads
│   │       ├── broadcast_tasks.py  # Timed vendor broadcast rotation
│   │       ├── auto_accept.py      # Auto-accept reports after 7 days
│   │       ├── notification_tasks.py
│   │       └── image_resize.py     # Storage optimization for large files
│   ├── alembic/                    # Database migrations
│   ├── pyproject.toml
│   └── Dockerfile
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   │   └── login/          # Email/password + mobile/OTP login
│   │   │   ├── lender/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── requests/
│   │   │   │   ├── listings/
│   │   │   │   ├── reports/[id]/
│   │   │   │   ├── purchased/
│   │   │   │   └── settings/
│   │   │   ├── vendor/
│   │   │   │   ├── dashboard/
│   │   │   │   ├── requests/
│   │   │   │   ├── reports/
│   │   │   │   │   ├── [id]/       # Report detail page
│   │   │   │   │   └── upload/     # Smart upload + bulk upload
│   │   │   │   ├── listings/
│   │   │   │   │   ├── page.tsx    # Listing management
│   │   │   │   │   └── map/        # Map view (Airbnb-style)
│   │   │   │   └── settings/
│   │   │   └── admin/              # Get-It-Right
│   │   │       ├── dashboard/
│   │   │       ├── accounts/
│   │   │       │   ├── lenders/
│   │   │       │   └── vendors/
│   │   │       ├── pricing/
│   │   │       ├── reports/
│   │   │       ├── monitoring/
│   │   │       └── settings/
│   │   ├── components/
│   │   │   ├── ui/                 # shadcn/ui base components
│   │   │   ├── report/             # Report viewer, template editor
│   │   │   ├── listing/            # Listing card, map markers
│   │   │   ├── request/            # Request form, status timeline
│   │   │   ├── dashboard/          # Widgets, charts, tables
│   │   │   ├── popups/             # Incoming request, report submitted popups
│   │   │   └── shared/             # Layout, nav, notifications bell
│   │   ├── lib/
│   │   │   ├── api.ts              # Typed API client
│   │   │   ├── auth.ts             # Auth utilities
│   │   │   └── utils.ts
│   │   ├── hooks/
│   │   │   ├── use-notifications.ts # WebSocket notification hook
│   │   │   └── use-auth.ts
│   │   └── providers/
│   │       ├── theme-provider.tsx
│   │       └── notification-provider.tsx  # Real-time popup provider
│   ├── public/
│   ├── package.json
│   └── next.config.ts
├── docker-compose.local.yml
├── docker-compose.dev.yml
├── docker-compose.prod.yml
├── Makefile
└── CLAUDE.md
```

---

### Database Schema (Key Entities)

#### Users & Organizations
```
User (id, email, mobile, password_hash, user_type[LENDER|VENDOR|ADMIN], is_active)
Organization (id, name, type[LENDER|VENDOR|ADMIN], city, address)
Role (id, name, org_type, permissions_json)
UserRole (user_id, role_id, org_id, branch_ids[])
```

#### Lender Domain
```
Lender (id, org_id, name, city)
LenderBranch (id, lender_id, name, city)
LenderUser (id, user_id, lender_id, branch_ids[], role)
  - Roles: ORG_ADMIN, BRANCH_ADMIN, REQUESTER, ANALYST
```

#### Vendor Domain
```
Vendor (id, org_id, name, office_city, office_area, services[VALUATION|LEGAL])
VendorUser (id, user_id, vendor_id, role)
  - Roles: VENDOR_ADMIN, OFFICE_ADMIN
ServiceArea (id, vendor_id, city, areas[], service_type)
```

#### Reports & Listings
```
Report (id, vendor_id, report_type[VALUATION|LEGAL], status, property_address, 
        macro_location, city, property_type, plot_extent_sqft, 
        loan_applicant_name, report_content_json, uploaded_file_path,
        expiry_date, is_active, listing_approved, created_at)

ReportRevision (id, report_id, revision_number, changes_json, comments, created_at)

Listing (id, macro_location, city, property_type, report_count, 
         latest_report_date, is_active)

ListingReport (id, listing_id, report_id, display_order)
```

#### Requests & Workflows
```
ReportRequest (id, lender_id, lender_user_id, branch_id, 
               request_type[NEW|UPDATE|NEARBY], report_category[VALUATION|LEGAL],
               num_reports_needed, property_address, property_type, plot_extent_sqft,
               loan_applicant_name, eta, price, 
               vendor_specified, allow_broadcast_on_reject,
               parent_report_id,  -- for update/nearby requests
               comments,
               lender_status[DRAFT|SENT|AWAITED|RECEIVED|ACCEPTED|SENT_FOR_REVIEW|REJECTED],
               vendor_status[INCOMING|DENIED|PENDING|SENT|ACCEPTED|REVISION],
               created_at)

RequestBroadcast (id, request_id, vendor_ids[], broadcast_round, 
                  accept_deadline, status)

RequestAcceptance (id, request_id, vendor_id, accepted_at, report_id)
```

#### Pricing & Billing
```
PricingRule (id, lender_id, report_category[VALUATION|LEGAL], city, 
             property_type, max_plot_sqft, 
             new_request_price, listing_download_price,
             update_report_additional_price, nearby_report_additional_price)

Invoice (id, type[PAYABLE|RECEIVABLE], org_id, report_id, request_id,
         amount, status[PENDING|BILLED|PAID], month, created_at)

VendorEarning (id, vendor_id, report_id, lender_id, amount, 
               earning_type[REQUEST|LISTING_DOWNLOAD], month)

LenderPayable (id, lender_id, report_id, amount,
               payable_type[NEW_REQUEST|LISTING_DOWNLOAD|UPDATE|NEARBY],
               status[PENDING|BILLED|PAID], month)
```

#### Templates & Notifications
```
ReportTemplate (id, org_id, org_type, name, template_json, is_active, created_at)

Notification (id, user_id, type, title, body, entity_type, entity_id, 
              is_read, created_at)

ActivityLog (id, user_id, org_id, action, entity_type, entity_id, 
             metadata_json, created_at)
```

---

### Enums

```python
class UserType(str, Enum):
    LENDER = "LENDER"
    VENDOR = "VENDOR"
    ADMIN = "ADMIN"          # Get-It-Right

class LenderRole(str, Enum):
    ORG_ADMIN = "ORG_ADMIN"
    BRANCH_ADMIN = "BRANCH_ADMIN"
    REQUESTER = "REQUESTER"
    ANALYST = "ANALYST"

class VendorRole(str, Enum):
    VENDOR_ADMIN = "VENDOR_ADMIN"
    OFFICE_ADMIN = "OFFICE_ADMIN"

class AdminRole(str, Enum):
    GTR_ADMIN = "GTR_ADMIN"
    GTR_OPS = "GTR_OPS"      # No revenue numbers

class ServiceType(str, Enum):
    VALUATION = "VALUATION"
    LEGAL = "LEGAL"

class ReportCategory(str, Enum):
    VALUATION = "VALUATION"
    LEGAL = "LEGAL"

class PropertyType(str, Enum):
    RESIDENTIAL = "RESIDENTIAL"
    COMMERCIAL = "COMMERCIAL"
    INDUSTRIAL = "INDUSTRIAL"
    AGRICULTURAL = "AGRICULTURAL"

class RequestType(str, Enum):
    NEW = "NEW"                # Workflow 1
    UPDATE = "UPDATE"          # Workflow 2.2
    NEARBY = "NEARBY"          # Workflow 2.3

class LenderRequestStatus(str, Enum):
    DRAFT = "DRAFT"
    SENT = "SENT"
    AWAITED = "AWAITED"
    RECEIVED = "RECEIVED"
    ACCEPTED = "ACCEPTED"
    SENT_FOR_REVIEW = "SENT_FOR_REVIEW"
    REJECTED = "REJECTED"

class VendorRequestStatus(str, Enum):
    INCOMING = "INCOMING"
    DENIED = "DENIED"
    PENDING = "PENDING"
    SENT = "SENT"
    ACCEPTED = "ACCEPTED"
    REVISION = "REVISION"

class ReportStatus(str, Enum):
    UPLOADED = "UPLOADED"
    PROCESSING = "PROCESSING"          # OCR in progress
    READY_TO_PUBLISH = "READY_TO_PUBLISH"
    PUBLISHED = "PUBLISHED"
    ARCHIVED = "ARCHIVED"

class ListingStatus(str, Enum):
    DRAFT = "DRAFT"
    AVAILABLE = "AVAILABLE"
    ARCHIVED = "ARCHIVED"

class PaymentStatus(str, Enum):
    PENDING = "PENDING"
    BILLED = "BILLED"
    PAID = "PAID"

class RejectionReason(str, Enum):
    LOW_PRICE = "LOW_PRICE"
    NOT_AVAILABLE = "NOT_AVAILABLE"
    DO_NOT_WANT_TO_SHARE = "DO_NOT_WANT_TO_SHARE"
```

---

### Core Workflows

#### Workflow 1: New Report Request
```
Lender raises request
  → System calculates price from PricingRule
  → If vendor specified: send to vendor(s)
     → If vendor rejects + allow_broadcast: broadcast to area vendors
  → If vendor not specified: broadcast to area vendors
     → Broadcast in rounds (configurable: N vendors per round, T time per round)
  → Vendor accepts → uploads report within ETA
  → Lender reviews:
     → Accept → report goes to listing (auto or vendor-approved per config)
     → Send back for revision with comments → vendor revises → resubmit
  → If not reviewed in 7 days → auto-accept
  → Billing: add to vendor earnings + lender payables
```

#### Workflow 2.1: Listing Direct Download
```
Lender browses listings (macro-location only, no PII)
  → Filters by location, date, property type
  → Clicks listing → sees primary details (no valuation data)
  → Selects reports to purchase (valuation/legal, multi-select)
  → System shows price, takes confirmation
  → If vendor has auto-download ON → immediate access
  → If not → request sent to vendor for approval
  → Report rendered in lender's template (if configured)
  → Billing: add to vendor earnings + lender payables
```

#### Workflow 2.2: Updated Report Request
```
Lender viewing a purchased report
  → Requests update (latest date, updated value, etc.)
  → System shows additional price, takes confirmation
  → Request sent to vendor with comments
  → Vendor accepts → submits updated report within ETA
  → Listing updated with latest report
  → Billing: additional price to vendor earnings + lender payables
```

#### Workflow 2.3: Nearby Property Request
```
Lender viewing a listing
  → Requests report for nearby property
  → Provides property address + comments
  → System shows price (new_request_price - listing_download_price)
  → Request sent to vendor
  → Vendor accepts → submits report within ETA
  → New report added to listing
  → Billing: differential price to vendor earnings + lender payables
```

---

### Listing Grouping Logic

Reports are grouped into listings by **macro-location**:
- Vendor sees exact micro-location (e.g., "#8, 7th main road, Victoria Layout, Bengaluru")
- Lender sees only macro-location (e.g., "Victoria Layout, Bengaluru")
- Multiple properties in same macro-location = one listing with multiple reports
- No PII visible in listings (addresses redacted, no total sqft, pictures sanitized)

**Priority ordering within a listing:**
1. Latest report first
2. Tiered by age: 30 days → 90 days → 6 months → 1 year → 1 year+
3. Within same age tier: prioritize vendors with most reports on platform

---

### Broadcasting Logic (Configurable)

```
System Config:
  - vendors_per_broadcast_round: int (e.g., 5)
  - accept_window_minutes: int (e.g., 30)

Round 1: Send to first N vendors in the area
  → Wait T minutes for acceptance
  → If no acceptance → Round 2: next N vendors
  → Continue until accepted or all area vendors exhausted
```

---

### Authentication & Authorization

**Login Methods:**
- Email + password
- Mobile number + OTP
- Forgot password for both email and mobile

**Portal Routing:**
- Based on email/mobile → determine if lender or vendor
- If registered as both (Get-It-Right users) → prompt to choose portal

**RBAC Matrix:**

| Role | Scope |
|------|-------|
| **GTR Admin** | All pages, all data |
| **GTR Ops** | All pages, no revenue numbers |
| **Lender Org Admin** | Full lender access + settings |
| **Lender Branch Admin** | Same as org admin, scoped to mapped branches |
| **Lender Requester** | Dashboard (no payables), raise requests, review, listings |
| **Vendor Admin** | Full vendor access + settings + earnings |
| **Vendor Office Admin** | Dashboard (no earnings), accept requests (if permitted), upload, manage listings |

---

### Real-Time Notifications (WebSocket)

**Vendor Popups (any logged-in page):**
1. **Incoming Request** - fields: applicant name, address, lender, user, branch, property type, ETA, timer
2. **Report Sent Back for Revision** - fields: applicant name, address, lender, sent date, returned date, revision comments

**Lender Popups (any logged-in page):**
1. **Report Submitted** - fields: applicant name, address, property type, requested date, submitted date

---

### Celery Background Jobs

| Job | Schedule | Description |
|-----|----------|-------------|
| `ocr_process_report` | On upload | Extract structured data from PDF/images via OCR |
| `bulk_ocr_batch` | On bulk upload | Process 500-1000 reports in batches |
| `broadcast_rotation` | Every N minutes | Move to next broadcast round if no acceptance |
| `auto_accept_reports` | Daily | Accept reports not reviewed within 7 days |
| `image_resize` | On upload | Resize large report images to standard size |
| `generate_billing` | Monthly | Generate monthly invoices for lenders/vendors |
| `notification_push` | Real-time | Send push notifications to mobile (PWA) |

---

### Storage & Document Handling

- **Report PDFs**: Stored in filesystem/S3 with path in database
- **OCR Pipeline**: Upload → OCR extraction → structured JSON → manual review/edit → publish
- **Image Optimization**: Auto-resize large images to standard dimensions
- **Template Rendering**: Merge report JSON data with lender/vendor template to generate formatted PDF
- **PII Redaction**: Strip exact addresses, total sqft, identifying photos from listing views

---

### Mobile App (PWA)

Vendor-only PWA with:
- **Push notifications** (mandatory ON) for incoming requests
- **Offline support** via service workers for data capture without network
- **Key screens**: Pending requests, accept/upload, small dashboard, receivables table
- **Report form**: Rendered from vendor's template preference or standard format

---

### Infrastructure (Docker Compose)

```yaml
services:
  postgres:     # PostgreSQL 16, persistent volume
  redis:        # Redis 7 for cache + Celery broker
  backend:      # FastAPI (port 8000)
  celery:       # Celery worker(s)
  celery-beat:  # Celery Beat scheduler
  frontend:     # Next.js (port 3000)
```

**Environments:**
- `local` - hot-reload, localhost
- `dev` - dev server via Cloudflare Tunnel
- `prod` - production via Cloudflare Tunnel

---

### Instrumentation / Audit Logging

All significant actions logged to `ActivityLog`:
- **Lender**: request raised, acceptance, send back for review, listing purchase
- **Vendor**: request acceptance, report submission, revisions, listing changes
- **Admin**: account creation, pricing changes, configuration updates

Each log entry captures: user, org, action, entity, metadata JSON, timestamp.
