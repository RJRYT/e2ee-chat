import axios from 'axios';
import { getOrCreateDeviceId } from "../utils/deviceId";

const axiosInstance = axios.create({
  baseURL: import.meta.env.VITE_API_URL,
});

// Attach JWT token to every request if available
axiosInstance.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) config.headers.Authorization = `Bearer ${token}`;
    config.headers["x-device-id"] = getOrCreateDeviceId();
    return config;
  },
  (error) => Promise.reject(error)
);

export default axiosInstance;
