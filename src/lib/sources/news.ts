/**
 * Headlines that link back to their source (ADR-017): RSS and Atom feeds, plus Hacker News' free
 * API. Four sections, each newest first, with a cap per outlet so one busy newsroom can't fill a
 * list. Titles and links only, never article text.
 */
import type { Fetcher } from '../fetcher.ts';
import { date, field, list, num, str } from '../json.ts';
import type { Source } from '../readings.ts';
import { site, type NewsSection, type Outlet } from '../../site.config.ts';

export interface Headline {
  title: string;
  url: string;
  outlet: string;
  published: Date | undefined;
  /** Hacker News' own thread for the story. */
  discussion: { url: string; points: number; comments: number } | undefined;
}

export const SECTION_TITLES: Record<NewsSection, string> = {
  local: 'Local',
  tech: 'Tech',
  national: 'National',
  world: 'World',
};

const MINUTE = 60_000;
/** Most headlines one outlet gets in a section. */
const PER_OUTLET = 3;
/** Headlines per section. */
const PER_SECTION = 8;
/** Hacker News stories to look up: one request each. */
const HN_STORIES = 6;

export function news(section: NewsSection, outlets: readonly Outlet[] = site.news[section]) {
  const source: Source<Headline[]> = {
    name: outlets.map((outlet) => outlet.name).join(', '),
    empty: [],
    async load({ fetcher, problem }) {
      const answers = await Promise.allSettled(
        outlets.map((outlet) => loadOutlet(outlet, fetcher)),
      );
      const lists: Headline[][] = [];
      for (const answer of answers) {
        // Failures already name the outlet: "WDET didn't answer within 8 s."
        if (answer.status === 'fulfilled') lists.push(answer.value);
        else problem(message(answer.reason));
      }
      if (lists.length === 0 && outlets.length > 0) {
        throw new Error(
          `No ${SECTION_TITLES[section].toLowerCase()} news: ${message(answers.find((a) => a.status === 'rejected')?.reason)}`,
        );
      }
      return mergeHeadlines(lists);
    },
  };
  return source;
}

