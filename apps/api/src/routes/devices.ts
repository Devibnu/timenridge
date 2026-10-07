/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { Router, Request, Response, NextFunction } from 'express';
import { prisma, DeviceLifecycleStatus } from '@timebridge/database';
import { encryptCredential, decryptCredential } from '@timebridge/security';
import {
  DeviceAdapterFactory,
  DeviceAdapterError,
  DeviceAdapterConfig,
} from '@timebridge/device-adapters';
import { RawAttendanceCollector } from '@timebridge/attendance-engine';
import { authorize } from '../middleware/authorize';
import { z } from 'zod';

const router = Router();

// Validation schemas
const deviceSchema = z.object({
  device_code: z.string().min(1).max(100),
  name: z.string().min(1).max(100),
  vendor: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  host: z.string().max(255).optional().nullable(),
  port: z.number().int().min(1).max(65535).optional().nullable(),
  protocol: z.string().max(50).optional().nullable(),
  is_active: z.boolean().optional().default(true),
  lifecycle_status: z
    .nativeEnum(DeviceLifecycleStatus)
    .optional()
    .default(DeviceLifecycleStatus.REGISTERED),
  credential: z.string().optional().nullable(), // accepted in plaintext, saved encrypted
});

const updateDeviceSchema = deviceSchema.partial();

/**
 * Audit log helper
 */
async function logAudit(user: any, action: string, target: string, before: any, after: any) {
  try {
    await prisma.auditLog.create({
      data: {
        user: user?.email || 'SYSTEM',
        action,
        target,
        before,
        after,
      },
    });
  } catch (e) {
    console.error('Failed to write audit log', e);
  }
}

/**
 * Remove sensitive data before returning device
 */
function sanitizeDevice(device: any) {
  const { encrypted_credential, ...safeDevice } = device;
  return {
    ...safeDevice,
    credential_configured: !!encrypted_credential,
  };
}

/**
 * GET /api/devices
 * Requires: devices.read (All roles)
 */
router.get(
  '/',
  authorize('devices.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const devices = await prisma.device.findMany({
        orderBy: { created_at: 'desc' },
      });
      return res.json(devices.map(sanitizeDevice));
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * GET /api/devices/:id
 * Requires: devices.read
 */
router.get(
  '/:id',
  authorize('devices.read'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const device = await prisma.device.findUnique({
        where: { id: String(req.params.id) },
      });

      if (!device) {
        return res.status(404).json({ error: 'Device not found' });
      }

      return res.json(sanitizeDevice(device));
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * POST /api/devices
 * Requires: devices.create (SUPER_ADMIN, INTEGRATION_ADMIN)
 */
router.post(
  '/',
  authorize('devices.create'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = deviceSchema.parse(req.body);

      const existing = await prisma.device.findUnique({
        where: { device_code: validated.device_code },
      });
      if (existing) {
        return res.status(409).json({ error: 'Device code already in use' });
      }

      const { credential, ...deviceData } = validated;

      let encrypted_credential = null;
      if (credential) {
        encrypted_credential = encryptCredential(credential);
      }

      const device = await prisma.device.create({
        data: {
          ...deviceData,
          encrypted_credential,
        },
      });

      await logAudit(req.user, 'DEVICE_CREATED', device.id, null, {
        device_code: device.device_code,
        name: device.name,
        host: device.host,
      });

      return res.status(201).json(sanitizeDevice(device));
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation Error', details: (error as any).errors });
      }
      return next(error);
    }
  },
);

/**
 * PUT /api/devices/:id
 * Requires: devices.update (SUPER_ADMIN, INTEGRATION_ADMIN)
 */
