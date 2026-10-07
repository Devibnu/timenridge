import { Prisma } from '@prisma/client';
import {} from '@prisma/client';

import { PrismaClient, BatchStatus } from '@timebridge/database';
import {
  SAPProcessingAdapter,
  SAPAcknowledgement,
  SAPProcessingResult,
} from './SAPProcessingAdapter';

export class BatchAcknowledgementEngine {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly adapter: SAPProcessingAdapter,
  ) {}

  public async processAcknowledgement(input: SAPAcknowledgement): Promise<void> {
    const result = await this.adapter.acknowledge(input);

    if (result.status === 'INVALID_ACK') {
      await this.logProcessingError(result, 'Invalid acknowledgement received.');
      return;
    }

    if (result.status === 'UNKNOWN_CORRELATION') {
      await this.logProcessingError(result, `Unknown correlation id: ${result.correlationId}`);
      return;
    }

    // Find the batch by correlation ID or batch identity
    const batch = await this.prisma.attendanceBatch.findFirst({
      where: {
        OR: [{ correlation_id: result.correlationId }, { batch_identity: result.batchIdentity }],
      },
      include: {
        records: true,
      },
    });

    if (!batch) {
      await this.logProcessingError(
        result,
        `Batch not found for correlationId: ${result.correlationId}`,
      );
      return;
    }

    // Ensure the batch is in an expected state for status progression
    if (!['UPLOADED', 'ACKNOWLEDGED'].includes(batch.status)) {
      await this.logProcessingError(
        result,
        `INVALID_TRANSITION: Batch ${batch.batch_identity} is in state ${batch.status}, cannot process ACK.`,
      );
      return;
    }

    // Ensure we update correlation ID if not present
    if (!batch.correlation_id) {
      await this.prisma.attendanceBatch.update({
        where: { id: batch.id },
        data: { correlation_id: result.correlationId },
      });
    }

    // Check for Duplicate ACK (Idempotency)
    const existingAck = await this.prisma.attendanceBatchAcknowledgement.findUnique({
      where: { correlation_id: result.correlationId },
    });

    if (existingAck && existingAck.status === result.status) {
      // Duplicate ACK with same status, ignore idempotently
      return;
    }

    // Persist Acknowledgement
    await this.prisma.attendanceBatchAcknowledgement.create({
      data: {
        correlation_id: result.correlationId,
        batch_id: batch.id,
        status: result.status,
        payload: result.rawPayload ? (result.rawPayload as Prisma.InputJsonValue) : {},
      },
    });

    // Update Statuses based on SAP Processing Result
    let newBatchStatus: BatchStatus = 'ACKNOWLEDGED';

    if (result.status === 'SUCCESS') {
      newBatchStatus = 'PROCESSED';
    } else if (result.status === 'REJECTED') {
      newBatchStatus = 'SAP_REJECTED';
    } else if (result.status === 'PARTIAL_SUCCESS') {
      newBatchStatus = 'PARTIALLY_PROCESSED';
    }

    await this.prisma.attendanceBatch.update({
      where: { id: batch.id },
      data: { status: newBatchStatus },
    });

    // Audit transition
    await this.prisma.processingLog.create({
      data: {
        reference_id: result.correlationId,
        stage: 'SAP_ACKNOWLEDGEMENT',
        status: 'SUCCESS',
        message: 'Status transitioned',
        error_details: {
          batch_id: batch.id,
          correlation_id: result.correlationId,
          previous_status: batch.status,
          new_status: newBatchStatus,
          source: 'SAP_HCI',
          timestamp: new Date().toISOString(),
          reason: result.status,
          external_reference: result.correlationId,
        },
      },
    });

    // Handle individual record results if provided
    if (result.recordResults && result.recordResults.length > 0) {
      for (const rec of result.recordResults) {
        const batchRecord = batch.records.find(
          (r: { sap_employee_id: string | null }) => r.sap_employee_id === rec.sapEmployeeId,
        );
        if (batchRecord) {
          // You could update BatchRecordStatus or another field if needed
          if (rec.status === 'REJECTED') {
            await this.prisma.attendanceBatchRecord.update({
              where: { id: batchRecord.id },
              data: { status: 'INVALID_STATUS', reason: rec.reason || 'SAP Rejected' },
            });
          }
        }
      }
    }
  }

  private async logProcessingError(result: SAPProcessingResult, message: string) {
    await this.prisma.processingLog.create({
      data: {
        reference_id: result.correlationId || result.batchIdentity || 'UNKNOWN',
        stage: 'SAP_ACKNOWLEDGEMENT',
        status: 'FAILED',
        message: message,
        error_details: result.rawPayload ? (result.rawPayload as Prisma.InputJsonValue) : {},
      },
    });
  }
}
