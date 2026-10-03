import { API } from "./api.js";
import { renderNavbar } from "./navbar.js";

let map = null;
let pickupMarker = null;
let dropoffMarker = null;
let routePolyline = null;
let nearbyDriverMarkers = [];
let liveDriverMarker = null;

let currentRide = null;
let pollInterval = null;
let radarSearchInterval = null;
let radarElapsedSeconds = 0;

let selectedCategory = "bike";
let selectedCategoryName = "Rapido Bike";
let baseFareAmount = 40;
let finalFareAmount = 40;
let appliedDiscount = 0;
let activePromoCode = "";
let selectedTip = 0;
let userRating = 5;

const PUNE_LOCATIONS = [
    { name: "Pune Railway Station", desc: "Agarkar Nagar, Pune", lat: 18.5289, lng: 73.8744 },
    { name: "Shivajinagar Bus Stand / Station", desc: "Shivajinagar, Pune", lat: 18.5314, lng: 73.8446 },
    { name: "Swargate Bus Stand", desc: "Swargate, Pune", lat: 18.5018, lng: 73.8636 },
    { name: "Hinjewadi IT Park (Phase 1)", desc: "Hinjewadi Rajiv Gandhi IT Park", lat: 18.5912, lng: 73.7389 },
    { name: "Hinjewadi IT Park (Phase 2/3)", desc: "Hinjewadi Phase 2, Pune", lat: 18.5833, lng: 73.7167 },
    { name: "Pune International Airport (PNQ)", desc: "Lohegaon, Pune", lat: 18.5793, lng: 73.9089 },
    { name: "Phoenix Marketcity Viman Nagar", desc: "Viman Nagar, Pune", lat: 18.5622, lng: 73.9168 },
    { name: "Kothrud (Chandani Chowk)", desc: "Kothrud, Pune", lat: 18.5074, lng: 73.8077 },
    { name: "Fergusson College Road (FC Road)", desc: "Deccan Gymkhana, Pune", lat: 18.5196, lng: 73.8413 },
    { name: "Jangali Maharaj Road (JM Road)", desc: "Shivajinagar, Pune", lat: 18.5246, lng: 73.8478 },
    { name: "Koregaon Park (North Main Road)", desc: "Koregaon Park, Pune", lat: 18.5362, lng: 73.8940 },
    { name: "Magarpatta Cybercity", desc: "Hadapsar, Pune", lat: 18.5167, lng: 73.9265 }
];

document.addEventListener("DOMContentLoaded", () => {
    renderNavbar("rides");

    setupTabNavigation();
    initLeafletMap();
    setupLocationSearch("pickup-address-input", "pickup-suggestions", true);
    setupLocationSearch("dropoff-address-input", "dropoff-suggestions", false);
    setupEventListeners();
    checkActiveRideOnLoad();
});

function setupTabNavigation() {
    const tabBtns = document.querySelectorAll(".rider-tab-btn");
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

            if (targetTab === "book" && map) {
                setTimeout(() => map.invalidateSize(), 150);
            }
        });
    });
}

