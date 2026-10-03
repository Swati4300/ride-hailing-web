import { API } from "./api.js";
import { renderNavbar } from "./navbar.js";

let map = null;
let driverMarker = null;
let pickupMarker = null;
let dropoffMarker = null;
let routePolyline = null;

let currentAssignment = null;
let pollInterval = null;
let locationPingInterval = null;
let dispatchCountdownInterval = null;
let dispatchCountdownSeconds = 15;

let currentDriver = null;
let isApproved = true;

// Pune Default Coordinates
let driverLat = 18.5204;
let driverLng = 73.8567;

document.addEventListener("DOMContentLoaded", async () => {
    renderNavbar("drivers");

    setupTabNavigation();
    setupEventListeners();
    initDriverMap();
    await loadDriverProfile();
    await loadFleetDirectory();

    startAssignmentPolling();
});

function setupTabNavigation() {
    const tabBtns = document.querySelectorAll(".driver-tab-btn");
    tabBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-tab");
            tabBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");

            document.querySelectorAll(".tab-view-content").forEach(view => {
                view.style.display = "none";
            });

            const targetView = document.getElementById(`tab-view-${targetTab}`);
            if (targetView) {
                targetView.style.display = "block";
            }

            if (targetTab === "terminal" && map) {
                setTimeout(() => map.invalidateSize(), 150);
            }
        });
    });
}

