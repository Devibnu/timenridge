<template>
  <section class="attendance-page">
    <div class="attendance-heading">
      <div>
        <p class="attendance-eyebrow">Operasional Kehadiran</p>
        <h1>{{ title }}</h1>
        <p class="attendance-description">Catatan operasional hanya-baca dari TimeBridge.</p>
      </div>
      <span class="read-only-badge">Hanya baca</span>
    </div>

    <form class="filter-panel" @submit.prevent="applyFilters">
      <label v-for="filter in filters" :key="filter.key" class="filter-field">
        <span>{{ filter.label }}</span>
        <select v-if="filter.options" v-model="filterValues[filter.key]" :aria-label="filter.label">
          <option value="">Semua</option>
          <option v-for="option in filter.options" :key="option" :value="option">
            {{ option.replaceAll('_', ' ') }}
          </option>
        </select>
        <input
          v-else
          v-model="filterValues[filter.key]"
          :type="filter.type ?? 'text'"
          :placeholder="filter.placeholder ?? ''"
          :aria-label="filter.label"
        />
      </label>
      <div class="filter-actions">
        <button class="button button-primary" type="submit">Terapkan filter</button>
        <button class="button button-secondary" type="button" @click="clearFilters">Bersihkan</button>
      </div>
    </form>

    <div v-if="loading" class="state-panel" role="status" aria-live="polite">
      <span class="loading-spinner" aria-hidden="true"></span>
      <span>Memuat {{ title.toLowerCase() }}…</span>
    </div>

    <div v-else-if="error" class="state-panel error-panel" role="alert">
      <div>
        <h2>Catatan tidak dapat dimuat</h2>
        <p>{{ error }}</p>
      </div>
      <button class="button button-secondary" type="button" @click="loadPage">Coba lagi</button>
    </div>

    <div v-else class="records-panel">
      <div
        class="table-scroll"
        tabindex="0"
        :aria-label="`${title} table, horizontally scrollable`"
      >
        <table>
          <thead>
            <tr>
              <th v-for="column in columns" :key="column.key" scope="col">{{ column.label }}</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="record in records" :key="record.id">
              <td v-for="column in columns" :key="column.key">
                <span
                  v-if="column.kind === 'status'"
                  class="status-pill"
                  :class="statusClass(valueFor(record, column.key))"
                >
                  {{ displayValue(valueFor(record, column.key)) }}
                </span>
                <span v-else>{{ displayValue(valueFor(record, column.key), column.kind) }}</span>
              </td>
            </tr>
            <tr v-if="records.length === 0">
              <td :colspan="columns.length" class="empty-cell">
                <span class="empty-icon" aria-hidden="true">—</span>
                <strong>Tidak ada catatan kehadiran yang ditemukan.</strong>
                <span>Coba ubah atau bersihkan filter Anda.</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="pagination-bar">
        <p>
          <strong>{{ total }}</strong> catatan
          <span class="page-indicator">Halaman {{ page }} dari {{ Math.max(totalPages, 1) }}</span>
        </p>
        <div class="pagination-controls">
          <label>
            <span>Baris per halaman</span>
            <select v-model.number="pageSize" aria-label="Baris per halaman" @change="changePageSize">
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </label>
          <button
            class="button button-secondary"
            type="button"
            :disabled="page <= 1 || loading"
            @click="changePage(page - 1)"
          >
            Sebelumnya
          </button>
          <button
            class="button button-secondary"
            type="button"
            :disabled="page >= totalPages || loading || totalPages === 0"
            @click="changePage(page + 1)"
          >
            Berikutnya
          </button>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue';
import {
  getAttendancePage,
  humanizeAttendanceError,
  type AttendanceCycleRecord,
  type AttendanceEventRecord,
  type AttendanceFilters,
  type AttendanceKind,
  type AttendanceRecord,
  type AttendanceRuleResultRecord,
  type RawAttendanceRecord,
} from '../../services/attendance';
import { toBusinessDateBoundary } from '../../utils/businessDate';

type ColumnKey =
  | keyof RawAttendanceRecord
  | keyof AttendanceEventRecord
  | keyof AttendanceRuleResultRecord
  | keyof AttendanceCycleRecord;
interface Column {
  key: ColumnKey;
  label: string;
  kind?: 'date' | 'status';
}
interface FilterDefinition {
  key: string;
  label: string;
  type?: 'text' | 'date';
  placeholder?: string;
  options?: string[];
}

const props = defineProps<{ kind: AttendanceKind }>();

const config: Record<
  AttendanceKind,
  { title: string; columns: Column[]; filters: FilterDefinition[] }
