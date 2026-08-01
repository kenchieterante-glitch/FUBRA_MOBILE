import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Set this to your CodeIgniter 4 server, e.g.:
//   http://192.168.1.10:8080/api   (physical device — use your LAN IP, not localhost)
//   http://10.0.2.2:8080/api       (Android emulator — 10.0.2.2 maps to host machine)
export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || 'http://10.0.2.2:8080/api';

const client = axios.create({
  baseURL: API_BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
});

// Attach the auth token to every request once logged in
client.interceptors.request.use(async (config) => {
  const token = await AsyncStorage.getItem('fu_ubra_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Centralize error handling so screens get a clean message
client.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.message ||
      error.message ||
      'Something went wrong connecting to FU_UBRA.';
    return Promise.reject(new Error(message));
  }
);

export default client;