function initLeafletMap() {
    const mapEl = document.getElementById("uber-leaflet-map");
    if (!mapEl) return;

    const startLat = parseFloat(document.getElementById("pickup-lat")?.value || 18.5204);
    const startLng = parseFloat(document.getElementById("pickup-lng")?.value || 73.8567);
    const dropLat = parseFloat(document.getElementById("dropoff-lat")?.value || 18.5289);
    const dropLng = parseFloat(document.getElementById("dropoff-lng")?.value || 73.8744);

    map = L.map("uber-leaflet-map").setView([startLat, startLng], 13);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    const createSvgPinIcon = (svgPath, bg) => L.divIcon({
        className: 'custom-map-pin',
        html: `<div style="background: ${bg}; color: #FFF; width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid #FFF; box-shadow: 0 4px 12px rgba(0,0,0,0.4);">${svgPath}</div>`,
        iconSize: [34, 34],
        iconAnchor: [17, 17]
    });

    const pinPickupSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2.2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>`;
    const pinDropoffSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#FFF" stroke-width="2.2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>`;

    pickupMarker = L.marker([startLat, startLng], {
        draggable: true,
        icon: createSvgPinIcon(pinPickupSvg, "#10B981")
    }).addTo(map);

    dropoffMarker = L.marker([dropLat, dropLng], {
        draggable: true,
        icon: createSvgPinIcon(pinDropoffSvg, "#EF4444")
    }).addTo(map);

    pickupMarker.on("dragend", (e) => {
        const { lat, lng } = e.target.getLatLng();
        document.getElementById("pickup-lat").value = lat.toFixed(4);
        document.getElementById("pickup-lng").value = lng.toFixed(4);
        updateAddressInputFromCoords("pickup-address-input", lat, lng);
        updateRoute();
    });

    dropoffMarker.on("dragend", (e) => {
        const { lat, lng } = e.target.getLatLng();
        document.getElementById("dropoff-lat").value = lat.toFixed(4);
        document.getElementById("dropoff-lng").value = lng.toFixed(4);
        updateAddressInputFromCoords("dropoff-address-input", lat, lng);
        updateRoute();
    });

    map.on("click", (e) => {
        if (currentRide) return;
        const { lat, lng } = e.latlng;
        dropoffMarker.setLatLng([lat, lng]);
        document.getElementById("dropoff-lat").value = lat.toFixed(4);
        document.getElementById("dropoff-lng").value = lng.toFixed(4);
        updateAddressInputFromCoords("dropoff-address-input", lat, lng);
        updateRoute();
    });

    renderNearbyDriversOnMap(startLat, startLng);
    updateRoute();
}

function renderNearbyDriversOnMap(centerLat, centerLng) {
    // Clear existing driver markers
    nearbyDriverMarkers.forEach(m => map.removeLayer(m));
    nearbyDriverMarkers = [];

    const driverOffsets = [
        { latOff: 0.004, lngOff: 0.003, icon: "🛵" },
        { latOff: -0.003, lngOff: 0.005, icon: "🛺" },
        { latOff: 0.005, lngOff: -0.004, icon: "🚗" },
        { latOff: -0.004, lngOff: -0.003, icon: "🚙" }
    ];

    driverOffsets.forEach(off => {
        const icon = L.divIcon({
            className: 'nearby-driver-icon',
            html: `<div style="background: rgba(224, 176, 255, 0.2); border: 1.5px solid #E0B0FF; width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 14px; box-shadow: 0 2px 8px rgba(0,0,0,0.4);">${off.icon}</div>`,
            iconSize: [28, 28],
            iconAnchor: [14, 14]
        });

        const marker = L.marker([centerLat + off.latOff, centerLng + off.lngOff], { icon }).addTo(map);
        nearbyDriverMarkers.push(marker);
    });
}

