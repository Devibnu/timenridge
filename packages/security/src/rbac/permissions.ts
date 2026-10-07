export const Permissions = {
  // Users
  USERS_READ: 'users.read',
  USERS_CREATE: 'users.create',
  USERS_UPDATE: 'users.update',
  USERS_DISABLE: 'users.disable',

  // Devices
  DEVICES_READ: 'devices.read',
  DEVICES_CREATE: 'devices.create',
  DEVICES_UPDATE: 'devices.update',
  DEVICES_DELETE: 'devices.delete',

  // Employees
  EMPLOYEES_READ: 'employees.read',
  EMPLOYEES_CREATE: 'employees.create',
  EMPLOYEES_UPDATE: 'employees.update',

  // Attendance
  ATTENDANCE_READ: 'attendance.read',
  ATTENDANCE_PROCESS: 'attendance.process',
  ATTENDANCE_RETRY: 'attendance.retry',

  // Integration
  INTEGRATION_READ: 'integration.read',
  INTEGRATION_PROCESS: 'integration.process',
  INTEGRATION_RETRY: 'integration.retry',

  // Audit
  AUDIT_READ: 'audit.read',
} as const;

export type PermissionType = (typeof Permissions)[keyof typeof Permissions];
