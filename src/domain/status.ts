import type { Flight, IsoInstant, TimeTriple } from './types';
import { minutesBetween } from './time';

/** Minutes past schedule before we call a flight "delayed" (industry convention: 15). */
export const DELAY_THRESHOLD_MINUTES = 15;

export type TimeKind = 'actual' | 'estimated' | 'scheduled';

export interface BestTime {
  time: IsoInstant;
  kind: TimeKind;
}

/** The most authoritative time available: actual > estimated > scheduled. */
export function bestTime(t: TimeTriple): BestTime {
  if (t.actual) return { time: t.actual, kind: 'actual' };
  if (t.estimated) return { time: t.estimated, kind: 'estimated' };
  return { time: t.scheduled, kind: 'scheduled' };
}

/** Delay vs schedule using actual or estimated time; `null` when only the schedule is known. */
export function delayMinutes(t: TimeTriple): number | null {
  const ref = t.actual ?? t.estimated;
  if (!ref) return null;
  return minutesBetween(t.scheduled, ref);
}

export type DisplayStatus =
  | 'scheduled'
  | 'on_time'
  | 'delayed'
  | 'departed'
  | 'landed'
  | 'arrived'
  | 'cancelled'
  | 'diverted'
  /** The scheduled time has passed but the provider has not confirmed movement. */
  | 'unconfirmed';

export interface StatusSummary {
  status: DisplayStatus;
  label: string;
  /** Departure delay (if departure not complete) or arrival delay, in minutes. */
  delay: number | null;
}

export function deriveStatus(flight: Flight, nowMs: number): StatusSummary {
  const dep = flight.departure.times;
  const arr = flight.arrival.times;

  if (flight.providerStatus === 'cancelled') {
    return { status: 'cancelled', label: 'Cancelled', delay: null };
  }
  if (flight.providerStatus === 'diverted') {
    const to = flight.divertedTo ? ` to ${flight.divertedTo.iata}` : '';
    return { status: 'diverted', label: `Diverted${to}`, delay: null };
  }

  if (arr.actual) {
    const delay = delayMinutes(arr);
    return { status: 'arrived', label: delayLabel('Arrived', delay), delay };
  }
  if (flight.providerStatus === 'landed' || flight.providerStatus === 'arrived') {
    const delay = delayMinutes(arr);
    return { status: 'landed', label: 'Landed', delay };
  }
  if (dep.actual) {
    const delay = delayMinutes(arr) ?? delayMinutes(dep);
    return { status: 'departed', label: delayLabel('Departed', delayMinutes(dep)), delay };
  }

  const depDelay = delayMinutes(dep);
  const expectedDeparture = Date.parse(bestTime(dep).time);
  if (nowMs > expectedDeparture + DELAY_THRESHOLD_MINUTES * 60_000) {
    // We will not guess that the aircraft left: only confirmed data says so.
    return { status: 'unconfirmed', label: 'Departure not confirmed', delay: depDelay };
  }
  if (depDelay !== null && depDelay >= DELAY_THRESHOLD_MINUTES) {
    return { status: 'delayed', label: `Delayed ${depDelay} min`, delay: depDelay };
  }
  if (depDelay !== null) {
    return { status: 'on_time', label: 'On time', delay: depDelay };
  }
  // Only the schedule is known; don't claim "on time".
  return { status: 'scheduled', label: 'Scheduled', delay: null };
}

function delayLabel(prefix: string, delay: number | null): string {
  if (delay === null) return prefix;
  if (delay >= DELAY_THRESHOLD_MINUTES) return `${prefix} ${delay} min late`;
  if (delay <= -DELAY_THRESHOLD_MINUTES) return `${prefix} ${-delay} min early`;
  return `${prefix} on time`;
}

