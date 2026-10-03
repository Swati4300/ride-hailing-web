import logging
from typing import Optional, Tuple
from sqlalchemy.orm import Session
from app.models import Driver, DriverStatus, RideRequest, RideStatus, utc_now
from app.geohash import encode_geohash, get_adjacent_geohashes, haversine_distance
from app.lock import LockManager
from app.state_machine import validate_transition

logger = logging.getLogger("matching_engine")


def find_and_assign_driver(
    db: Session, 
    ride: RideRequest
) -> Tuple[Optional[Driver], Optional[float], str]:
    """
    Core Dispatch Engine:
    1. Geohash bucketing: Calculates pickup geohash & adjacent grid cells to narrow search space.
    2. Haversine distance calculation to candidate drivers.
    3. Distributed Locking (Redis SETNX / process lock) to prevent race conditions & double bookings.
    """
    pickup_hash = encode_geohash(ride.pickup_lat, ride.pickup_lng, precision=6)
    neighbor_hashes = get_adjacent_geohashes(pickup_hash)

    # 1. Query available drivers in candidate geohash cells
    candidate_drivers = db.query(Driver).filter(
        Driver.status == DriverStatus.AVAILABLE,
        Driver.geohash.in_(neighbor_hashes)
    ).all()

    # Fallback to all available drivers if grid bucket is empty
    if not candidate_drivers:
        candidate_drivers = db.query(Driver).filter(
            Driver.status == DriverStatus.AVAILABLE
        ).all()

    if not candidate_drivers:
        return None, None, "No available drivers nearby."

    # 2. Rank candidate drivers by Haversine distance
    driver_distances = []
    for driver in candidate_drivers:
        dist = haversine_distance(
            ride.pickup_lat, ride.pickup_lng, 
            driver.current_lat, driver.current_lng
        )
        driver_distances.append((dist, driver))

    driver_distances.sort(key=lambda x: x[0])

    # 3. Attempt lock and match on nearest available driver
    for dist, driver in driver_distances:
        lock_key = f"driver_lock:{driver.id}"
        token = LockManager.acquire_lock(lock_key, ttl_seconds=30)

        if not token:
            logger.info(f"Driver {driver.id} lock contention. Trying next nearest driver.")
            continue

        try:
            # Refresh driver state inside lock
            db.refresh(driver)
            if driver.status != DriverStatus.AVAILABLE:
                LockManager.release_lock(lock_key, token)
                continue

            # Validate state transition
            validate_transition(ride.status, RideStatus.MATCHED)

            # Update Driver & Ride Request
            driver.status = DriverStatus.BUSY
            driver.last_updated_at = utc_now()

            ride.status = RideStatus.MATCHED
            ride.matched_driver_id = driver.id
            ride.updated_at = utc_now()

            db.commit()
            db.refresh(ride)
            db.refresh(driver)

            # Release lock after assignment
            LockManager.release_lock(lock_key, token)
            return driver, round(dist, 2), "Successfully matched nearest available driver."

        except Exception as e:
            db.rollback()
            LockManager.release_lock(lock_key, token)
            logger.error(f"Error matching driver {driver.id}: {e}")

    return None, None, "All candidate drivers are currently busy or locked by competing requests."
