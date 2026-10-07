import {} from '@prisma/client';

import {
  PrismaClient,
  AttendanceEvent,
  AttendanceRuleResult,
  CycleStatus,
} from '@timebridge/database';
import { AttendanceProcessingContext } from '../mapping/EmployeeMappingResolver';

export interface CycleGenerationResult {
  status: 'SUCCESS' | 'ERROR';
  message: string;
  cycleId?: string;
}

/**
 * P9 Attendance Cycle Engine
 * Transforms Attendance Events and Rule Results into deterministic AttendanceCycles.
 */
export class AttendanceCycleEngine {
  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Deterministically processes events for an employee on a given business date
   * and generates/upserts the appropriate AttendanceCycle(s).
   */
  public async generateCycles(
    employeeId: string,
    businessDate: Date,
    events: (AttendanceEvent & { rule_results: AttendanceRuleResult[] })[],
  ): Promise<CycleGenerationResult[]> {
    if (!events.length) return [];

    const processingContexts = events.map((event) => {
      const result = event.rule_results.find((row) => row.rule_code === 'CORE_TOLERANCE_V1');
      const input = result?.input_data;
      if (!input || typeof input !== 'object' || Array.isArray(input)) return undefined;
      const context = (input as Record<string, unknown>).mappingResolution;
      return context && typeof context === 'object'
        ? (context as AttendanceProcessingContext)
        : undefined;
    });

    if (
      processingContexts.some(
        (context) => !context || context.status !== 'MAPPED' || !context.employeeId,
      )
    ) {
      return [
        {
          status: 'ERROR',
          message: 'Cycle generation requires a MAPPED processing context for every event.',
        },
      ];
    }

    const employeeIds = new Set(processingContexts.map((context) => context!.employeeId));
    const sapEmployeeIds = new Set(
      processingContexts.map((context) => context!.sapEmployeeId ?? null),
    );
    if (employeeIds.size !== 1 || !employeeIds.has(employeeId) || sapEmployeeIds.size !== 1) {
      return [
        {
          status: 'ERROR',
          message: 'Cycle events contain conflicting employee or SAP identity contexts.',
        },
      ];
    }
    const resolvedSapEmployeeId = processingContexts[0]!.sapEmployeeId ?? null;

    // 1. Sort deterministically (timestamp ASC, then event_uid ASC)
    const sortedEvents = [...events].sort((a, b) => {
      const timeDiff = a.event_timestamp.getTime() - b.event_timestamp.getTime();
      if (timeDiff !== 0) return timeDiff;
      return a.event_uid.localeCompare(b.event_uid);
    });

    const results: CycleGenerationResult[] = [];

    // Simplistic sequence assumption for MVP: one cycle per business date per employee unless explicitly separated.
    // P9 dictates deterministic pairing.

    // Group events to find IN and OUT based on Rule Results or Raw Types
    const getDecision = (evt: (typeof events)[0]) => {
      const result = evt.rule_results.find((r) => r.rule_code === 'CORE_TOLERANCE_V1');
      if (result) return result.decision;
      return evt.event_type; // Fallback to raw canonical type if no rule
    };

    // Extract valid INs and OUTs, excluding DUPLICATEs
    const validEvents = sortedEvents.filter((evt) => {
      const decision = getDecision(evt);
      return decision !== 'DUPLICATE';
    });

    // P9-CYCLE-005: Support multiple cycles by pairing IN and OUT
    let sequenceCounter = 1;
    let i = 0;

    while (i < validEvents.length) {
      let currentInEvent: unknown = null;
      let currentOutEvent: unknown = null;
      let isAmbiguous = false;
      const shiftId: string | null = null; // Can be resolved from P8 mapping
      const sapEmployeeId = resolvedSapEmployeeId;

      const evt: unknown = validEvents[i];
      const decision = getDecision(evt as (typeof events)[0]);
      const isUnknown = ['UNKNOWN', 'AMBIGUOUS', 'REVIEW_REQUIRED'].includes(decision);
      const isIn = ['VALID_IN', 'EARLY_IN', 'LATE_IN', 'IN'].includes(decision);
      const isOut = ['VALID_OUT', 'EARLY_OUT', 'LATE_OUT', 'OUT'].includes(decision);

      if (isUnknown) {
        isAmbiguous = true;
        i++;
      } else if (isIn) {
        currentInEvent = evt;
        i++;

        // Peek at next event to see if it's an OUT
        if (i < validEvents.length) {
          const nextEvt: unknown = validEvents[i];
          const nextDecision = getDecision(nextEvt as (typeof events)[0]);
          if (['VALID_OUT', 'EARLY_OUT', 'LATE_OUT', 'OUT'].includes(nextDecision)) {
            currentOutEvent = nextEvt;
            i++;
          } else if (['VALID_IN', 'EARLY_IN', 'LATE_IN', 'IN'].includes(nextDecision)) {
            // Consecutive IN
            isAmbiguous = true;
            // Advance over it to prevent infinite loop but keep it ambiguous
            i++;
          } else {
            // Unknown following IN
            isAmbiguous = true;
            i++;
          }
        }
      } else if (isOut) {
        // OUT without IN
        currentOutEvent = evt;
        i++;

        if (i < validEvents.length) {
          const nextEvt: unknown = validEvents[i];
          const nextDecision = getDecision(nextEvt as (typeof events)[0]);
          if (['VALID_OUT', 'EARLY_OUT', 'LATE_OUT', 'OUT'].includes(nextDecision)) {
            // Consecutive OUT
            isAmbiguous = true;
            i++;
          }
        }
      }

      // Determine final status
      let cycleStatus: CycleStatus = 'OPEN';
      let reason = '';

      if (isAmbiguous) {
        cycleStatus = 'AMBIGUOUS';
        reason = 'Sequence is ambiguous or contains UNKNOWN/unresolved consecutive events.';
      } else if (currentInEvent && currentOutEvent) {
        cycleStatus = 'COMPLETE';
        reason = 'Explicit IN event paired with explicit OUT event.';
      } else if (currentInEvent && !currentOutEvent) {
        cycleStatus = 'MISSING_OUT';
        reason = 'Valid IN event exists but no valid OUT event was available.';
      } else if (!currentInEvent && currentOutEvent) {
        cycleStatus = 'MISSING_IN';
        reason = 'Valid OUT event exists but no valid IN event was available.';
      } else {
        cycleStatus = 'REVIEW_REQUIRED';
        reason = 'No valid IN or OUT events found to form a cycle.';
      }

      // Attempt to upsert the cycle ensuring idempotency
      try {
        const cycle = await this.upsertCycle(
          employeeId,
          sapEmployeeId,
          businessDate,
          sequenceCounter, // cycle sequence
          shiftId,
          (currentInEvent as { id?: string })?.id || null,
          (currentOutEvent as { id?: string })?.id || null,
          cycleStatus,
          reason,
        );

        results.push({
          status: 'SUCCESS',
          message: 'Cycle generated successfully',
          cycleId: cycle.id,
        });
      } catch (error) {
        results.push({
          status: 'ERROR',
          message: error instanceof Error ? error.message : String(error),
        });
      }

      sequenceCounter++;
    }

    return results;
  }

  private async upsertCycle(
    employeeId: string,
    sapEmployeeId: string | null,
    businessDate: Date,
    cycleSequence: number,
    shiftId: string | null,
    checkInEventId: string | null,
    checkOutEventId: string | null,
    status: CycleStatus,
    reason: string,
  ) {
    const existing = await this.prisma.attendanceCycle.findFirst({
      where: {
        employee_id: employeeId,
        business_date: businessDate,
        cycle_sequence: cycleSequence,
      },
    });

    if (existing) {
      return await this.prisma.attendanceCycle.update({
        where: { id: existing.id },
        data: {
          sap_employee_id: sapEmployeeId,
          shift_id: shiftId,
          check_in_event_id: checkInEventId,
          check_out_event_id: checkOutEventId,
          status,
          reason,
        },
      });
    }

    return await this.prisma.attendanceCycle.create({
      data: {
        employee_id: employeeId,
        sap_employee_id: sapEmployeeId,
        business_date: businessDate,
        cycle_sequence: cycleSequence,
        shift_id: shiftId,
        check_in_event_id: checkInEventId,
        check_out_event_id: checkOutEventId,
        status,
        reason,
      },
    });
  }
}
