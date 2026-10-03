// Dynamic Role-Based Modern Production Navbar Component

export function renderNavbar(activePage = "dashboard") {
    const header = document.getElementById("navbar-header");
    if (!header) return;

    const userStr = localStorage.getItem("user");
    const user = userStr ? JSON.parse(userStr) : null;
    const role = user ? user.role : null;

    // Professional SVG Icons (Lucide System)
    const overviewIcon = `<svg class="nav-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/></svg>`;
    const bookRideIcon = `<svg class="nav-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>`;
    const driversIcon = `<svg class="nav-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`;
    const adminIcon = `<svg class="nav-svg-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`;

    let navLinksHtml = "";

    if (role === "rider") {
        navLinksHtml = `
            <li><a href="rides.html" class="${activePage === 'rides' ? 'active' : ''}">${bookRideIcon} <span>Book & Track Ride</span></a></li>
        `;
    } else if (role === "driver") {
        navLinksHtml = `
            <li><a href="rides.html" class="${activePage === 'rides' ? 'active' : ''}">${bookRideIcon} <span>My Driver Requests</span></a></li>
        `;
    } else if (role === "admin") {
        navLinksHtml = `
            <li><a href="index.html" class="${activePage === 'dashboard' ? 'active' : ''}">${overviewIcon} <span>Overview</span></a></li>
            <li><a href="admin_panel.html" class="${activePage === 'admin_panel' ? 'active' : ''}">${adminIcon} <span>Admin Command</span></a></li>
            <li><a href="drivers.html" class="${activePage === 'drivers' ? 'active' : ''}">${driversIcon} <span>Drivers</span></a></li>
            <li><a href="rides.html" class="${activePage === 'rides' ? 'active' : ''}">${bookRideIcon} <span>Rides</span></a></li>
        `;
    } else {
        navLinksHtml = `
            <li><a href="index.html" class="${activePage === 'dashboard' ? 'active' : ''}">${overviewIcon} <span>Overview</span></a></li>
            <li><a href="rides.html" class="${activePage === 'rides' ? 'active' : ''}">${bookRideIcon} <span>Book Ride</span></a></li>
            <li><a href="drivers.html" class="${activePage === 'drivers' ? 'active' : ''}">${driversIcon} <span>Drivers</span></a></li>
        `;
    }

    const userIcon = `<svg class="btn-svg-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>`;
    const shieldIcon = `<svg class="btn-svg-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.8 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>`;
    const logoutIcon = `<svg class="btn-svg-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>`;

    let userBadgeHtml = "";
    if (user) {
        const roleLabel = role ? role.toUpperCase() : "USER";
        userBadgeHtml = `
            <div class="nav-user-area">
                <span class="nav-user-badge">
                    ${userIcon}
                    <span>${user.username} (${roleLabel})</span>
                </span>
                <button id="btn-logout" class="btn btn-sm btn-secondary">
                    ${logoutIcon} <span>Logout</span>
                </button>
            </div>
        `;
    } else {
        userBadgeHtml = `
            <div class="nav-user-area">
                <a href="login.html" class="btn btn-sm btn-secondary">${userIcon} <span>User Login</span></a>
                <a href="admin_login.html" class="btn btn-sm btn-yellow">${shieldIcon} <span>Admin Login</span></a>
            </div>
        `;
    }

    header.className = "navbar";
    header.innerHTML = `
        <div class="navbar-container">
            <a href="index.html" class="brand">
                <div class="brand-icon">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9C2 11.2 2 11.6 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/></svg>
                </div>
                <div class="brand-text">
                    <h1>UBER & RAPIDO</h1>
                    <p class="subtitle">Ride Hailing & Urban Mobility</p>
                </div>
            </a>

            <button class="nav-mobile-toggle" id="btn-nav-toggle" aria-label="Toggle navigation">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="4" y1="6" x2="20" y2="6"/><line x1="4" y1="12" x2="20" y2="12"/><line x1="4" y1="18" x2="20" y2="18"/></svg>
            </button>

            <div class="nav-center-menu" id="nav-center-menu">
                <ul class="nav-links">
                    ${navLinksHtml}
                </ul>
            </div>

            <div class="nav-right-area" id="nav-right-area">
                ${userBadgeHtml}
            </div>
        </div>
    `;

    // Mobile Hamburger Toggle Handler
    const btnToggle = document.getElementById("btn-nav-toggle");
    const centerMenu = document.getElementById("nav-center-menu");
    const rightArea = document.getElementById("nav-right-area");

    if (btnToggle && centerMenu && rightArea) {
        btnToggle.addEventListener("click", () => {
            const isOpen = centerMenu.classList.contains("mobile-open");
            if (isOpen) {
                centerMenu.classList.remove("mobile-open");
                rightArea.classList.remove("mobile-open");
            } else {
                centerMenu.classList.add("mobile-open");
                rightArea.classList.add("mobile-open");
            }
        });
    }

    const btnLogout = document.getElementById("btn-logout");
    if (btnLogout) {
        btnLogout.addEventListener("click", () => {
            localStorage.removeItem("access_token");
            localStorage.removeItem("user");
            window.location.href = "login.html";
        });
    }
}
