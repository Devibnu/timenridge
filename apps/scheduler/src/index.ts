import { PrismaClient } from '@timebridge/database';
import { QueueService } from '@timebridge/queue';
import { OutboxPublisher } from './OutboxPublisher';

console.log('TimeBridge Scheduler started.');

const prisma = new PrismaClient();
const queueService = new QueueService('attendance-raw-events');
const publisher = new OutboxPublisher(prisma, queueService);

// Basic placeholder for the scheduler
export const startScheduler = async () => {
  console.log('Scheduler is active and scheduling tasks...');

  // Polling every 5 seconds
  setInterval(async () => {
    try {
      const published = await publisher.publishPendingEvents(100);
      if (published > 0) {
        console.log(`[OutboxPublisher] Published ${published} events.`);
      }
    } catch (err) {
      console.error('[OutboxPublisher] Error:', err);
    }
  }, 5000);
};

if (require.main === module) {
  startScheduler().catch((err) => {
    console.error('Scheduler failed to start', err);
    process.exit(1);
  });

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received, shutting down scheduler...');
  await queueService.close();
  await prisma.$disconnect();
  process.exit(0);
});

  process.on('SIGINT', async () => {
    console.log('SIGINT received, shutting down scheduler...');
    await queueService.close();
    await prisma.$disconnect();
    process.exit(0);
  });
}
