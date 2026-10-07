/* eslint-disable @typescript-eslint/no-explicit-any, no-useless-catch */

import { DeviceInfo, DeviceStatus, AttendanceCollectionOptions, RawAttendanceEvent } from './types';

/**
 * The DeviceAdapter interface is the canonical abstraction for vendor-agnostic
 * device communication in TimeBridge.
 *
 * All vendor-specific adapters must implement this contract.
 * Business logic (such as deciding whether an event is "late", scheduling,
 * or interpreting IN/OUT) MUST NOT exist in any implementations of this interface.
 */
export interface DeviceAdapter {
  /**
   * Establishes connection and authentication with the device.
   * Throws a DeviceAdapterError upon failure or timeout.
   */
  connect(): Promise<void>;

  /**
   * Cleans up sockets and connections. Must be safe to call multiple times
   * or when not connected.
   */
  disconnect(): Promise<void>;

  /**
   * Tests the connection without maintaining state.
   * Typically connects, pings, and disconnects.
   * Returns true if successful, false otherwise.
   */
  testConnection(): Promise<boolean>;

  /**
   * Retrieves canonical device information (hardware info, serial, firmware).
   */
  getDeviceInfo(): Promise<DeviceInfo>;

  /**
   * Retrieves the current real-time status of the device.
   */
  getDeviceStatus(): Promise<DeviceStatus>;

  /**
   * Collects raw attendance events within a specified timeframe.
   * The returned events must represent the raw data from the device payload.
   */
  getAttendanceEvents(options: AttendanceCollectionOptions): Promise<RawAttendanceEvent[]>;
}
