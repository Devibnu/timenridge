import { describe, expect, it } from 'vitest';
import { toBusinessDateBoundary } from '../src/utils/businessDate';

describe('toBusinessDateBoundary', () => {
  it('includes the entire selected Asia/Jakarta business date', () => {
    expect(toBusinessDateBoundary('2026-09-23', 'start')).toBe('2026-09-22T17:00:00.000Z');
    expect(toBusinessDateBoundary('2026-09-23', 'end')).toBe('2026-09-23T16:59:59.999Z');
  });

  it('creates adjacent inclusive boundaries for a multi-day date range', () => {
    const from = toBusinessDateBoundary('2026-09-23', 'start');
    const through = toBusinessDateBoundary('2026-09-25', 'end');

    expect(new Date(from).getTime()).toBeLessThan(new Date(through).getTime());
    expect(through).toBe('2026-09-25T16:59:59.999Z');
  });

  it('rejects invalid date input rather than emitting an invalid API boundary', () => {
    expect(() => toBusinessDateBoundary('2026-02-30', 'end')).toThrow(RangeError);
  });
});
