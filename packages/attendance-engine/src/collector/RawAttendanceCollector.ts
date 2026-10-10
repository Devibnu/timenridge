import {} from '@prisma/client';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */
import { prisma } from '@timebridge/database';
import {
  DeviceAdapterFactory,
  DeviceAdapterError,
  DeviceAdapterConfig,
  RawAttendanceEvent,
} from '@timebridge/device-adapters';
import { decryptCredential } from '@timebridge/security/dist/crypto/encryption';
import { CollectionResult } from './types';
import * as crypto from 'crypto';

export class RawAttendanceCollector {
  private static readonly OVERLAP_MINUTES = parseInt(
    process.env.DEVICE_SYNC_OVERLAP_MINUTES || '5',
    10,
  );

  /**
   * Collect raw attendance events from a device and persist them immutably.
   */
  public static async collect(deviceId: string): Promise<CollectionResult> {
    const startTime = Date.now();
    let eventsReceived = 0;
    let eventsInserted = 0;
    let eventsSkipped = 0;

    try {
      // 1. Resolve target device
      const device = await prisma.device.findUnique({
        where: { id: deviceId },
      });

      if (!device) {
        throw new Error(`Device not found: ${deviceId}`);
      }

      if (!device.is_active || device.status === 'OFFLINE') {
        // Skip collection if device is manually disabled or known to be completely offline (depends on rules, but we can attempt if needed. Usually we just let it run and it will fail if offline).
        // Wait, the prompt didn't say to skip if OFFLINE, it might be back ONLINE. So we proceed unless disabled.
        if (!device.is_active) {
          return {
            deviceId,
            status: 'ERROR',
            eventsReceived: 0,
            eventsInserted: 0,
            eventsSkipped: 0,
            error: 'Device is not active',
            durationMs: Date.now() - startTime,
          };
        }
      }

      // 2. Resolve credentials
      let password = '';
      if (device.encrypted_credential) {
        try {
          password = decryptCredential(device.encrypted_credential);
        } catch (err) {
          throw new Error('Failed to decrypt device credential');
        }
      }

      // 3. Determine Sync Window
      const now = new Date();
      // If there's a last_successful_sync_at, we rewind by OVERLAP_MINUTES to ensure we don't miss events.
      // Otherwise, we might default to last 30 days or so. Let's say last 1 day if null.
      let fromDate = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago
      if (device.last_successful_sync_at) {
        fromDate = new Date(
          device.last_successful_sync_at.getTime() - this.OVERLAP_MINUTES * 60 * 1000,
        );
      }

      const toDate = now;

      // 4. Instantiate Adapter
      const config: DeviceAdapterConfig = {
        device_id: device.id,
        vendor: device.vendor,
        protocol: device.protocol,
        host: device.host,
        port: device.port,
        credential: password,
      };
      const adapter = DeviceAdapterFactory.create(config);

      // 5. Connect
      await adapter.connect();

      // 6. Pull events
      const records = await adapter.getAttendanceEvents({ from: fromDate, to: toDate });
      eventsReceived = records.length;

      // Gracefully disconnect
      await adapter.disconnect().catch((err) => {
        // Log disconnect error, but don't fail the sync
        console.warn(`Failed to disconnect from device ${deviceId}:`, err.message);
      });

      // 7. Persist Events Immutably & Handle duplicates using Transactional Outbox
      if (records.length > 0) {
        const incomingHashes = records.map((record) => record.source_hash);
        const existingEvents = await prisma.attendanceRawEvent.findMany({
          where: { device_id: deviceId, source_hash: { in: incomingHashes } },
          select: { source_hash: true },
        });
        const existingHashes = new Set(existingEvents.map((e: any) => e.source_hash));

        const newRecords = records.filter((r) => !existingHashes.has(r.source_hash));

        if (newRecords.length > 0) {
          const rawEvents = newRecords.map((record) => ({
            id: crypto.randomUUID(),
            device_id: deviceId,
            device_employee_id: record.device_employee_id,
            event_timestamp: record.event_timestamp,
            raw_payload: record.raw_payload || {},
            source_hash: record.source_hash,
          }));

          const outboxEvents = rawEvents.map((r) => ({
            id: crypto.randomUUID(),
            topic: 'attendance.raw.received',
            payload: { raw_event_id: r.id },
            status: 'PENDING',
          }));

          await prisma.$transaction(async (tx: any) => {
            await tx.attendanceRawEvent.createMany({
              data: rawEvents,
            });
            await tx.outboxEvent.createMany({
              data: outboxEvents,
            });
          });

          eventsInserted = rawEvents.length;
        }

        eventsSkipped = eventsReceived - eventsInserted;
      }

      // 8. Safely advance cursor
      await prisma.device.update({
        where: { id: deviceId },
        data: {
          last_successful_sync_at: toDate,
          last_seen_at: now,
          status: 'ONLINE',
          consecutive_failures: 0,
          last_error_at: null,
          last_error_message: null,
        },
      });

      return {
        deviceId,
        status: 'SUCCESS',
        eventsReceived,
        eventsInserted,
        eventsSkipped,
        durationMs: Date.now() - startTime,
      };
    } catch (error: unknown) {
      // 9. Failure Handling & Isolation
      // Map error to device state
      const errorMessage = (error as Error).message || 'Unknown error';
      let status: 'DEGRADED' | 'OFFLINE' = 'DEGRADED';

      if (error instanceof DeviceAdapterError) {
        if (error.code === 'CONNECTION_FAILED' || error.code === 'CONNECTION_TIMEOUT') {
          status = 'OFFLINE';
        } else if (error.code === 'AUTHENTICATION_FAILED') {
          status = 'DEGRADED'; // Or maybe OFFLINE depending on rules. DEGRADED is safer.
        }
      }

      // Increment consecutive failures safely
      await prisma.device
        .update({
          where: { id: deviceId },
          data: {
            status: status,
            last_error_at: new Date(),
            last_error_message: errorMessage,
            consecutive_failures: {
              increment: 1,
            },
          },
        })
        .catch((dbErr: any) => {
          console.error(
            `Failed to update device state after error for ${deviceId}:`,
            dbErr.message,
          );
        });

      return {
        deviceId,
        status: 'ERROR',
        eventsReceived,
        eventsInserted,
        eventsSkipped,
        error: errorMessage,
        durationMs: Date.now() - startTime,
      };
    }
  }
}