/** A flight stays "upcoming" until it has arrived (or its arrival time has passed). */
export function isUpcoming(flight: Flight, nowMs: number): boolean {
  if (flight.providerStatus === 'cancelled') {
    return Date.parse(flight.departure.times.scheduled) > nowMs;
  }
  if (flight.arrival.times.actual) return false;
  return Date.parse(bestTime(flight.arrival.times).time) > nowMs;
}

/**
 * Splits flights into upcoming (soonest first) and past (most recent first).
 */
export function partitionFlights<T extends { flight: Flight }>(
  items: T[],
  nowMs: number,
): { upcoming: T[]; past: T[] } {
  const depMs = (x: T) => Date.parse(x.flight.departure.times.scheduled);
  const upcoming = items.filter((x) => isUpcoming(x.flight, nowMs)).sort((a, b) => depMs(a) - depMs(b));
  const past = items.filter((x) => !isUpcoming(x.flight, nowMs)).sort((a, b) => depMs(b) - depMs(a));
  return { upcoming, past };
}

/** Fraction (0..1) of the flight completed, or null when not airborne/known. */
export function flightProgress(flight: Flight, nowMs: number): number | null {
  const s = deriveStatus(flight, nowMs).status;
  if (s === 'arrived' || s === 'landed') return 1;
  if (s !== 'departed') return null;
  const start = Date.parse(flight.departure.times.actual!);
  const end = Date.parse(bestTime(flight.arrival.times).time);
  if (end <= start) return null;
  return Math.min(1, Math.max(0, (nowMs - start) / (end - start)));
}

export type TimelineState = 'done' | 'current' | 'upcoming' | 'skipped';

export interface TimelineEvent {
  key: string;
  title: string;
  /** Null if the event has no time (e.g. baggage). */
  time: BestTime | null;
  /** Which airport's time zone to render `time` in. */
  zone: 'departure' | 'arrival';
  detail: string | null;
  state: TimelineState;
}

export function buildTimeline(flight: Flight, nowMs: number): TimelineEvent[] {
  const { status } = deriveStatus(flight, nowMs);
  const dep = flight.departure;
  const arr = flight.arrival;
  const cancelled = status === 'cancelled';
  const departed = Boolean(dep.times.actual) || status === 'landed' || status === 'arrived';
  const arrived = Boolean(arr.times.actual) || status === 'arrived';

  const gateText = (terminal: string | null, gate: string | null) => {
    const parts = [terminal ? `Terminal ${terminal}` : null, gate ? `Gate ${gate}` : null].filter(Boolean);
    return parts.length ? parts.join(' · ') : 'Terminal/gate not yet known';
  };

  const events: TimelineEvent[] = [
    {
      key: 'depart',
      title: 'Departure from gate',
      time: bestTime(dep.times),
      zone: 'departure',
      detail: gateText(dep.terminal, dep.gate),
      state: cancelled ? 'skipped' : departed ? 'done' : 'current',
    },
    {
      key: 'airborne',
      title: status === 'diverted' ? 'Diverted' : 'In flight',
      time: null,
      zone: 'departure',
      detail: status === 'diverted' && flight.divertedTo ? `Landed at ${flight.divertedTo.iata}` : null,
      state: cancelled ? 'skipped' : arrived || status === 'landed' ? 'done' : departed ? 'current' : 'upcoming',
    },
    {
      key: 'arrive',
      title: 'Arrival at gate',
      time: bestTime(arr.times),
      zone: 'arrival',
      detail: gateText(arr.terminal, arr.gate),
      state: cancelled || status === 'diverted' ? 'skipped' : arrived ? 'done' : status === 'landed' ? 'current' : 'upcoming',
    },
    {
      key: 'baggage',
      title: 'Baggage claim',
      time: null,
      zone: 'arrival',
      detail: arr.baggageClaim ? `Belt ${arr.baggageClaim}` : 'Belt not yet assigned',
      state: cancelled || status === 'diverted' ? 'skipped' : arrived ? 'current' : 'upcoming',
    },
  ];
  return events;
}
