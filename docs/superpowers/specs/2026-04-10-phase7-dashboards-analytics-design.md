# Phase 7: Dashboards & Analytics — Design Spec

**Date:** 2026-04-10
**Phase:** 7 (Weeks 12-13)
**Scope:** Vendor dashboard, Lender dashboard, Admin dashboard, Notifications system, CSV export

## Decisions

- **Analytics data layer:** Direct aggregation queries on existing tables (no materialized views or caching)
- **Notification delivery:** Polling-based (30s interval), reusing existing `use-polling` hook pattern
- **CSV export:** Server-side streaming response
- **Admin open requests:** Read-only monitoring; reject-on-behalf deferred to a later phase
- **Financial year:** Indian fiscal year (Apr-Mar) as default time range for all breakdowns
- **Notification bell:** Included in Phase 7 scope, vendor-only events initially

---

## 1. Notifications System

### 1.1 Model: `Notification`

Inherits `BaseModel` (UUID PK + `created_at` / `updated_at`).

| Column | Type | Notes |
|--------|------|-------|
| `user_id` | UUID FK → User | Recipient |
| `event_type` | Enum | `NEW_BROADCAST`, `REQUEST_ACCEPTED`, `REVISION_REQUESTED`, `LISTING_DOWNLOADED` |
| `title` | String | Short text, e.g. "New request from ABCL Bank" |
| `message` | String | Detail text |
| `reference_id` | UUID | Related entity (request or report) |
| `reference_type` | Enum | `REQUEST`, `REPORT` |
| `is_read` | Boolean | Default `false` |

### 1.2 Notification Events

| Event | Trigger Location | Recipients |
|-------|-----------------|------------|
| `NEW_BROADCAST` | `broadcast_service` — when broadcast is created | All VendorUser users belonging to vendors in `vendor_ids` |
| `REQUEST_ACCEPTED` | `request_service` — when vendor's acceptance is chosen | All VendorUser users of the accepted vendor |
| `REVISION_REQUESTED` | `report_service` — when lender requests revision | All VendorUser users of the report's vendor |
| `LISTING_DOWNLOADED` | `listing_service` — when a lender purchases | All VendorUser users of the report's vendor; `reference_id` = report_id |

### 1.3 Service: `notification_service.py`

- `create_notification(db, user_id, event_type, title, message, reference_id, reference_type)` → Notification
- `get_notifications(db, user_id, page, page_size)` → paginated list, newest first
- `get_unread_count(db, user_id)` → int
- `mark_as_read(db, notification_id, user_id)` → None
- `mark_all_as_read(db, user_id)` → None

### 1.4 API: `api/notifications.py`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications` | Paginated notification list |
| GET | `/api/notifications/unread-count` | Unread count (polled every 30s) |
| PATCH | `/api/notifications/{id}/read` | Mark single as read |
| PATCH | `/api/notifications/read-all` | Mark all as read |

All endpoints require authentication. No role restriction — any logged-in user.

### 1.5 Frontend: `NotificationBell`

- Rendered in portal layout headers (all three portals)
- Shows red badge with unread count (hidden when 0)
- Click opens dropdown panel with recent notifications (last 20)
- Each notification shows: title, message, relative timestamp
- Clicking a notification navigates to related entity and marks as read
- "Mark all as read" link at bottom of dropdown
- Mobile: full-screen overlay; Desktop: positioned dropdown
- Polling: `use-polling` hook, 30s interval, fetches unread count

---

## 2. Vendor Dashboard

### 2.1 Layout

Top action bar → metric widgets row → two-column content (stacks on mobile).

### 2.2 Top Bar

- **Smart upload shortcut** — button linking to `/vendor/reports/bulk-upload`
- **Notification bell** — shared component (Section 1)

### 2.3 Metric Widgets

Single horizontal row, scrollable on mobile, 2-col grid on tablet, full row on desktop.

| Widget | Query |
|--------|-------|
| Requests Received | COUNT of ReportRequest where vendor has a RequestAcceptance |
| Requests Accepted | COUNT where vendor_status = ACCEPTED |
| Reports Served | COUNT where vendor_status = ACCEPTED and report status = PUBLISHED |
| Reports Listed | COUNT of vendor's reports with listing_approved = true |
| Downloads | COUNT of ReportPurchase for vendor's reports |
| Active Listings | COUNT of distinct Listings containing vendor's reports with status = AVAILABLE |

