# Phase 10: Notifications & Real-Time Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Upgrade polling-based notifications to WebSocket real-time delivery, add per-event-type notification preferences, and implement activity/audit logging with admin dashboard view.

**Architecture:** Native FastAPI WebSocket endpoint with Redis pub/sub for multi-worker support. Single persistent connection per session managed by React context provider. Activity log captures ~18 core business actions with admin-facing filterable table and CSV export.

**Tech Stack:** FastAPI WebSocket, Redis pub/sub (redis.asyncio), React Context (WebSocketProvider), existing Tailwind/shadcn UI patterns.

---

## File Structure

### New Files (Backend — 7)
| File | Responsibility |
|------|---------------|
| `backend/app/models/activity_log.py` | ActivityLog SQLAlchemy model |
| `backend/app/core/ws_manager.py` | WebSocket connection manager + Redis pub/sub |
| `backend/app/api/ws_notifications.py` | WebSocket endpoint handler |
| `backend/app/services/activity_log_service.py` | Activity log write + query service |
| `backend/app/services/notification_preference_service.py` | Preference CRUD service |
| `backend/app/schemas/activity_log.py` | ActivityLog Pydantic schemas |
| `backend/app/api/admin/activity.py` | Admin activity list + CSV export endpoints |

### New Files (Frontend — 6)
| File | Responsibility |
|------|---------------|
| `frontend/src/contexts/websocket-provider.tsx` | WebSocket context + provider component |
| `frontend/src/types/activity.ts` | ActivityLog TypeScript types |
| `frontend/src/app/admin/dashboard/_components/activity-tab.tsx` | Activity log admin tab |
| `frontend/src/app/lender/settings/_components/notification-prefs.tsx` | Lender notification preferences |
| `frontend/src/app/vendor/settings/_components/notification-prefs.tsx` | Vendor notification preferences |
| `frontend/src/types/notification-preference.ts` | Preference TypeScript types |

### Modified Files (Backend — 11)
| File | Change |
|------|--------|
| `backend/app/models/notification.py` | Add NotificationPreference model |
| `backend/app/models/enums.py` | Add ActivityAction, ActivityTargetType enums |
| `backend/app/models/__init__.py` | Register new models |
| `backend/app/schemas/notification.py` | Add preference schemas |
| `backend/app/services/notification_service.py` | Add preference check + WebSocket publish |
| `backend/app/main.py` | Register WebSocket route + new API routers |
| `backend/app/services/broadcast_service.py` | Add activity logging |
| `backend/app/services/request_service.py` | Add activity logging |
| `backend/app/services/listing_service.py` | Add activity logging |
| `backend/app/services/template_service.py` | Add activity logging |
| `backend/app/api/auth.py` | Add login activity logging |

### Modified Files (Frontend — 7)
| File | Change |
|------|--------|
| `frontend/src/app/lender/layout.tsx` | Wrap with WebSocketProvider |
| `frontend/src/app/vendor/layout.tsx` | Wrap with WebSocketProvider |
| `frontend/src/app/admin/layout.tsx` | Wrap with WebSocketProvider |
| `frontend/src/hooks/use-notifications.ts` | Accept WebSocket events, reduce polling to 60s |
| `frontend/src/components/notification-bell.tsx` | Handle real-time updates |
| `frontend/src/app/admin/dashboard/page.tsx` | Add Activity tab |
| `frontend/src/app/lender/settings/page.tsx` | Add Notifications tab |
| `frontend/src/app/vendor/settings/page.tsx` | Add tab layout with Notifications tab |

### Migration
| File | Change |
|------|--------|
| `backend/alembic/versions/xxx_add_notification_preference_and_activity_log.py` | Add both tables |

---

## Task 1: Add Enums for Activity Logging

**Files:**
- Modify: `backend/app/models/enums.py`

- [ ] **Step 1: Add ActivityAction and ActivityTargetType enums**

Add after the `NotificationReferenceType` class at the end of `backend/app/models/enums.py`:

```python
class ActivityAction(str, Enum):
    REQUEST_CREATED = "REQUEST_CREATED"
    REQUEST_ACCEPTED = "REQUEST_ACCEPTED"
    REQUEST_REJECTED = "REQUEST_REJECTED"
    REQUEST_CANCELLED = "REQUEST_CANCELLED"
    REPORT_UPLOADED = "REPORT_UPLOADED"
    REPORT_PUBLISHED = "REPORT_PUBLISHED"
    REPORT_REVISION_REQUESTED = "REPORT_REVISION_REQUESTED"
    REPORT_REVISED = "REPORT_REVISED"
    LISTING_CREATED = "LISTING_CREATED"
    LISTING_DELISTED = "LISTING_DELISTED"
    LISTING_PURCHASED = "LISTING_PURCHASED"
    USER_CREATED = "USER_CREATED"
    USER_DEACTIVATED = "USER_DEACTIVATED"
    USER_LOGIN = "USER_LOGIN"
    PRICING_RULE_CREATED = "PRICING_RULE_CREATED"
    PRICING_RULE_UPDATED = "PRICING_RULE_UPDATED"
    TEMPLATE_CREATED = "TEMPLATE_CREATED"
    TEMPLATE_UPDATED = "TEMPLATE_UPDATED"


class ActivityActorType(str, Enum):
    LENDER = "LENDER"
    VENDOR = "VENDOR"
    ADMIN = "ADMIN"
    SYSTEM = "SYSTEM"


class ActivityTargetType(str, Enum):
    REQUEST = "REQUEST"
    REPORT = "REPORT"
    LISTING = "LISTING"
    USER = "USER"
    PRICING_RULE = "PRICING_RULE"
    TEMPLATE = "TEMPLATE"
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/models/enums.py
git commit -m "feat(phase10): add activity logging enums"
```

---

## Task 2: Add NotificationPreference Model

**Files:**
- Modify: `backend/app/models/notification.py`

- [ ] **Step 1: Add NotificationPreference model**

Add to the imports at top of `backend/app/models/notification.py`:

```python
from sqlalchemy import UniqueConstraint
```

Then add after the `Notification` class:

```python
class NotificationPreference(BaseModel):
    __tablename__ = "notification_preferences"

    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"), index=True)
    event_type: Mapped[str] = mapped_column(String(50))
    enabled: Mapped[bool] = mapped_column(Boolean, default=True)

    __table_args__ = (
        UniqueConstraint("user_id", "event_type", name="uq_notification_pref_user_event"),
    )
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/models/notification.py
git commit -m "feat(phase10): add NotificationPreference model"
```

---

## Task 3: Add ActivityLog Model

**Files:**
- Create: `backend/app/models/activity_log.py`

