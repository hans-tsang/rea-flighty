import type { Flight } from '../domain/types';

export interface FlightSearchQuery {
  /** IATA airline code, e.g. "ZZ". */
  carrierCode: string;
  /** Numeric flight number, e.g. "123". */
  flightNumber: string;
  /** Departure date in the origin airport's local time zone (`YYYY-MM-DD`). */
  departureLocalDate: string;
}

export type FlightDataErrorCode =
  | 'invalid_query'
  | 'not_found'
  | 'network'
  | 'rate_limited'
  | 'unauthorized'
  | 'provider_error';

export class FlightDataError extends Error {
  constructor(
    public readonly code: FlightDataErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'FlightDataError';
  }
}

/**
 * Provider-independent flight data interface used by the app.
 *
 * Real implementations should live behind *our own* backend so provider
 * credentials never ship in the app binary. The app talks to the backend; the
 * backend talks to AeroAPI / Cirium / etc. See docs/DATA_PROVIDERS.md.
 */
export interface FlightDataProvider {
  readonly id: string;
  readonly isMock: boolean;
  /**
   * Find operations matching a designator on a local departure date. May return
   * several results (multi-leg flights share a number) or none.
   */
  searchFlights(query: FlightSearchQuery, signal?: AbortSignal): Promise<Flight[]>;
  /** Fetch a fresh snapshot of one operation by id. */
  getFlight(id: string, signal?: AbortSignal): Promise<Flight>;
}

export function normalizeQuery(query: FlightSearchQuery): FlightSearchQuery {
  const carrierCode = query.carrierCode.trim().toUpperCase();
  const flightNumber = query.flightNumber.trim().replace(/^0+(?=\d)/, '');
  if (!/^[A-Z0-9]{2}$/.test(carrierCode)) {
    throw new FlightDataError('invalid_query', 'Airline code must be 2 letters or digits (IATA), e.g. "ZZ".');
  }
  if (!/^\d{1,4}$/.test(flightNumber)) {
    throw new FlightDataError('invalid_query', 'Flight number must be 1–4 digits.');
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(query.departureLocalDate)) {
    throw new FlightDataError('invalid_query', 'Date must be in YYYY-MM-DD format.');
  }
  return { carrierCode, flightNumber, departureLocalDate: query.departureLocalDate };
}
