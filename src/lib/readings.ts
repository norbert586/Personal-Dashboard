/**
 * Every data source returns a Reading: the data plus where it came from (ADR-007).
 * The UI shows provenance on every module, so sample data is never mistaken for real data.
 */
import type { Fetcher, TrackedFetcher } from './fetcher.ts';

export type Provenance = 'live' | 'local' | 'sample' | 'offline';

export interface Reading<T> {
  /** Human name of the source, e.g. "National Weather Service". */
  source: string;
  provenance: Provenance;
  /** When the oldest data in this reading was fetched. */
  fetchedAt: Date;
  data: T;
  /** Why a source is offline or partly stale, or what's needed to make it live. */
  detail?: string;
}

export const provenanceLabel: Record<Provenance, string> = {
  live: 'Live',
  local: 'Local files',
  sample: 'Sample data',
  offline: 'Offline',
};

/** What a source gets to work with while it loads. */
export interface LoadContext {
  fetcher: Fetcher;
  now: Date;
  /** Say that part of the feed is missing (one team, one outlet) without failing all of it. */
  problem(message: string): void;
}

/** One feed's source: how to load it, and what to show when it can't be loaded. */
export interface Source<T> {
  /** Shown with the reading, e.g. "National Weather Service". */
  name: string;
  /** What an offline reading carries. */
  empty: T;
  /** Set when the source needs a key that isn't configured: what to add, in words. */
  unconfigured?: string | undefined;
  /** Fetch and parse. Throws, with a human-readable message, when there's nothing to show. */
  load(context: LoadContext): Promise<T>;
}

export interface ReadOptions {
  /** `sample` answers every source from its saved samples, with no network. */
  mode: 'live' | 'sample';
  /** A fresh view of the live cache for each reading. */
  live: () => TrackedFetcher;
  /** Answers from saved samples. */
  sample: Fetcher;
  now: Date;
  /** When the saved samples were captured, so they read as they did then. */
  sampleNow: Date;
}

/**
 * The moment a reading's relative times ("3 hours ago", "Tomorrow") count from: now for live data,
 * the capture time for saved samples, so a sample reads as it did when it was saved.
 */
export function readingNow(reading: Reading<unknown>, now: Date): Date {
  return reading.provenance === 'sample' ? reading.fetchedAt : now;
}

/** Load a source into a reading. Never throws: a failure comes back as an offline reading. */
export async function readSource<T>(source: Source<T>, options: ReadOptions): Promise<Reading<T>> {
  const problems: string[] = [];
  const problem = (message: string) => {
    if (!problems.includes(message)) problems.push(message);
  };
  const detail = (...lines: Array<string | undefined>) => {
    const text = lines.filter((line) => line !== undefined && line !== '').join(' ');
    return text === '' ? {} : { detail: text };
  };

  try {
    if (options.mode === 'sample' || source.unconfigured !== undefined) {
      const data = await source.load({
        fetcher: options.sample,
        now: options.sampleNow,
        problem,
      });
      return {
        source: source.name,
        provenance: 'sample',
        fetchedAt: options.sampleNow,
        data,
        ...detail(source.unconfigured, ...problems),
      };
    }

    const fetcher = options.live();
    const data = await source.load({ fetcher, now: options.now, problem });
    return {
      source: source.name,
      provenance: 'live',
      fetchedAt: fetcher.oldest ?? options.now,
      data,
      ...detail(...fetcher.problems, ...problems),
    };
  } catch (error) {
    return {
      source: source.name,
      provenance: 'offline',
      fetchedAt: options.now,
      data: source.empty,
      ...detail(error instanceof Error ? error.message : String(error)),
    };
  }
}
