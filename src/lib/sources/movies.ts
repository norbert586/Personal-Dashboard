/**
 * What's playing in US theaters, from TMDB (a free key, ADR-015), with each film's US rating.
 * Emagine Macomb, the town's cinema, has no public API and blocks bots, so real showtimes are a
 * link to its own page. TMDB's terms ask for its notice in the credits.
 */
import type { Upstream } from '../fetcher.ts';
import { field, list, num, str } from '../json.ts';
import type { Source } from '../readings.ts';

export interface Movie {
  id: number;
  title: string;
  /** US rating: "PG-13". Undefined when TMDB doesn't have one. */
  rating: string | undefined;
  /** When it first opened wide in US theaters (YYYY-MM-DD). */
  opened: string | undefined;
  url: string;
}

export interface Movies {
  /** Most popular first. */
  movies: Movie[];
  showtimes: { theatre: string; url: string };
}

export const SHOWTIMES = {
  theatre: 'Emagine Macomb',
  url: 'https://emagine-entertainment.com/theatres/emagine-macomb/',
};

const API = 'https://api.themoviedb.org/3';
const HOUR = 60 * 60_000;
/** Films to look up a rating for: one request each, once a day. */
const TOP = 10;

/** TMDB's release types (https://developer.themoviedb.org/reference/movie-release-dates). */
const LIMITED = 2;
const THEATRICAL = 3;

export function movies(token: string | undefined): Source<Movies> {
  return {
    name: 'TMDB',
    empty: { movies: [], showtimes: SHOWTIMES },
    unconfigured: !token?.trim()
      ? "Add TMDB_READ_TOKEN (TMDB's API Read Access Token) to .env to show what's playing."
      : undefined,
    async load({ fetcher, problem }) {
      const tmdb = (path: string, ttl: number, sample: string): Upstream => ({
        name: 'TMDB',
        url: `${API}${path}`,
        ttl,
        sample,
        headers: { authorization: `Bearer ${token ?? ''}` },
        keyed: true,
      });
      const nowPlaying = await fetcher.json(
        tmdb(
          '/movie/now_playing?language=en-US&region=US&page=1',
          6 * HOUR,
          'tmdb-now-playing.json',
        ),
      );
      const films = parseNowPlaying(nowPlaying).slice(0, TOP);
      if (films.length === 0) throw new Error('TMDB listed nothing playing.');

      const details = await Promise.allSettled(
        films.map((film) =>
          fetcher.json(
            tmdb(
              `/movie/${film.id}/release_dates`,
              24 * HOUR,
              `tmdb-release-dates-${film.id}.json`,
            ),
          ),
        ),
      );
      if (details.some((detail) => detail.status === 'rejected')) {
        problem('Some ratings are missing: TMDB didn’t send them.');
      }
      return {
        movies: films.map((film, i) => {
          const detail = details[i];
          const us = detail?.status === 'fulfilled' ? usRelease(detail.value) : undefined;
          return {
            id: film.id,
            title: film.title,
            rating: us?.rating,
            opened: us?.opened ?? film.releaseDate,
            url: `https://www.themoviedb.org/movie/${film.id}`,
          };
        }),
        showtimes: SHOWTIMES,
      };
    },
  };
}

/** Films from TMDB's now-playing list, most popular first. */
export function parseNowPlaying(json: unknown) {
  const films: Array<{
    id: number;
    title: string;
    releaseDate: string | undefined;
    popularity: number;
  }> = [];
  for (const raw of list(field(json, 'results'))) {
    const id = num(field(raw, 'id'));
    const title = str(field(raw, 'title'));
    if (id === undefined || title === undefined || field(raw, 'adult') === true) continue;
    films.push({
      id,
      title,
      releaseDate: str(field(raw, 'release_date')),
      popularity: num(field(raw, 'popularity')) ?? 0,
    });
  }
  return films.sort((a, b) => b.popularity - a.popularity);
}

/** A film's US rating, and when it first opened wide in US theaters. */
export function usRelease(json: unknown): {
  rating: string | undefined;
  opened: string | undefined;
} {
  const us = list(field(json, 'results')).find((country) => field(country, 'iso_3166_1') === 'US');
  const releases = list(field(us, 'release_dates')).map((release) => ({
    type: num(field(release, 'type')),
    rating: str(field(release, 'certification')),
    date: str(field(release, 'release_date'))?.slice(0, 10),
  }));
  const byDate = (a: { date?: string | undefined }, b: { date?: string | undefined }) =>
    (a.date ?? '').localeCompare(b.date ?? '');
  // The first wide release is the opening; IMAX, 4DX and re-release runs come later.
  const ordered = [
    ...releases.filter((release) => release.type === THEATRICAL).sort(byDate),
    ...releases.filter((release) => release.type === LIMITED).sort(byDate),
  ];
  return {
    rating: ordered.find((release) => release.rating !== undefined)?.rating,
    opened: ordered.find((release) => release.date !== undefined)?.date,
  };
}
