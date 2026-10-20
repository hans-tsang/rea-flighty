/** UTC ISO-8601 instant, e.g. "2026-03-08T14:05:00.000Z". */
export type IsoInstant = string;

export interface Airport {
  iata: string;
  icao: string | null;
  name: string;
  city: string;
  country: string;
  /** IANA zone, e.g. "America/New_York". All local times are rendered in this zone. */
  timeZone: string;
  latitude: number;
  longitude: number;
}

/**
 * Scheduled / estimated / actual times for one event (e.g. gate departure).
 * `null` means *unknown* — never "on time". Only `actual` is a confirmed fact.
 */
export interface TimeTriple {
  scheduled: IsoInstant;
  estimated: IsoInstant | null;
  actual: IsoInstant | null;
}

export interface FlightEndpoint {
  airport: Airport;
  terminal: string | null;
  gate: string | null;
  /** Gate (block) times: pushback at departure, on-block at arrival. */
  times: TimeTriple;
}

export interface ArrivalEndpoint extends FlightEndpoint {
  baggageClaim: string | null;
}

export interface FlightDesignator {
  /** IATA airline code, e.g. "ZZ". */
  carrierCode: string;
  /** Numeric part without leading zeros, e.g. "123". */
  flightNumber: string;
}

/** Operational state as reported by a data provider (not derived from the clock). */
export type ProviderStatus =
  | 'scheduled'
  | 'active'
  | 'landed'
  | 'arrived'
  | 'cancelled'
  | 'diverted'
  | 'unknown';

export interface DataSource {
  /** Provider identifier, e.g. "mock" or "aeroapi". */
  provider: string;
  /** True for simulated data. The UI must label these flights clearly. */
  isMock: boolean;
  /** When this snapshot was fetched from the provider. Used for freshness labels. */
  fetchedAt: IsoInstant;
}

export interface Flight {
  /**
   * Stable identity for one operation of a flight. Flight numbers are reused
   * every day (and sometimes for several legs a day), so the id must include
   * the origin-local departure date and the origin airport.
   */
  id: string;
  designator: FlightDesignator;
  carrierName: string;
  /** Departure date in the *origin airport's* time zone (`YYYY-MM-DD`). */
  departureLocalDate: string;
  /** Marketing designators sharing this operation. The operating flight is `designator`. */
  codeshares: FlightDesignator[];
  departure: FlightEndpoint;
  arrival: ArrivalEndpoint;
  aircraft: {
    model: string | null;
    registration: string | null;
  };
  providerStatus: ProviderStatus;
  /** If diverted, the airport actually landed at (when known). */
  divertedTo: Airport | null;
  source: DataSource;
}

export interface SavedFlight {
  flight: Flight;
  savedAt: IsoInstant;
}

export function formatDesignator(d: FlightDesignator): string {
  return `${d.carrierCode} ${d.flightNumber}`;
}
