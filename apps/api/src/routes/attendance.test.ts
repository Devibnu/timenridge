import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import { PrismaClient } from '@timebridge/database';
import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';

// Mock database
vi.mock('@timebridge/database', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@timebridge/database')>();
  return {
    ...actual,
    PrismaClient: vi.fn(),
  };
});

// Mock middlewares
vi.mock('../middleware/authenticate', () => ({
  authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => next(),
}));

vi.mock('../middleware/authorize', async () => {
  const { Permissions } = await import('@timebridge/security');
  return {
    authorize: (permission: string) => {
      return (
        req: express.Request & { user?: unknown },
        res: express.Response,
        next: express.NextFunction,
      ) => {
        const role = req.headers['x-mock-role'];
        if (
          role === 'SUPER_ADMIN' ||
          role === 'INTEGRATION_ADMIN' ||
          ((role === 'AUDITOR' || role === 'OPERATOR') &&
            permission === Permissions.ATTENDANCE_READ)
        ) {
          req.user = { userId: '1', role: role };
          return next();
        }
        if (!role) {
          return res.status(401).json({ error: 'Unauthorized' });
        }
        return res.status(403).json({ error: 'Forbidden' });
      };
    },
  };
});

const app = express();
app.use(express.json());

let mockPrisma: DeepMockProxy<PrismaClient>;

beforeAll(async () => {
  mockPrisma = mockDeep<PrismaClient>();
  (PrismaClient as unknown as import('vitest').Mock).mockImplementation(() => mockPrisma);

  const { attendanceRouter } = await import('./attendance.js');
  app.use('/api/attendance', attendanceRouter);
});

