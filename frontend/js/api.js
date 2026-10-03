// Centralized API Client with JWT Bearer Token & Admin Control Capabilities

const API_BASE_URL = "";

function getAuthHeaders() {
    const token = localStorage.getItem("access_token");
    const headers = { "Content-Type": "application/json" };
    if (token) {
        headers["Authorization"] = `Bearer ${token}`;
    }
    return headers;
}

export const API = {
    // Auth
    async login(username, password) {
        const res = await fetch(`${API_BASE_URL}/auth/login`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Login failed.");
        }
        return res.json();
    },

    async register(userData) {
        const res = await fetch(`${API_BASE_URL}/auth/register`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(userData)
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Registration failed.");
        }
        return res.json();
    },

    async getCurrentUser() {
        const res = await fetch(`${API_BASE_URL}/auth/me`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) return null;
        return res.json();
    },

    // Admin Controls & Analytics
    async getAdminAnalytics() {
        const res = await fetch(`${API_BASE_URL}/admin/analytics`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async suspendDriver(driverId) {
        const res = await fetch(`${API_BASE_URL}/admin/drivers/${driverId}/suspend`, {
            method: "POST",
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async getDriverHistory(driverId) {
        const res = await fetch(`${API_BASE_URL}/admin/drivers/${driverId}/history`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) return [];
        return res.json();
    },

    async forceCancelRide(rideId) {
        const res = await fetch(`${API_BASE_URL}/admin/rides/${rideId}/force_cancel`, {
            method: "POST",
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async reassignDriver(rideId, driverId) {
        const res = await fetch(`${API_BASE_URL}/admin/rides/${rideId}/reassign?driver_id=${driverId}`, {
            method: "POST",
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    // Drivers
    async getDrivers(statusFilter = null) {
        let url = `${API_BASE_URL}/drivers`;
        if (statusFilter) url += `?status_filter=${statusFilter}`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        if (!res.ok) return [];
        return res.json();
    },

    async createDriver(driverData) {
        const res = await fetch(`${API_BASE_URL}/drivers`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(driverData)
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async updateDriverLocation(driverId, locationData) {
        const res = await fetch(`${API_BASE_URL}/drivers/${driverId}/location`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(locationData)
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async toggleDriverStatus() {
        const res = await fetch(`${API_BASE_URL}/drivers/toggle_status`, {
            method: "POST",
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async getDriverAssignment() {
        const res = await fetch(`${API_BASE_URL}/drivers/my_assignment`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) return null;
        return res.json();
    },

    // Rides
    async requestRide(rideData) {
        const res = await fetch(`${API_BASE_URL}/rides/request`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify(rideData)
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async getMyRides() {
        const res = await fetch(`${API_BASE_URL}/rides/my_rides`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) return [];
        return res.json();
    },

    async getAllRides(statusFilter = null) {
        let url = `${API_BASE_URL}/rides`;
        if (statusFilter) url += `?status_filter=${statusFilter}`;
        const res = await fetch(url, { headers: getAuthHeaders() });
        if (!res.ok) return [];
        return res.json();
    },

    async getRide(rideId) {
        const res = await fetch(`${API_BASE_URL}/rides/${rideId}`, {
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error("Ride not found");
        return res.json();
    },

    async startRide(rideId) {
        const res = await fetch(`${API_BASE_URL}/rides/${rideId}/start`, {
            method: "POST",
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async completeRide(rideId) {
        const res = await fetch(`${API_BASE_URL}/rides/${rideId}/complete`, {
            method: "POST",
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    // Uber Ride Flow Extensions
    async estimateFares(pickupLat, pickupLng, dropoffLat, dropoffLng) {
        const res = await fetch(`${API_BASE_URL}/rides/estimate`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({
                pickup_lat: pickupLat,
                pickup_lng: pickupLng,
                dropoff_lat: dropoffLat,
                dropoff_lng: dropoffLng
            })
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async acceptRide(rideId) {
        const res = await fetch(`${API_BASE_URL}/rides/${rideId}/accept`, {
            method: "POST",
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async arriveRide(rideId) {
        const res = await fetch(`${API_BASE_URL}/rides/${rideId}/arrive`, {
            method: "POST",
            headers: getAuthHeaders()
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async verifyOtp(rideId, otp) {
        const res = await fetch(`${API_BASE_URL}/rides/${rideId}/verify_otp`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ otp })
        });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.detail || "Invalid OTP");
        }
        return res.json();
    },

    async payRide(rideId, paymentMethod) {
        const res = await fetch(`${API_BASE_URL}/rides/${rideId}/pay`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ payment_method: paymentMethod })
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    },

    async rateRide(rideId, rating, reviewText = "") {
        const res = await fetch(`${API_BASE_URL}/rides/${rideId}/rate`, {
            method: "POST",
            headers: getAuthHeaders(),
            body: JSON.stringify({ rating, review_text: reviewText })
        });
        if (!res.ok) throw new Error(await res.text());
        return res.json();
    }
};