- [ ] **Step 1: Create the model file**

```python
import uuid

from sqlalchemy import ForeignKey, Index, String, Text
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import BaseModel


class ActivityLog(BaseModel):
    __tablename__ = "activity_logs"

    actor_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("users.id"), nullable=True, index=True
    )
    actor_type: Mapped[str] = mapped_column(String(20))
    action: Mapped[str] = mapped_column(String(50), index=True)
    target_type: Mapped[str] = mapped_column(String(50))
    target_id: Mapped[uuid.UUID] = mapped_column()
    metadata_json: Mapped[dict | None] = mapped_column(JSONB, nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(45), nullable=True)

    __table_args__ = (
        Index("ix_activity_logs_target", "target_type", "target_id"),
        Index("ix_activity_logs_created_at", "created_at"),
    )
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/models/activity_log.py
git commit -m "feat(phase10): add ActivityLog model"
```

---

## Task 4: Register New Models and Generate Migration

**Files:**
- Modify: `backend/app/models/__init__.py`

- [ ] **Step 1: Register models in `__init__.py`**

Add these imports to `backend/app/models/__init__.py` alongside existing imports:

```python
from app.models.activity_log import ActivityLog
from app.models.notification import NotificationPreference
```

And add to the `__all__` list:

```python
"ActivityLog",
"NotificationPreference",
```

Also add the new enums to imports and `__all__`:

```python
from app.models.enums import ActivityAction, ActivityActorType, ActivityTargetType
```

```python
"ActivityAction",
"ActivityActorType",
"ActivityTargetType",
```

- [ ] **Step 2: Generate Alembic migration**

```bash
cd backend && make migration msg="add notification_preferences and activity_logs tables"
```

If running inside Docker, copy the migration file to host:
```bash
docker cp propeval-backend-1:/app/alembic/versions/<migration_file>.py backend/alembic/versions/
```

- [ ] **Step 3: Run migration**

```bash
make migrate
```

- [ ] **Step 4: Commit**

```bash
git add backend/app/models/__init__.py backend/alembic/versions/
git commit -m "feat(phase10): register models and add migration"
```

---

## Task 5: Add Notification Preference Service

**Files:**
- Create: `backend/app/services/notification_preference_service.py`

- [ ] **Step 1: Create the service**

```python
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.enums import NotificationEventType
from app.models.notification import NotificationPreference

import uuid

ALL_EVENT_TYPES = [e.value for e in NotificationEventType]


async def get_preferences(db: AsyncSession, user_id: uuid.UUID) -> list[dict]:
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id
        )
    )
    prefs = {p.event_type: p.enabled for p in result.scalars().all()}
    return [
        {"event_type": et, "enabled": prefs.get(et, True)}
        for et in ALL_EVENT_TYPES
    ]


async def is_event_enabled(
    db: AsyncSession, user_id: uuid.UUID, event_type: str
) -> bool:
    result = await db.execute(
        select(NotificationPreference.enabled).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.event_type == event_type,
        )
    )
    row = result.scalar_one_or_none()
    if row is None:
        return True
    return row


async def update_preference(
    db: AsyncSession, user_id: uuid.UUID, event_type: str, enabled: bool
) -> dict:
    result = await db.execute(
        select(NotificationPreference).where(
            NotificationPreference.user_id == user_id,
            NotificationPreference.event_type == event_type,
        )
    )
    pref = result.scalar_one_or_none()
    if pref:
        pref.enabled = enabled
    else:
        pref = NotificationPreference(
            user_id=user_id, event_type=event_type, enabled=enabled
        )
        db.add(pref)
    await db.flush()
    return {"event_type": event_type, "enabled": enabled}
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/notification_preference_service.py
git commit -m "feat(phase10): add notification preference service"
```

---

## Task 6: Add Activity Log Service

**Files:**
- Create: `backend/app/services/activity_log_service.py`

- [ ] **Step 1: Create the service**

```python
import logging
import uuid
from datetime import datetime

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.activity_log import ActivityLog
from app.models.user import User

logger = logging.getLogger(__name__)


async def log_activity(
    db: AsyncSession,
    *,
    actor_id: uuid.UUID | None,
    actor_type: str,
    action: str,
    target_type: str,
    target_id: uuid.UUID,
    metadata: dict | None = None,
    ip_address: str | None = None,
) -> None:
    try:
        entry = ActivityLog(
            actor_id=actor_id,
            actor_type=actor_type,
            action=action,
            target_type=target_type,
            target_id=target_id,
            metadata_json=metadata,
            ip_address=ip_address,
        )
        db.add(entry)
        await db.flush()
    except Exception:
        logger.exception("Failed to log activity: %s %s", action, target_id)


async def get_activity_logs(
    db: AsyncSession,
    *,
    action: str | None = None,
    actor_type: str | None = None,
    target_type: str | None = None,
    actor_id: uuid.UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = 1,
    page_size: int = 25,
) -> tuple[list[dict], int]:
    query = select(
        ActivityLog,
        User.full_name,
        User.email,
    ).outerjoin(User, ActivityLog.actor_id == User.id)

    count_query = select(func.count(ActivityLog.id))

    if action:
        query = query.where(ActivityLog.action == action)
        count_query = count_query.where(ActivityLog.action == action)
    if actor_type:
        query = query.where(ActivityLog.actor_type == actor_type)
        count_query = count_query.where(ActivityLog.actor_type == actor_type)
    if target_type:
        query = query.where(ActivityLog.target_type == target_type)
        count_query = count_query.where(ActivityLog.target_type == target_type)
    if actor_id:
        query = query.where(ActivityLog.actor_id == actor_id)
        count_query = count_query.where(ActivityLog.actor_id == actor_id)
    if date_from:
        query = query.where(ActivityLog.created_at >= date_from)
        count_query = count_query.where(ActivityLog.created_at >= date_from)
    if date_to:
        query = query.where(ActivityLog.created_at <= date_to)
        count_query = count_query.where(ActivityLog.created_at <= date_to)

    total = (await db.execute(count_query)).scalar() or 0

    query = query.order_by(ActivityLog.created_at.desc())
    query = query.offset((page - 1) * page_size).limit(page_size)

    result = await db.execute(query)
    rows = result.all()

    logs = []
    for row in rows:
        log = row[0]
        logs.append({
            "id": str(log.id),
            "actor_id": str(log.actor_id) if log.actor_id else None,
            "actor_name": row[1] or "System",
            "actor_email": row[2],
            "actor_type": log.actor_type,
            "action": log.action,
            "target_type": log.target_type,
            "target_id": str(log.target_id),
            "metadata_json": log.metadata_json,
            "ip_address": log.ip_address,
            "created_at": log.created_at.isoformat(),
        })

    return logs, total
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/activity_log_service.py
git commit -m "feat(phase10): add activity log service"
```

