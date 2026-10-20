import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

import { createFlightDataProvider } from '../data';
import type { FlightDataProvider } from '../data/provider';
import type { Flight, SavedFlight } from '../domain/types';
import { FlightRepository } from '../storage/flightRepository';

interface FlightsState {
  flights: SavedFlight[];
  loading: boolean;
  /** Storage problem to surface to the user (load/save failure or recovered corruption). */
  storageMessage: string | null;
  provider: FlightDataProvider;
  saveFlight(flight: Flight): Promise<void>;
  removeFlight(id: string): Promise<void>;
  /** Fetch a fresh snapshot from the provider and persist it. */
  refreshFlight(id: string): Promise<void>;
  dismissStorageMessage(): void;
}

const FlightsContext = createContext<FlightsState | null>(null);

export function FlightsProvider({ children }: { children: ReactNode }) {
  const [repo] = useState(() => new FlightRepository(AsyncStorage));
  const [provider] = useState(createFlightDataProvider);
  const [flights, setFlights] = useState<SavedFlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [storageMessage, setStorageMessage] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    repo
      .load()
      .then((result) => {
        if (cancelled) return;
        setFlights(result.flights);
        if (result.recoveredFromCorruption) {
          setStorageMessage('Saved flights could not be read and were reset. A backup copy was kept on this device.');
        }
      })
      .catch(() => !cancelled && setStorageMessage('Could not load saved flights from this device.'))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [repo]);

  const saveFlight = useCallback(
    async (flight: Flight) => {
      setFlights(await repo.upsert(flight));
    },
    [repo],
  );

  const removeFlight = useCallback(
    async (id: string) => {
      setFlights(await repo.remove(id));
    },
    [repo],
  );

  const refreshFlight = useCallback(
    async (id: string) => {
      const fresh = await provider.getFlight(id);
      setFlights(await repo.updateIfPresent(fresh));
    },
    [provider, repo],
  );

  const value = useMemo<FlightsState>(
    () => ({
      flights,
      loading,
      storageMessage,
      provider,
      saveFlight,
      removeFlight,
      refreshFlight,
      dismissStorageMessage: () => setStorageMessage(null),
    }),
    [flights, loading, storageMessage, provider, saveFlight, removeFlight, refreshFlight],
  );

  return <FlightsContext.Provider value={value}>{children}</FlightsContext.Provider>;
}

export function useFlights(): FlightsState {
  const ctx = useContext(FlightsContext);
  if (!ctx) throw new Error('useFlights must be used inside <FlightsProvider>');
  return ctx;
}

/** Re-renders periodically so status labels (which depend on "now") stay current. */
export function useNow(intervalMs = 30_000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}
