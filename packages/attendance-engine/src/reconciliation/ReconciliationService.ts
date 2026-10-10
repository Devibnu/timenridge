import { Prisma } from '@prisma/client';
import { PrismaClient } from '@prisma/client';
import { AttendanceProcessingContext } from '../mapping/EmployeeMappingResolver';
import {
  EventReconciliationTrace,
  BatchReconciliationTrace,
  OperationalSummary,
  ReconciliationFilter,
  TraceEntity,
  EmployeeTrace,
  BatchRecordReconciliationTrace,
} from './types';

export class ReconciliationService {
  constructor(private readonly prisma: PrismaClient) {}

  public async getEventTrace(eventId: string): Promise<EventReconciliationTrace | null> {
    const canonical = await this.prisma.attendanceEvent.findUnique({
      where: { id: eventId },
      include: {
        device: true,
        employee: {
          include: {
            mappings: true,
          },
        },
        rule_results: true,
      },
    });

    if (!canonical) return null;

    const rawEvent = await this.prisma.attendanceRawEvent.findFirst({
      where: {
        device_id: canonical.device_id,
        device_employee_id: canonical.device_employee_id,
        event_timestamp: canonical.event_timestamp,
      },
    });

    const cycle = await this.prisma.attendanceCycle.findFirst({
      where: {
        OR: [{ check_in_event_id: canonical.id }, { check_out_event_id: canonical.id }],
      },
    });

    let batchRecord = null;
    let batch = null;
    let ack = null;

    if (cycle) {
      batchRecord = await this.prisma.attendanceBatchRecord.findFirst({
        where: { attendance_cycle_id: cycle.id },
        include: { batch: true },
      });
      if (batchRecord?.batch) {
        batch = batchRecord.batch;
        ack = await this.prisma.attendanceBatchAcknowledgement.findFirst({
          where: { batch_id: batch.id },
        });
      }
    }

    const resolutionResult = canonical.rule_results.find(
      (result) => result.rule_code === 'CORE_TOLERANCE_V1',
    );
    const inputData = resolutionResult?.input_data;
    const mappingContext =
      inputData && typeof inputData === 'object' && !Array.isArray(inputData)
        ? (inputData as Record<string, unknown>).mappingResolution
        : undefined;
    const resolution =
      mappingContext && typeof mappingContext === 'object'
        ? (mappingContext as AttendanceProcessingContext)
        : undefined;
    const mappingStatus = resolution
      ? resolution.status === 'MAPPED'
        ? 'MAPPED'
        : 'REVIEW_REQUIRED'
      : canonical.sap_employee_id
        ? 'MAPPED'
        : 'REVIEW_REQUIRED';
    const employeeTrace: EmployeeTrace = {
      deviceEmployeeId: canonical.device_employee_id,
      internalEmployeeId: resolution?.employeeId || canonical.employee_id || undefined,
      sapEmployeeId: resolution?.sapEmployeeId || canonical.sap_employee_id || undefined,
      mappingStatus,
    };

    let operationalStatus = canonical.status.toString();
    if (batch) operationalStatus = batch.status;
    if (ack && batch?.status === 'PROCESSED') operationalStatus = 'PROCESSED';
    if (ack && batch?.status === 'SAP_REJECTED') operationalStatus = 'SAP_REJECTED';

    return {
      source: canonical.source,
      device: canonical.device
        ? this.buildTraceEntity(canonical.device.id, canonical.device.device_code, {
            status: canonical.device.status,
            timestamp: canonical.device.created_at.toISOString(),
            source: 'SYSTEM',
          })
        : null,
      rawEvent: rawEvent
        ? this.buildTraceEntity(rawEvent.id, undefined, {
            status: 'RECEIVED',
            timestamp: rawEvent.created_at.toISOString(),
            source: 'DEVICE',
          })
        : null,
      canonicalEvent: this.buildTraceEntity(canonical.id, canonical.event_uid, {
        status: canonical.status,
        timestamp: canonical.updated_at.toISOString(),
        source: 'NORMALIZER',
      }),
      mapping: employeeTrace,
      ruleResults: canonical.rule_results.map(
        (r: {
          id: string;
          rule_code: string;
          decision: string;
          reason: string;
          created_at: Date;
        }) =>
          this.buildTraceEntity(
            r.id,
            r.rule_code,
            {
              status: r.decision,
              reason: r.reason,
              timestamp: r.created_at.toISOString(),
              source: 'RULE_ENGINE',
            },
            resolution ? { mappingResolution: resolution } : undefined,
          ),
      ),
      cycle: cycle
        ? this.buildTraceEntity(cycle.id, undefined, {
            status: cycle.status,
            reason: cycle.reason || undefined,
            timestamp: cycle.updated_at.toISOString(),
            source: 'CYCLE_ENGINE',
          })
        : null,
      batch: batch
        ? this.buildTraceEntity(batch.id, batch.batch_identity, {
            status: batch.status,
            timestamp: batch.updated_at.toISOString(),
            source: 'BATCH_ENGINE',
          })
        : null,
      transport: null, // P11 Transport layer decoupled, can infer from batch status
      sapCorrelation: batch?.correlation_id
        ? this.buildTraceEntity(batch.correlation_id, batch.correlation_id, {
            status: 'CORRELATED',
            timestamp: batch.updated_at.toISOString(),
            source: 'SAP_ADAPTER',
          })
        : null,
      acknowledgement: ack
        ? this.buildTraceEntity(ack.id, ack.correlation_id, {
            status: ack.status,
            timestamp: ack.received_at.toISOString(),
            source: 'SAP_HCI',
          })
        : null,
      sapResult: ack
        ? this.buildTraceEntity(ack.id, undefined, {
            status: ack.status,
            timestamp: ack.received_at.toISOString(),
            source: 'SAP',
          })
        : null,
      operationalStatus,
    };
  }

