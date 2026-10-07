import {} from '@prisma/client';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { RawAttendanceCollector } from '../collector/RawAttendanceCollector';
import { prisma } from '@timebridge/database';
import {
  DeviceAdapterFactory,
  DeviceAdapterError,
  DeviceAdapter,
  RawAttendanceEvent,
} from '@timebridge/device-adapters';
import { encryptCredential } from '@timebridge/security/dist/crypto/encryption';

process.env.DEVICE_CREDENTIAL_KEY =
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

vi.mock('@timebridge/database', () => ({
  prisma: {
    device: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    attendanceRawEvent: {
      createMany: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    outboxEvent: {
      createMany: vi.fn(),
    },
    $transaction: vi.fn((cb) => cb(prisma)),
  },
}));

vi.mock('@timebridge/device-adapters', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@timebridge/device-adapters')>();
  return {
    ...actual,
    DeviceAdapterFactory: {
      create: vi.fn(),
    },
    DeviceAdapterError: actual.DeviceAdapterError,
  };
});

describe('RawAttendanceCollector', () => {
  const mockDevice = {
    id: 'dev-123',
    vendor: 'MOCK',
    is_active: true,
    status: 'ONLINE',
    host: '192.168.1.100',
    port: 4370,
    encrypted_credential: encryptCredential('secret123'),
    last_successful_sync_at: new Date('2026-09-23T10:00:00Z'),
  };

  let mockAdapter: import('../collector/RawAttendanceCollector').RawAttendanceCollector;

  beforeEach(() => {
    vi.clearAllMocks();

    mockAdapter = {
      // @ts-expect-error vitest-mock-extended typing mismatch
      connect: vi.fn().mockResolvedValue(),
      // @ts-expect-error vitest-mock-extended typing mismatch
      disconnect: vi.fn().mockResolvedValue(),
      // @ts-expect-error vitest-mock-extended typing mismatch
      getAttendanceEvents: vi.fn().mockResolvedValue(),
    };

    // @ts-expect-error vitest-mock-extended typing mismatch
    DeviceAdapterFactory.create.mockReturnValue(mockAdapter as never);
  });

  it('P5-COLLECT-001: should collect raw events successfully', async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue({
      id: 'dev-123',
      is_active: true,
    } as never);

    const records: RawAttendanceEvent[] = [
      {
        device_id: 'dev-123',
        device_employee_id: 'E1',
        event_timestamp: new Date('2026-09-23T10:05:00Z'),
        raw_payload: {},
        source_hash: 'h1',
      },
      {
        device_id: 'dev-123',
        device_employee_id: 'E2',
        event_timestamp: new Date('2026-09-23T10:10:00Z'),
        raw_payload: {},
        source_hash: 'h2',
      },
    ];
    // @ts-expect-error vitest-mock-extended typing mismatch
    mockAdapter.getAttendanceEvents.mockResolvedValue(records as never);

    vi.mocked(prisma.attendanceRawEvent.createMany).mockResolvedValue({ count: 2 } as never);
    vi.mocked(prisma.device.update).mockResolvedValue({ id: 'dev-123', is_active: true } as never);

    const result = await RawAttendanceCollector.collect('dev-123');

    expect(result.status).toBe('SUCCESS');
    expect(result.eventsReceived).toBe(2);
    expect(result.eventsInserted).toBe(2);
    expect(prisma.attendanceRawEvent.createMany).toHaveBeenCalled();
    expect(prisma.outboxEvent.createMany).toHaveBeenCalled();
    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'ONLINE',
          consecutive_failures: 0,
        }),
      }),
    );
  });

  it('P5-COLLECT-002: should handle inactive device', async () => {
    // @ts-expect-error vitest-mock-extended typing mismatch
    vi.mocked(prisma.device.findUnique).mockResolvedValue({
      ...mockDevice,
      is_active: false,
    });

    const result = await RawAttendanceCollector.collect('dev-123');

    expect(result.status).toBe('ERROR');
    expect(result.error).toBe('Device is not active');
    // @ts-expect-error vitest-mock-extended typing mismatch
    expect(mockAdapter.connect).not.toHaveBeenCalled();
  });

  it('P5-ERR-001: should handle connection error and update device state to OFFLINE', async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue({
      id: 'dev-123',
      is_active: true,
    } as never);
    // @ts-expect-error vitest-mock-extended typing mismatch
    mockAdapter.connect.mockRejectedValue(
      new DeviceAdapterError('CONNECTION_FAILED', 'Conn failed'),
    );

    vi.mocked(prisma.device.update).mockResolvedValue({ id: 'dev-123', is_active: true } as never);

    const result = await RawAttendanceCollector.collect('dev-123');

    expect(result.status).toBe('ERROR');
    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'OFFLINE',
          consecutive_failures: { increment: 1 },
        }),
      }),
    );
  });

  it('P5-ISO-001: device isolation, failure does not leak', async () => {
    vi.mocked(prisma.device.findUnique).mockResolvedValue({
      id: 'dev-123',
      is_active: true,
    } as never);
    // @ts-expect-error vitest-mock-extended typing mismatch
    mockAdapter.getAttendanceEvents.mockRejectedValue(new Error('Unknown read error') as never);

    vi.mocked(prisma.device.update).mockResolvedValue({ id: 'dev-123', is_active: true } as never);

    const result = await RawAttendanceCollector.collect('dev-123');

    expect(result.status).toBe('ERROR');
    expect(result.error).toBe('Unknown read error');
    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'DEGRADED',
        }),
      }),
    );
  });
});
