from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, ConfigDict, Field, EmailStr
from app.models import DriverStatus, RideStatus, UserRole


# User & Auth Schemas
class UserRegister(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    email: str
    password: str = Field(..., min_length=4)
    role: UserRole = UserRole.RIDER
    license_no: Optional[str] = None
    vehicle_no: Optional[str] = None
    vehicle_type: Optional[str] = "bike"


class UserLogin(BaseModel):
    username: str
    password: str


class UserResponse(BaseModel):
    id: int
    username: str
    email: str
    role: UserRole
    driver_id: Optional[int] = None
    rider_id: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse


# Driver Schemas
class DriverCreate(BaseModel):
    name: str
    current_lat: float = Field(..., ge=-90.0, le=90.0)
    current_lng: float = Field(..., ge=-180.0, le=180.0)
    vehicle_type: Optional[str] = "bike"
    vehicle_no: Optional[str] = "MH-12-UB-1001"
    license_no: Optional[str] = "DL-82910384"


class DriverLocationUpdate(BaseModel):
    lat: float = Field(..., ge=-90.0, le=90.0)
    lng: float = Field(..., ge=-180.0, le=180.0)
    status: Optional[DriverStatus] = None


class DriverResponse(BaseModel):
    id: int
    name: str
    current_lat: float
    current_lng: float
    status: DriverStatus
    geohash: Optional[str] = None
    vehicle_type: Optional[str] = "bike"
    vehicle_no: Optional[str] = "MH-12-UB-1001"
    license_no: Optional[str] = "DL-82910384"
    is_verified: Optional[int] = 1
    rating: Optional[float] = 4.8
    rating_count: Optional[int] = 24
    last_updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# Fare Estimation Schemas
class FareEstimateRequest(BaseModel):
    pickup_lat: float = Field(..., ge=-90.0, le=90.0)
    pickup_lng: float = Field(..., ge=-180.0, le=180.0)
    dropoff_lat: float = Field(..., ge=-90.0, le=90.0)
    dropoff_lng: float = Field(..., ge=-180.0, le=180.0)


class FareCategoryEstimate(BaseModel):
    category_id: str # bike, auto, cab_mini, cab_sedan
    title: str       # e.g. "Rapido Bike", "Uber Auto", "Uber Go"
    fare: float
    eta_mins: int
    distance_km: float
    duration_min: float
    surge_factor: float
    capacity: str
    icon: str


class FareEstimateResponse(BaseModel):
    distance_km: float
    duration_min: float
    surge_factor: float
    estimates: List[FareCategoryEstimate]


# Ride Request Schemas
class RideCreate(BaseModel):
    rider_id: Optional[str] = None
    pickup_lat: float = Field(..., ge=-90.0, le=90.0)
    pickup_lng: float = Field(..., ge=-180.0, le=180.0)
    dropoff_lat: Optional[float] = Field(None, ge=-90.0, le=90.0)
    dropoff_lng: Optional[float] = Field(None, ge=-180.0, le=180.0)
    vehicle_type: Optional[str] = "bike"
    payment_method: Optional[str] = "upi"


class RideResponse(BaseModel):
    id: int
    rider_id: str
    pickup_lat: float
    pickup_lng: float
    dropoff_lat: Optional[float] = None
    dropoff_lng: Optional[float] = None
    status: RideStatus
    matched_driver_id: Optional[int] = None
    vehicle_type: Optional[str] = "bike"
    payment_method: Optional[str] = "upi"
    otp: Optional[str] = None
    fare_amount: Optional[float] = 50.0
    surge_factor: Optional[float] = 1.0
    distance_km: Optional[float] = 2.5
    duration_min: Optional[float] = 8.0
    driver_earnings: Optional[float] = 40.0
    platform_fee: Optional[float] = 10.0
    payment_status: Optional[str] = "pending"
    rider_rating: Optional[int] = None
    driver_rating: Optional[int] = None
    review_text: Optional[str] = None
    matched_driver: Optional[DriverResponse] = None
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


class RideMatchResult(BaseModel):
    ride: RideResponse
    matched_driver: Optional[DriverResponse] = None
    distance_km: Optional[float] = None
    message: str


class OTPVerifyRequest(BaseModel):
    otp: str


class PaymentRequest(BaseModel):
    payment_method: str = "upi" # upi, card, cash


class RatingRequest(BaseModel):
    rating: int = Field(..., ge=1, le=5)
    review_text: Optional[str] = ""


# Ride History Schema
class RideHistoryResponse(BaseModel):
    id: int
    ride_id: int
    driver_id: int
    rider_id: str
    distance_km: float
    fare_amount: Optional[float] = 0.0
    driver_earnings: Optional[float] = 0.0
    platform_fee: Optional[float] = 0.0
    payment_method: Optional[str] = "upi"
    matched_at: datetime
    completed_at: datetime
    wait_time_seconds: float

    model_config = ConfigDict(from_attributes=True)

