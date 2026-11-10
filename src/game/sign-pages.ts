/**
 * What the town's boards say (SPEC: Feeds in town): the cinema marquee, the comic shop's board and
 * the sports bar's scoreboard. Pure: a feed's reading in, pages of two short lines out, plus a
 * status strip that says where the data came from, as the Today panel's cards do (SPEC: Data
 * rules). Boards are narrow, so a long title carries on to the next page.
 */
import type { Provenance } from '../lib/readings.ts';
import type { Comics } from '../lib/sources/comics.ts';
import type { Movies } from '../lib/sources/movies.ts';
import type { Game, TeamScores } from '../lib/sources/scores.ts';
import { calendarDaysBetween, formatTime, formatWeekday } from '../lib/time.ts';
import { site } from '../site.config.ts';
import type { Wire, WireReading } from './feeds.ts';
import { hasGlyph } from './world/painters.ts';

/** Characters across a board. */
export const COLS = 12;
/** Seconds a page stays up. */
export const PAGE_SECONDS = 3.6;

export type Tone = 'plain' | 'hot' | 'good' | 'bad' | 'dim';
export interface SignPage {
  lines: [string, string];
  tones?: [Tone, Tone];
}
export interface SignContent {
  /** Where the data came from; `loading` until the town has heard from its server. */
  state: Provenance | 'loading';
  /** The status strip: "LIVE 22:58", "SAMPLE DATA", "OFFLINE". */
  status: string;
  pages: SignPage[];
  /** For a shop window's shelves: one entry per item, the index of its group (publisher). */
  covers?: number[];
}

