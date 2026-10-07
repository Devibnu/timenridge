/* eslint-disable @typescript-eslint/no-explicit-any */
import { Queue, JobsOptions } from 'bullmq';
import { getRedisClient } from './redis';

export interface EnqueueOptions {
  jobId?: string;
  delay?: number;
}

export class QueueService {
  private queue: Queue;

  constructor(public readonly queueName: string) {
    this.queue = new Queue(queueName, {
      connection: getRedisClient(),
      defaultJobOptions: {
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 2000, // 2s, 4s, 8s
        },
        removeOnComplete: {
          age: 3600, // keep for 1 hour
          count: 1000,
        },
        removeOnFail: {
          age: 86400, // keep failures for 24 hours
        },
      },
    });
  }

  /**
   * Enqueue a job onto this queue with robust default options.
   * Job identity is enforced via jobId if provided for idempotency.
   */
  public async enqueue<T = any>(name: string, data: T, opts?: EnqueueOptions): Promise<string> {
    const jobOpts: JobsOptions = {};
    if (opts?.jobId) jobOpts.jobId = opts.jobId;
    if (opts?.delay) jobOpts.delay = opts.delay;

    const job = await this.queue.add(name, data, jobOpts);

    if (!job.id) {
      throw new Error('Job enqueued without an ID');
    }
    return job.id;
  }

  /**
   * Disconnect the queue client.
   */
  public async close(): Promise<void> {
    await this.queue.close();
  }

  /**
   * Get the underlying BullMQ instance (internal use).
   */
  public getBullQueue(): Queue {
    return this.queue;
  }
}
