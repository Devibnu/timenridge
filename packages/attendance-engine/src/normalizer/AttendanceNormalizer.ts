/* eslint-disable @typescript-eslint/no-explicit-any */
import { prisma, EventType, EventStatus, AttendanceRawEvent } from '@timebridge/database';
import { formatInTimeZone } from 'date-fns-tz';
import * as crypto from 'crypto';

export interface NormalizationResult {
  raw_event_id: string;
  event_uid?: string;
  status: EventStatus;
  reason?: string;
  normalized_event_id?: string;
}

export class AttendanceNormalizer {
  private static readonly TIMEZONE = 'Asia/Jakarta';

  /**
   * Normalizes pending (unprocessed) raw attendance events.
   */
  public async normalizePending(): Promise<NormalizationResult[]> {
    // Determine which events are not yet in `attendance_events` based on `source_hash`.
    // For large scale, we should batch. But for now, we find raw events that don't have matching `AttendanceEvent`.

    // Using a simpler approach: get all raw events where their combination of (device_id, source_hash)
    // does not exist as `event_uid` in `AttendanceEvent`. Wait, event_uid = hash(device_id, source_hash).

    // Instead of complex queries, let's just accept raw event IDs or fetch a fixed batch of recent raw events
    // and attempt to insert. If it fails on unique constraint, we mark as duplicate.

    const pendingRaw = await prisma.attendanceRawEvent.findMany({
      take: 1000,
      orderBy: { created_at: 'asc' },
    });

    const results: NormalizationResult[] = [];

    for (const raw of pendingRaw) {
      const result = await this.normalizeSingle(raw);
      results.push(result);
    }

    return results;
  }

  /**
   * Normalizes a batch of raw events by ID.
   */
  public async normalizeBatch(rawEventIds: string[]): Promise<NormalizationResult[]> {
    const rawEvents = await prisma.attendanceRawEvent.findMany({
      where: { id: { in: rawEventIds } },
    });

    const results: NormalizationResult[] = [];

    for (const raw of rawEvents) {
      const result = await this.normalizeSingle(raw);
      results.push(result);
    }

    return results;
  }

  /**
   * Validates and normalizes a single raw event.
   */
  public async normalizeSingle(raw: AttendanceRawEvent): Promise<NormalizationResult> {
    try {
      // 1. Structural Validation
      if (!raw.device_id) {
        return {
          raw_event_id: raw.id,
          status: EventStatus.REVIEW_REQUIRED,
          reason: 'MISSING_DEVICE_ID',
        };
      }

      if (!raw.device_employee_id || raw.device_employee_id.trim() === '') {
        return {
          raw_event_id: raw.id,
          status: EventStatus.REVIEW_REQUIRED,
          reason: 'MISSING_DEVICE_EMPLOYEE_ID',
        };
      }

      if (!raw.event_timestamp || isNaN(new Date(raw.event_timestamp).getTime())) {
        return {
          raw_event_id: raw.id,
          status: EventStatus.REVIEW_REQUIRED,
          reason: 'INVALID_TIMESTAMP',
        };
      }

      // 2. Identity Generation
      // event_uid must be deterministic. We use device_id and source_hash.
      const eventUid = this.generateEventUid(raw.device_id, raw.source_hash);

      // Check if already normalized
      const existing = await prisma.attendanceEvent.findUnique({
        where: { event_uid: eventUid },
      });

      if (existing) {
        return {
          raw_event_id: raw.id,
          event_uid: eventUid,
          status: EventStatus.DUPLICATE,
          reason: 'ALREADY_NORMALIZED',
          normalized_event_id: existing.id,
        };
      }

      // 3. Timezone Normalization
      // We assume event_timestamp stored in DB is correct UTC time of the event.
      // E.g., 2026-09-23T00:30:00Z -> Asia/Jakarta is 2026-09-23 07:30:00
      const jsDate = new Date(raw.event_timestamp);

      // event_date (YYYY-MM-DD)
      const eventDateStr = formatInTimeZone(jsDate, AttendanceNormalizer.TIMEZONE, 'yyyy-MM-dd');
      const eventDate = new Date(`${eventDateStr}T00:00:00Z`); // stored as UTC Date type in Prisma

      // event_time (HH:mm:ss)
      const eventTimeStr = formatInTimeZone(jsDate, AttendanceNormalizer.TIMEZONE, 'HH:mm:ss');

      // 4. Event Type
      // Retain event_type if specified in raw payload, otherwise UNKNOWN
      let eventType: EventType = EventType.UNKNOWN;
      const payload: unknown = raw.raw_payload || {};

      if (
        (payload as Record<string, unknown>).event_type &&
        Object.values(EventType).includes(
          (payload as Record<string, unknown>).event_type as EventType,
        )
      ) {
        eventType = (payload as Record<string, unknown>).event_type as EventType;
      }

      // 5. Create Canonical Event
      const canonical = await prisma.attendanceEvent.create({
        data: {
          event_uid: eventUid,
          device_id: raw.device_id,
          device_employee_id: raw.device_employee_id,
          employee_id: null, // Left as null for P7
          sap_employee_id: null, // Left as null for P7
          event_date: eventDate,
          event_time: eventTimeStr,
          event_timestamp: jsDate,
          event_type: eventType,
          source: 'ATTENDANCE_DEVICE',
          status: EventStatus.RECEIVED,
        },
      });

      return {
        raw_event_id: raw.id,
        event_uid: eventUid,
        status: EventStatus.RECEIVED,
        normalized_event_id: canonical.id,
      };
    } catch (err: any) {
      if (err.code === 'P2002') {
        // Unique constraint violation (race condition)
        return {
          raw_event_id: raw.id,
          status: EventStatus.DUPLICATE,
          reason: 'ALREADY_NORMALIZED',
        };
      }

      // Unknown error
      return {
        raw_event_id: raw.id,
        status: EventStatus.FAILED,
        reason: err.message || 'UNKNOWN_ERROR',
      };
    }
  }

  private generateEventUid(deviceId: string, sourceHash: string): string {
    const data = `${deviceId}:${sourceHash}`;
    return crypto.createHash('sha256').update(data).digest('hex');
  }
}
