# Phase 10: Notifications & Real-Time — Design Spec

**Date:** 2026-04-11
**Status:** Approved
**Scope:** WebSocket real-time notifications, notification preferences, activity/audit logging

---

## 1. Overview

Phase 7 established a polling-based notification system (model, service, 4 REST endpoints, bell component, 30s polling). Phase 10 upgrades this with:

1. **WebSocket real-time delivery** — instant notification push via native FastAPI WebSocket, Redis pub/sub for multi-worker support
2. **Notification preferences** — per-event-type opt-out toggles in user settings
3. **Activity/audit logging** — core business action trail with admin dashboard view and CSV export

## 2. WebSocket Real-Time Notifications

### 2.1 Backend — WebSocket Endpoint

**Endpoint:** `GET /ws/notifications`

**Authentication flow:**
1. Client opens WebSocket connection
2. Client sends first message: `{"type": "auth", "token": "<jwt_access_token>"}`
3. Server validates JWT, associates connection with user ID
4. Server responds: `{"type": "auth_ok"}` on success, or closes with code 4001 on failure

**Connection manager** (`app/core/ws_manager.py`):
- In-memory dict: `user_id → set[WebSocket]` (supports multiple tabs/devices)
- Methods:
  - `connect(user_id, websocket)` — add to set
  - `disconnect(user_id, websocket)` — remove from set
  - `send_to_user(user_id, payload)` — send to all connections for that user
  - `publish(user_id, payload)` — publish to Redis pub/sub channel

**Redis pub/sub bridge:**
- Channel pattern: `notifications:{user_id}`
- On `create_notification()`: publish serialized notification to Redis
- Each uvicorn worker runs a background subscriber task that listens for messages and forwards to local WebSocket connections
- Ensures delivery regardless of which worker holds the WebSocket connection

### 2.2 Backend — Integration with Notification Service

After `create_notification()` writes to DB:
1. Check user's notification preference for the event type (skip if disabled)
2. Serialize the notification
3. Publish to Redis pub/sub channel `notifications:{user_id}`

Existing REST endpoints remain unchanged as fallback.

### 2.3 Frontend — WebSocket Provider

**`WebSocketProvider`** React context wrapping each portal layout (`app/lender/layout.tsx`, `app/vendor/layout.tsx`, `app/admin/layout.tsx`).

**Lifecycle:**
- Opens connection on mount (after auth token available)
- Sends auth message with JWT
- Listens for incoming messages
- Closes on logout or unmount

**Reconnection strategy:**
- Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (capped)
- Resets on successful connection
- On code 4001 (auth failure): refresh token, then reconnect

**Heartbeat:**
- Client sends `{"type": "ping"}` every 30s
- Server responds `{"type": "pong"}`
- If no pong within 10s, client triggers reconnect

**Integration with NotificationBell:**
- On incoming `{"type": "notification", "data": {...}}`: increment unread count, prepend to notification list if dropdown is open
- Existing polling interval increased from 30s to 60s as sync fallback

### 2.4 Message Format

```json
{
  "type": "notification",
  "data": {
    "id": "uuid",
    "event_type": "NEW_BROADCAST",
    "title": "New Request Available",
    "message": "Valuation report request for Koramangala, Bengaluru",
    "reference_id": "uuid",
    "reference_type": "REQUEST",
    "created_at": "2026-04-11T10:30:00Z"
  }
}
```

Other message types: `auth`, `auth_ok`, `ping`, `pong`.

## 3. Notification Preferences

### 3.1 Backend — Model

`NotificationPreference` in `app/models/notification.py`:

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK (BaseModel) |
| user_id | UUID | FK → users |
| event_type | String(50) | e.g., "NEW_BROADCAST" |
| enabled | Boolean | Default True |
| created_at | DateTime | BaseModel |
| updated_at | DateTime | BaseModel |

Composite unique constraint: `(user_id, event_type)`.

**Opt-out model:** Absence of a row means "enabled". Only explicit disables are stored.

### 3.2 Backend — Service

`notification_preference_service.py`:
- `get_preferences(db, user_id)` — Returns all event types with current state. Merges DB rows with defaults (all enabled) for missing event types.
- `update_preference(db, user_id, event_type, enabled)` — Upserts a preference row.

Integration with `create_notification()`:
- Before writing to DB, check preference. If disabled for that user + event_type, skip DB write and WebSocket push entirely.

