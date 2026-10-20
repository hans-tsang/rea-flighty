import { AIRPORTS } from './airports';
import { FlightDataError, normalizeQuery, type FlightDataProvider, type FlightSearchQuery } from './provider';
import type { Airport, Flight, FlightDesignator, ProviderStatus } from '../domain/types';
import { addDays, localDateOf, zonedTimeToUtc } from '../domain/time';

/**
 * MOCK flight data provider.
 *
 * Everything returned here is SIMULATED. Flights are generated
 * deterministically from (airline, number, date) so the same search always
 * yields the same route and schedule; the "live" progression (estimates, gates,
 * actual times) is computed from the device clock so the UI can exercise every
 * state without a paid API. None of this reflects any real airline operation.
 *
 * Special flight numbers (any airline) to exercise UI states:
 * - 404 → no results
 * - 999 → simulated network error
 * - 500 → two legs sharing one flight number (LHR→DXB, DXB→SIN)
 */

interface RouteTemplate {
  from: string;
  to: string;
  /** Scheduled local departure time at origin, HH:mm. */
  depart: string;
  blockMinutes: number;
  aircraft: string;
}

const ROUTES: RouteTemplate[] = [
  { from: 'JFK', to: 'LHR', depart: '19:30', blockMinutes: 415, aircraft: 'Boeing 777-300ER' },
  { from: 'SFO', to: 'SYD', depart: '22:45', blockMinutes: 900, aircraft: 'Boeing 787-9' },
  { from: 'SYD', to: 'LAX', depart: '11:00', blockMinutes: 805, aircraft: 'Airbus A380-800' },
  { from: 'LHR', to: 'DXB', depart: '14:00', blockMinutes: 400, aircraft: 'Airbus A350-1000' },
  { from: 'DEL', to: 'SIN', depart: '23:30', blockMinutes: 330, aircraft: 'Airbus A321neo' },
  { from: 'HKG', to: 'NRT', depart: '08:15', blockMinutes: 255, aircraft: 'Airbus A330-300' },
  { from: 'ORD', to: 'LAX', depart: '07:00', blockMinutes: 275, aircraft: 'Boeing 737 MAX 8' },
  { from: 'CDG', to: 'JFK', depart: '10:30', blockMinutes: 500, aircraft: 'Boeing 787-10' },
  { from: 'AKL', to: 'SFO', depart: '19:45', blockMinutes: 695, aircraft: 'Boeing 787-9' },
];

const MULTI_LEG: RouteTemplate[] = [
  { from: 'LHR', to: 'DXB', depart: '14:00', blockMinutes: 400, aircraft: 'Airbus A380-800' },
  { from: 'DXB', to: 'SIN', depart: '02:10', blockMinutes: 435, aircraft: 'Airbus A380-800' },
];

type Scenario = 'normal' | 'delayed' | 'cancelled' | 'no_gate' | 'diverted';

const MOCK_CARRIERS: Record<string, string> = {
  ZZ: 'Mockingbird Air',
  ZY: 'Paper Plane Airways',
};

export interface MockProviderOptions {
  /** Simulated network latency in ms (default 400). */
  latencyMs?: number;
  now?: () => number;
}

export class MockFlightProvider implements FlightDataProvider {
  readonly id = 'mock';
  readonly isMock = true;
  private readonly latencyMs: number;
  private readonly now: () => number;

  constructor(options: MockProviderOptions = {}) {
    this.latencyMs = options.latencyMs ?? 400;
    this.now = options.now ?? Date.now;
  }

  async searchFlights(query: FlightSearchQuery, signal?: AbortSignal): Promise<Flight[]> {
    const q = normalizeQuery(query);
    await this.simulateLatency(signal);
    if (q.flightNumber === '999') {
      throw new FlightDataError('network', 'Simulated network error (mock flight 999).');
    }
    if (q.flightNumber === '404') return [];
    return this.legsFor(q).map((leg, i) => this.generate(q, leg, i));
  }

  async getFlight(id: string, signal?: AbortSignal): Promise<Flight> {
    const parsed = parseMockId(id);
    if (!parsed) throw new FlightDataError('not_found', `Unknown mock flight id: ${id}`);
    const q = normalizeQuery(parsed.query);
    await this.simulateLatency(signal);
    const legs = this.legsFor(q);
    const index = legs.findIndex((l) => l.from === parsed.origin);
    if (index < 0) throw new FlightDataError('not_found', `Unknown mock flight id: ${id}`);
    return this.generate(q, legs[index], index);
  }

  private legsFor(q: FlightSearchQuery): RouteTemplate[] {
    if (q.flightNumber === '500') return MULTI_LEG;
    return [ROUTES[hash(`${q.carrierCode}${q.flightNumber}`) % ROUTES.length]];
  }

