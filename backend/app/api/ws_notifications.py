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