### 3.3 Backend — API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/notifications/preferences` | All event types with enabled state |
| PATCH | `/api/notifications/preferences` | Upsert: `{"event_type": "...", "enabled": false}` |

### 3.4 Frontend — Settings UI

New "Notifications" tab in vendor and lender settings pages (added alongside existing tabs — Lender has "Users | Report Template | Notifications", Vendor settings gets a tab layout with "General | Notifications"):
- List of event types with human-readable labels and toggle switches
- Each toggle calls PATCH immediately (no save button)
- Event type labels:
  - `NEW_BROADCAST` → "New broadcast requests"
  - `REQUEST_ACCEPTED` → "Request accepted"
  - `REVISION_REQUESTED` → "Revision requests"
  - `LISTING_DOWNLOADED` → "Listing downloads"
- Admin users do not get notification preferences (receive everything)

### 3.5 Event Types

Current (from Phase 7):

| Event Type | Recipient | Trigger |
|------------|-----------|---------|
| NEW_BROADCAST | Vendor | Broadcast round starts |
| REQUEST_ACCEPTED | Lender | Vendor accepts request |
| REVISION_REQUESTED | Vendor | Lender requests revision |
| LISTING_DOWNLOADED | Vendor | Lender purchases report |

No new event types added in Phase 10.

## 4. Activity / Audit Logging

### 4.1 Backend — Model

`ActivityLog` in `app/models/activity_log.py`:

| Field | Type | Notes |
|-------|------|-------|
| id | UUID | PK (BaseModel) |
| actor_id | UUID | FK → users, nullable (system actions) |
| actor_type | String(20) | LENDER / VENDOR / ADMIN / SYSTEM |
| action | String(50) | Action enum value |
| target_type | String(50) | REQUEST / REPORT / LISTING / USER / PRICING_RULE / TEMPLATE |
| target_id | UUID | ID of affected entity |
| metadata_json | JSONB | Extra context (old/new values, reason, etc.), nullable |
| ip_address | String(45) | Request client IP, nullable |
| created_at | DateTime | BaseModel |
| updated_at | DateTime | BaseModel |

Indexed on: `(action)`, `(actor_id)`, `(target_type, target_id)`, `(created_at)`.

### 4.2 Action Types (~18)

**Request lifecycle:**
- `REQUEST_CREATED` — Lender creates new/update/nearby request
- `REQUEST_ACCEPTED` — Vendor accepts broadcast
- `REQUEST_REJECTED` — Vendor rejects broadcast
- `REQUEST_CANCELLED` — Lender cancels request

**Report lifecycle:**
- `REPORT_UPLOADED` — Vendor uploads report
- `REPORT_PUBLISHED` — Vendor publishes report
- `REPORT_REVISION_REQUESTED` — Lender sends back for revision
- `REPORT_REVISED` — Vendor resubmits revised report

**Listing lifecycle:**
- `LISTING_CREATED` — Auto-created or vendor-listed
- `LISTING_DELISTED` — Vendor delists
- `LISTING_PURCHASED` — Lender purchases

**User management:**
- `USER_CREATED` — Admin/lender/vendor adds user
- `USER_DEACTIVATED` — User deactivated
- `USER_LOGIN` — Successful login

**Admin actions:**
- `PRICING_RULE_CREATED` — New pricing rule
- `PRICING_RULE_UPDATED` — Pricing rule modified
- `TEMPLATE_CREATED` — New report template
- `TEMPLATE_UPDATED` — Template modified

### 4.3 Backend — Service

`activity_log_service.py`:
- `log_activity(db, actor_id, actor_type, action, target_type, target_id, metadata=None, ip_address=None)` — Creates ActivityLog row.
- Fire-and-forget: failures are logged to application logger but do not block or rollback the parent operation.
- Called from existing services at key points (request_service, broadcast_service, report_service, listing_service, template_service) and from auth/user-management endpoints.

### 4.4 Backend — API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/activity` | Paginated list with filters |
| GET | `/api/admin/activity/export` | CSV export with same filters |

**Filters (query params):**
- `action` — Filter by action type
- `actor_type` — Filter by LENDER/VENDOR/ADMIN
- `target_type` — Filter by entity type
- `actor_id` — Filter by specific user
- `date_from`, `date_to` — Date range
- `page`, `page_size` — Pagination (default page_size=25)

Response includes resolved actor name via user join.

### 4.5 Frontend — Admin Dashboard Tab

New "Activity" tab in admin dashboard (`app/admin/dashboard/page.tsx`):

