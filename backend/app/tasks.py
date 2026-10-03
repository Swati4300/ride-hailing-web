import logging
from datetime import datetime, timedelta, timezone
from sqlalchemy.orm import Session
from app.models import Driver, DriverStatus, RideRequest, RideStatus, utc_now
from app.config import settings

logger = logging.getLogger("background_tasks")


def auto_cancel_stale_rides(db: Session) -> int:
    """
    Cancels ride requests that have remained in 'requested' state 
    longer than STALE_RIDE_TIMEOUT_SECONDS without finding a driver.
    """
    cutoff_time = utc_now() - timedelta(seconds=settings.STALE_RIDE_TIMEOUT_SECONDS)
    stale_rides = db.query(RideRequest).filter(
        RideRequest.status == RideStatus.REQUESTED,
        RideRequest.created_at <= cutoff_time
    ).all()

    cancelled_count = 0
    for ride in stale_rides:
        ride.status = RideStatus.CANCELLED
        ride.updated_at = utc_now()
        cancelled_count += 1

    if cancelled_count > 0:
        db.commit()
        logger.info(f"Auto-cancelled {cancelled_count} stale ride request(s).")
    return cancelled_count


def sweep_offline_drivers(db: Session) -> int:
    """
    Marks drivers 'offline' if they haven't sent a location heartbeat
    in longer than DRIVER_OFFLINE_TIMEOUT_SECONDS.
    """
    cutoff_time = utc_now() - timedelta(seconds=settings.DRIVER_OFFLINE_TIMEOUT_SECONDS)
    inactive_drivers = db.query(Driver).filter(
        Driver.status == DriverStatus.AVAILABLE,
        Driver.last_updated_at <= cutoff_time
    ).all()

    offline_count = 0
    for driver in inactive_drivers:
        driver.status = DriverStatus.OFFLINE
        offline_count += 1

    if offline_count > 0:
        db.commit()
        logger.info(f"Marked {offline_count} inactive driver(s) as offline.")
    return offline_count
