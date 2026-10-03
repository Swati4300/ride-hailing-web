from sqlalchemy import create_engine
from sqlalchemy.orm import declarative_base, sessionmaker
from app.config import settings

db_url = settings.DATABASE_URL

connect_args = {}
if db_url.startswith("sqlite"):
    connect_args["check_same_thread"] = False

engine = create_engine(db_url, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

Base = declarative_base()


def get_db():
    """Dependency for providing a database session per request."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def seed_default_users(db):
    """Auto-seed demo accounts (Admin, Driver, Rider) for immediate testing."""
    from app.models import User, UserRole, Driver, DriverStatus, utc_now
    from app.auth import hash_password
    from app.geohash import encode_geohash

    # 1. Seed Admin
    admin_user = db.query(User).filter(User.username == "admin").first()
    if not admin_user:
        admin_user = User(
            username="admin",
            email="admin@dispatch.com",
            hashed_password=hash_password("admin123"),
            role=UserRole.ADMIN,
            created_at=utc_now()
        )
        db.add(admin_user)

    # 2. Seed Driver
    driver_user = db.query(User).filter(User.username == "driver1").first()
    if not driver_user:
        d1 = Driver(
            name="Rahul Driver",
            current_lat=18.5204,
            current_lng=73.8567,
            status=DriverStatus.AVAILABLE,
            geohash=encode_geohash(18.5204, 73.8567),
            vehicle_type="bike",
            vehicle_no="MH-12-UB-9988",
            license_no="DL-92810392",
            is_verified=1,
            rating=4.9,
            rating_count=32,
            last_updated_at=utc_now()
        )
        db.add(d1)
        db.flush()

        driver_user = User(
            username="driver1",
            email="driver1@dispatch.com",
            hashed_password=hash_password("driver123"),
            role=UserRole.DRIVER,
            driver_id=d1.id,
            created_at=utc_now()
        )
        db.add(driver_user)
    else:
        # Guarantee driver entity exists for existing user
        if not driver_user.driver_id or not db.query(Driver).filter(Driver.id == driver_user.driver_id).first():
            d1 = Driver(
                name="Rahul Driver",
                current_lat=18.5204,
                current_lng=73.8567,
                status=DriverStatus.AVAILABLE,
                geohash=encode_geohash(18.5204, 73.8567),
                last_updated_at=utc_now()
            )
            db.add(d1)
            db.flush()
            driver_user.driver_id = d1.id

    # 3. Seed Rider
    rider_user = db.query(User).filter(User.username == "rider1").first()
    if not rider_user:
        rider_user = User(
            username="rider1",
            email="rider1@dispatch.com",
            hashed_password=hash_password("rider123"),
            role=UserRole.RIDER,
            rider_id="Rider_1",
            created_at=utc_now()
        )
        db.add(rider_user)

    db.commit()


def init_db():
    """Initialize database tables and seed default accounts."""
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        seed_default_users(db)
    finally:
        db.close()
