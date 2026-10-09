<template>
  <div class="login-container">
    <div class="login-card">
      <h1>TimeBridge Login</h1>
      <p class="subtitle">Middleware Integrasi Kehadiran Perusahaan</p>

      <form @submit.prevent="handleLogin" class="login-form">
        <div class="form-group">
          <label for="email">Email</label>
          <input type="email" id="email" v-model="email" required placeholder="admin@example.com" />
        </div>

        <div class="form-group">
          <label for="password">Kata Sandi</label>
          <input type="password" id="password" v-model="password" required placeholder="••••••••" />
        </div>

        <div v-if="error" class="error-message">
          {{ error }}
        </div>

        <button type="submit" :disabled="loading" class="login-button">
          {{ loading ? 'Masuk...' : 'Masuk' }}
        </button>
      </form>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth';

const router = useRouter();
const authStore = useAuthStore();

const email = ref('');
const password = ref('');
const error = ref('');
const loading = ref(false);

async function handleLogin() {
  if (!email.value || !password.value) return;

  loading.value = true;
  error.value = '';

  const result = await authStore.login(email.value, password.value);

  if (result.success) {
    // Navigate to dashboard after successful login (user already loaded)
    router.push('/');
  } else {
    error.value = result.error;
  }

  loading.value = false;
}
</script>

<style scoped>
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  width: 100%;
  padding: 1.25rem;
  background-color: var(--color-canvas);
}

.login-card {
  background: white;
  padding: 2.5rem;
  border-radius: 12px;
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
  width: 100%;
  max-width: 400px;
}

h1 {
  margin: 0 0 0.5rem;
  color: var(--color-ink);
  font-size: 1.8rem;
  text-align: center;
}

.subtitle {
  text-align: center;
  color: var(--color-muted);
  margin-bottom: 2rem;
  font-size: 0.9rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 500;
  color: #34495e;
}

input {
  width: 100%;
  padding: 0.75rem;
  border: 1px solid #dcdfe6;
  border-radius: 6px;
  font-size: 1rem;
  transition: border-color 0.2s;
  box-sizing: border-box;
}

input:focus {
  outline: none;
  border-color: var(--color-primary);
  box-shadow: 0 0 0 3px rgb(40 89 184 / 12%);
}

.error-message {
  color: #e74c3c;
  margin-bottom: 1rem;
  font-size: 0.9rem;
  text-align: center;
  background: #fdf0ed;
  padding: 0.5rem;
  border-radius: 4px;
}

.login-button {
  width: 100%;
  padding: 0.8rem;
  background-color: var(--color-primary);
  color: white;
  border: none;
  border-radius: 6px;
  font-size: 1rem;
  font-weight: 600;
  cursor: pointer;
  transition: background-color 0.2s;
}

.login-button:hover {
  background-color: var(--color-primary-dark);
}

.login-button:disabled {
  background-color: #95a5a6;
  cursor: not-allowed;
}
</style>
