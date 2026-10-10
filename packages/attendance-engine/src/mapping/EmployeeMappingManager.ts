import {} from '@prisma/client';
/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma } from '@timebridge/database';

export interface CreateMappingInput {
  device_id: string;
  device_employee_id: string;
  employee_id: string;
  sap_employee_id?: string;
  valid_from: Date;
  valid_to?: Date;
  actor: string;
}

export interface UpdateMappingInput {
  mapping_id: string;
  sap_employee_id?: string;
  valid_from?: Date;
  valid_to?: Date | null; // Pass null to explicitly remove valid_to
  actor: string;
}

function mappingRangesOverlap(
  left: { valid_from: Date; valid_to: Date | null },
  right: { valid_from: Date; valid_to: Date | null },
): boolean {
  const leftStart = left.valid_from.getTime();
  const rightStart = right.valid_from.getTime();
  const leftEnd = left.valid_to?.getTime() ?? Number.POSITIVE_INFINITY;
  const rightEnd = right.valid_to?.getTime() ?? Number.POSITIVE_INFINITY;

  // Match P7's PostgreSQL [from, to) range: empty and touching ranges do not overlap.
  return leftStart < rightEnd && rightStart < leftEnd;
}

export class EmployeeMappingManager {
  /**
   * Creates a new employee mapping.
   * Mirrors P7's per-device temporal exclusion rule, with the DB constraint as the final barrier.
   */
  async createMapping(input: CreateMappingInput) {
    const {
      device_id,
      device_employee_id,
      employee_id,
      sap_employee_id,
      valid_from,
      valid_to,
      actor,
    } = input;

    // Check device exists
    const device = await prisma.device.findUnique({ where: { id: device_id } });
    if (!device) throw new Error('Device not found');

    // Check employee exists
    const employee = await prisma.employee.findUnique({ where: { id: employee_id } });
    if (!employee) throw new Error('Employee not found');

    if (valid_to && valid_from > valid_to) {
      throw new Error('valid_from cannot be after valid_to');
    }

    // Application-level overlap check (for graceful error throwing before constraint breach)
    const candidates = await prisma.employeeMapping.findMany({
      where: {
        device_id,
        ...(valid_to ? { valid_from: { lt: valid_to } } : {}),
        OR: [{ valid_to: null }, { valid_to: { gt: valid_from } }],
      },
      select: { valid_from: true, valid_to: true },
    });
    const overlaps = candidates.filter((candidate: any) =>
      mappingRangesOverlap({ valid_from, valid_to: valid_to ?? null }, candidate),
    );

    if (overlaps.length > 0) {
      throw new Error('Overlapping mapping found for this device validity period');
    }

    const mapping = await prisma.employeeMapping.create({
      data: {
        device_id,
        device_employee_id,
        employee_id,
        sap_employee_id: sap_employee_id || null,
        valid_from,
        valid_to: valid_to || null,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user: actor,
        action: 'EMPLOYEE_MAPPING_CREATED',
        target: 'employee_mappings',
        after: mapping,
      },
    });

    return mapping;
  }

  /**
   * Updates an existing mapping (validity periods, sap id).
   */
  async updateMapping(input: UpdateMappingInput) {
    const { mapping_id, actor, valid_from, valid_to, sap_employee_id } = input;

    const existing = await prisma.employeeMapping.findUnique({ where: { id: mapping_id } });
    if (!existing) throw new Error('Mapping not found');
    if (!existing.is_active) throw new Error('Cannot update inactive mapping');

    const newValidFrom = valid_from ?? existing.valid_from;
    const newValidTo = valid_to !== undefined ? valid_to : existing.valid_to;

    if (newValidTo && newValidFrom > newValidTo) {
      throw new Error('valid_from cannot be after valid_to');
    }

    const candidates = await prisma.employeeMapping.findMany({
      where: {
        id: { not: mapping_id }, // Ignore self
        device_id: existing.device_id,
        ...(newValidTo ? { valid_from: { lt: newValidTo } } : {}),
        OR: [{ valid_to: null }, { valid_to: { gt: newValidFrom } }],
      },
      select: { valid_from: true, valid_to: true },
    });
    const overlaps = candidates.filter((candidate: any) =>
      mappingRangesOverlap({ valid_from: newValidFrom, valid_to: newValidTo }, candidate),
    );

    if (overlaps.length > 0) {
      throw new Error('Update results in overlapping mapping for this device validity period');
    }

    const updated = await prisma.employeeMapping.update({
      where: { id: mapping_id },
      data: {
        valid_from: newValidFrom,
        valid_to: newValidTo,
        sap_employee_id: sap_employee_id !== undefined ? sap_employee_id : existing.sap_employee_id,
      },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user: actor,
        action: 'EMPLOYEE_MAPPING_UPDATED',
        target: 'employee_mappings',
        before: existing,
        after: updated,
      },
    });

    return updated;
  }

  /**
   * Deactivates a mapping (soft delete, retains history but invalidates it from resolving future requests).
   */
  async deactivateMapping(mapping_id: string, actor: string) {
    const existing = await prisma.employeeMapping.findUnique({ where: { id: mapping_id } });
    if (!existing) throw new Error('Mapping not found');

    const updated = await prisma.employeeMapping.update({
      where: { id: mapping_id },
      data: { is_active: false },
    });

    // Audit log
    await prisma.auditLog.create({
      data: {
        user: actor,
        action: 'EMPLOYEE_MAPPING_DEACTIVATED',
        target: 'employee_mappings',
        before: existing,
        after: updated,
      },
    });

    return updated;
  }
}
