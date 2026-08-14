import axios from "axios";

// Defaults to a same-origin relative path so a built image runs on any host
// without rebuilding: in production the reverse proxy serves the API under
// /api on the same origin. VITE_API_URL still overrides it for local dev,
// where Vite (5173) and the API (3000) are on different ports.
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  withCredentials: true,
});

const getCookie = (name: string): string | null => {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.split("=")[1] || "") : null;
};

let csrfPromise: Promise<void> | null = null;

const ensureCsrfToken = async () => {
  if (getCookie("csrf_token")) return;
  if (!csrfPromise) {
    csrfPromise = api.get("/auth/csrf").then(() => undefined).finally(() => {
      csrfPromise = null;
    });
  }
  await csrfPromise;
};

let onUnauthorizedCallback: (() => void) | null = null;

export const registerUnauthorizedHandler = (callback: () => void) => {
  onUnauthorizedCallback = callback;
};

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      if (onUnauthorizedCallback) {
        onUnauthorizedCallback();
      }
    }
    return Promise.reject(error);
  }
);

api.interceptors.request.use(async (config) => {
  const method = (config.method || "get").toUpperCase();
  if (!["GET", "HEAD", "OPTIONS"].includes(method)) {
    await ensureCsrfToken();
    const csrfToken = getCookie("csrf_token");
    if (csrfToken) {
      config.headers.set("x-csrf-token", csrfToken);
    }
  }
  return config;
});
