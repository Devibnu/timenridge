import { EventType } from '@timebridge/database';

export interface ShiftDefinition {
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  crosses_midnight: boolean;
}

export interface ShiftRuleDefinition {
  early_in_minutes: number;
  late_in_minutes: number;
  early_out_minutes: number;
  late_out_minutes: number;
  duplicate_window_seconds: number;
}

export type ToleranceDecision =
  | 'VALID_IN'
  | 'EARLY_IN'
  | 'LATE_IN'
  | 'VALID_OUT'
  | 'EARLY_OUT'
  | 'LATE_OUT'
  | 'DUPLICATE'
  | 'AMBIGUOUS'
  | 'REVIEW_REQUIRED';

export class ToleranceEvaluator {
  /**
   * Evaluates if a given event timestamp violates shift rules.
   */
  public evaluate(
    eventTimestamp: Date,
    eventType: EventType,
    shiftDate: Date,
    shift: ShiftDefinition,
    rule: ShiftRuleDefinition,
    previousEvents: { timestamp: Date; type: EventType }[] = [],
  ): { decision: ToleranceDecision; reason: string } {
    if (eventType === 'UNKNOWN') {
      return { decision: 'AMBIGUOUS', reason: 'UNKNOWN_EVENT_TYPE' };
    }

    // Check Duplicate
    if (
      this.isDuplicate(eventTimestamp, eventType, rule.duplicate_window_seconds, previousEvents)
    ) {
      return {
        decision: 'DUPLICATE',
        reason: `Occurred within ${rule.duplicate_window_seconds}s of previous similar event`,
      };
    }

    const { targetStart, targetEnd } = this.resolveTargetTimes(shiftDate, shift);

    // Compute delta in minutes (can be negative)
    if (eventType === 'IN') {
      const deltaMinutes = this.diffMinutes(eventTimestamp, targetStart);

      // Too early? (e.g. delta is -65, early_in is 60)
      if (deltaMinutes < -rule.early_in_minutes) {
        return {
          decision: 'EARLY_IN',
          reason: `Clocked in ${Math.abs(deltaMinutes)}m early (limit: ${rule.early_in_minutes}m)`,
        };
      }
      // Too late? (e.g. delta is 20, late_in is 15)
      if (deltaMinutes > rule.late_in_minutes) {
        return {
          decision: 'LATE_IN',
          reason: `Clocked in ${Math.abs(deltaMinutes)}m late (limit: ${rule.late_in_minutes}m)`,
        };
      }

      return { decision: 'VALID_IN', reason: 'Within allowed tolerance' };
    }

    if (eventType === 'OUT') {
      const deltaMinutes = this.diffMinutes(eventTimestamp, targetEnd);

      // Too early? (e.g. delta is -20, early_out is 15)
      if (deltaMinutes < -rule.early_out_minutes) {
        return {
          decision: 'EARLY_OUT',
          reason: `Clocked out ${Math.abs(deltaMinutes)}m early (limit: ${rule.early_out_minutes}m)`,
        };
      }
      // Too late? (e.g. delta is 65, late_out is 60)
      if (deltaMinutes > rule.late_out_minutes) {
        return {
          decision: 'LATE_OUT',
          reason: `Clocked out ${Math.abs(deltaMinutes)}m late (limit: ${rule.late_out_minutes}m)`,
        };
      }

      return { decision: 'VALID_OUT', reason: 'Within allowed tolerance' };
    }

    return { decision: 'REVIEW_REQUIRED', reason: `Unhandled event type: ${eventType}` };
  }

  private isDuplicate(
    timestamp: Date,
    type: EventType,
    windowSeconds: number,
    previousEvents: { timestamp: Date; type: EventType }[],
  ): boolean {
    const timeMs = timestamp.getTime();
    const windowMs = windowSeconds * 1000;

    for (const prev of previousEvents) {
      if (prev.type === type) {
        const diff = Math.abs(timeMs - prev.timestamp.getTime());
        if (diff <= windowMs) {
          return true;
        }
      }
    }
    return false;
  }

  public resolveTargetTimes(
    shiftDate: Date,
    shift: ShiftDefinition,
  ): { targetStart: Date; targetEnd: Date } {
    const startParts = shift.start_time.split(':').map(Number);
    const endParts = shift.end_time.split(':').map(Number);

    // Base date strictly at midnight UTC time
    const baseDate = new Date(shiftDate);
    baseDate.setUTCHours(0, 0, 0, 0);

    const targetStart = new Date(baseDate);
    targetStart.setUTCHours(startParts[0]!, startParts[1]!, 0, 0);

    const targetEnd = new Date(baseDate);
    targetEnd.setUTCHours(endParts[0]!, endParts[1]!, 0, 0);

    if (shift.crosses_midnight) {
      // End time is technically the next calendar day relative to shift date
      targetEnd.setUTCDate(targetEnd.getUTCDate() + 1);
    }

    return { targetStart, targetEnd };
  }

  private diffMinutes(actual: Date, target: Date): number {
    return Math.floor((actual.getTime() - target.getTime()) / 60000);
  }
}
