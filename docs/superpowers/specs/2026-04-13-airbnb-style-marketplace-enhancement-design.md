# PropEval — Airbnb-Style Marketplace Enhancement PRD

**Date:** 2026-04-13
**Status:** Draft
**Scope:** Phases 13–16 (incremental, layered on existing Phases 0–12C)
**Focus Areas:** Discovery & Search UX, Trust & Reputation, Marketplace Dynamics
**Deferred:** B2C opening, endorsements/text reviews, 4+ tier structure

---

## 1. Vision & Problem Statement

### The Problem (10 years in the making)

India has ~15,000 empaneled property valuers, only ~4,000 actively working — serving a secured lending market across the entire country. The bank-to-evaluator connection is broken in three fundamental ways:

1. **Closed networks** — Banks maintain narrow lists of trusted evaluators, often based on personal relationships and intermediary commissions rather than competence. A valuer in Koramangala might be excellent but invisible to any bank outside their existing 2-3 contacts.

2. **New talent shut out** — Young certified valuers can't break in because banks only trust established names. The certification exists, but there's no path from "certified" to "trusted by banks." The profession is aging out.

3. **Wasted inventory** — An evaluator who assessed a property for Bank A can't easily offer that same report to Bank B, even though Bank B might be evaluating a loan for a nearby property. Reports sit in filing cabinets instead of generating value.

### The Vision

PropEval becomes the **Airbnb of property valuation** — an open marketplace where:
- **Banks discover** evaluators and existing reports through rich search, not phone calls
- **Evaluators earn trust** through verified credentials and proven performance, not personal connections
- **Quality is transparent** through multi-signal scoring, not word-of-mouth
- **Pricing is competitive** within fair guardrails, not opaque and commission-laden
- **New talent rises** through a structured path from starter assignments to featured expert

### Market Opportunity

- 4,000 active valuers × average 5-10 reports/month = ~30,000-40,000 valuations/month
- Each valued at INR 2,000-15,000 depending on property type and city
- Platform fee model on lender side: INR 200-500 per transaction
- Listing resale unlocks 2-3x revenue per report (one report, multiple buyers)
- Metro-first (Bengaluru, Mumbai, Delhi, Chennai) expanding to Tier 2 cities

---

## 2. Current State (Phases 0–12C)

PropEval today is a fully functional B2B marketplace with three portals and end-to-end workflows.

### Core Workflows (Built)

- **New Request** — Lender raises request → broadcast to vendors in rounds → vendor accepts → uploads report with OCR extraction → lender reviews/accepts → billing generated
- **Listing Marketplace** — Vendors list completed reports (auto-grouped by pin code + property type, PII-redacted) → lenders browse/purchase → download original or template-formatted PDF
- **Update/Nearby** — Lender requests updated data on an existing report or evaluation of a nearby property

### Platform Capabilities (Built)

- JWT auth with RBAC (7 roles across 3 portals)
- Admin-controlled pricing (per lender × city × area × property type)
- Claude-powered OCR extraction with confidence indicators
- Real-time WebSocket notifications + Web Push (PWA)
- Dashboards with analytics for all three portals
- Monthly invoice generation with lifecycle management
- Report template builder (drag-and-drop, branded PDF output)
- Map views (Leaflet) for listings and vendor coverage
- System/vendor/lender configuration with Redis caching
- Rate limiting, pagination, N+1 fixes, orphaned file cleanup

### Gaps for the Airbnb Vision

- No vendor public profiles or portfolios
- No rating/review system
- No vendor tiers or trust progression
- No vendor-controlled pricing (all admin-set)
- No unified search (reports and vendors are separate experiences)
- No rich filtering by vendor quality metrics
- No platform fee model (billing is report-cost-based)
- No starter pool or quality gate for new vendors
- Search UX is table-based, not card/map split view

---

## 3. Target State

### For a Lender (Bank Employee)

You open PropEval and land on a unified marketplace. A split view shows a map of your target area on top and rich result cards below. You search "Koramangala, Bengaluru — Residential" and instantly see two types of results, clearly distinguished:

