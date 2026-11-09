/**
 * Scores and schedules for the teams in site.config.ts, from ESPN's public JSON (free, no key,
 * undocumented; ADR-015). The NHL's and MLB's own APIs stand in for the Red Wings and the Tigers
 * when ESPN can't answer or has no games for them.
 *
 * ESPN's team endpoint is small and carries a live game's score; its schedule is big and shows a
 * live game without the score, but it's the only place with the last result. So the team endpoint
 * is asked every couple of minutes and the schedule once an hour.
 */
import type { Fetcher, Upstream } from '../fetcher.ts';
import { date, field, list, num, str } from '../json.ts';
import type { Source } from '../readings.ts';
import { isoDate } from '../time.ts';
import { site, type Team } from '../../site.config.ts';

/** `off` is a game that won't be played as scheduled: postponed, suspended or canceled. */
export type GameState = 'pre' | 'live' | 'final' | 'off';

export interface Game {
  id: string;
  start: Date;
  /** False until the start time is set (TBD): show the date only. */
  timeKnown: boolean;
  state: GameState;
  /** In the league's words: "Final/OT", "6:54 - 4th", "Postponed". */
  status: string;
  /** Our team is the home team. */
  home: boolean;
  /** At neither team's ground, like an international game. */
  neutral: boolean;
  opponent: { abbreviation: string; name: string };
  /** Once the game has started. */
  score: { us: number; them: number } | undefined;
  /** Once it's final. */
  result: 'W' | 'L' | 'T' | undefined;
  /** National or local TV: "Fox", "TNT, truTV". */
  broadcast: string | undefined;
  /** When it isn't the regular season: "Spring Training", "Postseason". */
  stage: string | undefined;
}

