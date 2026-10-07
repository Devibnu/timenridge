import { AttendanceCycle, BatchRecordStatus } from '@timebridge/database';

export interface ValidationResult {
  status: BatchRecordStatus;
  reason?: string;
}

/**
 * Validates an AttendanceCycle for eligibility in SAP batching.
 * Strictly adheres to P10 constraints.
 */
export class SAPPreparationValidator {
  public validate(cycle: AttendanceCycle): ValidationResult {
    // 1. Must have SAP Employee ID
    if (!cycle.sap_employee_id) {
      return {
        status: 'INVALID_MISSING_SAP_EMPLOYEE',
        reason: 'Cycle is missing SAP Employee ID',
      };
    }

    // 2. Must have a valid business date
    if (!cycle.business_date) {
      return {
        status: 'INVALID_DATE',
        reason: 'Cycle is missing business_date',
      };
    }

    // 3. Check status
    if (cycle.status === 'MISSING_IN') {
      return {
        status: 'INVALID_MISSING_CHECK_IN',
        reason: 'Cycle status is MISSING_IN',
      };
    }

    if (cycle.status === 'MISSING_OUT') {
      return {
        status: 'INVALID_MISSING_CHECK_OUT',
        reason: 'Cycle status is MISSING_OUT',
      };
    }

    if (
      cycle.status === 'AMBIGUOUS' ||
      cycle.status === 'REVIEW_REQUIRED' ||
      cycle.status !== 'COMPLETE'
    ) {
      return {
        status: 'INVALID_STATUS',
        reason: `Cycle status is ${cycle.status}, not COMPLETE`,
      };
    }

    // 4. Traceability validation
    if (!cycle.check_in_event_id || !cycle.check_out_event_id) {
      return {
        status: 'INVALID_TRACEABILITY',
        reason: 'Cycle lacks check-in or check-out trace references despite being COMPLETE',
      };
    }

    // If all pass, it's VALID
    return {
      status: 'VALID',
      reason: 'Eligible for SAP Preparation',
    };
  }
}
