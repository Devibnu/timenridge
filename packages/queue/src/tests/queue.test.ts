import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueueService, WorkerService, QueueMonitoring, checkRedisHealth } from '../index';
// import * as redisModule from '../redis';

// Mock BullMQ completely
vi.mock('bullmq', () => {
  const mockQueue = vi.fn().mockImplementation(() => ({
    add: vi.fn().mockResolvedValue({ id: 'mock-job-id' }),
    close: vi.fn().mockResolvedValue(undefined),
    getJobCounts: vi.fn().mockResolvedValue({
      waiting: 1,
      active: 2,
      completed: 10,
      failed: 3,
      delayed: 0,
    }),
    getFailed: vi.fn().mockResolvedValue([
      {
        id: 'failed-1',
        name: 'test-job',
        attemptsMade: 3,
        failedReason: 'Simulated failure',
        timestamp: 12345,
      },
    ]),
  }));

  const mockWorker = vi.fn().mockImplementation(() => {
    return {
      on: vi.fn(),
      close: vi.fn().mockResolvedValue(undefined),
    };
  });

  return { Queue: mockQueue, Worker: mockWorker };
});

describe('P14 Queue Infrastructure Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('P14-REDIS-01: Should report NOT_CONFIGURED when host is explicitly set', async () => {
    process.env.REDIS_HOST = 'NOT_CONFIGURED';
    const status = await checkRedisHealth();
    expect(status).toBe('NOT_CONFIGURED');
  });

  it('P14-QUEUE-01: Should instantiate QueueService and enqueue job', async () => {
    const qService = new QueueService('test-queue');
    const jobId = await qService.enqueue('test-job', { data: 1 });
    expect(jobId).toBe('mock-job-id');
    await qService.close();
  });

  it('P14-WORKER-01: Should instantiate WorkerService and report health', async () => {
    const wService = new WorkerService('test-queue', 'worker-1', async () => {});
    const health = wService.getHealth();
    expect(health.name).toBe('worker-1');
    expect(health.status).toBe('READY');
    await wService.close();
  });

  it('P14-OBS-01: Should retrieve queue metrics', async () => {
    const qMon = new QueueMonitoring('test-queue');
    const metrics = await qMon.getMetrics();
    expect(metrics.waiting).toBe(1);
    expect(metrics.active).toBe(2);
    expect(metrics.completed).toBe(10);
    expect(metrics.failed).toBe(3);
    await qMon.close();
  });

  it('P14-OBS-02: Should retrieve failed jobs', async () => {
    const qMon = new QueueMonitoring('test-queue');
    const failed = await qMon.getFailedJobs();
    expect(failed.length).toBe(1);
    expect(failed[0]?.failedReason).toBe('Simulated failure');
    await qMon.close();
  });
});
