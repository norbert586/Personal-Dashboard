/**
 * This week's new comics from DC, Image and Marvel, from Comic Vine (a free key, ADR-015).
 *
 * Issues don't name their publisher, so the week's issues are listed by store date first, then
 * their volumes are looked up in batches for the publisher. Comic Vine only takes its key in the
 * URL, so the key lives in the URL here (error messages never include URLs).
 *
 * Not yet checked against the live API: the cloud sandbox has no key for it, and the batched
 * volume lookup (filter=id:a|b|c) isn't in Comic Vine's documentation. So only volumes that were
 * asked for count, and if publishers can't be told apart, every book shows, with a note.
 */
import type { Fetcher, Upstream } from '../fetcher.ts';
import { field, list, num, str } from '../json.ts';
import type { Source } from '../readings.ts';
import { zonedParts } from '../time.ts';
import { site } from '../../site.config.ts';

export interface Comic {
  id: number;
  /** "Lake Effect #3" */
  title: string;
  /** The issue's own name, when it has one: "Part Three". */
  name: string | undefined;
  /** YYYY-MM-DD */
  storeDate: string;
  url: string;
}

export interface Comics {
  /** Monday to Sunday of the week shown. */
  week: { from: string; to: string };
  /** One group per publisher in site.config.ts, or one "All publishers" group as a fallback. */
  groups: Array<{ publisher: string; comics: Comic[] }>;
}

type Publisher = (typeof site.comics)[number];

const API = 'https://comicvine.gamespot.com/api';
const HOUR = 60 * 60_000;
/** Comic Vine's page size, and the most pages to read in one week. */
const PAGE = 100;
const MAX_PAGES = 5;

/** Monday to Sunday of the week containing `now`, in the town's zone. */
export function weekOf(now: Date): { from: string; to: string } {
  const p = zonedParts(now);
  const weekday = (new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 6) % 7; // Monday = 0
  const day = (offset: number) =>
    new Date(Date.UTC(p.year, p.month - 1, p.day - weekday + offset)).toISOString().slice(0, 10);
  return { from: day(0), to: day(6) };
}

export function comics(
  key: string | undefined,
  publishers: readonly Publisher[] = site.comics,
): Source<Comics> {
  return {
    name: 'Comic Vine',
    empty: { week: { from: '', to: '' }, groups: [] },
    unconfigured: !key?.trim()
      ? "Add COMIC_VINE_API_KEY to .env to show this week's comics."
      : undefined,
    async load({ fetcher, now, problem }) {
      const week = weekOf(now);
      const ask = (path: string, query: string, ttl: number, sample: string): Upstream => ({
        name: 'Comic Vine',
        url: `${API}${path}?api_key=${encodeURIComponent(key ?? '')}&format=json&${query}`,
        ttl,
        sample,
        keyed: true,
      });

      // This week's issues, page by page (Comic Vine answers at most 100 at a time).
      const issues: unknown[] = [];
      for (let page = 0; page < MAX_PAGES; page++) {
        const offset = page * PAGE;
        const answer = await fetcher.json(
          ask(
            '/issues/',
            `filter=store_date:${week.from}|${week.to}` +
              '&field_list=id,name,issue_number,volume,store_date,site_detail_url' +
              `&sort=store_date:asc&limit=${PAGE}&offset=${offset}`,
            6 * HOUR,
            page === 0 ? 'comicvine-issues.json' : `comicvine-issues-${offset}.json`,
          ),
        );
        checkStatus(answer);
        issues.push(...list(field(answer, 'results')));
        if (issues.length >= (num(field(answer, 'number_of_total_results')) ?? 0)) break;
      }

      const parsed = parseIssues(issues);
      let publisherOf: Map<number, number> | undefined;
      try {
        publisherOf = await lookUpPublishers(
          [...new Set(parsed.map((issue) => issue.volumeId))],
          fetcher,
          (query, sample) => ask('/volumes/', query, 24 * HOUR, sample),
        );
      } catch (error) {
        problem(
          `Couldn't tell the publishers apart, so every publisher's books are listed: ${error instanceof Error ? error.message : error}`,
        );
      }
      return { week, groups: groupByPublisher(parsed, publisherOf, publishers) };
    },
  };
}

