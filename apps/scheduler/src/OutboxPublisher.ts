import { PrismaClient } from '@timebridge/database';
import { QueueService } from '@timebridge/queue';

export class OutboxPublisher {
  private prisma: PrismaClient;
  private queueService: QueueService;
  private queueName: string;
  private isProcessing: boolean = false;

  constructor(
    prisma: PrismaClient,
    queueService: QueueService,
    queueName: string = 'attendance-raw-events',
  ) {
    this.prisma = prisma;
    this.queueService = queueService;
    this.queueName = queueName;
  }

  public async publishPendingEvents(batchSize: number = 100): Promise<number> {
    if (this.isProcessing) return 0;
    this.isProcessing = true;

    let publishedCount = 0;
    try {
      // Find pending outbox events
      const pendingEvents = await this.prisma.outboxEvent.findMany({
        where: { status: 'PENDING' },
        take: batchSize,
        orderBy: { created_at: 'asc' },
      });

      if (pendingEvents.length === 0) {
        return 0;
      }

      for (const event of pendingEvents) {
        try {
          // Enqueue to BullMQ
          await this.queueService.enqueue(this.queueName, event.payload);

          // Mark as published
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: 'PUBLISHED',
              published_at: new Date(),
            },
          });

          publishedCount++;
        } catch (err: unknown) {
          // Mark as failed and store error
          await this.prisma.outboxEvent.update({
            where: { id: event.id },
            data: {
              status: 'FAILED',
              error_message: (err as Error).message || 'Unknown error',
            },
          });
          console.error(`Failed to publish outbox event ${event.id}:`, err);
        }
      }
    } finally {
      this.isProcessing = false;
    }

    return publishedCount;
  }
}