function updateAddressInputFromCoords(inputId, lat, lng) {
    const inputEl = document.getElementById(inputId);
    if (!inputEl) return;

    fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`)
        .then(res => res.json())
        .then(data => {
            if (data && data.display_name) {
                const parts = data.display_name.split(",");
                const shortAddr = parts.slice(0, 3).join(",").trim();
                inputEl.value = shortAddr;
            }
        })
        .catch(err => console.log("Reverse geocode catch:", err));
}

let searchDebounceTimers = {};

function setupLocationSearch(inputId, suggestionsId, isPickup) {
    const inputEl = document.getElementById(inputId);
    const suggestionsEl = document.getElementById(suggestionsId);
    if (!inputEl || !suggestionsEl) return;

    const renderSuggestions = (items) => {
        if (!items || items.length === 0) {
            suggestionsEl.style.display = "none";
            return;
        }
        suggestionsEl.innerHTML = items.map(item => `
            <div class="suggestion-item" data-lat="${item.lat}" data-lng="${item.lng}" data-name="${item.name}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--accent-yellow)" stroke-width="2"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                <div>
                    <div class="sugg-name">${item.name}</div>
                    <div class="sugg-desc">${item.desc || 'Pune, Maharashtra'}</div>
                </div>
            </div>
        `).join("");
        suggestionsEl.style.display = "block";

        suggestionsEl.querySelectorAll(".suggestion-item").forEach(el => {
            el.onclick = () => {
                const lat = parseFloat(el.getAttribute("data-lat"));
                const lng = parseFloat(el.getAttribute("data-lng"));
                const name = el.getAttribute("data-name");

                inputEl.value = name;
                suggestionsEl.style.display = "none";

                if (isPickup) {
                    document.getElementById("pickup-lat").value = lat.toFixed(4);
                    document.getElementById("pickup-lng").value = lng.toFixed(4);
                    if (pickupMarker) pickupMarker.setLatLng([lat, lng]);
                } else {
                    document.getElementById("dropoff-lat").value = lat.toFixed(4);
                    document.getElementById("dropoff-lng").value = lng.toFixed(4);
                    if (dropoffMarker) dropoffMarker.setLatLng([lat, lng]);
                }
                updateRoute();
            };
        });
    };

    const handleSearch = () => {
        const query = inputEl.value.trim().toLowerCase();
        if (!query) {
            renderSuggestions(PUNE_LOCATIONS.slice(0, 5));
            return;
        }

        const localMatches = PUNE_LOCATIONS.filter(loc => 
            loc.name.toLowerCase().includes(query) || loc.desc.toLowerCase().includes(query)
        );

        renderSuggestions(localMatches);
    };

    inputEl.addEventListener("focus", handleSearch);
    inputEl.addEventListener("input", handleSearch);

    document.addEventListener("click", (e) => {
        if (!inputEl.contains(e.target) && !suggestionsEl.contains(e.target)) {
            suggestionsEl.style.display = "none";
        }
    });
}

function updateRoute() {
    if (!pickupMarker || !dropoffMarker || !map) return;
    const pLatLng = pickupMarker.getLatLng();
    const dLatLng = dropoffMarker.getLatLng();

    if (routePolyline) {
        map.removeLayer(routePolyline);
    }

    routePolyline = L.polyline([pLatLng, dLatLng], {
        color: "#F4B400",
        weight: 4,
        dashArray: "8, 12",
        opacity: 0.85
    }).addTo(map);

    map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });

    fetchFareEstimates(pLatLng.lat, pLatLng.lng, dLatLng.lat, dLatLng.lng);
}

async function fetchFareEstimates(pLat, pLng, dLat, dLng) {
    try {
        const data = await API.estimateFares(pLat, pLng, dLat, dLng);
        if (!data || !data.estimates) return;

        let maxSurge = 1.0;
        data.estimates.forEach(est => {
            if (est.surge_factor > maxSurge) maxSurge = est.surge_factor;
            const priceEl = document.getElementById(`vprice-${est.category_id}`);
            if (priceEl) {
                priceEl.textContent = `₹${est.fare}`;
                if (est.surge_factor > 1.0) {
                    priceEl.innerHTML = `₹${est.fare} <span style="font-size: 10px; color: #EF4444; font-weight: 700;">⚡ ${est.surge_factor}x</span>`;
                }
            }
            if (est.category_id === selectedCategory) {
                baseFareAmount = est.fare;
                calculateFinalFare();
            }
        });

        const surgeAlert = document.getElementById("surge-alert-box");
        if (surgeAlert) {
            surgeAlert.style.display = maxSurge > 1.0 ? "flex" : "none";
            const tag = document.getElementById("surge-multiplier-tag");
            if (tag) tag.textContent = `${maxSurge}x`;
        }

        logTelemetry(`Calculated route distance: ${data.distance_km} km (${data.duration_min} mins)`);
    } catch (err) {
        console.error("Error fetching fare estimates:", err);
    }
}

function calculateFinalFare() {
    finalFareAmount = Math.max(10, baseFareAmount - appliedDiscount);
    updateSubmitButtonText();
}

function updateSubmitButtonText() {
    const btn = document.getElementById("btn-submit-uber-booking");
    if (btn) {
        btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg> <span>Confirm ${selectedCategoryName} (₹${finalFareAmount})</span>`;
    }
}

