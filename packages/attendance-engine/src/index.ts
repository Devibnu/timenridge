export const name = '@timebridge/attendance-engine';

export * from './collector/types';
export * from './collector/RawAttendanceCollector';

export * from './normalizer/AttendanceNormalizer';

export * from './mapping/EmployeeMappingResolver';
export * from './mapping/EmployeeMappingManager';

export * from './rules/ToleranceEvaluator';
export * from './rules/ShiftResolver';
export * from './rules/AttendanceRuleEngine';
export * from './reconciliation';
