import {
  addDays,
  dayOffset,
  formatDuration,
  formatUtcOffset,
  isValidLocalDate,
  localDateOf,
  timeZoneOffsetMinutes,
  zonedTimeToUtc,
} from '../domain/time';

describe('zonedTimeToUtc', () => {
  it('converts standard and daylight time correctly', () => {
    expect(zonedTimeToUtc('2026-01-15', '09:00', 'America/New_York')).toBe('2026-01-15T14:00:00.000Z');
    expect(zonedTimeToUtc('2026-07-15', '09:00', 'America/New_York')).toBe('2026-07-15T13:00:00.000Z');
  });

  it('handles half-hour and southern-hemisphere zones', () => {
    expect(zonedTimeToUtc('2026-07-01', '23:30', 'Asia/Kolkata')).toBe('2026-07-01T18:00:00.000Z');
    // Sydney is UTC+11 in January (DST) and UTC+10 in July.
    expect(zonedTimeToUtc('2026-01-10', '11:00', 'Australia/Sydney')).toBe('2026-01-10T00:00:00.000Z');
    expect(zonedTimeToUtc('2026-07-10', '11:00', 'Australia/Sydney')).toBe('2026-07-10T01:00:00.000Z');
  });

  it('shifts non-existent spring-forward times past the gap', () => {
    // US DST starts 2026-03-08 at 02:00 local; 02:30 does not exist.
    expect(zonedTimeToUtc('2026-03-08', '02:30', 'America/New_York')).toBe('2026-03-08T07:30:00.000Z');
    expect(localDateOf('2026-03-08T07:30:00.000Z', 'America/New_York')).toBe('2026-03-08');
  });

  it('resolves ambiguous fall-back times to the earlier instant', () => {
    // US DST ends 2026-11-01 at 02:00 local; 01:30 happens twice (EDT then EST).
    expect(zonedTimeToUtc('2026-11-01', '01:30', 'America/New_York')).toBe('2026-11-01T05:30:00.000Z');
  });

  it('rejects malformed input', () => {
    expect(() => zonedTimeToUtc('2026/01/01', '09:00', 'UTC')).toThrow();
  });
});

describe('offsets and labels', () => {
  it('reports offsets across DST transitions', () => {
    expect(timeZoneOffsetMinutes('2026-03-08T06:59:00Z', 'America/New_York')).toBe(-300);
    expect(timeZoneOffsetMinutes('2026-03-08T07:00:00Z', 'America/New_York')).toBe(-240);
    expect(formatUtcOffset('2026-07-01T00:00:00Z', 'Asia/Kolkata')).toBe('UTC+5:30');
    expect(formatUtcOffset('2026-01-01T00:00:00Z', 'Europe/London')).toBe('UTC');
    expect(formatUtcOffset('2026-01-01T00:00:00Z', 'America/Los_Angeles')).toBe('UTC−8');
  });
});

describe('dayOffset', () => {
  it('is +1 for overnight transatlantic flights', () => {
    const dep = zonedTimeToUtc('2026-05-01', '19:30', 'America/New_York');
    const arr = new Date(Date.parse(dep) + 415 * 60_000).toISOString();
    expect(localDateOf(arr, 'Europe/London')).toBe('2026-05-02');
    expect(dayOffset(dep, 'America/New_York', arr, 'Europe/London')).toBe(1);
  });

  it('is +2 when crossing the date line westbound overnight (SFO → SYD)', () => {
    const dep = zonedTimeToUtc('2026-05-01', '22:45', 'America/Los_Angeles');
    const arr = new Date(Date.parse(dep) + 900 * 60_000).toISOString();
    expect(dayOffset(dep, 'America/Los_Angeles', arr, 'Australia/Sydney')).toBe(2);
  });

  it('can be -1 when crossing the date line eastbound (AKL → SFO, arrive "before" departing)', () => {
    const dep = zonedTimeToUtc('2026-05-01', '19:45', 'Pacific/Auckland');
    const arr = new Date(Date.parse(dep) + 695 * 60_000).toISOString();
    expect(dayOffset(dep, 'Pacific/Auckland', arr, 'America/Los_Angeles')).toBe(0);
    const lateDep = zonedTimeToUtc('2026-05-01', '07:00', 'Pacific/Auckland');
    const lateArr = new Date(Date.parse(lateDep) + 695 * 60_000).toISOString();
    expect(dayOffset(lateDep, 'Pacific/Auckland', lateArr, 'America/Los_Angeles')).toBe(-1);
  });
});

describe('calendar helpers', () => {
  it('adds days across month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2028-03-01', -1)).toBe('2028-02-29');
  });

  it('validates dates', () => {
    expect(isValidLocalDate('2026-02-29')).toBe(false);
    expect(isValidLocalDate('2028-02-29')).toBe(true);
    expect(isValidLocalDate('26-1-1')).toBe(false);
  });

  it('formats durations', () => {
    expect(formatDuration(415)).toBe('6h 55m');
    expect(formatDuration(45)).toBe('45m');
    expect(formatDuration(-20)).toBe('-20m');
  });
});
