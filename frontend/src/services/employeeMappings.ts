import { authenticatedApi } from '../stores/auth';

export interface MappingEmployee {
  id: string;
  internal_id: string;
  name: string;
}

export interface MappingDevice {
  id: string;
  device_code: string;
  name: string;
}

export interface EmployeeMappingRecord {
  id: string;
  device_id: string;
  device_employee_id: string;
  employee_id: string;
  sap_employee_id: string | null;
  valid_from: string;
  valid_to: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  device: MappingDevice;
  employee: MappingEmployee;
}

export interface EmployeeMappingPage {
  success: true;
  data: EmployeeMappingRecord[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface MappingOptions {
  devices: MappingDevice[];
  employees: MappingEmployee[];
}

export async function getEmployeeMappings(params: {
  page: number;
  pageSize: number;
  q?: string;
  status?: 'ALL' | 'ACTIVE' | 'INACTIVE';
}): Promise<EmployeeMappingPage> {
  const response = await authenticatedApi.get<EmployeeMappingPage>('/employee-mappings', {
    params,
  });
  return response.data;
}

export async function getEmployeeMapping(id: string): Promise<EmployeeMappingRecord> {
  const response = await authenticatedApi.get<{ success: true; data: EmployeeMappingRecord }>(
    `/employee-mappings/${id}`,
  );
  return response.data.data;
}

export async function getEmployeeMappingOptions(): Promise<MappingOptions> {
  const response = await authenticatedApi.get<{ success: true; data: MappingOptions }>(
    '/employee-mappings/options',
  );
  return response.data.data;
}

export async function createEmployeeMapping(payload: {
  device_id: string;
  device_employee_id: string;
  employee_id: string;
  sap_employee_id: string | null;
  valid_from: string;
  valid_to: string | null;
}): Promise<EmployeeMappingRecord> {
  const response = await authenticatedApi.post<EmployeeMappingRecord>(
    '/employee-mappings',
    payload,
  );
  return response.data;
}

export async function updateEmployeeMapping(
  id: string,
  payload: { sap_employee_id: string | null; valid_from: string; valid_to: string | null },
): Promise<EmployeeMappingRecord> {
  const response = await authenticatedApi.patch<EmployeeMappingRecord>(
    `/employee-mappings/${id}`,
    payload,
  );
  return response.data;
}

export async function deactivateEmployeeMapping(id: string): Promise<EmployeeMappingRecord> {
  const response = await authenticatedApi.post<EmployeeMappingRecord>(
    `/employee-mappings/${id}/deactivate`,
  );
  return response.data;
}

export async function resolveEmployeeMapping(canonical_event_id: string): Promise<{
  status: 'MAPPED' | 'UNMAPPED' | 'AMBIGUOUS' | 'INVALID';
  canonical_event_id: string;
  employee_id: string | null;
  sap_employee_id: string | null;
  reason?: string;
}> {
  const response = await authenticatedApi.post('/employee-mappings/resolve', {
    canonical_event_id,
  });
  return response.data;
}

export function employeeMappingErrorMessage(error: unknown): string {
  const response = error as {
    response?: { status?: number; data?: { error?: string; message?: string } };
  };
  if (response.response?.status === 401) return 'Sesi Anda telah berakhir. Silakan masuk kembali.';
  if (response.response?.status === 403)
    return 'Anda tidak memiliki izin untuk melakukan tindakan ini.';
  return response.response?.data?.error ?? response.response?.data?.message ?? 'Permintaan gagal.';
}