---

## Task 7: Add Preference and Activity Log Schemas

**Files:**
- Modify: `backend/app/schemas/notification.py`
- Create: `backend/app/schemas/activity_log.py`

- [ ] **Step 1: Add preference schemas to notification.py**

Add at the end of `backend/app/schemas/notification.py`:

```python
class NotificationPreferenceItem(BaseModel):
    event_type: str
    enabled: bool


class NotificationPreferencesResponse(BaseModel):
    preferences: list[NotificationPreferenceItem]


class NotificationPreferenceUpdate(BaseModel):
    event_type: str
    enabled: bool
```

- [ ] **Step 2: Create activity log schemas**

Create `backend/app/schemas/activity_log.py`:

```python
from pydantic import BaseModel


class ActivityLogResponse(BaseModel):
    id: str
    actor_id: str | None
    actor_name: str
    actor_email: str | None
    actor_type: str
    action: str
    target_type: str
    target_id: str
    metadata_json: dict | None
    ip_address: str | None
    created_at: str


class ActivityLogListResponse(BaseModel):
    logs: list[ActivityLogResponse]
    total: int
    page: int
    page_size: int
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/schemas/notification.py backend/app/schemas/activity_log.py
git commit -m "feat(phase10): add preference and activity log schemas"
```

---

## Task 8: Add WebSocket Connection Manager

**Files:**
- Create: `backend/app/core/ws_manager.py`

- [ ] **Step 1: Create the connection manager**

```python
import asyncio
import json
import logging
from collections import defaultdict

import redis.asyncio as aioredis
from fastapi import WebSocket

from app.core.config import settings

logger = logging.getLogger(__name__)


class ConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._redis: aioredis.Redis | None = None
        self._subscriber_task: asyncio.Task | None = None

    async def _get_redis(self) -> aioredis.Redis:
        if self._redis is None:
            self._redis = aioredis.from_url(settings.REDIS_URL)
        return self._redis

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        self._connections[user_id].add(websocket)

    async def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        self._connections[user_id].discard(websocket)
        if not self._connections[user_id]:
            del self._connections[user_id]

    async def send_to_user(self, user_id: str, payload: dict) -> None:
        message = json.dumps(payload)
        dead = []
        for ws in self._connections.get(user_id, set()):
            try:
                await ws.send_text(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self._connections[user_id].discard(ws)

    async def publish(self, user_id: str, payload: dict) -> None:
        try:
            r = await self._get_redis()
            await r.publish(f"notifications:{user_id}", json.dumps(payload))
        except Exception:
            logger.exception("Failed to publish notification to Redis")

    async def start_subscriber(self) -> None:
        self._subscriber_task = asyncio.create_task(self._subscribe_loop())

    async def _subscribe_loop(self) -> None:
        while True:
            try:
                r = await self._get_redis()
                pubsub = r.pubsub()
                await pubsub.psubscribe("notifications:*")
                async for message in pubsub.listen():
                    if message["type"] == "pmessage":
                        channel = message["channel"]
                        if isinstance(channel, bytes):
                            channel = channel.decode()
                        user_id = channel.split(":", 1)[1]
                        data = message["data"]
                        if isinstance(data, bytes):
                            data = data.decode()
                        payload = json.loads(data)
                        await self.send_to_user(user_id, payload)
            except asyncio.CancelledError:
                break
            except Exception:
                logger.exception("WebSocket subscriber error, reconnecting...")
                await asyncio.sleep(1)

    async def shutdown(self) -> None:
        if self._subscriber_task:
            self._subscriber_task.cancel()
        if self._redis:
            await self._redis.close()


ws_manager = ConnectionManager()
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/core/ws_manager.py
git commit -m "feat(phase10): add WebSocket connection manager with Redis pub/sub"
```

---

## Task 9: Add WebSocket Endpoint

**Files:**
- Create: `backend/app/api/ws_notifications.py`

- [ ] **Step 1: Create the WebSocket endpoint**

```python
import asyncio
import json
import logging

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from app.core.security import decode_access_token
from app.core.ws_manager import ws_manager

logger = logging.getLogger(__name__)

router = APIRouter()


@router.websocket("/ws/notifications")
async def websocket_notifications(websocket: WebSocket):
    await websocket.accept()
    user_id: str | None = None

    try:
        auth_msg = await asyncio.wait_for(websocket.receive_text(), timeout=10)
        data = json.loads(auth_msg)
        if data.get("type") != "auth" or not data.get("token"):
            await websocket.close(code=4001, reason="Invalid auth message")
            return

        payload = decode_access_token(data["token"])
        if payload is None:
            await websocket.close(code=4001, reason="Invalid token")
            return

        user_id = payload.get("sub")
        if not user_id:
            await websocket.close(code=4001, reason="Invalid token payload")
            return

        await ws_manager.connect(user_id, websocket)
        await websocket.send_text(json.dumps({"type": "auth_ok"}))

        while True:
            text = await websocket.receive_text()
            msg = json.loads(text)
            if msg.get("type") == "ping":
                await websocket.send_text(json.dumps({"type": "pong"}))

    except WebSocketDisconnect:
        pass
    except asyncio.TimeoutError:
        await websocket.close(code=4001, reason="Auth timeout")
    except Exception:
        logger.exception("WebSocket error")
    finally:
        if user_id:
            await ws_manager.disconnect(user_id, websocket)
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/ws_notifications.py
git commit -m "feat(phase10): add WebSocket notification endpoint"
```

---

## Task 10: Update Notification Service with Preference Check and WebSocket Publish

**Files:**
- Modify: `backend/app/services/notification_service.py`

- [ ] **Step 1: Update create_notification to check preferences and publish via WebSocket**

Replace the existing `create_notification` function in `backend/app/services/notification_service.py`. Add imports at the top:

```python
from app.services.notification_preference_service import is_event_enabled
from app.core.ws_manager import ws_manager
```

Replace the `create_notification` function with:

```python
async def create_notification(
    db: AsyncSession,
    user_id: uuid.UUID,
    event_type: NotificationEventType,
    title: str,
    message: str,
    reference_id: uuid.UUID,
    reference_type: NotificationReferenceType,
) -> Notification | None:
    if not await is_event_enabled(db, user_id, event_type.value):
        return None

    notification = Notification(
        user_id=user_id,
        event_type=event_type,
        title=title,
        message=message,
        reference_id=reference_id,
        reference_type=reference_type,
    )
    db.add(notification)
    await db.flush()

    await ws_manager.publish(
        str(user_id),
        {
            "type": "notification",
            "data": {
                "id": str(notification.id),
                "event_type": event_type.value,
                "title": title,
                "message": message,
                "reference_id": str(reference_id),
                "reference_type": reference_type.value,
                "created_at": notification.created_at.isoformat(),
            },
        },
    )

    return notification
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/services/notification_service.py
git commit -m "feat(phase10): add preference check and WebSocket publish to notification service"
```

