import { EventEmitter } from 'events';
import { getQueueDb, queueEvents } from './sqliteQueue';

export type WorkerState = 'STARTING' | 'READY' | 'PROCESSING' | 'DRAINING' | 'STOPPED' | 'ERROR';

export interface WorkerHealth {
  name: string;
  status: WorkerState;
  startedAt: string | null;
  lastProcessedJob: string | null;
  lastFailure: string | null;
  activeJobs: number;
}

export interface Job<T = any> {
  id: string;
  name: string;
  data: T;
  opts: any;
  attemptsMade: number;
}

export type Processor<T = any> = (job: Job<T>) => Promise<any>;

export class WorkerService<T = any> extends EventEmitter {
  private state: WorkerState = 'STOPPED';
  private startedAt: Date | null = null;
  private lastProcessedJob: string | null = null;
  private lastFailure: string | null = null;
  private activeJobCount = 0;
  private isPolling = false;
  private stopped = false;

  constructor(
    public readonly queueName: string,
    public readonly workerName: string,
    private processor: Processor<T>,
  ) {
    super();
    this.state = 'STARTING';

    queueEvents.on(`new_job_${this.queueName}`, () => this.poll());

    this.state = 'READY';
    this.startedAt = new Date();

    // Initial poll
    this.poll();
  }

  private async poll() {
    if (this.isPolling || this.stopped) return;
    this.isPolling = true;

    try {
      while (!this.stopped) {
        const job = this.getNextJob();
        if (!job) {
          break; // Empty
        }

        this.state = 'PROCESSING';
        this.activeJobCount++;
        this.emit('active');

        try {
          await this.processor(job);
          this.markJobCompleted(job.id);
          this.lastProcessedJob = job.id;
          this.emit('completed', job);
        } catch (error: any) {
          this.markJobFailed(job, error);
          this.lastFailure = `Job ${job.id} failed: ${error.message}`;
          this.emit('failed', job, error);
        } finally {
          this.activeJobCount = Math.max(0, this.activeJobCount - 1);
          if (this.activeJobCount === 0) {
            this.state = 'READY';
          }
        }
      }
    } catch (err: any) {
      this.state = 'ERROR';
      this.lastFailure = err.message;
      this.emit('error', err);
    } finally {
      this.isPolling = false;
    }
  }

  private getNextJob(): Job<T> | null {
    const db = getQueueDb();

    const pickJob = db.transaction(() => {
      const row = db.prepare(`
        SELECT * FROM jobs
        WHERE queue_name = ? AND status = 'pending'
        ORDER BY created_at ASC LIMIT 1
      `).get(this.queueName) as any;

      if (!row) return null;

      db.prepare(`
        UPDATE jobs
        SET status = 'active', updated_at = ?
        WHERE id = ?
      `).run(Date.now(), row.id);

      return row;
    });

    const jobRow = pickJob();
    if (!jobRow) return null;

    return {
      id: jobRow.id,
      name: jobRow.name,
      data: JSON.parse(jobRow.data),
      opts: JSON.parse(jobRow.opts),
      attemptsMade: jobRow.attempts
    };
  }

  private markJobCompleted(id: string) {
    const db = getQueueDb();
    db.prepare(`UPDATE jobs SET status = 'completed', updated_at = ? WHERE id = ?`).run(Date.now(), id);
  }

  private markJobFailed(job: Job<T>, error: Error) {
    const db = getQueueDb();
    const attempts = job.attemptsMade + 1;
    const maxAttempts = job.opts?.attempts || 3;
    const status = attempts >= maxAttempts ? 'failed' : 'pending';

    db.prepare(`
      UPDATE jobs
      SET status = ?, attempts = ?, error = ?, updated_at = ?
      WHERE id = ?
    `).run(status, attempts, error.message, Date.now(), job.id);
  }

  public async close(): Promise<void> {
    this.state = 'DRAINING';
    this.stopped = true;
    queueEvents.removeAllListeners(`new_job_${this.queueName}`);
    this.state = 'STOPPED';
  }

  public getHealth(): WorkerHealth {
    return {
      name: this.workerName,
      status: this.state,
      startedAt: this.startedAt ? this.startedAt.toISOString() : null,
      lastProcessedJob: this.lastProcessedJob,
      lastFailure: this.lastFailure,
      activeJobs: this.activeJobCount,
    };
  }
}
