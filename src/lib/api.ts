import axios from 'axios';
import { reportApiFailure } from "@/lib/monitoring";

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5001/api';

const api = axios.create({
  baseURL: API_URL,
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && token !== "null" && token !== "undefined") {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    reportApiFailure(error, {
      source: "api",
      url: error?.config?.url,
      method: error?.config?.method,
      status: error?.response?.status,
    });
    return Promise.reject(error);
  }
);

export default api;
