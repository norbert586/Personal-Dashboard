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

describe('comics: saved sample', () => {
  it("groups the week's DC, Image and Marvel books, leaving other publishers out", async () => {
    const ctx = context(fixtures, NOW);
    const data = await comics('key').load(ctx);
    assert.deepEqual(data.week, { from: '2026-11-02', to: '2026-11-08' });
    assert.deepEqual(titles(data.groups), [
      ['DC', ['Ace of Wings #11', 'Ace of Wings #12', 'Night Desk #27']],
      ['Image', ['Lake Effect #3', 'Sector Nine #1']],
      ['Marvel', ['Pine Barrens #1']],
    ]);
    assert.equal(data.groups[1]?.comics[1]?.name, 'Boot Sequence');
    assert.deepEqual(ctx.problems, []);
  });

  it('asks for the week by store date, and for the volumes it needs, with the key', async () => {
    const asked: Upstream[] = [];
    const recording: Fetcher = {
      json: (upstream) => {
        asked.push(upstream);
        return fixtures.json(upstream);
      },
      text: fixtures.text,
    };
    await comics('cv-key').load(context(recording, NOW));
    const [issues, volumes] = asked.map((upstream) => new URL(upstream.url));
    assert.equal(asked.length, 2);
    assert.equal(issues?.pathname, '/api/issues/');
    assert.equal(issues?.searchParams.get('api_key'), 'cv-key');
    assert.equal(issues?.searchParams.get('filter'), 'store_date:2026-11-02|2026-11-08');
    assert.equal(volumes?.pathname, '/api/volumes/');
    assert.equal(
      volumes?.searchParams.get('filter'),
      'id:190001|190002|190003|190004|190005|190006',
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
