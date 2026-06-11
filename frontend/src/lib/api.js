import axios from "axios";
import { toast } from "sonner";

const api = axios.create({
  baseURL: `${process.env.REACT_APP_BACKEND_URL || ""}/api`,
});

// Attach JWT token from localStorage to every request
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers["Authorization"] = `Bearer ${token}`;

    // Warn once if token expires within 24 hours
    try {
      const payload = JSON.parse(atob(token.split(".")[1]));
      if (payload.exp) {
        const expiresIn = payload.exp * 1000 - Date.now();
        const oneDayMs = 24 * 60 * 60 * 1000;
        if (expiresIn > 0 && expiresIn < oneDayMs) {
          const alreadyWarned = sessionStorage.getItem("token_expiry_warned");
          if (!alreadyWarned) {
            sessionStorage.setItem("token_expiry_warned", "1");
            const hours = Math.ceil(expiresIn / (60 * 60 * 1000));
            toast.warning(`Ihre Sitzung läuft in ${hours} Stunde${hours !== 1 ? "n" : ""} ab. Bitte melden Sie sich erneut an.`, {
              duration: 8000,
            });
          }
        }
      }
    } catch {
      // malformed token — ignore, let the server reject it
    }
  }
  return config;
});

// Global 401 handler: clear token and redirect to login
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      sessionStorage.removeItem("token_expiry_warned");
      delete axios.defaults.headers.common["Authorization"];
      // Only redirect if not already on the login page
      if (!window.location.pathname.startsWith("/login") && !window.location.pathname.startsWith("/admin")) {
        window.location.href = "/login";
      }
    }
    return Promise.reject(error);
  }
);

export default api;
