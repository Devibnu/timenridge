export type DateRangeBound = 'start' | 'end';

const JAKARTA_UTC_OFFSET_HOURS = 7;
const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

/** Convert an HTML date input value to an inclusive Asia/Jakarta day boundary. */
export function toBusinessDateBoundary(value: string, bound: DateRangeBound): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) throw new RangeError('Expected a date in YYYY-MM-DD format');

  const [, year, month, day] = match;
  const utcDayStart = Date.UTC(Number(year), Number(month) - 1, Number(day));
  const parsed = new Date(utcDayStart);
  if (
    parsed.getUTCFullYear() !== Number(year) ||
    parsed.getUTCMonth() !== Number(month) - 1 ||
    parsed.getUTCDate() !== Number(day)
  ) {
    throw new RangeError('Expected a valid calendar date');
  }

  const jakartaDayStart = utcDayStart - JAKARTA_UTC_OFFSET_HOURS * 60 * 60 * 1000;
  const boundary = bound === 'start' ? jakartaDayStart : jakartaDayStart + MILLISECONDS_PER_DAY - 1;
  return new Date(boundary).toISOString();
}
