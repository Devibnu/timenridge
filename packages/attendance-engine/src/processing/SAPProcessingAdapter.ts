export type SAPProcessingStatus =
  | 'SUCCESS'
  | 'PARTIAL_SUCCESS'
  | 'REJECTED'
  | 'PENDING'
  | 'INVALID_ACK'
  | 'DUPLICATE_ACK'
  | 'UNKNOWN_CORRELATION';

export interface SAPRecordResult {
  sapEmployeeId: string;
  status: 'SUCCESS' | 'REJECTED';
  reason?: string;
}

export interface SAPProcessingResult {
  status: SAPProcessingStatus;
  correlationId: string;
  batchIdentity: string;
  timestamp: Date;
  recordResults?: SAPRecordResult[];
  rawPayload?: Record<string, unknown>;
}

export interface SAPAcknowledgement {
  correlationId: string;
  batchIdentity: string;
  status: SAPProcessingStatus;
  recordResults?: SAPRecordResult[];
  timestamp?: string;
  rawPayload?: Record<string, unknown>;
}

export interface SAPProcessingAdapter {
  checkStatus(correlationId: string): Promise<SAPProcessingResult>;
  acknowledge(input: SAPAcknowledgement): Promise<SAPProcessingResult>;
}