function setupEventListeners() {
    // Clear Input Buttons
    const btnClearPickup = document.getElementById("btn-clear-pickup");
    if (btnClearPickup) {
        btnClearPickup.addEventListener("click", () => {
            const pInput = document.getElementById("pickup-address-input");
            if (pInput) { pInput.value = ""; pInput.focus(); }
        });
    }

    const btnClearDropoff = document.getElementById("btn-clear-dropoff");
    if (btnClearDropoff) {
        btnClearDropoff.addEventListener("click", () => {
            const dInput = document.getElementById("dropoff-address-input");
            if (dInput) { dInput.value = ""; dInput.focus(); }
        });
    }

    // Toggle Coordinates Panel
    const btnToggleCoords = document.getElementById("btn-toggle-coords");
    const coordsPanel = document.getElementById("coords-panel");
    if (btnToggleCoords && coordsPanel) {
        btnToggleCoords.addEventListener("click", () => {
            const isOpen = coordsPanel.style.display !== "none";
            coordsPanel.style.display = isOpen ? "none" : "block";
        });
    }

    // Apply Promo Code
    const btnApplyPromo = document.getElementById("btn-apply-promo");
    if (btnApplyPromo) {
        btnApplyPromo.addEventListener("click", () => {
            const input = document.getElementById("input-promo-code");
            const badge = document.getElementById("promo-applied-badge");
            if (!input) return;
            const code = input.value.trim().toUpperCase();

            if (code === "RAPIDO50") {
                activePromoCode = code;
                appliedDiscount = 50;
                badge.textContent = "✓ Promo RAPIDO50 Applied: ₹50 Discount Unlocked!";
                badge.style.display = "block";
            } else if (code === "UBERFIRST") {
                activePromoCode = code;
                appliedDiscount = Math.round(baseFareAmount * 0.20);
                badge.textContent = `✓ Promo UBERFIRST Applied: 20% (₹${appliedDiscount}) Discount Unlocked!`;
                badge.style.display = "block";
            } else {
                alert("Invalid or expired promo code. Try RAPIDO50 or UBERFIRST.");
                return;
            }
            calculateFinalFare();
        });
    }

    // Presets
    window.setPresetLocation = (pLat, pLng, dLat, dLng, name) => {
        document.getElementById("pickup-lat").value = pLat;
        document.getElementById("pickup-lng").value = pLng;
        document.getElementById("dropoff-lat").value = dLat;
        document.getElementById("dropoff-lng").value = dLng;

        const parts = name.split(" to ");
        if (parts.length === 2) {
            const pInput = document.getElementById("pickup-address-input");
            const dInput = document.getElementById("dropoff-address-input");
            if (pInput) pInput.value = parts[0].trim() + ", Pune";
            if (dInput) dInput.value = parts[1].trim() + ", Pune";
        }

        if (pickupMarker) pickupMarker.setLatLng([pLat, pLng]);
        if (dropoffMarker) dropoffMarker.setLatLng([dLat, dLng]);
        updateRoute();
        logTelemetry(`Set location preset: ${name}`);
    };

    // Category Selection
    window.selectVehicleCategory = (catId, catName, defaultFare) => {
        selectedCategory = catId;
        selectedCategoryName = catName;
        baseFareAmount = defaultFare;

        document.querySelectorAll(".vehicle-card").forEach(c => c.classList.remove("selected"));
        const cardEl = document.getElementById(`vcard-${catId}`);
        if (cardEl) cardEl.classList.add("selected");

        calculateFinalFare();
    };

    // Submit Booking Form
    const bookingForm = document.getElementById("form-uber-booking");
    if (bookingForm) {
        bookingForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            await requestUberRide();
        });
    }

    // Cancel Radar Search
    const btnCancelSearch = document.getElementById("btn-cancel-search");
    if (btnCancelSearch) {
        btnCancelSearch.addEventListener("click", () => {
            stopRadarSearch();
            document.getElementById("modal-finding-driver").style.display = "none";
        });
    }

    // Rider Chat Trigger
    const btnChat = document.getElementById("btn-rider-call-chat");
    const modalChat = document.getElementById("modal-rider-chat");
    const btnCloseChat = document.getElementById("btn-close-rider-chat");
    if (btnChat && modalChat) {
        btnChat.addEventListener("click", () => modalChat.style.display = "flex");
    }
    if (btnCloseChat && modalChat) {
        btnCloseChat.addEventListener("click", () => modalChat.style.display = "none");
    }

    // Send Rider Chat
    const btnSendChat = document.getElementById("btn-send-rider-chat");
    if (btnSendChat) {
        btnSendChat.addEventListener("click", () => {
            const input = document.getElementById("input-rider-chat-text");
            if (!input || !input.value.trim()) return;
            const container = document.getElementById("rider-chat-messages-list");
            if (container) {
                const bubble = document.createElement("div");
                bubble.className = "chat-bubble rider";
                bubble.textContent = input.value.trim();
                container.appendChild(bubble);
                container.scrollTop = container.scrollHeight;
            }
            input.value = "";
        });
    }

    // Share Trip Trigger
    const btnShare = document.getElementById("btn-share-trip");
    const modalShare = document.getElementById("modal-share-trip");
    const btnCloseShare = document.getElementById("btn-close-share-trip");
    if (btnShare && modalShare) {
        btnShare.addEventListener("click", () => modalShare.style.display = "flex");
    }
    if (btnCloseShare && modalShare) {
        btnCloseShare.addEventListener("click", () => modalShare.style.display = "none");
    }

    // SOS Trigger
    const btnSOS = document.getElementById("btn-trigger-sos");
    if (btnSOS) {
        btnSOS.addEventListener("click", () => {
            alert("EMERGENCY SOS TRIGGERED: Live trip coordinates (18.5204, 73.8567) sent to Pune Police Control Room & Emergency Contacts!");
        });
    }

    // Cancel Active Ride
    const btnCancelActive = document.getElementById("btn-cancel-active-ride");
    if (btnCancelActive) {
        btnCancelActive.addEventListener("click", async () => {
            if (!currentRide) return;
            if (confirm("Are you sure you want to cancel this ride?")) {
                try {
                    await API.cancelRide(currentRide.id);
                    alert("Ride cancelled.");
                    resetRideUI();
                } catch (err) {
                    alert("Error cancelling ride: " + err.message);
                }
            }
        });
    }

    // Submit Driver Rating & Tip
    const btnSubmitRating = document.getElementById("btn-submit-rating");
    if (btnSubmitRating) {
        btnSubmitRating.addEventListener("click", () => {
            alert(`Thank you! Rated driver ${userRating} stars with ₹${selectedTip} tip.`);
            document.getElementById("modal-trip-completed").style.display = "none";
            resetRideUI();
        });
    }

    // Star Click Handlers
    document.querySelectorAll("#rating-stars-container .star").forEach(star => {
        star.addEventListener("click", () => {
            userRating = parseInt(star.getAttribute("data-star") || 5);
            document.querySelectorAll("#rating-stars-container .star").forEach(s => {
                const val = parseInt(s.getAttribute("data-star"));
                if (val <= userRating) {
                    s.classList.add("selected");
                } else {
                    s.classList.remove("selected");
                }
            });
        });
    });

    window.selectTipAmount = (amt) => {
        selectedTip = amt;
        alert(`Selected ₹${amt} tip for driver.`);
    };

    const btnClearLog = document.getElementById("btn-clear-log");
    if (btnClearLog) {
        btnClearLog.addEventListener("click", () => {
            document.getElementById("telemetry-log-text").textContent = "Dispatch Telemetry cleared.";
        });
    }
}

