import { API } from "./api.js";
import { renderNavbar } from "./navbar.js";

document.addEventListener("DOMContentLoaded", () => {
    renderNavbar("login");
    const formLogin = document.getElementById("form-login");
    const errorBox = document.getElementById("login-error");
    const usernameInput = document.getElementById("login-username");
    const passwordInput = document.getElementById("login-password");
    const btnTogglePwd = document.getElementById("btn-toggle-pwd");

    const tabRider = document.getElementById("tab-rider");
    const tabDriver = document.getElementById("tab-driver");
    const tabAdmin = document.getElementById("tab-admin");

    function showError(msg) {
        if (errorBox) {
            errorBox.textContent = msg;
            errorBox.style.display = "block";
        }
    }

    function setActiveTab(activeTab, username, password) {
        [tabRider, tabDriver, tabAdmin].forEach(tab => {
            if (tab) tab.classList.remove("active");
        });
        if (activeTab) activeTab.classList.add("active");
        if (usernameInput) usernameInput.value = username;
        if (passwordInput) passwordInput.value = password;
        if (errorBox) errorBox.style.display = "none";
    }

    if (tabRider) {
        tabRider.addEventListener("click", () => setActiveTab(tabRider, "rider1", "rider123"));
    }
    if (tabDriver) {
        tabDriver.addEventListener("click", () => setActiveTab(tabDriver, "driver1", "driver123"));
    }
    if (tabAdmin) {
        tabAdmin.addEventListener("click", () => setActiveTab(tabAdmin, "admin", "admin123"));
    }

    if (btnTogglePwd && passwordInput) {
        btnTogglePwd.addEventListener("click", () => {
            const isPassword = passwordInput.getAttribute("type") === "password";
            passwordInput.setAttribute("type", isPassword ? "text" : "password");
            btnTogglePwd.style.color = isPassword ? "var(--accent-yellow)" : "#94A3B8";
        });
    }

    async function handleLogin(username, password) {
        try {
            const data = await API.login(username, password);
            localStorage.setItem("access_token", data.access_token);
            localStorage.setItem("user", JSON.stringify(data.user));

            // Redirect based on role
            if (data.user.role === "rider") {
                window.location.href = "rides.html";
            } else if (data.user.role === "driver") {
                window.location.href = "drivers.html";
            } else {
                window.location.href = "admin_panel.html";
            }
        } catch (err) {
            showError(err.message || "Invalid username or password.");
        }
    }

    if (formLogin) {
        formLogin.addEventListener("submit", (e) => {
            e.preventDefault();
            const u = usernameInput ? usernameInput.value.trim() : "";
            const p = passwordInput ? passwordInput.value.trim() : "";
            handleLogin(u, p);
        });
    }
});
