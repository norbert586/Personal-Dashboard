import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { context, fixtures, outage, readLive } from './testing.ts';
import { comics, weekOf } from './comics.ts';
import type { Fetcher, Upstream } from '../fetcher.ts';

// 23:30 on Sunday 8 November 2026 in Detroit: the week is Monday 2 to Sunday 8 November.
const NOW = new Date('2026-11-09T04:30:00Z');

const titles = (groups: Array<{ publisher: string; comics: Array<{ title: string }> }>) =>
  groups.map((group) => [group.publisher, group.comics.map((comic) => comic.title)]);

describe('comics: the week', () => {
  it("runs Monday to Sunday in Detroit's calendar", () => {
    assert.deepEqual(weekOf(NOW), { from: '2026-11-02', to: '2026-11-08' });
    assert.deepEqual(weekOf(new Date('2026-11-09T05:30:00Z')), {
      from: '2026-11-09',
      to: '2026-11-15',
    }); // 00:30 Monday
    assert.deepEqual(weekOf(new Date('2026-11-11T17:00:00Z')), {
      from: '2026-11-09',
      to: '2026-11-15',
    }); // new comics Wednesday
  });
});

describe('comics: saved sample (real Comic Vine answers for 26 October to 8 November)', () => {
  it("groups the week's DC, Image and Marvel books, leaving other publishers out", async () => {
    const ctx = context(fixtures, NOW);
    const data = await comics('key').load(ctx);
    assert.deepEqual(data.week, { from: '2026-11-02', to: '2026-11-08' });
    assert.equal(data.current, true);
    assert.deepEqual(
      data.groups.map((group) => [group.publisher, group.comics.length]),
      [
        ['DC', 9],
        ['Image', 8],
        ['Marvel', 15],
      ],
    );
    const dc = data.groups[0]?.comics ?? [];
    assert.ok(dc.some((comic) => comic.title === 'Batman #15'));
    assert.deepEqual(
      dc.find((comic) => comic.title === 'Absolute Superman #25'),
      {
        id: dc.find((comic) => comic.title === 'Absolute Superman #25')?.id,
        title: 'Absolute Superman #25',
        name: 'Get Brainiac, Finale: A Walk in the Mind of a Madman',
        storeDate: '2026-11-04',
        url: dc.find((comic) => comic.title === 'Absolute Superman #25')?.url,
      },
    );
    assert.ok(data.groups[2]?.comics.some((comic) => comic.title === 'Uncanny X-Men #38'));
    assert.deepEqual(ctx.problems, []);
  });

  it('asks for two weeks by store date, then their volumes in sorted batches, with the key', async () => {
    const asked: Upstream[] = [];
    const recording: Fetcher = {
      json: (upstream) => {
        asked.push(upstream);
        return fixtures.json(upstream);
      },
      text: fixtures.text,
    };
    await comics('cv-key').load(context(recording, NOW));
    const urls = asked.map((upstream) => new URL(upstream.url));
    assert.deepEqual(
      urls.map((url) => [url.pathname, url.searchParams.get('offset')]),
      [
        ['/api/issues/', '0'],
        ['/api/issues/', '100'],
        ['/api/issues/', '200'],
        ['/api/volumes/', null],
        ['/api/volumes/', null],
        ['/api/volumes/', null],
      ],
    );
    assert.equal(urls[0]?.searchParams.get('api_key'), 'cv-key');
    assert.equal(urls[0]?.searchParams.get('filter'), 'store_date:2026-10-26|2026-11-08');
    const firstBatch = (urls[3]?.searchParams.get('filter') ?? '').replace('id:', '').split('|');
    assert.equal(firstBatch.length, 100);
    assert.deepEqual(
      firstBatch,
      [...firstBatch].sort((a, b) => Number(a) - Number(b)),
    );
    assert.ok(asked.every((upstream) => upstream.keyed));
  });
});

