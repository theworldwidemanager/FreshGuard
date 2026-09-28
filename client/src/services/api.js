import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL.replace(/\/$/, '')
  : 'http://localhost:5000';

const apiClient = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  timeout: 8000,
  headers: {
    'Content-Type': 'application/json'
  }
});

export const api = {
  getDeviceStatus: async (deviceId = 'freshguard-fridge-01') => {
    const response = await apiClient.get('/device/status', { params: { deviceId } });
    return response.data;
  },

  getInventory: async () => {
    const response = await apiClient.get('/inventory');
    return response.data;
  },

  getFoodHistory: async (limit = 50) => {
    const response = await apiClient.get('/food-history', { params: { limit } });
    return response.data;
  },

  getHealth: async () => {
    const response = await apiClient.get('/health');
    return response.data;
  }
};

export default api;
