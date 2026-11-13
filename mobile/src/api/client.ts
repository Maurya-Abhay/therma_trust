import { API_BASE_URL } from './config';
import * as SecureStore from 'expo-secure-store';
import axios, { AxiosError, InternalAxiosRequestConfig } from 'axios';

export { API_BASE_URL } from './config';

export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: { 'Content-Type': 'application/json' },
});

export const tokenStore = {
  getAccess: () => SecureStore.getItemAsync('access_token'),
  getRefresh: () => SecureStore.getItemAsync('refresh_token'),
  set: async (access: string, refresh: string) => {
    await SecureStore.setItemAsync('access_token', access);
    await SecureStore.setItemAsync('refresh_token', refresh);
  },
  clear: async () => {
    await SecureStore.deleteItemAsync('access_token');
    await SecureStore.deleteItemAsync('refresh_token');
  },
};

let isRefreshing = false;
let failedQueue: Array<{
  resolve: (token: string) => void;
  reject: (error: Error) => void;
}> = [];

const processQueue = (error: Error | null, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) {
      prom.reject(error);
    } else {
      prom.resolve(token!);
    }
  });
  failedQueue = [];
};

apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    const requestUrl = new URL(config.url ?? '', config.baseURL ?? API_BASE_URL);
    const trustedOrigin = new URL(API_BASE_URL).origin;
    if (requestUrl.origin !== trustedOrigin) {
      throw new Error('Blocked API request to an untrusted origin.');
    }

    const access = await tokenStore.getAccess();
    if (access) {
      config.headers.Authorization = `Bearer ${access}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };
    
    const requestUrl = originalRequest?.url ?? '';
    const isAuthRequest = requestUrl.includes('/auth/login') || requestUrl.includes('/auth/register') || requestUrl.includes('/auth/refresh');
    if (error.response?.status === 401 && originalRequest && !originalRequest._retry && !isAuthRequest) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return apiClient(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;
      let shouldClearTokens = false;

      try {
        const refresh = await tokenStore.getRefresh();
        if (!refresh) {
          shouldClearTokens = true;
          throw new Error('No refresh token');
        }

        const { data } = await axios.post(`${API_BASE_URL}/auth/refresh/`, { refresh });
        if (!data?.access || !data?.refresh) throw new Error('Invalid token refresh response');
        await tokenStore.set(data.access, data.refresh);
        
        processQueue(null, data.access);
        originalRequest.headers.Authorization = `Bearer ${data.access}`;
        return apiClient(originalRequest);
      } catch (err) {
        processQueue(err instanceof Error ? err : new Error('Token refresh failed.'), null);
        if (shouldClearTokens || (axios.isAxiosError(err) && [400, 401, 403].includes(err.response?.status ?? 0))) {
          await tokenStore.clear();
        }
        // Navigation to login will be handled by AuthContext
        return Promise.reject(err);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);