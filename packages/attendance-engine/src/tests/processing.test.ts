import { mockDeep, DeepMockProxy } from 'vitest-mock-extended';
import { PrismaClient } from '@prisma/client';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { BatchAcknowledgementEngine } from '../processing/BatchAcknowledgementEngine';
import { MockSAPProcessingAdapter } from '../processing/MockSAPProcessingAdapter';

describe('BatchAcknowledgementEngine SA Verification (P12)', () => {
  let mockPrisma: DeepMockProxy<PrismaClient>;
  let adapter: MockSAPProcessingAdapter;
  let engine: BatchAcknowledgementEngine;

  const baseBatch: Record<string, unknown> = {
    id: 'batch-1',
    batch_identity: 'BATCH-001',
    status: 'UPLOADED',
    correlation_id: null,
    records: [
      { id: 'rec-1', sap_employee_id: 'sap-1', status: 'VALID' },
      { id: 'rec-2', sap_employee_id: 'sap-2', status: 'VALID' },
    ],
  };

  beforeEach(() => {
    vi.clearAllMocks();

    mockPrisma = mockDeep<PrismaClient>();

    adapter = new MockSAPProcessingAdapter();
    engine = new BatchAcknowledgementEngine(mockPrisma as never as PrismaClient, adapter);
  });

  it('P12: UPLOADED -> PROCESSED transition for SUCCESS ack', async () => {
    mockPrisma.attendanceBatch.findFirst.mockResolvedValue(baseBatch as never);

    await engine.processAcknowledgement({
      correlationId: 'corr-123',
      batchIdentity: 'BATCH-001',
      status: 'SUCCESS',
    });

    // Validates correlation ID is saved
    expect(mockPrisma.attendanceBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: { correlation_id: 'corr-123' },
    });

    // Validates batch becomes PROCESSED
    expect(mockPrisma.attendanceBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: { status: 'PROCESSED' },
    });

    // Validates ack is stored deterministically
    expect(mockPrisma.attendanceBatchAcknowledgement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          correlation_id: 'corr-123',
          status: 'SUCCESS',
        }),
      }),
    );
  });

  it('P12: UPLOADED -> SAP_REJECTED transition', async () => {
    mockPrisma.attendanceBatch.findFirst.mockResolvedValue(baseBatch as never);

    await engine.processAcknowledgement({
      correlationId: 'corr-123',
      batchIdentity: 'BATCH-001',
      status: 'REJECTED',
    });

    expect(mockPrisma.attendanceBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: { status: 'SAP_REJECTED' },
    });
  });

  it('P12: PARTIAL_SUCCESS maps rejected records', async () => {
    mockPrisma.attendanceBatch.findFirst.mockResolvedValue(baseBatch as never);

    await engine.processAcknowledgement({
      correlationId: 'corr-123',
      batchIdentity: 'BATCH-001',
      status: 'PARTIAL_SUCCESS',
      recordResults: [
        { sapEmployeeId: 'sap-1', status: 'SUCCESS' },
        { sapEmployeeId: 'sap-2', status: 'REJECTED', reason: 'Invalid date' },
      ],
    });

    expect(mockPrisma.attendanceBatch.update).toHaveBeenCalledWith({
      where: { id: 'batch-1' },
      data: { status: 'PARTIALLY_PROCESSED' },
    });

    // Record 'sap-2' (id: 'rec-2') should be updated to INVALID_STATUS
    expect(mockPrisma.attendanceBatchRecord.update).toHaveBeenCalledWith({
      where: { id: 'rec-2' },
      data: { status: 'INVALID_STATUS', reason: 'Invalid date' },
    });
  });

  it('P12: INVALID_ACK logs error and stops', async () => {
    await engine.processAcknowledgement({
      correlationId: '',
      batchIdentity: '',
      status: 'SUCCESS',
    });

    expect(mockPrisma.processingLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ message: 'Invalid acknowledgement received.' }),
      }),
    );
    expect(mockPrisma.attendanceBatch.findFirst).not.toHaveBeenCalled();
  });

  it('P12: UNKNOWN_CORRELATION logs error and stops', async () => {
    mockPrisma.attendanceBatch.findFirst.mockResolvedValue(null as never);

    await engine.processAcknowledgement({
      correlationId: 'unknown-999',
      batchIdentity: 'UNKNOWN-BATCH',
      status: 'SUCCESS',
    });

    expect(mockPrisma.processingLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          message: 'Batch not found for correlationId: unknown-999',
        }),
      }),
    );
  });

  it('P12: DUPLICATE_ACK maintains idempotency', async () => {
    // @ts-expect-error vitest-mock-extended typing mismatch
    mockPrisma.attendanceBatch.findFirst.mockResolvedValue({
      ...baseBatch,
      correlation_id: 'corr-dup',
      status: 'PROCESSED',
    });

    // Simulate already received matching ACK

    // @ts-expect-error vitest-mock-extended typing mismatch
    mockPrisma.attendanceBatchAcknowledgement.findUnique.mockResolvedValue({
      correlation_id: 'corr-dup',
      status: 'SUCCESS',
    });

    await engine.processAcknowledgement({
      correlationId: 'corr-dup',
      batchIdentity: 'BATCH-001',
      status: 'SUCCESS',
    });

    // Should NOT insert another ACK
    expect(mockPrisma.attendanceBatchAcknowledgement.create).not.toHaveBeenCalled();
    // Should NOT transition status again
    expect(mockPrisma.attendanceBatch.update).not.toHaveBeenCalled();
  });

  it('P12: INVALID_TRANSITION rejects PROCESSED -> SAP_REJECTED', async () => {
    // @ts-expect-error vitest-mock-extended typing mismatch
    mockPrisma.attendanceBatch.findFirst.mockResolvedValue({
      ...baseBatch,
      status: 'PROCESSED',
    });

    await engine.processAcknowledgement({
      correlationId: 'corr-123',
      batchIdentity: 'BATCH-001',
      status: 'REJECTED',
    });

    expect(mockPrisma.processingLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ message: expect.stringContaining('INVALID_TRANSITION') }),
      }),
    );
    expect(mockPrisma.attendanceBatch.update).not.toHaveBeenCalled();
  });

  it('P12: Valid transition produces exhaustive audit trail', async () => {
    mockPrisma.attendanceBatch.findFirst.mockResolvedValue(baseBatch as never);

    await engine.processAcknowledgement({
      correlationId: 'corr-123',
      batchIdentity: 'BATCH-001',
      status: 'SUCCESS',
    });

    expect(mockPrisma.processingLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          error_details: expect.objectContaining({
            batch_id: 'batch-1',
            correlation_id: 'corr-123',
            previous_status: 'UPLOADED',
            new_status: 'PROCESSED',
            source: 'SAP_HCI',
            reason: 'SUCCESS',
            external_reference: 'corr-123',
          }),
        }),
      }),
    );
  });
});
