/* eslint-disable @typescript-eslint/no-explicit-any, no-useless-catch */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DeviceAdapterRegistry,
  DeviceAdapterFactory,
  DeviceAdapterError,
  MockDeviceAdapter,
} from '../index';

describe('Device Adapter Framework Contracts (P4-ADAPTER-*)', () => {
  beforeEach(() => {
    DeviceAdapterRegistry.clear();
  });

  it('P4-ADAPTER-001: interface compliance (MockDeviceAdapter implements DeviceAdapter)', async () => {
    const config = { device_id: '1', vendor: 'Mock' };
    const adapter = new MockDeviceAdapter(config);
    expect(typeof adapter.connect).toBe('function');
    expect(typeof adapter.disconnect).toBe('function');
    expect(typeof adapter.testConnection).toBe('function');
    expect(typeof adapter.getDeviceInfo).toBe('function');
    expect(typeof adapter.getDeviceStatus).toBe('function');
    expect(typeof adapter.getAttendanceEvents).toBe('function');
  });

  it('P4-ADAPTER-002: registry registration', () => {
    DeviceAdapterRegistry.register('MockVendor', MockDeviceAdapter);
    expect(DeviceAdapterRegistry.has('MockVendor')).toBe(true);
    expect(DeviceAdapterRegistry.list()).toContain('mockvendor');
  });

  it('P4-ADAPTER-003: registry lookup (with and without protocol)', () => {
    DeviceAdapterRegistry.register('ComplexVendor', MockDeviceAdapter, 'Push');
    DeviceAdapterRegistry.register('SimpleVendor', MockDeviceAdapter);

    // Resolving exact match
    expect(DeviceAdapterRegistry.resolve('ComplexVendor', 'Push')).toBeDefined();
    // Resolving fallback to vendor-only if protocol not found
    expect(DeviceAdapterRegistry.resolve('SimpleVendor', 'Standalone')).toBeDefined();
    // Non-existent
    expect(DeviceAdapterRegistry.resolve('UnknownVendor')).toBeUndefined();
  });

  it('P4-ADAPTER-004: factory creation', () => {
    DeviceAdapterRegistry.register('Mock', MockDeviceAdapter);
    const adapter = DeviceAdapterFactory.create({ device_id: 'd1', vendor: 'Mock' });
    expect(adapter).toBeInstanceOf(MockDeviceAdapter);
  });

  it('P4-ERR-001: factory throws ADAPTER_NOT_FOUND if unregistered', () => {
    expect(() => {
      DeviceAdapterFactory.create({ device_id: 'd2', vendor: 'Nope' });
    }).toThrowError(DeviceAdapterError);

    try {
      DeviceAdapterFactory.create({ device_id: 'd2', vendor: 'Nope' });
    } catch (e: any) {
      expect(e.code).toBe('ADAPTER_NOT_FOUND');
    }
  });
});
