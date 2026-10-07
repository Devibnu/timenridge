import {} from '@prisma/client';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AttendanceNormalizer } from '../normalizer/AttendanceNormalizer';
import { prisma, EventStatus, EventType } from '@timebridge/database';
import { formatInTimeZone } from 'date-fns-tz';
import * as crypto from 'crypto';

vi.mock('@timebridge/database', () => {
  return {
    prisma: {
      attendanceRawEvent: {
        findMany: vi.fn(),
      },
      attendanceEvent: {
        findUnique: vi.fn(),
        create: vi.fn(),
      },
    },
    EventStatus: {
      RECEIVED: 'RECEIVED',
      REVIEW_REQUIRED: 'REVIEW_REQUIRED',
      DUPLICATE: 'DUPLICATE',
      FAILED: 'FAILED',
    },
    EventType: {
      UNKNOWN: 'UNKNOWN',
      IN: 'IN',
    },
  };
});

describe('AttendanceNormalizer', () => {
  let normalizer: AttendanceNormalizer;

  beforeEach(() => {
    vi.clearAllMocks();
    normalizer = new AttendanceNormalizer();
  });

  const mockRawEvent = {
    id: 'raw-1',
    device_id: 'dev-1',
    device_employee_id: 'emp-1',
    event_timestamp: new Date('2026-09-23T00:30:00Z'),
    raw_payload: {},
    source_hash: 'hash1',
    received_at: new Date(),
    created_at: new Date(),
  };

  it('P6-NORM-001: should normalize a valid raw event', async () => {
    // @ts-expect-error vitest-mock-extended typing mismatch
    vi.mocked(prisma.attendanceEvent.findUnique).mockImplementation(async () => null as never);
    vi.mocked(prisma.attendanceEvent.create).mockResolvedValue({ id: 'canon-1' } as never);

    const result = await normalizer.normalizeSingle(mockRawEvent);

    expect(result.status).toBe(EventStatus.RECEIVED);
    expect(result.normalized_event_id).toBe('canon-1');
    expect(prisma.attendanceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          device_id: 'dev-1',
          device_employee_id: 'emp-1',
          employee_id: null,
          event_type: EventType.UNKNOWN,
        }),
      }),
    );
  });

  it('P6-NORM-002: should return REVIEW_REQUIRED for missing device_employee_id', async () => {
    const invalidEvent = { ...mockRawEvent, device_employee_id: '' };
    const result = await normalizer.normalizeSingle(invalidEvent);

    expect(result.status).toBe(EventStatus.REVIEW_REQUIRED);
    expect(result.reason).toBe('MISSING_DEVICE_EMPLOYEE_ID');
    expect(prisma.attendanceEvent.create).not.toHaveBeenCalled();
  });

  it('P6-NORM-003: should return REVIEW_REQUIRED for invalid timestamp', async () => {
    const invalidEvent = { ...mockRawEvent, event_timestamp: new Date('invalid') };
    const result = await normalizer.normalizeSingle(invalidEvent);

    expect(result.status).toBe(EventStatus.REVIEW_REQUIRED);
    expect(result.reason).toBe('INVALID_TIMESTAMP');
    expect(prisma.attendanceEvent.create).not.toHaveBeenCalled();
  });

  it('P6-NORM-004: should return DUPLICATE if event is already normalized', async () => {
    // @ts-expect-error vitest-mock-extended typing mismatch
    vi.mocked(prisma.attendanceEvent.findUnique).mockResolvedValue({
      id: 'canon-existing',
    });

    const result = await normalizer.normalizeSingle(mockRawEvent);

    expect(result.status).toBe(EventStatus.DUPLICATE);
    expect(result.reason).toBe('ALREADY_NORMALIZED');
    expect(prisma.attendanceEvent.create).not.toHaveBeenCalled();
  });

  it('P6-NORM-005: should correctly convert timezone to Asia/Jakarta', async () => {
    // @ts-expect-error vitest-mock-extended typing mismatch
    vi.mocked(prisma.attendanceEvent.findUnique).mockImplementation(async () => null as never);
    vi.mocked(prisma.attendanceEvent.create).mockResolvedValue({ id: 'canon-1' } as never);

    // 2026-09-23T23:30:00Z -> +7 hours -> 2026-09-24 06:30:00 Asia/Jakarta
    const tzEvent = { ...mockRawEvent, event_timestamp: new Date('2026-09-23T23:30:00Z') };

    await normalizer.normalizeSingle(tzEvent);

    expect(prisma.attendanceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_date: new Date('2026-09-24T00:00:00Z'),
          event_time: '06:30:00',
        }),
      }),
    );
  });

  it('P6-TYPE-001: explicit device event type is preserved', async () => {
    // @ts-expect-error vitest-mock-extended typing mismatch
    vi.mocked(prisma.attendanceEvent.findUnique).mockImplementation(async () => null as never);
    // @ts-expect-error vitest-mock-extended typing mismatch
    vi.mocked(prisma.attendanceEvent.create).mockResolvedValue({
      id: 'canon-type',
    });

    const typeEvent = { ...mockRawEvent, raw_payload: { event_type: 'IN' } };

    await normalizer.normalizeSingle(typeEvent);

    expect(prisma.attendanceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: EventType.IN,
        }),
      }),
    );
  });

  it('P6-TYPE-002: UNKNOWN remains UNKNOWN', async () => {
    // @ts-expect-error vitest-mock-extended typing mismatch
    vi.mocked(prisma.attendanceEvent.findUnique).mockImplementation(async () => null as never);
    // @ts-expect-error vitest-mock-extended typing mismatch
    vi.mocked(prisma.attendanceEvent.create).mockResolvedValue({
      id: 'canon-unknown',
    });

    // Payload has no explicit event_type
    const typeEvent = { ...mockRawEvent, raw_payload: {} };

    await normalizer.normalizeSingle(typeEvent);

    expect(prisma.attendanceEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          event_type: EventType.UNKNOWN,
        }),
      }),
    );
  });

  it('P6-IDEM-DB-001: same raw event cannot create duplicate canonical DB record', async () => {
    // @ts-expect-error vitest-mock-extended typing mismatch
    vi.mocked(prisma.attendanceEvent.findUnique).mockImplementation(async () => null as never);
    // Simulate DB-level Unique Constraint Violation (P2002) which occurs if race condition happens
    const p2002Error = new Error('Unique constraint failed on the fields: (`event_uid`)');
    // @ts-expect-error vitest-mock-extended typing mismatch
    p2002Error.code = 'P2002';

    vi.mocked(prisma.attendanceEvent.create).mockRejectedValue(p2002Error as never);

    const result = await normalizer.normalizeSingle(mockRawEvent);

    expect(result.status).toBe(EventStatus.DUPLICATE);
    expect(result.reason).toBe('ALREADY_NORMALIZED');
  });

  it('P6-TYPE-003: event ordering does not determine IN/OUT', async () => {
    // @ts-expect-error vitest-mock-extended typing mismatch
    vi.mocked(prisma.attendanceEvent.findUnique).mockImplementation(async () => null as never);
    // @ts-expect-error vitest-mock-extended typing mismatch
    vi.mocked(prisma.attendanceEvent.create).mockResolvedValue({
      id: 'canon-order',
    });

    // Even if we process multiple events sequentially for same employee, their type remains UNKNOWN
    const event1 = { ...mockRawEvent, id: 'raw-1', raw_payload: {} };
    const event2 = { ...mockRawEvent, id: 'raw-2', raw_payload: {} };

    await normalizer.normalizeSingle(event1);
    await normalizer.normalizeSingle(event2);

    expect(prisma.attendanceEvent.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ event_type: EventType.UNKNOWN }) }),
    );
    expect(prisma.attendanceEvent.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ event_type: EventType.UNKNOWN }) }),
    );
  });

  it('P6-TYPE-004: timestamp does not determine IN/OUT', async () => {
    // @ts-expect-error vitest-mock-extended typing mismatch
    vi.mocked(prisma.attendanceEvent.findUnique).mockImplementation(async () => null as never);
    // @ts-expect-error vitest-mock-extended typing mismatch
    vi.mocked(prisma.attendanceEvent.create).mockResolvedValue({
      id: 'canon-time',
    });

    // 07:50 AM
    const morningEvent = {
      ...mockRawEvent,
      event_timestamp: new Date('2026-09-23T00:50:00Z'),
      raw_payload: {},
    };
    // 17:00 PM
    const eveningEvent = {
      ...mockRawEvent,
      event_timestamp: new Date('2026-09-23T10:00:00Z'),
      raw_payload: {},
    };

    await normalizer.normalizeSingle(morningEvent);
    await normalizer.normalizeSingle(eveningEvent);

    expect(prisma.attendanceEvent.create).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ data: expect.objectContaining({ event_type: EventType.UNKNOWN }) }),
    );
    expect(prisma.attendanceEvent.create).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ data: expect.objectContaining({ event_type: EventType.UNKNOWN }) }),
    );
  });
});
