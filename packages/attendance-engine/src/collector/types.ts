export interface CollectionResult {
  deviceId: string;
  status: 'SUCCESS' | 'PARTIAL' | 'ERROR';
  eventsReceived: number;
  eventsInserted: number;
  eventsSkipped: number;
  error?: string;
  durationMs: number;
}
