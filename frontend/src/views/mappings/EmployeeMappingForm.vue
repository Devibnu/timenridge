<template>
  <section class="mapping-form-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">Pemetaan pegawai</p>
        <h1>{{ isEditing ? 'Edit pemetaan' : 'Buat pemetaan' }}</h1>
      </div>
      <router-link class="button secondary" to="/employee-mappings">Kembali ke pemetaan</router-link>
    </header>

    <div v-if="!canUpdate" class="notice error" role="alert">
      Anda tidak memiliki izin untuk mengelola pemetaan pegawai.
    </div>
    <div v-else-if="loading" class="state-panel" role="status">Memuat formulir pemetaan…</div>
    <div v-else-if="loadError" class="notice error" role="alert">{{ loadError }}</div>
    <div v-else-if="saved" class="notice success" role="status">
      {{ saved }}
      <router-link to="/employee-mappings">Kembali ke Pemetaan Pegawai</router-link>
    </div>
    <form v-else class="form-panel" @submit.prevent="save">
      <div v-if="formError" class="notice error" role="alert">{{ formError }}</div>
      <div v-if="isEditing" class="identity-summary">
        <div>
          <span>Perangkat</span><strong>{{ selectedDeviceLabel }}</strong>
        </div>
        <div>
          <span>ID pegawai perangkat</span><strong>{{ form.device_employee_id }}</strong>
        </div>
        <div>
          <span>Pegawai</span><strong>{{ selectedEmployeeLabel }}</strong>
        </div>
        <p>
          Bidang identitas bersifat tetap untuk pemetaan yang ada. Ubah identitas SAP atau periode efektifnya.
        </p>
      </div>

      <div v-if="!isEditing" class="form-grid">
        <label class="field">
          <span>Perangkat</span>
          <select v-model="form.device_id" required>
            <option value="" disabled>Pilih perangkat</option>
            <option v-for="device in options.devices" :key="device.id" :value="device.id">
              {{ device.name }} ({{ device.device_code }})
            </option>
          </select>
        </label>
        <label class="field">
          <span>ID pegawai perangkat</span>
          <input v-model.trim="form.device_employee_id" required maxlength="255" />
        </label>
        <label class="field">
          <span>Pegawai</span>
          <select v-model="form.employee_id" required>
            <option value="" disabled>Pilih pegawai</option>
            <option v-for="employee in options.employees" :key="employee.id" :value="employee.id">
              {{ employee.name }} ({{ employee.internal_id }})
            </option>
          </select>
        </label>
      </div>

      <div class="form-grid">
        <label class="field">
          <span>ID pegawai SAP</span>
          <input v-model.trim="form.sap_employee_id" maxlength="255" />
        </label>
        <label class="field">
          <span>Berlaku dari</span>
          <input v-model="form.valid_from" type="datetime-local" required />
        </label>
        <label class="field">
          <span>Berlaku sampai <small>(opsional)</small></span>
          <input v-model="form.valid_to" type="datetime-local" />
        </label>
      </div>

      <p v-if="options.devices.length === 0 || options.employees.length === 0" class="hint">
        Membuat pemetaan memerlukan setidaknya satu perangkat dan satu pegawai.
      </p>
      <footer class="form-actions">
        <router-link class="button secondary" to="/employee-mappings">Batal</router-link>
        <button
          class="button primary"
          type="submit"
          :disabled="
            saving || (!isEditing && (!options.devices.length || !options.employees.length))
          "
        >
          {{ saving ? 'Menyimpan…' : isEditing ? 'Simpan perubahan' : 'Buat pemetaan' }}
        </button>
      </footer>
    </form>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref } from 'vue';
import { useRoute } from 'vue-router';
import { useAuthStore } from '../../stores/auth';
import {
  createEmployeeMapping,
  employeeMappingErrorMessage,
  getEmployeeMapping,
  getEmployeeMappingOptions,
  updateEmployeeMapping,
  type EmployeeMappingRecord,
  type MappingOptions,
} from '../../services/employeeMappings';

const route = useRoute();
const authStore = useAuthStore();
const canUpdate = computed(() =>
  ['SUPER_ADMIN', 'INTEGRATION_ADMIN'].includes(authStore.user?.role ?? ''),
);
const isEditing = computed(() => typeof route.params.id === 'string');
const options = reactive<MappingOptions>({ devices: [], employees: [] });
const form = reactive({
  device_id: '',
  device_employee_id: '',
  employee_id: '',
  sap_employee_id: '',
  valid_from: localDateTime(new Date()),
  valid_to: '',
});
const loadedMapping = ref<EmployeeMappingRecord | null>(null);
const loading = ref(false);
const saving = ref(false);
const loadError = ref('');
const formError = ref('');
const saved = ref('');

const selectedDeviceLabel = computed(() => {
  const device = loadedMapping.value?.device;
  return device ? `${device.name} (${device.device_code})` : '—';
});
const selectedEmployeeLabel = computed(() => {
  const employee = loadedMapping.value?.employee;
  return employee ? `${employee.name} (${employee.internal_id})` : '—';
});

