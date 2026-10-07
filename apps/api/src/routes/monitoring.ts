/* eslint-disable @typescript-eslint/no-explicit-any */
import { Router } from 'express';
import { authenticate } from '../middleware/authenticate';
import { checkRedisHealth, QueueMonitoring } from '@timebridge/queue';
import { getQueueNames } from './operationalHelper';

export const monitoringRouter = Router();

// Define requireRole locally if not exported by middleware
const requireRole = (roles: string[]) => (req: any, res: any, next: any) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Forbidden: Insufficient role' });
  }
  next();
};

// Ensure only specific operational roles can access
monitoringRouter.use(authenticate);
monitoringRouter.use(requireRole(['AUDITOR', 'INTEGRATION_ADMIN', 'SUPER_ADMIN']));

monitoringRouter.get('/redis', async (req, res) => {
  try {
    const status = await checkRedisHealth();
    res.status(200).json({
      success: true,
      data: {
        status,
        timestamp: new Date().toISOString(),
      },
      meta: {},
    });
  } catch {
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
});

monitoringRouter.get('/queues/metrics', async (req, res) => {
  try {
    const queueNames = getQueueNames();
    const metrics: Record<string, any> = {};

    for (const name of queueNames) {
      const qMon = new QueueMonitoring(name);
      metrics[name] = await qMon.getMetrics();
      await qMon.close();
    }

    res.status(200).json({
      success: true,
      data: {
        queues: metrics,
        timestamp: new Date().toISOString(),
      },
      meta: {},
    });
  } catch (err: any) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

monitoringRouter.get('/queues/failed', async (req, res) => {
  try {
    const queueNameParam = req.query.queue;
    const queueName: string =
      typeof queueNameParam === 'string' ? queueNameParam : getQueueNames()[0] || 'any';
    const qMon = new QueueMonitoring(queueName);
    const failedJobs = await qMon.getFailedJobs(0, 100);
    await qMon.close();

    res.status(200).json({
      success: true,
      data: {
        queue: queueName,
        failedJobs,
        timestamp: new Date().toISOString(),
      },
      meta: {},
    });
  } catch (err: any) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});

monitoringRouter.get('/workers', async (req, res) => {
  try {
    // In a distributed system, an API node might not have the worker instances locally.
    // BullMQ workers register in Redis, but BullMQ's Queue has a getWorkers method.
    const queueNames = getQueueNames();
    const workersInfo: Record<string, any[]> = {};

    for (const name of queueNames) {
      const qMon = new QueueMonitoring(name);
      // Access underlying bullmq getWorkers
      const bullQueue = (qMon as any).queue;
      const workers = await bullQueue.getWorkers();
      workersInfo[name] = workers;
      await qMon.close();
    }

    res.status(200).json({
      success: true,
      data: {
        workers: workersInfo,
        timestamp: new Date().toISOString(),
      },
      meta: {},
    });
  } catch (err: any) {
    const error = err as Error;
    res.status(500).json({ success: false, error: error.message });
  }
});
