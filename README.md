# High-Concurrency Ride-Matching Dispatch Engine

A production-grade, highly-concurrent ride-matching dispatch backend engine built in Python using **FastAPI**, **PostgreSQL**, **Redis**, hand-rolled **Geohashing**, and **Distributed Locks**.

Designed specifically to solve real-world dispatch challenges: sub-millisecond nearest driver search and strict prevention of double-booking under extreme concurrent request bursts.

---

## Architecture Overview

```
                      +-----------------------------+
                      |     Rider / Driver Client   |
                      +--------------+--------------+
                                     |
                                     v
                       +-------------+-------------+
                       |       FastAPI Engine      |
                       +------+--------------+-----+
                              |              |
           Distributed Lock   |              |  Geohash Grid Lookup
          (SETNX + Lua script)|              |  (Target Cell + 8 Neighbors)
                              v              v
                       +------+--------------+-----+
                       |       Redis Locking       |
                       +---------------------------+
                              |              |
          Persist Rides/      |              | Periodic Sweeps
          Driver Status       v              v
                       +------+-------+ +----+------+
                       | PostgreSQL DB | | Background|
                       +--------------+ | Worker    |
                                        +-----------+
                                        (Auto-cancel / Inactive sweeps)
```

---

## Key Technical Highlights

### 1. Data Model (PostgreSQL / SQL)
- **`Driver`**: `id`, `name`, `current_lat`, `current_lng`, `status` (`available` | `busy` | `offline`), `geohash`, `last_updated_at`.
- **`RideRequest`**: `id`, `rider_id`, `pickup_lat`, `pickup_lng`, `dropoff_lat`, `dropoff_lng`, `status` (`requested` | `matched` | `in_progress` | `completed` | `cancelled`), `matched_driver_id`, `created_at`.
- **`RideHistory`**: `ride_id`, `driver_id`, `distance_km`, `matched_at`, `completed_at`, `wait_time_seconds`.

### 2. Spatial Geohashing Matching Brain
Rather than performing expensive $O(N)$ full-table distance comparisons across thousands of drivers on every request:
- Coordinates are encoded into a **Base32 Geohash** (precision 6, ~1.2km grid cells).
- The search space is instantly narrowed down to drivers located in the rider's **target cell + 8 surrounding neighbor cells** (North, South, East, West, NE, NW, SE, SW).
- Nearby drivers are ranked by exact **Haversine formula** spherical distance.

### 3. Concurrency Protection & Distributed Locking
- To eliminate race conditions when simultaneous ride requests arrive within milliseconds for the same driver, the engine acquires a **Redis Distributed Lock (`SETNX`)** on `driver_lock:<driver_id>`.
- Lock release uses atomic Lua scripts to verify lock ownership token.
- Includes a process-level thread-safe lock manager fallback for zero-config local runs.

### 4. Strict Ride Finite State Machine (FSM)
Enforces valid state transition lifecycles:
```
requested ──> matched ──> in_progress ──> completed
   │             │
   └───> cancelled <───┘
```
Attempts to bypass states (e.g. `requested` directly to `completed`) raise `InvalidStateTransitionError`.

---

## Project Structure

```
project1/
├── docker-compose.yml
├── README.md
├── frontend/
│   ├── index.html       # Overview Dashboard
│   ├── map.html         # Spatial Geohash Map
│   ├── drivers.html     # Driver Fleet Management
│   ├── rides.html       # Rides & Concurrency Stress Test
│   ├── css/
│   │   └── main.css     # Shared Design System Styles
│   └── js/
│       ├── api.js       # Centralized API Service Wrapper
│       ├── navbar.js    # Dynamic Navigation Header
│       ├── dashboard.js # Overview Stats Logic
│       ├── map.js       # HTML5 Canvas Spatial Grid Logic
│       ├── drivers.js   # Driver Table Logic
│       └── rides.js     # Dispatch & Concurrency Test Logic
└── backend/
    ├── Dockerfile
    ├── requirements.txt
    ├── app/
    │   ├── main.py            # FastAPI entrypoint
    │   ├── config.py          # Settings & Environment vars
    │   ├── database.py        # SQLAlchemy & DB initialization
    │   ├── models.py          # SQL DB Models
    │   ├── schemas.py         # Pydantic schemas
    │   ├── geohash.py         # Geohash encoder & Haversine distance
    │   ├── lock.py            # Redis SETNX & Thread lock manager
    │   ├── state_machine.py   # FSM lifecycle rules
    │   ├── matching.py        # Dispatch algorithm
    │   ├── tasks.py           # Background cleanup tasks
    │   └── routers/
    │       ├── drivers.py     # Driver APIs
    │       └── rides.py       # Ride APIs
    └── tests/
        ├── test_geohash.py        # Spatial test suite
        ├── test_state_machine.py  # FSM lifecycle test suite
        ├── test_concurrency.py    # Multi-threaded stress test
        └── test_api.py            # API integration tests
```

---

## Quickstart & Running

### Option 1: Docker Compose (Full Stack)
```bash
docker-compose up --build
```
- API & Docs: `http://localhost:8000/docs`
- Interactive Visual Dashboard: `http://localhost:8000/dashboard`

### Option 2: Standalone Local Run (Python + SQLite)
```bash
cd backend
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

---

## Running Test Suite

Run the full pytest suite, including the multi-threaded race condition stress test:
```bash
cd backend
pytest -v
```

### Concurrency Stress Test Sample Output:
```
tests/test_concurrency.py::test_concurrent_driver_matching_no_double_booking PASSED
[INFO] Fired 10 simultaneous parallel threads requesting driver at same millisecond.
[RESULT] Exactly 1 request matched under lock, 9 requests safely blocked. Zero double bookings!
```
