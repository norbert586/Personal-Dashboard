import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { context, fixture, fixtures, outage, readLive } from './testing.ts';
import { activity, parseEvents, repoKey, titlesByRepo, WINDOW_DAYS } from './activity.ts';
import type { Fetcher } from '../fetcher.ts';

// 23:30 on Sunday 8 November 2026 in Detroit.
const NOW = new Date('2026-11-09T04:30:00Z');
const TITLES = titlesByRepo([
  { title: 'Ratiu Twp', repo: 'https://github.com/norbert586/Personal-Dashboard' },
  { title: 'Crossbell Vending', repo: 'https://github.com/norbert586/crossbell-vending' },
  { title: 'Unlinked' },
]);

describe('activity: saved sample', () => {
  it('counts pushes per repo over the last two weeks, named after their projects', async () => {
    const events = (await fixture('github-events.json')) as unknown[];
    const data = parseEvents(events, NOW, TITLES);
    assert.deepEqual(
      data.repos.map((repo) => [repo.name, repo.pushes, repo.days]),
      [
        ['Ratiu Twp', 7, ['2026-11-08', '2026-11-07']],
        ['Crossbell Vending', 1, ['2026-11-05']],
      ],
    );
    // Tetris Plus last got a push on 24 October, before the window.
    assert.equal(data.repos[0]?.url, 'https://github.com/norbert586/Personal-Dashboard');
    assert.equal(data.repos[0]?.lastPush.toISOString(), '2026-11-09T04:04:26.000Z');
    assert.deepEqual(data.newRepos, []); // a new branch isn't a new repo
  });

  it("dates pushes by Detroit's calendar: Sunday evening isn't Monday", async () => {
    const data = parseEvents((await fixture('github-events.json')) as unknown[], NOW, TITLES);
    assert.equal(data.days.length, WINDOW_DAYS);
    assert.deepEqual(data.days.at(-1), { date: '2026-11-08', pushes: 6 });
    assert.deepEqual(data.days.at(-2), { date: '2026-11-07', pushes: 1 });
    assert.equal(data.days[0]?.date, '2026-10-26');
    assert.equal(
      data.days.reduce((sum, day) => sum + day.pushes, 0),
      8,
    );
  });

  it('loads through the fetcher, and uses repo names without project titles', async () => {
    const data = await activity('norbert586').load(context(fixtures, NOW));
    assert.equal(data.repos[0]?.name, 'Personal-Dashboard');
  });
});

describe('activity: events', () => {
  const event = (id: string, type: string, created_at: string, payload: object = {}) => ({
    id,
    type,
    repo: { name: 'norbert586/new-thing' },
    payload,
    created_at,
  });

  it('finds repos created in the last 30 days', () => {
    const data = parseEvents(
      [
        event('3', 'CreateEvent', '2026-11-06T12:00:00Z', {
          ref_type: 'repository',
          description: 'A new thing',
        }),
        event('2', 'CreateEvent', '2026-09-01T12:00:00Z', { ref_type: 'repository' }),
        event('1', 'CreateEvent', '2026-11-07T12:00:00Z', { ref_type: 'branch' }),
      ],
      NOW,
    );
    assert.deepEqual(data.newRepos, [
      {
        repo: 'norbert586/new-thing',
        name: 'new-thing',
        url: 'https://github.com/norbert586/new-thing',
        created: new Date('2026-11-06T12:00:00Z'),
        description: 'A new thing',
      },
    ]);
  });

  it('counts an event once even when pages overlap, and ignores ones from the future', () => {
    const push = event('9', 'PushEvent', '2026-11-08T20:00:00Z');
    const data = parseEvents([push, push, event('10', 'PushEvent', '2026-11-09T06:00:00Z')], NOW);
    assert.equal(data.repos[0]?.pushes, 1);
  });

  it('reads repo keys from project links', () => {
    assert.equal(repoKey('https://github.com/norbert586/Tetris-Plus'), 'norbert586/tetris-plus');
    assert.equal(repoKey('https://github.com/norbert586/overhead.git'), 'norbert586/overhead');
    assert.equal(repoKey('https://example.com/norbert586/x'), undefined);
  });
});

describe('activity: when GitHub is unreachable', () => {
  it('is offline with the reason', async () => {
    const reading = await readLive(activity(), outage('GitHub refused the request (403).'), NOW);
    assert.equal(reading.provenance, 'offline');
    assert.equal(reading.detail, 'GitHub refused the request (403).');
    assert.deepEqual(reading.data.repos, []);
  });

  it("refuses an answer that isn't a list of events", async () => {
    const fetcher: Fetcher = { json: async () => ({ message: 'Not Found' }), text: async () => '' };
    const reading = await readLive(activity(), fetcher, NOW);
    assert.equal(reading.provenance, 'offline');
    assert.equal(reading.detail, "GitHub didn't send a list of events.");
  });
});