/** Text in the sign font: capitals, no accents, and only the characters it can draw. */
export function signText(text: string): string {
  const plain = text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toUpperCase()
    .replace(/[‘’`]/g, "'")
    .replace(/[–—]/g, '-');
  let out = '';
  for (const ch of plain) out += hasGlyph(ch) ? ch : ' ';
  return out.replace(/\s+/g, ' ').trim();
}

/** Greedy word wrap into at most `rows` lines; a word longer than a line is cut. */
export function wrap(text: string, cols = COLS, rows = 2): string[] {
  const out: string[] = [];
  let line = '';
  for (const word of text.split(' ').filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (next.length <= cols) {
      line = next;
      continue;
    }
    if (line) out.push(line);
    line = word.slice(0, cols);
    if (out.length >= rows) break;
  }
  if (line && out.length < rows) out.push(line);
  return out;
}

const page = (a = '', b = '', tones?: [Tone, Tone]): SignPage =>
  tones ? { lines: [a, b], tones } : { lines: [a, b] };

/**
 * A title as pages of two lines: a long one carries on to the next page rather than being cut.
 * When the last page has a line to spare, `tail` goes there, dimmed (a rating, a publisher).
 */
function titlePages(title: string, tail = ''): SignPage[] {
  const lines = wrap(signText(title), COLS, 6);
  const pages: SignPage[] = [];
  for (let i = 0; i < lines.length; i += 2) {
    const second = lines[i + 1];
    pages.push(
      page(lines[i], second ?? signText(tail), ['plain', second === undefined ? 'dim' : 'plain']),
    );
  }
  return pages;
}

/** The first candidate that fits the board, or the last one cut short. */
const fit = (...candidates: string[]): string =>
  candidates.find((c) => c.length <= COLS) ?? (candidates.at(-1) ?? '').slice(0, COLS);

/** A reading as a board: its pages when there's data, and a dark board that says so when not. */
export function signContent<T>(
  reading: WireReading<T> | undefined,
  pages: (reading: WireReading<T>) => SignPage[],
  /** The town couldn't reach its own server, so there's no reading at all. */
  unreachable = false,
): SignContent {
  if (!reading && !unreachable)
    return { state: 'loading', status: 'TUNING IN', pages: [page('ONE MOMENT')] };
  if (!reading || reading.provenance === 'offline')
    return { state: 'offline', status: 'OFFLINE', pages: [page('NO SIGNAL', 'ASK INSIDE')] };
  const status =
    reading.provenance === 'sample'
      ? 'SAMPLE DATA'
      : `${reading.provenance === 'local' ? 'LOCAL' : 'LIVE'} ${formatTime(new Date(reading.fetchedAt))}`;
  return { state: reading.provenance, status, pages: pages(reading) };
}

/** The cinema marquee: what's playing, most popular first, with the rating when there's room. */
export function moviePages(reading: WireReading<Movies>, limit = 6): SignPage[] {
  const pages = reading.data.movies
    .slice(0, limit)
    .flatMap((movie) => titlePages(movie.title, movie.rating));
  return pages.length ? pages : [page('NO FILMS', 'LISTED')];
}

/** The comic shop's board: how many books this week, then a few from each publisher. */
export function comicPages(reading: WireReading<Comics>, perPublisher = 3): SignPage[] {
  const { groups, current } = reading.data;
  const total = groups.reduce((sum, group) => sum + group.comics.length, 0);
  if (total === 0) return [page('NO NEW BOOKS', 'THIS WEEK')];
  const books = `${total} ${total === 1 ? 'BOOK' : 'BOOKS'}`;
  const pages = [
    current
      ? page('NEW COMICS', fit(`${total} THIS WEEK`, books), ['hot', 'plain'])
      : page('LAST WEEK', books, ['hot', 'plain']),
  ];
  for (const group of groups)
    for (const comic of group.comics.slice(0, perPublisher))
      pages.push(...titlePages(comic.title, group.publisher));
  return pages;
}

/**
 * The comic shop's window: one cover per book, dealt a publisher at a time so a small window
 * still shows every publisher. Each entry is the publisher's place in the feed's groups.
 */
export function comicCovers(reading: WireReading<Comics>): number[] {
  const left = reading.data.groups.map((group) => group.comics.length);
  const covers: number[] = [];
  while (left.some((n) => n > 0))
    left.forEach((n, i) => {
      if (n <= 0) return;
      covers.push(i);
      left[i] = n - 1;
    });
  return covers;
}

/** Board names for the teams (site.config.ts), by id. */
const SHORT = new Map(site.teams.map((team) => [team.id, signText(team.short ?? team.name)]));

/** "GB @LIONS": the visitors at the home team, as tickers write it. */
function matchup(us: string, game: Wire<Game>): string {
  const them = signText(game.opponent.abbreviation);
  if (game.neutral) return fit(`${us} VS ${them}`, `${us} V ${them}`, `${us}-${them}`);
  const [away, home] = game.home ? [them, us] : [us, them];
  return fit(`${away} @${home}`, `${away}@${home}`);
}

function dayWord(start: Date, now: Date): string {
  const days = calendarDaysBetween(now, start);
  if (days === 0) return 'TODAY';
  if (days === 1) return 'TMRW';
  if (days === -1) return 'YDAY';
  return signText(formatWeekday(start));
}

/**
 * The sports bar's scoreboard: games on now first, then each team's last result and next game.
 * Scores read ours first, like the Today panel's.
 */
export function scorePages(reading: WireReading<TeamScores[]>, now: Date): SignPage[] {
  const live: SignPage[] = [];
  const rest: SignPage[] = [];
  for (const team of reading.data) {
    const us = SHORT.get(team.id) ?? signText(team.name);
    const score = (game: Wire<Game>) => (game.score ? `${game.score.us}-${game.score.them}` : '');
    if (team.live)
      live.push(page(matchup(us, team.live), fit(`LIVE ${score(team.live)}`), ['plain', 'hot']));
    if (team.last) {
      const game = team.last;
      const result = game.result ?? 'F';
      const extra = game.status.startsWith('Final/') ? ` ${signText(game.status.slice(6))}` : '';
      const base = `${result} ${score(game)}`;
      const day = dayWord(new Date(game.start), now);
      rest.push(
        page(matchup(us, game), fit(`${base}${extra} ${day}`, `${base}${extra}`, base), [
          'plain',
          result === 'W' ? 'good' : result === 'L' ? 'bad' : 'plain',
        ]),
      );
    }
    if (team.next) {
      const game = team.next;
      const start = new Date(game.start);
      const day = dayWord(start, now);
      const time = game.timeKnown ? formatTime(start) : 'TBD';
      rest.push(page(matchup(us, game), fit(`${day} ${time}`, day), ['plain', 'dim']));
    }
  }
  const pages = [...live, ...rest];
  return pages.length ? pages : [page('NO GAMES', 'RIGHT NOW')];
}