---

## Task 11: Add Notification Preference API Endpoints

**Files:**
- Modify: `backend/app/api/notifications.py`

- [ ] **Step 1: Add preference endpoints**

Add imports at the top of `backend/app/api/notifications.py`:

```python
from app.services import notification_preference_service
from app.schemas.notification import (
    NotificationPreferencesResponse,
    NotificationPreferenceUpdate,
    NotificationPreferenceItem,
)
```

Add these endpoints after the existing `mark_all_read` endpoint:

```python
@router.get("/preferences", response_model=NotificationPreferencesResponse)
async def get_preferences(
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    prefs = await notification_preference_service.get_preferences(db, current_user.id)
    return NotificationPreferencesResponse(
        preferences=[NotificationPreferenceItem(**p) for p in prefs]
    )


@router.patch("/preferences")
async def update_preference(
    body: NotificationPreferenceUpdate,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    result = await notification_preference_service.update_preference(
        db, current_user.id, body.event_type, body.enabled
    )
    return result
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/notifications.py
git commit -m "feat(phase10): add notification preference API endpoints"
```

---

## Task 12: Add Admin Activity API Endpoints

**Files:**
- Create: `backend/app/api/admin/activity.py`

- [ ] **Step 1: Create the activity API router**

```python
from datetime import datetime

from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.schemas.activity_log import ActivityLogListResponse
from app.services import activity_log_service
from app.services.csv_export_service import generate_csv_response

router = APIRouter(
    prefix="/api/admin/activity",
    tags=["admin-activity"],
    dependencies=[Depends(require_role(["ADMIN"]))],
)


@router.get("/", response_model=ActivityLogListResponse)
async def list_activity_logs(
    action: str | None = None,
    actor_type: str | None = None,
    target_type: str | None = None,
    actor_id: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(25, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    logs, total = await activity_log_service.get_activity_logs(
        db,
        action=action,
        actor_type=actor_type,
        target_type=target_type,
        actor_id=actor_id,
        date_from=date_from,
        date_to=date_to,
        page=page,
        page_size=page_size,
    )
    return ActivityLogListResponse(
        logs=logs, total=total, page=page, page_size=page_size
    )


@router.get("/export")
async def export_activity_logs(
    action: str | None = None,
    actor_type: str | None = None,
    target_type: str | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db: AsyncSession = Depends(get_db),
    current_user=Depends(get_current_user),
):
    logs, _ = await activity_log_service.get_activity_logs(
        db,
        action=action,
        actor_type=actor_type,
        target_type=target_type,
        date_from=date_from,
        date_to=date_to,
        page=1,
        page_size=10000,
    )
    columns = [
        ("Timestamp", "created_at"),
        ("User", "actor_name"),
        ("Email", "actor_email"),
        ("Role", "actor_type"),
        ("Action", "action"),
        ("Target Type", "target_type"),
        ("Target ID", "target_id"),
        ("IP Address", "ip_address"),
    ]
    return generate_csv_response(logs, columns, filename="activity_logs.csv")
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/api/admin/activity.py
git commit -m "feat(phase10): add admin activity log API with CSV export"
```

---

## Task 13: Register WebSocket Route and New Routers in main.py

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Add imports and register routers**

Add these imports alongside existing ones in `backend/app/main.py`:

```python
from app.api.ws_notifications import router as ws_router
from app.api.admin.activity import router as admin_activity_router
from app.core.ws_manager import ws_manager
```

Add router registrations alongside existing `app.include_router(...)` lines:

```python
app.include_router(ws_router)
app.include_router(admin_activity_router)
```

Add startup/shutdown events for the WebSocket subscriber. Add after `app = FastAPI(...)`:

```python
@app.on_event("startup")
async def startup_ws():
    await ws_manager.start_subscriber()


@app.on_event("shutdown")
async def shutdown_ws():
    await ws_manager.shutdown()
```

