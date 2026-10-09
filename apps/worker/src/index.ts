import { WorkerService } from '@timebridge/queue';

import { AttendanceNormalizer } from '@timebridge/attendance-engine/dist/normalizer/AttendanceNormalizer';

console.log('TimeBridge Worker started.');

let testWorker: WorkerService;
let rawEventsWorker: WorkerService;

export const startWorker = async () => {
  console.log('Worker is connecting to Redis and listening for jobs...');

  // Register a dummy worker for infrastructure validation
  testWorker = new WorkerService('test-queue', 'test-worker-1', async (job) => {
    console.log(`[test-worker-1] Processing job ${job.id} with data:`, job.data);

    // Simulate some work
    await new Promise((resolve) => setTimeout(resolve, 1000));

    if (job.data?.shouldFail) {
      throw new Error('Simulated job failure');
    }

    return { success: true, processedAt: new Date().toISOString() };
  });

  // Register RawEvents worker
  const normalizer = new AttendanceNormalizer();
  rawEventsWorker = new WorkerService(
    'attendance-raw-events',
    'raw-events-worker-1',
    async (job) => {
      console.log(`[raw-events-worker-1] Processing job ${job.id} with data:`, job.data);

      if (job.data && job.data.raw_event_id) {
        const results = await normalizer.normalizeBatch([job.data.raw_event_id]);
        const firstResult = results[0];
        if (firstResult && firstResult.status === 'FAILED') {
          throw new Error(firstResult.reason || 'Normalization failed');
        }
        return { success: true, results };
      }

      throw new Error('Invalid job data: missing raw_event_id');
    },
  );

  console.log('Workers registered successfully.');
};

if (require.main === module) {
  startWorker().catch((err) => {
    console.error('Worker failed to start', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down workers...');
  if (testWorker) {
    await testWorker.close();
  }
  if (rawEventsWorker) {
    await rawEventsWorker.close();
  }
  process.exit(0);
});

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down workers...');
    if (testWorker) {
      await testWorker.close();
    }
    if (rawEventsWorker) {
      await rawEventsWorker.close();
    }
    process.exit(0);
  });
}