export interface TeamScores {
  id: string;
  name: string;
  league: string;
  record: string | undefined;
  /** "2nd in NFC North" */
  standing: string | undefined;
  last: Game | undefined;
  live: Game | undefined;
  next: Game | undefined;
  /** No game within three weeks either side. */
  offseason: boolean;
  /** Who answered, when it wasn't ESPN: "NHL", "MLB". */
  via: string | undefined;
  /** Why there's nothing to show for this team. */
  problem: string | undefined;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
/** A scheduled game still counts as next this long after its start, in case it starts late. */
const LATE_START = 3 * HOUR;
const OFFSEASON_GAP = 21 * DAY;

export function scores(teams: readonly Team[] = site.teams): Source<TeamScores[]> {
  return {
    name: 'ESPN',
    empty: [],
    async load({ fetcher, now, problem }) {
      const results = await Promise.all(teams.map((team) => loadTeam(team, fetcher, now)));
      const failed = results.filter((result) => result.problem !== undefined);
      if (results.length > 0 && failed.length === results.length) {
        throw new Error(failed[0]!.problem);
      }
      for (const result of failed) problem(`${result.name}: ${result.problem}`);
      return results;
    },
  };
}

function espn(team: Team, path: '' | '/schedule', ttl: number): Upstream {
  const { sport, league, team: id } = team.espn;
  return {
    name: 'ESPN',
    url: `https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${id}${path}`,
    ttl,
    sample: `espn-${team.id}-${path === '' ? 'team' : 'schedule'}.json`,
  };
}

async function loadTeam(team: Team, fetcher: Fetcher, now: Date): Promise<TeamScores> {
  const [teamAnswer, scheduleAnswer] = await Promise.allSettled([
    fetcher.json(espn(team, '', 2 * MINUTE)),
    fetcher.json(espn(team, '/schedule', HOUR)),
  ]);
  const current =
    teamAnswer.status === 'fulfilled' ? parseEspnTeam(teamAnswer.value, team.espn.team) : undefined;
  const schedule =
    scheduleAnswer.status === 'fulfilled'
      ? parseEspnSchedule(scheduleAnswer.value, team.espn.team)
      : undefined;
  const games = mergeGames(schedule?.games ?? [], current?.game);
  // Between seasons the schedule restarts at "0-0" while the team endpoint keeps last season's.
  const blank = (record: string | undefined) =>
    record && /^0(-0)+$/.test(record) ? undefined : record;
  const record = blank(schedule?.record) ?? current?.record;
  const standing = schedule?.standing ?? current?.standing;
  const base = { id: team.id, name: team.name, league: team.league, record, standing };
  const espnAnswered = current !== undefined || schedule !== undefined;

  if (games.length === 0 && team.backup) {
    try {
      const backup = await loadBackup(team, team.backup, fetcher, now);
      if (backup.games.length > 0) {
        return { ...base, ...summarize(backup.games, now), via: backup.via, problem: undefined };
      }
    } catch {
      // Fall through: ESPN's answer (or ESPN's failure) is what we report.
    }
  }
  if (!espnAnswered) {
    const failure = teamAnswer.status === 'rejected' ? teamAnswer.reason : undefined;
    return {
      ...base,
      ...summarize([], now),
      via: undefined,
      problem: failure instanceof Error ? failure.message : "Couldn't reach ESPN.",
    };
  }
  return { ...base, ...summarize(games, now), via: undefined, problem: undefined };
}

/** The schedule's games, with the team endpoint's fresher copy of the current game. */
function mergeGames(games: readonly Game[], current: Game | undefined): Game[] {
  const merged = current
    ? [...games.filter((game) => game.id !== current.id), current]
    : [...games];
  return merged.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** The last result, the live game and the next one, relative to now. */
export function summarize(
  games: readonly Game[],
  now: Date,
): Pick<TeamScores, 'last' | 'live' | 'next' | 'offseason'> {
  const sorted = [...games].sort((a, b) => a.start.getTime() - b.start.getTime());
  const live = sorted.find((game) => game.state === 'live');
  const last = sorted.filter((game) => game.state === 'final' && game.start <= now).at(-1);
  const next = sorted.find(
    (game) => game.state === 'pre' && game.start.getTime() > now.getTime() - LATE_START,
  );
  const quietBefore = !last || now.getTime() - last.start.getTime() > OFFSEASON_GAP;
  const quietAfter = !next || next.start.getTime() - now.getTime() > OFFSEASON_GAP;
  return { last, live, next, offseason: !live && quietBefore && quietAfter };
}

// ---- ESPN ----

export function parseEspnSchedule(json: unknown, teamId: string) {
  const games = list(field(json, 'events'))
    .map((event) => parseEspnEvent(event, teamId))
    .filter((game) => game !== undefined);
  return {
    games,
    record: str(field(json, 'team', 'recordSummary')),
    standing: str(field(json, 'team', 'standingSummary')),
  };
}

export function parseEspnTeam(json: unknown, teamId: string) {
  return {
    game: parseEspnEvent(field(json, 'team', 'nextEvent', 0), teamId),
    record: str(field(json, 'team', 'record', 'items', 0, 'summary')),
    standing: str(field(json, 'team', 'standingSummary')),
  };
}

/** One ESPN event, from our team's side. Undefined when it isn't one of our games. */
export function parseEspnEvent(event: unknown, teamId: string): Game | undefined {
  const competition = field(event, 'competitions', 0);
  const competitors = list(field(competition, 'competitors'));
  const ours = competitors.find(
    (side) => str(field(side, 'id')) === teamId || str(field(side, 'team', 'id')) === teamId,
  );
  const theirs = competitors.find((side) => side !== ours);
  const id = str(field(event, 'id'));
  const start = date(field(competition, 'date')) ?? date(field(event, 'date'));
  if (ours === undefined || theirs === undefined || id === undefined || start === undefined) {
    return undefined;
  }

  const type = field(competition, 'status', 'type');
  const espnState = str(field(type, 'state'));
  const description = str(field(type, 'description')) ?? '';
  const state: GameState = /postponed|canceled|cancelled|suspended|forfeit/i.test(description)
    ? 'off'
    : espnState === 'in'
      ? 'live'
      : espnState === 'post'
        ? 'final'
        : 'pre';

  const score = espnScore(ours, theirs, state);
  const stageType = num(field(event, 'seasonType', 'type'));
  const abbreviation = str(field(theirs, 'team', 'abbreviation')) ?? '?';
  return {
    id,
    start,
    timeKnown: field(competition, 'timeValid') !== false && field(event, 'timeValid') !== false,
    state,
    status: str(field(type, 'shortDetail')) ?? description,
    home: str(field(ours, 'homeAway')) === 'home',
    neutral: field(competition, 'neutralSite') === true,
    opponent: { abbreviation, name: str(field(theirs, 'team', 'displayName')) ?? abbreviation },
    score,
    result:
      state === 'final' && score
        ? field(ours, 'winner') === true
          ? 'W'
          : field(theirs, 'winner') === true
            ? 'L'
            : outcome(score)
        : undefined,
    broadcast: espnBroadcast(competition),
    stage:
      stageType !== undefined && stageType !== 2
        ? str(field(event, 'seasonType', 'name'))
        : undefined,
  };
}

function espnScore(ours: unknown, theirs: unknown, state: GameState): Game['score'] {
  if (state !== 'live' && state !== 'final') return undefined;
  // Schedules and the team endpoint send { value, displayValue }; scoreboards send a string.
  const read = (side: unknown) =>
    num(field(side, 'score', 'value')) ??
    num(field(side, 'score', 'displayValue')) ??
    num(field(side, 'score'));
  const us = read(ours);
  const them = read(theirs);
  return us === undefined || them === undefined ? undefined : { us, them };
}

function espnBroadcast(competition: unknown): string | undefined {
  const names = list(field(competition, 'broadcasts'))
    .filter((broadcast) => (str(field(broadcast, 'region')) ?? 'us') === 'us')
    .map((broadcast) => str(field(broadcast, 'media', 'shortName')))
    .filter((name) => name !== undefined);
  const unique = [...new Set(names)].slice(0, 2);
  return unique.length > 0 ? unique.join(', ') : undefined;
}

function outcome(score: { us: number; them: number }): Game['result'] {
  if (score.us > score.them) return 'W';
  if (score.us < score.them) return 'L';
  return 'T';
}

// ---- The leagues' own APIs, as backups ----

async function loadBackup(
  team: Team,
  backup: NonNullable<Team['backup']>,
  fetcher: Fetcher,
  now: Date,
): Promise<{ games: Game[]; via: string }> {
  const sample = `${backup.api}-${team.id}-schedule.json`;
  if (backup.api === 'nhl') {
    const json = await fetcher.json({
      name: 'the NHL',
      url: `https://api-web.nhle.com/v1/club-schedule-season/${backup.team}/now`,
      ttl: 10 * MINUTE,
      sample,
    });
    return { games: parseNhlSchedule(json, backup.team), via: 'NHL' };
  }
  const from = isoDate(new Date(now.getTime() - 90 * DAY));
  const to = isoDate(new Date(now.getTime() + 180 * DAY));
  const json = await fetcher.json({
    name: 'MLB',
    url:
      `https://statsapi.mlb.com/api/v1/schedule?sportId=1&teamId=${backup.team}` +
      `&startDate=${from}&endDate=${to}&gameType=R,F,D,L,W&hydrate=team`,
    ttl: 10 * MINUTE,
    sample,
  });
  return { games: parseMlbSchedule(json, backup.team), via: 'MLB' };
}

/** The NHL's club schedule (api-web.nhle.com), from our team's side. */
export function parseNhlSchedule(json: unknown, abbrev: string): Game[] {
  const games: Game[] = [];
  for (const raw of list(field(json, 'games'))) {
    const home = field(raw, 'homeTeam');
    const away = field(raw, 'awayTeam');
    const isHome = str(field(home, 'abbrev')) === abbrev;
    if (!isHome && str(field(away, 'abbrev')) !== abbrev) continue;
    const ours = isHome ? home : away;
    const theirs = isHome ? away : home;
    const id = num(field(raw, 'id'));
    const start = date(field(raw, 'startTimeUTC'));
    if (id === undefined || start === undefined) continue;

    const gameState = str(field(raw, 'gameState')) ?? '';
    const schedule = str(field(raw, 'gameScheduleState')) ?? 'OK';
    const state: GameState =
      schedule !== 'OK'
        ? 'off'
        : gameState === 'LIVE' || gameState === 'CRIT'
          ? 'live'
          : gameState === 'FINAL' || gameState === 'OFF'
            ? 'final'
            : 'pre';
    const us = num(field(ours, 'score'));
    const them = num(field(theirs, 'score'));
    const score =
      (state === 'live' || state === 'final') && us !== undefined && them !== undefined
        ? { us, them }
        : undefined;
    const period = str(field(raw, 'gameOutcome', 'lastPeriodType'));
    const abbreviation = str(field(theirs, 'abbrev')) ?? '?';
    const place = str(field(theirs, 'placeName', 'default'));
    const nickname = str(field(theirs, 'commonName', 'default'));
    const networks = list(field(raw, 'tvBroadcasts'))
      .filter((broadcast) => str(field(broadcast, 'countryCode')) === 'US')
      .map((broadcast) => str(field(broadcast, 'network')))
      .filter((network) => network !== undefined);
    const gameType = num(field(raw, 'gameType'));
    games.push({
      id: String(id),
      start,
      timeKnown: true,
      state,
      status:
        state === 'final'
          ? period && period !== 'REG'
            ? `Final/${period}`
            : 'Final'
          : state === 'live'
            ? 'Live'
            : state === 'off'
              ? 'Postponed'
              : '',
      home: isHome,
      neutral: field(raw, 'neutralSite') === true,
      opponent: {
        abbreviation,
        name: [place, nickname].filter((part) => part !== undefined).join(' ') || abbreviation,
      },
      score,
      result: state === 'final' && score ? outcome(score) : undefined,
      broadcast: networks.length > 0 ? [...new Set(networks)].slice(0, 2).join(', ') : undefined,
      stage: gameType === 1 ? 'Preseason' : gameType === 3 ? 'Playoffs' : undefined,
    });
  }
  return games.sort((a, b) => a.start.getTime() - b.start.getTime());
}

const MLB_POSTSEASON = new Set(['F', 'D', 'L', 'W']);

/** MLB's schedule (statsapi.mlb.com, hydrated with teams), from our team's side. */
export function parseMlbSchedule(json: unknown, teamId: number): Game[] {
  const games: Game[] = [];
  for (const day of list(field(json, 'dates'))) {
    for (const raw of list(field(day, 'games'))) {
      const home = field(raw, 'teams', 'home');
      const away = field(raw, 'teams', 'away');
      const isHome = num(field(home, 'team', 'id')) === teamId;
      if (!isHome && num(field(away, 'team', 'id')) !== teamId) continue;
      const ours = isHome ? home : away;
      const theirs = isHome ? away : home;
      const id = num(field(raw, 'gamePk'));
      const start = date(field(raw, 'gameDate'));
      if (id === undefined || start === undefined) continue;

      const abstract = str(field(raw, 'status', 'abstractGameState')) ?? '';
      const detailed = str(field(raw, 'status', 'detailedState')) ?? '';
      const state: GameState = /postponed|cancel|suspended/i.test(detailed)
        ? 'off'
        : abstract === 'Live'
          ? 'live'
          : abstract === 'Final'
            ? 'final'
            : 'pre';
      const us = num(field(ours, 'score'));
      const them = num(field(theirs, 'score'));
      const score =
        (state === 'live' || state === 'final') && us !== undefined && them !== undefined
          ? { us, them }
          : undefined;
      const abbreviation = str(field(theirs, 'team', 'abbreviation')) ?? '?';
      const gameType = str(field(raw, 'gameType')) ?? 'R';
      games.push({
        id: String(id),
        start,
        timeKnown: field(raw, 'status', 'startTimeTBD') !== true,
        state,
        status: state === 'pre' ? '' : detailed,
        home: isHome,
        neutral: false,
        opponent: { abbreviation, name: str(field(theirs, 'team', 'name')) ?? abbreviation },
        score,
        result:
          state === 'final' && score
            ? field(ours, 'isWinner') === true
              ? 'W'
              : field(theirs, 'isWinner') === true
                ? 'L'
                : outcome(score)
            : undefined,
        broadcast: undefined,
        stage: MLB_POSTSEASON.has(gameType)
          ? 'Postseason'
          : gameType === 'S'
            ? 'Spring Training'
            : undefined,
      });
    }
  }
  return games.sort((a, b) => a.start.getTime() - b.start.getTime());
}
