import {} from '@prisma/client';
import {
  SAPProcessingAdapter,
  SAPProcessingResult,
  SAPAcknowledgement,
} from './SAPProcessingAdapter';

export class MockSAPProcessingAdapter implements SAPProcessingAdapter {
  private statusMap: Map<string, SAPProcessingResult> = new Map();

  // Helper method for tests to seed responses
  public seedResponse(correlationId: string, result: SAPProcessingResult) {
    this.statusMap.set(correlationId, result);
  }

  public async checkStatus(correlationId: string): Promise<SAPProcessingResult> {
    const result = this.statusMap.get(correlationId);
    if (!result) {
      return {
        status: 'UNKNOWN_CORRELATION',
        correlationId,
        batchIdentity: 'UNKNOWN',
        timestamp: new Date(),
      };
    }
    return result;
  }

  public async acknowledge(input: SAPAcknowledgement): Promise<SAPProcessingResult> {
    if (!input.correlationId || !input.batchIdentity) {
      return {
        status: 'INVALID_ACK',
        correlationId: input.correlationId || 'MISSING',
        batchIdentity: input.batchIdentity || 'MISSING',
        timestamp: new Date(),
        rawPayload: input.rawPayload,
      };
    }

    const result: SAPProcessingResult = {
      status: input.status,
      correlationId: input.correlationId,
      batchIdentity: input.batchIdentity,
      timestamp: input.timestamp ? new Date(input.timestamp) : new Date(),
      recordResults: input.recordResults,
      rawPayload: input.rawPayload || (input as unknown as Record<string, unknown>),
    };

    return result;
  }
}
