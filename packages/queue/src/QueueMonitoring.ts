import { getQueueDb } from './sqliteQueue';

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
  constructor(public readonly queueName: string) {}

  public async getMetrics(): Promise<QueueMetrics> {
    const db = getQueueDb();
    const rows = db.prepare(`SELECT status, count(*) as count FROM jobs WHERE queue_name = ? GROUP BY status`).all(this.queueName) as any[];

    const metrics: QueueMetrics = { waiting: 0, active: 0, completed: 0, failed: 0, delayed: 0 };
    for (const row of rows) {
      if (row.status === 'pending') metrics.waiting = row.count;
      else if (row.status === 'active') metrics.active = row.count;
      else if (row.status === 'completed') metrics.completed = row.count;
      else if (row.status === 'failed') metrics.failed = row.count;
    }
    return metrics;
  }

  public async getFailedJobs(start = 0, end = 100): Promise<FailedJobDetails[]> {
    const db = getQueueDb();
    const limit = end - start;
    const offset = start;

    const rows = db.prepare(`
      SELECT id, name, attempts, error, created_at, updated_at
      FROM jobs
      WHERE queue_name = ? AND status = 'failed'
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?
    `).all(this.queueName, limit, offset) as any[];

    return rows.map((job) => ({
      id: job.id,
      name: job.name,
      attemptsMade: job.attempts,
      failedReason: job.error || 'Unknown error',
      createdAt: job.created_at,
      processedAt: null,
      finishedAt: job.updated_at,
    }));
  }

  public async close(): Promise<void> {
    // No-op
  }
}
