import { prisma } from '../client';
import { Prisma } from '@prisma/client';

export class DeviceRepository {
  async findById(id: string) {
    return prisma.device.findUnique({ where: { id } });
  }
}

export class EmployeeRepository {
  async findByInternalId(internal_id: string) {
    return prisma.employee.findUnique({ where: { internal_id } });
  }
}

export class AttendanceRawEventRepository {
  async create(data: {
    device_id: string;
    device_employee_id: string;
    event_timestamp: Date;
    raw_payload: unknown;
    source_hash: string;
  }) {
    return prisma.attendanceRawEvent.create({
      data: {
        ...data,
        raw_payload: data.raw_payload as Prisma.InputJsonValue,
      },
    });
  }
}
