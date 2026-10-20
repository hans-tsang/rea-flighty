import { MockFlightProvider, parseMockId } from '../data/mockProvider';
import { FlightRepository, MemoryStore, STORAGE_KEY } from '../storage/flightRepository';

const NOW = Date.parse('2026-05-01T00:00:00Z');

async function sampleFlight(number = '123', date = '2026-05-03') {
  const provider = new MockFlightProvider({ latencyMs: 0, now: () => NOW });
  const [flight] = await provider.searchFlights({ carrierCode: 'zz', flightNumber: number, departureLocalDate: date });
  return flight;
}

describe('FlightRepository', () => {
  it('returns an empty list when nothing is stored', async () => {
    const repo = new FlightRepository(new MemoryStore());
    expect(await repo.load()).toEqual({ flights: [], recoveredFromCorruption: false });
  });

  it('persists flights across repository instances (simulated app restart)', async () => {
    const store = new MemoryStore();
    const flight = await sampleFlight();
    await new FlightRepository(store, () => NOW).upsert(flight);

    const reloaded = await new FlightRepository(store).load();
    expect(reloaded.flights).toHaveLength(1);
    expect(reloaded.flights[0].flight).toEqual(flight);
    expect(reloaded.flights[0].savedAt).toBe(new Date(NOW).toISOString());
  });

  it('upserts by id and preserves the original savedAt', async () => {
    const store = new MemoryStore();
    let clock = NOW;
    const repo = new FlightRepository(store, () => clock);
    const flight = await sampleFlight();
    await repo.upsert(flight);
    clock += 60_000;
    const updated = { ...flight, arrival: { ...flight.arrival, gate: 'Z9' } };
    const list = await repo.upsert(updated);
    expect(list).toHaveLength(1);
    expect(list[0].flight.arrival.gate).toBe('Z9');
    expect(list[0].savedAt).toBe(new Date(NOW).toISOString());
  });

  it('keeps the same flight number on different dates as separate flights', async () => {
    const repo = new FlightRepository(new MemoryStore());
    await repo.upsert(await sampleFlight('123', '2026-05-03'));
    const list = await repo.upsert(await sampleFlight('123', '2026-05-04'));
    expect(list.map((f) => f.flight.id)).toEqual([
      'mock:ZZ-123-2026-05-03-' + list[0].flight.departure.airport.iata,
      'mock:ZZ-123-2026-05-04-' + list[1].flight.departure.airport.iata,
    ]);
  });

  it('serializes concurrent writes without losing updates', async () => {
    const repo = new FlightRepository(new MemoryStore());
    const flights = await Promise.all(['1', '2', '3', '4'].map((n) => sampleFlight(n)));
    await Promise.all(flights.map((f) => repo.upsert(f)));
    expect((await repo.load()).flights).toHaveLength(4);
  });

  it('does not resurrect a removed flight when a refresh lands late', async () => {
    const repo = new FlightRepository(new MemoryStore());
    const flight = await sampleFlight();
    await repo.upsert(flight);
    await repo.remove(flight.id);
    expect(await repo.updateIfPresent(flight)).toEqual([]);
  });

  it('removes flights', async () => {
    const repo = new FlightRepository(new MemoryStore());
    const flight = await sampleFlight();
    await repo.upsert(flight);
    expect(await repo.remove(flight.id)).toEqual([]);
  });

  it('recovers from corrupt data and keeps a backup copy', async () => {
    const store = new MemoryStore();
    await store.setItem(STORAGE_KEY, '{not json');
    const result = await new FlightRepository(store, () => NOW).load();
    expect(result).toEqual({ flights: [], recoveredFromCorruption: true });
    expect(store.data.get(`${STORAGE_KEY}.corrupt-${NOW}`)).toBe('{not json');
    expect(store.data.has(STORAGE_KEY)).toBe(false);
  });

  it('drops malformed entries but keeps valid ones', async () => {
    const store = new MemoryStore();
    const flight = await sampleFlight();
    await store.setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, flights: [{ savedAt: 'x', flight }, { savedAt: 'x', flight: { id: 'broken' } }] }),
    );
    expect((await new FlightRepository(store).load()).flights).toHaveLength(1);
  });
});

describe('MockFlightProvider', () => {
  const provider = (now = NOW) => new MockFlightProvider({ latencyMs: 0, now: () => now });

  it('is deterministic and clearly marked as mock', async () => {
    const a = await provider().searchFlights({ carrierCode: 'ZZ', flightNumber: '42', departureLocalDate: '2026-05-03' });
    const b = await provider().searchFlights({ carrierCode: 'ZZ', flightNumber: '42', departureLocalDate: '2026-05-03' });
    expect(a).toEqual(b);
    expect(a[0].source).toMatchObject({ provider: 'mock', isMock: true });
  });

  it('uses the departure-airport local date and round-trips ids', async () => {
    const [f] = await provider().searchFlights({ carrierCode: 'ZZ', flightNumber: '7', departureLocalDate: '2026-05-03' });
    expect(f.departureLocalDate).toBe('2026-05-03');
    expect(parseMockId(f.id)?.origin).toBe(f.departure.airport.iata);
    expect(await provider().getFlight(f.id)).toEqual(f);
  });

  it('only reports actual times once they are in the past', async () => {
    const [future] = await provider().searchFlights({ carrierCode: 'ZZ', flightNumber: '7', departureLocalDate: '2026-06-01' });
    expect(future.departure.times.estimated).toBeNull();
    expect(future.departure.times.actual).toBeNull();
    expect(future.departure.gate).toBeNull();
  });

  it('exposes error, empty and multi-leg scenarios', async () => {
    const q = { carrierCode: 'ZZ', departureLocalDate: '2026-05-03' };
    await expect(provider().searchFlights({ ...q, flightNumber: '999' })).rejects.toMatchObject({ code: 'network' });
    expect(await provider().searchFlights({ ...q, flightNumber: '404' })).toEqual([]);
    const legs = await provider().searchFlights({ ...q, flightNumber: '500' });
    expect(legs.map((l) => `${l.departure.airport.iata}-${l.arrival.airport.iata}`)).toEqual(['LHR-DXB', 'DXB-SIN']);
    expect(new Set(legs.map((l) => l.id)).size).toBe(2);
  });

  it('validates input', async () => {
    await expect(
      provider().searchFlights({ carrierCode: 'TOOLONG', flightNumber: '1', departureLocalDate: '2026-05-03' }),
    ).rejects.toMatchObject({ code: 'invalid_query' });
  });
});
