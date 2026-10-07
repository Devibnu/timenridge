import { PrismaClient } from '@prisma/client';
import { prisma as defaultPrisma } from '@timebridge/database';

export type MappingResolutionStatus = 'MAPPED' | 'UNMAPPED' | 'AMBIGUOUS';

export interface MappingResolution {
  status: MappingResolutionStatus;
  employeeId?: string;
  sapEmployeeId?: string;
  mappingId?: string;
  reason?: string;
}

/** Runtime processing identity associated with one immutable canonical event. */
export interface AttendanceProcessingContext extends MappingResolution {
  attendanceEventId: string;
}

export class EmployeeMappingResolver {
  constructor(private readonly prisma: PrismaClient = defaultPrisma) {}

  /**
   * Resolves an employee mapping at the canonical event timestamp.
   * This method is read-only: event and mapping records are never changed.
   */
  async resolve(eventId: string): Promise<MappingResolution> {
    const event = await this.prisma.attendanceEvent.findUnique({ where: { id: eventId } });
    if (!event) throw new Error(`Canonical event not found: ${eventId}`);

    const mappings = await this.prisma.employeeMapping.findMany({
      where: {
        device_id: event.device_id,
        device_employee_id: event.device_employee_id,
        is_active: true,
        valid_from: { lte: event.event_timestamp },
        OR: [{ valid_to: null }, { valid_to: { gt: event.event_timestamp } }],
      },
      select: {
        id: true,
        employee_id: true,
        sap_employee_id: true,
      },
    });

    if (mappings.length === 0) {
      return {
        status: 'UNMAPPED',
        reason: 'No active employee mapping found for the event timestamp.',
      };
    }

    if (mappings.length > 1) {
      return {
        status: 'AMBIGUOUS',
        reason: 'Multiple active employee mappings match the event timestamp.',
      };
    }

    const mapping = mappings[0]!;
    return {
      status: 'MAPPED',
      employeeId: mapping.employee_id,
      sapEmployeeId: mapping.sap_employee_id ?? undefined,
      mappingId: mapping.id,
    };
  }
}