> = {
  raw: {
    title: 'Data Mentah Kehadiran',
    columns: [
      { key: 'event_timestamp', label: 'Stempel waktu kejadian', kind: 'date' },
      { key: 'device_id', label: 'ID Perangkat' },
      { key: 'device_employee_id', label: 'ID Karyawan perangkat' },
      { key: 'source_hash', label: 'Hash sumber' },
      { key: 'received_at', label: 'Diterima pada', kind: 'date' },
    ],
    filters: [
      { key: 'deviceId', label: 'ID Perangkat', placeholder: 'Masukkan ID perangkat' },
      {
        key: 'deviceEmployeeId',
        label: 'ID Karyawan perangkat',
        placeholder: 'Masukkan ID karyawan perangkat',
      },
      { key: 'dateFrom', label: 'Dari tanggal', type: 'date' },
      { key: 'dateTo', label: 'Hingga tanggal', type: 'date' },
    ],
  },
  events: {
    title: 'Kejadian Kehadiran',
    columns: [
      { key: 'event_uid', label: 'UID Kejadian' },
      { key: 'device', label: 'Perangkat' },
      { key: 'device_employee_id', label: 'ID Karyawan perangkat' },
      { key: 'employee', label: 'Karyawan' },
      { key: 'sap_employee_id', label: 'ID Karyawan SAP' },
      { key: 'event_timestamp', label: 'Stempel waktu kejadian', kind: 'date' },
      { key: 'event_type', label: 'Tipe' },
      { key: 'status', label: 'Status', kind: 'status' },
      { key: 'source', label: 'Sumber' },
    ],
    filters: [
      { key: 'deviceId', label: 'ID Perangkat', placeholder: 'Masukkan ID perangkat' },
      {
        key: 'deviceEmployeeId',
        label: 'ID Karyawan perangkat',
        placeholder: 'Masukkan ID karyawan perangkat',
      },
      { key: 'employeeId', label: 'ID Karyawan', placeholder: 'Masukkan ID karyawan' },
      {
        key: 'status',
        label: 'Status',
        options: [
          'RECEIVED',
          'VALIDATED',
          'MAPPED',
          'READY',
          'PROCESSING',
          'SENT',
          'PROCESSED',
          'DUPLICATE',
          'FAILED',
          'SAP_REJECTED',
          'REVIEW_REQUIRED',
        ],
      },
      {
        key: 'eventType',
        label: 'Tipe kejadian',
        options: ['IN', 'OUT', 'BREAK_IN', 'BREAK_OUT', 'UNKNOWN'],
      },
      { key: 'dateFrom', label: 'Dari tanggal', type: 'date' },
      { key: 'dateTo', label: 'Hingga tanggal', type: 'date' },
    ],
  },
  'rule-results': {
    title: 'Hasil Aturan',
    columns: [
      { key: 'attendance_event_id', label: 'ID kejadian kehadiran' },
      { key: 'rule_code', label: 'Kode aturan' },
      { key: 'decision', label: 'Keputusan', kind: 'status' },
      { key: 'reason', label: 'Alasan' },
      { key: 'created_at', label: 'Dibuat pada', kind: 'date' },
    ],
    filters: [
      { key: 'attendanceEventId', label: 'ID Kejadian kehadiran', placeholder: 'Masukkan ID kejadian' },
      { key: 'ruleCode', label: 'Kode aturan', placeholder: 'Masukkan kode aturan' },
      { key: 'decision', label: 'Keputusan', placeholder: 'Masukkan keputusan' },
      { key: 'dateFrom', label: 'Dibuat dari', type: 'date' },
      { key: 'dateTo', label: 'Dibuat hingga', type: 'date' },
    ],
  },
  cycles: {
    title: 'Siklus Kehadiran',
    columns: [
      { key: 'employee', label: 'Karyawan' },
      { key: 'sap_employee_id', label: 'ID Karyawan SAP' },
      { key: 'business_date', label: 'Tanggal bisnis', kind: 'date' },
      { key: 'shift_id', label: 'ID Shift' },
      { key: 'cycle_sequence', label: 'Urutan' },
      { key: 'check_in_event_id', label: 'ID kejadian MASUK' },
      { key: 'check_out_event_id', label: 'ID kejadian KELUAR' },
      { key: 'status', label: 'Status', kind: 'status' },
      { key: 'reason', label: 'Alasan' },
    ],
    filters: [
      { key: 'employeeId', label: 'ID Karyawan', placeholder: 'Masukkan ID karyawan' },
      {
        key: 'status',
        label: 'Status',
        options: [
          'OPEN',
          'COMPLETE',
          'MISSING_IN',
          'MISSING_OUT',
          'AMBIGUOUS',
          'REVIEW_REQUIRED',
          'READY_FOR_SAP',
          'SENT_TO_SAP',
        ],
      },
      { key: 'dateFrom', label: 'Tanggal bisnis dari', type: 'date' },
      { key: 'dateTo', label: 'Tanggal bisnis hingga', type: 'date' },
    ],
  },
};

