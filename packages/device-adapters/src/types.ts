/* eslint-disable @typescript-eslint/no-explicit-any, no-useless-catch */

export type DeviceStatus = 'ONLINE' | 'DEGRADED' | 'OFFLINE' | 'UNKNOWN';

export interface DeviceInfo {
  device_id: string;
  vendor: string;
  model: string;
  serial_number: string;
  firmware_version: string;
  [key: string]: any; // Allow optional vendor-specific metadata
}

export interface AttendanceCollectionOptions {
  from: Date;
  to: Date;
}

export interface RawAttendanceEvent {
  device_id: string;
  device_employee_id: string; // The ID on the device itself
  event_timestamp: Date;
  raw_payload: any; // Original payload from device
  source_hash: string; // Hash to detect tampering/duplication
}

export interface AdapterResult<T> {
  success: boolean;
  data?: T;
  error?: Error; // Will be typed stronger with Error Model
}