**Table columns:**
- Timestamp (formatted date/time)
- User (name + role type badge)
- Action (human-readable label)
- Target (entity type + linked to detail page where applicable)
- Details (expandable metadata JSON, if present)

**Filter bar:**
- Date range inputs
- Actor type dropdown (All / Lender / Vendor / Admin)
- Action type dropdown (grouped by category)
- Export CSV button (top-right)

**Pagination:** Bottom of table, consistent with other admin tabs.

## 5. Infrastructure & Cross-Cutting

### 5.1 Docker / Services

- No new containers. WebSocket runs on the existing FastAPI/uvicorn process.
- Redis pub/sub uses the existing Redis instance (port 6380). New channels are lightweight.
- `redis.asyncio` for the pub/sub subscriber (available via redis-py).

### 5.2 Dependencies

- **Backend:** No new packages. FastAPI has native WebSocket support. `redis[hiredis]` already installed.
- **Frontend:** No new packages. Browser native `WebSocket` API. React context for state management.

### 5.3 Security

- WebSocket auth via JWT sent as first message (not query param — avoids token in server logs/URLs).
- Rate limiting: max 5 WebSocket connection attempts per minute per IP.
- Activity log `ip_address` captured from `request.client.host`.
- All WebSocket messages validated before processing.

### 5.4 Graceful Degradation

- WebSocket is an enhancement, not a requirement. If connection fails or browser doesn't support it, the 60s polling fallback keeps everything working.
- NotificationBell component interface unchanged — just receives updates faster.

### 5.5 Heartbeat & Reconnection

- Client sends `{"type": "ping"}` every 30s, server responds `{"type": "pong"}`
- No pong within 10s triggers reconnect
- Exponential backoff: 1s → 2s → 4s → 8s → 16s → 30s (capped)
- On JWT expiry (server close code 4001): refresh token, then reconnect

## 6. Out of Scope

- Email/SMS notification channels (Phase 12 or later)
- Push notifications / Firebase (Phase 11 — PWA)
- Notification grouping/batching
- Real-time dashboard counter updates
- Notification sound/vibration settings

## 7. Files to Create/Modify

### New Files (Backend)
- `app/models/activity_log.py` — ActivityLog model
- `app/core/ws_manager.py` — WebSocket connection manager + Redis pub/sub
- `app/api/ws_notifications.py` — WebSocket endpoint
- `app/services/activity_log_service.py` — Activity logging service
- `app/services/notification_preference_service.py` — Preference CRUD
- `app/schemas/activity_log.py` — ActivityLog Pydantic schemas
- `app/api/admin/activity.py` — Admin activity API
- Alembic migration for NotificationPreference + ActivityLog

### New Files (Frontend)
- `src/contexts/websocket-provider.tsx` — WebSocket context + provider
- `src/hooks/use-websocket.ts` — WebSocket connection hook
- `src/types/activity.ts` — ActivityLog TypeScript types
- `src/app/admin/dashboard/_components/activity-tab.tsx` — Activity log tab
- `src/app/lender/settings/_components/notification-prefs.tsx` — Lender notification settings
- `src/app/vendor/settings/_components/notification-prefs.tsx` — Vendor notification settings

### Modified Files (Backend)
- `app/models/__init__.py` — Register new models
- `app/models/notification.py` — Add NotificationPreference model
- `app/services/notification_service.py` — Add preference check + WebSocket publish
- `app/main.py` — Register WebSocket route + new API routers
- `app/services/request_service.py` — Add activity logging calls
- `app/services/broadcast_service.py` — Add activity logging calls
- `app/services/report_service.py` — Add activity logging calls
- `app/services/listing_service.py` — Add activity logging calls
- `app/services/template_service.py` — Add activity logging calls
- `app/api/auth.py` — Add login activity logging

### Modified Files (Frontend)
- `src/app/lender/layout.tsx` — Wrap with WebSocketProvider
- `src/app/vendor/layout.tsx` — Wrap with WebSocketProvider
- `src/app/admin/layout.tsx` — Wrap with WebSocketProvider
- `src/hooks/use-notifications.ts` — Accept WebSocket events, reduce polling to 60s
- `src/components/notification-bell.tsx` — Handle real-time notification updates
- `src/app/admin/dashboard/page.tsx` — Add Activity tab
- `src/app/lender/settings/page.tsx` — Add Notifications section
- `src/app/vendor/settings/page.tsx` — Add Notifications section
