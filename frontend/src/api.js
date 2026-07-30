import axios from 'axios';

const baseURL = import.meta.env.VITE_API_BASE_URL 
  ? `${import.meta.env.VITE_API_BASE_URL.replace(/\/$/, '')}/api` 
  : '/api';

const api = axios.create({
  baseURL,
  timeout: 15000,
});

export const getCloudLatest = () => api.get('/cloud/latest');
export const getCloudHistory = (limit = 50) => api.get(`/cloud/history?limit=${limit}`);

export const getAQICurrent = () => api.get('/aqi/current');
export const getAQIForecast = (limit = 24) => api.get(`/aqi/forecast?limit=${limit}`);
export const getAQIHistorical = (limit = 50) => api.get(`/aqi/historical?limit=${limit}`);
export const getWeatherCurrent = () => api.get('/weather/current');
export const getWeatherHourly = (limit = 24) => api.get(`/weather/hourly?limit=${limit}`);

export default api;

