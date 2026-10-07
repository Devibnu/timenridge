import { Prisma, PrismaClient, AttendanceEvent } from '@prisma/client';
import {} from '@prisma/client';
import { AttendanceRuleResult } from '@timebridge/database';
import { ShiftResolver } from './ShiftResolver';
import { ToleranceEvaluator } from './ToleranceEvaluator';
import {
  AttendanceProcessingContext,
  EmployeeMappingResolver,
  MappingResolution,
} from '../mapping/EmployeeMappingResolver';

export class AttendanceRuleEngine {
  private prisma: PrismaClient;
  private shiftResolver: ShiftResolver;
  private toleranceEvaluator: ToleranceEvaluator;
  private mappingResolver: EmployeeMappingResolver;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
    this.shiftResolver = new ShiftResolver(this.prisma);
    this.toleranceEvaluator = new ToleranceEvaluator();
    this.mappingResolver = new EmployeeMappingResolver(this.prisma);
  }

  /**
   * Evaluates an AttendanceEvent against business rules and persists the AttendanceRuleResult.
   */
  public async evaluateEvent(
    eventId: string,
    context?: AttendanceProcessingContext,
  ): Promise<AttendanceRuleResult | null> {
    const event = await this.prisma.attendanceEvent.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error(`AttendanceEvent with ID ${eventId} not found.`);
    }

    if (context && context.attendanceEventId !== eventId) {
      throw new Error('Processing context does not match the canonical attendance event.');
    }

    const resolution: MappingResolution = context ?? (await this.mappingResolver.resolve(eventId));
    const processingContext: AttendanceProcessingContext = {
      attendanceEventId: eventId,
      ...resolution,
    };

    if (resolution.status === 'UNMAPPED') {
      return this.persistResult(
        event,
        'REVIEW_REQUIRED',
        resolution.reason || 'UNMAPPED_EMPLOYEE',
        { mappingResolution: processingContext },
      );
    }

    if (resolution.status === 'AMBIGUOUS') {
      return this.persistResult(
        event,
        'AMBIGUOUS',
        resolution.reason || 'AMBIGUOUS_EMPLOYEE_MAPPING',
        { mappingResolution: processingContext },
      );
    }

    if (!resolution.employeeId) {
      throw new Error('MAPPED resolution must contain employeeId.');
    }

    if (event.event_type === 'UNKNOWN') {
      return this.persistResult(event, 'AMBIGUOUS', 'UNKNOWN_EVENT_TYPE', {
        mappingResolution: processingContext,
      });
    }

    // 1. Resolve Shift
    const { resolved, status: resolveStatus } = await this.shiftResolver.resolve(
      resolution.employeeId,
      event.event_timestamp,
    );

    if (resolveStatus === 'NO_ASSIGNMENT') {
      return this.persistResult(event, 'REVIEW_REQUIRED', 'NO_ACTIVE_SHIFT_ASSIGNMENT', {
        mappingResolution: processingContext,
      });
    }

    if (resolveStatus === 'AMBIGUOUS' || !resolved) {
      return this.persistResult(event, 'AMBIGUOUS', 'CONFLICTING_SHIFT_ASSIGNMENTS', {
        mappingResolution: processingContext,
      });
    }

    // 2. Fetch Shift Rule
    const shiftRules = await this.prisma.shiftRule.findMany({
      where: { shift_id: resolved.shift.id },
      take: 1,
    });

    if (shiftRules.length === 0) {
      return this.persistResult(event, 'REVIEW_REQUIRED', 'NO_SHIFT_RULE_CONFIGURED', {
        mappingResolution: processingContext,
      });
    }

    const rule = shiftRules[0]!;

    // 3. Fetch previous events for this employee on this exact shift date to check duplicates
    // Start of the day of the shiftDate
    const searchStart = new Date(resolved.shiftDate);
    searchStart.setHours(0, 0, 0, 0);
    // End of the next day (to cover cross midnight)
    const searchEnd = new Date(searchStart);
    searchEnd.setDate(searchEnd.getDate() + 2);

    const previousEvents = await this.prisma.attendanceEvent.findMany({
      where: {
        event_timestamp: {
          gte: searchStart,
          lte: searchEnd,
        },
        id: { not: event.id }, // Exclude the current one
      },
      orderBy: { event_timestamp: 'desc' },
    });

    const previousResolutions = await Promise.all(
      previousEvents.map(async (previousEvent) => ({
        event: previousEvent,
        resolution: await this.mappingResolver.resolve(previousEvent.id),
      })),
    );
    const previousMapped = previousResolutions
      .filter(
        ({ resolution: previousResolution }) =>
          previousResolution.status === 'MAPPED' &&
          previousResolution.employeeId === resolution.employeeId,
      )
      .map(({ event: previousEvent }) => ({
        timestamp: previousEvent.event_timestamp,
        type: previousEvent.event_type,
      }));

    // 4. Evaluate Tolerance
    const evaluation = this.toleranceEvaluator.evaluate(
      event.event_timestamp,
      event.event_type,
      resolved.shiftDate,
      resolved.shift,
      rule,
      previousMapped,
    );

    // 5. Persist Result
    return this.persistResult(event, evaluation.decision, evaluation.reason, {
      shift_id: resolved.shift.id,
      shift_code: resolved.shift.shift_code,
      shift_date: resolved.shiftDate.toISOString().split('T')[0],
      rule_id: rule.id,
      mappingResolution: processingContext,
    });
  }

  private async persistResult(
    event: AttendanceEvent,
    decision: string,
    reason: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    inputData: unknown = {},
  ): Promise<AttendanceRuleResult> {
    // We strictly use an upsert based on attendance_event_id + rule_code
    // to guarantee idempotency and avoid uncontrolled duplicates.
    // Also, we DO NOT mutate AttendanceEvent.status to preserve Canonical Event Immutability.

    // Find if it exists first (we don't have a unique constraint on attendance_event_id + rule_code,
    // so we use findFirst + create/update to be safe)

    const existing = await this.prisma.attendanceRuleResult.findFirst({
      where: {
        attendance_event_id: event.id,
        rule_code: 'CORE_TOLERANCE_V1',
      },
    });

    if (existing) {
      return await this.prisma.attendanceRuleResult.update({
        where: { id: existing.id },
        data: {
          input_data: inputData as Prisma.InputJsonValue,
          decision,
          reason,
        },
      });
    }

    return await this.prisma.attendanceRuleResult.create({
      data: {
        attendance_event_id: event.id,
        rule_code: 'CORE_TOLERANCE_V1',
        input_data: inputData as Prisma.InputJsonValue,
        decision,
        reason,
      },
    });
  }
}
