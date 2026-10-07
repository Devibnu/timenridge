/* eslint-disable @typescript-eslint/no-explicit-any, no-useless-catch */

import { DeviceAdapter } from '../interface';
import { DeviceAdapterConfig } from '../factory';
import { DeviceAdapterError } from '../errors';
import {
  DeviceInfo,
  DeviceStatus,
  AttendanceCollectionOptions,
  RawAttendanceEvent,
} from '../types';

/**
 * MockDeviceAdapter is an implementation of DeviceAdapter used entirely for testing.
 * It simulates connection delays, timeouts, success and error states based on configuration.
 * It strictly maintains isolation per instance.
 */
export class MockDeviceAdapter implements DeviceAdapter {
  private config: DeviceAdapterConfig;
  private isConnected: boolean = false;

  constructor(config: DeviceAdapterConfig) {
    this.config = config;
  }

  public async connect(): Promise<void> {
    // Simulate connection delay
    await new Promise((resolve) => setTimeout(resolve, 50));

    // Simulate timeout (host 'timeout.local')
    if (this.config.host === 'timeout.local') {
      throw new DeviceAdapterError(
        'CONNECTION_TIMEOUT',
        'Simulated connection timeout',
        this.config.device_id,
        true,
      );
    }

    // Simulate connection failure (host 'offline.local')
    if (this.config.host === 'offline.local') {
      throw new DeviceAdapterError(
        'DEVICE_OFFLINE',
        'Simulated device offline',
        this.config.device_id,
        true,
      );
    }

    // Simulate authentication failure (credential 'wrong')
    if (this.config.credential === 'wrong') {
      throw new DeviceAdapterError(
        'AUTHENTICATION_FAILED',
        'Simulated authentication failure',
        this.config.device_id,
        false,
      );
    }

    this.isConnected = true;
  }

  public async disconnect(): Promise<void> {
    // Safe to call even if not connected
    this.isConnected = false;
  }

  public async testConnection(): Promise<boolean> {
    try {
      await this.connect();
      await this.disconnect();
      return true;
    } catch (err) {
      // Re-throw so caller sees the exact canonical error
      throw err;
    }
  }

  public async getDeviceInfo(): Promise<DeviceInfo> {
    if (!this.isConnected) {
      throw new DeviceAdapterError(
        'UNSUPPORTED_OPERATION',
        'Cannot get info while disconnected',
        this.config.device_id,
      );
    }
    return {
      device_id: this.config.device_id,
      vendor: 'Mock',
      model: 'M1',
      serial_number: `SN-${this.config.device_id}`,
      firmware_version: '1.0.0',
    };
  }

  public async getDeviceStatus(): Promise<DeviceStatus> {
    if (!this.isConnected) {
      return 'OFFLINE';
    }
    return 'ONLINE';
  }

  public async getAttendanceEvents(
    options: AttendanceCollectionOptions,
  ): Promise<RawAttendanceEvent[]> {
    if (!this.isConnected) {
      throw new DeviceAdapterError(
        'UNSUPPORTED_OPERATION',
        'Cannot get events while disconnected',
        this.config.device_id,
      );
    }

    // Simulate bad response if host is 'corrupt.local'
    if (this.config.host === 'corrupt.local') {
      throw new DeviceAdapterError(
        'INVALID_RESPONSE',
        'Simulated invalid response',
        this.config.device_id,
        true,
      );
    }

    // Return dummy raw events
    return [
      {
        device_id: this.config.device_id,
        device_employee_id: '100',
        event_timestamp: options.from,
        raw_payload: { raw: '100', t: options.from.toISOString(), mode: 1 },
        source_hash: 'hash-1',
      },
    ];
  }
}
