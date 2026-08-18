import axios from "axios";

export const BASE_URL = process.env.REACT_APP_API_URL || "http://127.0.0.1:8000";

const api = axios.create({
  baseURL: BASE_URL,
});


api.interceptors.request.use((config) => {
  const token = localStorage.getItem("access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let isRefreshing = false;
let pendingRequests = [];

function resolvePendingRequests(newToken) {
  pendingRequests.forEach((cb) => cb(newToken));
  pendingRequests = [];
}


api.interceptors.response.use(
  (response) => response,
  (error) => {
    const originalRequest = error.config;
    const isAuthEndpoint =
      originalRequest.url.includes("/api/token/") ||
      originalRequest.url.includes("/register/");

    if (
      error.response &&
      error.response.status === 401 &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      const refreshToken = localStorage.getItem("refresh");
      if (!refreshToken) {
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (!isRefreshing) {
        isRefreshing = true;
        axios
          .post(`${BASE_URL}/api/token/refresh/`, { refresh: refreshToken })
          .then((res) => {
            const newAccess = res.data.access;
            localStorage.setItem("access", newAccess);
            isRefreshing = false;
            resolvePendingRequests(newAccess);
          })
          .catch((refreshError) => {
            isRefreshing = false;
            pendingRequests = [];
            localStorage.removeItem("access");
            localStorage.removeItem("refresh");
            window.location.href = "/"; // refresh token also expired — back to login
          });
      }

      return new Promise((resolve, reject) => {
        pendingRequests.push((newToken) => {
          if (!newToken) {
            reject(error);
            return;
          }
          originalRequest.headers.Authorization = `Bearer ${newToken}`;
          resolve(api(originalRequest));
        });
      });
    }

    return Promise.reject(error);
  }
);

export default api;