/** Comic Vine reports some errors with status 200 and its own status code. */
function checkStatus(answer: unknown): void {
  const code = num(field(answer, 'status_code'));
  if (code !== undefined && code !== 1) {
    throw new Error(`Comic Vine said "${str(field(answer, 'error')) ?? `error ${code}`}".`);
  }
}

export interface ParsedIssue extends Comic {
  volumeId: number;
  series: string;
  number: string | undefined;
}

export function parseIssues(results: readonly unknown[]): ParsedIssue[] {
  const issues: ParsedIssue[] = [];
  for (const raw of results) {
    const id = num(field(raw, 'id'));
    const volumeId = num(field(raw, 'volume', 'id'));
    const series = str(field(raw, 'volume', 'name'));
    const storeDate = str(field(raw, 'store_date'));
    if (
      id === undefined ||
      volumeId === undefined ||
      series === undefined ||
      storeDate === undefined
    ) {
      continue;
    }
    const number = str(field(raw, 'issue_number'));
    issues.push({
      id,
      volumeId,
      series,
      number,
      title: number === undefined ? series : `${series} #${number}`,
      name: str(field(raw, 'name')),
      storeDate,
      url: str(field(raw, 'site_detail_url')) ?? `https://comicvine.gamespot.com/issue/4000-${id}/`,
    });
  }
  return issues;
}

/** Volume id → publisher id, looked up a hundred volumes at a time. */
async function lookUpPublishers(
  volumeIds: readonly number[],
  fetcher: Fetcher,
  ask: (query: string, sample: string) => Upstream,
): Promise<Map<number, number>> {
  const publisherOf = new Map<number, number>();
  for (let start = 0; start < volumeIds.length; start += PAGE) {
    const batch = volumeIds.slice(start, start + PAGE);
    const answer = await fetcher.json(
      ask(
        `filter=id:${batch.join('|')}&field_list=id,name,publisher&limit=${PAGE}`,
        start === 0 ? 'comicvine-volumes.json' : `comicvine-volumes-${start}.json`,
      ),
    );
    checkStatus(answer);
    for (const [volumeId, publisherId] of parseVolumes(answer, batch)) {
      publisherOf.set(volumeId, publisherId);
    }
  }
  if (volumeIds.length > 0 && publisherOf.size === 0) {
    throw new Error('Comic Vine sent none of the volumes it was asked for.');
  }
  return publisherOf;
}

/** Volume id → publisher id, for the volumes that were asked for and nothing else. */
export function parseVolumes(answer: unknown, asked: readonly number[]): Map<number, number> {
  const wanted = new Set(asked);
  const publisherOf = new Map<number, number>();
  for (const raw of list(field(answer, 'results'))) {
    const id = num(field(raw, 'id'));
    const publisher = num(field(raw, 'publisher', 'id'));
    if (id !== undefined && publisher !== undefined && wanted.has(id))
      publisherOf.set(id, publisher);
  }
  return publisherOf;
}

/** Group by publisher, in the configured order, each sorted by series and issue number. */
export function groupByPublisher(
  issues: readonly ParsedIssue[],
  publisherOf: ReadonlyMap<number, number> | undefined,
  publishers: readonly Publisher[] = site.comics,
): Comics['groups'] {
  const order = (a: ParsedIssue, b: ParsedIssue) =>
    a.series.localeCompare(b.series) ||
    (Number.parseFloat(a.number ?? '') || 0) - (Number.parseFloat(b.number ?? '') || 0);
  const strip = ({
    volumeId: _volume,
    series: _series,
    number: _number,
    ...comic
  }: ParsedIssue): Comic => comic;

  if (publisherOf === undefined) {
    return issues.length > 0
      ? [{ publisher: 'All publishers', comics: [...issues].sort(order).map(strip) }]
      : [];
  }
  return publishers
    .map((publisher) => ({
      publisher: publisher.name,
      comics: issues
        .filter((issue) => publisherOf.get(issue.volumeId) === publisher.id)
        .sort(order)
        .map(strip),
    }))
    .filter((group) => group.comics.length > 0);
}
