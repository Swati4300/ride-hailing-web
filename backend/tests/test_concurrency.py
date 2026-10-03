import concurrent.futures
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from app.database import Base
from app.models import Driver, DriverStatus, RideRequest, RideStatus
from app.matching import find_and_assign_driver
from app.geohash import encode_geohash
import os

TEST_DB_FILE = "./test_concurrency.db"
TEST_DB_URL = f"sqlite:///{TEST_DB_FILE}"


def setup_test_db():
    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass

    engine = create_engine(
        TEST_DB_URL,
        connect_args={"check_same_thread": False, "timeout": 15}
    )
    Base.metadata.create_all(bind=engine)
    Session = sessionmaker(autocommit=False, autoflush=False, bind=engine)
    return Session


def test_concurrent_driver_matching_no_double_booking():
    Session = setup_test_db()
    db = Session()

    lat, lng = 37.7749, -122.4194
    gh = encode_geohash(lat, lng)

    # 1. Create a single available driver
    single_driver = Driver(
        name="Solo Driver Alice",
        current_lat=lat,
        current_lng=lng,
        status=DriverStatus.AVAILABLE,
        geohash=gh
    )
    db.add(single_driver)
    db.commit()
    driver_id = single_driver.id
    db.close()

    # Function executed concurrently by multiple threads
    def simulate_rider_request(rider_idx: int):
        thread_db = Session()
        try:
            ride = RideRequest(
                rider_id=f"rider_{rider_idx}",
                pickup_lat=lat,
                pickup_lng=lng,
                status=RideStatus.REQUESTED
            )
            thread_db.add(ride)
            thread_db.commit()
            thread_db.refresh(ride)

            matched_driver, dist, msg = find_and_assign_driver(thread_db, ride)
            return matched_driver is not None
        finally:
            thread_db.close()

    # 2. Fire 10 simultaneous threads trying to match the same driver at the same millisecond
    num_concurrent_requests = 10
    successful_matches = 0

    with concurrent.futures.ThreadPoolExecutor(max_workers=num_concurrent_requests) as executor:
        futures = [
            executor.submit(simulate_rider_request, i) 
            for i in range(num_concurrent_requests)
        ]
        for future in concurrent.futures.as_completed(futures):
            if future.result():
                successful_matches += 1

    # 3. Assertions: EXACTLY 1 rider matched the driver, 9 were blocked (ZERO double booking!)
    assert successful_matches == 1, f"Expected exactly 1 match, but got {successful_matches}"

    # Verify final driver status is BUSY
    verify_db = Session()
    driver = verify_db.query(Driver).filter(Driver.id == driver_id).first()
    assert driver.status == DriverStatus.BUSY
    verify_db.close()

    if os.path.exists(TEST_DB_FILE):
        try:
            os.remove(TEST_DB_FILE)
        except Exception:
            pass
