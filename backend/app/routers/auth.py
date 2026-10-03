from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from app.database import get_db
from app.models import User, UserRole, Driver, DriverStatus, utc_now
from app.schemas import UserRegister, UserLogin, UserResponse, TokenResponse
from app.auth import hash_password, verify_password, create_access_token, get_current_user
from app.geohash import encode_geohash

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def register_user(user_in: UserRegister, db: Session = Depends(get_db)):
    """Register a new user account (Rider or Driver)."""
    existing_user = db.query(User).filter(
        (User.username == user_in.username) | (User.email == user_in.email)
    ).first()
    if existing_user:
        raise HTTPException(status_code=400, detail="Username or Email already registered.")

    driver_id = None
    rider_id = None

    if user_in.role == UserRole.DRIVER:
        # Create corresponding Driver entity
        v_type = user_in.vehicle_type or "bike"
        v_no = user_in.vehicle_no or f"MH-12-UB-{user_in.username[:3].upper()}1"
        lic_no = user_in.license_no or f"DL-{user_in.username[:3].upper()}9281"

        new_driver = Driver(
            name=user_in.username,
            current_lat=37.7749,
            current_lng=-122.4194,
            status=DriverStatus.OFFLINE,
            geohash=encode_geohash(37.7749, -122.4194),
            vehicle_type=v_type,
            vehicle_no=v_no,
            license_no=lic_no,
            is_verified=1,
            rating=4.9,
            rating_count=18,
            last_updated_at=utc_now()
        )
        db.add(new_driver)
        db.flush()
        driver_id = new_driver.id
    else:
        rider_id = f"Rider_{user_in.username}"

    new_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hash_password(user_in.password),
        role=user_in.role,
        driver_id=driver_id,
        rider_id=rider_id,
        created_at=utc_now()
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    return new_user


@router.post("/login", response_model=TokenResponse)
def login_user(login_in: UserLogin, db: Session = Depends(get_db)):
    """Authenticate user and return JWT access token."""
    user = db.query(User).filter(User.username == login_in.username).first()
    if not user or not verify_password(login_in.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password."
        )

    token_data = {
        "user_id": user.id,
        "username": user.username,
        "role": user.role.value
    }
    access_token = create_access_token(token_data)

    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        user=user
    )


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(current_user: User = Depends(get_current_user)):
    """Retrieve profile of the current authenticated user."""
    return current_user
