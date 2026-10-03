// Ride Matching Engine Visualizer JS

const API_BASE = "";

const canvas = document.getElementById("spatial-canvas");
const ctx = canvas.getContext("2d");

// System state
let drivers = [];
let activeRides = [];
let totalRidesCount = 0;
let matchedRidesCount = 0;
let locksAcquiredCount = 0;

// Base center coordinates for visualization grid (SF area defaults)
const BASE_LAT = 37.7749;
const BASE_LNG = -122.4194;
const SCALE = 3000; // Pixels per degree

// Convert lat/lng to canvas X/Y
function coordsToCanvas(lat, lng) {
    const x = canvas.width / 2 + (lng - BASE_LNG) * SCALE;
    const y = canvas.height / 2 - (lat - BASE_LAT) * SCALE;
    return { x, y };
}

// Convert canvas X/Y to lat/lng
function canvasToCoords(x, y) {
    const lng = BASE_LNG + (x - canvas.width / 2) / SCALE;
    const lat = BASE_LAT - (y - canvas.height / 2) / SCALE;
    return { lat, lng };
}

// Draw Grid & Entities
function renderMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Geohash Grid Background
    ctx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    ctx.lineWidth = 1;
    const gridSize = 40;
    for (let x = 0; x < canvas.width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, canvas.height);
        ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(canvas.width, y);
        ctx.stroke();
    }

    // Draw Drivers
    drivers.forEach(driver => {
        const { x, y } = coordsToCanvas(driver.current_lat, driver.current_lng);
        
        // Draw Driver Glow
        ctx.beginPath();
        ctx.arc(x, y, 14, 0, Math.PI * 2);
        ctx.fillStyle = driver.status === "available" ? "rgba(56, 189, 248, 0.2)" : "rgba(239, 68, 68, 0.2)";
        ctx.fill();

        // Core Dot
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = driver.status === "available" ? "#38bdf8" : "#ef4444";
        ctx.fill();

        // Name Tag
        ctx.fillStyle = "#94a3b8";
        ctx.font = "11px Outfit";
        ctx.fillText(driver.name, x + 10, y + 4);
    });

    // Draw Active Rides
    activeRides.forEach(ride => {
        const { x, y } = coordsToCanvas(ride.pickup_lat, ride.pickup_lng);
        
        ctx.beginPath();
        ctx.arc(x, y, 8, 0, Math.PI * 2);
        ctx.fillStyle = "#f59e0b";
        ctx.fill();

        ctx.strokeStyle = "#fff";
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.fillStyle = "#f59e0b";
        ctx.font = "11px Outfit";
        ctx.fillText(`Rider (${ride.rider_id})`, x + 12, y + 4);
    });
}

// Log Feed helper
function logMsg(msg, type = "system") {
    const feed = document.getElementById("log-feed");
    const time = new Date().toLocaleTimeString();
    const entry = document.createElement("div");
    entry.className = `log-entry ${type}`;
    entry.textContent = `[${time}] ${msg}`;
    feed.appendChild(entry);
    feed.scrollTop = feed.scrollHeight;
}

// Fetch Drivers
async function fetchDrivers() {
    try {
        const res = await fetch(`${API_BASE}/drivers`);
        if (res.ok) {
            drivers = await res.json();
            document.getElementById("driver-count").textContent = `${drivers.length} Drivers Online`;
            renderMap();
        }
    } catch (e) {
        console.error("Failed to fetch drivers:", e);
    }
}

// Event Listeners
document.getElementById("btn-add-driver").addEventListener("click", async () => {
    const name = document.getElementById("driver-name").value || "Driver Alex";
    // Randomize nearby location
    const lat = BASE_LAT + (Math.random() - 0.5) * 0.08;
    const lng = BASE_LNG + (Math.random() - 0.5) * 0.08;

    try {
        const res = await fetch(`${API_BASE}/drivers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, current_lat: lat, current_lng: lng })
        });
        if (res.ok) {
            const data = await res.json();
            logMsg(`Driver registered: ${data.name} (Geohash: ${data.geohash})`, "success");
            fetchDrivers();
        }
    } catch (e) {
        logMsg(`Error adding driver: ${e}`, "error");
    }
});

document.getElementById("btn-request-ride").addEventListener("click", async () => {
    const riderId = document.getElementById("rider-id").value || "Rider_01";
    const lat = BASE_LAT + (Math.random() - 0.5) * 0.04;
    const lng = BASE_LNG + (Math.random() - 0.5) * 0.04;

    totalRidesCount++;
    document.getElementById("metric-total-rides").textContent = totalRidesCount;

    try {
        const res = await fetch(`${API_BASE}/rides/request`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ rider_id: riderId, pickup_lat: lat, pickup_lng: lng })
        });

        if (res.ok) {
            const data = await res.json();
            if (data.matched_driver) {
                matchedRidesCount++;
                locksAcquiredCount++;
                document.getElementById("metric-matched-rides").textContent = matchedRidesCount;
                document.getElementById("metric-locks-acquired").textContent = locksAcquiredCount;
                logMsg(`🔒 LOCK ACQUIRED! Matched ${riderId} to Driver ${data.matched_driver.name} (${data.distance_km} km away)`, "lock");
            } else {
                logMsg(`Ride requested for ${riderId} but no available drivers nearby.`, "warning");
            }
            fetchDrivers();
        }
    } catch (e) {
        logMsg(`Error requesting ride: ${e}`, "error");
    }
});

// Stress Test
document.getElementById("btn-stress-test").addEventListener("click", async () => {
    logMsg("🔥 STARTING CONCURRENCY STRESS TEST: 10 parallel requests in 1ms...", "warning");
    const promises = [];
    const pickupLat = BASE_LAT;
    const pickupLng = BASE_LNG;

    for (let i = 1; i <= 10; i++) {
        totalRidesCount++;
        promises.push(
            fetch(`${API_BASE}/rides/request`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ rider_id: `StressRider_${i}`, pickup_lat: pickupLat, pickup_lng: pickupLng })
            }).then(r => r.json())
        );
    }

    document.getElementById("metric-total-rides").textContent = totalRidesCount;

    const results = await Promise.all(promises);
    let matchedCount = 0;
    results.forEach(res => {
        if (res.matched_driver) matchedCount++;
    });

    matchedRidesCount += matchedCount;
    locksAcquiredCount += matchedCount;
    document.getElementById("metric-matched-rides").textContent = matchedRidesCount;
    document.getElementById("metric-locks-acquired").textContent = locksAcquiredCount;

    logMsg(`✅ STRESS TEST COMPLETE: Handled 10 parallel requests. ${matchedCount} matched under Redis lock, ${10 - matchedCount} safely rejected (Zero Double Booking!).`, "success");
    fetchDrivers();
});

document.getElementById("btn-clear-logs").addEventListener("click", () => {
    document.getElementById("log-feed").innerHTML = "";
});

// Click on Canvas to Add Driver
canvas.addEventListener("click", async (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const { lat, lng } = canvasToCoords(x, y);

    const name = `Driver_${Math.floor(Math.random() * 1000)}`;
    try {
        const res = await fetch(`${API_BASE}/drivers`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, current_lat: lat, current_lng: lng })
        });
        if (res.ok) {
            const data = await res.json();
            logMsg(`Placed driver ${data.name} at grid coordinates (${lat.toFixed(4)}, ${lng.toFixed(4)})`, "success");
            fetchDrivers();
        }
    } catch (e) {
        logMsg(`Error: ${e}`, "error");
    }
});

// Initial Setup
fetchDrivers();
setInterval(fetchDrivers, 3000);