- [ ] **Step 2: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(phase10): register WebSocket route and activity router in main.py"
```

---

## Task 14: Add Activity Logging to Existing Services

**Files:**
- Modify: `backend/app/services/broadcast_service.py`
- Modify: `backend/app/services/request_service.py`
- Modify: `backend/app/services/listing_service.py`
- Modify: `backend/app/services/template_service.py`
- Modify: `backend/app/api/auth.py`

- [ ] **Step 1: Add activity logging to broadcast_service.py**

Add import at top of `backend/app/services/broadcast_service.py`:

```python
from app.services.activity_log_service import log_activity
```

After each `create_notification()` call in this file, add a corresponding `log_activity()` call. For example, after the broadcast notification at ~line 125:

```python
await log_activity(
    db,
    actor_id=None,
    actor_type="SYSTEM",
    action="REQUEST_CREATED",
    target_type="REQUEST",
    target_id=request.id,
    metadata={"broadcast_round": 1},
)
```

- [ ] **Step 2: Add activity logging to request_service.py**

Add import at top of `backend/app/services/request_service.py`:

```python
from app.services.activity_log_service import log_activity
```

After the `REQUEST_ACCEPTED` notification (~line 204), add:

```python
await log_activity(
    db,
    actor_id=vendor_user.id,
    actor_type="VENDOR",
    action="REQUEST_ACCEPTED",
    target_type="REQUEST",
    target_id=request.id,
)
```

After the `REVISION_REQUESTED` notification (~line 251), add:

```python
await log_activity(
    db,
    actor_id=current_user.id,
    actor_type="LENDER",
    action="REPORT_REVISION_REQUESTED",
    target_type="REPORT",
    target_id=report.id,
)
```

Also find the request creation function and add:

```python
await log_activity(
    db,
    actor_id=current_user.id,
    actor_type="LENDER",
    action="REQUEST_CREATED",
    target_type="REQUEST",
    target_id=request.id,
    metadata={"request_type": request.request_type.value},
)
```

- [ ] **Step 3: Add activity logging to listing_service.py**

Add import at top of `backend/app/services/listing_service.py`:

```python
from app.services.activity_log_service import log_activity
```

After the `LISTING_DOWNLOADED` notification (~line 407), add:

```python
await log_activity(
    db,
    actor_id=current_user.id,
    actor_type="LENDER",
    action="LISTING_PURCHASED",
    target_type="LISTING",
    target_id=listing.id,
)
```

Where listings are created, add:

```python
await log_activity(
    db,
    actor_id=None,
    actor_type="SYSTEM",
    action="LISTING_CREATED",
    target_type="LISTING",
    target_id=listing.id,
    metadata={"pin_code": listing.pin_code, "property_type": listing.property_type.value},
)
```

- [ ] **Step 4: Add activity logging to template_service.py**

Add import at top of `backend/app/services/template_service.py`:

```python
from app.services.activity_log_service import log_activity
```

In the create template function, add:

```python
await log_activity(
    db,
    actor_id=current_user.id,
    actor_type="LENDER",
    action="TEMPLATE_CREATED",
    target_type="TEMPLATE",
    target_id=template.id,
)
```

In the update template function, add:

```python
await log_activity(
    db,
    actor_id=current_user.id,
    actor_type="LENDER",
    action="TEMPLATE_UPDATED",
    target_type="TEMPLATE",
    target_id=template.id,
)
```

- [ ] **Step 5: Add login activity logging to auth.py**

Add import at top of `backend/app/api/auth.py`:

```python
from app.services.activity_log_service import log_activity
```

In the login endpoint (after successful token generation), add:

```python
await log_activity(
    db,
    actor_id=user.id,
    actor_type=user.user_type.value,
    action="USER_LOGIN",
    target_type="USER",
    target_id=user.id,
    ip_address=request.client.host if request.client else None,
)
```

Note: You'll need to add `request: Request` as a parameter to the login endpoint and import `from starlette.requests import Request`.

- [ ] **Step 6: Commit**

```bash
git add backend/app/services/broadcast_service.py backend/app/services/request_service.py backend/app/services/listing_service.py backend/app/services/template_service.py backend/app/api/auth.py
git commit -m "feat(phase10): add activity logging to existing services and auth"
```

---

## Task 15: Add decode_access_token Helper to Security Module

**Files:**
- Modify: `backend/app/core/security.py`

- [ ] **Step 1: Add decode helper if not already present**

Check `backend/app/core/security.py` for an existing `decode_access_token` function. If it does not exist, add:

```python
def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
```

This is used by the WebSocket endpoint for JWT validation. The existing `get_current_user` dependency in `deps.py` likely has similar logic — extract and reuse the same pattern.

- [ ] **Step 2: Commit (if changes needed)**

```bash
git add backend/app/core/security.py
git commit -m "feat(phase10): add decode_access_token helper for WebSocket auth"
```

---

## Task 16: Add Frontend TypeScript Types

**Files:**
- Create: `frontend/src/types/notification-preference.ts`
- Create: `frontend/src/types/activity.ts`

- [ ] **Step 1: Create notification preference types**

Create `frontend/src/types/notification-preference.ts`:

```typescript
export interface NotificationPreferenceItem {
  event_type: string;
  enabled: boolean;
}

export interface NotificationPreferencesResponse {
  preferences: NotificationPreferenceItem[];
}
```

- [ ] **Step 2: Create activity log types**

Create `frontend/src/types/activity.ts`:

```typescript
export interface ActivityLogEntry {
  id: string;
  actor_id: string | null;
  actor_name: string;
  actor_email: string | null;
  actor_type: string;
  action: string;
  target_type: string;
  target_id: string;
  metadata_json: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface ActivityLogListResponse {
  logs: ActivityLogEntry[];
  total: number;
  page: number;
  page_size: number;
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/types/notification-preference.ts frontend/src/types/activity.ts
git commit -m "feat(phase10): add notification preference and activity log TypeScript types"
```

---

## Task 17: Add WebSocket Provider

**Files:**
- Create: `frontend/src/contexts/websocket-provider.tsx`

- [ ] **Step 1: Create the WebSocket context and provider**

```tsx
"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from "react";

interface WebSocketContextValue {
  connected: boolean;
  lastNotification: unknown | null;
}

const WebSocketContext = createContext<WebSocketContextValue>({
  connected: false,
  lastNotification: null,
});

export function useWebSocket() {
  return useContext(WebSocketContext);
}

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState(false);
  const [lastNotification, setLastNotification] = useState<unknown | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const reconnectDelayRef = useRef(1000);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval>>();
  const mountedRef = useRef(true);

  const getToken = useCallback(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("access_token");
  }, []);

