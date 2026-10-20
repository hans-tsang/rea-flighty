import type { Airport } from '../domain/types';

/**
 * Small static airport table used by the mock provider. Codes, coordinates and
 * IANA time zones are public reference facts. A real provider returns airport
 * details with each flight.
 */
export const AIRPORTS: Record<string, Airport> = {
  JFK: { iata: 'JFK', icao: 'KJFK', name: 'John F. Kennedy Intl', city: 'New York', country: 'US', timeZone: 'America/New_York', latitude: 40.6413, longitude: -73.7781 },
  LAX: { iata: 'LAX', icao: 'KLAX', name: 'Los Angeles Intl', city: 'Los Angeles', country: 'US', timeZone: 'America/Los_Angeles', latitude: 33.9416, longitude: -118.4085 },
  SFO: { iata: 'SFO', icao: 'KSFO', name: 'San Francisco Intl', city: 'San Francisco', country: 'US', timeZone: 'America/Los_Angeles', latitude: 37.6213, longitude: -122.379 },
  ORD: { iata: 'ORD', icao: 'KORD', name: "O'Hare Intl", city: 'Chicago', country: 'US', timeZone: 'America/Chicago', latitude: 41.9742, longitude: -87.9073 },
  LHR: { iata: 'LHR', icao: 'EGLL', name: 'Heathrow', city: 'London', country: 'GB', timeZone: 'Europe/London', latitude: 51.47, longitude: -0.4543 },
  CDG: { iata: 'CDG', icao: 'LFPG', name: 'Charles de Gaulle', city: 'Paris', country: 'FR', timeZone: 'Europe/Paris', latitude: 49.0097, longitude: 2.5479 },
  DXB: { iata: 'DXB', icao: 'OMDB', name: 'Dubai Intl', city: 'Dubai', country: 'AE', timeZone: 'Asia/Dubai', latitude: 25.2532, longitude: 55.3657 },
  DEL: { iata: 'DEL', icao: 'VIDP', name: 'Indira Gandhi Intl', city: 'Delhi', country: 'IN', timeZone: 'Asia/Kolkata', latitude: 28.5562, longitude: 77.1 },
  SIN: { iata: 'SIN', icao: 'WSSS', name: 'Changi', city: 'Singapore', country: 'SG', timeZone: 'Asia/Singapore', latitude: 1.3644, longitude: 103.9915 },
  HKG: { iata: 'HKG', icao: 'VHHH', name: 'Hong Kong Intl', city: 'Hong Kong', country: 'HK', timeZone: 'Asia/Hong_Kong', latitude: 22.308, longitude: 113.9185 },
  NRT: { iata: 'NRT', icao: 'RJAA', name: 'Narita Intl', city: 'Tokyo', country: 'JP', timeZone: 'Asia/Tokyo', latitude: 35.772, longitude: 140.3929 },
  SYD: { iata: 'SYD', icao: 'YSSY', name: 'Sydney Kingsford Smith', city: 'Sydney', country: 'AU', timeZone: 'Australia/Sydney', latitude: -33.9399, longitude: 151.1753 },
  AKL: { iata: 'AKL', icao: 'NZAA', name: 'Auckland', city: 'Auckland', country: 'NZ', timeZone: 'Pacific/Auckland', latitude: -37.0082, longitude: 174.785 },
};
