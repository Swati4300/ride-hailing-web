import { API } from "./api.js";
import { renderNavbar } from "./navbar.js";

document.addEventListener("DOMContentLoaded", async () => {
    renderNavbar("admin_panel");
    const token = localStorage.getItem("access_token");
    const userStr = localStorage.getItem("user");
    let user = userStr ? JSON.parse(userStr) : null;

    const authWarning = document.getElementById("admin-auth-warning");
    const btnQuickLogin = document.getElementById("btn-quick-admin-login");
    const userBadge = document.getElementById("adm-user-badge");

    if (!token || !user || user.role !== "admin") {
        if (authWarning) authWarning.style.display = "block";
        if (userBadge) userBadge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg> Read-Only Preview`;
    } else {
        if (authWarning) authWarning.style.display = "none";
        if (userBadge) userBadge.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg> Admin (${user.username})`;
    }

    if (btnQuickLogin) {
        btnQuickLogin.addEventListener("click", async () => {
            try {
                const data = await API.login("admin", "admin123");
                localStorage.setItem("access_token", data.access_token);
                localStorage.setItem("user", JSON.stringify(data.user));
                window.location.reload();
            } catch (err) {
                alert(`Login failed: ${err.message}`);
            }
        });
    }

    // Logout
    const btnLogout = document.getElementById("btn-admin-logout");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            localStorage.removeItem("access_token");
            localStorage.removeItem("user");
            window.location.href = "admin_login.html";
        });
    }

    // 2. Load Health Analytics Overview
    async function loadAnalytics() {
        try {
            const data = await API.getAdminAnalytics();
            document.getElementById("adm-rides-today").textContent = data.total_rides_today;
            document.getElementById("adm-completion-rate").textContent = `${data.completion_rate_pct}%`;
            document.getElementById("adm-avg-match-time").textContent = `${data.avg_match_time_seconds}s`;
            document.getElementById("adm-drivers-online").textContent = data.drivers_online_now;
            document.getElementById("admin-last-sync").textContent = `Last sync: ${new Date().toLocaleTimeString()}`;

            renderCharts(data.daily_trend);
        } catch (e) {
            console.warn("Analytics fetch warning:", e);
            // Default preview data if unauthenticated
            renderCharts([
                { day: "Sep 09", rides: 12 },
                { day: "Sep 10", rides: 24 },
                { day: "Sep 11", rides: 18 },
                { day: "Sep 12", rides: 32 },
                { day: "Sep 13", rides: 28 },
                { day: "Sep 14", rides: 42 },
                { day: "Sep 15", rides: 36 }
            ]);
        }
    }

    // 3. Render Trend Charts (HTML5 Canvas)
    function renderCharts(dailyTrend) {
        const c1 = document.getElementById("chart-rides-day");
        if (c1) {
            const ctx = c1.getContext("2d");
            ctx.clearRect(0, 0, c1.width, c1.height);
            ctx.fillStyle = "#F4B400";
            const maxVal = 50;
            const barWidth = 30;
            dailyTrend.forEach((item, idx) => {
                const h = (item.rides / maxVal) * (c1.height - 30);
                const x = 20 + idx * 42;
                const y = c1.height - 20 - h;
                ctx.fillRect(x, y, barWidth, h);

                ctx.fillStyle = "#6B7280";
                ctx.font = "10px Inter";
                ctx.fillText(item.day.split(" ")[1], x + 5, c1.height - 5);
                ctx.fillStyle = "#F4B400";
            });
        }

        const c2 = document.getElementById("chart-wait-time");
        if (c2) {
            const ctx = c2.getContext("2d");
            ctx.clearRect(0, 0, c2.width, c2.height);
            ctx.strokeStyle = "#16A34A";
            ctx.lineWidth = 2;
            ctx.beginPath();
            dailyTrend.forEach((item, idx) => {
                const val = 30 + Math.sin(idx) * 10;
                const x = 20 + idx * 42;
                const y = c2.height - 20 - val;
                if (idx === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();
        }

        const c3 = document.getElementById("chart-utilization");
        if (c3) {
            const ctx = c3.getContext("2d");
            ctx.clearRect(0, 0, c3.width, c3.height);
            ctx.fillStyle = "#2563EB";
            dailyTrend.forEach((item, idx) => {
                const val = 40 + (idx % 3) * 15;
                const x = 20 + idx * 42;
                const y = c3.height - 20 - val;
                ctx.fillRect(x, y, 28, val);
            });
        }
    }

    // 4. Live Rides View (Auto-updating table & Interventions)
    async function loadRides() {
        const filterElem = document.getElementById("adm-filter-ride-status");
        const filterVal = filterElem ? filterElem.value : "";
        const tbody = document.getElementById("adm-rides-table-body");
        if (!tbody) return;

        try {
            const rides = await API.getAllRides(filterVal);

            if (!rides || rides.length === 0) {
                tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 20px;">No rides found in system. Create a ride or run a concurrency test to populate live rides.</td></tr>`;
                return;
            }

            tbody.innerHTML = rides.map(r => `
                <tr>
                    <td><span class="code">#RIDE-${r.id}</span></td>
                    <td><strong>${r.rider_id}</strong></td>
                    <td><span style="font-family: var(--font-mono);">${r.pickup_lat.toFixed(4)}, ${r.pickup_lng.toFixed(4)}</span></td>
                    <td><span class="badge badge-${r.status}">${r.status}</span></td>
                    <td>${r.matched_driver_id ? `#DRV-${r.matched_driver_id}` : '<span style="color: var(--text-muted)">Unassigned</span>'}</td>
                    <td><span style="font-family: var(--font-mono); color: var(--text-secondary);">${new Date(r.created_at).toLocaleTimeString()}</span></td>
                    <td>
                        <div style="display: flex; gap: 6px;">
                            ${r.status !== 'completed' && r.status !== 'cancelled' ? `
                                <button class="btn btn-sm btn-red-subtle btn-force-cancel" data-id="${r.id}">Force Cancel</button>
                                <button class="btn btn-sm btn-secondary btn-reassign" data-id="${r.id}">Reassign</button>
                            ` : '<span style="color: var(--text-muted); font-size: 11px;">Finalized</span>'}
                        </div>
                    </td>
                </tr>
            `).join("");

            // Bind intervention buttons
            document.querySelectorAll(".btn-force-cancel").forEach(btn => {
                btn.onclick = async () => {
                    const id = btn.getAttribute("data-id");
                    if (confirm(`Are you sure you want to force-cancel Ride #${id}?`)) {
                        try {
                            await API.forceCancelRide(id);
                            loadRides();
                            loadAnalytics();
                        } catch (err) {
                            alert(`Action failed: ${err.message}`);
                        }
                    }
                };
            });

            document.querySelectorAll(".btn-reassign").forEach(btn => {
                btn.onclick = async () => {
                    const id = btn.getAttribute("data-id");
                    const targetDriverId = prompt("Enter target Driver ID to manually assign (e.g. 1):");
                    if (targetDriverId) {
                        try {
                            await API.reassignDriver(id, parseInt(targetDriverId));
                            alert(`Ride #${id} reassigned to Driver #${targetDriverId}.`);
                            loadRides();
                            loadAnalytics();
                        } catch (err) {
                            alert(`Reassignment failed: ${err.message}`);
                        }
                    }
                };
            });

        } catch (e) {
            console.error("Error loading rides:", e);
            tbody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: var(--text-secondary); padding: 20px;">No rides found in system.</td></tr>`;
        }
    }

    // 5. Driver Management View & Actions (Suspend & History Modal)
    async function loadDrivers() {
        const tbody = document.getElementById("adm-drivers-table-body");
        if (!tbody) return;

        try {
            const drivers = await API.getDrivers();

            if (!drivers || drivers.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 20px;">No drivers registered yet. Use the "Spawn Driver" control to add a driver.</td></tr>`;
                return;
            }

            tbody.innerHTML = drivers.map(d => `
                <tr>
                    <td><strong>${d.name}</strong></td>
                    <td><span class="code">#DRV-${d.id}</span></td>
                    <td><span style="font-family: var(--font-mono);">${d.current_lat.toFixed(4)}, ${d.current_lng.toFixed(4)}</span></td>
                    <td><span class="badge badge-${d.status}">${d.status}</span></td>
                    <td><span class="code">${d.geohash || 'N/A'}</span></td>
                    <td>
                        <div style="display: flex; gap: 6px;">
                            <button class="btn btn-sm btn-red-subtle btn-suspend-driver" data-id="${d.id}">Suspend (Kick Offline)</button>
                            <button class="btn btn-sm btn-secondary btn-driver-history" data-id="${d.id}" data-name="${d.name}">View History</button>
                        </div>
                    </td>
                </tr>
            `).join("");

            // Suspend Action
            document.querySelectorAll(".btn-suspend-driver").forEach(btn => {
                btn.onclick = async () => {
                    const id = btn.getAttribute("data-id");
                    if (confirm(`Suspend Driver #${id} and kick them OFFLINE?`)) {
                        try {
                            await API.suspendDriver(id);
                            loadDrivers();
                            loadAnalytics();
                        } catch (err) {
                            alert(`Action failed: ${err.message}`);
                        }
                    }
                };
            });

            // History Modal Action
            document.querySelectorAll(".btn-driver-history").forEach(btn => {
                btn.onclick = async () => {
                    const id = btn.getAttribute("data-id");
                    const name = btn.getAttribute("data-name");
                    document.getElementById("history-modal-title").textContent = `Trip History: Driver #${id} (${name})`;
                    try {
                        const history = await API.getDriverHistory(id);
                        const modalBody = document.getElementById("history-modal-body");

                        if (!history || history.length === 0) {
                            modalBody.innerHTML = `<tr><td colspan="5" style="text-align: center; color: var(--text-secondary);">No completed trip history found.</td></tr>`;
                        } else {
                            modalBody.innerHTML = history.map(h => `
                                <tr>
                                    <td><span class="code">#RIDE-${h.ride_id}</span></td>
                                    <td>${h.rider_id}</td>
                                    <td>${h.distance_km} km</td>
                                    <td>${h.wait_time_seconds}s</td>
                                    <td>${new Date(h.completed_at).toLocaleTimeString()}</td>
                                </tr>
                            `).join("");
                        }
                    } catch (e) {
                        console.error("History fetch error:", e);
                    }
                    document.getElementById("modal-driver-history").style.display = "flex";
                };
            });

        } catch (e) {
            console.error("Error loading drivers:", e);
            tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; color: var(--text-secondary); padding: 20px;">No drivers registered yet.</td></tr>`;
        }
    }

    // Modal Close
    const btnCloseModal = document.getElementById("btn-close-modal");
    if (btnCloseModal) {
        btnCloseModal.onclick = () => {
            document.getElementById("modal-driver-history").style.display = "none";
        };
    }

    const filterElem = document.getElementById("adm-filter-ride-status");
    if (filterElem) filterElem.onchange = loadRides;

    const refreshElem = document.getElementById("adm-refresh-rides");
    if (refreshElem) refreshElem.onclick = loadRides;

    // Initial Load & Auto Refresh Interval
    loadAnalytics();
    loadRides();
    loadDrivers();

    setInterval(() => {
        loadAnalytics();
        loadRides();
    }, 3000);
});
