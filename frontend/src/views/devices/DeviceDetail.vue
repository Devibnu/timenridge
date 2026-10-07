<template>
  <section class="device-detail">
    <header class="detail-heading">
      <div>
        <p class="detail-eyebrow">Connected hardware</p>
        <h1>Device details</h1>
      </div>
      <div class="detail-actions">
        <router-link to="/devices" class="detail-back">&larr; Back</router-link>
        <router-link
          v-if="canMutate && device"
          :to="`/devices/${device.id}/edit`"
          class="detail-button detail-button-primary"
        >
          Edit
        </router-link>
        <button
          v-if="canMutate && device"
          @click="testConnection"
          class="detail-button detail-button-secondary"
          :disabled="testing"
        >
          {{ testing ? 'Testing...' : 'Test Connection' }}
        </button>
      </div>
    </header>

    <div v-if="loading" class="detail-state" role="status">Loading device…</div>
    <div v-else-if="error" class="detail-state detail-state-error" role="alert">{{ error }}</div>

    <div v-else-if="device" class="device-detail-card">
      <div
        v-if="testResult"
        class="detail-alert"
        :class="testResult.success ? 'detail-alert-success' : 'detail-alert-error'"
        role="status"
      >
        {{ testResult.message }}
      </div>

      <div class="device-details-grid">
        <div class="device-detail-field">
          <p>Device Code</p>
          <strong>{{ device.device_code }}</strong>
        </div>
        <div class="device-detail-field">
          <p>Name</p>
          <strong>{{ device.name }}</strong>
        </div>
        <div class="device-detail-field">
          <p>Vendor / Model</p>
          <strong>{{ device.vendor || '-' }} / {{ device.model || '-' }}</strong>
        </div>
        <div class="device-detail-field">
          <p>Serial Number</p>
          <strong>{{ device.serial_number || '-' }}</strong>
        </div>
        <div class="device-detail-field">
          <p>Host : Port</p>
          <strong>{{ device.host || '-' }} : {{ device.port || '-' }}</strong>
        </div>
        <div class="device-detail-field">
          <p>Protocol</p>
          <strong>{{ device.protocol || '-' }}</strong>
        </div>
        <div class="device-detail-field">
          <p>Lifecycle Status</p>
          <span class="detail-status" :class="lifecycleClass(device.lifecycle_status)">{{
            device.lifecycle_status
          }}</span>
        </div>
        <div class="device-detail-field">
          <p>Health Status</p>
          <span class="detail-status" :class="healthClass(device.status)">{{ device.status }}</span>
        </div>
        <div class="device-detail-field">
          <p>Credential Configured?</p>
          <strong :class="device.credential_configured ? 'detail-good' : 'detail-bad'">
            {{ device.credential_configured ? 'Yes' : 'No' }}
          </strong>
        </div>
        <div class="device-detail-field">
          <p>Last Seen</p>
          <strong>
            {{ device.last_seen_at ? new Date(device.last_seen_at).toLocaleString() : 'Never' }}
          </strong>
        </div>
      </div>

      <div v-if="device.last_error_message" class="device-error-detail" role="alert">
        <strong> Last Error ({{ new Date(device.last_error_at).toLocaleString() }}): </strong>
        <p>{{ device.last_error_message }}</p>
        <p>Consecutive failures: {{ device.consecutive_failures }}</p>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../../stores/auth';

const route = useRoute();
const authStore = useAuthStore();
const device = ref<any>(null);
const loading = ref(true);
const error = ref('');
const testing = ref(false);
const testResult = ref<{ success: boolean; message: string } | null>(null);

const canMutate = computed(() => {
  const role = authStore.user?.role;
  return role === 'SUPER_ADMIN' || role === 'INTEGRATION_ADMIN';
});

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

async function fetchDevice() {
  try {
    const res = await fetch(`/api/devices/${route.params.id}`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (!res.ok) throw new Error('Device not found');
    device.value = await res.json();
  } catch (e: any) {
    error.value = e.message;
  } finally {
    loading.value = false;
  }
}

async function testConnection() {
  testing.value = true;
  testResult.value = null;
  try {
    const res = await fetch(`/api/devices/${device.value.id}/test-connection`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${authStore.token}` },
    });

    const data = await res.json();

    if (!res.ok) {
      testResult.value = { success: false, message: data.error || 'Connection failed' };
    } else {
      testResult.value = { success: true, message: 'Connection successful!' };
    }
  } catch (e: any) {
    testResult.value = { success: false, message: e.message };
  } finally {
    testing.value = false;
  }
}

onMounted(() => {
  fetchDevice();
});
</script>

<style scoped>
.device-detail {
  width: 100%;
  max-width: 1000px;
  margin: 0 auto;
}
.detail-heading {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.3rem;
}
.detail-eyebrow {
  margin: 0 0 0.3rem;
  color: #75839a;
  font-size: 0.69rem;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.detail-heading h1 {
  margin: 0;
  color: #17233b;
  font-size: 1.7rem;
  font-weight: 730;
  letter-spacing: -0.035em;
}
.detail-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.5rem;
}
.detail-back {
  margin-right: 0.35rem;
  color: #345d9d;
  font-size: 0.8rem;
  font-weight: 650;
  text-decoration: none;
}
.detail-back:hover {
  text-decoration: underline;
}
.detail-button {
  display: inline-flex;
  min-height: 2.4rem;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.8rem;
  border: 1px solid transparent;
  border-radius: 0.45rem;
  font-size: 0.76rem;
  font-weight: 650;
  text-decoration: none;
  cursor: pointer;
}
.detail-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.detail-button-primary {
  color: #fff;
  background: #2859b8;
}
.detail-button-primary:hover {
  background: #1e438f;
}
.detail-button-secondary {
  border-color: #d8e0eb;
  color: #465672;
  background: #fff;
}
.device-detail-card {
  display: grid;
  gap: 1.25rem;
  padding: 1.35rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background: #fff;
  box-shadow: var(--shadow-card);
}
.device-details-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0;
}
.device-detail-field {
  min-width: 0;
  padding: 0.9rem 0.75rem;
  border-bottom: 1px solid #edf0f5;
}
.device-detail-field p {
  margin: 0 0 0.35rem;
  color: #78869b;
  font-size: 0.72rem;
}
.device-detail-field strong {
  display: block;
  overflow-wrap: anywhere;
  color: #2d3b54;
  font-size: 0.84rem;
  font-weight: 650;
}
.detail-status {
  display: inline-flex;
  padding: 0.22rem 0.55rem;
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
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
  color: #56657d;
  background: #eef2f6;
}
.detail-good {
  color: #18734a !important;
}
.detail-bad {
  color: #ad3434 !important;
}
.device-error-detail,
.detail-alert {
  padding: 0.9rem 1rem;
  border: 1px solid #f1d2d2;
  border-radius: 0.55rem;
  color: #a33232;
  background: #fff7f7;
  font-size: 0.8rem;
}
.device-error-detail p {
  margin: 0.3rem 0 0;
}
.detail-alert-success {
  border-color: #b9e3cb;
  color: #18734a;
  background: #eef9f2;
}
.detail-state {
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.6rem;
  color: #63728a;
  background: #fff;
}
.detail-state-error {
  border-color: #f1d2d2;
  color: #a33232;
  background: #fff8f8;
}
@media (max-width: 620px) {
  .detail-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .detail-actions {
    width: 100%;
  }
  .device-details-grid {
    grid-template-columns: minmax(0, 1fr);
  }
  .device-detail-card {
    padding: 0.8rem;
  }
}
</style>
