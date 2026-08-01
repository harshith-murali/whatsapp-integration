import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:3000/api",
  withCredentials: true,
});

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
