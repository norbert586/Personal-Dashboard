import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { context, fixture, fixtures, outage, readLive } from './testing.ts';
import {
  parseEspnEvent,
  parseEspnTeam,
  scores,
  summarize,
  type Game,
  type TeamScores,
} from './scores.ts';
import type { Fetcher } from '../fetcher.ts';
import { site, type Team } from '../../site.config.ts';

// The saved samples were captured late on Sunday 8 November 2026, Detroit time.
const NOW = new Date('2026-11-09T04:30:00Z');

const byId = (teams: TeamScores[], id: string) => {
  const team = teams.find((entry) => entry.id === id);
  assert.ok(team, `no ${id}`);
  return team;
};
const brief = (game: Game | undefined) =>
  game && {
    when: game.start.toISOString(),
    where: game.neutral ? 'neutral' : game.home ? 'home' : 'away',
    opponent: game.opponent.abbreviation,
    score: game.score,
    result: game.result,
  };

describe('scores: saved ESPN samples', () => {
  it('reads every team, with last results, next games and records', async () => {
    const ctx = context(fixtures, NOW);
    const teams = await scores().load(ctx);
    assert.deepEqual(
      teams.map((team) => team.name),
      site.teams.map((team) => team.name),
    );
    assert.deepEqual(ctx.problems, []);

    const lions = byId(teams, 'lions');
    assert.equal(lions.record, '6-2');
    assert.equal(lions.standing, '2nd in NFC North');
    assert.deepEqual(brief(lions.last), {
      when: '2026-11-08T18:00:00.000Z',
      where: 'away',
      opponent: 'MIA',
      score: { us: 19, them: 9 },
      result: 'W',
    });
    assert.equal(lions.last?.broadcast, 'CBS');
    // Next Sunday's 9:30 AM game is abroad: ESPN lists Detroit at home on a neutral site.
    assert.deepEqual(brief(lions.next), {
      when: '2026-11-15T14:30:00.000Z',
      where: 'neutral',
      opponent: 'NE',
      score: undefined,
      result: undefined,
    });
    assert.equal(lions.offseason, false);

    const wings = byId(teams, 'red-wings');
    assert.equal(wings.record, '7-8-3');
    assert.deepEqual(brief(wings.last)?.score, { us: 0, them: 4 });
    assert.equal(wings.last?.result, 'L');
    assert.equal(wings.next?.broadcast, 'TNT, truTV');
  });

  it("knows the Tigers' offseason and keeps last season's record", async () => {
    const teams = await scores().load(context(fixtures, NOW));
    const tigers = byId(teams, 'tigers');
    assert.equal(tigers.offseason, true);
    assert.equal(tigers.last, undefined);
    // The schedule restarts at 0-0; the team endpoint still has 2026's record.
    assert.equal(tigers.record, '76-86');
    assert.equal(tigers.next?.stage, 'Spring Training');
    assert.equal(tigers.next?.timeKnown, false);
    assert.equal(tigers.via, undefined);
  });

  it('reads a live game, with its score, from the team endpoint', async () => {
    const { game } = parseEspnTeam(await fixture('espn-live-team.json'), '27');
    assert.equal(game?.state, 'live');
    assert.equal(game?.status, '6:54 - 4th');
    assert.deepEqual(game?.score, { us: 16, them: 24 });
    assert.equal(game?.result, undefined);
    assert.equal(game?.opponent.name, 'Chicago Bears');
    assert.equal(game?.broadcast, 'NBC');
  });

  it("prefers the team endpoint's live copy of a game over the schedule's", async () => {
    // The schedule shows a live game without its score; the team endpoint has the score.
    const live = (await fixture('espn-live-team.json')) as {
      team: { nextEvent: Array<Record<string, unknown>> };
    };
    const event = structuredClone(live.team.nextEvent[0]!);
    const competition = (event.competitions as Array<Record<string, unknown>>)[0]!;
    for (const side of competition.competitors as Array<Record<string, unknown>>) side.score = null;
    const fetcher: Fetcher = {
      json: async (upstream) => (upstream.url.endsWith('/schedule') ? { events: [event] } : live),
      text: async () => '',
    };
    const bucs: Team = {
      id: 'bucs',
      name: 'Buccaneers',
      league: 'NFL',
      espn: { sport: 'football', league: 'nfl', team: '27' },
    };
    const [team] = await scores([bucs]).load(context(fetcher, NOW));
    assert.deepEqual(team?.live?.score, { us: 16, them: 24 });
    assert.equal(team?.next, undefined);
  });
});

