<template>
  <section class="device-form">
    <header class="device-heading">
      <div>
        <p class="device-eyebrow">Device configuration</p>
        <h1>{{ isEditing ? 'Edit device' : 'Add device' }}</h1>
      </div>
      <router-link to="/devices" class="device-back">&larr; Back</router-link>
    </header>

    <div v-if="loading" class="device-message" role="status">Loading device…</div>
    <div v-else-if="!canMutate" class="device-message device-message-error" role="alert">
      You do not have permission to manage devices.
    </div>
    <div v-else-if="error" class="device-message device-message-error" role="alert">
      {{ error }}
    </div>

    <form
      v-if="!loading && canMutate && !error"
      @submit.prevent="saveDevice"
      class="device-form-panel"
    >
      <div class="device-grid device-grid-two">
        <div>
          <label>Device Code *</label>
          <input v-model="form.device_code" type="text" required autocomplete="off" />
        </div>
        <div>
          <label>Name *</label>
          <input v-model="form.name" type="text" required autocomplete="off" />
        </div>
      </div>

      <div class="device-grid device-grid-two">
        <div>
          <label>Vendor</label>
          <input v-model="form.vendor" type="text" />
        </div>
        <div>
          <label>Model</label>
          <input v-model="form.model" type="text" />
        </div>
      </div>

      <div>
        <label>Serial Number</label>
        <input v-model="form.serial_number" type="text" />
      </div>

      <div class="device-grid device-grid-host">
        <div>
          <label>Host (IP/DNS)</label>
          <input v-model="form.host" type="text" />
        </div>
        <div>
          <label>Port</label>
          <input v-model.number="form.port" type="number" min="1" max="65535" />
        </div>
      </div>

      <div class="device-grid device-grid-two">
        <div>
          <label>Protocol</label>
          <select v-model="form.protocol">
            <option value="TCP">TCP</option>
            <option value="UDP">UDP</option>
            <option value="HTTP">HTTP</option>
            <option value="HTTPS">HTTPS</option>
            <option value="SDK">SDK</option>
          </select>
        </div>
        <div>
          <label>Lifecycle Status</label>
          <select v-model="form.lifecycle_status">
            <option value="REGISTERED">REGISTERED</option>
            <option value="ACTIVE">ACTIVE</option>
            <option value="DISABLED">DISABLED</option>
          </select>
        </div>
      </div>

      <div>
        <label>Credential (Secret)</label>
        <input
          v-model="form.credential"
          type="password"
          placeholder="Leave blank to keep existing"
          autocomplete="new-password"
        />
      </div>

      <div class="device-checkbox-row">
        <input v-model="form.is_active" id="is_active" type="checkbox" />
        <label for="is_active">Is active</label>
      </div>

      <div class="device-form-actions">
        <button type="submit" :disabled="saving" class="device-button device-button-primary">
          {{ saving ? 'Saving...' : 'Save Device' }}
        </button>
      </div>
    </form>
  </section>
</template>

<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useAuthStore } from '../../stores/auth';

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const isEditing = computed(() => !!route.params.id);
const canMutate = computed(() =>
  ['SUPER_ADMIN', 'INTEGRATION_ADMIN'].includes(authStore.user?.role ?? ''),
);
const loading = ref(false);
const saving = ref(false);
const error = ref('');

const form = ref({
  device_code: '',
  name: '',
  vendor: '',
  model: '',
  serial_number: '',
  host: '',
  port: null as number | null,
  protocol: 'TCP',
  lifecycle_status: 'REGISTERED',
  credential: '',
  is_active: true,
});

onMounted(async () => {
  if (isEditing.value) {
    loading.value = true;
    try {
      const res = await fetch(`/api/devices/${route.params.id}`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      });
      if (!res.ok) throw new Error('Failed to load device');
      const data = await res.json();

      form.value = {
        ...form.value,
        ...data,
        credential: '', // never show the credential
      };
    } catch (e: any) {
      error.value = e.message;
    } finally {
      loading.value = false;
    }
  }
});

async function saveDevice() {
  saving.value = true;
  error.value = '';
  try {
    const payload = { ...form.value };
    if (!payload.credential) {
      delete (payload as any).credential;
    }

    const url = isEditing.value ? `/api/devices/${route.params.id}` : '/api/devices';
    const method = isEditing.value ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${authStore.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to save device');
    }

    router.push('/devices');
  } catch (e: any) {
    error.value = e.message;
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.device-form {
  width: 100%;
  max-width: 820px;
  margin: 0 auto;
}
.device-heading {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1.3rem;
}
.device-eyebrow {
  margin: 0 0 0.3rem;
  color: #75839a;
  font-size: 0.69rem;
  font-weight: 750;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}
.device-heading h1 {
  margin: 0;
  color: #17233b;
  font-size: 1.7rem;
  font-weight: 730;
  letter-spacing: -0.035em;
}
.device-back {
  color: #345d9d;
  font-size: 0.8rem;
  font-weight: 650;
  text-decoration: none;
}
.device-back:hover {
  text-decoration: underline;
}
.device-form-panel {
  display: grid;
  gap: 1rem;
  padding: 1.35rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.75rem;
  background: #fff;
  box-shadow: var(--shadow-card);
}
.device-grid {
  display: grid;
  gap: 1rem;
}
.device-grid-two {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}
.device-grid-host {
  grid-template-columns: minmax(0, 2fr) minmax(7rem, 1fr);
}
.device-grid > div,
.device-form-panel > div:not(.device-checkbox-row):not(.device-form-actions) {
  min-width: 0;
}
.device-form-panel label:not([for='is_active']) {
  display: block;
  margin-bottom: 0.35rem;
  color: #52617a;
  font-size: 0.77rem;
  font-weight: 650;
}
.device-form-panel input:not([type='checkbox']),
.device-form-panel select {
  width: 100%;
  min-height: 2.5rem;
  padding: 0.55rem 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.42rem;
  color: #243149;
  background: #fff;
  font-size: 0.82rem;
}
.device-form-panel input:focus,
.device-form-panel select:focus {
  border-color: #5480c8;
}
.device-checkbox-row {
  display: flex;
  align-items: center;
  gap: 0.55rem;
  color: #52617a;
  font-size: 0.8rem;
}
.device-checkbox-row input {
  accent-color: #2859b8;
}
.device-checkbox-row label {
  cursor: pointer;
}
.device-form-actions {
  display: flex;
  justify-content: flex-end;
  padding-top: 0.75rem;
  border-top: 1px solid #edf0f5;
}
.device-button {
  display: inline-flex;
  min-height: 2.45rem;
  align-items: center;
  justify-content: center;
  padding: 0.5rem 0.9rem;
  border: 1px solid transparent;
  border-radius: 0.45rem;
  font-size: 0.78rem;
  font-weight: 650;
  cursor: pointer;
}
.device-button-primary {
  color: #fff;
  background: #2859b8;
}
.device-button-primary:hover {
  background: #1e438f;
}
.device-button:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
.device-message {
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.6rem;
  color: #63728a;
  background: #fff;
}
.device-message-error {
  border-color: #f1d2d2;
  color: #a33232;
  background: #fff8f8;
}
@media (max-width: 620px) {
  .device-grid-two,
  .device-grid-host {
    grid-template-columns: minmax(0, 1fr);
  }
  .device-form-panel {
    padding: 1rem;
  }
  .device-heading {
    align-items: flex-start;
  }
}
</style>