  public async getBatchTrace(batchId: string): Promise<BatchReconciliationTrace | null> {
    const batch = await this.prisma.attendanceBatch.findUnique({
      where: { id: batchId },
      include: {
        records: true,
        acknowledgements: true,
      },
    });

    if (!batch) return null;

    const ack = batch.acknowledgements[0];
    const rejectedCount = batch.records.filter(
      (r: { status: string }) => r.status.includes('INVALID') || r.status.includes('REJECTED'),
    ).length;

    const recordsTrace: BatchRecordReconciliationTrace[] = batch.records.map(
      (r: {
        id: string;
        sap_employee_id: string | null;
        attendance_cycle_id: string;
        status: string;
        reason: string | null;
        payload: Prisma.JsonValue;
      }) => ({
        id: r.id,
        sapEmployeeId: r.sap_employee_id,
        cycleId: r.attendance_cycle_id,
        status: r.status,
        reason: r.reason,
        sapResult:
          ack && ack.payload
            ? this.extractRecordResultFromAck(
                ack.payload as any,
                r.sap_employee_id,
              )
            : null,
      }),
    );

    return {
      batchHeader: this.buildTraceEntity(batch.id, batch.batch_identity, {
        status: batch.status,
        timestamp: batch.updated_at.toISOString(),
        source: 'BATCH_ENGINE',
        reference: batch.correlation_id || undefined,
      }),
      totalRecords: batch.record_count,
      processedRecords: batch.record_count - rejectedCount,
      rejectedRecords: rejectedCount,
      transport: null,
      acknowledgement: ack
        ? this.buildTraceEntity(ack.id, ack.correlation_id, {
            status: ack.status,
            timestamp: ack.received_at.toISOString(),
            source: 'SAP_HCI',
          })
        : null,
      sapProcessing: ack
        ? this.buildTraceEntity(ack.id, undefined, {
            status: ack.status,
            timestamp: ack.received_at.toISOString(),
            source: 'SAP',
          })
        : null,
      records: recordsTrace,
    };
  }

  public async getOperationalSummary(filter: ReconciliationFilter): Promise<OperationalSummary> {
    const from = filter.from || new Date(0);
    const to = filter.to || new Date();

    const batches = await this.prisma.attendanceBatch.groupBy({
      by: ['status'],
      where: {
        created_at: {
          gte: from,
          lte: to,
        },
      },
      _count: true,
    });

    const statuses: Record<string, number> = {};
    let total = 0;
    for (const b of batches) {
      statuses[b.status] = b._count;
      total += b._count;
    }

    return {
      totalBatches: total,
      statuses,
    };
  }

  public async searchBatches(filter: ReconciliationFilter) {
    const from = filter.from || new Date(0);
    const to = filter.to || new Date();
    const page = Math.max(1, filter.page || 1);
    const pageSize = Math.min(100, Math.max(1, filter.pageSize || 20));

    const whereClause: Prisma.AttendanceBatchWhereInput = {
      created_at: {
        gte: from,
        lte: to,
      },
    };

    if (filter.status)
      whereClause.status = filter.status as any;
    if (filter.correlationId) whereClause.correlation_id = filter.correlationId;

    const total = await this.prisma.attendanceBatch.count({ where: whereClause });
    const data = await this.prisma.attendanceBatch.findMany({
      where: whereClause,
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: { created_at: 'desc' },
    });

    return { total, data, page, pageSize };
  }

  public async detectOrphans() {
    // Detect ACK without Batch
    const orphanedAcks = await this.prisma.attendanceBatchAcknowledgement.findMany({
      where: {
        batch: undefined,
      },
    });

    // Detect Cycle without Batch
    const orphanedCycles = await this.prisma.attendanceCycle.findMany({
      where: {
        status: 'READY_FOR_SAP',
        AttendanceBatchRecord: { none: {} },
      },
    });

    // Detect Record without Cycle
    const orphanedRecords = await this.prisma.attendanceBatchRecord.findMany({
      where: {
        cycle: undefined,
      },
    });

    return {
      orphanedAcks: orphanedAcks.map((a: { id: string }) => a.id),
      orphanedCycles: orphanedCycles.map((c: { id: string }) => c.id),
      orphanedRecords: orphanedRecords.map((r: { id: string }) => r.id),
    };
  }

  private buildTraceEntity(
    id: string,
    identity: string | undefined,
    status: {
      status: string;
      reason?: string;
      timestamp: string;
      source: string;
      reference?: string;
    },
    metadata?: Record<string, unknown>,
  ): TraceEntity {
    return {
      id,
      identity,
      traceStatus: status,
      ...(metadata ? { metadata } : {}),
    };
  }

  private extractRecordResultFromAck(
    payload: Record<string, unknown>,
    sapEmployeeId: string | null,
  ): TraceEntity | null {
    if (!sapEmployeeId || !payload.results || !Array.isArray(payload.results)) return null;
    const res = payload.results.find(
      (r: { sapEmployeeId: string }) => r.sapEmployeeId === sapEmployeeId,
    );
    if (!res) return null;

    return this.buildTraceEntity(sapEmployeeId, undefined, {
      status: res.status,
      reason: res.reason,
      timestamp: new Date().toISOString(),
      source: 'SAP',
    });
  }
}
