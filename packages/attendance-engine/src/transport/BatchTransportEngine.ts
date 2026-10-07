import { PrismaClient } from '@timebridge/database';
import { Prisma } from '@prisma/client';
import {} from '@prisma/client';
import { TransportAdapter } from './TransportAdapter';

import crypto from 'crypto';

export class BatchTransportEngine {
  private maxRetries = 3;

  constructor(
    private readonly prisma: PrismaClient,
    private readonly transportAdapter: TransportAdapter,
  ) {}

  /**
   * Transports a given READY batch.
   * Updates status to UPLOADED on success.
   */
  public async transportBatch(batchIdentity: string): Promise<void> {
    const batch = await this.prisma.attendanceBatch.findUnique({
      where: { batch_identity: batchIdentity },
      include: {
        records: true,
      },
    });

    if (!batch) {
      throw new Error(`Batch ${batchIdentity} not found.`);
    }

    if (batch.status !== 'READY') {
      throw new Error(
        `Batch ${batchIdentity} is not READY for transport. Current status: ${batch.status}`,
      );
    }

    // 1. Generate Deterministic Transport Package
    const serializedPayload = this.generateTransportPackage(batch);
    // SA Rule: Deterministic filename based on identity, not Date.now()
    const filename = `attendance_batch_${batch.batch_identity}.json`;
    const localChecksum = crypto.createHash('sha256').update(serializedPayload).digest('hex');

    // 2. Connect and Upload with Retry Logic
    await this.transportAdapter.connect();

    try {
      // Check idempotency first
      if (await this.transportAdapter.exists(filename)) {
        const remoteBuffer = await this.transportAdapter.download(filename);
        const remoteChecksum = crypto.createHash('sha256').update(remoteBuffer).digest('hex');

        if (localChecksum === remoteChecksum) {
          // Idempotent success
          await this.prisma.attendanceBatch.update({
            where: { id: batch.id },
            data: { status: 'UPLOADED' },
          });
          return;
        } else {
          // Conflict
          throw new Error(
            `REMOTE_FILE_CONFLICT: Remote file ${filename} exists but content differs.`,
          );
        }
      }

      let attempt = 0;
      let lastError: Error | null = null;
      let uploadSuccess = false;

      while (attempt < this.maxRetries) {
        attempt++;
        try {
          const uploadResult = await this.transportAdapter.upload({
            filename,
            content: serializedPayload,
          });

          if (!uploadResult.success) {
            throw new Error(uploadResult.error || 'Upload failed due to unknown error');
          }

          uploadSuccess = true;
          break; // Success, exit retry loop
        } catch (err: unknown) {
          lastError = err instanceof Error ? err : new Error(String(err));
          // Determine if permanent failure
          const msg = lastError.message.toLowerCase();
          if (
            msg.includes('authentication') ||
            msg.includes('permission denied') ||
            msg.includes('invalid path')
          ) {
            throw err; // Permanent, do not retry
          }
          // Transient failure, let it loop
        }
      }

      if (!uploadSuccess) {
        throw lastError;
      }

      // 3. Status strictly updated to UPLOADED (Not SAP_SUCCESS / PROCESSED)
      await this.prisma.attendanceBatch.update({
        where: { id: batch.id },
        data: {
          status: 'UPLOADED',
        },
      });
    } finally {
      await this.transportAdapter.disconnect();
    }
  }

  /**
   * Internal representation for transport to SAP/HCI.
   * Does NOT invent fake SAP IDoc/OData formats.
   */
  private generateTransportPackage(batch: {
    batch_identity: string;
    records: { status: string; payload: Prisma.JsonValue }[];
  }): string {
    const validRecords = batch.records
      .filter((r) => r.status === 'VALID' && r.payload)
      .map((r) => r.payload);

    return JSON.stringify(
      {
        batchIdentity: batch.batch_identity,
        recordCount: validRecords.length,
        records: validRecords,
        generatedAt: new Date().toISOString(),
      },
      null,
      2,
    );
  }
}
