import { Queue } from 'bullmq';
import { getRedisClient } from './redis';

export interface QueueMetrics {
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  delayed: number;
}

export interface FailedJobDetails {
  id: string;
  name: string;
  attemptsMade: number;
  failedReason: string;
  createdAt: number;
  processedAt: number | null;
  finishedAt: number | null;
}

export class QueueMonitoring {
  private queue: Queue;

  constructor(public readonly queueName: string) {
    this.queue = new Queue(queueName, {
      connection: getRedisClient(),
    });
  }

  /**
   * Get metrics for this queue
   */
  public async getMetrics(): Promise<QueueMetrics> {
    const jobCounts = await this.queue.getJobCounts(
      'waiting',
      'active',
      'completed',
      'failed',
      'delayed',
    );

    return {
      waiting: jobCounts.waiting || 0,
      active: jobCounts.active || 0,
      completed: jobCounts.completed || 0,
      failed: jobCounts.failed || 0,
      delayed: jobCounts.delayed || 0,
    };
  }

  /**
   * Get detailed information about failed jobs for DLQ visibility.
   * Strips out payload/data for security.
   */
  public async getFailedJobs(start = 0, end = 100): Promise<FailedJobDetails[]> {
    const failedJobs = await this.queue.getFailed(start, end);

    return failedJobs.map((job) => ({
      id: job.id || 'unknown',
      name: job.name,
      attemptsMade: job.attemptsMade,
      failedReason: job.failedReason || 'Unknown error',
      createdAt: job.timestamp,
      processedAt: job.processedOn || null,
      finishedAt: job.finishedOn || null,
    }));
  }

  /**
   * Close the queue connection
   */
  public async close(): Promise<void> {
    await this.queue.close();
  }
}
