import { PrismaClient, Shift } from '@prisma/client';
import { EmployeeShiftAssignment } from '@timebridge/database';

export type ResolvedShift = {
  shiftDate: Date;
  assignment: EmployeeShiftAssignment;
  shift: Shift;
};

export class ShiftResolver {
  private prisma: PrismaClient;

  constructor(prismaClient?: PrismaClient) {
    this.prisma = prismaClient || new PrismaClient();
  }

  /**
   * Resolves the correct shift based on employee assignments and the event timestamp.
   * Handles cross-midnight by inspecting overlap windows.
   */
  public async resolve(
    employeeId: string,
    eventTimestamp: Date,
  ): Promise<{
    resolved: ResolvedShift | null;
    status: 'SUCCESS' | 'AMBIGUOUS' | 'NO_ASSIGNMENT' | 'UNMAPPED';
  }> {
    // First, find all active assignments covering this exact timestamp
    const activeAssignments = await this.prisma.employeeShiftAssignment.findMany({
      where: {
        employee_id: employeeId,
        effective_from: { lte: eventTimestamp },
        OR: [{ effective_to: null }, { effective_to: { gte: eventTimestamp } }],
      },
      include: {
        shift: true,
      },
    });

    if (activeAssignments.length === 0) {
      return { resolved: null, status: 'NO_ASSIGNMENT' };
    }

    // Now we must determine which shift fits this timestamp best.
    // It could belong to today's shift, or yesterday's cross-midnight shift.
    const candidates: ResolvedShift[] = [];

    for (const assignment of activeAssignments) {
      const shift = assignment.shift;

      // Candidate 1: The shift corresponding to the physical day of the timestamp
      const date1 = new Date(eventTimestamp);
      date1.setUTCHours(0, 0, 0, 0);
      candidates.push({ shiftDate: date1, assignment, shift });

      // Candidate 2: The shift corresponding to the physical day BEFORE the timestamp (for cross-midnight)
      if (shift.crosses_midnight) {
        const date2 = new Date(date1);
        date2.setUTCDate(date2.getUTCDate() - 1);
        candidates.push({ shiftDate: date2, assignment, shift });
      }
    }

    // Evaluate candidates by proximity to shift boundaries to find the best match.
    // In a real strict environment, there are rigid cutoff bounds.
    // We will find all candidates where the eventTimestamp falls within [start - 12h, end + 12h]
    // or simply finding the candidate with the closest center point.

    let bestCandidate: ResolvedShift | null = null;
    let minDistance = Infinity;
    let validCandidatesCount = 0;

    for (const candidate of candidates) {
      const { start, end } = this.getShiftAbsoluteBounds(candidate.shiftDate, candidate.shift);

      // Expand bound by e.g., +/- 14 hours max logic threshold, but we'll use a dynamic midpoint logic.
      // Typically, an event belongs to a shift if it is closer to this shift's bounds than another's.
      // Let's compute distance to shift center.
      const centerTime = start.getTime() + (end.getTime() - start.getTime()) / 2;
      const distance = Math.abs(eventTimestamp.getTime() - centerTime);

      // If it's within a reasonable window (e.g. 14 hours from center)
      if (distance < 14 * 60 * 60 * 1000) {
        validCandidatesCount++;
        if (distance < minDistance) {
          minDistance = distance;
          bestCandidate = candidate;
        }
      }
    }

    if (validCandidatesCount === 0) {
      return { resolved: null, status: 'NO_ASSIGNMENT' };
    }

    // If there is more than one assignment and the bounds overlap perfectly, it's ambiguous.
    // But since we just pick the absolute closest shift center, we'll check if the difference
    // to the next best is too small (meaning multiple active shifts overlap the exact same timeframe).
    if (activeAssignments.length > 1 && validCandidatesCount > 1) {
      // A strict implementation would verify if multiple assignments actually have the exact same boundaries.
      // We'll mark it AMBIGUOUS if there are multiple active shift assignments for the same day.
      const uniqueShifts = new Set(candidates.map((c) => c.shift.id));
      if (uniqueShifts.size > 1) {
        return { resolved: null, status: 'AMBIGUOUS' };
      }
    }

    return { resolved: bestCandidate, status: 'SUCCESS' };
  }

  private getShiftAbsoluteBounds(shiftDate: Date, shift: Shift): { start: Date; end: Date } {
    const startParts = shift.start_time.split(':').map(Number);
    const endParts = shift.end_time.split(':').map(Number);

    const start = new Date(shiftDate);
    start.setUTCHours(startParts[0]!, startParts[1]!, 0, 0);

    const end = new Date(shiftDate);
    end.setUTCHours(endParts[0]!, endParts[1]!, 0, 0);

    if (shift.crosses_midnight) {
      end.setUTCDate(end.getUTCDate() + 1);
    }

    return { start, end };
  }
}
