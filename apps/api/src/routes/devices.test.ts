/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
process.env.DEVICE_CREDENTIAL_KEY =
  '1234567890123456789012345678901234567890123456789012345678901234';

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import request from 'supertest';
import express from 'express';
import { devicesRouter } from './devices';
import { prisma, DeviceLifecycleStatus } from '@timebridge/database';
import { RawAttendanceCollector } from '@timebridge/attendance-engine';

// -----------------------------------------------------------------------------
// Mock Setup
// -----------------------------------------------------------------------------

vi.mock('@timebridge/database', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    DeviceLifecycleStatus: {
      REGISTERED: 'REGISTERED',
      ACTIVE: 'ACTIVE',
      DISABLED: 'DISABLED',
    },
    prisma: {
      device: {
        findMany: vi.fn(),
        findUnique: vi.fn(),
        create: vi.fn(),
        update: vi.fn(),
        delete: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    },
  };
});

vi.mock('@timebridge/attendance-engine', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    RawAttendanceCollector: {
      collect: vi.fn(),
    },
  };
});

vi.mock('../middleware/authorize', () => {
  return {
    authorize: (permission: string) => {
      return (req: any, res: any, next: any) => {
        const role = req.headers['x-mock-role'];
        if (role === 'SUPER_ADMIN' || role === 'INTEGRATION_ADMIN') {
          req.user = { userId: 'admin1', role: role };
          return next();
        }

        if (role === 'OPERATOR' || role === 'AUDITOR') {
          req.user = { userId: 'op1', role: role };
          if (permission.endsWith('.read')) return next();
          return res.status(403).json({ error: 'Forbidden' });
        }

        if (!role) {
          return res.status(401).json({ error: 'Unauthorized' });
        }

        return res.status(403).json({ error: 'Forbidden' });
      };
    },
  };
});

vi.mock('@timebridge/security', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    encryptCredential: vi.fn((c) => `encrypted_${c}`),
    decryptCredential: vi.fn((c) => c.replace('encrypted_', '')),
  };
});

// -----------------------------------------------------------------------------
// Test App Setup
// -----------------------------------------------------------------------------

const app = express();
app.use(express.json());
app.use('/api/devices', devicesRouter);

