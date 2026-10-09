export * from './client';
export * from './repositories';

export const UserRole = { SUPER_ADMIN: "SUPER_ADMIN", INTEGRATION_ADMIN: "INTEGRATION_ADMIN", OPERATOR: "OPERATOR", AUDITOR: "AUDITOR" } as const;
export type UserRole = keyof typeof UserRole;

export const UserStatus = { ACTIVE: "ACTIVE", DISABLED: "DISABLED" } as const;
export type UserStatus = keyof typeof UserStatus;

export const AuditAction = { LOGIN_SUCCESS: "LOGIN_SUCCESS", LOGIN_FAILED: "LOGIN_FAILED", LOGOUT: "LOGOUT", ACCOUNT_DISABLED: "ACCOUNT_DISABLED", ROLE_CHANGED: "ROLE_CHANGED", PASSWORD_CHANGED: "PASSWORD_CHANGED" } as const;
export type AuditAction = keyof typeof AuditAction;

export const DeviceStatus = { ONLINE: "ONLINE", DEGRADED: "DEGRADED", OFFLINE: "OFFLINE", UNKNOWN: "UNKNOWN" } as const;
export type DeviceStatus = keyof typeof DeviceStatus;

export const DeviceLifecycleStatus = { REGISTERED: "REGISTERED", ACTIVE: "ACTIVE", DISABLED: "DISABLED" } as const;
export type DeviceLifecycleStatus = keyof typeof DeviceLifecycleStatus;

export const EventType = { IN: "IN", OUT: "OUT", BREAK_IN: "BREAK_IN", BREAK_OUT: "BREAK_OUT", UNKNOWN: "UNKNOWN" } as const;
export type EventType = keyof typeof EventType;

export const EventStatus = { RECEIVED: "RECEIVED", VALIDATED: "VALIDATED", MAPPED: "MAPPED", READY: "READY", PROCESSING: "PROCESSING", SENT: "SENT", PROCESSED: "PROCESSED", DUPLICATE: "DUPLICATE", FAILED: "FAILED", SAP_REJECTED: "SAP_REJECTED", REVIEW_REQUIRED: "REVIEW_REQUIRED" } as const;
export type EventStatus = keyof typeof EventStatus;

export const CycleStatus = { OPEN: "OPEN", COMPLETE: "COMPLETE", MISSING_IN: "MISSING_IN", MISSING_OUT: "MISSING_OUT", AMBIGUOUS: "AMBIGUOUS", REVIEW_REQUIRED: "REVIEW_REQUIRED", READY_FOR_SAP: "READY_FOR_SAP", SENT_TO_SAP: "SENT_TO_SAP" } as const;
export type CycleStatus = keyof typeof CycleStatus;

export const BatchStatus = { CREATED: "CREATED", READY: "READY", GENERATED: "GENERATED", UPLOADED: "UPLOADED", ACKNOWLEDGED: "ACKNOWLEDGED", PROCESSED: "PROCESSED", PARTIALLY_PROCESSED: "PARTIALLY_PROCESSED", FAILED: "FAILED", SAP_REJECTED: "SAP_REJECTED" } as const;
export type BatchStatus = keyof typeof BatchStatus;

export const FileStatus = { GENERATED: "GENERATED", UPLOADED: "UPLOADED", ACKNOWLEDGED: "ACKNOWLEDGED", PROCESSED: "PROCESSED", FAILED: "FAILED" } as const;
export type FileStatus = keyof typeof FileStatus;

export const BatchRecordStatus = { VALID: "VALID", INVALID_MISSING_SAP_EMPLOYEE: "INVALID_MISSING_SAP_EMPLOYEE", INVALID_MISSING_CHECK_IN: "INVALID_MISSING_CHECK_IN", INVALID_MISSING_CHECK_OUT: "INVALID_MISSING_CHECK_OUT", INVALID_STATUS: "INVALID_STATUS", INVALID_DATE: "INVALID_DATE", INVALID_TRACEABILITY: "INVALID_TRACEABILITY" } as const;
export type BatchRecordStatus = keyof typeof BatchRecordStatus;

export {
  AttendanceRawEvent,
  AttendanceEvent,
  Shift,
  ShiftRule,
  EmployeeShiftAssignment,
  AttendanceRuleResult,
  PrismaClient,
  AttendanceCycle,
  AttendanceBatch
} from '@prisma/client';
