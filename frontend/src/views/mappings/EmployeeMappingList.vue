<template>
  <section class="mapping-page">
    <header class="page-heading">
      <div>
        <p class="eyebrow">People and device identities</p>
        <h1>Employee Mapping</h1>
        <p class="description">
          Manage time-bounded links between device identities and employees.
        </p>
      </div>
      <router-link v-if="canUpdate" class="button primary" to="/employee-mappings/new">
        Create mapping
      </router-link>
    </header>

    <div v-if="notice" class="notice success" role="status">{{ notice }}</div>
    <div v-if="actionError" class="notice error" role="alert">{{ actionError }}</div>

    <section v-if="canResolve" class="resolve-panel" aria-labelledby="resolve-title">
      <div>
        <h2 id="resolve-title">Resolve an attendance event</h2>
        <p>Apply the mapping effective at the canonical event’s timestamp.</p>
      </div>
      <form class="resolve-form" @submit.prevent="resolveEvent">
        <label class="field">
          <span>Canonical event ID</span>
          <input v-model.trim="eventId" required aria-label="Canonical event ID" />
        </label>
        <button class="button primary" type="submit" :disabled="resolving">
          {{ resolving ? 'Resolving…' : 'Resolve event' }}
        </button>
      </form>
      <div v-if="resolution" class="resolution-result" role="status">
        <strong>{{ resolution.status }}</strong>
        <span v-if="resolution.employee_id">Employee ID: {{ resolution.employee_id }}</span>
        <span v-if="resolution.sap_employee_id">SAP ID: {{ resolution.sap_employee_id }}</span>
        <span v-if="resolution.reason">{{ resolution.reason }}</span>
      </div>
    </section>

    <form class="filters" @submit.prevent="applyFilters">
      <label class="field search-field">
        <span>Search</span>
        <input v-model="searchInput" placeholder="Employee, SAP ID, device or device employee ID" />
      </label>
      <label class="field status-field">
        <span>Mapping status</span>
        <select v-model="statusInput">
          <option value="ALL">All mappings</option>
          <option value="ACTIVE">Active records</option>
          <option value="INACTIVE">Inactive records</option>
        </select>
      </label>
      <div class="filter-actions">
        <button class="button primary" type="submit">Apply</button>
        <button class="button secondary" type="button" @click="clearFilters">Clear</button>
      </div>
    </form>

    <div v-if="loading" class="state-panel" role="status" aria-live="polite">
      Loading employee mappings…
    </div>
    <div v-else-if="error" class="state-panel error-state" role="alert">
      <div>
        <h2>Mappings could not be loaded</h2>
        <p>{{ error }}</p>
      </div>
      <button class="button secondary" type="button" @click="loadMappings">Try again</button>
    </div>
    <section v-else class="results-panel" aria-label="Employee mapping results">
      <div
        class="table-scroll"
        tabindex="0"
        aria-label="Employee mappings table, horizontally scrollable"
      >
        <table>
          <thead>
            <tr>
              <th>Employee</th>
              <th>SAP employee</th>
              <th>Device identity</th>
              <th>Effective period</th>
              <th>Status</th>
              <th v-if="canUpdate">Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="mapping in mappings" :key="mapping.id">
              <td>
                <strong>{{ mapping.employee.name }}</strong>
                <small>{{ mapping.employee.internal_id }}</small>
              </td>
              <td>{{ mapping.sap_employee_id || '—' }}</td>
              <td>
                <strong>{{ mapping.device.name }} ({{ mapping.device.device_code }})</strong>
                <small>{{ mapping.device_employee_id }}</small>
              </td>
              <td>{{ formatPeriod(mapping.valid_from, mapping.valid_to) }}</td>
              <td>
                <span class="status-pill" :class="statusClass(mapping)">{{
                  statusLabel(mapping)
                }}</span>
              </td>
              <td v-if="canUpdate" class="row-actions">
                <router-link :to="`/employee-mappings/${mapping.id}/edit`">Edit</router-link>
                <button
                  v-if="mapping.is_active && deactivateId !== mapping.id"
                  class="text-action danger-text"
                  type="button"
                  @click="deactivateId = mapping.id"
                >
                  Deactivate
                </button>
                <template v-if="deactivateId === mapping.id">
                  <span>Deactivate this mapping?</span>
                  <button
                    class="text-action danger-text"
                    type="button"
                    :disabled="deactivating"
                    @click="deactivate(mapping.id)"
                  >
                    {{ deactivating ? 'Working…' : 'Confirm' }}
                  </button>
                  <button class="text-action" type="button" @click="deactivateId = ''">
                    Cancel
                  </button>
                </template>
              </td>
            </tr>
            <tr v-if="mappings.length === 0">
              <td :colspan="canUpdate ? 6 : 5" class="empty-state">
                <strong>No employee mappings found.</strong>
                <span>Try changing your search or create a mapping.</span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
      <footer class="pagination-bar">
        <p>
          <strong>{{ total }}</strong> {{ total === 1 ? 'mapping' : 'mappings' }}
          <span>Page {{ page }} of {{ Math.max(totalPages, 1) }}</span>
        </p>
        <div class="pagination-controls">
          <label
            >Rows per page
            <select v-model.number="pageSize" aria-label="Rows per page" @change="changePageSize">
              <option :value="20">20</option>
              <option :value="50">50</option>
              <option :value="100">100</option>
            </select>
          </label>
          <button
            class="button secondary"
            type="button"
            :disabled="page <= 1 || loading"
            @click="changePage(page - 1)"
          >
            Previous
          </button>
          <button
            class="button secondary"
            type="button"
            :disabled="page >= totalPages || loading || totalPages === 0"
            @click="changePage(page + 1)"
          >
            Next
          </button>
        </div>
      </footer>
    </section>
  </section>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { useAuthStore } from '../../stores/auth';
