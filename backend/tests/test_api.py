from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.main import app
from app.database import Base, get_db

from sqlalchemy.pool import StaticPool

TEST_DB_URL = "sqlite:///:memory:"

engine = create_engine(
    TEST_DB_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
Base.metadata.create_all(bind=engine)

client = TestClient(app)


def test_health_endpoint():
    response = client.get("/health")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"


def test_driver_and_ride_flow():
    # 1. Register a driver
    driver_payload = {
        "name": "Bob Driver",
        "current_lat": 40.7128,
        "current_lng": -74.0060
    }
    resp = client.post("/drivers", json=driver_payload)
    assert resp.status_code == 201
    driver_data = resp.json()
    driver_id = driver_data["id"]
    assert driver_data["name"] == "Bob Driver"
    assert driver_data["status"] == "available"

    # 2. Request a ride
    ride_payload = {
        "rider_id": "rider_123",
        "pickup_lat": 40.7130,
        "pickup_lng": -74.0062,
        "dropoff_lat": 40.7300,
        "dropoff_lng": -73.9900
    }
    resp = client.post("/rides/request", json=ride_payload)
    assert resp.status_code == 201
    match_data = resp.json()
    assert match_data["matched_driver"] is not None
    assert match_data["matched_driver"]["id"] == driver_id
    ride_id = match_data["ride"]["id"]

    # 3. Poll ride status
    resp = client.get(f"/rides/{ride_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "matched"

    # 4. Start ride
    resp = client.post(f"/rides/{ride_id}/start")
    assert resp.status_code == 200
    assert resp.json()["status"] == "in_progress"

    # 5. Complete ride
    resp = client.post(f"/rides/{ride_id}/complete")
    assert resp.status_code == 200
    history_data = resp.json()
    assert history_data["ride_id"] == ride_id
    assert history_data["driver_id"] == driver_id
    assert history_data["distance_km"] > 0

    # 6. Verify driver status is back to AVAILABLE
    resp = client.get(f"/drivers/{driver_id}")
    assert resp.status_code == 200
    assert resp.json()["status"] == "available"
