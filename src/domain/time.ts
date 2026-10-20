/**
 * Time-zone helpers built only on the standard `Intl` API so the same code runs
 * in Node (tests), browsers and Hermes.
 *
 * Conventions:
 * - Instants are stored as UTC ISO-8601 strings (`IsoInstant`).
 * - Wall-clock values are always rendered in the *airport's* IANA time zone,
 *   never the device's zone.
 * - A "local date" is a `YYYY-MM-DD` string in a specific time zone.
 */

const MINUTE_MS = 60_000;

const partsFormatterCache = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let fmt = partsFormatterCache.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatterCache.set(timeZone, fmt);
  }
  return fmt;
}

interface WallClock {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

function wallClock(instantMs: number, timeZone: string): WallClock {
  const parts = partsFormatter(timeZone).formatToParts(new Date(instantMs));
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((p) => p.type === type)?.value ?? NaN);
  return {
    year: get('year'),
    month: get('month'),
    day: get('day'),
    // Some engines report midnight as "24" even with h23.
    hour: get('hour') % 24,
    minute: get('minute'),
    second: get('second'),
  };
}

export function isValidTimeZone(timeZone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone });
    return true;
  } catch {
    return false;
  }
}

/** UTC offset (in minutes, east positive) of `timeZone` at the given instant. */
export function timeZoneOffsetMinutes(instant: string | number, timeZone: string): number {
  const ms = typeof instant === 'number' ? instant : Date.parse(instant);
  const wc = wallClock(ms, timeZone);
  const asUtc = Date.UTC(wc.year, wc.month - 1, wc.day, wc.hour, wc.minute, wc.second);
  const truncated = ms - (((ms % 1000) + 1000) % 1000);
  return Math.round((asUtc - truncated) / MINUTE_MS);
}

/**
 * Convert an airport-local wall-clock time into a UTC instant.
 *
 * DST edge cases:
 * - Ambiguous times (clocks fall back, the hour repeats) resolve to the
 *   *earlier* instant.
 * - Non-existent times (clocks spring forward) are shifted forward by the gap,
 *   e.g. 02:30 on a spring-forward night in New York becomes 03:30 EDT.
 */
export function zonedTimeToUtc(localDate: string, localTime: string, timeZone: string): string {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(localDate);
  const timeMatch = /^(\d{2}):(\d{2})$/.exec(localTime);
  if (!dateMatch || !timeMatch) {
    throw new Error(`Invalid local date/time: ${localDate} ${localTime}`);
  }
  const naiveUtc = Date.UTC(
    Number(dateMatch[1]),
    Number(dateMatch[2]) - 1,
    Number(dateMatch[3]),
    Number(timeMatch[1]),
    Number(timeMatch[2]),
  );
  // Try the offsets in effect around the target; prefer the earliest valid match.
  const offsetBefore = timeZoneOffsetMinutes(naiveUtc - 24 * 60 * MINUTE_MS, timeZone);
  const offsetAfter = timeZoneOffsetMinutes(naiveUtc + 24 * 60 * MINUTE_MS, timeZone);
  const candidates = [offsetBefore, offsetAfter, timeZoneOffsetMinutes(naiveUtc, timeZone)]
    .map((offset) => naiveUtc - offset * MINUTE_MS)
    .sort((a, b) => a - b);
  for (const candidate of candidates) {
    if (timeZoneOffsetMinutes(candidate, timeZone) * MINUTE_MS === naiveUtc - candidate) {
      return new Date(candidate).toISOString();
    }
  }
  // Non-existent local time (spring-forward gap): use the pre-transition offset,
  // which lands the same distance past the transition.
  return new Date(naiveUtc - offsetBefore * MINUTE_MS).toISOString();
}

/** `YYYY-MM-DD` calendar date of an instant in a time zone. */
export function localDateOf(instant: string, timeZone: string): string {
  const wc = wallClock(Date.parse(instant), timeZone);
  return `${wc.year}-${pad(wc.month)}-${pad(wc.day)}`;
}

/**
 * Calendar-day difference between the arrival's local date and the departure's
 * local date: +1 for typical overnight flights, -1 when crossing the date line
 * eastbound (e.g. SYD → LAX), 0 for same-day.
 */
export function dayOffset(
  departure: string,
  departureZone: string,
  arrival: string,
  arrivalZone: string,
): number {
  const d = Date.parse(`${localDateOf(departure, departureZone)}T00:00:00Z`);
  const a = Date.parse(`${localDateOf(arrival, arrivalZone)}T00:00:00Z`);
  return Math.round((a - d) / (24 * 60 * MINUTE_MS));
}

export function formatLocalTime(instant: string, timeZone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(instant));
}

export function formatLocalDate(instant: string, timeZone: string, locale?: string): string {
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  }).format(new Date(instant));
}

/** e.g. "UTC+5:30", "UTC−8", "UTC". */
export function formatUtcOffset(instant: string, timeZone: string): string {
  const offset = timeZoneOffsetMinutes(instant, timeZone);
  if (offset === 0) return 'UTC';
  const sign = offset > 0 ? '+' : '−';
  const abs = Math.abs(offset);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `UTC${sign}${hours}${minutes ? `:${pad(minutes)}` : ''}`;
}

export function minutesBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / MINUTE_MS);
}

export function formatDuration(totalMinutes: number): string {
  const sign = totalMinutes < 0 ? '-' : '';
  const abs = Math.abs(Math.round(totalMinutes));
  const h = Math.floor(abs / 60);
  const m = abs % 60;
  if (h === 0) return `${sign}${m}m`;
  return `${sign}${h}h ${pad(m)}m`;
}

/** Human-friendly "x min ago" for data-freshness labels. */
export function formatAge(fromIso: string, nowMs: number): string {
  const minutes = Math.max(0, Math.floor((nowMs - Date.parse(fromIso)) / MINUTE_MS));
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.floor(hours / 24)} days ago`;
}

/** Adds whole days to a `YYYY-MM-DD` string (pure calendar arithmetic). */
export function addDays(localDate: string, days: number): string {
  const ms = Date.parse(`${localDate}T00:00:00Z`) + days * 24 * 60 * MINUTE_MS;
  return new Date(ms).toISOString().slice(0, 10);
}

export function isValidLocalDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const ms = Date.parse(`${value}T00:00:00Z`);
  return !Number.isNaN(ms) && new Date(ms).toISOString().slice(0, 10) === value;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
