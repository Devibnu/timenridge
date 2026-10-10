import { Prisma } from '@prisma/client';
import {} from '@prisma/client';

import { PrismaClient, AttendanceCycle, BatchStatus } from '@timebridge/database';
import { SAPPreparationValidator } from './SAPPreparationValidator';

export interface BatchGenerationResult {
  batchId: string;
  batchIdentity: string;
  status: BatchStatus;
  totalEvaluated: number;
  eligibleCount: number;
  excludedCount: number;
}

export class AttendanceBatchEngine {
  private validator: SAPPreparationValidator;

  constructor(private readonly prisma: PrismaClient) {
    this.validator = new SAPPreparationValidator();
  }

  /**
   * Deterministically prepares an AttendanceBatch from a set of AttendanceCycles.
   * Performs partial eligibility evaluation.
   */
  public async prepareBatch(
    cycles: AttendanceCycle[],
    batchIdentity: string,
  ): Promise<BatchGenerationResult> {
    if (!cycles.length) {
      throw new Error('No cycles provided for batch preparation');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 1. Idempotency Check: Retrieve existing batch
      let batch = await tx.attendanceBatch.findUnique({
        where: { batch_identity: batchIdentity },
      });

      // If batch exists and is already marked READY (or beyond), do not modify it.
      if (batch && batch.status !== 'CREATED') {
        throw new Error(
          `Batch ${batchIdentity} is already in status ${batch.status}. It cannot be modified.`,
        );
      }

      // If it doesn't exist, create it
      if (!batch) {
        batch = await tx.attendanceBatch.create({
          data: {
            batch_identity: batchIdentity,
            status: 'CREATED',
            record_count: 0,
          },
        });
      }

      let eligibleCount = 0;
      let excludedCount = 0;

      // 2. Validate and map cycles
      for (const cycle of cycles) {
        const validation = this.validator.validate(cycle);

        let payload: unknown = undefined;
        if (validation.status === 'VALID') {
          payload = this.transformToSAPCanonical(cycle);
          eligibleCount++;
        } else {
          excludedCount++;
        }

        // Upsert record (idempotency at the record level based on batch_id + attendance_cycle_id)
        const existingRecord = await tx.attendanceBatchRecord.findUnique({
          where: {
            batch_id_attendance_cycle_id: {
              batch_id: batch.id,
              attendance_cycle_id: cycle.id,
            },
          },
        });

        if (existingRecord) {
          await tx.attendanceBatchRecord.update({
            where: { id: existingRecord.id },
            data: {
              sap_employee_id: cycle.sap_employee_id,
              payload: payload as any,
              status: validation.status,
              reason: validation.reason,
            },
          });
        } else {
          await tx.attendanceBatchRecord.create({
            data: {
              batch_id: batch.id,
              attendance_cycle_id: cycle.id,
              sap_employee_id: cycle.sap_employee_id,
              payload: payload as any,
              status: validation.status,
              reason: validation.reason,
            },
          });
        }
      }

      // Update final batch status and count
      // Mark as READY once successfully prepared
      batch = await tx.attendanceBatch.update({
        where: { id: batch.id },
        data: {
          record_count: eligibleCount,
          status: 'READY',
        },
      });

      return {
        batchId: batch.id,
        batchIdentity: batch.batch_identity,
        status: batch.status as any,
        totalEvaluated: cycles.length,
        eligibleCount,
        excludedCount,
      };
    });
  }

  /**
   * Deterministic transformation to internal SAP canonical representation.
   */
  private transformToSAPCanonical(cycle: AttendanceCycle) {
    return {
      sapEmployeeId: cycle.sap_employee_id,
      businessDate: cycle.business_date ? cycle.business_date.toISOString() : null,
      checkInEventId: cycle.check_in_event_id,
      checkOutEventId: cycle.check_out_event_id,
      status: 'COMPLETE',
      sourceCycleId: cycle.id,
    };
  }
}
