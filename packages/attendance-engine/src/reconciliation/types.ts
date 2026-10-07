export interface PaginationFilter {
  page: number;
  pageSize: number;
}

export interface DateRangeFilter {
  from?: Date;
  to?: Date;
}

export interface ReconciliationFilter extends PaginationFilter, DateRangeFilter {
  employeeId?: string;
  sapEmployeeId?: string;
  deviceId?: string;
  status?: string;
  correlationId?: string;
}

export interface TraceStatus {
  status: string;
  reason?: string;
  timestamp: string;
  source: string;
  reference?: string;
}

export interface TraceEntity {
  id: string;
  identity?: string;
  traceStatus: TraceStatus;
  metadata?: Record<string, unknown>;
}

export interface EmployeeTrace {
  deviceEmployeeId?: string;
  internalEmployeeId?: string;
  sapEmployeeId?: string;
  mappingStatus: 'MAPPED' | 'REVIEW_REQUIRED';
}

export interface EventReconciliationTrace {
  source: string;
  device: TraceEntity | null;
  rawEvent: TraceEntity | null;
  canonicalEvent: TraceEntity | null;
  mapping: EmployeeTrace;
  ruleResults: TraceEntity[];
  cycle: TraceEntity | null;
  batch: TraceEntity | null;
  transport: TraceEntity | null;
  sapCorrelation: TraceEntity | null;
  acknowledgement: TraceEntity | null;
  sapResult: TraceEntity | null;
  operationalStatus: string;
}

export interface BatchReconciliationTrace {
  batchHeader: TraceEntity;
  totalRecords: number;
  processedRecords: number;
  rejectedRecords: number;
  transport: TraceEntity | null;
  acknowledgement: TraceEntity | null;
  sapProcessing: TraceEntity | null;
  records: BatchRecordReconciliationTrace[];
}

export interface BatchRecordReconciliationTrace {
  id: string;
  sapEmployeeId: string | null;
  cycleId: string;
  status: string;
  reason: string | null;
  sapResult?: TraceEntity | null;
}

export interface OperationalSummary {
  totalBatches: number;
  statuses: Record<string, number>;
}
