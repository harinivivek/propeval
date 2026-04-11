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
