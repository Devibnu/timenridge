/* eslint-disable @typescript-eslint/no-explicit-any */
import { Worker, Job, Processor } from 'bullmq';
import { getRedisClient } from './redis';

export type WorkerState = 'STARTING' | 'READY' | 'PROCESSING' | 'DRAINING' | 'STOPPED' | 'ERROR';

export interface WorkerHealth {
  name: string;
  status: WorkerState;
  startedAt: string | null;
  lastProcessedJob: string | null;
  lastFailure: string | null;
  activeJobs: number;
}

export class WorkerService<T = any> {
  private worker: Worker;
  private state: WorkerState = 'STOPPED';
  private startedAt: Date | null = null;
  private lastProcessedJob: string | null = null;
  private lastFailure: string | null = null;
  private activeJobCount = 0;

  constructor(
    public readonly queueName: string,
    public readonly workerName: string,
    processor: Processor<T>,
  ) {
    this.state = 'STARTING';

    this.worker = new Worker(queueName, processor, {
      connection: getRedisClient(),
      name: workerName,
    });

    this.setupListeners();

    this.state = 'READY';
    this.startedAt = new Date();
  }

  private setupListeners() {
    this.worker.on('active', () => {
      this.state = 'PROCESSING';
      this.activeJobCount++;
    });

    this.worker.on('completed', (job: Job) => {
      this.lastProcessedJob = job.id || null;
      this.activeJobCount = Math.max(0, this.activeJobCount - 1);
      if (this.activeJobCount === 0) {
        this.state = 'READY';
      }
    });

    this.worker.on('failed', (job: Job | undefined, error: Error) => {
      if (job) {
        this.lastFailure = `Job ${job.id} failed: ${error.message}`;
      } else {
        this.lastFailure = `Unknown job failed: ${error.message}`;
      }
      this.activeJobCount = Math.max(0, this.activeJobCount - 1);
      if (this.activeJobCount === 0) {
        this.state = 'READY';
      }
    });

    this.worker.on('error', (err: Error) => {
      this.state = 'ERROR';
      this.lastFailure = err.message;
    });
  }

  /**
   * Gracefully close the worker
   */
  public async close(): Promise<void> {
    this.state = 'DRAINING';
    await this.worker.close();
    this.state = 'STOPPED';
  }

  /**
   * Get the health and status of this worker
   */
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