router.put(
  '/:id',
  authorize('devices.update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const validated = updateDeviceSchema.parse(req.body);

      const existing = await prisma.device.findUnique({
        where: { id: String(req.params.id) },
      });
      if (!existing) {
        return res.status(404).json({ error: 'Device not found' });
      }

      if (validated.device_code && validated.device_code !== existing.device_code) {
        const conflict = await prisma.device.findUnique({
          where: { device_code: validated.device_code },
        });
        if (conflict) {
          return res.status(409).json({ error: 'Device code already in use' });
        }
      }

      const { credential, ...deviceData } = validated;

      let encrypted_credential = existing.encrypted_credential;
      let credentialUpdated = false;

      if (credential !== undefined) {
        if (credential === null || credential === '') {
          encrypted_credential = null;
        } else {
          encrypted_credential = encryptCredential(credential);
        }
        credentialUpdated = true;
      }

      const updated = await prisma.device.update({
        where: { id: String(req.params.id) },
        data: {
          ...deviceData,
          encrypted_credential,
        },
      });

      const { encrypted_credential: _oldEnc, ...oldSafe } = existing;
      const { encrypted_credential: _newEnc, ...newSafe } = updated;

      await logAudit(req.user, 'DEVICE_UPDATED', updated.id, oldSafe, newSafe);

      if (credentialUpdated) {
        await logAudit(req.user, 'DEVICE_CREDENTIAL_UPDATED', updated.id, null, null);
      }

      return res.json(sanitizeDevice(updated));
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: 'Validation Error', details: (error as any).errors });
      }
      return next(error);
    }
  },
);

/**
 * DELETE /api/devices/:id
 * Requires: devices.delete (SUPER_ADMIN, INTEGRATION_ADMIN)
 */
router.delete(
  '/:id',
  authorize('devices.delete'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.device.findUnique({
        where: { id: String(req.params.id) },
        include: {
          _count: {
            select: { raw_events: true, events: true },
          },
        },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const hasHistory =
        (existing as any)._count?.raw_events > 0 || (existing as any)._count?.events > 0;

      if (hasHistory) {
        // Soft delete
        const updated = await prisma.device.update({
          where: { id: String(req.params.id) },
          data: {
            lifecycle_status: DeviceLifecycleStatus.DISABLED,
            is_active: false,
          },
        });

        await logAudit(
          req.user,
          'DEVICE_DISABLED',
          existing.id,
          { is_active: existing.is_active },
          { is_active: false },
        );
        return res.json({
          message: 'Device disabled due to existing history',
          device: sanitizeDevice(updated),
        });
      } else {
        // Hard delete
        await prisma.device.delete({
          where: { id: String(req.params.id) },
        });

        const { encrypted_credential: _enc, ...safeData } = existing;
        await logAudit(req.user, 'DEVICE_DELETED', existing.id, safeData, null);

        return res.status(204).send();
      }
    } catch (error) {
      return next(error);
    }
  },
);

/**
 * POST /api/devices/:id/test-connection
 * Requires: devices.update
 */
router.post(
  '/:id/test-connection',
  authorize('devices.update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.device.findUnique({
        where: { id: String(req.params.id) },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Device not found' });
      }

      // Decrypt credentials if available
      let credential = null;
      if (existing.encrypted_credential) {
        credential = decryptCredential(existing.encrypted_credential);
      }

      const config: DeviceAdapterConfig = {
        device_id: existing.id,
        vendor: existing.vendor,
        protocol: existing.protocol,
        host: existing.host,
        port: existing.port,
        credential,
      };

      try {
        const adapter = DeviceAdapterFactory.create(config);
        const success = await adapter.testConnection();
        return res.json({ success });
      } catch (adapterError: any) {
        if (adapterError && adapterError.name === 'DeviceAdapterError') {
          if (adapterError.code === 'ADAPTER_NOT_FOUND') {
            return res.status(501).json(adapterError.toJSON ? adapterError.toJSON() : adapterError);
          }
          return res.status(400).json(adapterError.toJSON ? adapterError.toJSON() : adapterError);
        }
        throw adapterError;
      }
    } catch (error) {
      console.error('TEST 500 ERROR:', error);
      return next(error);
    }
  },
);

/**
 * POST /api/devices/:id/sync
 * Requires: devices.update
 */
router.post(
  '/:id/sync',
  authorize('devices.update'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const existing = await prisma.device.findUnique({
        where: { id: String(req.params.id) },
      });

      if (!existing) {
        return res.status(404).json({ error: 'Device not found' });
      }

      const result = await RawAttendanceCollector.collect(existing.id);

      await logAudit(req.user, 'DEVICE_SYNC', existing.id, null, result);

      return res.json(result);
    } catch (error) {
      return next(error);
    }
  },
);

export const devicesRouter = router;