describe('Attendance API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (PrismaClient as unknown as import('vitest').Mock).mockImplementation(() => mockPrisma);
  });

  // P16.6-B-001 & P16.6-B-002: Auth & RBAC
  it('P16.6-B-001 & 002: should reject unauthorized and forbidden requests', async () => {
    const resUnauthorized = await request(app).get('/api/attendance/raw');
    expect(resUnauthorized.status).toBe(401);

    const resForbidden = await request(app)
      .get('/api/attendance/raw')
      .set('x-mock-role', 'INVALID_ROLE');
    expect(resForbidden.status).toBe(403);
  });

  // P16.6-B-003: Raw attendance pagination
  it('P16.6-B-003: should return raw attendance events with pagination', async () => {
    mockPrisma.$transaction.mockResolvedValue([
      1,
      [
        {
          id: 'raw1',
          device_id: 'd1',
          device_employee_id: 'e1',
          event_timestamp: new Date(),
          source_hash: 'hash1',
          received_at: new Date(),
          created_at: new Date(),
        },
      ],
    ]);

    const res = await request(app)
      .get('/api/attendance/raw?page=1&pageSize=10')
      .set('x-mock-role', 'AUDITOR');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
    expect(res.body.meta.page).toBe(1);
    expect(res.body.meta.pageSize).toBe(10);

    // Check sensitive fields
    expect(res.body.data[0].raw_payload).toBeUndefined(); // P16.6-B-014 Sensitive field protection
  });

  // P16.6-B-004: Canonical event pagination
  it('P16.6-B-004: should return canonical events with pagination and include relation', async () => {
    mockPrisma.$transaction.mockResolvedValue([
      2,
      [
        { id: 'evt1', employee: { name: 'Emp 1' }, device: { name: 'Dev 1' } },
        { id: 'evt2', employee: { name: 'Emp 2' }, device: { name: 'Dev 1' } },
      ],
    ]);

    const res = await request(app).get('/api/attendance/events').set('x-mock-role', 'AUDITOR');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(2);
    expect(res.body.meta.total).toBe(2);
    expect(res.body.meta.pageSize).toBe(20); // Default page size
  });

  // P16.6-B-005: Rule result pagination
  it('P16.6-B-005: should return rule results', async () => {
    mockPrisma.$transaction.mockResolvedValue([
      1,
      [{ id: 'rr1', rule_code: 'R1', decision: 'LATE' }],
    ]);

    const res = await request(app)
      .get('/api/attendance/rule-results')
      .set('x-mock-role', 'AUDITOR');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  // P16.6-B-006: Attendance cycle pagination
  it('P16.6-B-006: should return attendance cycles', async () => {
    mockPrisma.$transaction.mockResolvedValue([1, [{ id: 'cycle1', status: 'COMPLETE' }]]);

    const res = await request(app).get('/api/attendance/cycles').set('x-mock-role', 'AUDITOR');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data).toHaveLength(1);
  });

  // P16.6-B-007, 008: Filtering
  it('P16.6-B-007 & 008: should handle date and status filtering', async () => {
    mockPrisma.$transaction.mockResolvedValue([0, []]);

    const res = await request(app)
      .get(
        '/api/attendance/events?status=VALIDATED&eventType=IN&dateFrom=2023-01-01T00:00:00Z&dateTo=2023-01-31T23:59:59Z',
      )
      .set('x-mock-role', 'AUDITOR');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  // P16.6-B-009: Invalid filter rejection
  it('P16.6-B-009: should reject invalid filters', async () => {
    const res = await request(app)
      .get('/api/attendance/events?status=FAKE_STATUS')
      .set('x-mock-role', 'AUDITOR');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_STATUS');
  });

  it('P16.6-B-009: should reject invalid event type filter', async () => {
    const res = await request(app)
      .get('/api/attendance/events?eventType=FAKE_EVENT_TYPE')
      .set('x-mock-role', 'AUDITOR');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INVALID_EVENT_TYPE');
  });

  it('P16.6-B-009: should reject invalid dates', async () => {
    const res = await request(app)
      .get('/api/attendance/events?dateFrom=INVALID')
      .set('x-mock-role', 'AUDITOR');

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it('P16.6-B-010: should reject invalid pagination', async () => {
    const res = await request(app)
      .get('/api/attendance/raw?page=0&pageSize=-2')
      .set('x-mock-role', 'AUDITOR');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  // P16.6-B-011: Maximum page size enforcement
  it('P16.6-B-011: should enforce maximum page size', async () => {
    mockPrisma.$transaction.mockResolvedValue([0, []]);

    const res = await request(app)
      .get('/api/attendance/raw?pageSize=1000')
      .set('x-mock-role', 'AUDITOR');

    expect(res.status).toBe(200);
    expect(res.body.meta.pageSize).toBe(100);
    expect(res.body.meta).toMatchObject({ page: 1, total: 0, totalPages: 0 });
  });

  // P16.6-B-015: Response envelope
  it('P16.6-B-015: should format response properly on DB error', async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error('DB failure'));

    const res = await request(app).get('/api/attendance/cycles').set('x-mock-role', 'AUDITOR');

    expect(res.status).toBe(500);
    expect(res.body.success).toBe(false);
    expect(res.body.error.code).toBe('INTERNAL_SERVER_ERROR');
    expect(res.body.error.message).toBe('Attendance data could not be retrieved');
    expect(JSON.stringify(res.body)).not.toContain('DB failure');
  });

  it('P16.6-B-012: should order raw results deterministically by timestamp and id', async () => {
    mockPrisma.$transaction.mockResolvedValue([0, []]);
    await request(app).get('/api/attendance/raw').set('x-mock-role', 'AUDITOR');
    expect(mockPrisma.attendanceRawEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ event_timestamp: 'desc' }, { id: 'desc' }],
      }),
    );
  });

  // P16.6-B-013: No mutation through query API
  it('P16.6-B-013: should not support POST/PUT/DELETE', async () => {
    let res = await request(app).post('/api/attendance/raw').set('x-mock-role', 'AUDITOR');
    expect(res.status).toBe(404);

    res = await request(app).put('/api/attendance/events').set('x-mock-role', 'AUDITOR');
    expect(res.status).toBe(404);

    res = await request(app).delete('/api/attendance/cycles').set('x-mock-role', 'AUDITOR');
    expect(res.status).toBe(404);
  });
});
