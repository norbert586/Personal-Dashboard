/**
 * How feeds reach the outside world. Every request goes through one in-process cache, keyed by URL,
 * so page loads and the JSON endpoint share answers and free API quotas last.
 *
 * - An answer is fresh for its upstream's `ttl`; concurrent requests share one fetch.
 * - A failure is remembered for a minute, so a dead upstream doesn't add a timeout to every page.
 * - When a refresh fails, the last good answer stands in for up to KEEP_TTLS × `ttl`, and the
 *   reading says why it's old. After that the source is offline.
 * - Error messages name the upstream and what went wrong, never the URL: some keys ride in URLs.
 */

export interface Upstream {
  /** Who answers, for messages: "ESPN", "the National Weather Service". */
  name: string;
  url: string;
  /** How long a good answer stays fresh, in milliseconds. */
  ttl: number;
  /** The saved sample (a file in src/lib/sources/fixtures/) that answers in sample mode. */
  sample: string;
  headers?: Readonly<Record<string, string>>;
  /** Sends an API key, so a refusal (401 or 403) most likely means a bad key. */
  keyed?: boolean;
}

/** What sources fetch through. The live cache, saved samples and tests all fit. */
export interface Fetcher {
  json(upstream: Upstream): Promise<unknown>;
  text(upstream: Upstream): Promise<string>;
}

/** One reading's view of the cache: it remembers how old its answers were and what went wrong. */
export interface TrackedFetcher extends Fetcher {
  /** When the oldest answer it served was fetched. */
  readonly oldest: Date | undefined;
  /** Upstreams that failed to refresh, so an older answer was served instead. */
  readonly problems: readonly string[];
}

export interface CacheOptions {
  userAgent: string;
  timeoutMs?: number;
  fetch?: typeof globalThis.fetch;
  clock?: () => number;
}

type Kind = 'json' | 'text';

interface Entry {
  value?: unknown;
  /** When `value` was fetched. */
  at?: number;
  failedAt?: number;
  failure?: string;
  pending?: Promise<void> | undefined;
  usedAt: number;
}

const DEFAULT_TIMEOUT_MS = 8_000;
/** Don't retry a failed upstream sooner than this (or its ttl, if shorter). */
const COOLDOWN_MS = 60_000;
/** A failed refresh may fall back to an answer up to this many ttls old. */
export const KEEP_TTLS = 6;
/** Forget answers nobody has asked for in a day. */
const FORGET_MS = 86_400_000;

/** A failure we've already put into words. */
class UpstreamError extends Error {}

export class UpstreamCache {
  readonly #entries = new Map<string, Entry>();
  readonly #options: CacheOptions;
  #sweptAt = 0;

  constructor(options: CacheOptions) {
    this.#options = options;
  }

  /** A fresh view for one reading. */
  fetcher(): TrackedFetcher {
    let oldest: number | undefined;
    const problems: string[] = [];
    const record = (at: number, problem?: string) => {
      if (oldest === undefined || at < oldest) oldest = at;
      if (problem !== undefined && !problems.includes(problem)) problems.push(problem);
    };
    return {
      json: (upstream) => this.#get(upstream, 'json', record),
      text: async (upstream) => String(await this.#get(upstream, 'text', record)),
      get oldest() {
        return oldest === undefined ? undefined : new Date(oldest);
      },
      get problems() {
        return problems;
      },
    };
  }

  #now(): number {
    return (this.#options.clock ?? Date.now)();
  }

  async #get(
    upstream: Upstream,
    kind: Kind,
    record: (at: number, problem?: string) => void,
  ): Promise<unknown> {
    this.#sweep();
    const key = `${kind} ${upstream.url}`;
    const entry: Entry = this.#entries.get(key) ?? { usedAt: this.#now() };
    this.#entries.set(key, entry);
    entry.usedAt = this.#now();

    const age = () => (entry.at === undefined ? Infinity : this.#now() - entry.at);
    if (age() >= upstream.ttl) {
      const coolingDown =
        entry.failedAt !== undefined &&
        this.#now() - entry.failedAt < Math.min(COOLDOWN_MS, upstream.ttl);
      if (!coolingDown) {
        entry.pending ??= this.#refresh(upstream, kind, entry).finally(() => {
          entry.pending = undefined;
        });
        await entry.pending;
      }
    }

    if (entry.at !== undefined && age() < upstream.ttl) {
      record(entry.at);
      return entry.value;
    }
    if (entry.at !== undefined && age() < upstream.ttl * KEEP_TTLS) {
      record(entry.at, entry.failure ?? `Couldn't refresh ${upstream.name}.`);
      return entry.value;
    }
    throw new UpstreamError(entry.failure ?? `Couldn't reach ${upstream.name}.`);
  }

  async #refresh(upstream: Upstream, kind: Kind, entry: Entry): Promise<void> {
    const timeoutMs = this.#options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    try {
      const response = await (this.#options.fetch ?? globalThis.fetch)(upstream.url, {
        headers: {
          'user-agent': this.#options.userAgent,
          accept: kind === 'json' ? 'application/json' : '*/*',
          ...upstream.headers,
        },
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (!response.ok) throw new UpstreamError(statusMessage(upstream, response.status));
      const body = await response.text();
      let value: unknown = body;
      if (kind === 'json') {
        try {
          value = JSON.parse(body);
        } catch {
          throw new UpstreamError(`${capitalize(upstream.name)} sent something that isn't JSON.`);
        }
      }
      entry.value = value;
      entry.at = this.#now();
      entry.failedAt = undefined;
      entry.failure = undefined;
    } catch (error) {
      entry.failedAt = this.#now();
      entry.failure = failureMessage(upstream.name, error, timeoutMs);
    }
  }

  #sweep(): void {
    const now = this.#now();
    if (now - this.#sweptAt < 60_000) return;
    this.#sweptAt = now;
    for (const [key, entry] of this.#entries) {
      if (now - entry.usedAt > FORGET_MS && !entry.pending) this.#entries.delete(key);
    }
  }
}

function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function statusMessage(upstream: Upstream, status: number): string {
  const who = capitalize(upstream.name);
  if (status === 401 || status === 403) {
    return upstream.keyed
      ? `${who} refused the key (${status}). Check it in .env.`
      : `${who} refused the request (${status}).`;
  }
  if (status === 429) return `${who} says we're asking too often (429).`;
  return `${who} answered ${status}.`;
}

function failureMessage(name: string, error: unknown, timeoutMs: number): string {
  if (error instanceof UpstreamError) return error.message;
  // A timed-out fetch rejects with the signal's reason, a DOMException named TimeoutError.
  const errorName = (error as { name?: unknown } | undefined)?.name;
  if (errorName === 'TimeoutError' || errorName === 'AbortError') {
    return `${capitalize(name)} didn't answer within ${Math.max(1, Math.round(timeoutMs / 1000))} s.`;
  }
  // fetch() hides the network reason (DNS, refused, reset) in `cause.code`; never the URL.
  const cause =
    error instanceof Error ? (error.cause as { code?: unknown } | undefined) : undefined;
  const code = typeof cause?.code === 'string' ? ` (${cause.code})` : '';
  return `Couldn't reach ${name}${code}.`;
}

/** Answers every upstream from its saved sample, with no network. */
export function sampleFetcher(load: (sample: string) => Promise<string | undefined>): Fetcher {
  const text = async (upstream: Upstream) => {
    const body = await load(upstream.sample);
    if (body === undefined) throw new Error(`There's no saved sample for ${upstream.name}.`);
    return body;
  };
  return { text, json: async (upstream) => JSON.parse(await text(upstream)) as unknown };
}
