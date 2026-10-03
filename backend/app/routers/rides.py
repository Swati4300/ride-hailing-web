import random
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import Driver, DriverStatus, RideHistory, RideRequest, RideStatus, User, UserRole, utc_now
from app.schemas import (
    FareCategoryEstimate, FareEstimateRequest, FareEstimateResponse,
    OTPVerifyRequest, PaymentRequest, RatingRequest, RideCreate,
    RideHistoryResponse, RideMatchResult, RideResponse
)
from app.matching import find_and_assign_driver
from app.state_machine import InvalidStateTransitionError, validate_transition
from app.geohash import haversine_distance
from app.auth import get_current_user

router = APIRouter(prefix="/rides", tags=["Rides"])


def calculate_category_fare(vehicle_type: str, dist_km: float, dur_mins: float, surge: float = 1.0) -> float:
    """Calculates fare for a given vehicle type based on distance, duration, and surge."""
    configs = {
        "bike": {"base": 25.0, "per_km": 10.0, "per_min": 1.5},
        "auto": {"base": 40.0, "per_km": 14.0, "per_min": 2.0},
        "cab_mini": {"base": 70.0, "per_km": 18.0, "per_min": 2.5},
        "cab_sedan": {"base": 110.0, "per_km": 24.0, "per_min": 3.5},
    }
    cfg = configs.get(vehicle_type, configs["bike"])
    raw_fare = cfg["base"] + (dist_km * cfg["per_km"]) + (dur_mins * cfg["per_min"])
    final_fare = round(raw_fare * surge, 0)
    return max(final_fare, cfg["base"])


@router.post("/estimate", response_model=FareEstimateResponse)
def estimate_fares(req: FareEstimateRequest, db: Session = Depends(get_db)):
    """Calculate distance, duration, and dynamic fare options across vehicle types."""
    dist_km = haversine_distance(req.pickup_lat, req.pickup_lng, req.dropoff_lat, req.dropoff_lng)
    dist_km = max(round(dist_km, 2), 0.8) # Min 0.8 km
    dur_mins = round(dist_km * 3.5, 0)  # ~17 km/h avg city speed
    dur_mins = max(dur_mins, 3.0)

    # Dynamic Surge calculation based on requested rides in system
    active_requests = db.query(RideRequest).filter(RideRequest.status == RideStatus.REQUESTED).count()
    surge_factor = 1.0
    if active_requests > 3:
        surge_factor = 1.2
    elif active_requests > 6:
        surge_factor = 1.5

    categories = [
        {
            "category_id": "bike",
            "title": "Rapido Bike",
            "fare": calculate_category_fare("bike", dist_km, dur_mins, surge_factor),
            "eta_mins": 2,
            "capacity": "1 seat",
            "icon": "🏍️"
        },
        {
            "category_id": "auto",
            "title": "Uber Auto",
            "fare": calculate_category_fare("auto", dist_km, dur_mins, surge_factor),
            "eta_mins": 4,
            "capacity": "3 seats",
            "icon": "🛺"
        },
        {
            "category_id": "cab_mini",
            "title": "Uber Go Mini",
            "fare": calculate_category_fare("cab_mini", dist_km, dur_mins, surge_factor),
            "eta_mins": 5,
            "capacity": "4 seats",
            "icon": "🚗"
        },
        {
            "category_id": "cab_sedan",
            "title": "Uber Premier Sedan",
            "fare": calculate_category_fare("cab_sedan", dist_km, dur_mins, surge_factor),
            "eta_mins": 6,
            "capacity": "4 seats",
            "icon": "🚘"
        },
    ]

    estimates = [
        FareCategoryEstimate(
            category_id=c["category_id"],
            title=c["title"],
            fare=c["fare"],
            eta_mins=c["eta_mins"],
            distance_km=dist_km,
            duration_min=dur_mins,
            surge_factor=surge_factor,
            capacity=c["capacity"],
            icon=c["icon"]
        )
        for c in categories
    ]

    return FareEstimateResponse(
        distance_km=dist_km,
        duration_min=dur_mins,
        surge_factor=surge_factor,
        estimates=estimates
    )


@router.get("", response_model=List[RideResponse])
def list_all_rides(
    status_filter: Optional[RideStatus] = None,
    db: Session = Depends(get_db)
):
    """List all ride requests in the system."""
    query = db.query(RideRequest)
    if status_filter:
        query = query.filter(RideRequest.status == status_filter)
    return query.order_by(RideRequest.created_at.desc()).all()