### 2.4 Receivables Section

- **Lender-wise totals table:** VendorEarning GROUP BY lender, SUM amount
- **Month-wise breakdown:** VendorEarning GROUP BY month, filtered to current financial year (Apr-Mar)

### 2.5 Earnings Analytics

- **Lender-wise bar chart:** Recharts `BarChart`, horizontal bars, VendorEarning grouped by lender
- **Report-wise table:** Top 10 reports by earning amount, paginated (10 per page)
- **Month-wise chart:** Recharts `BarChart`, vertical bars, months on x-axis, current financial year

### 2.6 Pending Requests Table (highlighted)

Vendor's requests where vendor_status IN (`INCOMING`, `PENDING`).

| Column | Source |
|--------|--------|
| Lender Name | ReportRequest → Lender → Organization |
| Property Address | ReportRequest.property_address |
| Category | ReportRequest.report_category |
| ETA | ReportRequest.eta_days |
| Price | ReportRequest.price |
| Time Remaining | Computed from RequestBroadcast.accept_deadline |

Yellow/orange highlight styling. Links to vendor request detail page.

### 2.7 Reports Management Table

All vendor's reports. Searchable by address/applicant name. Filterable by status, category, property_type. Sortable by date.

| Column | Source |
|--------|--------|
| Report Date | Report.report_date |
| Address | Report.property_address |
| Category | Report.report_category |
| Property Type | Report.property_type |
| Status | Report.status |
| Valuation Amount | Report.valuation_amount |

Links to report detail page. Card-based on mobile, full table on desktop.

---

## 3. Lender Dashboard

### 3.1 Layout

Top action bar → metric widgets row → payables section → recent requests.

### 3.2 Top Bar

- **"Raise Request" shortcut** — button linking to `/lender/requests/new`
- **Notification bell** — shared component (shows empty for lenders initially; ready for future notification events)

### 3.3 Metric Widgets

| Widget | Query |
|--------|-------|
| Requests Raised | COUNT of lender's ReportRequests |
| Awaiting Reports | COUNT where lender_status = AWAITED |
| Reports Received | COUNT where lender_status = RECEIVED |
| Reports Accepted | COUNT where lender_status = ACCEPTED |
| Listings Purchased | COUNT of ReportPurchase by lender |

### 3.4 Payables Summary

- **Totals:** Three summary cards — PENDING, BILLED, PAID (SUM of LenderPayable by status)
- **Month-wise breakdown table:** LenderPayable GROUP BY month, current financial year
- **Payable type breakdown:** Grouped by payable_type (NEW_REQUEST, LISTING_DOWNLOAD, UPDATE, NEARBY) — displayed as Recharts `PieChart` or stacked bar

### 3.5 Recent Requests Table

Last 10 requests, ordered by created_at DESC.

| Column | Source |
|--------|--------|
| Property Address | ReportRequest.property_address |
| Category | ReportRequest.report_category |
| Status | ReportRequest.lender_status (color-coded badge) |
| Vendor Assigned | RequestAcceptance → Vendor name (if any) |
| Created | ReportRequest.created_at |

Links to full requests list page (`/lender/requests`).

---

## 4. Admin Dashboard

### 4.1 Layout

Metric widgets row → tabbed content area (4 tabs). Bottom tab bar on mobile, horizontal tabs on desktop.

### 4.2 Metric Widgets

| Widget | Query |
|--------|-------|
| Total Vendors | COUNT of active Vendor records |
| Total Lenders | COUNT of active Lender records |
| Total Reports | COUNT of all Report records |
| Total Revenue | SUM of all LenderPayable amounts |
| Pending Payables | SUM of LenderPayable where status = PENDING |
| Open Requests | COUNT of ReportRequest where lender_status IN (SENT, AWAITED) |

### 4.3 Tab 1: Vendors Table (with CSV export)

| Column | Source |
|--------|--------|
| Vendor Name | Vendor.name |
| City | Vendor.office_city |
| Requests Served | COUNT of RequestAcceptance for vendor |
| Reports Uploaded | COUNT of Report by vendor |
| Active Listings | COUNT of distinct active listings with vendor's reports |
| Downloads | COUNT of ReportPurchase for vendor's reports |
| Total Earnings | SUM of VendorEarning for vendor |
| Lender Count | COUNT DISTINCT lenders served |

