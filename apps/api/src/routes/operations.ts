import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { Permissions } from '@timebridge/security';
import { PrismaClient } from '@timebridge/database';

export const operationsRouter = Router();
const prisma = new PrismaClient();

// RBAC middleware for operations endpoints
// Using AUDIT_READ permission as it aligns with operational visibility
const requireOpsAccess = [authenticate, authorize(Permissions.AUDIT_READ)];

operationsRouter.get('/health', async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      service: 'timebridge-api',
    },
    meta: {},
  });
});

operationsRouter.get('/queues', requireOpsAccess, async (req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      status: 'NOT_CONFIGURED',
      message: 'Queue system is not currently implemented in this architecture phase.',
    },
    meta: {},
  });
});

operationsRouter.get('/devices', requireOpsAccess, async (req: Request, res: Response) => {
  try {
    const devices = await prisma.device.findMany({
      select: { id: true, status: true, last_seen_at: true },
    });

    const counts = devices.reduce(
      (acc, d) => {
        acc[d.status] = (acc[d.status] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    res.status(200).json({
      success: true,
      data: {
        total: devices.length,
        status_counts: counts,
        devices: devices.map((d) => ({
          id: d.id,
          status: d.status,
          last_seen_at: d.last_seen_at,
        })),
      },
      meta: {},
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    });
  }
});

operationsRouter.get('/processing', requireOpsAccess, async (req: Request, res: Response) => {
  try {
    const eventsCount = await prisma.attendanceEvent.count();
    const reviewRequiredCount = await prisma.attendanceEvent.count({
      where: { status: 'REVIEW_REQUIRED' },
    });

    const cycleCount = await prisma.attendanceCycle.count();

    const batchesReady = await prisma.attendanceBatch.count({ where: { status: 'READY' } });
    const batchesUploaded = await prisma.attendanceBatch.count({ where: { status: 'UPLOADED' } });
    const batchesProcessed = await prisma.attendanceBatch.count({ where: { status: 'PROCESSED' } });
    const batchesPartial = await prisma.attendanceBatch.count({
      where: { status: 'PARTIALLY_PROCESSED' },
    });
    const batchesRejected = await prisma.attendanceBatch.count({
      where: { status: 'SAP_REJECTED' },
    });

    res.status(200).json({
      success: true,
      data: {
        events: {
          received: eventsCount,
          review_required: reviewRequiredCount,
        },
        cycles: {
          total: cycleCount,
        },
        batches: {
          ready: batchesReady,
          uploaded: batchesUploaded,
          processed: batchesProcessed,
          partially_processed: batchesPartial,
          sap_rejected: batchesRejected,
        },
      },
      meta: {},
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    });
  }
});

operationsRouter.get('/summary', requireOpsAccess, async (req: Request, res: Response) => {
  try {
    const eventsCount = await prisma.attendanceEvent.count();
    const reviewRequiredCount = await prisma.attendanceEvent.count({
      where: { status: 'REVIEW_REQUIRED' },
    });

    const batchesReady = await prisma.attendanceBatch.count({ where: { status: 'READY' } });
    const batchesUploaded = await prisma.attendanceBatch.count({ where: { status: 'UPLOADED' } });
    const batchesProcessed = await prisma.attendanceBatch.count({ where: { status: 'PROCESSED' } });
    const batchesPartial = await prisma.attendanceBatch.count({
      where: { status: 'PARTIALLY_PROCESSED' },
    });
    const batchesRejected = await prisma.attendanceBatch.count({
      where: { status: 'SAP_REJECTED' },
    });

    res.status(200).json({
      success: true,
      data: {
        events: {
          received: eventsCount,
          review_required: reviewRequiredCount,
        },
        batches: {
          ready: batchesReady,
          uploaded: batchesUploaded,
          processed: batchesProcessed,
          partially_processed: batchesPartial,
          sap_rejected: batchesRejected,
        },
        queue: {
          status: 'NOT_CONFIGURED',
        },
      },
      meta: {},
    });
  } catch (err: unknown) {
    res.status(500).json({
      success: false,
      error: {
        code: 'INTERNAL_SERVER_ERROR',
        message: err instanceof Error ? err.message : 'Unknown error',
      },
    });
  }
});
