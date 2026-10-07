import axios from 'axios';
import { authenticatedApi } from '../stores/auth';

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface ApiErrorBody {
  success: false;
  error: { code: string; message: string; details: unknown };
  meta: Record<string, never>;
}

export interface PageResponse<T> {
  success: true;
  data: T[];
  meta: PageMeta;
}

export interface RawAttendanceRecord {
  id: string;
  device_id: string;
  device_employee_id: string;
  event_timestamp: string;
  source_hash: string;
  received_at: string;
  created_at: string;
}

export interface AttendanceEventRecord {
  id: string;
  event_uid: string;
  device_id: string;
  device_employee_id: string;
  employee_id: string | null;
  sap_employee_id: string | null;
  event_date: string;
  event_time: string;
  event_timestamp: string;
  event_type: string;
  source: string;
  status: string;
  created_at: string;
  updated_at: string;
  employee: { name: string; internal_id: string } | null;
  device: { name: string; device_code: string };
}

export interface AttendanceRuleResultRecord {
  id: string;
  attendance_event_id: string;
  rule_code: string;
  decision: string;
  reason: string;
  created_at: string;
}

export interface AttendanceCycleRecord {
  id: string;
  employee_id: string;
  sap_employee_id: string | null;
  business_date: string;
  shift_id: string | null;
  cycle_sequence: number;
  check_in_event_id: string | null;
  check_out_event_id: string | null;
  status: string;
  reason: string | null;
  created_at: string;
  updated_at: string;
  employee: { name: string; internal_id: string };
}

export type AttendanceKind = 'raw' | 'events' | 'rule-results' | 'cycles';
export type AttendanceRecord =
  RawAttendanceRecord | AttendanceEventRecord | AttendanceRuleResultRecord | AttendanceCycleRecord;

export type AttendanceFilters = Record<string, string>;
export type AttendancePageParams = Record<string, string | number> & {
  page: number;
  pageSize: number;
};

const endpointByKind: Record<AttendanceKind, string> = {
  raw: '/attendance/raw',
  events: '/attendance/events',
  'rule-results': '/attendance/rule-results',
  cycles: '/attendance/cycles',
};

export async function getAttendancePage<T extends AttendanceRecord>(
  kind: AttendanceKind,
  params: AttendancePageParams,
): Promise<PageResponse<T>> {
  const response = await authenticatedApi.get<PageResponse<T>>(endpointByKind[kind], { params });
  return response.data;
}

export function humanizeAttendanceError(error: unknown): string {
  if (axios.isAxiosError<ApiErrorBody>(error)) {
    const responseMessage = error.response?.data?.error?.message;
    if (error.response?.status === 401) return 'Your session has expired. Please sign in again.';
    if (error.response?.status === 403)
      return 'You do not have permission to view attendance records.';
    if (responseMessage && error.response?.status && error.response.status < 500) {
      return responseMessage;
    }
  }
  return 'Attendance records could not be loaded. Try again.';
}
