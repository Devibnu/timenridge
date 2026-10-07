import { Router, Request, Response, RequestHandler } from 'express';
import { CycleStatus, EventStatus, EventType, PrismaClient } from '@timebridge/database';
import { Prisma } from '@prisma/client';
import { authenticate } from '../middleware/authenticate';
import { authorize } from '../middleware/authorize';
import { Permissions } from '@timebridge/security';
import { z } from 'zod';

export const attendanceRouter = Router();
const prisma = new PrismaClient();
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;
const requireReadAccess = [authenticate, authorize(Permissions.ATTENDANCE_READ)];

const querySchema = z
  .object({
    page: z
      .string()
      .regex(/^[1-9]\d*$/)
      .transform(Number)
      .optional(),
    pageSize: z
      .string()
      .regex(/^[1-9]\d*$/)
      .transform(Number)
      .optional(),
    deviceId: z.string().min(1).optional(),
    deviceEmployeeId: z.string().min(1).optional(),
    employeeId: z.string().min(1).optional(),
    attendanceEventId: z.string().min(1).optional(),
    ruleCode: z.string().min(1).optional(),
    decision: z.string().min(1).optional(),
    status: z.string().min(1).optional(),
    eventType: z.string().min(1).optional(),
    dateFrom: z.string().datetime({ offset: true }).optional(),
    dateTo: z.string().datetime({ offset: true }).optional(),
  })
  .strict()
  .refine((query) => !query.dateFrom || !query.dateTo || query.dateFrom <= query.dateTo, {
    message: 'dateFrom must be earlier than or equal to dateTo',
    path: ['dateTo'],
  });

function validationError(res: Response, error: z.ZodError): void {
  res.status(400).json({
    success: false,
    error: { code: 'VALIDATION_ERROR', message: 'Invalid query parameters', details: error.issues },
    meta: {},
  });
}

function databaseError(res: Response): void {
  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Attendance data could not be retrieved',
      details: null,
    },
    meta: {},
  });
}

function pagination(query: z.infer<typeof querySchema>) {
  const page = query.page ?? 1;
  const pageSize = Math.min(query.pageSize ?? DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE);
  return { page, pageSize, skip: (page - 1) * pageSize };
}

function dateRange(from?: string, to?: string): Prisma.DateTimeFilter {
  return {
    ...(from ? { gte: new Date(from) } : {}),
    ...(to ? { lte: new Date(to) } : {}),
  };
}

function enumFilter<T extends string>(
  value: string | undefined,
  values: readonly T[],
): T | undefined {
  return value && values.includes(value as T) ? (value as T) : undefined;
}

// Raw payload is deliberately excluded because the domain has no approved safe projection.
attendanceRouter.get('/raw', requireReadAccess, (async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);
  const query = parsed.data;
  const { page, pageSize, skip } = pagination(query);
  const where: Prisma.AttendanceRawEventWhereInput = {
    ...(query.deviceId ? { device_id: query.deviceId } : {}),
    ...(query.deviceEmployeeId ? { device_employee_id: query.deviceEmployeeId } : {}),
    ...(query.dateFrom || query.dateTo
      ? { event_timestamp: dateRange(query.dateFrom, query.dateTo) }
      : {}),
  };
  try {
    const [total, data] = await prisma.$transaction([
      prisma.attendanceRawEvent.count({ where }),
      prisma.attendanceRawEvent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ event_timestamp: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          device_id: true,
          device_employee_id: true,
          event_timestamp: true,
          source_hash: true,
          received_at: true,
          created_at: true,
        },
      }),
    ]);
    return res.status(200).json({
      success: true,
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch {
    return databaseError(res);
  }
}) as RequestHandler);

