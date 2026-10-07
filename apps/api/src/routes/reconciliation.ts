/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { ReconciliationService } from '@timebridge/attendance-engine';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { Permissions } from '@timebridge/security';

export const reconciliationRouter = Router();
const prisma = new PrismaClient();
const service = new ReconciliationService(prisma);

reconciliationRouter.use(authenticate);
reconciliationRouter.use(authorize(Permissions.AUDIT_READ));

reconciliationRouter.get('/summary', async (req: Request, res: Response) => {
  try {
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;

    const summary = await service.getOperationalSummary({ from, to, page: 1, pageSize: 0 });
    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate operational summary' });
  }
});

reconciliationRouter.get('/batches', async (req: Request, res: Response) => {
  try {
    const from = req.query.from ? new Date(req.query.from as string) : undefined;
    const to = req.query.to ? new Date(req.query.to as string) : undefined;
    const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
    const pageSize = req.query.pageSize ? parseInt(req.query.pageSize as string, 10) : 20;
    const status = req.query.status as string | undefined;
    const correlationId = req.query.correlationId as string | undefined;

    const result = await service.searchBatches({ from, to, page, pageSize, status, correlationId });
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: 'Failed to search batches' });
  }
});

reconciliationRouter.get('/batches/:id', async (req: Request, res: Response) => {
  try {
    const trace = await service.getBatchTrace(req.params.id as string);
    if (!trace) {
      res.status(404).json({ error: 'Batch not found' });
      return;
    }
    res.json(trace);
  } catch (error) {
    res.status(500).json({ error: 'Failed to trace batch' });
  }
});

reconciliationRouter.get('/events/:id', async (req: Request, res: Response) => {
  try {
    const trace = await service.getEventTrace(req.params.id as string);
    if (!trace) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    res.json(trace);
  } catch (error) {
    res.status(500).json({ error: 'Failed to trace event' });
  }
});

reconciliationRouter.get('/orphans', async (req: Request, res: Response) => {
  try {
    const orphans = await service.detectOrphans();
    res.json(orphans);
  } catch (error) {
    res.status(500).json({ error: 'Failed to detect orphans' });
  }
});