async function requestUberRide() {
    const pickupLat = parseFloat(document.getElementById("pickup-lat").value);
    const pickupLng = parseFloat(document.getElementById("pickup-lng").value);
    const dropoffLat = parseFloat(document.getElementById("dropoff-lat").value);
    const dropoffLng = parseFloat(document.getElementById("dropoff-lng").value);
    const paymentMethod = document.getElementById("uber-payment-method").value;

    const payload = {
        pickup_lat: pickupLat,
        pickup_lng: pickupLng,
        dropoff_lat: dropoffLat,
        dropoff_lng: dropoffLng,
        vehicle_type: selectedCategory,
        payment_method: paymentMethod
    };

    try {
        startRadarSearchOverlay();
        const ride = await API.requestRide(payload);
        currentRide = ride;
        logTelemetry(`Ride #${ride.id} requested. Searching for nearby driver...`);
        startPollingRideStatus(ride.id);
    } catch (err) {
        stopRadarSearch();
        alert("Booking failed: " + err.message);
    }
}

function startRadarSearchOverlay() {
    const modal = document.getElementById("modal-finding-driver");
    if (modal) modal.style.display = "flex";
    radarElapsedSeconds = 0;

    if (radarSearchInterval) clearInterval(radarSearchInterval);
    radarSearchInterval = setInterval(() => {
        radarElapsedSeconds++;
        const timerText = document.getElementById("radar-timer-text");
        if (timerText) timerText.textContent = `${radarElapsedSeconds}s`;

        if (radarElapsedSeconds >= 45) {
            stopRadarSearch();
            if (modal) modal.style.display = "none";
            alert("No drivers available nearby right now. Please try again in a few moments.");
        }
    }, 1000);
}