@router.post("/request", response_model=RideMatchResult, status_code=status.HTTP_201_CREATED)
def request_ride(
    ride_in: RideCreate, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """
    Rider creates a ride request.
    Generates 4-digit OTP, calculates fare & commission, and matches nearby driver.
    """
    rider_id = ride_in.rider_id
    if current_user:
        rider_id = current_user.rider_id or f"Rider_{current_user.username}"
    elif not rider_id:
        rider_id = "Rider_Guest"

    drop_lat = ride_in.dropoff_lat or (ride_in.pickup_lat + 0.02)
    drop_lng = ride_in.dropoff_lng or (ride_in.pickup_lng + 0.02)
    
    dist_km = max(round(haversine_distance(ride_in.pickup_lat, ride_in.pickup_lng, drop_lat, drop_lng), 2), 0.8)
    dur_mins = max(round(dist_km * 3.5, 0), 3.0)

    v_type = ride_in.vehicle_type or "bike"
    fare = calculate_category_fare(v_type, dist_km, dur_mins, 1.0)
    driver_earnings = round(fare * 0.80, 2)
    platform_fee = round(fare * 0.20, 2)
    otp_code = str(random.randint(1000, 9999))

    ride = RideRequest(
        rider_id=rider_id,
        pickup_lat=ride_in.pickup_lat,
        pickup_lng=ride_in.pickup_lng,
        dropoff_lat=drop_lat,
        dropoff_lng=drop_lng,
        vehicle_type=v_type,
        payment_method=ride_in.payment_method or "upi",
        otp=otp_code,
        fare_amount=fare,
        surge_factor=1.0,
        distance_km=dist_km,
        duration_min=dur_mins,
        driver_earnings=driver_earnings,
        platform_fee=platform_fee,
        payment_status="pending",
        status=RideStatus.REQUESTED,
        created_at=utc_now(),
        updated_at=utc_now()
    )
    db.add(ride)
    db.commit()
    db.refresh(ride)

    matched_driver, dist_km_driver, msg = find_and_assign_driver(db, ride)

    return RideMatchResult(
        ride=ride,
        matched_driver=matched_driver,
        distance_km=dist_km_driver,
        message=msg
    )


@router.get("/my_rides", response_model=List[RideResponse])
def get_my_rides(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Get active and past ride requests for the currently logged-in Rider."""
    rider_id = current_user.rider_id or f"Rider_{current_user.username}"
    rides = db.query(RideRequest).filter(RideRequest.rider_id == rider_id).order_by(RideRequest.created_at.desc()).all()
    return rides


@router.get("/{ride_id}", response_model=RideResponse)
def get_ride(ride_id: int, db: Session = Depends(get_db)):
    """Poll current status of a ride."""
    ride = db.query(RideRequest).filter(RideRequest.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride request not found")
    return ride


@router.post("/{ride_id}/accept", response_model=RideResponse)
def accept_ride(
    ride_id: int, 
    db: Session = Depends(get_db),
    current_user: Optional[User] = Depends(get_current_user)
):
    """Driver accepts an assigned ride request."""
    ride = db.query(RideRequest).filter(RideRequest.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride request not found")

    driver_id = None
    if current_user and current_user.driver_id:
        driver_id = current_user.driver_id
    elif ride.matched_driver_id:
        driver_id = ride.matched_driver_id

    if not driver_id:
        # Fallback first available driver
        available_driver = db.query(Driver).filter(Driver.status == DriverStatus.AVAILABLE).first()
        if available_driver:
            driver_id = available_driver.id

    if driver_id:
        ride.matched_driver_id = driver_id
        driver = db.query(Driver).filter(Driver.id == driver_id).first()
        if driver:
            driver.status = DriverStatus.BUSY
            driver.last_updated_at = utc_now()

    ride.status = RideStatus.ACCEPTED
    ride.updated_at = utc_now()
    db.commit()
    db.refresh(ride)
    return ride


@router.post("/{ride_id}/arrive", response_model=RideResponse)
def driver_arrive(ride_id: int, db: Session = Depends(get_db)):
    """Driver signals arrival at pickup location."""
    ride = db.query(RideRequest).filter(RideRequest.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride request not found")

    ride.status = RideStatus.ARRIVED
    ride.updated_at = utc_now()
    db.commit()
    db.refresh(ride)
    return ride


@router.post("/{ride_id}/verify_otp", response_model=RideResponse)
def verify_otp_and_start(
    ride_id: int, 
    otp_in: OTPVerifyRequest, 
    db: Session = Depends(get_db)
):
    """Verifies rider 4-digit OTP and transitions ride to IN_PROGRESS."""
    ride = db.query(RideRequest).filter(RideRequest.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride request not found")

    if ride.otp and otp_in.otp.strip() != ride.otp.strip():
        raise HTTPException(status_code=400, detail=f"Invalid OTP entered ({otp_in.otp}). Correct OTP is required.")

    ride.status = RideStatus.IN_PROGRESS
    ride.updated_at = utc_now()
    db.commit()
    db.refresh(ride)
    return ride


@router.post("/{ride_id}/start", response_model=RideResponse)
def start_ride(ride_id: int, db: Session = Depends(get_db)):
    """Transitions a ride directly to IN_PROGRESS."""
    ride = db.query(RideRequest).filter(RideRequest.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride request not found")

    ride.status = RideStatus.IN_PROGRESS
    ride.updated_at = utc_now()
    db.commit()
    db.refresh(ride)
    return ride


@router.post("/{ride_id}/complete", response_model=RideHistoryResponse)
def complete_ride(ride_id: int, db: Session = Depends(get_db)):
    """
    Transitions a ride to COMPLETED.
    Releases driver back to AVAILABLE, logs earnings/platform fee to RideHistory.
    """
    ride = db.query(RideRequest).filter(RideRequest.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride request not found")

    now = utc_now()
    ride.status = RideStatus.COMPLETED
    ride.updated_at = now

    dropoff_lat = ride.dropoff_lat or ride.pickup_lat
    dropoff_lng = ride.dropoff_lng or ride.pickup_lng
    dist_km = haversine_distance(ride.pickup_lat, ride.pickup_lng, dropoff_lat, dropoff_lng)

    t_start = ride.created_at.replace(tzinfo=None) if ride.created_at else now.replace(tzinfo=None)
    t_end = now.replace(tzinfo=None)
    wait_time_sec = abs((t_end - t_start).total_seconds())

    if ride.matched_driver_id:
        driver = db.query(Driver).filter(Driver.id == ride.matched_driver_id).first()
        if driver:
            driver.status = DriverStatus.AVAILABLE
            driver.last_updated_at = now

    history = RideHistory(
        ride_id=ride.id,
        driver_id=ride.matched_driver_id or 0,
        rider_id=ride.rider_id,
        distance_km=round(dist_km, 2),
        fare_amount=ride.fare_amount,
        driver_earnings=ride.driver_earnings,
        platform_fee=ride.platform_fee,
        payment_method=ride.payment_method,
        matched_at=ride.updated_at,
        completed_at=now,
        wait_time_seconds=round(wait_time_sec, 2)
    )
    db.add(history)
    db.commit()
    db.refresh(history)

    return history


@router.post("/{ride_id}/pay", response_model=RideResponse)
def process_ride_payment(
    ride_id: int, 
    pay_in: PaymentRequest, 
    db: Session = Depends(get_db)
):
    """Processes digital payment (UPI / Card / Cash) and marks ride as paid."""
    ride = db.query(RideRequest).filter(RideRequest.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride request not found")

    ride.payment_method = pay_in.payment_method
    ride.payment_status = "paid"
    ride.updated_at = utc_now()
    db.commit()
    db.refresh(ride)
    return ride


@router.post("/{ride_id}/rate", response_model=RideResponse)
def rate_ride(
    ride_id: int, 
    rate_in: RatingRequest, 
    db: Session = Depends(get_db)
):
    """Submits star rating & optional review for driver."""
    ride = db.query(RideRequest).filter(RideRequest.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride request not found")

    ride.driver_rating = rate_in.rating
    ride.review_text = rate_in.review_text

    if ride.matched_driver_id:
        driver = db.query(Driver).filter(Driver.id == ride.matched_driver_id).first()
        if driver:
            # Recompute weighted average rating
            total_score = (driver.rating * driver.rating_count) + rate_in.rating
            driver.rating_count += 1
            driver.rating = round(total_score / driver.rating_count, 1)

    db.commit()
    db.refresh(ride)
    return ride


@router.post("/{ride_id}/cancel", response_model=RideResponse)
def cancel_ride(ride_id: int, db: Session = Depends(get_db)):
    """Cancels a ride request and releases driver if assigned."""
    ride = db.query(RideRequest).filter(RideRequest.id == ride_id).first()
    if not ride:
        raise HTTPException(status_code=404, detail="Ride request not found")

    now = utc_now()
    ride.status = RideStatus.CANCELLED
    ride.updated_at = now

    if ride.matched_driver_id:
        driver = db.query(Driver).filter(Driver.id == ride.matched_driver_id).first()
        if driver and driver.status == DriverStatus.BUSY:
            driver.status = DriverStatus.AVAILABLE
            driver.last_updated_at = now

    db.commit()
    db.refresh(ride)
    return ride
