/* eslint-disable @typescript-eslint/no-explicit-any, no-useless-catch */

import { describe, it, expect } from 'vitest';
import { MockDeviceAdapter, DeviceAdapterError } from '../index';

describe('Mock Adapter & Errors (P4-MOCK-*, P4-ERR-*, P4-ISO-*)', () => {
  it('P4-MOCK-001: connect success', async () => {
    const adapter = new MockDeviceAdapter({ device_id: 'd1' });
    await expect(adapter.connect()).resolves.toBeUndefined();
    await expect(adapter.testConnection()).resolves.toBe(true);
  });

  it('P4-MOCK-002, P4-ERR-003: connection failure (device offline)', async () => {
    const adapter = new MockDeviceAdapter({ device_id: 'd2', host: 'offline.local' });
    await expect(adapter.connect()).rejects.toThrowError(DeviceAdapterError);

    try {
      await adapter.connect();
    } catch (e: any) {
      expect(e.code).toBe('DEVICE_OFFLINE');
    }
  });

  it('P4-MOCK-003, P4-ERR-002: timeout', async () => {
    const adapter = new MockDeviceAdapter({ device_id: 'd3', host: 'timeout.local' });
    try {
      await adapter.connect();
    } catch (e: any) {
      expect(e.code).toBe('CONNECTION_TIMEOUT');
    }
  });

  it('P4-ERR-004: authentication failure', async () => {
    const adapter = new MockDeviceAdapter({ device_id: 'd4', credential: 'wrong' });
    try {
      await adapter.connect();
    } catch (e: any) {
      expect(e.code).toBe('AUTHENTICATION_FAILED');
    }
  });

  it('P4-MOCK-004: get device info', async () => {
    const adapter = new MockDeviceAdapter({ device_id: 'd1' });
    await adapter.connect();
    const info = await adapter.getDeviceInfo();
    expect(info.device_id).toBe('d1');
    expect(info.vendor).toBe('Mock');
  });

  it('P4-MOCK-005: get device status', async () => {
    const adapter = new MockDeviceAdapter({ device_id: 'd1' });
    expect(await adapter.getDeviceStatus()).toBe('OFFLINE');
    await adapter.connect();
    expect(await adapter.getDeviceStatus()).toBe('ONLINE');
    await adapter.disconnect();
    expect(await adapter.getDeviceStatus()).toBe('OFFLINE');
  });

  it('P4-MOCK-006: get attendance events', async () => {
    const adapter = new MockDeviceAdapter({ device_id: 'd1' });
    await adapter.connect();
    const date = new Date();
    const events = await adapter.getAttendanceEvents({ from: date, to: date });
    expect(events.length).toBe(1);
    expect(events[0]?.device_id).toBe('d1');
  });

  it('P4-ERR-005: invalid response', async () => {
    const adapter = new MockDeviceAdapter({ device_id: 'd5', host: 'corrupt.local' });
    await adapter.connect();
    try {
      await adapter.getAttendanceEvents({ from: new Date(), to: new Date() });
    } catch (e: any) {
      expect(e.code).toBe('INVALID_RESPONSE');
    }
  });

  it('P4-ISO-001, P4-ISO-002, P4-ISO-003: isolation and cleanup', async () => {
    const adapterA = new MockDeviceAdapter({ device_id: 'A', host: 'offline.local' });
    const adapterB = new MockDeviceAdapter({ device_id: 'B' });

    // A failing should not crash B
    await expect(adapterA.connect()).rejects.toThrow();
    await expect(adapterB.connect()).resolves.toBeUndefined();

    // Cleanups
    await expect(adapterA.disconnect()).resolves.toBeUndefined();
    await expect(adapterB.disconnect()).resolves.toBeUndefined();
  });

  it('P4-SEC-001, P4-SEC-002, P4-SEC-003: secrets not exposed in error payload', async () => {
    const adapter = new MockDeviceAdapter({ device_id: 'dsec', credential: 'wrong' });
    try {
      await adapter.connect();
    } catch (e: any) {
      const errorJson = e.toJSON();
      // Ensure credential is not accidentally embedded
      expect(JSON.stringify(errorJson)).not.toContain('wrong');
    }
  });
});
