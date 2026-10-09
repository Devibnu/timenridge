<template>
  <section class="devices-page">
    <header class="devices-heading">
      <div>
        <p class="devices-eyebrow">Perangkat keras terhubung</p>
        <h1>Perangkat</h1>
        <p>Tinjau perangkat kehadiran yang terdaftar dan laporan kesehatan koneksinya.</p>
      </div>
      <router-link v-if="canMutate" to="/devices/new" class="device-button device-button-primary">
        Tambah perangkat
      </router-link>
    </header>

    <div v-if="loading" class="device-state" role="status" aria-live="polite">
      <span class="device-spinner" aria-hidden="true"></span>Memuat perangkat...
    </div>
    <div v-else-if="error" class="device-state device-error" role="alert">
      <div>
        <strong>Perangkat tidak dapat dimuat</strong>
        <p>{{ error }}</p>
      </div>
      <button class="device-button device-button-secondary" type="button" @click="loadDevices">
        Coba lagi
      </button>
    </div>

    <section v-else class="device-table-card" aria-label="Device records">
      <div
        class="device-table-scroll"
        tabindex="0"
        aria-label="Devices table, horizontally scrollable"
      >
        <table>
          <thead>
            <tr>
              <th scope="col">Perangkat</th>
              <th scope="col">Vendor / model</th>
              <th scope="col">Siklus hidup</th>
              <th scope="col">Koneksi</th>
              <th scope="col">Aksi</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="device in devices" :key="device.id">
              <td>
                <strong>{{ device.name }}</strong>
                <small>{{ device.device_code }}</small>
              </td>
              <td>
                {{ device.vendor || '—' }}<span v-if="device.model"> / {{ device.model }}</span>
              </td>
              <td>
                <span class="device-status" :class="lifecycleClass(device.lifecycle_status)">{{
                  formatStatus(device.lifecycle_status)
                }}</span>
              </td>
              <td>
                <span class="device-status" :class="healthClass(device.status)">{{
                  formatStatus(device.status)
                }}</span>
              </td>
              <td class="device-actions">
                <router-link :to="`/devices/${device.id}`">Lihat</router-link>
                <router-link v-if="canMutate" :to="`/devices/${device.id}/edit`">Edit</router-link>
              </td>
            </tr>
            <tr v-if="devices.length === 0">
              <td colspan="5" class="device-empty">
                <strong>Tidak ada perangkat yang ditemukan</strong>
                <span>Catatan perangkat yang terdaftar akan muncul di sini.</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <p class="device-table-note">
        Status perangkat mencerminkan informasi terbaru yang tersedia dari API.
      </p>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '../../stores/auth';

const authStore = useAuthStore();
const devices = ref<any[]>([]);
const loading = ref(true);
const error = ref('');

const canMutate = computed(() =>
  ['SUPER_ADMIN', 'INTEGRATION_ADMIN'].includes(authStore.user?.role ?? ''),
);

async function loadDevices(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const res = await fetch('/api/devices', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (!res.ok) throw new Error('Failed to fetch devices');
    devices.value = await res.json();
  } catch (e: unknown) {
    error.value = e instanceof Error ? e.message : 'Failed to fetch devices';
  } finally {
    loading.value = false;
  }
}

function formatStatus(value: string): string {
  return value
    .replaceAll('_', ' ')
    .toLowerCase()
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function lifecycleClass(value: string): string {
  if (value === 'ACTIVE') return 'status-positive';
  if (value === 'DISABLED') return 'status-negative';
  return 'status-neutral';
}

function healthClass(value: string): string {
  if (value === 'ONLINE') return 'status-positive';
  if (value === 'DEGRADED') return 'status-warning';
  if (value === 'OFFLINE') return 'status-negative';
  return 'status-neutral';
}

onMounted(() => void loadDevices());
</script>

<style scoped>
.devices-page {
  width: 100%;
  max-width: 1440px;
  margin: 0 auto;
  color: #17233b;
}
.devices-heading {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.35rem;
}
.devices-eyebrow {
  margin: 0 0 0.35rem;
  color: #75839a;
  font-size: 0.69rem;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.devices-heading h1 {
  margin: 0 0 0.35rem;
  color: #17233b;
  font-size: 1.75rem;
  font-weight: 730;
  letter-spacing: -0.035em;
}
.devices-heading p:last-child {
  margin: 0;
  color: #687791;
  font-size: 0.85rem;
}
.device-button {
  display: inline-flex;
  min-height: 2.45rem;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.85rem;
  border: 1px solid transparent;
  border-radius: 0.45rem;
  font-size: 0.78rem;
  font-weight: 650;
  text-decoration: none;
  cursor: pointer;
}
.device-button-primary {
  color: #fff;
  background: #2859b8;
}
.device-button-primary:hover {
  background: #1e438f;
}
.device-button-secondary {
  border-color: #d8e0eb;
  color: #465672;
  background: #fff;
}
.device-table-card,
.device-state {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 0.7rem;
  background: #fff;
  box-shadow: var(--shadow-card);
}
.device-table-scroll {
  width: 100%;
  min-width: 0;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}
table {
  width: 100%;
  min-width: 680px;
  border-collapse: collapse;
  font-size: 0.82rem;
}
thead {
  background: #f7f9fc;
}
th {
  padding: 0.78rem 1rem;
  color: #748198;
  font-size: 0.67rem;
  font-weight: 750;
  letter-spacing: 0.06em;
  text-align: left;
  text-transform: uppercase;
  white-space: nowrap;
}
td {
  padding: 0.85rem 1rem;
  border-top: 1px solid #edf0f5;
  color: #43516a;
  vertical-align: middle;
}
td strong,
td small {
  display: block;
}
td strong {
  color: #273650;
  font-weight: 650;
}
td small {
  margin-top: 0.2rem;
  color: #8290a5;
  font-size: 0.72rem;
}
.device-status {
  display: inline-flex;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  white-space: nowrap;
}
.status-positive {
  color: #18734a;
  background: #e8f6ef;
}
.status-warning {
  color: #9a5b0b;
  background: #fff3dc;
}
.status-negative {
  color: #ad3434;
  background: #fff0f0;
}
.status-neutral {
  color: #58667c;
  background: #eef2f6;
}
.device-actions {
  white-space: nowrap;
}
.device-actions a {
  margin-right: 0.75rem;
  font-size: 0.77rem;
  font-weight: 650;
  text-decoration: none;
}
.device-actions a:last-child {
  margin-right: 0;
}
.device-actions a:hover {
  text-decoration: underline;
}
.device-empty {
  height: 9rem;
  color: #75839a;
  text-align: center;
}
.device-empty strong,
.device-empty span {
  display: block;
}
.device-empty strong {
  margin-bottom: 0.3rem;
  color: #33425c;
}
.device-table-note {
  margin: 0;
  padding: 0.7rem 1rem;
  border-top: 1px solid #edf0f5;
  color: #8290a5;
  font-size: 0.7rem;
}
.device-state {
  display: flex;
  min-height: 120px;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.2rem;
  color: #6b7990;
  font-size: 0.85rem;
}
.device-error {
  justify-content: space-between;
  border-color: #f1d2d2;
  color: #a33232;
}
.device-error p {
  margin: 0.25rem 0 0;
  font-size: 0.78rem;
}
.device-spinner {
  width: 1rem;
  height: 1rem;
  border: 2px solid #d8e1ef;
  border-top-color: #2859b8;
  border-radius: 50%;
  animation: device-spin 0.75s linear infinite;
}
@keyframes device-spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 600px) {
  .devices-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .device-button-primary {
    width: 100%;
  }
}
</style>
