import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { context, fixtureText, fixtures, outage, readLive } from './testing.ts';
import {
  cleanText,
  decode,
  mergeHeadlines,
  news,
  parseFeed,
  parseHackerNewsItem,
  type Headline,
} from './news.ts';

const NOW = new Date('2026-11-09T04:30:00Z');

describe('news: saved feeds', () => {
  it('reads RSS: CDATA titles, links with encoded ampersands, RFC 822 dates', async () => {
    const items = parseFeed(await fixtureText('rss-bbc-world.xml'));
    assert.equal(items.length, 6);
    // Feed order is kept; sections sort by date when they merge.
    assert.deepEqual(
      items.find((item) => item.title.startsWith('Surgeon')),
      {
        title:
          "Surgeon having lunch near Krakow shooting undoubtedly saved officer's life, colleague says",
        url: 'https://www.bbc.co.uk/news/articles/c5x2vw4e1gx1o?at_medium=RSS&at_campaign=rss',
        published: new Date('2026-11-08T23:34:18Z'),
      },
    );
  });

  it('reads Atom: alternate links and ISO dates', async () => {
    const [first] = parseFeed(await fixtureText('rss-theverge.xml'));
    assert.deepEqual(first, {
      title: 'Here’s the full text of Jensen Huang’s memo to Nvidia',
      url: 'https://www.theverge.com/ai-artificial-intelligence/1029595/full-text-jensen-huang-affair-memo-nvidia',
      published: new Date('2026-11-08T22:54:50Z'),
    });
  });

  it('decodes numeric character references in titles', async () => {
    const [first] = parseFeed(await fixtureText('rss-wdet.xml'));
    assert.equal(
      first?.title,
      '2026 Midterm Review: How will the Blue Wave affect Michigan? | MichMash',
    );
  });

  it('builds each section newest first, at most three per outlet', async () => {
    for (const section of ['local', 'tech', 'national', 'world'] as const) {
      const ctx = context(fixtures, NOW);
      const headlines = await news(section).load(ctx);
      assert.deepEqual(ctx.problems, [], section);
      assert.ok(headlines.length >= 6 && headlines.length <= 8, `${section}: ${headlines.length}`);
      const times = headlines.map((headline) => headline.published?.getTime() ?? 0);
      assert.deepEqual(
        times,
        [...times].sort((a, b) => b - a),
        `${section} order`,
      );
      const perOutlet = Map.groupBy(headlines, (headline) => headline.outlet);
      for (const [outlet, list] of perOutlet) assert.ok(list.length <= 3, `${section}: ${outlet}`);
    }
  });

  it('brings Hacker News stories with their threads', async () => {
    const tech = await news('tech').load(context(fixtures, NOW));
    const story = tech.find((headline) => headline.title === 'RIP, Harvest');
    assert.deepEqual(story, {
      title: 'RIP, Harvest',
      url: 'https://aphyr.com/posts/427-rip-harvest',
      outlet: 'Hacker News',
      published: new Date(1794189501 * 1000),
      discussion: {
        url: 'https://news.ycombinator.com/item?id=50420035',
        points: 97,
        comments: 33,
      },
    });
  });
});

describe('news: Hacker News items', () => {
  const base = { id: 1, type: 'story', title: 'Ask HN: What are you building?', time: 1794189501 };

  it('links an Ask HN post, which has no URL, to its thread', () => {
    assert.equal(parseHackerNewsItem(base)?.url, 'https://news.ycombinator.com/item?id=1');
  });

  it('skips dead, deleted and non-story items', () => {
    assert.equal(parseHackerNewsItem({ ...base, dead: true }), undefined);
    assert.equal(parseHackerNewsItem({ ...base, deleted: true }), undefined);
    assert.equal(parseHackerNewsItem({ ...base, type: 'job' }), undefined);
    assert.equal(parseHackerNewsItem(null), undefined);
  });
});

describe('news: merging and cleaning', () => {
  const headline = (outlet: string, url: string, iso?: string): Headline => ({
    title: url,
    url,
    outlet,
    published: iso ? new Date(iso) : undefined,
    discussion: undefined,
  });

  it('caps each outlet, drops repeats and puts undated headlines last', () => {
    const busy = [1, 2, 3, 4, 5].map((n) =>
      headline('Busy', `https://busy.example/${n}`, `2026-11-08T0${n}:00:00Z`),
    );
    const quiet = [
      headline('Quiet', 'https://quiet.example/a'),
      headline('Quiet', 'https://busy.example/5?utm=rss', '2026-11-08T09:00:00Z'), // a repeat
      headline('Quiet', 'https://quiet.example/b', '2026-11-07T12:00:00Z'),
    ];
    assert.deepEqual(
      mergeHeadlines([busy, quiet]).map((item) => item.url),
      [
        'https://busy.example/5',
        'https://busy.example/4',
        'https://busy.example/3',
        'https://quiet.example/b',
        'https://quiet.example/a',
      ],
    );
  });

  it('turns HTML titles into plain text', () => {
    assert.equal(cleanText('&lt;b&gt;Bold&lt;/b&gt;   move &amp;amp; more'), 'Bold move & more');
    assert.equal(cleanText('<em>Lake</em>\n effect'), 'Lake effect');
    assert.equal(
      decode('It&#8217;s &#x27;here&#x27; &rsquo; &unknown;'),
      "It’s 'here' ’ &unknown;",
    );
  });

  it('skips items without a title or a web link', () => {
    const xml = `<rss><channel>
      <item><title>No link</title></item>
      <item><title>Script</title><link>javascript:alert(1)</link></item>
      <item><title></title><link>https://example.com/empty</link></item>
      <item><title>Good</title><guid isPermaLink="true">https://example.com/good</guid></item>
    </channel></rss>`;
    assert.deepEqual(
      parseFeed(xml).map((item) => [item.title, item.url]),
      [['Good', 'https://example.com/good']],
    );
  });
});

describe('news: when outlets are down', () => {
  it('shows the outlets that answered and names the one that did not', async () => {
    const fetcher = outage(
      "WDET didn't answer within 8 s.",
      (upstream) => upstream.name === 'WDET',
    );
    const ctx = context(fetcher, NOW);
    const local = await news('local').load(ctx);
    assert.ok(local.length > 0);
    assert.ok(local.every((headline) => headline.outlet !== 'WDET'));
    assert.deepEqual(ctx.problems, ["WDET didn't answer within 8 s."]);
  });

  it('is offline when every outlet in a section is down', async () => {
    const reading = await readLive(news('world'), outage("Couldn't reach BBC World."), NOW);
    assert.equal(reading.provenance, 'offline');
    assert.equal(reading.detail, "No world news: Couldn't reach BBC World.");
    assert.equal(reading.source, 'BBC World, NPR World');
  });
});
