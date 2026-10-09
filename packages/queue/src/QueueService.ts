import { randomUUID } from 'crypto';
import { getQueueDb, queueEvents } from './sqliteQueue';

export interface EnqueueOptions {
  jobId?: string;
  delay?: number;
}

export class QueueService {
  constructor(public readonly queueName: string) {}

  public async enqueue<T = any>(name: string, data: T, opts?: EnqueueOptions): Promise<string> {
    const db = getQueueDb();
    const id = opts?.jobId || randomUUID();
    const now = Date.now();

    const stmt = db.prepare(`
      INSERT INTO jobs (id, queue_name, name, data, opts, status, attempts, max_attempts, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        data = excluded.data,
        opts = excluded.opts,
        status = 'pending',
        updated_at = excluded.updated_at
    `);

    stmt.run(
      id,
      this.queueName,
      name,
      JSON.stringify(data),
      JSON.stringify(opts || {}),
      'pending',
      0,
      3,
      now,
      now
    );

    queueEvents.emit(`new_job_${this.queueName}`);

    return id;
  }

  public async close(): Promise<void> {
    // No-op
  }
}