  const connect = useCallback(() => {
    const token = getToken();
    if (!token || !mountedRef.current) return;

    try {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      const wsUrl = `${protocol}//${window.location.hostname}:8020/ws/notifications`;
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        ws.send(JSON.stringify({ type: "auth", token }));
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "auth_ok") {
          setConnected(true);
          reconnectDelayRef.current = 1000;
          pingIntervalRef.current = setInterval(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: "ping" }));
            }
          }, 30000);
        } else if (msg.type === "notification") {
          setLastNotification(msg.data);
        }
      };

      ws.onclose = (event) => {
        setConnected(false);
        if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);

        if (!mountedRef.current) return;

        if (event.code === 4001) {
          // Auth failure — don't auto-reconnect, token may be expired
          return;
        }

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectDelayRef.current = Math.min(reconnectDelayRef.current * 2, 30000);
          connect();
        }, reconnectDelayRef.current);
      };

      ws.onerror = () => {
        ws.close();
      };
    } catch {
      // WebSocket not supported or connection failed
    }
  }, [getToken]);

  useEffect(() => {
    mountedRef.current = true;
    connect();

    return () => {
      mountedRef.current = false;
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  return (
    <WebSocketContext.Provider value={{ connected, lastNotification }}>
      {children}
    </WebSocketContext.Provider>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/contexts/websocket-provider.tsx
git commit -m "feat(phase10): add WebSocket provider with auto-reconnect and heartbeat"
```

---

## Task 18: Update use-notifications Hook to Accept WebSocket Events

**Files:**
- Modify: `frontend/src/hooks/use-notifications.ts`

- [ ] **Step 1: Update the hook to integrate WebSocket notifications**

Replace the contents of `frontend/src/hooks/use-notifications.ts`:

```typescript
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import { useWebSocket } from "@/contexts/websocket-provider";

interface Notification {
  id: string;
  event_type: string;
  title: string;
  message: string;
  reference_id: string;
  reference_type: string;
  is_read: boolean;
  created_at: string;
}

export function useNotifications() {
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(false);
  const { lastNotification } = useWebSocket();
  const prevNotificationRef = useRef<unknown>(null);

  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get<{ unread_count: number }>("/api/notifications/unread-count");
      setUnreadCount(res.unread_count);
    } catch {
      // silent
    }
  }, []);

  const fetchNotifications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get<{ notifications: Notification[]; total: number }>(
        "/api/notifications/?page_size=20"
      );
      setNotifications(res.notifications);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (id: string) => {
    try {
      await api.patch(`/api/notifications/${id}/read`);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n))
      );
      setUnreadCount((c) => Math.max(0, c - 1));
    } catch {
      // silent
    }
  }, []);

  const markAllAsRead = useCallback(async () => {
    try {
      await api.patch("/api/notifications/read-all");
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch {
      // silent
    }
  }, []);

  // Handle real-time WebSocket notifications
  useEffect(() => {
    if (lastNotification && lastNotification !== prevNotificationRef.current) {
      prevNotificationRef.current = lastNotification;
      const notif = lastNotification as Notification & { is_read?: boolean };
      setUnreadCount((c) => c + 1);
      setNotifications((prev) => [
        { ...notif, is_read: false },
        ...prev,
      ]);
    }
  }, [lastNotification]);

  // Polling fallback — reduced to 60s since WebSocket handles real-time
  useEffect(() => {
    fetchUnreadCount();
    const interval = setInterval(fetchUnreadCount, 60000);
    return () => clearInterval(interval);
  }, [fetchUnreadCount]);

  return {
    unreadCount,
    notifications,
    loading,
    fetchNotifications,
    markAsRead,
    markAllAsRead,
  };
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/src/hooks/use-notifications.ts
git commit -m "feat(phase10): integrate WebSocket events into use-notifications hook"
```

---

## Task 19: Wrap Portal Layouts with WebSocketProvider

**Files:**
- Modify: `frontend/src/app/lender/layout.tsx`
- Modify: `frontend/src/app/vendor/layout.tsx`
- Modify: `frontend/src/app/admin/layout.tsx`

- [ ] **Step 1: Wrap lender layout**

Add import at top of `frontend/src/app/lender/layout.tsx`:

```typescript
import { WebSocketProvider } from "@/contexts/websocket-provider";
```

Wrap the outermost `<div>` returned by the component with `<WebSocketProvider>`:

```tsx
return (
  <WebSocketProvider>
    <div className="flex min-h-screen">
      {/* ... existing content ... */}
    </div>
  </WebSocketProvider>
);
```

- [ ] **Step 2: Wrap vendor layout**

Same pattern in `frontend/src/app/vendor/layout.tsx`:

```typescript
import { WebSocketProvider } from "@/contexts/websocket-provider";
```

Wrap with `<WebSocketProvider>`.

- [ ] **Step 3: Wrap admin layout**

Same pattern in `frontend/src/app/admin/layout.tsx`:

```typescript
import { WebSocketProvider } from "@/contexts/websocket-provider";
```

Wrap with `<WebSocketProvider>`.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/app/lender/layout.tsx frontend/src/app/vendor/layout.tsx frontend/src/app/admin/layout.tsx
git commit -m "feat(phase10): wrap portal layouts with WebSocketProvider"
```

---

## Task 20: Add Notification Preferences UI — Lender Settings

**Files:**
- Create: `frontend/src/app/lender/settings/_components/notification-prefs.tsx`
- Modify: `frontend/src/app/lender/settings/page.tsx`

- [ ] **Step 1: Create notification preferences component**

Create `frontend/src/app/lender/settings/_components/notification-prefs.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { NotificationPreferenceItem, NotificationPreferencesResponse } from "@/types/notification-preference";

const EVENT_TYPE_LABELS: Record<string, string> = {
  NEW_BROADCAST: "New broadcast requests",
  REQUEST_ACCEPTED: "Request accepted",
  REVISION_REQUESTED: "Revision requests",
  LISTING_DOWNLOADED: "Listing downloads",
};

export function NotificationPrefs() {
  const [prefs, setPrefs] = useState<NotificationPreferenceItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const res = await api.get<NotificationPreferencesResponse>("/api/notifications/preferences");
        setPrefs(res.preferences);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, []);

  const togglePref = async (eventType: string, currentEnabled: boolean) => {
    const newEnabled = !currentEnabled;
    setPrefs((prev) =>
      prev.map((p) =>
        p.event_type === eventType ? { ...p, enabled: newEnabled } : p
      )
    );
    try {
      await api.patch("/api/notifications/preferences", {
        event_type: eventType,
        enabled: newEnabled,
      });
    } catch {
      setPrefs((prev) =>
        prev.map((p) =>
          p.event_type === eventType ? { ...p, enabled: currentEnabled } : p
        )
      );
    }
  };

  if (loading) {
    return <p className="text-gray-500 text-sm">Loading preferences...</p>;
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Choose which notifications you receive. Disabled notifications will not appear in your notification bell.
      </p>
      <div className="divide-y border rounded-lg">
        {prefs.map((pref) => (
          <div
            key={pref.event_type}
            className="flex items-center justify-between px-4 py-3"
          >
            <span className="text-sm font-medium text-gray-800">
              {EVENT_TYPE_LABELS[pref.event_type] || pref.event_type}
            </span>
            <button
              onClick={() => togglePref(pref.event_type, pref.enabled)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                pref.enabled ? "bg-blue-600" : "bg-gray-300"
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  pref.enabled ? "translate-x-6" : "translate-x-1"
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Add Notifications tab to lender settings page**

In `frontend/src/app/lender/settings/page.tsx`, update the TABS constant to include "notifications":

```typescript
const TABS = [
  { key: "users", label: "Users" },
  { key: "template", label: "Report Template" },
  { key: "notifications", label: "Notifications" },
];
```

Add the import:

```typescript
import { NotificationPrefs } from "./_components/notification-prefs";
```

Add the conditional rendering for the new tab alongside existing tab content:

```tsx
{activeTab === "notifications" && <NotificationPrefs />}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/lender/settings/_components/notification-prefs.tsx frontend/src/app/lender/settings/page.tsx
git commit -m "feat(phase10): add notification preferences tab to lender settings"
```

---

## Task 21: Add Notification Preferences UI — Vendor Settings

**Files:**
- Create: `frontend/src/app/vendor/settings/_components/notification-prefs.tsx`
- Modify: `frontend/src/app/vendor/settings/page.tsx`

- [ ] **Step 1: Create vendor notification preferences component**

Create `frontend/src/app/vendor/settings/_components/notification-prefs.tsx` with the same content as the lender version — copy the file from Task 20 Step 1 exactly. The component is identical since it calls the same API.

- [ ] **Step 2: Convert vendor settings to tab layout**

Replace `frontend/src/app/vendor/settings/page.tsx` with a tabbed layout. The existing content (users table) becomes the "General" tab, and a new "Notifications" tab shows preferences:

```tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { NotificationPrefs } from "./_components/notification-prefs";

interface VendorUser {
  id: string;
  full_name: string;
  email: string;
  mobile: string;
  role: string;
  is_active: boolean;
}

const TABS = [
  { key: "general", label: "General" },
  { key: "notifications", label: "Notifications" },
];

export default function VendorSettingsPage() {
  const [activeTab, setActiveTab] = useState("general");
  const [users, setUsers] = useState<VendorUser[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (activeTab !== "general") return;
    const fetchUsers = async () => {
      setLoading(true);
      try {
        const res = await api.get<VendorUser[]>("/api/vendor/settings/users");
        setUsers(res);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchUsers();
  }, [activeTab]);

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6">Vendor Settings</h1>

      {/* Tabs */}
      <div className="flex border-b mb-6">
        {TABS.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px ${
              activeTab === tab.key
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "general" && (
        <>
          <h2 className="text-lg font-semibold mb-4">Team Members</h2>
          {loading ? (
            <p className="text-gray-500 text-sm">Loading...</p>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm border">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="text-left px-4 py-2 border-b">Name</th>
                      <th className="text-left px-4 py-2 border-b">Email</th>
                      <th className="text-left px-4 py-2 border-b">Mobile</th>
                      <th className="text-left px-4 py-2 border-b">Role</th>
                      <th className="text-left px-4 py-2 border-b">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((u) => (
                      <tr key={u.id} className="border-b">
                        <td className="px-4 py-2">{u.full_name}</td>
                        <td className="px-4 py-2">{u.email}</td>
                        <td className="px-4 py-2">{u.mobile}</td>
                        <td className="px-4 py-2">{u.role}</td>
                        <td className="px-4 py-2">
                          <span
                            className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                              u.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-700"
                            }`}
                          >
                            {u.is_active ? "Active" : "Inactive"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-3">
                {users.map((u) => (
                  <div key={u.id} className="border rounded-lg p-4 space-y-1">
                    <div className="flex justify-between items-start">
                      <p className="font-medium">{u.full_name}</p>
                      <span
                        className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${
                          u.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-red-100 text-red-700"
                        }`}
                      >
                        {u.is_active ? "Active" : "Inactive"}
                      </span>
                    </div>
                    <p className="text-sm text-gray-500">{u.email}</p>
                    <p className="text-sm text-gray-500">{u.mobile}</p>
                    <p className="text-sm text-gray-500">{u.role}</p>
                  </div>
                ))}
              </div>
            </>
          )}

          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-800">
              Reports downloaded by lenders may be rendered in the lender&apos;s custom template format, which includes their branding and field selection. Your original report PDF is always preserved.
            </p>
          </div>
        </>
      )}

      {activeTab === "notifications" && <NotificationPrefs />}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/vendor/settings/_components/notification-prefs.tsx frontend/src/app/vendor/settings/page.tsx
git commit -m "feat(phase10): add notification preferences to vendor settings with tab layout"
```

---

## Task 22: Add Activity Log Tab to Admin Dashboard

**Files:**
- Create: `frontend/src/app/admin/dashboard/_components/activity-tab.tsx`
- Modify: `frontend/src/app/admin/dashboard/page.tsx`

- [ ] **Step 1: Create the activity tab component**

Create `frontend/src/app/admin/dashboard/_components/activity-tab.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ActivityLogEntry, ActivityLogListResponse } from "@/types/activity";