Filterable by: date range, city, report category. Sortable by any column. Paginated. CSV export button.

### 4.4 Tab 2: Lenders Table (with CSV export)

| Column | Source |
|--------|--------|
| Lender Name | Lender.name |
| City | Lender.city |
| Requests Raised | COUNT of ReportRequest by lender |
| Reports Received | COUNT where lender_status IN (RECEIVED, ACCEPTED) |
| Listings Purchased | COUNT of ReportPurchase by lender |
| Total Payable | SUM of LenderPayable |
| Total Paid | SUM of LenderPayable where status = PAID |
| Vendor Count | COUNT DISTINCT vendors used |

Filterable by: date range, city. Sortable by any column. Paginated. CSV export button.

### 4.5 Tab 3: Reports List (with CSV export)

| Column | Source |
|--------|--------|
| Report Date | Report.report_date |
| Vendor Name | Report → Vendor.name |
| Lender Name | Via RequestAcceptance → ReportRequest → Lender (if applicable) |
| Address | Report.property_address |
| Category | Report.report_category |
| Property Type | Report.property_type |
| Status | Report.status |
| Valuation Amount | Report.valuation_amount |

Filterable by: date range, category, property type, status, vendor, lender. Sortable. Paginated. CSV export button.

### 4.6 Tab 4: Open Requests Monitoring (read-only)

Active requests where lender_status IN (`SENT`, `AWAITED`).

| Column | Source |
|--------|--------|
| Lender Name | ReportRequest → Lender → Organization |
| Property Address | ReportRequest.property_address |
| Category | ReportRequest.report_category |
| Status | ReportRequest.lender_status |
| Assigned Vendor | RequestAcceptance → Vendor name (if any) |
| Created | ReportRequest.created_at |
| ETA Countdown | Computed from created_at + eta_days |
| Broadcast Round | Latest RequestBroadcast.broadcast_round |

Auto-refreshes via polling (60s interval). Read-only — no actions.

---

## 5. Backend API & Services

### 5.1 New Services

**`services/dashboard_service.py`** — all aggregation queries:

| Function | Returns |
|----------|---------|
| `get_vendor_dashboard_stats(db, vendor_id)` | Dict of 6 metric counts |
| `get_vendor_receivables(db, vendor_id, fy_start, fy_end)` | Lender-wise + month-wise lists |
| `get_vendor_earnings_analytics(db, vendor_id, fy_start, fy_end, page, page_size)` | Lender-wise, report-wise (paginated), month-wise |
| `get_vendor_pending_requests(db, vendor_id)` | List of pending/incoming requests |
| `get_vendor_reports_table(db, vendor_id, search, filters, sort_by, sort_order, page, page_size)` | Paginated filtered reports |
| `get_lender_dashboard_stats(db, lender_id)` | Dict of 5 metric counts |
| `get_lender_payables_summary(db, lender_id, fy_start, fy_end)` | Totals + month-wise + type breakdown |
| `get_lender_recent_requests(db, lender_id, limit=10)` | Recent requests list |
| `get_admin_dashboard_stats(db)` | Dict of 6 metric counts |
| `get_admin_vendors_table(db, filters, sort_by, sort_order, page, page_size)` | Paginated vendor rows with aggregated stats |
| `get_admin_lenders_table(db, filters, sort_by, sort_order, page, page_size)` | Paginated lender rows with aggregated stats |
| `get_admin_reports_table(db, filters, sort_by, sort_order, page, page_size)` | Paginated report rows |
| `get_admin_open_requests(db, filters, sort_by, sort_order, page, page_size)` | Active requests with monitoring data |

**`services/notification_service.py`** — as defined in Section 1.3.

**`services/csv_export_service.py`:**
- `generate_csv_response(rows, columns, filename)` → FastAPI `StreamingResponse` with `text/csv` content type
- `columns` is a list of `(header_name, field_key)` tuples
- Streams rows to avoid loading full dataset in memory

### 5.2 New API Routers

**`api/vendor/dashboard.py`** — prefix `/api/vendor/dashboard`, requires VENDOR role:

| Method | Path | Service Function |
|--------|------|-----------------|
| GET | `/stats` | `get_vendor_dashboard_stats` |
| GET | `/receivables` | `get_vendor_receivables` |
| GET | `/earnings` | `get_vendor_earnings_analytics` |
| GET | `/pending-requests` | `get_vendor_pending_requests` |
| GET | `/reports` | `get_vendor_reports_table` |

