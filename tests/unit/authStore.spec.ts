// tests/unit/authStore.spec.ts
import { setActivePinia, createPinia } from 'pinia';
import { vi, describe, it, expect, beforeEach } from 'vitest';
import { useAuthStore } from '../../frontend/src/stores/auth';
import axios from 'axios';

vi.mock('axios');
const mockedAxios = vi.mocked(axios);

class LocalStorageMock {
  private store: Record<string, string> = {};
  getItem(key: string) {
    return this.store[key] ?? null;
  }
  setItem(key: string, value: string) {
    this.store[key] = value;
  }
  removeItem(key: string) {
    delete this.store[key];
  }
  clear() {
    this.store = {};
  }
}
Object.defineProperty(window, 'localStorage', { value: new LocalStorageMock() });

describe('auth store', () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    mockedAxios.post.mockReset();
    mockedAxios.get.mockReset();
    window.localStorage.clear();
  });

  it('successful login populates token, user and isAuthenticated', async () => {
    const token = 'FAKE_JWT';
    const user = { id: '1', email: 'test@example.com', role: 'ADMIN', status: 'ACTIVE' };
    mockedAxios.post.mockResolvedValueOnce({ data: { token, user } });
    mockedAxios.get.mockResolvedValueOnce({ data: { user } });

    const auth = useAuthStore();
    const loginResult = await auth.login('test@example.com', 'pwd');
    expect(loginResult.success).toBe(true);
    expect(auth.token).toBe(token);
    expect(auth.user).toEqual(user);
    const fetched = await auth.fetchUser();
    expect(fetched).toEqual(user);
    expect(auth.isAuthenticated).toBe(true);
    expect(window.localStorage.getItem('token')).toBe(token);
  });

  it('login succeeds but fetchUser fails clears auth state', async () => {
    const token = 'FAKE_JWT';
    const user = { id: '1', email: 'test@example.com', role: 'ADMIN', status: 'ACTIVE' };
    mockedAxios.post.mockResolvedValueOnce({ data: { token, user } });
    mockedAxios.get.mockRejectedValueOnce(new Error('Network error'));

    const auth = useAuthStore();
    const loginResult = await auth.login('test@example.com', 'pwd');
    expect(loginResult.success).toBe(true);
    const fetched = await auth.fetchUser();
    expect(fetched).toBeNull();
    expect(auth.token).toBeNull();
    expect(auth.user).toBeNull();
    expect(auth.isAuthenticated).toBe(false);
    expect(window.localStorage.getItem('token')).toBeNull();
  });
});