const title = computed(() => config[props.kind].title);
const columns = computed(() => config[props.kind].columns);
const filters = computed(() => config[props.kind].filters);
const filterValues = reactive<Record<string, string>>({});
const activeFilters = ref<AttendanceFilters>({});
const records = ref<AttendanceRecord[]>([]);
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const totalPages = ref(0);
const loading = ref(false);
const error = ref('');
let requestSequence = 0;

function toCycleDate(value: string): string {
  return new Date(`${value}T00:00:00.000Z`).toISOString();
}

async function loadPage(): Promise<void> {
  const sequence = ++requestSequence;
  loading.value = true;
  error.value = '';
  records.value = [];
  try {
    const params = Object.fromEntries(
      Object.entries(activeFilters.value).map(([key, value]) => [
        key,
        key === 'dateFrom' || key === 'dateTo'
          ? props.kind === 'cycles'
            ? toCycleDate(value)
            : toBusinessDateBoundary(value, key === 'dateFrom' ? 'start' : 'end')
          : value,
      ]),
    );
    const response = await getAttendancePage<AttendanceRecord>(props.kind, {
      ...params,
      page: page.value,
      pageSize: pageSize.value,
    });
    if (sequence !== requestSequence) return;
    records.value = response.data;
    page.value = response.meta.page;
    pageSize.value = response.meta.pageSize;
    total.value = response.meta.total;
    totalPages.value = response.meta.totalPages;
  } catch (requestError: unknown) {
    if (sequence === requestSequence) error.value = humanizeAttendanceError(requestError);
  } finally {
    if (sequence === requestSequence) loading.value = false;
  }
}

function applyFilters(): void {
  activeFilters.value = Object.fromEntries(
    filters.value
      .map(({ key }) => [key, filterValues[key]?.trim() ?? ''])
      .filter(([, value]) => value !== ''),
  );
  page.value = 1;
  void loadPage();
}

function clearFilters(): void {
  for (const filter of filters.value) filterValues[filter.key] = '';
  activeFilters.value = {};
  page.value = 1;
  void loadPage();
}

function changePage(nextPage: number): void {
  page.value = nextPage;
  void loadPage();
}

function changePageSize(): void {
  page.value = 1;
  void loadPage();
}

function valueFor(record: AttendanceRecord, key: ColumnKey): unknown {
  if (key === 'device' && 'device' in record)
    return `${record.device.name} (${record.device.device_code})`;
  if (key === 'employee' && 'employee' in record) {
    return record.employee
      ? `${record.employee.name} (${record.employee.internal_id})`
      : (record.employee_id ?? '—');
  }
  if (key in record) return record[key as keyof typeof record];
  return undefined;
}

function displayValue(value: unknown, kind?: Column['kind']): string {
  if (value === null || value === undefined || value === '') return '—';
  if (kind === 'date' && typeof value === 'string') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }
  return String(value);
}

function statusClass(value: unknown): string {
  const status = String(value ?? '').toUpperCase();
  if (
    [
      'COMPLETE',
      'PROCESSED',
      'READY',
      'READY_FOR_SAP',
      'SENT',
      'SENT_TO_SAP',
      'VALIDATED',
    ].includes(status)
  )
    return 'status-positive';
  if (
    [
      'FAILED',
      'SAP_REJECTED',
      'MISSING_IN',
      'MISSING_OUT',
      'REVIEW_REQUIRED',
      'AMBIGUOUS',
    ].includes(status)
  )
    return 'status-attention';
  return 'status-neutral';
}

watch(
  () => props.kind,
  () => {
    for (const key of Object.keys(filterValues)) delete filterValues[key];
    activeFilters.value = {};
    page.value = 1;
    pageSize.value = 20;
    void loadPage();
  },
);

onMounted(() => void loadPage());
</script>