import {
  deactivateEmployeeMapping,
  employeeMappingErrorMessage,
  getEmployeeMappings,
  resolveEmployeeMapping,
  type EmployeeMappingRecord,
} from '../../services/employeeMappings';

const authStore = useAuthStore();
const canUpdate = computed(() =>
  ['SUPER_ADMIN', 'INTEGRATION_ADMIN'].includes(authStore.user?.role ?? ''),
);
const canResolve = computed(() =>
  ['SUPER_ADMIN', 'INTEGRATION_ADMIN', 'OPERATOR'].includes(authStore.user?.role ?? ''),
);
const mappings = ref<EmployeeMappingRecord[]>([]);
const searchInput = ref('');
const statusInput = ref<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
const appliedSearch = ref('');
const appliedStatus = ref<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
const page = ref(1);
const pageSize = ref(20);
const total = ref(0);
const totalPages = ref(0);
const loading = ref(false);
const error = ref('');
const actionError = ref('');
const notice = ref('');
const eventId = ref('');
const resolving = ref(false);
const resolution = ref<Awaited<ReturnType<typeof resolveEmployeeMapping>> | null>(null);
const deactivateId = ref('');
const deactivating = ref(false);

async function loadMappings(): Promise<void> {
  loading.value = true;
  error.value = '';
  try {
    const response = await getEmployeeMappings({
      page: page.value,
      pageSize: pageSize.value,
      q: appliedSearch.value || undefined,
      status: appliedStatus.value,
    });
    mappings.value = response.data;
    page.value = response.meta.page;
    pageSize.value = response.meta.pageSize;
    total.value = response.meta.total;
    totalPages.value = response.meta.totalPages;
  } catch (requestError) {
    error.value = employeeMappingErrorMessage(requestError);
  } finally {
    loading.value = false;
  }
}

function applyFilters(): void {
  appliedSearch.value = searchInput.value.trim();
  appliedStatus.value = statusInput.value;
  page.value = 1;
  void loadMappings();
}

function clearFilters(): void {
  searchInput.value = '';
  statusInput.value = 'ALL';
  appliedSearch.value = '';
  appliedStatus.value = 'ALL';
  page.value = 1;
  void loadMappings();
}

function changePage(nextPage: number): void {
  page.value = nextPage;
  void loadMappings();
}

function changePageSize(): void {
  page.value = 1;
  void loadMappings();
}

async function deactivate(id: string): Promise<void> {
  deactivating.value = true;
  actionError.value = '';
  notice.value = '';
  try {
    await deactivateEmployeeMapping(id);
    notice.value = 'Employee mapping deactivated.';
    deactivateId.value = '';
    await loadMappings();
  } catch (requestError) {
    actionError.value = employeeMappingErrorMessage(requestError);
  } finally {
    deactivating.value = false;
  }
}

async function resolveEvent(): Promise<void> {
  resolving.value = true;
  actionError.value = '';
  notice.value = '';
  resolution.value = null;
  try {
    resolution.value = await resolveEmployeeMapping(eventId.value);
    notice.value = `Event resolution completed: ${resolution.value.status}.`;
  } catch (requestError) {
    actionError.value = employeeMappingErrorMessage(requestError);
  } finally {
    resolving.value = false;
  }
}

function statusLabel(mapping: EmployeeMappingRecord): string {
  if (!mapping.is_active) return 'Inactive';
  const now = Date.now();
  if (new Date(mapping.valid_from).getTime() > now) return 'Scheduled';
  if (mapping.valid_to && new Date(mapping.valid_to).getTime() < now) return 'Expired';
  return 'Active';
}

function statusClass(mapping: EmployeeMappingRecord): string {
  const label = statusLabel(mapping);
  return label === 'Active' ? 'positive' : label === 'Inactive' ? 'neutral' : 'attention';
}

function formatPeriod(from: string, to: string | null): string {
  return `${formatDate(from)} – ${to ? formatDate(to) : 'No end date'}`;
}