**`api/lender/dashboard.py`** — prefix `/api/lender/dashboard`, requires LENDER role:

| Method | Path | Service Function |
|--------|------|-----------------|
| GET | `/stats` | `get_lender_dashboard_stats` |
| GET | `/payables` | `get_lender_payables_summary` |
| GET | `/recent-requests` | `get_lender_recent_requests` |

**`api/admin/dashboard.py`** — prefix `/api/admin/dashboard`, requires ADMIN role:

| Method | Path | Service Function |
|--------|------|-----------------|
| GET | `/stats` | `get_admin_dashboard_stats` |
| GET | `/vendors` | `get_admin_vendors_table` |
| GET | `/vendors/export` | CSV export of vendors table |
| GET | `/lenders` | `get_admin_lenders_table` |
| GET | `/lenders/export` | CSV export of lenders table |
| GET | `/reports` | `get_admin_reports_table` |
| GET | `/reports/export` | CSV export of reports list |
| GET | `/open-requests` | `get_admin_open_requests` |

**`api/notifications.py`** — prefix `/api/notifications`, requires authentication:

As defined in Section 1.4.

### 5.3 Registration

All new routers registered in `main.py`. Notification model registered in `models/__init__.py`. One Alembic migration for the `notifications` table.

---

## 6. Frontend Structure

### 6.1 Shared Components

| Component | Location | Purpose |
|-----------|----------|---------|
| `NotificationBell` | `components/notification-bell.tsx` | Header bell with dropdown |
| `MetricCard` | `components/metric-card.tsx` | Stat widget (icon, label, value) |
| `DataTableWithExport` | `components/data-table-with-export.tsx` | Table with CSV download button |
| `DateRangeFilter` | `components/date-range-filter.tsx` | Financial year aware picker |

### 6.2 Page Components

**Vendor Dashboard** — `app/vendor/dashboard/page.tsx`:
- `_components/vendor-stats.tsx` — metric widgets
- `_components/receivables-section.tsx` — lender-wise + month-wise tables
- `_components/earnings-charts.tsx` — bar charts + report-wise table
- `_components/pending-requests-table.tsx` — highlighted pending requests
- `_components/reports-table.tsx` — searchable/filterable reports

**Lender Dashboard** — `app/lender/dashboard/page.tsx`:
- `_components/lender-stats.tsx` — metric widgets
- `_components/payables-section.tsx` — summary cards + month-wise + pie chart
- `_components/recent-requests-table.tsx` — last 10 requests

**Admin Dashboard** — `app/admin/dashboard/page.tsx`:
- `_components/admin-stats.tsx` — metric widgets
- `_components/vendors-tab.tsx` — vendors table with export
- `_components/lenders-tab.tsx` — lenders table with export
- `_components/reports-tab.tsx` — reports list with export
- `_components/open-requests-tab.tsx` — monitoring view

### 6.3 Responsive Behavior

- **Metric widgets:** Horizontal scroll on mobile, 2-col grid on tablet, single row on desktop
- **Charts:** Full width, `ResponsiveContainer`, simplified labels on mobile
- **Tables:** Card-based list on mobile (< md), full table on desktop
- **Admin tabs:** Bottom tab bar on mobile, horizontal tabs on desktop
- **Notification dropdown:** Full-screen overlay on mobile, positioned dropdown on desktop

### 6.4 Data Fetching

- Each section fetches independently (parallel API calls on page load)
- Loading skeletons per section
- Financial year selector at page level, passed as query param to all section API calls
- `use-polling` for notification unread count (30s) and admin open requests (60s)

### 6.5 New Types

`types/dashboard.ts` — response types for all dashboard API endpoints.
`types/notification.ts` — Notification response type + event type enum.

---

## 7. Implementation Order

1. Notification model + migration
2. Notification service + API
3. NotificationBell component + layout integration
4. Dashboard service (vendor functions)
5. Vendor dashboard API + frontend
6. Dashboard service (lender functions)
7. Lender dashboard API + frontend
8. Dashboard service (admin functions)
9. Admin dashboard API + frontend + CSV export
10. Wire notification creation into existing services (broadcast, request, report, listing)
11. Polish: responsive testing, loading states, empty states
