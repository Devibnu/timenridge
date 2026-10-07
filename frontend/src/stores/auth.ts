import { defineStore } from 'pinia';
import axios from 'axios';
import { ref, computed } from 'vue';

const api = axios.create({
  baseURL: '/api',
});

export const authenticatedApi = api;

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface User {
  id: string;
  email: string;
  role: string;
  status: string;
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null);
  const token = ref<string | null>(localStorage.getItem('token') || null);

  const isAuthenticated = computed(() => !!token.value && !!user.value);

  async function login(email: string, password: string) {
    try {
      const response = await api.post('/auth/login', { email, password });
      token.value = response.data.token;
      if (token.value) {
        localStorage.setItem('token', token.value);
      }
      // After storing token, fetch the user profile
      const fetchedUser = await fetchUser();
      if (fetchedUser) {
        return { success: true };
      } else {
        // If fetching user fails, clear auth state
        token.value = null;
        localStorage.removeItem('token');
        return { success: false, error: 'Failed to load user profile' };
      }
    } catch (error: any) {
      // On request error, ensure auth state is cleared
      token.value = null;
      user.value = null;
      localStorage.removeItem('token');
      return {
        success: false,
        error: error.response?.data?.error || 'Login failed',
      };
    }
  }

  async function logout() {
    try {
      if (token.value) {
        await api.post('/auth/logout');
      }
    } finally {
      token.value = null;
      user.value = null;
      localStorage.removeItem('token');
    }
  }

  async function fetchUser() {
    try {
      if (!token.value) return null;
      const response = await api.get('/auth/me');
      user.value = response.data.user;
      return user.value;
    } catch (error) {
      token.value = null;
      user.value = null;
      localStorage.removeItem('token');
      return null;
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    login,
    logout,
    fetchUser,
  };
});
