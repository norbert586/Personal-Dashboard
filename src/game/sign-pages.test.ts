import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Comics } from '../lib/sources/comics.ts';
import type { Movies } from '../lib/sources/movies.ts';
import type { Game, TeamScores } from '../lib/sources/scores.ts';
import type { Wire, WireReading } from './feeds.ts';
import {
  COLS,
  comicPages,
  moviePages,
  scorePages,
  signContent,
  signText,
  wrap,
} from './sign-pages.ts';

const reading = <T>(data: T, provenance: 'live' | 'sample' | 'offline' = 'live') =>
  ({
    source: 'Test',
    provenance,
    fetchedAt: '2026-11-10T03:58:00.000Z', // 22:58 in Detroit
    data,
  }) as WireReading<T>;

const film = (title: string, rating?: string) => ({
  id: 1,
  title,
  rating,
  opened: '2026-10-23',
  url: 'https://www.themoviedb.org/movie/1',
});
const movies = (...films: ReturnType<typeof film>[]): Movies => ({
  movies: films,
  showtimes: { theatre: 'Emagine Macomb', url: 'https://example.com/' },
});

test('sign text is capitals the sign font can draw', () => {
  assert.equal(signText('Beware Boiúna'), 'BEWARE BOIUNA');
  assert.equal(signText('Batman #15 — “Hush”'), 'BATMAN #15 - HUSH');
  assert.equal(signText('  Tom & Jerry’s  '), "TOM & JERRY'S");
});

test('text wraps by the word and drops what does not fit', () => {
  assert.deepEqual(wrap('GODZILLA MINUS ZERO'), ['GODZILLA', 'MINUS ZERO']);
  assert.deepEqual(wrap('ABSOLUTE WONDER WOMAN #14'), ['ABSOLUTE', 'WONDER WOMAN']);
  assert.deepEqual(wrap('SUPERCALIFRAGILISTIC'), ['SUPERCALIFRA']);
  assert.deepEqual(wrap(''), []);
});

test('the marquee lists films with a rating when there is room', () => {
  const pages = moviePages(
    reading(
      movies(
        film('Wildwood', 'PG-13'),
        film('Godzilla Minus Zero', 'R'),
        film('Ramayana: Rise of a Legend', 'PG-13'),
      ),
    ),
  );
  assert.deepEqual(
    pages.map((p) => p.lines),
    [
      ['WILDWOOD', 'PG-13'],
      ['GODZILLA', 'MINUS ZERO'],
      ['RAMAYANA', 'PG-13'], // too long whole, so the part before the colon
    ],
  );
  for (const p of pages) for (const line of p.lines) assert.ok(line.length <= COLS, line);
  assert.deepEqual(moviePages(reading(movies()))[0]!.lines, ['NO FILMS', 'LISTED']);
});

test('a board says where its data came from, and goes dark when offline', () => {
  const live = signContent(reading(movies(film('Wildwood'))), moviePages);
  assert.equal(live.state, 'live');
  assert.equal(live.status, 'LIVE 22:58');

  const sample = signContent(reading(movies(film('Wildwood')), 'sample'), moviePages);
  assert.equal(sample.status, 'SAMPLE DATA');
  assert.equal(sample.pages[0]!.lines[0], 'WILDWOOD');

  const offline = signContent(reading(movies(), 'offline'), moviePages);
  assert.deepEqual([offline.state, offline.status], ['offline', 'OFFLINE']);
  assert.deepEqual(offline.pages[0]!.lines, ['NO SIGNAL', 'ASK INSIDE']);

  assert.equal(signContent(undefined, moviePages).state, 'loading');
  assert.equal(signContent(undefined, moviePages, true).state, 'offline');
});

