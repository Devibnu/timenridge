/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import { monitoringRouter } from './monitoring';

// Mock auth middleware to allow testing
vi.mock('../middleware/authenticate', () => ({
  authenticate: (req: any, res: any, next: any) => {
    req.user = { role: 'SUPER_ADMIN' };
    next();
  },
}));

// Mock the queue operational helper
vi.mock('../operationalHelper', () => ({
  getQueueNames: () => ['test-queue'],
}));

// Mock queue dependencies
vi.mock('@timebridge/queue', () => {
  return {
    checkRedisHealth: vi.fn().mockResolvedValue('HEALTHY'),
    QueueMonitoring: vi.fn().mockImplementation(() => ({
      getMetrics: vi.fn().mockResolvedValue({ waiting: 5 }),
      getFailedJobs: vi.fn().mockResolvedValue([{ id: 'fail-1', failedReason: 'error' }]),
      close: vi.fn().mockResolvedValue(undefined),
      queue: {
        getWorkers: vi.fn().mockResolvedValue([]),
      },
    })),
  };
});

describe('Operational Monitoring API', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/operational', monitoringRouter);

  it('P14-OBS-03: GET /api/operational/redis should return status', async () => {
    const res = await request(app).get('/api/operational/redis');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.data.status).toBe('HEALTHY');
  });

  it('P14-OBS-04: GET /api/operational/queues/metrics should return stats', async () => {
    const res = await request(app).get('/api/operational/queues/metrics');
    expect(res.status).toBe(200);
    expect(res.body.data.queues['test-queue']).toBeDefined();
    expect(res.body.data.queues['test-queue'].waiting).toBe(5);
  });

  it('P14-OBS-05: GET /api/operational/queues/failed should return DLQ', async () => {
    const res = await request(app).get('/api/operational/queues/failed');
    expect(res.status).toBe(200);
    expect(res.body.data.failedJobs[0].id).toBe('fail-1');
  });

  it('P14-OBS-06: GET /api/operational/workers should return worker data', async () => {
    const res = await request(app).get('/api/operational/workers');
    expect(res.status).toBe(200);
    expect(res.body.data.workers['test-queue']).toBeDefined();
  });
});