describe('comics: paging and fallbacks', () => {
  const issue = (id: number) => ({
    id,
    issue_number: String(id),
    store_date: '2026-11-04',
    volume: { id: 500 + (id % 3), name: `Series ${id % 3}` },
  });
  const page = (total: number, ids: number[]) => ({
    status_code: 1,
    error: 'OK',
    number_of_total_results: total,
    results: ids.map(issue),
  });

  it('reads every page of a busy week', async () => {
    const offsets: string[] = [];
    const fetcher: Fetcher = {
      json: async (upstream) => {
        const url = new URL(upstream.url);
        if (url.pathname === '/api/volumes/') {
          return {
            status_code: 1,
            results: [500, 501, 502].map((id) => ({ id, publisher: { id: 10 } })),
          };
        }
        offsets.push(url.searchParams.get('offset') ?? '');
        const start = Number(url.searchParams.get('offset'));
        const ids = Array.from({ length: Math.min(100, 150 - start) }, (_, i) => start + i + 1);
        return page(150, ids);
      },
      text: async () => '',
    };
    const data = await comics('key').load(context(fetcher, NOW));
    assert.deepEqual(offsets, ['0', '100']);
    assert.equal(data.groups[0]?.comics.length, 150);
  });

  it("lists every publisher's books, and says why, when publishers can't be looked up", async () => {
    for (const volumes of [
      async () => Promise.reject(new Error('Comic Vine answered 502.')),
      async () => ({ status_code: 1, results: [{ id: 1, publisher: { id: 10 } }] }), // not asked for
    ]) {
      const fetcher: Fetcher = {
        json: (upstream) =>
          new URL(upstream.url).pathname === '/api/volumes/'
            ? volumes()
            : Promise.resolve(page(2, [1, 2])),
        text: async () => '',
      };
      const ctx = context(fetcher, NOW);
      const data = await comics('key').load(ctx);
      assert.deepEqual(titles(data.groups), [['All publishers', ['Series 1 #1', 'Series 2 #2']]]);
      assert.equal(ctx.problems.length, 1);
      assert.match(ctx.problems[0] ?? '', /^Couldn't tell the publishers apart/);
    }
  });

  it("shows last week's books, and says so, while Comic Vine has none from this week", async () => {
    const issues = {
      status_code: 1,
      number_of_total_results: 2,
      results: [
        {
          id: 1,
          issue_number: '1',
          store_date: '2026-10-28',
          volume: { id: 500, name: 'Last Week' },
        },
        { id: 2, issue_number: '1', store_date: '2026-11-06', volume: { id: 600, name: 'Manga' } },
      ],
    };
    const volumes = {
      status_code: 1,
      results: [
        { id: 500, publisher: { id: 10 } },
        { id: 600, publisher: { id: 1 } }, // not one of ours
      ],
    };
    const fetcher: Fetcher = {
      json: async (upstream) =>
        new URL(upstream.url).pathname === '/api/volumes/' ? volumes : issues,
      text: async () => '',
    };
    const data = await comics('key').load(context(fetcher, NOW));
    assert.deepEqual(data.week, { from: '2026-10-26', to: '2026-11-01' });
    assert.equal(data.current, false);
    assert.deepEqual(titles(data.groups), [['DC', ['Last Week #1']]]);
  });

  it('is offline when Comic Vine reports an error in its own status code', async () => {
    const fetcher: Fetcher = {
      json: async () => ({ status_code: 104, error: 'Filter Error', results: [] }),
      text: async () => '',
    };
    const reading = await readLive(comics('key'), fetcher, NOW);
    assert.equal(reading.provenance, 'offline');
    assert.equal(reading.detail, 'Comic Vine said "Filter Error".');
  });

  it('is offline when Comic Vine refuses the key', async () => {
    const reading = await readLive(
      comics('wrong'),
      outage('Comic Vine refused the key (401). Check it in .env.'),
      NOW,
    );
    assert.equal(reading.detail, 'Comic Vine refused the key (401). Check it in .env.');
  });

  it('asks for the key when there is none, or an empty one', () => {
    assert.match(comics(undefined).unconfigured ?? '', /Add COMIC_VINE_API_KEY/);
    assert.match(comics('').unconfigured ?? '', /Add COMIC_VINE_API_KEY/);
    assert.equal(comics('key').unconfigured, undefined);
  });
});