function localDateTime(value: Date): string {
  const local = new Date(value.getTime() - value.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

function apiDate(value: string): string {
  return new Date(value).toISOString();
}

onMounted(async () => {
  if (!canUpdate.value) return;
  loading.value = true;
  try {
    const optionsResult = await getEmployeeMappingOptions();
    options.devices = optionsResult.devices;
    options.employees = optionsResult.employees;
    if (isEditing.value) {
      const mapping = await getEmployeeMapping(String(route.params.id));
      loadedMapping.value = mapping;
      form.device_id = mapping.device_id;
      form.device_employee_id = mapping.device_employee_id;
      form.employee_id = mapping.employee_id;
      form.sap_employee_id = mapping.sap_employee_id ?? '';
      form.valid_from = localDateTime(new Date(mapping.valid_from));
      form.valid_to = mapping.valid_to ? localDateTime(new Date(mapping.valid_to)) : '';
    }
  } catch (error) {
    loadError.value = employeeMappingErrorMessage(error);
  } finally {
    loading.value = false;
  }
});

async function save(): Promise<void> {
  formError.value = '';
  saved.value = '';
  if (!form.valid_from || Number.isNaN(new Date(form.valid_from).getTime())) {
    formError.value = 'Masukkan waktu mulai yang valid.';
    return;
  }
  if (form.valid_to && new Date(form.valid_to).getTime() < new Date(form.valid_from).getTime()) {
    formError.value = 'Berlaku sampai harus pada atau setelah Berlaku dari.';
    return;
  }

  saving.value = true;
  try {
    const period = {
      sap_employee_id: form.sap_employee_id.trim() || null,
      valid_from: apiDate(form.valid_from),
      valid_to: form.valid_to ? apiDate(form.valid_to) : null,
    };
    if (isEditing.value) {
      await updateEmployeeMapping(String(route.params.id), period);
      saved.value = 'Pemetaan pegawai berhasil diperbarui.';
    } else {
      await createEmployeeMapping({
        ...period,
        device_id: form.device_id,
        device_employee_id: form.device_employee_id.trim(),
        employee_id: form.employee_id,
      });
      saved.value = 'Pemetaan pegawai berhasil dibuat.';
    }
  } catch (error) {
    formError.value = employeeMappingErrorMessage(error);
  } finally {
    saving.value = false;
  }
}
</script>

<style scoped>
.mapping-form-page {
  width: 100%;
  min-width: 0;
  color: #1f2937;
}
.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.25rem;
}
.eyebrow {
  margin: 0 0 0.25rem;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
h1 {
  margin: 0;
  color: #111827;
  font-size: 1.7rem;
}
.button {
  display: inline-flex;
  min-height: 2.35rem;
  align-items: center;
  justify-content: center;
  padding: 0.45rem 0.8rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.4rem;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
.button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.primary {
  border-color: #2563eb;
  color: #fff;
  background: #2563eb;
}
.secondary {
  color: #334155;
  background: #fff;
}
.notice,
.state-panel,
.form-panel {
  margin-bottom: 1rem;
  padding: 1.1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.65rem;
  background: #fff;
}
.notice.error {
  border-color: #fecaca;
  color: #991b1b;
  background: #fef2f2;
}
.notice.success {
  display: flex;
  flex-wrap: wrap;
  gap: 0.7rem;
  border-color: #86efac;
  color: #166534;
  background: #f0fdf4;
}
.state-panel {
  color: #64748b;
}
.identity-summary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
  padding: 1.25rem;
  border-radius: 0.5rem;
  background: #f8fafc;
}
.identity-summary div span,
.identity-summary div strong {
  display: block;
}
.identity-summary div span,
.identity-summary p {
  color: #64748b;
  font-size: 0.8rem;
}
.identity-summary p {
  grid-column: 1 / -1;
  margin: 0;
}
.form-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
  gap: 1.5rem;
  margin-bottom: 1.5rem;
}
.field {
  display: grid;
  min-width: 0;
  gap: 0.35rem;
  color: #475569;
  font-size: 0.8rem;
  font-weight: 600;
}
.field small {
  color: #64748b;
  font-weight: 400;
}
.field input,
.field select {
  width: 100%;
  min-height: 2.5rem;
  padding: 0.5rem 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.4rem;
  color: #1f2937;
  background: #fff;
  font: inherit;
  font-weight: 400;
}
.hint {
  color: #9a3412;
  font-size: 0.85rem;
}
.form-actions {
  display: flex;
  justify-content: flex-end;
  gap: 0.6rem;
  margin-top: 1.25rem;
  padding-top: 1rem;
  border-top: 1px solid #e2e8f0;
}
@media (max-width: 620px) {
  .page-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .form-grid,
  .identity-summary {
    grid-template-columns: minmax(0, 1fr);
  }
  .identity-summary p {
    grid-column: auto;
  }
  .form-actions {
    flex-wrap: wrap;
  }
}
</style>