const ACTION_LABELS: Record<string, string> = {
  REQUEST_CREATED: "Request Created",
  REQUEST_ACCEPTED: "Request Accepted",
  REQUEST_REJECTED: "Request Rejected",
  REQUEST_CANCELLED: "Request Cancelled",
  REPORT_UPLOADED: "Report Uploaded",
  REPORT_PUBLISHED: "Report Published",
  REPORT_REVISION_REQUESTED: "Revision Requested",
  REPORT_REVISED: "Report Revised",
  LISTING_CREATED: "Listing Created",
  LISTING_DELISTED: "Listing Delisted",
  LISTING_PURCHASED: "Listing Purchased",
  USER_CREATED: "User Created",
  USER_DEACTIVATED: "User Deactivated",
  USER_LOGIN: "User Login",
  PRICING_RULE_CREATED: "Pricing Rule Created",
  PRICING_RULE_UPDATED: "Pricing Rule Updated",
  TEMPLATE_CREATED: "Template Created",
  TEMPLATE_UPDATED: "Template Updated",
};

const ACTOR_TYPE_COLORS: Record<string, string> = {
  LENDER: "bg-blue-100 text-blue-700",
  VENDOR: "bg-green-100 text-green-700",
  ADMIN: "bg-purple-100 text-purple-700",
  SYSTEM: "bg-gray-100 text-gray-700",
};

