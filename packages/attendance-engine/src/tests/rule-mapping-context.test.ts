import { describe, expect, it, vi } from 'vitest';
import { AttendanceRuleEngine } from '../rules/AttendanceRuleEngine';
import { ShiftResolver } from '../rules/ShiftResolver';
import { ToleranceEvaluator } from '../rules/ToleranceEvaluator';

const event = {
  id: 'event-1',
  employee_id: null,
  sap_employee_id: null,
  event_type: 'IN',
  event_timestamp: new Date('2026-09-23T08:00:00.000Z'),
};

const context = {
  attendanceEventId: 'event-1',
  status: 'MAPPED' as const,
  employeeId: 'employee-42',
  sapEmployeeId: 'sap-42',
  mappingId: 'mapping-7',
};

describe('P16.7.4 rule mapping context', () => {
  it('passes mapped internal identity to rules and persists full resolution context', async () => {
    const prisma = {
      attendanceEvent: {
        findUnique: vi.fn().mockResolvedValue(event),
        findMany: vi.fn().mockResolvedValue([]),
      },
      attendanceRuleResult: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => ({ id: 'result-1', ...data })),
      },
      shiftRule: { findMany: vi.fn().mockResolvedValue([{ id: 'shift-rule-1' }]) },
    };
    const shiftResolver = vi.spyOn(ShiftResolver.prototype, 'resolve').mockResolvedValue({
      status: 'SUCCESS',
      resolved: {
        shiftDate: new Date('2026-09-23T00:00:00.000Z'),
        assignment: {} as never,
        shift: { id: 'shift-1' } as never,
      },
    });
    vi.spyOn(ToleranceEvaluator.prototype, 'evaluate').mockReturnValue({
      decision: 'VALID_IN',
      reason: 'Within tolerance',
    } as never);

    try {
      const engine = new AttendanceRuleEngine(prisma as never);
      await engine.evaluateEvent('event-1', context);

      expect(shiftResolver).toHaveBeenCalledWith('employee-42', event.event_timestamp);
      expect(prisma.attendanceEvent.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.not.objectContaining({ employee_id: 'employee-42' }),
        }),
      );
      expect(prisma.attendanceRuleResult.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            input_data: expect.objectContaining({ mappingResolution: context }),
          }),
        }),
      );
      expect(event.employee_id).toBeNull();
      expect(event.sap_employee_id).toBeNull();
    } finally {
      shiftResolver.mockRestore();
      vi.restoreAllMocks();
    }
  });

  it.each([
    { status: 'UNMAPPED' as const, decision: 'REVIEW_REQUIRED' },
    { status: 'AMBIGUOUS' as const, decision: 'AMBIGUOUS' },
  ])('$status stays unresolved in the persisted rule result', async ({ status, decision }) => {
    const unresolved = {
      attendanceEventId: 'event-1',
      status,
      reason: `${status} resolution`,
    };
    const prisma = {
      attendanceEvent: { findUnique: vi.fn().mockResolvedValue(event) },
      attendanceRuleResult: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockImplementation(({ data }) => ({ id: 'result-1', ...data })),
      },
    };
    const engine = new AttendanceRuleEngine(prisma as never);

    const result = await engine.evaluateEvent('event-1', unresolved);

    expect(result?.decision).toBe(decision);
    expect(prisma.attendanceRuleResult.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          input_data: expect.objectContaining({ mappingResolution: unresolved }),
        }),
      }),
    );
    expect(event.employee_id).toBeNull();
    expect(event.sap_employee_id).toBeNull();
  });
});
