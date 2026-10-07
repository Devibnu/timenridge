import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express from 'express';

const mocks = vi.hoisted(() => {
  const mappingManager = {
    createMapping: vi.fn(),
    updateMapping: vi.fn(),
    deactivateMapping: vi.fn(),
  };
  const mappingResolver = { resolve: vi.fn() };
  const db = {
    $transaction: vi.fn((queries: Promise<unknown>[]) => Promise.all(queries)),
    employeeMapping: {
      count: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
    },
    device: { findMany: vi.fn() },
    employee: { findMany: vi.fn() },
    attendanceEvent: { findUnique: vi.fn() },
  };
  return { db, mappingManager, mappingResolver };
});

vi.mock('@timebridge/database', () => ({ prisma: mocks.db }));
vi.mock('@timebridge/attendance-engine', () => ({
  EmployeeMappingManager: vi.fn(() => mocks.mappingManager),
  EmployeeMappingResolver: vi.fn(() => mocks.mappingResolver),
}));
vi.mock('../middleware/authenticate', () => ({
  authenticate: (req: express.Request, res: express.Response, next: express.NextFunction) => {
    if (req.header('Authorization') !== 'Bearer test-token') {
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }
    (req as express.Request & { user?: unknown }).user = {
      userId: 'user-1',
      role: req.header('x-role') || 'OPERATOR',
    };
    next();
  },
}));
vi.mock('../middleware/authorize', () => ({
  authorize:
    (permission: string) =>
    (req: express.Request, res: express.Response, next: express.NextFunction) => {
      const role = (req as express.Request & { user?: { role?: string } }).user?.role;
      const allowed =
        permission === 'employees.read'
          ? ['SUPER_ADMIN', 'INTEGRATION_ADMIN', 'OPERATOR', 'AUDITOR'].includes(role ?? '')
          : permission === 'employees.update'
            ? ['SUPER_ADMIN', 'INTEGRATION_ADMIN'].includes(role ?? '')
            : permission === 'attendance.process'
              ? ['SUPER_ADMIN', 'INTEGRATION_ADMIN', 'OPERATOR'].includes(role ?? '')
              : false;
      if (!allowed) {
        res.status(403).json({ error: 'Forbidden' });
        return;
      }
      next();
    },
}));

import mappingsRouter from './employee-mappings';

const app = express();
app.use(express.json());
app.use('/api/employee-mappings', mappingsRouter);

const token = 'Bearer test-token';
const mapping = {
  id: 'mapping-1',
  device_id: 'device-1',
  device_employee_id: 'clock-17',
  employee_id: 'employee-1',
  sap_employee_id: 'sap-17',
  valid_from: '2026-01-01T00:00:00.000Z',
  valid_to: null,
  is_active: true,
};

