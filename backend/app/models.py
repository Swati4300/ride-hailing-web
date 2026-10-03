import enum
from datetime import datetime, timezone
from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, Enum as SQLEnum, Index
from sqlalchemy.orm import relationship
from app.database import Base


class UserRole(str, enum.Enum):
    RIDER = "rider"
    DRIVER = "driver"
    ADMIN = "admin"


class DriverStatus(str, enum.Enum):
    AVAILABLE = "available"
    BUSY = "busy"
    OFFLINE = "offline"


class RideStatus(str, enum.Enum):
    REQUESTED = "requested"
    MATCHED = "matched"
    ACCEPTED = "accepted"
    ARRIVED = "arrived"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    CANCELLED = "cancelled"


def utc_now():
    return datetime.now(timezone.utc)


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(100), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    role = Column(SQLEnum(UserRole), default=UserRole.RIDER, nullable=False, index=True)
    driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    rider_id = Column(String(100), nullable=True)
    created_at = Column(DateTime(timezone=True), default=utc_now)

    driver = relationship("Driver", back_populates="user_account")


class Driver(Base):
    __tablename__ = "drivers"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    current_lat = Column(Float, nullable=False)
    current_lng = Column(Float, nullable=False)
    status = Column(SQLEnum(DriverStatus), default=DriverStatus.OFFLINE, nullable=False, index=True)
    geohash = Column(String(12), nullable=True, index=True)
    
    # Vehicle & Verification attributes
    vehicle_type = Column(String(50), default="bike", nullable=False) # bike, auto, cab_mini, cab_sedan
    vehicle_no = Column(String(50), default="MH-12-UB-1001", nullable=True)
    license_no = Column(String(50), default="DL-82910384", nullable=True)
    is_verified = Column(Integer, default=1, nullable=False) # 1 = Verified, 0 = Pending
    rating = Column(Float, default=4.8, nullable=False)
    rating_count = Column(Integer, default=24, nullable=False)
    
    last_updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    user_account = relationship("User", back_populates="driver", uselist=False)
    rides = relationship("RideRequest", back_populates="matched_driver")


class RideRequest(Base):
    __tablename__ = "ride_requests"

    id = Column(Integer, primary_key=True, index=True)
    rider_id = Column(String(100), nullable=False, index=True)
    pickup_lat = Column(Float, nullable=False)
    pickup_lng = Column(Float, nullable=False)
    dropoff_lat = Column(Float, nullable=True)
    dropoff_lng = Column(Float, nullable=True)
    status = Column(SQLEnum(RideStatus), default=RideStatus.REQUESTED, nullable=False, index=True)
    matched_driver_id = Column(Integer, ForeignKey("drivers.id"), nullable=True)
    
    # Uber booking & ride attributes
    vehicle_type = Column(String(50), default="bike", nullable=False)
    payment_method = Column(String(20), default="upi", nullable=False) # upi, card, cash
    otp = Column(String(10), nullable=True) # 4-digit OTP
    fare_amount = Column(Float, default=50.0, nullable=False)
    surge_factor = Column(Float, default=1.0, nullable=False)
    distance_km = Column(Float, default=2.5, nullable=False)
    duration_min = Column(Float, default=8.0, nullable=False)
    driver_earnings = Column(Float, default=40.0, nullable=False)
    platform_fee = Column(Float, default=10.0, nullable=False)
    payment_status = Column(String(20), default="pending", nullable=False) # pending, paid
    rider_rating = Column(Integer, nullable=True)
    driver_rating = Column(Integer, nullable=True)
    review_text = Column(String(255), nullable=True)
    
    created_at = Column(DateTime(timezone=True), default=utc_now)
    updated_at = Column(DateTime(timezone=True), default=utc_now, onupdate=utc_now)

    matched_driver = relationship("Driver", back_populates="rides")


class RideHistory(Base):
    __tablename__ = "ride_history"

    id = Column(Integer, primary_key=True, index=True)
    ride_id = Column(Integer, ForeignKey("ride_requests.id"), nullable=False)
    driver_id = Column(Integer, nullable=False)
    rider_id = Column(String(100), nullable=False)
    distance_km = Column(Float, nullable=False)
    fare_amount = Column(Float, default=0.0, nullable=False)
    driver_earnings = Column(Float, default=0.0, nullable=False)
    platform_fee = Column(Float, default=0.0, nullable=False)
    payment_method = Column(String(20), default="upi", nullable=False)
    matched_at = Column(DateTime(timezone=True), nullable=False)
    completed_at = Column(DateTime(timezone=True), default=utc_now)
    wait_time_seconds = Column(Float, nullable=False)

