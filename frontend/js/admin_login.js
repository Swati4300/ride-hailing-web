import { API } from "./api.js";
import { renderNavbar } from "./navbar.js";

document.addEventListener("DOMContentLoaded", () => {
    renderNavbar("admin_login");
    const formLogin = document.getElementById("form-admin-login");
    const errorBox = document.getElementById("admin-error");

    formLogin.addEventListener("submit", async (e) => {
        e.preventDefault();
        const username = document.getElementById("admin-username").value;
        const password = document.getElementById("admin-password").value;

        try {
            const data = await API.login(username, password);
            if (data.user.role !== "admin") {
                errorBox.textContent = "Access Denied: Account does not have Admin privileges.";
                errorBox.style.display = "block";
                return;
            }

            localStorage.setItem("access_token", data.access_token);
            localStorage.setItem("user", JSON.stringify(data.user));

            window.location.href = "admin_panel.html";
        } catch (err) {
            errorBox.textContent = err.message || "Invalid Admin credentials.";
            errorBox.style.display = "block";
        }
    });
});
