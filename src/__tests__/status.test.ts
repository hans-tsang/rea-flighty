import { AIRPORTS } from '../data/airports';
import { buildTimeline, deriveStatus, flightProgress, isUpcoming, partitionFlights } from '../domain/status';
import type { Flight } from '../domain/types';

const DEP = '2026-05-01T12:00:00.000Z';
const ARR = '2026-05-01T18:00:00.000Z';
const min = (iso: string, m: number) => new Date(Date.parse(iso) + m * 60_000).toISOString();
const at = (iso: string, m = 0) => Date.parse(iso) + m * 60_000;

function makeFlight(overrides: Partial<Flight> = {}, times: Partial<{
  depEst: string | null; depAct: string | null; arrEst: string | null; arrAct: string | null;
}> = {}): Flight {
  return {
    id: 'test:ZZ-1-2026-05-01-JFK',
    designator: { carrierCode: 'ZZ', flightNumber: '1' },
    carrierName: 'Test',
    departureLocalDate: '2026-05-01',
    codeshares: [],
    departure: {
      airport: AIRPORTS.JFK,
      terminal: '4',
      gate: null,
      times: { scheduled: DEP, estimated: times.depEst ?? null, actual: times.depAct ?? null },
    },
    arrival: {
      airport: AIRPORTS.LHR,
      terminal: '5',
      gate: null,
      baggageClaim: null,
      times: { scheduled: ARR, estimated: times.arrEst ?? null, actual: times.arrAct ?? null },
    },
    aircraft: { model: null, registration: null },
    providerStatus: 'scheduled',
    divertedTo: null,
    source: { provider: 'test', isMock: true, fetchedAt: DEP },
    ...overrides,
  };
}

describe('deriveStatus', () => {
  it('says "Scheduled" (not "On time") when only the schedule is known', () => {
    expect(deriveStatus(makeFlight(), at(DEP, -600)).status).toBe('scheduled');
  });

  it('is on time with a small estimated delay', () => {
    const s = deriveStatus(makeFlight({}, { depEst: min(DEP, 10) }), at(DEP, -60));
    expect(s.status).toBe('on_time');
    expect(s.delay).toBe(10);
  });

  it('is delayed at or beyond the 15 minute threshold', () => {
    const s = deriveStatus(makeFlight({}, { depEst: min(DEP, 45) }), at(DEP, -60));
    expect(s).toEqual({ status: 'delayed', label: 'Delayed 45 min', delay: 45 });
  });

  it('does not invent a departure when time passes without confirmation', () => {
    expect(deriveStatus(makeFlight(), at(DEP, 30)).status).toBe('unconfirmed');
  });

  it('is departed once an actual departure time exists', () => {
    const f = makeFlight({ providerStatus: 'active' }, { depAct: min(DEP, 20), arrEst: min(ARR, 10) });
    const s = deriveStatus(f, at(DEP, 60));
    expect(s.status).toBe('departed');
    expect(s.label).toBe('Departed 20 min late');
  });

  it('is arrived with an actual arrival time, and reports early arrivals', () => {
    const f = makeFlight({ providerStatus: 'arrived' }, { depAct: DEP, arrAct: min(ARR, -20) });
    expect(deriveStatus(f, at(ARR, 60)).label).toBe('Arrived 20 min early');
  });

  it('prioritises cancellation and diversion from the provider', () => {
    expect(deriveStatus(makeFlight({ providerStatus: 'cancelled' }), at(DEP, -60)).status).toBe('cancelled');
    const diverted = makeFlight({ providerStatus: 'diverted', divertedTo: AIRPORTS.CDG }, { depAct: DEP });
    expect(deriveStatus(diverted, at(DEP, 200)).label).toBe('Diverted to CDG');
  });
});

describe('upcoming / past', () => {
  it('keeps in-flight flights upcoming until arrival', () => {
    const f = makeFlight({}, { depAct: DEP, arrEst: ARR });
    expect(isUpcoming(f, at(DEP, 60))).toBe(true);
    expect(isUpcoming(makeFlight({}, { depAct: DEP, arrAct: ARR }), at(DEP, 60))).toBe(false);
  });

  it('sorts upcoming soonest-first and past most-recent-first', () => {
    const mk = (id: string, dep: string) => ({
      flight: { ...makeFlight(), id, departure: { ...makeFlight().departure, times: { scheduled: dep, estimated: null, actual: null } }, arrival: { ...makeFlight().arrival, times: { scheduled: min(dep, 300), estimated: null, actual: null } } },
    });
    const now = at(DEP);
    const items = [mk('past-old', min(DEP, -5000)), mk('soon', min(DEP, 60)), mk('later', min(DEP, 3000)), mk('past-recent', min(DEP, -1000))];
    const { upcoming, past } = partitionFlights(items, now);
    expect(upcoming.map((x) => x.flight.id)).toEqual(['soon', 'later']);
    expect(past.map((x) => x.flight.id)).toEqual(['past-recent', 'past-old']);
  });
});

describe('timeline and progress', () => {
  it('marks steps done/current/upcoming in order', () => {
    const f = makeFlight({ providerStatus: 'active' }, { depAct: DEP, arrEst: ARR });
    const states = buildTimeline(f, at(DEP, 60)).map((e) => [e.key, e.state]);
    expect(states).toEqual([
      ['depart', 'done'],
      ['airborne', 'current'],
      ['arrive', 'upcoming'],
      ['baggage', 'upcoming'],
    ]);
  });

  it('marks everything skipped when cancelled', () => {
    const states = buildTimeline(makeFlight({ providerStatus: 'cancelled' }), at(DEP)).map((e) => e.state);
    expect(new Set(states)).toEqual(new Set(['skipped']));
  });

  it('labels unknown baggage explicitly', () => {
    const baggage = buildTimeline(makeFlight(), at(DEP, -60)).find((e) => e.key === 'baggage');
    expect(baggage?.detail).toBe('Belt not yet assigned');
  });

  it('computes in-flight progress only after confirmed departure', () => {
    expect(flightProgress(makeFlight(), at(DEP, 60))).toBeNull();
    const f = makeFlight({}, { depAct: DEP, arrEst: ARR });
    expect(flightProgress(f, at(DEP, 180))).toBeCloseTo(0.5);
  });
});
