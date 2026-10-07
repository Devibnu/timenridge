import { Router, Request, Response } from 'express';
import { prisma } from '@timebridge/database';
import { EmployeeMappingManager, EmployeeMappingResolver } from '@timebridge/attendance-engine';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { Permissions } from '@timebridge/security';
import { z } from 'zod';

const router = Router();
const manager = new EmployeeMappingManager();
const resolver = new EmployeeMappingResolver();

const listQuerySchema = z
  .object({
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(20),
    q: z.string().trim().max(100).optional(),
    status: z.enum(['ALL', 'ACTIVE', 'INACTIVE']).default('ALL'),
  })
  .strict();

const createMappingSchema = z.object({
  device_id: z.string().min(1),
  device_employee_id: z.string().trim().min(1).max(255),
  employee_id: z.string().min(1),
  sap_employee_id: z.string().trim().max(255).nullable().optional(),
  valid_from: z.string().datetime({ offset: true }),
  valid_to: z.string().datetime({ offset: true }).nullable().optional(),
});

const updateMappingSchema = z.object({
  sap_employee_id: z.string().trim().max(255).nullable().optional(),
  valid_from: z.string().datetime({ offset: true }).optional(),
  valid_to: z.string().datetime({ offset: true }).nullable().optional(),
});

const resolveSchema = z.object({ canonical_event_id: z.string().min(1) });

const mappingInclude = {
  device: { select: { id: true, device_code: true, name: true } },
  employee: { select: { id: true, internal_id: true, name: true } },
};

function validationError(res: Response, details: unknown): void {
  res.status(400).json({ error: 'Validation Error', details });
}

router.get('/options', authenticate, authorize(Permissions.EMPLOYEES_READ), async (_req, res) => {
  try {
    const [devices, employees] = await Promise.all([
      prisma.device.findMany({
        orderBy: [{ name: 'asc' }, { device_code: 'asc' }],
        select: { id: true, device_code: true, name: true },
      }),
      prisma.employee.findMany({
        orderBy: [{ name: 'asc' }, { internal_id: 'asc' }],
        select: { id: true, internal_id: true, name: true },
      }),
    ]);
    return res.status(200).json({ success: true, data: { devices, employees }, meta: {} });
  } catch {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Mapping options could not be retrieved' },
      meta: {},
    });
  }
});

router.get('/', authenticate, authorize(Permissions.EMPLOYEES_READ), async (req, res) => {
  const parsed = listQuerySchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error.issues);

  const { page, pageSize, q, status } = parsed.data;
  const where = {
    ...(status === 'ALL' ? {} : { is_active: status === 'ACTIVE' }),
    ...(q
      ? {
          OR: [
            { device_employee_id: { contains: q, mode: 'insensitive' as const } },
            { sap_employee_id: { contains: q, mode: 'insensitive' as const } },
            {
              employee: {
                is: {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' as const } },
                    { internal_id: { contains: q, mode: 'insensitive' as const } },
                  ],
                },
              },
            },
            {
              device: {
                is: {
                  OR: [
                    { name: { contains: q, mode: 'insensitive' as const } },
                    { device_code: { contains: q, mode: 'insensitive' as const } },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };

  try {
    const [total, data] = await prisma.$transaction([
      prisma.employeeMapping.count({ where }),
      prisma.employeeMapping.findMany({
        where,
        include: mappingInclude,
        orderBy: [{ created_at: 'desc' }, { id: 'asc' }],
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
    ]);
    return res.status(200).json({
      success: true,
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Employee mappings could not be retrieved' },
      meta: {},
    });
  }
});

router.get('/:id', authenticate, authorize(Permissions.EMPLOYEES_READ), async (req, res) => {
  try {
    const mapping = await prisma.employeeMapping.findUnique({
      where: { id: String(req.params.id) },
      include: mappingInclude,
    });
    if (!mapping) return res.status(404).json({ error: 'Mapping not found' });
    return res.status(200).json({ success: true, data: mapping, meta: {} });
  } catch {
    return res.status(500).json({
      success: false,
      error: { code: 'INTERNAL_SERVER_ERROR', message: 'Employee mapping could not be retrieved' },
      meta: {},
    });
  }
});

// Create Mapping
router.post(
  '/',
  authenticate,
  authorize(Permissions.EMPLOYEES_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const parsed = createMappingSchema.safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed.error.issues);
      const { device_id, device_employee_id, employee_id, sap_employee_id, valid_from, valid_to } =
        parsed.data;

      // In our system, actor comes from authenticated user. We'll simulate fetching it here for typing
      const actor = (req as Request & { user?: { email: string } }).user?.email || 'API_USER';

      const mapping = await manager.createMapping({
        device_id,
        device_employee_id,
        employee_id,
        sap_employee_id: sap_employee_id ?? undefined,
        valid_from: new Date(valid_from),
        valid_to: valid_to ? new Date(valid_to) : undefined,
        actor,
      });

      res.status(201).json(mapping);
    } catch (error: unknown) {
      res.status(400).json({ error: (error as Error).message });
    }
  },
);

// Update Mapping
router.patch(
  '/:id',
  authenticate,
  authorize(Permissions.EMPLOYEES_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const parsed = updateMappingSchema.safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed.error.issues);
      const { sap_employee_id, valid_from, valid_to } = parsed.data;
      const actor = (req as Request & { user?: { email: string } }).user?.email || 'API_USER';

      const mapping = await manager.updateMapping({
        mapping_id: id as string,
        sap_employee_id: sap_employee_id ?? undefined,
        valid_from: valid_from ? new Date(valid_from) : undefined,
        valid_to: valid_to !== undefined ? (valid_to ? new Date(valid_to) : null) : undefined,
        actor,
      });

      res.json(mapping);
    } catch (error: unknown) {
      res.status(400).json({ error: (error as Error).message });
    }
  },
);

// Deactivate Mapping
router.post(
  '/:id/deactivate',
  authenticate,
  authorize(Permissions.EMPLOYEES_UPDATE),
  async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const actor = (req as Request & { user?: { email: string } }).user?.email || 'API_USER';

      const mapping = await manager.deactivateMapping(id as string, actor);
      res.json(mapping);
    } catch (error: unknown) {
      res.status(400).json({ error: (error as Error).message });
    }
  },
);

// Resolve mapping for canonical event
router.post(
  '/resolve',
  authenticate,
  authorize(Permissions.ATTENDANCE_PROCESS),
  async (req: Request, res: Response) => {
    try {
      const parsed = resolveSchema.safeParse(req.body);
      if (!parsed.success) return validationError(res, parsed.error.issues);
      const { canonical_event_id } = parsed.data;
      const [event, resolution] = await Promise.all([
        prisma.attendanceEvent.findUnique({
          where: { id: canonical_event_id },
          select: { id: true, device_id: true, device_employee_id: true },
        }),
        resolver.resolve(canonical_event_id),
      ]);
      if (!event) return res.status(404).json({ error: 'Canonical event not found' });
      res.json({
        status: resolution.status,
        canonical_event_id: event.id,
        device_id: event.device_id,
        device_employee_id: event.device_employee_id,
        employee_id: resolution.employeeId ?? null,
        sap_employee_id: resolution.sapEmployeeId ?? null,
        mapping_id: resolution.mappingId,
        reason: resolution.reason,
        resolved_at: new Date().toISOString(),
      });
    } catch (error: unknown) {
      res.status(400).json({ error: (error as Error).message });
    }
  },
);

export default router;