test("the comic shop counts the week's books, then names a few from each publisher", () => {
  const comic = (title: string) => ({
    id: 1,
    title,
    name: undefined,
    storeDate: '2026-11-04',
    url: 'https://comicvine.gamespot.com/',
  });
  const data: Comics = {
    week: { from: '2026-11-02', to: '2026-11-08' },
    current: true,
    groups: [
      { publisher: 'DC', comics: [comic('Batman #15'), comic('Absolute Wonder Woman #14')] },
      { publisher: 'Image', comics: [comic('Lake Effect #3')] },
    ],
  };
  const pages = comicPages(reading(data));
  assert.deepEqual(
    pages.map((p) => p.lines),
    [
      ['NEW COMICS', '3 THIS WEEK'],
      ['BATMAN #15', 'DC'],
      ['ABSOLUTE', 'WONDER WOMAN'],
      ['LAKE EFFECT', '#3'],
    ],
  );
  assert.deepEqual(comicPages(reading({ ...data, current: false }))[0]!.lines, [
    'LAST WEEK',
    '3 BOOKS',
  ]);
  assert.deepEqual(comicPages(reading({ ...data, groups: [] }))[0]!.lines, [
    'NO NEW BOOKS',
    'THIS WEEK',
  ]);
});

test('the scoreboard shows live games first, then last results and next games', () => {
  const now = new Date('2026-11-10T03:58:00.000Z'); // Monday evening in Detroit
  const game = (over: Partial<Wire<Game>>): Wire<Game> => ({
    id: '1',
    start: '2026-11-08T18:00:00.000Z',
    timeKnown: true,
    state: 'final',
    status: 'Final',
    home: false,
    neutral: false,
    opponent: { abbreviation: 'MIA', name: 'Miami Dolphins' },
    score: undefined,
    result: undefined,
    broadcast: undefined,
    stage: undefined,
    ...over,
  });
  const team = (id: string, name: string, over: Partial<Wire<TeamScores>>): Wire<TeamScores> => ({
    id,
    name,
    league: 'NFL',
    record: undefined,
    standing: undefined,
    last: undefined,
    live: undefined,
    next: undefined,
    offseason: false,
    via: undefined,
    problem: undefined,
    ...over,
  });
  const pages = scorePages(
    reading([
      team('lions', 'Lions', {
        last: game({ result: 'W', score: { us: 19, them: 9 } }),
        next: game({
          state: 'pre',
          home: true,
          start: '2026-11-15T18:00:00.000Z',
          opponent: { abbreviation: 'GB', name: 'Green Bay Packers' },
        }),
      }),
      team('red-wings', 'Red Wings', {
        live: game({
          state: 'live',
          status: '6:54 - 3rd',
          home: true,
          opponent: { abbreviation: 'TOR', name: 'Toronto Maple Leafs' },
          score: { us: 2, them: 1 },
        }),
        last: game({
          result: 'L',
          status: 'Final/OT',
          score: { us: 3, them: 4 },
          opponent: { abbreviation: 'BOS', name: 'Boston Bruins' },
        }),
      }),
      team('michigan-basketball', 'Michigan basketball', {
        next: game({
          state: 'pre',
          timeKnown: false,
          start: '2026-11-10T23:00:00.000Z',
          opponent: { abbreviation: 'UCLA', name: 'UCLA Bruins' },
        }),
      }),
      team('tigers', 'Tigers', { offseason: true }),
    ]),
    now,
  );
  assert.deepEqual(
    pages.map((p) => p.lines),
    [
      ['TOR @WINGS', 'LIVE 2-1'],
      ['LIONS @MIA', 'W 19-9 YDAY'],
      ['GB @LIONS', 'SUN 13:00'],
      ['WINGS @BOS', 'L 3-4 OT'], // no room for the day
      ['MICH BB@UCLA', 'TMRW TBD'],
    ],
  );
  assert.equal(pages[0]!.tones?.[1], 'hot');
  assert.equal(pages[1]!.tones?.[1], 'good');
  assert.equal(pages[3]!.tones?.[1], 'bad');
  for (const p of pages) for (const line of p.lines) assert.ok(line.length <= COLS, line);
  assert.deepEqual(scorePages(reading([]), now)[0]!.lines, ['NO GAMES', 'RIGHT NOW']);
});
