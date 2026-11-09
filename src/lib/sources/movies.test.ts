import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { context, fixtures, outage, readLive } from './testing.ts';
import { movies, parseNowPlaying, usRelease, SHOWTIMES } from './movies.ts';
import type { Fetcher, Upstream } from '../fetcher.ts';
import { readSource } from '../readings.ts';

const NOW = new Date('2026-11-09T04:30:00Z');

describe('movies: saved TMDB sample', () => {
  it("lists what's playing, most popular first, with US ratings and wide openings", async () => {
    const ctx = context(fixtures, NOW);
    const data = await movies('token').load(ctx);
    assert.equal(data.movies.length, 10);
    assert.deepEqual(data.movies[0], {
      id: 791523,
      title: 'Wildwood',
      rating: 'PG-13',
      opened: '2026-10-23',
      url: 'https://www.themoviedb.org/movie/791523',
    });
    assert.deepEqual(data.showtimes, SHOWTIMES);
    assert.deepEqual(ctx.problems, []);
  });

  it('dates a film by its wide opening, not an IMAX preview or a 4DX return', async () => {
    const data = await movies('token').load(context(fixtures, NOW));
    const opened = (title: string) => data.movies.find((movie) => movie.title === title)?.opened;
    assert.equal(opened('Godzilla Minus Zero'), '2026-11-06'); // IMAX from 3 November
    assert.equal(opened('Obsession'), '2026-05-15'); // back in 4DX on 14 October
  });

  it('sends the read token as a bearer token, and only to TMDB', async () => {
    const asked: Upstream[] = [];
    const recording: Fetcher = {
      json: (upstream) => {
        asked.push(upstream);
        return fixtures.json(upstream);
      },
      text: fixtures.text,
    };
    await movies('read-token').load(context(recording, NOW));
    assert.equal(asked.length, 11); // the list, then a rating for each of the top ten
    for (const upstream of asked) {
      assert.match(upstream.url, /^https:\/\/api\.themoviedb\.org\/3\//);
      assert.equal(upstream.headers?.authorization, 'Bearer read-token');
      assert.equal(upstream.keyed, true);
    }
  });
});

describe('movies: release dates', () => {
  const dates = (...releases: Array<[type: number, certification: string, date: string]>) => ({
    results: [
      {
        iso_3166_1: 'GB',
        release_dates: [{ type: 3, certification: '15', release_date: '2026-01-01T00:00:00.000Z' }],
      },
      {
        iso_3166_1: 'US',
        release_dates: releases.map(([type, certification, date]) => ({
          type,
          certification,
          release_date: `${date}T00:00:00.000Z`,
        })),
      },
    ],
  });

  it('keeps the first wide release for re-released films', () => {
    assert.deepEqual(
      usRelease(dates([2, 'PG', '2024-10-10'], [3, 'PG', '2026-10-02'], [3, 'PG', '1993-10-29'])),
      { rating: 'PG', opened: '1993-10-29' },
    );
  });

  it('falls back to a limited release, and ignores festival premieres', () => {
    assert.deepEqual(usRelease(dates([1, '', '2026-09-05'], [2, 'R', '2026-10-16'])), {
      rating: 'R',
      opened: '2026-10-16',
    });
    assert.deepEqual(usRelease(dates([1, '', '2026-09-05'])), {
      rating: undefined,
      opened: undefined,
    });
  });

  it('skips adult titles and entries without an id or title', () => {
    const films = parseNowPlaying({
      results: [
        { id: 1, title: 'Fine', popularity: 5 },
        { id: 2, title: 'Adult', adult: true, popularity: 99 },
        { title: 'No id', popularity: 50 },
        { id: 3, title: 'Popular', popularity: 10 },
      ],
    });
    assert.deepEqual(
      films.map((film) => film.title),
      ['Popular', 'Fine'],
    );
  });
});

describe('movies: keys and outages', () => {
  it('shows the saved sample, and what to add, without a token', async () => {
    const reading = await readSource(movies(undefined), {
      mode: 'live',
      live: () => {
        throw new Error('must not go live without a token');
      },
      sample: fixtures,
      now: NOW,
      sampleNow: NOW,
    });
    assert.equal(reading.provenance, 'sample');
    assert.match(reading.detail ?? '', /Add TMDB_READ_TOKEN/);
    assert.equal(reading.data.movies.length, 10);
  });

  it('treats an empty token, as left by .env.example, as missing', () => {
    assert.match(movies('  ').unconfigured ?? '', /Add TMDB_READ_TOKEN/);
    assert.equal(movies('token').unconfigured, undefined);
  });

  it('still lists films when some ratings are missing, and says so', async () => {
    const fetcher = outage('TMDB answered 503.', (upstream) =>
      upstream.url.includes('/release_dates'),
    );
    const ctx = context(fetcher, NOW);
    const data = await movies('token').load(ctx);
    assert.equal(data.movies.length, 10);
    assert.equal(data.movies[0]?.rating, undefined);
    assert.equal(data.movies[0]?.opened, '2026-10-23'); // from the list itself
    assert.equal(ctx.problems.length, 1);
  });

  it('is offline when TMDB refuses the key', async () => {
    const reading = await readLive(
      movies('wrong'),
      outage('TMDB refused the key (401). Check it in .env.'),
      NOW,
    );
    assert.equal(reading.provenance, 'offline');
    assert.equal(reading.detail, 'TMDB refused the key (401). Check it in .env.');
  });
});
