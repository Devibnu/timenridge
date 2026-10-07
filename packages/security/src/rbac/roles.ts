import { UserRole } from '@timebridge/database';
import { Permissions, PermissionType } from './permissions';

const ROLE_PERMISSIONS: Record<UserRole, PermissionType[]> = {
  [UserRole.SUPER_ADMIN]: Object.values(Permissions),
  [UserRole.INTEGRATION_ADMIN]: [
    Permissions.USERS_READ,
    Permissions.DEVICES_READ,
    Permissions.DEVICES_CREATE,
    Permissions.DEVICES_UPDATE,
    Permissions.DEVICES_DELETE,
    Permissions.EMPLOYEES_READ,
    Permissions.EMPLOYEES_CREATE,
    Permissions.EMPLOYEES_UPDATE,
    Permissions.ATTENDANCE_READ,
    Permissions.ATTENDANCE_PROCESS,
    Permissions.ATTENDANCE_RETRY,
    Permissions.INTEGRATION_READ,
    Permissions.INTEGRATION_PROCESS,
    Permissions.INTEGRATION_RETRY,
    Permissions.AUDIT_READ,
  ],
  [UserRole.OPERATOR]: [
    Permissions.USERS_READ,
    Permissions.DEVICES_READ,
    Permissions.EMPLOYEES_READ,
    Permissions.ATTENDANCE_READ,
    Permissions.ATTENDANCE_PROCESS,
    Permissions.ATTENDANCE_RETRY,
    Permissions.INTEGRATION_READ,
    Permissions.INTEGRATION_RETRY,
    Permissions.AUDIT_READ,
  ],
  [UserRole.AUDITOR]: [
    Permissions.USERS_READ,
    Permissions.DEVICES_READ,
    Permissions.EMPLOYEES_READ,
    Permissions.ATTENDANCE_READ,
    Permissions.INTEGRATION_READ,
    Permissions.AUDIT_READ,
  ],
};

/**
 * Checks if a role has the required permission.
 */
export function hasPermission(role: UserRole, permission: PermissionType): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions ? permissions.includes(permission) : false;
}
