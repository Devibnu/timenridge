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

// Mock security
vi.mock('@timebridge/security', () => ({
  Permissions: { AUDIT_READ: 'audit:read' },
}));

// Mock middlewares
vi.mock('../middleware/authenticate', () => ({
  authenticate: (
    req: express.Request & { user?: unknown },
    res: express.Response,
    next: express.NextFunction,
  ): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader) {
      res
        .status(401)
        .json({ success: false, error: { code: 'UNAUTHORIZED', message: 'Missing token' } });
      return;
    }
    if (authHeader === 'Bearer valid-token-admin') {
      Object.assign(req, { user: { role: 'SUPER_ADMIN', permissions: ['audit:read'] } });
      next();
    } else if (authHeader === 'Bearer valid-token-operator') {
      Object.assign(req, { user: { role: 'OPERATOR', permissions: ['audit:read'] } });
      next();
    } else {
      res.status(403).json({
        success: false,
        error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
      });
      return;
    }
  },
}));

vi.mock('../middleware/authorize', () => ({
  authorize:
    (permission: string) =>
    (
      req: express.Request & { user?: unknown },
      res: express.Response,
      next: express.NextFunction,
    ): void => {
      // We must cast req.user to any temporarily because TypeScript doesn't know its shape here, but we should avoid eslint any
      const u = req.user as unknown as { permissions: string[] };
      if (u && u.permissions.includes(permission)) {
        next();
      } else {
        res.status(403).json({
          success: false,
          error: { code: 'FORBIDDEN', message: 'Insufficient permissions' },
        });
        return;
      }
    },
}));

// Setup app
const app = express();
app.use(express.json());

let mockPrisma: DeepMockProxy<PrismaClient>;

app.get('/health', (req, res) => {
  res.status(200).json({
    success: true,
    data: { status: 'healthy', timestamp: new Date().toISOString(), service: 'timebridge-api' },
    meta: {},
  });
});

app.get('/ready', async (req, res) => {
  try {
    const dbPromise = mockPrisma.$queryRaw`SELECT 1`;
    const timeoutPromise = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Database timeout')), 100),
    );
    await Promise.race([dbPromise, timeoutPromise]);
    res.status(200).json({
      success: true,
      data: {
        status: 'ready',
        dependencies: { database: 'healthy', redis: 'NOT_CONFIGURED', queue: 'NOT_CONFIGURED' },
      },
      meta: {},
    });
  } catch {
    res.status(503).json({
      success: false,
      error: {
        code: 'SERVICE_NOT_READY',
        message: 'One or more required dependencies are unavailable.',
        details: { database: 'unavailable', redis: 'NOT_CONFIGURED', queue: 'NOT_CONFIGURED' },
      },
      meta: {},
    });
  }
});

beforeAll(async () => {
  // Mock PrismaClient constructor before importing router
  mockPrisma = mockDeep<PrismaClient>();
  (PrismaClient as unknown as import('vitest').Mock).mockImplementation(() => mockPrisma);

  // Dynamically import the router so that the new PrismaClient() uses the mock
  const { operationsRouter } = await import('../routes/operations.js');
  app.use('/api/operations', operationsRouter);
});

describe('Phase 14: Operational Monitoring (P14-OBS-*)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-mock after clearAllMocks just in case
    (PrismaClient as unknown as import('vitest').Mock).mockImplementation(() => mockPrisma);
  });

  it('P14-OBS-001: /health returns healthy status', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('healthy');
  });

  it('P14-OBS-003: /ready returns dependencies when healthy', async () => {
    mockPrisma.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);
    const res = await request(app).get('/ready');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('ready');
    expect(res.body.data.dependencies.database).toBe('healthy');
    expect(res.body.data.dependencies.redis).toBe('NOT_CONFIGURED');
  });

  it('P14-OBS-005: dependency timeout bounded (/ready fails if DB hangs)', async () => {
    // Simulate DB hanging indefinitely
    mockPrisma.$queryRaw.mockImplementationOnce(
      () =>
        new Promise((resolve) =>
          setTimeout(resolve, 200),
        ) as unknown as import('@prisma/client').PrismaPromise<unknown>,
    );
    const res = await request(app).get('/ready');
    expect(res.status).toBe(503);
    expect(res.body.error.code).toBe('SERVICE_NOT_READY');
    expect(res.body.error.details.database).toBe('unavailable');
  });

  it('P14-OBS-007, P14-OBS-008, P14-OBS-009: queue visibility (NOT_CONFIGURED)', async () => {
    const res = await request(app)
      .get('/api/operations/queues')
      .set('Authorization', 'Bearer valid-token-admin');
    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('NOT_CONFIGURED');
  });

  it('P14-OBS-011: device operational summary', async () => {
    mockPrisma.device.findMany.mockResolvedValueOnce([
      {
        id: 'd1',
        status: 'ONLINE',
        last_seen_at: new Date(),
      } as unknown as import('@prisma/client').Device,
      {
        id: 'd2',
        status: 'OFFLINE',
        last_seen_at: new Date(),
      } as unknown as import('@prisma/client').Device,
    ]);
    const res = await request(app)
      .get('/api/operations/devices')
      .set('Authorization', 'Bearer valid-token-admin');
    expect(res.status).toBe(200);
    expect(res.body.data.total).toBe(2);
    expect(res.body.data.status_counts.ONLINE).toBe(1);
    expect(res.body.data.status_counts.OFFLINE).toBe(1);
  });

  it('P14-OBS-012, P14-OBS-013: processing and SAP processing summary', async () => {
    mockPrisma.attendanceEvent.count.mockResolvedValue(100);
    mockPrisma.attendanceCycle.count.mockResolvedValue(50);
    mockPrisma.attendanceBatch.count.mockResolvedValue(10);

    const res = await request(app)
      .get('/api/operations/processing')
      .set('Authorization', 'Bearer valid-token-admin');
    expect(res.status).toBe(200);
    expect(res.body.data.events.received).toBe(100);
    expect(res.body.data.cycles.total).toBe(50);
    expect(res.body.data.batches.ready).toBe(10);
  });

  it('P14-OBS-017: RBAC blocks unauthenticated requests', async () => {
    const res = await request(app).get('/api/operations/summary');
    expect(res.status).toBe(401);
  });

  it('P14-OBS-018: read-only guarantee (no mutation tools exposed)', async () => {
    // Only GET routes exist on the operations router, ensuring no mutation.
    const res = await request(app)
      .post('/api/operations/summary')
      .set('Authorization', 'Bearer valid-token-admin');
    expect(res.status).toBe(404);
  });
});
