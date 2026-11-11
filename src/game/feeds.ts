/**
 * The town's copy of the feeds (SPEC: Feeds in town). It reads the same /api/feeds.json as the
 * Today panel for what the town draws (signs, aircraft, the sky), and the panel's own cards as
 * HTML for the buildings' windows, so the town and the panel never disagree. Nothing here
 * throws: when the town can't reach its server, `problem` says why and the last answer stands.
 */
import type { Feeds } from '../lib/feeds.ts';
import { path } from '../lib/paths.ts';
import type { Provenance, Reading } from '../lib/readings.ts';

/** A value as JSON carries it: dates arrive as ISO strings. */
export type Wire<T> = T extends Date
  ? string
  : T extends ReadonlyArray<infer U>
    ? Array<Wire<U>>
    : T extends object
      ? { [K in keyof T]: Wire<T[K]> }
      : T;

export type TownFeeds = Wire<Feeds>;
export type WireReading<T> = Wire<Reading<T>>;

/** One answer from /api/feeds.json. */
export interface Snapshot {
  feeds: TownFeeds;
  /** The server's clock when it answered (ms since the epoch). */
  generatedAt: number;
  /** Our clock when the answer arrived (performance.now(), ms). */
  receivedAt: number;
}

/** How old a reading's data was when the server answered, in seconds (0 for saved samples). */
export function ageAtAnswer(
  reading: { provenance: Provenance; fetchedAt: string },
  snap: Snapshot,
) {
  if (reading.provenance !== 'live') return 0;
  return Math.max(0, (snap.generatedAt - Date.parse(reading.fetchedAt)) / 1000);
}

const failure = (what: string, error: unknown) =>
  `The town couldn't reach ${what}: ${error instanceof Error ? error.message : String(error)}.`;

async function ask(url: string): Promise<Response> {
  const response = await fetch(url, { headers: { accept: '*/*' } });
  if (!response.ok) throw new Error(`the server answered ${response.status}`);
  return response;
}

export class FeedClient {
  snapshot: Snapshot | null = null;
  /** Why the last refresh failed, in words; null when it worked. */
  problem: string | null = null;
  private readonly cards = new Map<string, Element>();
  private cardsAt = -Infinity;
  private busy: Promise<void> | null = null;
  private readonly listeners: Array<() => void> = [];

  /** Called after every refresh, whether it worked or not. */
  onChange(listener: () => void): void {
    this.listeners.push(listener);
  }

  /** Ask for the feeds again; with `cards`, the windows' cards too, so they match. */
  refresh(cards = false): Promise<void> {
    this.busy ??= this.load(cards).finally(() => {
      this.busy = null;
      for (const listener of this.listeners) listener();
    });
    return this.busy;
  }

  /** Seconds since the windows' cards were read. */
  get cardsAge(): number {
    return (performance.now() - this.cardsAt) / 1000;
  }

  /** A fresh copy of one feed's card, as the Today panel renders it. */
  card(id: string): Element | null {
    return (this.cards.get(id)?.cloneNode(true) as Element | undefined) ?? null;
  }

  /** Every card, in the Today panel's order. */
  allCards(): Element[] {
    return [...this.cards.values()].map((card) => card.cloneNode(true) as Element);
  }

  private async load(cards: boolean): Promise<void> {
    try {
      const [json, html] = await Promise.all([
        ask(path('/api/feeds.json')).then(
          (r) => r.json() as Promise<{ generatedAt: string; feeds: TownFeeds }>,
        ),
        cards ? ask(path('/today/cards')).then((r) => r.text()) : null,
      ]);
      this.snapshot = {
        feeds: json.feeds,
        generatedAt: Date.parse(json.generatedAt),
        receivedAt: performance.now(),
      };
      if (html !== null) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        this.cards.clear();
        for (const card of doc.querySelectorAll('[data-card]'))
          this.cards.set(card.getAttribute('data-card') ?? '', card);
        this.cardsAt = performance.now();
      }
      this.problem = null;
    } catch (error) {
      this.problem = failure('its feeds', error);
    }
  }
}
