export function getQueueNames(): string[] {
  // Known queues in the system
  return [
    'attendance-normalization',
    'employee-mapping',
    'business-rule-engine',
    'sap-batch',
    'test-queue', // Used for infrastructure verification
  ];
}
