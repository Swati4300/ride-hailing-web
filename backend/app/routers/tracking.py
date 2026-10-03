import json
import logging
from typing import Dict, List
from fastapi import APIRouter, WebSocket, WebSocketDisconnect

logger = logging.getLogger("tracking")

router = APIRouter(tags=["Tracking"])

# Active WebSocket connections per ride_id
active_connections: Dict[int, List[WebSocket]] = {}


class ConnectionManager:
    @staticmethod
    async def connect(ride_id: int, websocket: WebSocket):
        await websocket.accept()
        if ride_id not in active_connections:
            active_connections[ride_id] = []
        active_connections[ride_id].append(websocket)
        logger.info(f"Client connected to ride {ride_id} tracking stream.")

    @staticmethod
    def disconnect(ride_id: int, websocket: WebSocket):
        if ride_id in active_connections:
            if websocket in active_connections[ride_id]:
                active_connections[ride_id].remove(websocket)
            if not active_connections[ride_id]:
                del active_connections[ride_id]

    @staticmethod
    async def broadcast(ride_id: int, message: dict):
        if ride_id in active_connections:
            for connection in list(active_connections[ride_id]):
                try:
                    await connection.send_json(message)
                except Exception as e:
                    logger.error(f"Error broadcasting WebSocket message: {e}")


manager = ConnectionManager()


@router.websocket("/ws/ride/{ride_id}")
async def ride_tracking_websocket(websocket: WebSocket, ride_id: int):
    """
    WebSocket endpoint for real-time GPS tracking of driver position on rider's map screen.
    """
    await manager.connect(ride_id, websocket)
    try:
        while True:
            # Receive GPS location payload from driver app
            data = await websocket.receive_text()
            payload = json.loads(data)
            
            # Broadcast to all connected clients listening on ride_id
            await manager.broadcast(ride_id, payload)
    except WebSocketDisconnect:
        manager.disconnect(ride_id, websocket)
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        manager.disconnect(ride_id, websocket)