describe('scores: the leagues back up ESPN', () => {
  const espnDown = outage('ESPN answered 503.', (upstream) => upstream.name === 'ESPN');

  it('asks the NHL for the Red Wings', async () => {
    const teams = await scores().load(context(espnDown, NOW));
    const wings = byId(teams, 'red-wings');
    assert.equal(wings.via, 'NHL');
    assert.equal(wings.problem, undefined);
    assert.deepEqual(brief(wings.last), {
      when: '2026-11-08T02:00:00.000Z',
      where: 'away',
      opponent: 'COL',
      score: { us: 0, them: 4 },
      result: 'L',
    });
    assert.equal(wings.last?.opponent.name, 'Colorado Avalanche');
    assert.equal(wings.next?.opponent.abbreviation, 'STL');
  });

  it('asks MLB for the Tigers, offseason and all', async () => {
    const teams = await scores().load(context(espnDown, NOW));
    const tigers = byId(teams, 'tigers');
    assert.equal(tigers.via, 'MLB');
    assert.equal(tigers.offseason, true);
    assert.deepEqual(brief(tigers.last), {
      when: '2026-09-27T19:10:00.000Z',
      where: 'home',
      opponent: 'PIT',
      score: { us: 2, them: 4 },
      result: 'L',
    });
    assert.equal(tigers.next?.start.toISOString(), '2027-03-25T07:33:00.000Z');
    assert.equal(tigers.next?.timeKnown, false);
  });

  it('says which teams are missing and keeps the rest', async () => {
    const ctx = context(espnDown, NOW);
    const teams = await scores().load(ctx);
    const lions = byId(teams, 'lions');
    assert.equal(lions.problem, 'ESPN answered 503.');
    assert.equal(lions.last, undefined);
    assert.ok(ctx.problems.includes('Lions: ESPN answered 503.'));
    assert.ok(!ctx.problems.some((message) => message.startsWith('Red Wings')));
  });

  it('is offline when no team can be loaded', async () => {
    const reading = await readLive(scores(), outage("Couldn't reach ESPN (ENOTFOUND)."), NOW);
    assert.equal(reading.provenance, 'offline');
    assert.equal(reading.detail, "Couldn't reach ESPN (ENOTFOUND).");
    assert.deepEqual(reading.data, []);
  });
});

describe('scores: games and results', () => {
  const event = (
    state: string,
    description: string,
    ours: unknown,
    theirs: unknown,
    winner?: 'ours' | 'theirs',
  ) => ({
    id: '1',
    date: '2026-11-01T18:00Z',
    seasonType: { type: 2, name: 'Regular Season' },
    competitions: [
      {
        date: '2026-11-01T18:00Z',
        status: { type: { state, description, shortDetail: description } },
        competitors: [
          { id: '8', homeAway: 'home', winner: winner === 'ours', score: ours, team: { id: '8' } },
          {
            id: '9',
            homeAway: 'away',
            winner: winner === 'theirs',
            score: theirs,
            team: { id: '9', abbreviation: 'GB', displayName: 'Green Bay Packers' },
          },
        ],
      },
    ],
  });

  it('calls a final with no winner and level scores a tie', () => {
    const game = parseEspnEvent(event('post', 'Final/OT', '20', '20'), '8');
    assert.equal(game?.result, 'T');
    assert.equal(game?.status, 'Final/OT');
  });

  it('reads string scores from scoreboards as well as score objects', () => {
    const game = parseEspnEvent(event('post', 'Final', '27', { value: 20 }, 'ours'), '8');
    assert.deepEqual(game?.score, { us: 27, them: 20 });
    assert.equal(game?.result, 'W');
  });

  it('marks postponed games off, and skips them as last or next', () => {
    const game = parseEspnEvent(event('post', 'Postponed', null, null), '8');
    assert.equal(game?.state, 'off');
    assert.ok(game);
    assert.deepEqual(summarize([game], NOW), {
      last: undefined,
      live: undefined,
      next: undefined,
      offseason: true,
    });
  });

  it("ignores events that aren't our team's", () => {
    assert.equal(parseEspnEvent(event('pre', 'Scheduled', null, null), '99'), undefined);
  });

  it('keeps a game as next for a while after its start, in case it starts late', () => {
    const game = parseEspnEvent(event('pre', 'Scheduled', null, null), '8')!;
    const justAfter = new Date(game.start.getTime() + 60 * 60_000);
    assert.equal(summarize([game], justAfter).next, game);
    const muchLater = new Date(game.start.getTime() + 4 * 60 * 60_000);
    assert.equal(summarize([game], muchLater).next, undefined);
  });
});
