import asyncio
import os
import logging
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, JSONResponse, RedirectResponse

from app.config import settings
from app.database import init_db, SessionLocal
from app.routers import drivers, rides, auth, admin, tracking
from app.tasks import auto_cancel_stale_rides, sweep_offline_drivers

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("ride_matching_engine")


async def periodic_background_worker():
    """Background task loop running stale ride cancellation & offline sweeps."""
    while True:
        try:
            db = SessionLocal()
            try:
                auto_cancel_stale_rides(db)
                sweep_offline_drivers(db)
            finally:
                db.close()
        except Exception as e:
            logger.error(f"Error in background worker: {e}")
        await asyncio.sleep(30)  # Sweep every 30 seconds


@asynccontextmanager
async def lifespan(app: FastAPI):
    """App lifespan context manager for startup and shutdown events."""
    logger.info("Initializing database schema...")
    init_db()
    
    # Start periodic background cleanup worker task
    task = asyncio.create_task(periodic_background_worker())
    
    yield
    
    task.cancel()
    logger.info("Application shutting down.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="High-Concurrency Backend Ride-Matching Engine featuring Geohashing, Distributed Locks, FSM, and FastAPI.",
    lifespan=lifespan
)

# Enable CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Routers
app.include_router(auth.router)
app.include_router(admin.router)
app.include_router(drivers.router)
app.include_router(rides.router)
app.include_router(tracking.router)


@app.get("/", include_in_schema=False)
def root_redirect():
    """Redirect root path to visualizer dashboard."""
    return RedirectResponse(url="/dashboard/index.html")


@app.get("/health", tags=["Health"])
def health_check():
    """System health check endpoint."""
    return {"status": "ok", "project": settings.PROJECT_NAME, "version": settings.VERSION}


# Robustly find frontend directory path
possible_paths = [
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "frontend")),  # d:\project1\frontend
    os.path.abspath(os.path.join(os.getcwd(), "frontend")),                            # current working dir
    os.path.abspath(os.path.join(os.getcwd(), "..", "frontend")),                       # parent of working dir
    "/frontend"                                                                        # Docker volume mount
]

frontend_path = None
for path in possible_paths:
    if os.path.exists(path) and os.path.isdir(path):
        frontend_path = path
        break

if frontend_path:
    logger.info(f"Mounting static visualizer dashboard from: {frontend_path}")
    app.mount("/dashboard", StaticFiles(directory=frontend_path, html=True), name="dashboard")
else:
    logger.warning("Frontend directory not found. Visualizer dashboard will not be served.")


