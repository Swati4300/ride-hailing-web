import { API } from "./api.js";
import { renderNavbar } from "./navbar.js";

document.addEventListener("DOMContentLoaded", () => {
    renderNavbar("map");

    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;

    const canvas = document.getElementById("spatial-canvas");
    const ctx = canvas.getContext("2d");
    const logFeed = document.getElementById("map-log");
    const driverCountBadge = document.getElementById("map-driver-count");

    const btnToggleStatus = document.getElementById("btn-toggle-availability");
    const driverStatusBadge = document.getElementById("driver-status-badge");

    let drivers = [];
    const BASE_LAT = 18.5204;
    const BASE_LNG = 73.8567;
    const SCALE = 3200;

    function resizeCanvas() {
        if (canvas && canvas.parentElement) {
            canvas.width = canvas.parentElement.clientWidth || 800;
            canvas.height = window.innerWidth <= 768 ? 340 : 540;
            renderMap();
        }
    }
    window.addEventListener("resize", resizeCanvas);
    resizeCanvas();

    function coordsToCanvas(lat, lng) {
        const x = canvas.width / 2 + (lng - BASE_LNG) * SCALE;
        const y = canvas.height / 2 - (lat - BASE_LAT) * SCALE;
        return { x, y };
    }

    function canvasToCoords(x, y) {
        const lng = BASE_LNG + (x - canvas.width / 2) / SCALE;
        const lat = BASE_LAT - (y - canvas.height / 2) / SCALE;
        return { lat, lng };
    }

    function renderMap() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Dark Radar Canvas Background
        ctx.fillStyle = "#0B132B";
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw Street Grid & Geohash Cell Boundaries
        ctx.strokeStyle = "rgba(255, 255, 255, 0.08)";
        ctx.lineWidth = 1;
        const gridSize = 60;

        let colIdx = 1;
        for (let x = 0; x < canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, canvas.height);
            ctx.stroke();

            ctx.fillStyle = "#64748B";
            ctx.font = "10px JetBrains Mono";
            ctx.fillText(`C${colIdx}`, x + 6, 16);
            colIdx++;
        }

        let rowIdx = 1;
        for (let y = 0; y < canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(canvas.width, y);
            ctx.stroke();

            ctx.fillStyle = "#64748B";
            ctx.font = "10px JetBrains Mono";
            ctx.fillText(`R${rowIdx}`, 6, y + 14);
            rowIdx++;
        }

        // Draw Drivers
        drivers.forEach(driver => {
            const { x, y } = coordsToCanvas(driver.current_lat, driver.current_lng);

            ctx.beginPath();
            ctx.arc(x, y, 7, 0, Math.PI * 2);
            ctx.fillStyle = driver.status === "available" ? "#4ADE80" : "#FCA5A5";
            ctx.fill();

            ctx.strokeStyle = "#0F172A";
            ctx.lineWidth = 1.5;
            ctx.stroke();

            ctx.fillStyle = "#FFFFFF";
            ctx.font = "600 11px Inter";
            ctx.fillText(`${driver.name}`, x + 12, y + 3);

            ctx.fillStyle = "#94A3B8";
            ctx.font = "500 10px JetBrains Mono";
            ctx.fillText(`GH: ${driver.geohash || 'N/A'}`, x + 12, y + 15);
        });

        // Draw Active Route Line if driver has assigned ride
        if (currentAssignment && user && user.driver_id) {
            const myDriver = drivers.find(d => d.id === user.driver_id);
            if (myDriver) {
                const driverPos = coordsToCanvas(myDriver.current_lat, myDriver.current_lng);
                const pickupPos = coordsToCanvas(currentAssignment.pickup_lat, currentAssignment.pickup_lng);

                ctx.save();
                ctx.beginPath();
                ctx.setLineDash([6, 6]);
                ctx.moveTo(driverPos.x, driverPos.y);
                ctx.lineTo(pickupPos.x, pickupPos.y);
                ctx.strokeStyle = "#F4B400";
                ctx.lineWidth = 3;
                ctx.stroke();
                ctx.restore();

                ctx.beginPath();
                ctx.arc(pickupPos.x, pickupPos.y, 9, 0, Math.PI * 2);
                ctx.fillStyle = "#F4B400";
                ctx.fill();
                ctx.strokeStyle = "#FFFFFF";
                ctx.lineWidth = 2;
                ctx.stroke();

                ctx.fillStyle = "#F4B400";
                ctx.font = "700 11px Inter";
                ctx.fillText(`PICKUP: ${currentAssignment.rider_id}`, pickupPos.x + 14, pickupPos.y + 4);
            }
        }
    }

    function logMsg(msg, type = "system") {
        if (!logFeed) return;
        const time = new Date().toLocaleTimeString();
        const entry = document.createElement("div");
        entry.className = `log-entry ${type}`;
        entry.textContent = `[${time}] ${msg}`;
        logFeed.appendChild(entry);
        logFeed.scrollTop = logFeed.scrollHeight;
    }

    let currentAssignment = null;

    const driverRideCard = document.getElementById("driver-ride-card");
    const driverRideStatusBadge = document.getElementById("driver-ride-status-badge");
    const driverRideRiderId = document.getElementById("driver-ride-rider-id");
    const driverRidePickup = document.getElementById("driver-ride-pickup");
    const btnAcceptStart = document.getElementById("btn-driver-accept-start");
    const btnComplete = document.getElementById("btn-driver-complete");
    const btnCancel = document.getElementById("btn-driver-cancel");

    async function checkDriverAssignment() {
        if (!user || user.role !== "driver") return;
        try {
            const ride = await API.getDriverAssignment();
            currentAssignment = ride;
            if (ride && (ride.status === "MATCHED" || ride.status === "IN_PROGRESS")) {
                if (driverRideCard) driverRideCard.style.display = "block";
                if (driverRideRiderId) driverRideRiderId.textContent = ride.rider_id;
                if (driverRidePickup) driverRidePickup.textContent = `${ride.pickup_lat.toFixed(4)}, ${ride.pickup_lng.toFixed(4)}`;
                
                if (driverRideStatusBadge) {
                    driverRideStatusBadge.textContent = ride.status;
                    driverRideStatusBadge.className = `badge badge-${ride.status.toLowerCase()}`;
                }

                if (ride.status === "MATCHED") {
                    if (btnAcceptStart) {
                        btnAcceptStart.style.display = "block";
                        btnAcceptStart.textContent = "✅ Accept & Start Trip";
                    }
                    if (btnComplete) btnComplete.style.display = "none";
                } else if (ride.status === "IN_PROGRESS") {
                    if (btnAcceptStart) btnAcceptStart.style.display = "none";
                    if (btnComplete) btnComplete.style.display = "block";
                }
            } else {
                if (driverRideCard) driverRideCard.style.display = "none";
            }
        } catch (e) {
            console.error("Failed checking driver assignment:", e);
        }
    }

    if (btnAcceptStart) {
        btnAcceptStart.addEventListener("click", async () => {
            if (!currentAssignment) return;
            try {
                await API.startRide(currentAssignment.id);
                logMsg(`Accepted & Started trip #${currentAssignment.id} for ${currentAssignment.rider_id}!`, "success");
                checkDriverAssignment();
                fetchDrivers();
            } catch (err) {
                logMsg(`Error starting trip: ${err.message}`, "error");
            }
        });
    }

    if (btnComplete) {
        btnComplete.addEventListener("click", async () => {
            if (!currentAssignment) return;
            try {
                await API.completeRide(currentAssignment.id);
                logMsg(`Completed trip #${currentAssignment.id}! Driver status reset to AVAILABLE.`, "success");
                currentAssignment = null;
                checkDriverAssignment();
                fetchDrivers();
            } catch (err) {
                logMsg(`Error completing trip: ${err.message}`, "error");
            }
        });
    }

    if (btnCancel) {
        btnCancel.addEventListener("click", async () => {
            if (!currentAssignment) return;
            try {
                await API.cancelRide(currentAssignment.id);
                logMsg(`Declined/Cancelled trip #${currentAssignment.id}. Driver status reset to AVAILABLE.`, "warning");
                currentAssignment = null;
                checkDriverAssignment();
                fetchDrivers();
            } catch (err) {
                logMsg(`Error cancelling trip: ${err.message}`, "error");
            }
        });
    }

    async function fetchDrivers() {
        try {
            drivers = await API.getDrivers();
            if (driverCountBadge) driverCountBadge.textContent = `${drivers.length} Vehicles Tracked`;

            if (user && driverStatusBadge) {
                const myDriver = drivers.find(d => d.id === user.driver_id || d.name === user.username || d.name === "Rahul Driver");
                if (myDriver) {
                    if (!user.driver_id) user.driver_id = myDriver.id;
                    driverStatusBadge.textContent = `Status: ${myDriver.status.toUpperCase()}`;
                    driverStatusBadge.className = `badge badge-${myDriver.status}`;
                }
            }

            checkDriverAssignment();
            renderMap();
        } catch (e) {
            logMsg(`Failed loading telemetry: ${e.message}`, "error");
        }
    }

    const authNotice = document.getElementById("driver-auth-notice");
    const btnQuickDriverLogin = document.getElementById("btn-quick-driver-login");

    if (!user || user.role !== "driver") {
        if (authNotice) authNotice.style.display = "block";
    } else {
        if (authNotice) authNotice.style.display = "none";
    }

    if (btnQuickDriverLogin) {
        btnQuickDriverLogin.addEventListener("click", async () => {
            try {
                const data = await API.login("driver1", "driver123");
                localStorage.setItem("access_token", data.access_token);
                localStorage.setItem("user", JSON.stringify(data.user));
                logMsg("Logged in successfully as Driver (driver1). Setting status to AVAILABLE...", "success");
                window.location.reload();
            } catch (err) {
                logMsg(`Login failed: ${err.message}`, "error");
            }
        });
    }

    const btnSimulateRide = document.getElementById("btn-simulate-ride");

    if (btnSimulateRide) {
        btnSimulateRide.addEventListener("click", async () => {
            if (!user || user.role !== "driver") {
                logMsg("Please log in as a Driver first using the '1-Click Log in as Driver' button above.", "warning");
                if (authNotice) authNotice.style.display = "block";
                return;
            }
            try {
                // Ensure driver is AVAILABLE
                const myDriver = drivers.find(d => d.id === user.driver_id);
                if (!myDriver || myDriver.status !== "available") {
                    await API.toggleDriverStatus();
                    logMsg("Driver status set to AVAILABLE.", "success");
                }

                // Request ride
                const pickupLat = myDriver ? myDriver.current_lat : BASE_LAT;
                const pickupLng = myDriver ? myDriver.current_lng : BASE_LNG;
                const res = await API.requestRide({
                    rider_id: `TestRider_${Math.floor(Math.random() * 100)}`,
                    pickup_lat: pickupLat,
                    pickup_lng: pickupLng
                });

                if (res.matched_driver) {
                    logMsg(`⚡ Test Ride Request created! Matched to Driver #${res.matched_driver.id}. Click '✅ Accept & Start Trip' below!`, "success");
                } else {
                    logMsg(`Ride created (#${res.ride.id}), polling assignment...`, "warning");
                }
                await fetchDrivers();
                await checkDriverAssignment();
            } catch (err) {
                logMsg(`Simulation error: ${err.message}`, "error");
            }
        });
    }

    if (btnToggleStatus) {
        btnToggleStatus.addEventListener("click", async () => {
            if (!user || user.role !== "driver") {
                logMsg("Authentication required: Please click '1-Click Log in as Driver' or log in to toggle availability.", "warning");
                if (authNotice) authNotice.style.display = "block";
                return;
            }
            try {
                const updated = await API.toggleDriverStatus();
                logMsg(`Driver status updated to: ${updated.status.toUpperCase()}`, "success");
                if (driverStatusBadge) {
                    driverStatusBadge.textContent = `Status: ${updated.status.toUpperCase()}`;
                    driverStatusBadge.className = `badge badge-${updated.status}`;
                }
                fetchDrivers();
            } catch (err) {
                logMsg(`Error toggling status: ${err.message}`, "error");
            }
        });
    }

    canvas.addEventListener("click", async (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const { lat, lng } = canvasToCoords(x, y);

        // If logged in as driver, update driver location!
        if (user && user.driver_id) {
            try {
                const updated = await API.updateDriverLocation(user.driver_id, { lat, lng });
                logMsg(`Updated your driver position to (${lat.toFixed(4)}, ${lng.toFixed(4)}) - Geohash: ${updated.geohash}`, "success");
                fetchDrivers();
                return;
            } catch (err) {
                console.error("Location update failed:", err);
            }
        }

        const name = document.getElementById("input-driver-name").value || `Driver_${Math.floor(Math.random() * 1000)}`;

        try {
            const newDriver = await API.createDriver({
                name,
                current_lat: lat,
                current_lng: lng
            });
            logMsg(`Spawned vehicle ${newDriver.name} at (${lat.toFixed(4)}, ${lng.toFixed(4)}) Geohash: ${newDriver.geohash}`, "success");
            fetchDrivers();
        } catch (err) {
            logMsg(`Error spawning vehicle: ${err.message}`, "error");
        }
    });

    const btnSpawn = document.getElementById("btn-spawn-driver");
    if (btnSpawn) {
        btnSpawn.addEventListener("click", async () => {
            const lat = BASE_LAT + (Math.random() - 0.5) * 0.05;
            const lng = BASE_LNG + (Math.random() - 0.5) * 0.05;
            const name = document.getElementById("input-driver-name").value || `Driver_${Math.floor(Math.random() * 1000)}`;

            try {
                const newDriver = await API.createDriver({ name, current_lat: lat, current_lng: lng });
                logMsg(`Spawned vehicle ${newDriver.name} (Geohash: ${newDriver.geohash})`, "success");
                fetchDrivers();
            } catch (err) {
                logMsg(`Error: ${err.message}`, "error");
            }
        });
    }

    fetchDrivers();
    setInterval(fetchDrivers, 3000);
});