function initDriverMap() {
    const mapEl = document.getElementById("driver-leaflet-map");
    if (!mapEl) return;

    map = L.map("driver-leaflet-map").setView([driverLat, driverLng], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    const driverIcon = L.divIcon({
        className: 'driver-map-pin',
        html: `<div style="background: #E0B0FF; color: #1F2937; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #FFF; box-shadow: 0 4px 12px rgba(0,0,0,0.4); font-weight: 800;">🚗</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });

    driverMarker = L.marker([driverLat, driverLng], { icon: driverIcon }).addTo(map);
}

async function loadDriverProfile() {
    try {
        const user = await API.getCurrentUser();
        if (user && user.username) {
            document.getElementById("drv-terminal-name").textContent = user.username;
        }

        const drivers = await API.getDrivers();
        if (drivers && drivers.length > 0) {
            const me = drivers.find(d => d.name === (user?.username || "driver1")) || drivers[0];
            currentDriver = me;
            updateDriverUI(me);
        }
    } catch (err) {
        console.error("Error loading driver profile:", err);
    }
}

function updateDriverUI(driver) {
    const badge = document.getElementById("drv-online-badge");
    const btnToggle = document.getElementById("btn-toggle-online");
    const vInfo = document.getElementById("drv-vehicle-info");
    const ratingText = document.getElementById("drv-rating-text");
    const pendingBanner = document.getElementById("banner-verification-pending");

    if (badge && btnToggle) {
        if (driver.status === "available" || driver.status === "busy") {
            badge.textContent = "ONLINE & READY";
            badge.className = "badge badge-online";
            btnToggle.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18.36 6.64a9 9 0 1 1-12.73 0"></path><line x1="12" y1="2" x2="12" y2="12"></line></svg> Go Offline`;
            startLocationHeartbeat();
        } else {
            badge.textContent = "OFFLINE";
            badge.className = "badge badge-offline";
            btnToggle.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg> Go Online`;
            stopLocationHeartbeat();
        }
    }

    if (vInfo) {
        const vType = (driver.vehicle_type || "bike").toUpperCase();
        vInfo.textContent = `${vType} (${driver.vehicle_no || 'MH-12-UB-9988'})`;
    }

    if (ratingText) {
        ratingText.textContent = `★ ${driver.rating || 4.9}`;
    }

    if (pendingBanner) {
        pendingBanner.style.display = isApproved ? "none" : "flex";
    }
}

function startLocationHeartbeat() {
    if (locationPingInterval) clearInterval(locationPingInterval);
    locationPingInterval = setInterval(async () => {
        if (!currentDriver) return;
        // Simulate minor location wiggle / movement along route
        driverLat += (Math.random() - 0.5) * 0.0005;
        driverLng += (Math.random() - 0.5) * 0.0005;

        if (driverMarker && map) {
            driverMarker.setLatLng([driverLat, driverLng]);
        }

        try {
            await API.updateDriverLocation(currentDriver.id, {
                lat: driverLat,
                lng: driverLng,
                status: currentDriver.status
            });
        } catch (err) {
            console.log("Location ping catch:", err);
        }
    }, 4000);
}

function stopLocationHeartbeat() {
    if (locationPingInterval) {
        clearInterval(locationPingInterval);
        locationPingInterval = null;
    }
}

function setupEventListeners() {
    // Online / Offline Toggle
    const btnToggle = document.getElementById("btn-toggle-online");
    if (btnToggle) {
        btnToggle.addEventListener("click", async () => {
            if (!isApproved) {
                alert("Your onboarding documents are pending approval! Please approve verification first.");
                return;
            }
            try {
                const updated = await API.toggleDriverStatus();
                currentDriver = updated;
                updateDriverUI(updated);
                loadFleetDirectory();
            } catch (err) {
                alert("Error toggling online status: " + err.message);
            }
        });
    }

    // Refresh Fleet Table
    const btnRefresh = document.getElementById("btn-refresh-fleet");
    if (btnRefresh) {
        btnRefresh.addEventListener("click", () => loadFleetDirectory());
    }

    // Simulate Admin Approval
    const btnApprove = document.getElementById("btn-simulate-admin-approve");
    if (btnApprove) {
        btnApprove.addEventListener("click", () => {
            isApproved = true;
            document.getElementById("banner-verification-pending").style.display = "none";
            alert("Driver status updated to VERIFIED! You can now go Online.");
        });
    }

    // Driver Actions
    // Step 0: Accept Ride
    const btnAccept = document.getElementById("btn-drv-accept");
    if (btnAccept) {
        btnAccept.addEventListener("click", () => handleAcceptRide());
    }

    // Popup Accept Button
    const btnPopupAccept = document.getElementById("btn-popup-accept");
    if (btnPopupAccept) {
        btnPopupAccept.addEventListener("click", () => handleAcceptRide());
    }

    // Popup Reject Button
    const btnPopupReject = document.getElementById("btn-popup-reject");
    if (btnPopupReject) {
        btnPopupReject.addEventListener("click", () => handleRejectRide());
    }

    // Step 1: Arrive
    const btnArrive = document.getElementById("btn-drv-arrive");
    if (btnArrive) {
        btnArrive.addEventListener("click", async () => {
            if (!currentAssignment) return;
            try {
                const res = await API.arriveRide(currentAssignment.id);
                currentAssignment = res;
                renderAssignmentCard(res);
            } catch (err) {
                alert("Error signaling arrival: " + err.message);
            }
        });
    }

    // Step 2: Verify OTP & Start
    const btnStart = document.getElementById("btn-drv-start-trip");
    if (btnStart) {
        btnStart.addEventListener("click", async () => {
            if (!currentAssignment) return;
            const otpInput = document.getElementById("input-driver-otp")?.value.trim();
            if (!otpInput) {
                alert("Please enter the 4-digit OTP from rider screen.");
                return;
            }
            try {
                const res = await API.verifyOtp(currentAssignment.id, otpInput);
                currentAssignment = res;
                renderAssignmentCard(res);
            } catch (err) {
                alert("OTP verification failed: " + err.message);
            }
        });
    }

    // Step 3: End Ride
    const btnEnd = document.getElementById("btn-drv-end-trip");
    if (btnEnd) {
        btnEnd.addEventListener("click", async () => {
            if (!currentAssignment) return;
            try {
                await API.completeRide(currentAssignment.id);
                alert("Trip completed successfully! Cash payment of ₹" + (currentAssignment.fare_amount || 40) + " collected.");
                currentAssignment = null;
                document.getElementById("active-driver-ride-card").style.display = "none";
                loadFleetDirectory();
            } catch (err) {
                alert("Error completing trip: " + err.message);
            }
        });
    }

    // Rider Chat Trigger
    const btnChat = document.getElementById("btn-open-rider-chat");
    const modalChat = document.getElementById("modal-rider-chat");
    const btnCloseChat = document.getElementById("btn-close-rider-chat");
    if (btnChat && modalChat) {
        btnChat.addEventListener("click", () => modalChat.style.display = "flex");
    }
    if (btnCloseChat && modalChat) {
        btnCloseChat.addEventListener("click", () => modalChat.style.display = "none");
    }

    // Chat Message Send
    const btnSendChat = document.getElementById("btn-send-chat");
    if (btnSendChat) {
        btnSendChat.addEventListener("click", () => {
            const input = document.getElementById("input-chat-text");
            if (!input || !input.value.trim()) return;
            const text = input.value.trim();
            const container = document.getElementById("chat-messages-list");
            if (container) {
                const bubble = document.createElement("div");
                bubble.className = "chat-bubble driver";
                bubble.textContent = text;
                container.appendChild(bubble);
                container.scrollTop = container.scrollHeight;
            }
            input.value = "";
        });
    }
}

async function handleAcceptRide() {
    if (!currentAssignment) return;
    try {
        stop15SecCountdown();
        document.getElementById("modal-dispatch-request").style.display = "none";
        const res = await API.acceptRide(currentAssignment.id);
        currentAssignment = res;
        renderAssignmentCard(res);
    } catch (err) {
        alert("Error accepting ride: " + err.message);
    }
}

function handleRejectRide() {
    stop15SecCountdown();
    document.getElementById("modal-dispatch-request").style.display = "none";
    currentAssignment = null;
    document.getElementById("active-driver-ride-card").style.display = "none";
}

function trigger15SecDispatchPopup(ride) {
    const modal = document.getElementById("modal-dispatch-request");
    if (!modal) return;

    document.getElementById("popup-fare-text").textContent = `₹${(ride.fare_amount || 40).toFixed(2)}`;
    document.getElementById("popup-earnings-text").textContent = `Estimated Driver Earnings: ₹${((ride.fare_amount || 40) * 0.8).toFixed(2)}`;

    modal.style.display = "flex";
    dispatchCountdownSeconds = 15;

    const timerText = document.getElementById("dispatch-timer-text");
    const circle = document.getElementById("dispatch-timer-circle");

    if (timerText) timerText.textContent = "15";
    if (circle) circle.style.strokeDashoffset = "0";

    stop15SecCountdown();

    dispatchCountdownInterval = setInterval(() => {
        dispatchCountdownSeconds--;
        if (timerText) timerText.textContent = dispatchCountdownSeconds;

        if (circle) {
            // strokeDasharray = 163
            const offset = 163 - (163 * dispatchCountdownSeconds / 15);
            circle.style.strokeDashoffset = `${offset}`;
        }

        if (dispatchCountdownSeconds <= 0) {
            stop15SecCountdown();
            modal.style.display = "none";
            handleRejectRide();
        }
    }, 1000);
}

function stop15SecCountdown() {
    if (dispatchCountdownInterval) {
        clearInterval(dispatchCountdownInterval);
        dispatchCountdownInterval = null;
    }
}

function startAssignmentPolling() {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
        try {
            const assignment = await API.getDriverAssignment();
            if (assignment && (!currentAssignment || currentAssignment.id !== assignment.id || currentAssignment.status !== assignment.status)) {
                const isNewRequest = !currentAssignment && (assignment.status === "requested" || assignment.status === "matched");
                currentAssignment = assignment;
                renderAssignmentCard(assignment);

                if (isNewRequest) {
                    trigger15SecDispatchPopup(assignment);
                }
            } else if (!assignment && currentAssignment) {
                currentAssignment = null;
                renderAssignmentCard(null);
            }
        } catch (err) {
            console.error("Assignment poll error:", err);
        }
    }, 2500);
}

function renderAssignmentCard(ride) {
    const card = document.getElementById("active-driver-ride-card");
    if (!card) return;

    if (!ride || ["completed", "cancelled"].includes(ride.status)) {
        card.style.display = "none";
        if (routePolyline && map) {
            map.removeLayer(routePolyline);
            routePolyline = null;
        }
        return;
    }

    card.style.display = "block";

    document.getElementById("drv-ride-category").textContent = (ride.vehicle_type || "bike").toUpperCase();
    const fare = ride.fare_amount || 40;
    const earnings = (fare * 0.80).toFixed(2);
    const fee = (fare * 0.20).toFixed(2);

    document.getElementById("drv-ride-fare").textContent = `₹${fare.toFixed(2)}`;
    document.getElementById("drv-ride-earnings").textContent = `₹${earnings}`;
    document.getElementById("drv-ride-fee").textContent = `₹${fee}`;

    const badge = document.getElementById("driver-ride-status-badge");
    const stepAccept = document.getElementById("step-accept-reject");
    const stepArrive = document.getElementById("step-arrive-pickup");
    const stepOTP = document.getElementById("step-verify-otp");
    const stepComplete = document.getElementById("step-complete-trip");

    // Hide all step action blocks initially
    [stepAccept, stepArrive, stepOTP, stepComplete].forEach(s => {
        if (s) s.style.display = "none";
    });

    if (ride.status === "requested" || ride.status === "matched") {
        badge.textContent = "ASSIGNED REQUEST";
        badge.className = "badge badge-matched";
        stepAccept.style.display = "flex";
    } else if (ride.status === "accepted") {
        badge.textContent = "ACCEPTED - HEADING TO PICKUP";
        badge.className = "badge badge-online";
        stepArrive.style.display = "block";
        updateNavigationRoute(ride.pickup_lat, ride.pickup_lng);
    } else if (ride.status === "arrived") {
        badge.textContent = "ARRIVED - ENTER OTP";
        badge.className = "badge badge-available";
        stepOTP.style.display = "block";
    } else if (ride.status === "in_progress") {
        badge.textContent = "TRIP IN PROGRESS";
        badge.className = "badge badge-busy";
        stepComplete.style.display = "block";
        updateNavigationRoute(ride.dropoff_lat, ride.dropoff_lng);
    }
}

function updateNavigationRoute(targetLat, targetLng) {
    if (!map || !targetLat || !targetLng) return;
    if (routePolyline) map.removeLayer(routePolyline);

    routePolyline = L.polyline([[driverLat, driverLng], [targetLat, targetLng]], {
        color: "#E0B0FF",
        weight: 4,
        dashArray: "6, 10"
    }).addTo(map);

    map.fitBounds(routePolyline.getBounds(), { padding: [30, 30] });
}

async function loadFleetDirectory() {
    const tableBody = document.getElementById("fleet-table-body");
    if (!tableBody) return;

    try {
        const drivers = await API.getDrivers();
        if (!drivers || drivers.length === 0) {
            tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary);">No drivers online.</td></tr>`;
            return;
        }

        tableBody.innerHTML = drivers.map(d => `
            <tr>
                <td><strong>${d.name}</strong></td>
                <td><span class="code">${(d.vehicle_type || 'bike').toUpperCase()}</span></td>
                <td>${d.vehicle_no || 'MH-12-UB-9988'}</td>
                <td>${d.license_no || 'DL-82910392'}</td>
                <td><span class="badge badge-${d.status}">${d.status.toUpperCase()}</span></td>
                <td><span style="color: var(--accent-yellow); font-weight: 700;">★ ${d.rating || 4.9}</span></td>
                <td><span style="color: #4ADE80; font-weight: 600; display: inline-flex; align-items: center; gap: 4px;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"></polyline></svg> Verified</span></td>
            </tr>
        `).join("");
    } catch (err) {
        tableBody.innerHTML = `<tr><td colspan="7" style="color: var(--status-red); text-align: center;">Error loading fleet: ${err.message}</td></tr>`;
    }
}