function message(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function loadOutlet(outlet: Outlet, fetcher: Fetcher): Promise<Headline[]> {
  if (outlet.feed === 'hacker-news') return loadHackerNews(outlet, fetcher);
  const xml = await fetcher.text({
    name: outlet.name,
    url: outlet.feed,
    ttl: 15 * MINUTE,
    sample: `rss-${outlet.id}.xml`,
    headers: { accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml' },
  });
  const items = parseFeed(xml);
  if (items.length === 0) throw new Error(`${outlet.name} sent a feed with no headlines.`);
  return items.map((item) => ({ ...item, outlet: outlet.name, discussion: undefined }));
}

async function loadHackerNews(outlet: Outlet, fetcher: Fetcher): Promise<Headline[]> {
  const api = 'https://hacker-news.firebaseio.com/v0';
  const top = await fetcher.json({
    name: outlet.name,
    url: `${api}/topstories.json`,
    ttl: 15 * MINUTE,
    sample: 'hn-topstories.json',
  });
  const ids = list(top)
    .map((id) => num(id))
    .filter((id) => id !== undefined)
    .slice(0, HN_STORIES);
  const items = await Promise.allSettled(
    ids.map((id) =>
      fetcher.json({
        name: outlet.name,
        url: `${api}/item/${id}.json`,
        ttl: 60 * MINUTE,
        sample: `hn-item-${id}.json`,
      }),
    ),
  );
  const stories = items
    .map((item) => (item.status === 'fulfilled' ? parseHackerNewsItem(item.value) : undefined))
    .filter((story) => story !== undefined);
  if (stories.length === 0) throw new Error("Hacker News didn't send any stories.");
  return stories.map((story) => ({ ...story, outlet: outlet.name }));
}

/** One Hacker News story, or undefined for anything that isn't a live story. */
export function parseHackerNewsItem(json: unknown): Omit<Headline, 'outlet'> | undefined {
  const id = num(field(json, 'id'));
  const title = str(field(json, 'title'));
  if (id === undefined || title === undefined) return undefined;
  if (field(json, 'type') !== 'story' || field(json, 'dead') === true) return undefined;
  if (field(json, 'deleted') === true) return undefined;
  const thread = `https://news.ycombinator.com/item?id=${id}`;
  const time = num(field(json, 'time'));
  return {
    title: cleanText(title),
    url: safeUrl(str(field(json, 'url'))) ?? thread, // Ask HN and Show HN posts have no link
    published: time === undefined ? undefined : new Date(time * 1000),
    discussion: {
      url: thread,
      points: num(field(json, 'score')) ?? 0,
      comments: num(field(json, 'descendants')) ?? 0,
    },
  };
}

/**
 * Newest first, at most PER_OUTLET from each outlet and PER_SECTION in all, without repeats.
 * Headlines with no date go after the dated ones.
 */
export function mergeHeadlines(lists: readonly Headline[][]): Headline[] {
  const seen = new Set<string>();
  const capped = lists.flatMap((headlines) =>
    [...headlines]
      .sort(newestFirst)
      .filter((headline) => {
        const key = withoutQuery(headline.url);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .slice(0, PER_OUTLET),
  );
  return capped.sort(newestFirst).slice(0, PER_SECTION);
}

function newestFirst(a: Headline, b: Headline): number {
  return (b.published?.getTime() ?? -Infinity) - (a.published?.getTime() ?? -Infinity);
}

function withoutQuery(url: string): string {
  return url.split(/[?#]/)[0]!.replace(/\/$/, '');
}

// ---- RSS 2.0 and Atom ----

export interface FeedItem {
  title: string;
  url: string;
  published: Date | undefined;
}

/**
 * The items of an RSS 2.0 or Atom feed: title, link and date. A small, forgiving extractor
 * rather than a full XML parser; items without a title or an http(s) link are skipped.
 */
export function parseFeed(xml: string): FeedItem[] {
  const items: FeedItem[] = [];
  for (const [, , body = ''] of xml.matchAll(/<(item|entry)\b[^>]*>([\s\S]*?)<\/\1>/g)) {
    const title = cleanText(element(body, 'title') ?? '');
    const url = safeUrl(itemLink(body));
    if (title === '' || url === undefined) continue;
    items.push({
      title,
      url,
      published: date(
        decode(
          element(body, 'pubDate') ??
            element(body, 'published') ??
            element(body, 'updated') ??
            element(body, 'dc:date') ??
            '',
        ),
      ),
    });
  }
  return items;
}

/** The inner text of the first <name> element, with CDATA unwrapped (entities still encoded). */
function element(body: string, name: string): string | undefined {
  const match = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`).exec(body);
  if (!match) return undefined;
  return match[1]!.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, (_, inner: string) => inner).trim();
}

/** RSS puts the link in <link>…</link>; Atom in <link rel="alternate" href="…"/>. */
function itemLink(body: string): string | undefined {
  const text = element(body, 'link');
  if (text) return decode(text);
  for (const [tag] of body.matchAll(/<link\b[^>]*>/g)) {
    const rel = /\brel=["']([^"']*)["']/.exec(tag)?.[1] ?? 'alternate';
    const href = /\bhref=["']([^"']*)["']/.exec(tag)?.[1];
    if (rel === 'alternate' && href) return decode(href);
  }
  const guid = element(body, 'guid');
  return guid && /^https?:\/\//.test(guid) ? decode(guid) : undefined;
}

/** Only links a reader can safely follow. */
function safeUrl(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  try {
    const parsed = new URL(url.trim());
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.href : undefined;
  } catch {
    return undefined;
  }
}

/** Plain text for a title: entities decoded, any HTML tags dropped, whitespace collapsed. */
export function cleanText(raw: string): string {
  return decode(decode(raw).replace(/<[^>]*>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

const ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  hellip: '…',
  mdash: '—',
  ndash: '–',
  lsquo: '‘',
  rsquo: '’',
  ldquo: '“',
  rdquo: '”',
};

/** Decode XML/HTML character references once: &amp; &#8217; &#x27; &rsquo; … */
export function decode(text: string): string {
  return text.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (whole, code: string) => {
    if (code[0] === '#') {
      const point =
        code[1] === 'x' || code[1] === 'X' ? parseInt(code.slice(2), 16) : Number(code.slice(1));
      return Number.isInteger(point) && point > 0 && point <= 0x10ffff
        ? String.fromCodePoint(point)
        : whole;
    }
    return ENTITIES[code.toLowerCase()] ?? whole;
  });
}