function stopRadarSearch() {
    if (radarSearchInterval) {
        clearInterval(radarSearchInterval);
        radarSearchInterval = null;
    }
    const modal = document.getElementById("modal-finding-driver");
    if (modal) modal.style.display = "none";
}

function startPollingRideStatus(rideId) {
    if (pollInterval) clearInterval(pollInterval);
    pollInterval = setInterval(async () => {
        try {
            const ride = await API.getRide(rideId);
            currentRide = ride;
            updateRideStateUI(ride);

            if (["completed", "cancelled"].includes(ride.status)) {
                clearInterval(pollInterval);
                pollInterval = null;
            }
        } catch (err) {
            console.error("Error polling ride status:", err);
        }
    }, 2000);
}

async function checkActiveRideOnLoad() {
    try {
        const myRides = await API.getMyRides();
        if (myRides && myRides.length > 0) {
            const active = myRides.find(r => !["completed", "cancelled"].includes(r.status));
            if (active) {
                currentRide = active;
                updateRideStateUI(active);
                startPollingRideStatus(active.id);
            }
        }
    } catch (err) {
        console.log("No active ride on load.");
    }
}

function updateRideStateUI(ride) {
    if (!ride) return;

    if (ride.status !== "requested") {
        stopRadarSearch();
    }

    const bookingCard = document.getElementById("card-booking-form");
    const activeCard = document.getElementById("card-active-trip-status");
    const statusBadge = document.getElementById("trip-status-badge");
    const otpText = document.getElementById("live-trip-otp");

    if (bookingCard) bookingCard.style.display = "none";
    if (activeCard) activeCard.style.display = "block";

    if (otpText && ride.otp) {
        otpText.textContent = ride.otp;
    }

    if (ride.status === "requested") {
        statusBadge.textContent = "FINDING DRIVER...";
        statusBadge.className = "badge badge-requested";
    } else if (ride.status === "matched") {
        statusBadge.textContent = "DRIVER ASSIGNED - WAITING ACCEPTANCE";
        statusBadge.className = "badge badge-matched";
    } else if (ride.status === "accepted") {
        statusBadge.textContent = "DRIVER ON THE WAY";
        statusBadge.className = "badge badge-online";
    } else if (ride.status === "arrived") {
        statusBadge.textContent = "DRIVER ARRIVED AT PICKUP";
        statusBadge.className = "badge badge-available";
    } else if (ride.status === "in_progress") {
        statusBadge.textContent = "TRIP IN PROGRESS";
        statusBadge.className = "badge badge-busy";
    } else if (ride.status === "completed") {
        showTripCompletedModal(ride);
    }
}

function showTripCompletedModal(ride) {
    const modal = document.getElementById("modal-trip-completed");
    if (!modal) return;

    document.getElementById("fare-breakdown-total").textContent = `₹${(ride.fare_amount || finalFareAmount).toFixed(2)}`;
    if (appliedDiscount > 0) {
        document.getElementById("fare-breakdown-discount-row").style.display = "flex";
        document.getElementById("fare-breakdown-discount").textContent = `-₹${appliedDiscount.toFixed(2)}`;
    } else {
        document.getElementById("fare-breakdown-discount-row").style.display = "none";
    }

    modal.style.display = "flex";
}

function resetRideUI() {
    currentRide = null;
    if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
    document.getElementById("card-booking-form").style.display = "block";
    document.getElementById("card-active-trip-status").style.display = "none";
}

function logTelemetry(msg) {
    const el = document.getElementById("telemetry-log-text");
    if (el) el.textContent = msg;
}