<style scoped>
.attendance-page {
  width: 100%;
  min-width: 0;
  max-width: 1440px;
  margin: 0 auto;
  color: #1f2937;
}
.attendance-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.attendance-eyebrow {
  margin: 0 0 0.25rem;
  color: #64748b;
  font-size: 0.75rem;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.attendance-heading h1 {
  margin: 0;
  color: #111827;
  font-size: 1.75rem;
  font-weight: 700;
  letter-spacing: -0.025em;
}
.attendance-description {
  margin-top: 0.35rem;
  color: #64748b;
  font-size: 0.9rem;
}
.read-only-badge {
  padding: 0.3rem 0.65rem;
  border: 1px solid #cbd5e1;
  border-radius: 999px;
  color: #475569;
  background: #f8fafc;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
}
.filter-panel {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.8rem;
  margin-bottom: 1rem;
  padding: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.65rem;
  background: #fff;
}
.filter-field {
  display: grid;
  min-width: 160px;
  flex: 1 1 160px;
  gap: 0.3rem;
  color: #475569;
  font-size: 0.76rem;
  font-weight: 600;
}
.filter-field input,
.filter-field select,
.pagination-controls select {
  min-height: 2.35rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.4rem;
  color: #1f2937;
  background: #fff;
  font: inherit;
  font-weight: 400;
}
.filter-actions,
.pagination-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.5rem;
}
.button {
  min-height: 2.35rem;
  padding: 0.45rem 0.8rem;
  border: 1px solid transparent;
  border-radius: 0.4rem;
  font: inherit;
  font-size: 0.82rem;
  font-weight: 600;
  cursor: pointer;
}
.button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
.button-primary {
  color: #fff;
  background: #2563eb;
}
.button-primary:hover:not(:disabled) {
  background: #1d4ed8;
}
.button-secondary {
  border-color: #cbd5e1;
  color: #334155;
  background: #fff;
}
.button-secondary:hover:not(:disabled) {
  background: #f8fafc;
}
.records-panel,
.state-panel {
  min-width: 0;
  overflow: hidden;
  border: 1px solid #e2e8f0;
  border-radius: 0.65rem;
  background: #fff;
  box-shadow: 0 1px 2px rgb(15 23 42 / 4%);
}
.table-scroll {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}
table {
  min-width: max-content;
  width: 100%;
  border-collapse: collapse;
  font-size: 0.83rem;
}
thead {
  background: #f8fafc;
}
th {
  padding: 0.8rem 1rem;
  color: #64748b;
  text-align: left;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.055em;
  text-transform: uppercase;
  white-space: nowrap;
}
td {
  max-width: 320px;
  padding: 0.85rem 1rem;
  border-top: 1px solid #edf0f4;
  color: #334155;
  vertical-align: top;
  overflow-wrap: anywhere;
}
.status-pill {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}
.status-positive {
  color: #166534;
  background: #dcfce7;
}
.status-attention {
  color: #9a3412;
  background: #ffedd5;
}
.status-neutral {
  color: #475569;
  background: #f1f5f9;
}
.empty-cell {
  height: 180px;
  text-align: center;
  color: #64748b;
}
.empty-cell > * {
  display: block;
  margin: 0.25rem auto;
}
.empty-cell strong {
  color: #334155;
}
.empty-icon {
  color: #94a3b8;
  font-size: 1.4rem;
}
.pagination-bar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  padding: 0.85rem 1rem;
  border-top: 1px solid #e2e8f0;
}
.pagination-bar p {
  color: #475569;
  font-size: 0.82rem;
}
.page-indicator {
  margin-left: 1rem;
  color: #64748b;
}
.pagination-controls label {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  color: #64748b;
  font-size: 0.74rem;
}
.pagination-controls select {
  min-height: 2.2rem;
}
.state-panel {
  display: flex;
  min-height: 150px;
  align-items: center;
  justify-content: center;
  gap: 0.75rem;
  padding: 1.5rem;
  color: #64748b;
}
.error-panel {
  justify-content: space-between;
  border-color: #fecaca;
  color: #991b1b;
}
.error-panel h2 {
  margin: 0 0 0.25rem;
  color: #991b1b;
  font-size: 1rem;
  font-weight: 700;
}
.error-panel p {
  color: #7f1d1d;
  font-size: 0.85rem;
}
.loading-spinner {
  width: 1.1rem;
  height: 1.1rem;
  border: 2px solid #cbd5e1;
  border-top-color: #2563eb;
  border-radius: 50%;
  animation: spin 0.75s linear infinite;
}
@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@media (max-width: 700px) {
  .attendance-heading h1 {
    font-size: 1.4rem;
  }
  .filter-field {
    flex-basis: calc(50% - 0.8rem);
  }
  .pagination-bar {
    align-items: flex-start;
    flex-direction: column;
  }
  .pagination-controls {
    width: 100%;
    justify-content: space-between;
  }
  .error-panel {
    align-items: flex-start;
    flex-direction: column;
  }
}
@media (max-width: 420px) {
  .filter-field {
    flex-basis: 100%;
  }
  .attendance-heading {
    align-items: flex-start;
    flex-direction: column;
  }
  .pagination-controls label {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
