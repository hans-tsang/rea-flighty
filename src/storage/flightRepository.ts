import type { Flight, SavedFlight } from '../domain/types';

/** Minimal async key-value interface (AsyncStorage-compatible) so storage is testable. */
export interface KeyValueStore {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

export const STORAGE_KEY = 'rea-flighty/saved-flights';
export const SCHEMA_VERSION = 1;

interface StoredDocument {
  version: number;
  flights: SavedFlight[];
}

export interface LoadResult {
  flights: SavedFlight[];
  /** Set when stored data could not be read and was moved aside. */
  recoveredFromCorruption: boolean;
}

/**
 * Persists saved flights (full snapshots, so details work offline).
 * Writes are serialized so overlapping save/remove calls cannot lose updates.
 */
export class FlightRepository {
  private queue: Promise<unknown> = Promise.resolve();

  constructor(
    private readonly store: KeyValueStore,
    private readonly now: () => number = Date.now,
  ) {}

  async load(): Promise<LoadResult> {
    const raw = await this.store.getItem(STORAGE_KEY);
    if (raw === null) return { flights: [], recoveredFromCorruption: false };
    try {
      const doc = JSON.parse(raw) as StoredDocument;
      if (!doc || doc.version !== SCHEMA_VERSION || !Array.isArray(doc.flights)) {
        throw new Error('Unsupported schema');
      }
      return { flights: doc.flights.filter(isSavedFlight), recoveredFromCorruption: false };
    } catch {
      // Keep the unreadable payload for diagnostics instead of silently deleting it.
      await this.store.setItem(`${STORAGE_KEY}.corrupt-${this.now()}`, raw);
      await this.store.removeItem(STORAGE_KEY);
      return { flights: [], recoveredFromCorruption: true };
    }
  }

  /** Insert or replace (by id) a flight snapshot. Preserves the original `savedAt`. */
  upsert(flight: Flight): Promise<SavedFlight[]> {
    return this.mutate((flights) => {
      const existing = flights.find((f) => f.flight.id === flight.id);
      const entry: SavedFlight = {
        flight,
        savedAt: existing?.savedAt ?? new Date(this.now()).toISOString(),
      };
      return existing ? flights.map((f) => (f.flight.id === flight.id ? entry : f)) : [...flights, entry];
    });
  }

  remove(id: string): Promise<SavedFlight[]> {
    return this.mutate((flights) => flights.filter((f) => f.flight.id !== id));
  }

  private mutate(fn: (flights: SavedFlight[]) => SavedFlight[]): Promise<SavedFlight[]> {
    const run = this.queue.then(async () => {
      const { flights } = await this.load();
      const next = fn(flights);
      const doc: StoredDocument = { version: SCHEMA_VERSION, flights: next };
      await this.store.setItem(STORAGE_KEY, JSON.stringify(doc));
      return next;
    });
    this.queue = run.catch(() => undefined);
    return run;
  }
}

function isSavedFlight(value: unknown): value is SavedFlight {
  const v = value as SavedFlight;
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof v.savedAt === 'string' &&
    typeof v.flight?.id === 'string' &&
    typeof v.flight?.departure?.times?.scheduled === 'string' &&
    typeof v.flight?.arrival?.times?.scheduled === 'string'
  );
}

export class MemoryStore implements KeyValueStore {
  readonly data = new Map<string, string>();
  async getItem(key: string) {
    return this.data.get(key) ?? null;
  }
  async setItem(key: string, value: string) {
    this.data.set(key, value);
  }
  async removeItem(key: string) {
    this.data.delete(key);
  }
}
