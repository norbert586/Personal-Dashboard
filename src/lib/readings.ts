/**
 * Every data source returns a Reading: the data plus where it came from (ADR-007).
 * The UI shows provenance on every module, so sample data is never mistaken for real data.
 */
export type Provenance = 'live' | 'local' | 'sample' | 'offline';

export interface Reading<T> {
  /** Human name of the source, e.g. "Google Calendar". */
  source: string;
  provenance: Provenance;
  fetchedAt: Date;
  data: T;
  /** Why a source is offline, or what's needed to make it live. */
  detail?: string;
}

export const provenanceLabel: Record<Provenance, string> = {
  live: 'Live',
  local: 'Local files',
  sample: 'Sample data',
  offline: 'Offline',
};

/** Run a source; if it throws, return an Offline reading instead of breaking the page. */
export async function settle<T>(
  source: string,
  fallback: T,
  load: () => Promise<Reading<T>>,
): Promise<Reading<T>> {
  try {
    return await load();
  } catch (error) {
    return {
      source,
      provenance: 'offline',
      fetchedAt: new Date(),
      data: fallback,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}