export function ActivityTab() {
  const [logs, setLogs] = useState<ActivityLogEntry[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [actionFilter, setActionFilter] = useState("");
  const [actorTypeFilter, setActorTypeFilter] = useState("");
  const [targetTypeFilter, setTargetTypeFilter] = useState("");
  const pageSize = 25;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("page_size", String(pageSize));
      if (actionFilter) params.set("action", actionFilter);
      if (actorTypeFilter) params.set("actor_type", actorTypeFilter);
      if (targetTypeFilter) params.set("target_type", targetTypeFilter);
      const res = await api.get<ActivityLogListResponse>(
        `/api/admin/activity/?${params}`
      );
      setLogs(res.logs);
      setTotal(res.total);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [page, actionFilter, actorTypeFilter, targetTypeFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const exportCsv = () => {
    const params = new URLSearchParams();
    if (actionFilter) params.set("action", actionFilter);
    if (actorTypeFilter) params.set("actor_type", actorTypeFilter);
    if (targetTypeFilter) params.set("target_type", targetTypeFilter);
    const token = localStorage.getItem("access_token");
    window.open(
      `${process.env.NEXT_PUBLIC_API_URL || "http://localhost:8020"}/api/admin/activity/export?${params}&token=${token}`,
      "_blank"
    );
  };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-col sm:flex-row flex-wrap gap-3 mb-4">
        <select
          value={actorTypeFilter}
          onChange={(e) => { setActorTypeFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-40"
        >
          <option value="">All Roles</option>
          <option value="LENDER">Lender</option>
          <option value="VENDOR">Vendor</option>
          <option value="ADMIN">Admin</option>
          <option value="SYSTEM">System</option>
        </select>
        <select
          value={actionFilter}
          onChange={(e) => { setActionFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-52"
        >
          <option value="">All Actions</option>
          <optgroup label="Requests">
            <option value="REQUEST_CREATED">Request Created</option>
            <option value="REQUEST_ACCEPTED">Request Accepted</option>
            <option value="REQUEST_REJECTED">Request Rejected</option>
            <option value="REQUEST_CANCELLED">Request Cancelled</option>
          </optgroup>
          <optgroup label="Reports">
            <option value="REPORT_UPLOADED">Report Uploaded</option>
            <option value="REPORT_PUBLISHED">Report Published</option>
            <option value="REPORT_REVISION_REQUESTED">Revision Requested</option>
            <option value="REPORT_REVISED">Report Revised</option>
          </optgroup>
          <optgroup label="Listings">
            <option value="LISTING_CREATED">Listing Created</option>
            <option value="LISTING_DELISTED">Listing Delisted</option>
            <option value="LISTING_PURCHASED">Listing Purchased</option>
          </optgroup>
          <optgroup label="Users">
            <option value="USER_CREATED">User Created</option>
            <option value="USER_DEACTIVATED">User Deactivated</option>
            <option value="USER_LOGIN">User Login</option>
          </optgroup>
          <optgroup label="Admin">
            <option value="PRICING_RULE_CREATED">Pricing Rule Created</option>
            <option value="PRICING_RULE_UPDATED">Pricing Rule Updated</option>
            <option value="TEMPLATE_CREATED">Template Created</option>
            <option value="TEMPLATE_UPDATED">Template Updated</option>
          </optgroup>
        </select>
        <select
          value={targetTypeFilter}
          onChange={(e) => { setTargetTypeFilter(e.target.value); setPage(1); }}
          className="border rounded px-3 py-2 text-sm w-full sm:w-40"
        >
          <option value="">All Targets</option>
          <option value="REQUEST">Request</option>
          <option value="REPORT">Report</option>
          <option value="LISTING">Listing</option>
          <option value="USER">User</option>
          <option value="PRICING_RULE">Pricing Rule</option>
          <option value="TEMPLATE">Template</option>
        </select>
        <button
          onClick={exportCsv}
          className="px-4 py-2 text-sm bg-gray-100 border rounded hover:bg-gray-200 sm:ml-auto"
        >
          Export CSV
        </button>
      </div>

      {/* Table */}
      {loading ? (
        <p className="text-gray-500 text-sm">Loading activity logs...</p>
      ) : logs.length === 0 ? (
        <p className="text-gray-500 text-sm">No activity logs found.</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm border">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-left px-4 py-2 border-b">Timestamp</th>
                  <th className="text-left px-4 py-2 border-b">User</th>
                  <th className="text-left px-4 py-2 border-b">Action</th>
                  <th className="text-left px-4 py-2 border-b">Target</th>
                  <th className="text-left px-4 py-2 border-b">IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b hover:bg-gray-50">
                    <td className="px-4 py-2 whitespace-nowrap text-gray-500">
                      {formatDate(log.created_at)}
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${ACTOR_TYPE_COLORS[log.actor_type] || "bg-gray-100"}`}>
                          {log.actor_type}
                        </span>
                        <span>{log.actor_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-2">
                      {ACTION_LABELS[log.action] || log.action}
                    </td>
                    <td className="px-4 py-2 text-gray-500">
                      {log.target_type}
                    </td>
                    <td className="px-4 py-2 text-gray-400 text-xs">
                      {log.ip_address || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-3">
            {logs.map((log) => (
              <div key={log.id} className="border rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${ACTOR_TYPE_COLORS[log.actor_type] || "bg-gray-100"}`}>
                    {log.actor_type}
                  </span>
                  <span className="text-xs text-gray-400">
                    {formatDate(log.created_at)}
                  </span>
                </div>
                <p className="text-sm font-medium">{log.actor_name}</p>
                <p className="text-sm text-gray-600">
                  {ACTION_LABELS[log.action] || log.action} — {log.target_type}
                </p>
              </div>
            ))}
          </div>

          {/* Pagination */}
          {total > pageSize && (
            <div className="flex justify-center gap-2 mt-4">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              >
                Previous
              </button>
              <span className="px-3 py-2 text-sm text-gray-500">
                Page {page} of {Math.ceil(total / pageSize)}
              </span>
              <button
                onClick={() => setPage((p) => p + 1)}
                disabled={page * pageSize >= total}
                className="px-3 py-2 border rounded text-sm disabled:opacity-50"
              >
                Next
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add Activity tab to admin dashboard**

In `frontend/src/app/admin/dashboard/page.tsx`, update the TABS array to include "activity":

```typescript
const TABS = [
  { key: "stats", label: "Stats" },
  { key: "vendors", label: "Vendors" },
  { key: "lenders", label: "Lenders" },
  { key: "reports", label: "Reports" },
  { key: "open-requests", label: "Open Requests" },
  { key: "activity", label: "Activity" },
];
```

Add the import:

```typescript
import { ActivityTab } from "./_components/activity-tab";
```

Add conditional rendering for the new tab:

```tsx
{activeTab === "activity" && <ActivityTab />}
```

- [ ] **Step 3: Commit**

```bash
git add frontend/src/app/admin/dashboard/_components/activity-tab.tsx frontend/src/app/admin/dashboard/page.tsx
git commit -m "feat(phase10): add activity log tab to admin dashboard"
```

---

## Task 23: Update CLAUDE.md with Phase 10 Completion Status

**Files:**
- Modify: `CLAUDE.md`

- [ ] **Step 1: Update the Current Status section**

Add Phase 10 entry after the Phase 9 line in the Current Status section of `CLAUDE.md`:

```markdown
**Phase 10 (Notifications & Real-Time):** Complete — Native FastAPI WebSocket with Redis pub/sub for real-time notification delivery, WebSocket connection manager with auto-reconnect and heartbeat, notification preferences (per-event-type opt-out toggles in lender/vendor settings), ActivityLog model with 18 action types, activity log service with admin API (list + CSV export), admin dashboard Activity tab with filters, WebSocketProvider React context wrapping all portal layouts, polling fallback reduced to 60s
```

Also add to the Key Files section:

```markdown
- `backend/app/core/ws_manager.py` — WebSocket connection manager + Redis pub/sub
- `backend/app/api/ws_notifications.py` — WebSocket notification endpoint
- `backend/app/models/activity_log.py` — ActivityLog model (audit trail)
- `backend/app/services/activity_log_service.py` — Activity log write + query
- `backend/app/services/notification_preference_service.py` — Preference CRUD
- `backend/app/api/admin/activity.py` — Admin activity log API + CSV export
- `frontend/src/contexts/websocket-provider.tsx` — WebSocket context provider
```

- [ ] **Step 2: Commit**

```bash
git add CLAUDE.md
git commit -m "feat(phase10): update CLAUDE.md with Phase 10 completion status"
```