attendanceRouter.get('/events', requireReadAccess, (async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);
  const query = parsed.data;
  const status = enumFilter(query.status, Object.values(EventStatus));
  const eventType = enumFilter(query.eventType, Object.values(EventType));
  if (query.status && !status) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_STATUS', message: 'Invalid status filter', details: null },
      meta: {},
    });
  }
  if (query.eventType && !eventType) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_EVENT_TYPE', message: 'Invalid event type filter', details: null },
      meta: {},
    });
  }
  const { page, pageSize, skip } = pagination(query);
  const where: Prisma.AttendanceEventWhereInput = {
    ...(query.deviceId ? { device_id: query.deviceId } : {}),
    ...(query.deviceEmployeeId ? { device_employee_id: query.deviceEmployeeId } : {}),
    ...(query.employeeId ? { employee_id: query.employeeId } : {}),
    ...(status ? { status } : {}),
    ...(eventType ? { event_type: eventType } : {}),
    ...(query.dateFrom || query.dateTo
      ? { event_timestamp: dateRange(query.dateFrom, query.dateTo) }
      : {}),
  };
  try {
    const [total, data] = await prisma.$transaction([
      prisma.attendanceEvent.count({ where }),
      prisma.attendanceEvent.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ event_timestamp: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          event_uid: true,
          device_id: true,
          device_employee_id: true,
          employee_id: true,
          sap_employee_id: true,
          event_date: true,
          event_time: true,
          event_timestamp: true,
          event_type: true,
          source: true,
          status: true,
          created_at: true,
          updated_at: true,
          employee: { select: { name: true, internal_id: true } },
          device: { select: { name: true, device_code: true } },
        },
      }),
    ]);
    return res.status(200).json({
      success: true,
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch {
    return databaseError(res);
  }
}) as RequestHandler);

attendanceRouter.get('/rule-results', requireReadAccess, (async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);
  const query = parsed.data;
  const { page, pageSize, skip } = pagination(query);
  const where: Prisma.AttendanceRuleResultWhereInput = {
    ...(query.attendanceEventId ? { attendance_event_id: query.attendanceEventId } : {}),
    ...(query.ruleCode ? { rule_code: query.ruleCode } : {}),
    ...(query.decision ? { decision: query.decision } : {}),
    ...(query.dateFrom || query.dateTo
      ? { created_at: dateRange(query.dateFrom, query.dateTo) }
      : {}),
  };
  try {
    const [total, data] = await prisma.$transaction([
      prisma.attendanceRuleResult.count({ where }),
      prisma.attendanceRuleResult.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ created_at: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          attendance_event_id: true,
          rule_code: true,
          decision: true,
          reason: true,
          created_at: true,
        },
      }),
    ]);
    return res.status(200).json({
      success: true,
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch {
    return databaseError(res);
  }
}) as RequestHandler);

attendanceRouter.get('/cycles', requireReadAccess, (async (req: Request, res: Response) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return validationError(res, parsed.error);
  const query = parsed.data;
  const status = enumFilter(query.status, Object.values(CycleStatus));
  if (query.status && !status) {
    return res.status(400).json({
      success: false,
      error: { code: 'INVALID_STATUS', message: 'Invalid status filter', details: null },
      meta: {},
    });
  }
  const { page, pageSize, skip } = pagination(query);
  const where: Prisma.AttendanceCycleWhereInput = {
    ...(query.employeeId ? { employee_id: query.employeeId } : {}),
    ...(status ? { status } : {}),
    ...(query.dateFrom || query.dateTo
      ? { business_date: dateRange(query.dateFrom, query.dateTo) }
      : {}),
  };
  try {
    const [total, data] = await prisma.$transaction([
      prisma.attendanceCycle.count({ where }),
      prisma.attendanceCycle.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: [{ business_date: 'desc' }, { id: 'desc' }],
        select: {
          id: true,
          employee_id: true,
          sap_employee_id: true,
          business_date: true,
          shift_id: true,
          cycle_sequence: true,
          check_in_event_id: true,
          check_out_event_id: true,
          status: true,
          reason: true,
          created_at: true,
          updated_at: true,
          employee: { select: { name: true, internal_id: true } },
        },
      }),
    ]);
    return res.status(200).json({
      success: true,
      data,
      meta: { page, pageSize, total, totalPages: Math.ceil(total / pageSize) },
    });
  } catch {
    return databaseError(res);
  }
}) as RequestHandler);