- **Report cards** (blue document icon) — existing reports available for purchase. Each shows: property type badge, pin code, price, vendor name with rating stars, tier badge (Verified/Top Valuer), report age, and a thumbnail.
- **Vendor cards** (green person icon) — available evaluators who cover that area. Each shows: vendor photo, name, tier badge, specialization tags ("Commercial Expert"), rating (4.7 stars from 83 jobs), average turnaround time, and their price range for this property type.

You can filter by: radius from address, property type, price range, report age, vendor rating (4+ stars), vendor tier, turnaround time, and specialization. Clicking a map pin highlights the corresponding card and vice versa.

You find a 2-month-old residential valuation report for INR 3,000 — listed by a Top Valuer with 4.8 stars. You purchase it. A flat platform fee (e.g., INR 300) is added. You download the template-branded PDF.

For the nearby plot, no report exists. You click a Verified vendor card, see their full portfolio — 47 completed jobs, specializations in residential Bengaluru South, 92% first-time acceptance rate, average 3-day turnaround. You raise a new request directly from their profile. The vendor's self-set price (INR 4,500, within the platform's INR 3,000-6,000 band for this category) is shown upfront.

### For a Vendor (Evaluator)

You have a rich public profile showing your credentials, specializations, service areas, and performance metrics. You set your own prices within platform guardrails. Your completed reports auto-list on the marketplace (if you've toggled auto-listing on). You see your trust tier — currently Verified, 12 more jobs at 4.5+ rating to reach Top Valuer. Your dashboard shows a quality score breakdown: rating, on-time delivery, revision rate, acceptance rate.

If you're new, you start in the starter pool — simpler properties, your first 10 reports reviewed by GTR. You can see exactly what you need to do to reach Verified tier.

### For GTR Admin

You manage the trust engine — setting price floor/ceiling bands, reviewing starter pool reports, configuring tier thresholds, monitoring quality scores across the vendor base. You see platform fee revenue as a new billing line. You can award or revoke badges, flag quality issues, and intervene in disputes.

---

## 4. Phase 13 — Vendor Profiles & Trust Foundation

**Dependency:** None (first phase)
**Goal:** Build the data layer and UI for vendor identity, ratings, and tiers that everything else depends on.

### 4.1 Vendor Public Profile

**New Data:**
- `VendorProfile` model extending the existing `Vendor`: display photo, bio/about text, founding year, certifications list (IBBI registration number, other credentials), specialization tags (free-form, e.g., "Commercial", "Legal Due Diligence", "Heritage Properties")
- Profile completeness percentage (shown to vendor, incentivizes filling out profile)

**Portfolio:**
- Auto-generated from completed reports (already tracked in the system)
- PII-redacted summaries: property type, city, area, report category, date — no addresses or buyer details
- Aggregated stats: total completed jobs, breakdown by property type and city, active service areas

**Performance Metrics (visible on profile):**
- Average lender rating (1-5 stars)
- First-time acceptance rate (% of reports accepted without revision)
- Average turnaround time (request accepted → report submitted)
- On-time delivery rate
- Total completed jobs

**Endpoints:**
- `GET /api/vendor/profile` — vendor views/edits own profile
- `PUT /api/vendor/profile` — vendor updates profile
- `POST /api/vendor/profile/photo` — upload profile photo
- `GET /api/vendors/{vendor_id}/profile` — public profile view (for lenders)
- `GET /api/vendors/{vendor_id}/portfolio` — paginated portfolio of past work

### 4.2 Rating & Review System

**How it works:**
- After a lender accepts a report (existing `ACCEPTED` status), they're prompted to rate the vendor (1-5 stars)
- Rating is optional but nudged via notification ("Rate your experience with ValuePro")
- No text reviews in this phase (deferred to endorsements in future)
- Rating window: 30 days after report acceptance. After that, the prompt stops.

**New Data:**
- `VendorRating` model: lender_user_id, vendor_id, report_request_id, rating (1-5), created_at
- One rating per request per lender user (upsert, not duplicate)

**Quality Score Calculation:**
Composite score (0-100) weighted from:
- Lender star rating average: 30%
- First-time acceptance rate: 25%
- On-time delivery rate: 20%
- Revision rate (inverse — lower is better): 15%
- OCR completeness (% of required fields filled): 10%

Recalculated on each new data point (rating, report completion, etc.). Stored as `quality_score` on `VendorProfile`.

**Endpoints:**
- `POST /api/lender/vendors/{vendor_id}/rate` — submit rating
- `GET /api/lender/vendors/{vendor_id}/ratings` — view ratings for a vendor

### 4.3 Vendor Tiers

**Three tiers:**

| Tier | Criteria | Unlocks |
|------|----------|---------|
| **New** | GTR-verified credentials, < 10 completed jobs | Starter pool only, GTR reviews reports, basic profile visibility |
| **Verified** | 10+ completed jobs, quality score ≥ 60 | Full marketplace visibility, all property types, self-set pricing |
| **Top Valuer** | 50+ completed jobs, quality score ≥ 80, avg response time < 24hrs | Featured placement, priority in broadcast rotation, "Top Valuer" badge, analytics dashboard |

**Tier progression:**
- Automated: system checks criteria on every report completion and rating
- Promotion triggers a notification to the vendor
- Demotion: if quality score drops below tier threshold for 30 consecutive days, vendor is demoted one tier (with warning notification at day 15)
- Admin override: GTR can manually promote/demote with a reason

**New Data:**
- `vendor_tier` field on `VendorProfile` (enum: NEW, VERIFIED, TOP_VALUER)
- `tier_changed_at` timestamp
- `tier_warning_sent_at` for demotion warnings

**Endpoints:**
- `GET /api/vendor/tier` — vendor views own tier status + progress to next
- `PUT /api/admin/vendors/{vendor_id}/tier` — admin manual override

---

## 5. Phase 14 — Unified Marketplace & Discovery

**Dependency:** Phase 13 (needs vendor profiles, tiers, ratings for display)
**Goal:** Transform the browsing experience from separate tables into the Airbnb-style split-view unified marketplace.

### 5.1 Split View Layout

**Desktop (1024px+):**
- Top 45%: interactive Leaflet map with two types of markers
  - Blue document pins — existing report listings (clustered at zoom-out)
  - Green person pins — vendors with service areas covering the viewed region
- Bottom 55%: horizontally scrollable card grid of results
- Click a pin → corresponding card highlights and scrolls into view
- Click a card → map pans and highlights the corresponding pin
- Map drag/zoom dynamically updates the card results below

**Tablet (768-1023px):**
- Same split but 40/60 ratio, cards in a 2-column grid

**Mobile (<768px):**
- Toggle between map view and card list (not split — not enough space)
- Floating toggle button at bottom: "Map" / "List"
- Map pins still interactive, tapping opens a card overlay

### 5.2 Unified Search

**Search bar at top:** Free-text with autocomplete for localities, pin codes, cities. Powered by existing geocoordinate data + a locality lookup table.

**Two result types in one feed, visually differentiated:**

**Report Listing Cards (blue document icon badge):**
- Property type badge (Residential / Commercial / Land / Plot)
- Pin code + locality name
- Price (vendor's listed price)
- Vendor name + tier badge (shield icon with tier color)
- Vendor rating (stars + count)
- Report age ("2 months ago")
- Thumbnail (first photo from report, if available)
- "Purchase" CTA button

**Available Vendor Cards (green person icon badge):**
- Vendor profile photo
- Vendor name + tier badge
- Specialization tags (2-3 max, pill-shaped)
- Rating (stars + job count, e.g., "4.7 — 83 jobs")
- Average turnaround ("~3 days")
- Price range for searched property type ("INR 3,000 - 4,500")
- Service area match indicator ("Covers this area")
- "Request Evaluation" CTA button

**Sort options:**
- Relevance (default — combines distance, rating, recency)
- Price: low to high / high to low
- Rating: highest first
- Recency: newest reports first
- Turnaround: fastest vendors first

### 5.3 Rich Filters

**Filter panel** (sidebar on desktop, bottom sheet on mobile):

**Location Filters:**
- City (dropdown, multi-select)
- Pin code (text input, comma-separated)
- Locality (autocomplete)
- Radius from searched point (1km / 2km / 5km / 10km slider)

**Property Filters:**
- Property type (checkbox: Residential, Commercial, Land, Plot)
- Report category (checkbox: Valuation, Legal)
- Report age (dropdown: < 1 month, < 3 months, < 6 months, < 1 year, Any)

**Vendor Quality Filters:**
- Minimum rating (star selector: 3+, 3.5+, 4+, 4.5+)
- Vendor tier (checkbox: New, Verified, Top Valuer)
- Turnaround time (dropdown: < 2 days, < 5 days, < 7 days, Any)
- Specialization (tag selector from known tags)

**Result Type Filter:**
- Show: All / Reports Only / Vendors Only (toggle pills)

**Active filter count badge** on the filter button. "Clear all" link when filters are active.

### 5.4 Data Requirements

**New Model:**
- `Locality` — id, name, pin_code, city, state, lat, lng (for autocomplete and geo-search)
- Seed with localities across the 4 metro cities

**Existing Model Extensions:**
- `Listing` — already has lat/lng; add `locality_id` FK for locality name display

**New Endpoints:**
- `GET /api/marketplace/search` — unified search with all filters, returns mixed report + vendor results, paginated
- `GET /api/marketplace/map-bounds` — returns results within map viewport bounds (lat/lng bounding box)
- `GET /api/localities/autocomplete?q=kora` — locality name/pin code autocomplete

**Search Logic:**
- Geo-query: filter by bounding box or radius from point using PostGIS `ST_DWithin` or simple lat/lng range query
- Results merge: query listings + query vendors with matching service areas → interleave by relevance score
- Relevance score: weighted combination of distance (40%), rating (30%), recency (20%), tier (10%)

### 5.5 Frontend Pages

**New/Redesigned Pages:**
- `/marketplace` — the unified split-view search page (accessible to all lender users, replaces current listings browse)
- `/vendors/{vendor_id}` — public vendor profile page (linked from vendor cards)
- Current `/lender/listings` remains but redirects to `/marketplace` with "Reports Only" filter pre-set

**Existing Pages Updated:**
- Lender sidebar: "Listings" → "Marketplace" with new icon

---

## 6. Phase 15 — Marketplace Pricing

**Dependency:** Phase 13 (tier restrictions on self-pricing), Phase 14 (price display in marketplace cards)
**Goal:** Shift from admin-controlled pricing to vendor self-pricing within platform guardrails, and introduce the lender-side platform fee.

### 6.1 Price Guardrails (Floor/Ceiling)

**New Model: `PriceBand`**
- city, property_type, report_category → min_price, max_price
- Set by GTR admin per city × property type × report category
- Example: Bengaluru + Residential + Valuation → INR 3,000 (floor) — INR 8,000 (ceiling)
- Fallback: if no band exists for a specific combination, system blocks vendor from self-pricing for that category until admin sets one

**Relationship to existing `PricingRule`:**
- Existing `PricingRule` (per lender × city × area × property type) continues to function for broadcast-based requests where the lender has pre-negotiated rates
- `PriceBand` governs vendor-initiated listing prices and marketplace-visible request pricing
- When a lender requests via marketplace (clicking a vendor card), the vendor's self-set price applies — not the lender's `PricingRule`
- When a lender raises a traditional broadcast request (existing workflow), `PricingRule` still applies

### 6.2 Vendor Self-Pricing

**How it works:**
- Vendor sets prices per service area × property type × report category
- Must fall within the `PriceBand` for that city/property/category
- If vendor sets no price, they're not discoverable for that category in marketplace search
- Vendors can update prices anytime — changes apply to future transactions, not in-progress ones

**New Model: `VendorPricing`**
- vendor_id, city, property_type, report_category → price
- Validated against `PriceBand` on create/update (rejected if outside range)
- Displayed on vendor cards in marketplace search

**Tier Restriction:**
- **New** tier vendors cannot self-set pricing — they receive starter pool assignments at admin-set rates
- **Verified** and **Top Valuer** can self-price within guardrails

**Endpoints:**
- `GET /api/vendor/pricing` — vendor views own price settings
- `PUT /api/vendor/pricing` — vendor sets/updates prices (bulk upsert by city/type/category)
- `GET /api/admin/price-bands` — admin views all price bands
- `POST /api/admin/price-bands` — admin creates/updates a price band
- `DELETE /api/admin/price-bands/{id}` — admin removes a price band

### 6.3 Platform Fee (Lender-Side)

**How it works:**
- Flat fee charged to the lender on every transaction (report purchase or new request fulfillment)
- Fee amount configurable by GTR admin via `SystemConfig` (e.g., `platform_fee_amount: 300`)
- Shown transparently to lender at checkout: "Report: INR 4,500 + Platform Fee: INR 300 = Total: INR 4,800"
- Fee can vary by transaction type (configurable):
  - `platform_fee_listing_purchase`: fee for buying an existing report
  - `platform_fee_new_request`: fee for requesting a new evaluation
  - `platform_fee_update_request`: fee for update/nearby requests

**Billing Integration:**
- New `BillingEntryType` enum value: `PLATFORM_FEE`
- Platform fee creates a separate `LenderPayable` entry linked to the same request/purchase
- Invoice generation (existing Celery job) includes platform fees as line items
- Vendor earnings remain unaffected — they receive their full self-set price

**Revenue Reporting:**
- New admin dashboard widget: Platform Fee Revenue (daily/weekly/monthly)
- CSV export includes platform fee column

### 6.4 Pricing Display

**In marketplace search cards:**
- Report cards show: vendor's listed price + "+" icon indicating platform fee (tooltip shows fee amount)
- Vendor cards show: price range for searched property type (e.g., "INR 3,000 - 4,500")

**At checkout/request:**
- Full price breakdown: Report/Service Price + Platform Fee = Total
- No hidden fees — everything visible before the lender commits

**In vendor dashboard:**
- Price management tab in settings: table of city × property type × category with current price, min/max band shown alongside
- Visual indicator if price is near floor (might lose competitiveness) or near ceiling

---

## 7. Phase 16 — Graduated Trust Engine

**Dependency:** Phase 13 (tiers and quality score exist), Phase 15 (starter pool uses admin-set rates)
**Goal:** Operationalize the trust system — starter pool assignment, GTR quality gate, automated tier progression.

### 7.1 Starter Pool

**What it is:**
A filtered subset of incoming requests automatically routed to New-tier vendors. Ensures new valuers get assignments without banks having to consciously choose an unproven evaluator.

**Assignment Rules:**
- Requests eligible for starter pool: residential properties, property value below a configurable threshold (e.g., INR 50 lakhs), non-urgent (turnaround > 5 days)
- Configurable via `SystemConfig`: `starter_pool_max_property_value`, `starter_pool_property_types`, `starter_pool_min_turnaround_days`
- When a broadcast request matches starter pool criteria, New-tier vendors in the area are included in the broadcast alongside higher-tier vendors
- New-tier vendors are NOT excluded from the broadcast — they compete, but the starter pool guarantees they at least see eligible requests

**How it integrates with existing broadcast:**
- Existing broadcast rotation already selects vendors by service area
- Enhancement: broadcast service additionally filters by tier. For starter-eligible requests, include New-tier vendors. For non-starter requests, only Verified+ vendors participate
- No change to the broadcast round/rotation mechanics — just the vendor eligibility filter

### 7.2 GTR Quality Gate

**What it is:**
GTR staff manually review reports from New-tier vendors before they're delivered to the lender. A human checkpoint that builds bank confidence in unknown valuers.

**How it works:**
1. New-tier vendor submits report (existing upload flow)
2. Instead of going directly to lender review, report enters a `GTR_REVIEW` status
3. GTR admin sees a "Quality Review Queue" — a new section in the admin portal
4. GTR reviewer checks report completeness, accuracy of extracted data, photo quality, and observations
5. Reviewer can: **Approve** (report proceeds to lender), **Return** (sent back to vendor with feedback — similar to existing revision flow), or **Flag** (escalate for policy review)
6. On approval, report moves to normal lender review flow
7. Vendor is notified at each step

**New Status in Report Lifecycle:**
- Existing: `DRAFT → SUBMITTED → UNDER_REVIEW → ACCEPTED / REVISION_REQUESTED`
- Enhanced: `DRAFT → SUBMITTED → GTR_REVIEW → UNDER_REVIEW → ACCEPTED / REVISION_REQUESTED`
- `GTR_REVIEW` only applies when the submitting vendor is New tier. Verified+ vendors skip this step.

**New Model: `QualityReview`**
- report_id, reviewer_user_id (GTR admin), status (PENDING/APPROVED/RETURNED/FLAGGED), feedback_text, reviewed_at

**Admin Quality Review Queue:**
- `/admin/quality-reviews` — list of reports awaiting GTR review
- Filterable by vendor, city, property type, date
- Inline review: view report content, OCR data, photos, vendor profile side-by-side
- Approve/Return/Flag actions with required feedback text on Return/Flag

**Endpoints:**
- `GET /api/admin/quality-reviews` — paginated queue
- `GET /api/admin/quality-reviews/{review_id}` — review detail with report content
- `PUT /api/admin/quality-reviews/{review_id}` — submit decision (approve/return/flag + feedback)

### 7.3 Automated Tier Progression

**Promotion Logic (runs on every report completion + rating event):**

```
On report accepted or new rating received:
  recalculate vendor quality_score

  if vendor.tier == NEW:
    if completed_jobs >= 10 AND quality_score >= 60:
      promote to VERIFIED
      notify vendor ("Congratulations! You've reached Verified status")
      notify GTR admin (for awareness)

  if vendor.tier == VERIFIED:
    if completed_jobs >= 50 AND quality_score >= 80 AND avg_response_time < 24hrs:
      promote to TOP_VALUER
      notify vendor ("You're now a Top Valuer!")
      notify GTR admin
```

**Demotion Logic (runs daily via Celery beat):**

```
Daily at midnight:
  for each VERIFIED vendor:
    if quality_score < 60 for 30 consecutive days:
      demote to NEW

  for each TOP_VALUER vendor:
    if quality_score < 80 for 30 consecutive days OR avg_response_time > 24hrs for 30 days:
      demote to VERIFIED

  Warning notification at day 15 if trending toward demotion
```

**Demotion safeguards:**
- Minimum 20 rated jobs before demotion can trigger (prevents small-sample penalization)
- Admin can freeze demotion for a vendor (e.g., during a dispute or personal leave)
- Demotion resets the 30-day clock — vendor must sustain poor metrics for another full 30 days before a second demotion

**Celery Tasks:**
- `check_tier_promotions` — triggered on report acceptance and rating submission (event-driven, not scheduled)
- `check_tier_demotions` — daily Celery beat task, runs at midnight
- `send_demotion_warnings` — daily, checks 15-day trending

### 7.4 Vendor Tier Progress Dashboard

**What the vendor sees on their dashboard:**

**Current Tier Card:**
- Tier badge (New / Verified / Top Valuer) with icon
- "Member since" date at current tier

**Progress to Next Tier:**
- Progress bars for each criterion:
  - Completed jobs: "7 / 10" with bar at 70%
  - Quality score: "58 / 60" with bar at 97%
  - Avg response time (for Top Valuer): "22hrs / 24hrs" with green check
- Estimated time to next tier based on current pace (e.g., "At your current rate, ~3 weeks")

**Quality Score Breakdown:**
- Overall score (e.g., 72/100) with trend arrow (up/down vs last month)
- Individual signal breakdown:
  - Lender rating avg: 4.2/5 (weight 30%)
  - First-time acceptance: 88% (weight 25%)
  - On-time delivery: 95% (weight 20%)
  - Revision rate: 12% (weight 15%)
  - OCR completeness: 97% (weight 10%)
- Tips: "Improve your first-time acceptance rate to boost your score fastest"

### 7.5 Configuration

**All thresholds configurable via SystemConfig (admin-editable):**
- `tier_verified_min_jobs`: 10
- `tier_verified_min_quality`: 60
- `tier_top_min_jobs`: 50
- `tier_top_min_quality`: 80
- `tier_top_max_response_hours`: 24
- `tier_demotion_period_days`: 30
- `tier_demotion_warning_days`: 15
- `tier_demotion_min_rated_jobs`: 20
- `starter_pool_max_property_value`: 5000000 (INR 50 lakhs)
- `starter_pool_property_types`: ["RESIDENTIAL"]
- `starter_pool_min_turnaround_days`: 5

---

## 8. Data Model Changes

### New Models

| Model | Phase | Key Fields |
|-------|-------|------------|
| `VendorProfile` | 13 | vendor_id (FK, unique), display_photo, bio, founding_year, certifications (JSONB), specialization_tags (JSONB array), quality_score (decimal 0-100), vendor_tier (enum: NEW/VERIFIED/TOP_VALUER), tier_changed_at, tier_warning_sent_at, profile_completeness (int 0-100) |
| `VendorRating` | 13 | lender_user_id (FK), vendor_id (FK), report_request_id (FK, unique), rating (int 1-5), created_at |
| `Locality` | 14 | name, pin_code, city, state, lat, lng — unique on (name, pin_code) |
| `PriceBand` | 15 | city, property_type, report_category, min_price (decimal), max_price (decimal) — unique on (city, property_type, report_category) |
| `VendorPricing` | 15 | vendor_id (FK), city, property_type, report_category, price (decimal) — unique on (vendor_id, city, property_type, report_category), validated against PriceBand |
| `QualityReview` | 16 | report_id (FK), reviewer_user_id (FK), status (enum: PENDING/APPROVED/RETURNED/FLAGGED), feedback_text, reviewed_at |

### Existing Model Extensions

| Model | Phase | Changes |
|-------|-------|---------|
| `Listing` | 14 | Add `locality_id` (FK to Locality, nullable) |
| `Report` | 16 | Add `GTR_REVIEW` to ReportStatus enum (between SUBMITTED and UNDER_REVIEW) |
| `LenderPayable` | 15 | Add `PLATFORM_FEE` to `BillingEntryType` enum |
| `SystemConfig` | 15, 16 | New config keys for platform fees, tier thresholds, starter pool params |

### New Enums

| Enum | Values |
|------|--------|
| `VendorTier` | NEW, VERIFIED, TOP_VALUER |
| `QualityReviewStatus` | PENDING, APPROVED, RETURNED, FLAGGED |

### Entity Relationships

```
Vendor ──1:1──► VendorProfile
VendorProfile ──1:N──► VendorPricing
Vendor ──1:N──► VendorRating ◄──N:1── LenderUser
VendorRating ──N:1──► ReportRequest
Report ──1:1──► QualityReview ◄──N:1── User (GTR admin)
Listing ──N:1──► Locality
PriceBand (standalone, referenced by validation logic)
```

---

## 9. API Surface Changes

### Phase 13 — Vendor Profiles & Trust (8 new endpoints)

| Method | Endpoint | Portal | Description |
|--------|----------|--------|-------------|
| GET | `/api/vendor/profile` | Vendor | View own profile |
| PUT | `/api/vendor/profile` | Vendor | Update profile |
| POST | `/api/vendor/profile/photo` | Vendor | Upload profile photo |
| GET | `/api/vendors/{id}/profile` | Lender | View vendor public profile |
| GET | `/api/vendors/{id}/portfolio` | Lender | Paginated past work (PII-redacted) |
| POST | `/api/lender/vendors/{id}/rate` | Lender | Submit rating after report acceptance |
| GET | `/api/lender/vendors/{id}/ratings` | Lender | View vendor ratings |
| GET | `/api/vendor/tier` | Vendor | View tier status + progress |

### Phase 14 — Unified Marketplace (3 new endpoints)

| Method | Endpoint | Portal | Description |
|--------|----------|--------|-------------|
| GET | `/api/marketplace/search` | Lender | Unified search — reports + vendors, all filters, paginated |
| GET | `/api/marketplace/map-bounds` | Lender | Results within map viewport bounding box |
| GET | `/api/localities/autocomplete` | All | Locality/pin code autocomplete |

### Phase 15 — Marketplace Pricing (5 new endpoints)

| Method | Endpoint | Portal | Description |
|--------|----------|--------|-------------|
| GET | `/api/vendor/pricing` | Vendor | View own price settings |
| PUT | `/api/vendor/pricing` | Vendor | Set/update prices (bulk upsert) |
| GET | `/api/admin/price-bands` | Admin | View all price bands |
| POST | `/api/admin/price-bands` | Admin | Create/update price band |
| DELETE | `/api/admin/price-bands/{id}` | Admin | Remove price band |

### Phase 16 — Graduated Trust (4 new endpoints)

| Method | Endpoint | Portal | Description |
|--------|----------|--------|-------------|
| GET | `/api/admin/quality-reviews` | Admin | Quality review queue (paginated) |
| GET | `/api/admin/quality-reviews/{id}` | Admin | Review detail with report content |
| PUT | `/api/admin/quality-reviews/{id}` | Admin | Submit decision (approve/return/flag) |
| PUT | `/api/admin/vendors/{id}/tier` | Admin | Manual tier override |

### Modified Existing Endpoints

| Endpoint | Phase | Change |
|----------|-------|--------|
| Broadcast service (internal) | 16 | Vendor eligibility filter by tier + starter pool logic |
| Report submission flow | 16 | GTR_REVIEW status insertion for New-tier vendors |
| Listing purchase | 15 | Platform fee added to billing |
| Request fulfillment billing | 15 | Platform fee added as separate LenderPayable entry |
| Admin dashboard | 15 | New platform fee revenue widget |

**Total: 20 new endpoints, ~5 modified endpoints**

---

## 10. Frontend Changes

### Phase 13 — New/Redesigned Pages

| Page | Portal | Description |
|------|--------|-------------|
| `/vendor/profile` | Vendor | Profile editor (photo, bio, certs, specializations, completeness meter) |
| `/vendor/dashboard` | Vendor | Enhanced — tier card, progress bars, quality score breakdown |
| `/vendors/{id}` | Lender | Public vendor profile page (portfolio, stats, rating, tier badge) |
| Rating prompt modal | Lender | Post-acceptance rating dialog (1-5 stars) |

### Phase 14 — New/Redesigned Pages

| Page | Portal | Description |
|------|--------|-------------|
| `/marketplace` | Lender | Unified split-view search (replaces `/lender/listings`) |
| Mobile map/list toggle | Lender | Responsive marketplace for mobile |
| Sidebar update | Lender | "Listings" → "Marketplace" |

### Phase 15 — New/Redesigned Pages

| Page | Portal | Description |
|------|--------|-------------|
| `/vendor/settings` pricing tab | Vendor | Price management table with band indicators |
| `/admin/price-bands` | Admin | Price band management page |
| Checkout enhancement | Lender | Price breakdown showing platform fee |
| `/admin/dashboard` revenue tab | Admin | Platform fee revenue widget |

### Phase 16 — New/Redesigned Pages

| Page | Portal | Description |
|------|--------|-------------|
| `/admin/quality-reviews` | Admin | Quality review queue with inline review |
| `/vendor/dashboard` tier section | Vendor | Tier progress dashboard with score breakdown |
| `/admin/vendors/{id}` | Admin | Enhanced — tier override, demotion freeze toggle |

### Component Library Additions

- `TierBadge` — shield icon with tier color (grey=New, blue=Verified, gold=Top Valuer)
- `RatingStars` — 1-5 star display + interactive input variant
- `QualityScoreGauge` — circular gauge for quality score (0-100)
- `PriceBreakdown` — line-item price display with platform fee
- `ResultTypeIcon` — blue document / green person badge for marketplace cards
- `ProgressBar` — tier progression indicator
- `FilterPanel` — responsive filter sidebar/bottom-sheet

---

## 11. Phase Dependencies & Sequencing

```
Phase 13 (Profiles & Trust)
    │
    ├──► Phase 14 (Marketplace & Discovery)
    │        │
    │        └──► Phase 15 (Pricing)
    │
    └──► Phase 16 (Graduated Trust Engine)
         (also depends on Phase 15 for starter pool pricing)
```

**Recommended build order:** 13 → 14 → 15 → 16

Phase 16 could technically start after Phase 13 (tiers exist), but the starter pool pricing depends on Phase 15's price band infrastructure, and the marketplace search from Phase 14 is needed for the full vendor discovery experience. Building in order ensures each phase can be deployed and validated independently.