describe('Employee Mapping API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.db.$transaction.mockImplementation((queries) => Promise.all(queries));
  });

  it('requires authentication for list access', async () => {
    const response = await request(app).get('/api/employee-mappings');
    expect(response.status).toBe(401);
  });

  it('lists mappings with search/status filters and pagination metadata', async () => {
    mocks.db.employeeMapping.count.mockResolvedValue(1);
    mocks.db.employeeMapping.findMany.mockResolvedValue([mapping]);
    const response = await request(app)
      .get('/api/employee-mappings?q=clock-17&status=ACTIVE&page=2&pageSize=10')
      .set('Authorization', token)
      .set('x-role', 'AUDITOR');

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      success: true,
      data: [mapping],
      meta: { page: 2, pageSize: 10, total: 1, totalPages: 1 },
    });
    expect(mocks.db.employeeMapping.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 10,
        take: 10,
        where: expect.objectContaining({ is_active: true }),
      }),
    );
  });

  it('rejects malformed list filters and page sizes', async () => {
    const response = await request(app)
      .get('/api/employee-mappings?page=0&pageSize=101')
      .set('Authorization', token);
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation Error');
  });

  it('returns safe device and employee options to read-authorized users', async () => {
    mocks.db.device.findMany.mockResolvedValue([
      { id: 'device-1', name: 'Front Gate', device_code: 'FG' },
    ]);
    mocks.db.employee.findMany.mockResolvedValue([
      { id: 'employee-1', name: 'Alex Employee', internal_id: 'E-1' },
    ]);
    const response = await request(app)
      .get('/api/employee-mappings/options')
      .set('Authorization', token)
      .set('x-role', 'OPERATOR');
    expect(response.status).toBe(200);
    expect(response.body.data.devices).toHaveLength(1);
    expect(response.body.data.employees).toHaveLength(1);
    expect(mocks.db.device.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ select: { id: true, device_code: true, name: true } }),
    );
  });

  it('creates a mapping for an authorized manager', async () => {
    mocks.mappingManager.createMapping.mockResolvedValue(mapping);
    const response = await request(app)
      .post('/api/employee-mappings')
      .set('Authorization', token)
      .set('x-role', 'INTEGRATION_ADMIN')
      .send({
        device_id: 'device-1',
        device_employee_id: 'clock-17',
        employee_id: 'employee-1',
        sap_employee_id: 'sap-17',
        valid_from: '2026-01-01T00:00:00.000Z',
      });
    expect(response.status).toBe(201);
    expect(response.body).toEqual(mapping);
    expect(mocks.mappingManager.createMapping).toHaveBeenCalledOnce();
  });

  it('rejects invalid create input before calling the domain manager', async () => {
    const response = await request(app)
      .post('/api/employee-mappings')
      .set('Authorization', token)
      .set('x-role', 'SUPER_ADMIN')
      .send({ device_id: '', device_employee_id: '', employee_id: '', valid_from: 'not-a-date' });
    expect(response.status).toBe(400);
    expect(response.body.error).toBe('Validation Error');
    expect(mocks.mappingManager.createMapping).not.toHaveBeenCalled();
  });

  it('returns a conflict response when the existing domain overlap constraint rejects create', async () => {
    mocks.mappingManager.createMapping.mockRejectedValue(
      new Error('Overlapping active mapping found for this device employee identity'),
    );
    const response = await request(app)
      .post('/api/employee-mappings')
      .set('Authorization', token)
      .set('x-role', 'SUPER_ADMIN')
      .send({
        device_id: 'device-1',
        device_employee_id: 'clock-17',
        employee_id: 'employee-1',
        valid_from: '2026-01-01T00:00:00.000Z',
      });
    expect(response.status).toBe(400);
    expect(response.body.error).toMatch(/Overlapping active mapping/);
  });

  it('updates mappings with the existing PATCH contract', async () => {
    mocks.mappingManager.updateMapping.mockResolvedValue(mapping);
    const response = await request(app)
      .patch('/api/employee-mappings/mapping-1')
      .set('Authorization', token)
      .set('x-role', 'SUPER_ADMIN')
      .send({ sap_employee_id: 'sap-updated', valid_to: '2026-12-31T23:59:59.000Z' });
    expect(response.status).toBe(200);
    expect(response.body).toEqual(mapping);
    expect(mocks.mappingManager.updateMapping).toHaveBeenCalledOnce();
  });

  it('denies unauthorized mapping mutations at the backend', async () => {
    const response = await request(app)
      .post('/api/employee-mappings')
      .set('Authorization', token)
      .set('x-role', 'OPERATOR')
      .send({});
    expect(response.status).toBe(403);
    expect(mocks.mappingManager.createMapping).not.toHaveBeenCalled();
  });

  it('deactivates using the existing endpoint', async () => {
    mocks.mappingManager.deactivateMapping.mockResolvedValue({ ...mapping, is_active: false });
    const response = await request(app)
      .post('/api/employee-mappings/mapping-1/deactivate')
      .set('Authorization', token)
      .set('x-role', 'INTEGRATION_ADMIN');
    expect(response.status).toBe(200);
    expect(response.body.is_active).toBe(false);
    expect(mocks.mappingManager.deactivateMapping).toHaveBeenCalledOnce();
  });

  it('resolves a canonical event for users with attendance.process', async () => {
    mocks.db.attendanceEvent.findUnique.mockResolvedValue({ id: 'event-1', device_id: 'device-1', device_employee_id: '123' });
    mocks.mappingResolver.resolve.mockResolvedValue({
      status: 'MAPPED',
      canonical_event_id: 'event-1',
    });
    const response = await request(app)
      .post('/api/employee-mappings/resolve')
      .set('Authorization', token)
      .set('x-role', 'OPERATOR')
      .send({ canonical_event_id: 'event-1' });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('MAPPED');
    expect(mocks.mappingResolver.resolve).toHaveBeenCalledWith('event-1');
  });

  it('rejects invalid resolve input and roles without attendance.process', async () => {
    const invalid = await request(app)
      .post('/api/employee-mappings/resolve')
      .set('Authorization', token)
      .set('x-role', 'OPERATOR')
      .send({ canonical_event_id: '' });
    expect(invalid.status).toBe(400);

    const forbidden = await request(app)
      .post('/api/employee-mappings/resolve')
      .set('Authorization', token)
      .set('x-role', 'AUDITOR')
      .send({ canonical_event_id: 'event-1' });
    expect(forbidden.status).toBe(403);
    expect(mocks.mappingResolver.resolve).not.toHaveBeenCalled();
  });
});
