import { MockFlightProvider } from './mockProvider';
import type { FlightDataProvider } from './provider';

/**
 * Selects the flight data provider. Only the mock provider exists in this
 * milestone. A future `backend` provider will call our own API at
 * EXPO_PUBLIC_API_BASE_URL (never a third-party provider directly — provider
 * secrets must stay server-side).
 */
export function createFlightDataProvider(): FlightDataProvider {
  const requested = process.env.EXPO_PUBLIC_FLIGHT_DATA_PROVIDER ?? 'mock';
  if (requested !== 'mock') {
    console.warn(`Flight data provider "${requested}" is not implemented yet; using mock data.`);
  }
  return new MockFlightProvider();
}
