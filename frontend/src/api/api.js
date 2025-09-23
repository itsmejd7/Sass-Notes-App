import axios from 'axios';

const baseURL = (() => {
  if (typeof window !== 'undefined') {
    const configured = import.meta.env.VITE_API_BASE_URL;
    if (configured) return configured;
    // Default: prod uses same-origin proxy /api, local uses localhost:5000
    const isLocal = /localhost|127\.0\.0\.1/.test(window.location.hostname);
    return isLocal ? 'http://localhost:5000' : '/api';
  }
  return process.env.VITE_API_BASE_URL || 'http://localhost:5000';
})();

const api = axios.create({
  baseURL,
});

api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Normalize responses and errors so callers can use data directly
api.interceptors.response.use(
  (response) => response.data,
  (error) => {
    const status = error?.response?.status;
    if (status === 401) {
      try {
        localStorage.removeItem('token');
        localStorage.removeItem('tenantSlug');
      } catch {}
      if (typeof window !== 'undefined' && window.location?.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    const normalized = new Error(error?.response?.data?.error || error.message || 'Request failed');
    normalized.status = status;
    normalized.data = error?.response?.data;
    return Promise.reject(normalized);
  }
);

export default api;
