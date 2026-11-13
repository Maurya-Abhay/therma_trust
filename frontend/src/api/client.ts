import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { API_BASE_URL } from "./config";
import { isUnreachable, reportReachable } from "../offline/connectivity";

const ACCESS_TOKEN_KEY = "hvacr_access_token";
const REFRESH_TOKEN_KEY = "hvacr_refresh_token";

// The service worker keeps last-known API responses for offline reads. They're
// per-device, not per-user, so they must go the moment the login does.
function clearCachedApiData() {
  if (!("caches" in window)) return;
  void caches.keys().then((keys) => keys.filter((key) => key.startsWith("thermatrust-api-")).forEach((key) => caches.delete(key)));
}

export const tokenStore = {
  getAccess: () => localStorage.getItem(ACCESS_TOKEN_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_TOKEN_KEY),
  set: (access: string, refresh: string) => {
    localStorage.setItem(ACCESS_TOKEN_KEY, access);
    localStorage.setItem(REFRESH_TOKEN_KEY, refresh);
  },
  setAccess: (access: string) => localStorage.setItem(ACCESS_TOKEN_KEY, access),
  clear: () => {
    localStorage.removeItem(ACCESS_TOKEN_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    clearCachedApiData();
  },
};

export const apiClient = axios.create({ baseURL: API_BASE_URL });

apiClient.interceptors.request.use((config) => {
  const token = tokenStore.getAccess();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

let refreshPromise: Promise<string> | null = null;

async function refreshAccessToken(): Promise<string> {
  const refresh = tokenStore.getRefresh();
  if (!refresh) throw new Error("No refresh token available");
  const { data } = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh });
  tokenStore.setAccess(data.access);
  return data.access;
}

apiClient.interceptors.response.use(
  (response) => {
    // The service worker tags answers it served from its cache: those prove
    // nothing about the server being up (it's the opposite, in fact).
    reportReachable(response.headers["x-served-from-cache"] !== "1");
    return response;
  },
  async (error: AxiosError) => {
    // A normal HTTP answer (even 4xx/500) proves the app is up; silence or a gateway error doesn't.
    reportReachable(!isUnreachable(error));
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    const isAuthEndpoint = originalRequest?.url?.includes("/auth/login") || originalRequest?.url?.includes("/auth/refresh");

    if (error.response?.status === 401 && !originalRequest._retry && !isAuthEndpoint && tokenStore.getRefresh()) {
      originalRequest._retry = true;
      try {
        refreshPromise = refreshPromise ?? refreshAccessToken();
        const newAccess = await refreshPromise;
        refreshPromise = null;
        originalRequest.headers.Authorization = `Bearer ${newAccess}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        refreshPromise = null;
        // Only a rejected refresh token means the session is really over; a
        // dropped connection (or sleeping host) mid-refresh must not log a technician out.
        if (!isUnreachable(refreshError)) {
          tokenStore.clear();
          window.location.href = "/login";
        }
        return Promise.reject(refreshError);
      }
    }
    return Promise.reject(error);
  }
);