function formatDate(value: string): string {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

onMounted(() => void loadMappings());
</script>

<style scoped>
.mapping-page {
  width: 100%;
  min-width: 0;
  box-sizing: border-box;
  max-width: 1440px;
  margin: 0 auto;
  color: #1f2937;
}
.page-heading {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
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
  font-size: 1.75rem;
}
h2 {
  margin: 0 0 0.3rem;
  color: #1f2937;
  font-size: 1rem;
}
.description,
.resolve-panel p {
  margin: 0.35rem 0 0;
  color: #64748b;
  font-size: 0.9rem;
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
.notice {
  margin: 0 0 1rem;
  padding: 0.75rem 1rem;
  border: 1px solid;
  border-radius: 0.5rem;
}
.success {
  border-color: #86efac;
  color: #166534;
  background: #f0fdf4;
}
.error {
  border-color: #fecaca;
  color: #991b1b;
  background: #fef2f2;
}
.resolve-panel,
.filters,
.results-panel,
.state-panel {
  min-width: 0;
  margin-bottom: 1rem;
  border: 1px solid #e2e8f0;
  border-radius: 0.65rem;
  background: #fff;
}
.resolve-panel {
  display: grid;
  grid-template-columns: minmax(12rem, 1fr) minmax(18rem, 2fr);
  gap: 0.8rem 1.2rem;
  align-items: end;
  padding: 1rem;
}
.resolve-form {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.6rem;
}
.field {
  display: grid;
  min-width: 0;
  gap: 0.3rem;
  color: #475569;
  font-size: 0.76rem;
  font-weight: 600;
}
.field input,
.field select,
.pagination-controls select {
  width: 100%;
  min-height: 2.35rem;
  padding: 0.45rem 0.6rem;
  border: 1px solid #cbd5e1;
  border-radius: 0.4rem;
  color: #1f2937;
  background: #fff;
  font: inherit;
  font-weight: 400;
}
.resolve-form .field {
  flex: 1 1 16rem;
}
.resolution-result {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
  grid-column: 1 / -1;
  padding: 0.6rem;
  border-radius: 0.4rem;
  color: #334155;
  background: #f8fafc;
  font-size: 0.82rem;
}
.filters {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.8rem;
  padding: 1rem;
}
.search-field {
  flex: 1 1 22rem;
}
.status-field {
  flex: 0 1 12rem;
}
.filter-actions {
  display: flex;
  gap: 0.5rem;
}
.state-panel {
  display: flex;
  min-height: 9rem;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 1rem;
  color: #64748b;
}
.error-state {
  border-color: #fecaca;
  color: #991b1b;
}
.error-state p {
  margin: 0.3rem 0 0;
}
.table-scroll {
  width: 100%;
  min-width: 0;
  max-width: 100%;
  overflow-x: auto;
  overscroll-behavior-x: contain;
}
table {
  width: 100%;
  min-width: max-content;
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
  letter-spacing: 0.055em;
  text-transform: uppercase;
  white-space: nowrap;
}
td {
  max-width: 22rem;
  padding: 0.8rem 1rem;
  border-top: 1px solid #edf0f4;
  color: #334155;
  vertical-align: top;
  overflow-wrap: anywhere;
}
td strong,
td small {
  display: block;
}
td small {
  margin-top: 0.2rem;
  color: #64748b;
}
.status-pill {
  display: inline-block;
  padding: 0.2rem 0.55rem;
  border-radius: 999px;
  font-size: 0.7rem;
  font-weight: 700;
  white-space: nowrap;
}
.positive {
  color: #166534;
  background: #dcfce7;
}
.attention {
  color: #9a3412;
  background: #ffedd5;
}
.neutral {
  color: #475569;
  background: #f1f5f9;
}
.row-actions {
  display: flex;
  min-width: 12rem;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.55rem;
}
.row-actions a,
.text-action {
  padding: 0;
  border: 0;
  color: #2563eb;
  background: transparent;
  font: inherit;
  font-size: 0.8rem;
  text-decoration: none;
  cursor: pointer;
}
.row-actions .danger-text {
  color: #b91c1c;
}
.empty-state {
  height: 9rem;
  text-align: center;
  color: #64748b;
}
.empty-state strong,
.empty-state span {
  display: block;
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
  margin: 0;
  color: #475569;
  font-size: 0.82rem;
}
.pagination-bar p span {
  margin-left: 0.8rem;
  color: #64748b;
}
.pagination-controls {
  display: flex;
  flex-wrap: wrap;
  align-items: end;
  gap: 0.5rem;
}
.pagination-controls label {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  color: #64748b;
  font-size: 0.74rem;
}
.pagination-controls select {
  width: auto;
}
@media (max-width: 700px) {
  .resolve-panel {
    grid-template-columns: 1fr;
  }
  .resolve-form .field {
    flex: 1 1 100%;
  }
  .pagination-bar {
    align-items: flex-start;
    flex-direction: column;
  }
  .pagination-controls {
    width: 100%;
    justify-content: space-between;
  }
}
@media (max-width: 420px) {
  .page-heading {
    flex-direction: column;
  }
  .filters {
    align-items: stretch;
    flex-direction: column;
  }
  .search-field,
  .status-field {
    flex: 0 1 auto;
  }
  .filter-actions {
    flex-wrap: wrap;
  }
  .pagination-controls label {
    width: 100%;
    justify-content: space-between;
  }
}
</style>