  private generate(q: FlightSearchQuery, route: RouteTemplate, legIndex: number): Flight {
    const nowMs = this.now();
    const seed = hash(`${q.carrierCode}${q.flightNumber}|${q.departureLocalDate}|${legIndex}`);
    const scenario = pickScenario(seed);
    const origin = AIRPORTS[route.from];
    const destination = AIRPORTS[route.to];

    // Second leg of a multi-leg flight departs the following local day.
    const legDate = legIndex === 0 ? q.departureLocalDate : addDays(q.departureLocalDate, 1);
    const schedDep = zonedTimeToUtc(legDate, route.depart, origin.timeZone);
    const schedArr = addMinutes(schedDep, route.blockMinutes);

    const depDelay = scenario === 'delayed' ? 25 + (seed % 95) : (seed % 11) - 5;
    const arrDelay = depDelay - (seed % 9);
    const estDep = addMinutes(schedDep, depDelay);
    const estArr = addMinutes(schedArr, arrDelay);

    const dayMs = 24 * 3_600_000;
    const within = (iso: string, beforeMs: number) => nowMs >= Date.parse(iso) - beforeMs;
    const estimatesPublished = scenario !== 'cancelled' && within(schedDep, dayMs);
    const departed = scenario !== 'cancelled' && within(estDep, 0);
    const diverted = scenario === 'diverted' && departed && nowMs >= (Date.parse(estDep) + Date.parse(estArr)) / 2;
    const arrived = departed && !diverted && within(estArr, 0);

    let providerStatus: ProviderStatus = 'scheduled';
    if (scenario === 'cancelled') providerStatus = 'cancelled';
    else if (diverted) providerStatus = 'diverted';
    else if (arrived) providerStatus = 'arrived';
    else if (departed) providerStatus = 'active';

    const gatesKnown = scenario !== 'no_gate' && scenario !== 'cancelled' && within(estDep, 3 * 3_600_000);
    const arrivalGateKnown = scenario !== 'no_gate' && departed && !diverted;
    const baggageKnown = scenario !== 'no_gate' && arrived;
    const letters = 'ABCDEFG';

    const designator: FlightDesignator = { carrierCode: q.carrierCode, flightNumber: q.flightNumber };
    const shareCode = q.carrierCode === 'ZZ' ? 'ZY' : 'ZZ';
    const codeshares: FlightDesignator[] =
      seed % 3 === 0 ? [{ carrierCode: shareCode, flightNumber: String(1000 + (seed % 8000)) }] : [];

    return {
      id: mockId(q, route.from),
      designator,
      carrierName: MOCK_CARRIERS[q.carrierCode] ?? `${q.carrierCode} (simulated carrier)`,
      departureLocalDate: localDateOf(schedDep, origin.timeZone),
      codeshares,
      departure: {
        airport: origin,
        terminal: scenario === 'no_gate' ? null : String(1 + (seed % 5)),
        gate: gatesKnown ? `${letters[seed % letters.length]}${1 + (seed % 40)}` : null,
        times: {
          scheduled: schedDep,
          estimated: estimatesPublished ? estDep : null,
          actual: departed ? estDep : null,
        },
      },
      arrival: {
        airport: destination,
        terminal: scenario === 'no_gate' ? null : String(1 + ((seed >> 3) % 4)),
        gate: arrivalGateKnown ? `${letters[(seed >> 2) % letters.length]}${1 + ((seed >> 4) % 50)}` : null,
        baggageClaim: baggageKnown ? String(1 + ((seed >> 5) % 12)) : null,
        times: {
          scheduled: schedArr,
          estimated: estimatesPublished && !diverted ? estArr : null,
          actual: arrived ? estArr : null,
        },
      },
      aircraft: {
        model: route.aircraft,
        registration: estimatesPublished ? `N${100 + (seed % 900)}MK` : null,
      },
      providerStatus,
      divertedTo: diverted ? pickDiversion(route, seed) : null,
      source: { provider: this.id, isMock: true, fetchedAt: new Date(nowMs).toISOString() },
    };
  }

  private simulateLatency(signal?: AbortSignal): Promise<void> {
    if (this.latencyMs <= 0) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const timer = setTimeout(resolve, this.latencyMs);
      signal?.addEventListener('abort', () => {
        clearTimeout(timer);
        reject(new FlightDataError('network', 'Request cancelled.'));
      });
    });
  }
}

export function mockId(q: FlightSearchQuery, origin: string): string {
  return `mock:${q.carrierCode}-${q.flightNumber}-${q.departureLocalDate}-${origin}`;
}

export function parseMockId(id: string): { query: FlightSearchQuery; origin: string } | null {
  const m = /^mock:([A-Z0-9]{2})-(\d{1,4})-(\d{4}-\d{2}-\d{2})-([A-Z]{3})$/.exec(id);
  if (!m) return null;
  return { query: { carrierCode: m[1], flightNumber: m[2], departureLocalDate: m[3] }, origin: m[4] };
}

function pickScenario(seed: number): Scenario {
  const r = seed % 100;
  if (r < 50) return 'normal';
  if (r < 75) return 'delayed';
  if (r < 83) return 'cancelled';
  if (r < 95) return 'no_gate';
  return 'diverted';
}

function pickDiversion(route: RouteTemplate, seed: number): Airport {
  const candidates = Object.keys(AIRPORTS).filter((c) => c !== route.from && c !== route.to);
  return AIRPORTS[candidates[seed % candidates.length]];
}

function addMinutes(iso: string, minutes: number): string {
  return new Date(Date.parse(iso) + minutes * 60_000).toISOString();
}

/** FNV-1a 32-bit — deterministic, non-cryptographic. */
function hash(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