describe('Device Management API - Security & Functional Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // P3-SEC-001: Device list requires devices.read
  it('P3-SEC-001: should allow any valid role to read devices', async () => {
    (prisma.device.findMany as any).mockResolvedValue([
      { id: '1', device_code: 'D01', name: 'Dev 1', encrypted_credential: 'yes' },
    ]);

    // Test with Auditor
    const res = await request(app).get('/api/devices').set('x-mock-role', 'AUDITOR');

    expect(res.status).toBe(200);
    expect(res.body[0].device_code).toBe('D01');
    // Ensure credential boolean exists but not the credential itself
    expect(res.body[0].credential_configured).toBe(true);
    expect(res.body[0].encrypted_credential).toBeUndefined();
  });

  // P3-SEC-002: Device creation requires devices.create
  it('P3-SEC-002: should reject Operator and Auditor on create', async () => {
    const res = await request(app)
      .post('/api/devices')
      .set('x-mock-role', 'OPERATOR')
      .send({ device_code: 'D02', name: 'Dev 2' });

    expect(res.status).toBe(403);
    expect(prisma.device.create).not.toHaveBeenCalled();
  });

  it('P3-SEC-002: should allow INTEGRATION_ADMIN to create', async () => {
    (prisma.device.findUnique as any).mockResolvedValue(null);
    (prisma.device.create as any).mockResolvedValue({ id: '2', device_code: 'D02', name: 'Dev 2' });

    const res = await request(app)
      .post('/api/devices')
      .set('x-mock-role', 'INTEGRATION_ADMIN')
      .send({ device_code: 'D02', name: 'Dev 2' });

    expect(res.status).toBe(201);
    expect(prisma.device.create).toHaveBeenCalled();
  });

  // P3-SEC-003: Device update requires devices.update
  it('P3-SEC-003: should reject Auditor on update', async () => {
    const res = await request(app)
      .put('/api/devices/1')
      .set('x-mock-role', 'AUDITOR')
      .send({ name: 'Dev X' });

    expect(res.status).toBe(403);
  });

  // P3-SEC-004: Device deletion requires devices.delete
  it('P3-SEC-004: should reject Operator on delete', async () => {
    const res = await request(app).delete('/api/devices/1').set('x-mock-role', 'OPERATOR');

    expect(res.status).toBe(403);
  });

  // Soft Delete logic
  it('should soft delete device if events exist', async () => {
    (prisma.device.findUnique as any).mockResolvedValue({
      id: '1',
      device_code: 'D01',
      _count: { raw_events: 5, events: 5 },
    });

    (prisma.device.update as any).mockResolvedValue({
      id: '1',
      lifecycle_status: DeviceLifecycleStatus.DISABLED,
      is_active: false,
    });

    const res = await request(app).delete('/api/devices/1').set('x-mock-role', 'SUPER_ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.message).toMatch(/disabled/i);
    expect(prisma.device.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { lifecycle_status: DeviceLifecycleStatus.DISABLED, is_active: false },
      }),
    );
    expect(prisma.device.delete).not.toHaveBeenCalled();
  });

  // Hard Delete logic
  it('should hard delete device if no events exist', async () => {
    (prisma.device.findUnique as any).mockResolvedValue({
      id: '1',
      device_code: 'D01',
      _count: { raw_events: 0, events: 0 },
    });

    const res = await request(app).delete('/api/devices/1').set('x-mock-role', 'SUPER_ADMIN');

    expect(res.status).toBe(204);
    expect(prisma.device.delete).toHaveBeenCalled();
  });

  // P3-SEC-005: Audit logs do not contain credentials
  it('P3-SEC-005: should not log raw or encrypted credentials in audit log', async () => {
    (prisma.device.findUnique as any).mockResolvedValue(null);
    (prisma.device.create as any).mockResolvedValue({
      id: '3',
      device_code: 'D03',
      name: 'Dev 3',
      encrypted_credential: 'xxx',
    });

    await request(app)
      .post('/api/devices')
      .set('x-mock-role', 'SUPER_ADMIN')
      .send({ device_code: 'D03', name: 'Dev 3', credential: 'supersecret' });

    expect(prisma.auditLog.create).toHaveBeenCalled();
    const createArgs = (prisma.auditLog.create as any).mock.calls[0][0];

    // Check that 'after' payload does not contain credential
    expect(createArgs.data.after.credential).toBeUndefined();
    expect(createArgs.data.after.encrypted_credential).toBeUndefined();
  });

  // P3-SEC-006: Port must be valid
  it('P3-SEC-006: should reject invalid ports', async () => {
    const res = await request(app)
      .post('/api/devices')
      .set('x-mock-role', 'SUPER_ADMIN')
      .send({ device_code: 'D04', name: 'Dev 4', port: 99999 });

    expect(res.status).toBe(400);
    expect(res.body.error).toBe('Validation Error');
  });

  // P3-SEC-007, updated to P4 Factory behavior
  it('should return 501 ADAPTER_NOT_FOUND on test-connection if no adapter is registered', async () => {
    (prisma.device.findUnique as any).mockResolvedValue({ id: '1', vendor: 'UnknownVendor' });

    const res = await request(app)
      .post('/api/devices/1/test-connection')
      .set('x-mock-role', 'SUPER_ADMIN');

    expect(res.status).toBe(501);
    expect(res.body.code).toBe('ADAPTER_NOT_FOUND');
  });

  // P3-SEC-008: Get Device does not return raw credentials
  it('P3-SEC-008: GET device by ID sanitizes credential', async () => {
    (prisma.device.findUnique as any).mockResolvedValue({
      id: '1',
      device_code: 'D01',
      name: 'Dev',
      encrypted_credential: 'xxx',
    });

    const res = await request(app).get('/api/devices/1').set('x-mock-role', 'SUPER_ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.encrypted_credential).toBeUndefined();
    expect(res.body.credential_configured).toBe(true);
  });

  // P5-API-001: Sync triggers RawAttendanceCollector
  it('P5-API-001: POST /sync triggers RawAttendanceCollector', async () => {
    (prisma.device.findUnique as any).mockResolvedValue({ id: '1' });
    (RawAttendanceCollector.collect as any).mockResolvedValue({
      status: 'SUCCESS',
      eventsReceived: 10,
      eventsInserted: 5,
    });

    const res = await request(app).post('/api/devices/1/sync').set('x-mock-role', 'SUPER_ADMIN');

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('SUCCESS');
    expect(res.body.eventsReceived).toBe(10);
    expect(RawAttendanceCollector.collect).toHaveBeenCalledWith('1');
    expect(prisma.auditLog.create).toHaveBeenCalled(); // via logAudit
  });
});
