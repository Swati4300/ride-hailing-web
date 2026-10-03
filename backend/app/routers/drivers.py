from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Driver, DriverStatus, RideRequest, RideStatus, User, utc_now
from app.schemas import DriverCreate, DriverLocationUpdate, DriverResponse, RideResponse
from app.geohash import encode_geohash
from app.auth import get_current_user

router = APIRouter(prefix="/drivers", tags=["Drivers"])


@router.post("", response_model=DriverResponse, status_code=status.HTTP_201_CREATED)
def create_driver(driver_in: DriverCreate, db: Session = Depends(get_db)):
    """Register a new driver."""
    gh = encode_geohash(driver_in.current_lat, driver_in.current_lng)
    driver = Driver(
        name=driver_in.name,
        current_lat=driver_in.current_lat,
        current_lng=driver_in.current_lng,
        status=DriverStatus.AVAILABLE,
        geohash=gh,
        last_updated_at=utc_now()
    )
    db.add(driver)
    db.commit()
    db.refresh(driver)
    return driver


@router.get("", response_model=List[DriverResponse])
def list_drivers(
    status_filter: Optional[DriverStatus] = None, 
    db: Session = Depends(get_db)
):
    """List drivers with optional status filtering."""
    query = db.query(Driver)
    if status_filter:
        query = query.filter(Driver.status == status_filter)
    return query.all()


@router.get("/my_assignment", response_model=Optional[RideResponse])
def get_driver_assignment(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Retrieves the currently assigned active ride for the authenticated Driver."""
    driver_id = current_user.driver_id
    if not driver_id:
        d = db.query(Driver).filter(Driver.name == current_user.username).first()
        if d:
            driver_id = d.id
            current_user.driver_id = d.id
            db.commit()

    if not driver_id:
        return None

    ride = db.query(RideRequest).filter(
        RideRequest.matched_driver_id == driver_id,
        RideRequest.status.in_([RideStatus.MATCHED, RideStatus.IN_PROGRESS])
    ).first()
    return ride


@router.post("/toggle_status", response_model=DriverResponse)
def toggle_driver_status(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Toggles driver status between AVAILABLE and OFFLINE."""
    driver = None
    if current_user.driver_id:
        driver = db.query(Driver).filter(Driver.id == current_user.driver_id).first()

    if not driver:
        # Fallback query by username
        driver = db.query(Driver).filter(Driver.name == current_user.username).first()

    if not driver:
        # Auto-create driver profile for authenticated driver account
        driver = Driver(
            name=current_user.username,
            current_lat=18.5204,
            current_lng=73.8567,
            status=DriverStatus.AVAILABLE,
            geohash=encode_geohash(18.5204, 73.8567),
            last_updated_at=utc_now()
        )
        db.add(driver)
        db.flush()
        current_user.driver_id = driver.id
        db.commit()
        db.refresh(driver)
        return driver
    else:
        if not current_user.driver_id:
            current_user.driver_id = driver.id
            db.commit()

    if driver.status == DriverStatus.AVAILABLE:
        driver.status = DriverStatus.OFFLINE
    else:
        driver.status = DriverStatus.AVAILABLE

    driver.last_updated_at = utc_now()
    db.commit()
    db.refresh(driver)
    return driver


@router.get("/{driver_id}", response_model=DriverResponse)
def get_driver(driver_id: int, db: Session = Depends(get_db)):
    """Fetch driver details by ID."""
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")
    return driver


@router.post("/{driver_id}/location", response_model=DriverResponse)
def update_driver_location(
    driver_id: int, 
    location_in: DriverLocationUpdate, 
    db: Session = Depends(get_db)
):
    """
    Driver heartbeat endpoint: updates driver's current coordinates, 
    re-encodes spatial geohash, and updates status.
    """
    driver = db.query(Driver).filter(Driver.id == driver_id).first()
    if not driver:
        raise HTTPException(status_code=404, detail="Driver not found")

    driver.current_lat = location_in.lat
    driver.current_lng = location_in.lng
    driver.geohash = encode_geohash(location_in.lat, location_in.lng)
    driver.last_updated_at = utc_now()

    if location_in.status:
        driver.status = location_in.status

    db.commit()
    db.refresh(driver)
    return driver
