import { describe, it, expect, vi, beforeEach, afterEach, afterAll } from 'vitest';
import { QueueService, WorkerService, QueueMonitoring, checkRedisHealth, getQueueDb, closeQueueDb } from '../index';
import fs from 'fs';
import path from 'path';

describe('Local SQLite Queue Infrastructure Tests', () => {
  const dbPath = path.resolve(process.cwd(), 'queue.db');

  beforeEach(() => {
    vi.clearAllMocks();
    // Clean up DB before each test
    const db = getQueueDb();
    db.exec('DELETE FROM jobs');
  });

  afterAll(() => {
    closeQueueDb();
    if (fs.existsSync(dbPath)) fs.unlinkSync(dbPath);
    if (fs.existsSync(dbPath + '-wal')) fs.unlinkSync(dbPath + '-wal');
    if (fs.existsSync(dbPath + '-shm')) fs.unlinkSync(dbPath + '-shm');
  });

  it('Should report OK health', async () => {
    const status = await checkRedisHealth();
    expect(status).toBe('OK');
  });

  it('Should enqueue job and process it successfully', async () => {
    const qService = new QueueService('test-queue-1');
    const jobId = await qService.enqueue('test-job', { data: 42 });

    expect(jobId).toBeDefined();

    let processedData = null;
    const wService = new WorkerService('test-queue-1', 'worker-1', async (job) => {
      processedData = job.data;
    });

    // Wait a bit for processing
    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(processedData).toEqual({ data: 42 });

    const qMon = new QueueMonitoring('test-queue-1');
    const metrics = await qMon.getMetrics();
    expect(metrics.completed).toBe(1);
    expect(metrics.waiting).toBe(0);

    await wService.close();
  });

  it('Should retry job on failure and eventually fail', async () => {
    const qService = new QueueService('test-queue-2');
    await qService.enqueue('fail-job', { data: 1 }, { attempts: 3 } as any);

    let attempts = 0;
    const wService = new WorkerService('test-queue-2', 'worker-2', async (job) => {
      attempts++;
      throw new Error('Simulated failure');
    });

    // Wait for all retries to happen. The worker polls immediately but when it fails it just updates status.
    // Wait, in our WorkerService, when a job fails and attempts < max_attempts, its status is set to 'pending'.
    // The worker loop immediately picks it up again in the next tick!
    await new Promise((resolve) => setTimeout(resolve, 100));

    expect(attempts).toBe(3);

    const qMon = new QueueMonitoring('test-queue-2');
    const metrics = await qMon.getMetrics();
    expect(metrics.failed).toBe(1);
    expect(metrics.completed).toBe(0);

    const failedJobs = await qMon.getFailedJobs();
    expect(failedJobs.length).toBe(1);
    expect(failedJobs[0]?.failedReason).toBe('Simulated failure');

    await wService.close();
  });

  it('Should survive app restart (persistence)', async () => {
    const qService = new QueueService('test-queue-3');
    // Enqueue job but no worker
    await qService.enqueue('persist-job', { value: 99 });

    // Simulate restart by creating a new DB instance
    closeQueueDb();

    // Start worker after restart
    let processedValue = null;
    const wService = new WorkerService('test-queue-3', 'worker-3', async (job) => {
      processedValue = job.data.value;
    });

    await new Promise((resolve) => setTimeout(resolve, 50));

    expect(processedValue).toBe(99);

    await wService.close();
  });
});
