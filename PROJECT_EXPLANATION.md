# 🚕 Uber & Rapido Ride Dispatch System — Simple 3-Minute Project Guide

This document gives you a **simple, 3-minute explanation script** to present this project to anyone (interviewers, professors, friends) without getting confused!

---

## 💡 What is This Project? (30-Second Elevator Pitch)

> *"This is a real-time **Uber and Rapido-style ride booking system**. It allows riders to pick a vehicle (Bike, Auto, or Cab) and instantly match with nearby available drivers in milliseconds, guaranteeing zero double-bookings when multiple riders request a ride at the exact same second."*

---

## 🔄 The 2 Core Steps of the Project Flow

### 1. 🚕 Rider App (Customer View)
* Rider picks a vehicle category:
  * 🛵 **Rapido Bike** (Quick single seat: ₹40)
  * 🛺 **Auto** (3 seats, city travel: ₹70)
  * 🚗 **Uber Cab** (4 seats AC, premium comfort: ₹120)
* Enters Pickup & Destination location.
* Clicks **"Book Ride"**.
* Tracks live status: `Searching` ➔ `Driver Matched` ➔ `Trip Started` ➔ `Completed`.

---

### 2. 🚘 Driver Partner App (Driver View)
* Driver toggles **Online / Offline** availability switch.
* When an incoming ride request is generated near their location:
  * A pop-up alert appears showing **Pickup Location**, **Fare Earnings**, and **Rider Name**.
* Driver clicks **"Accept Ride"** ➔ **"Start Trip"** ➔ **"End Trip & Collect Cash"**.

---

## 🛠️ How it Works Behind the Scenes (Simplified Tech Points)

If someone asks **"How does the backend work under the hood?"**, answer with these 3 bullet points:

1. **FastAPI Backend**: Handles instant REST API communication between Rider and Driver.
2. **Geohash Spatial Indexing**: Instead of searching all drivers in the world, it converts GPS coordinates into grid cells so nearby drivers are found in **O(1) constant time**.
3. **Distributed Locking (Redis SETNX)**: If 10 riders try to book the same driver at the exact same millisecond, Redis locks the driver so **only 1 rider gets matched** and 0 double-bookings occur.

---

## 🚀 How to Run & Demo in 30 Seconds

```bash
# 1. Open Terminal in backend directory:
cd backend

# 2. Run Uvicorn Server:
python -m uvicorn app.main:app --reload --port 8000

# 3. Open Browser:
http://localhost:8000
```
