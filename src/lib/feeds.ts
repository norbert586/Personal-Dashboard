/**
 * Every feed, read in parallel. The Today page and /api/feeds.json both call getFeeds(), so they
 * always agree. Live answers are cached per upstream (src/lib/fetcher.ts); FEEDS=sample answers
 * everything from the saved samples, with no network.
 */
import { getCollection } from 'astro:content';
import {
  COMIC_VINE_API_KEY,
  DEPLOY_TARGET,
  FEEDS,
  TMDB_READ_TOKEN,
  TOMTOM_API_KEY,
} from 'astro:env/server';
import { UpstreamCache, sampleFetcher } from './fetcher.ts';
import { readSource, type ReadOptions, type Source } from './readings.ts';
import { activity, titlesByRepo } from './sources/activity.ts';
import { comics } from './sources/comics.ts';
import { flights } from './sources/flights.ts';
import { movies } from './sources/movies.ts';
import { news } from './sources/news.ts';
import { scores } from './sources/scores.ts';
import { traffic } from './sources/traffic.ts';
import { weather } from './sources/weather.ts';
import { site } from '../site.config.ts';

/** When the saved samples in src/lib/sources/fixtures/ were captured: late on Sunday 8 Nov 2026. */
export const SAMPLES_CAPTURED_AT = new Date('2026-11-09T04:30:00Z');

const saved = import.meta.glob<string>('./sources/fixtures/*', {
  query: '?raw',
  import: 'default',
});
const samples = sampleFetcher(async (name) => saved[`./sources/fixtures/${name}`]?.());
const cache = new UpstreamCache({ userAgent: site.userAgent });

export async function getFeeds(now: Date = new Date()) {
  const options: ReadOptions = {
    mode: FEEDS,
    live: () => cache.fetcher(),
    sample: samples,
    now,
    sampleNow: SAMPLES_CAPTURED_AT,
  };
  const read = <T>(source: Source<T>) => readSource(source, options);
  const titles = titlesByRepo((await getCollection('projects')).map((entry) => entry.data));
  // Every read starts at once and settles on its own; readSource never throws.
  return together({
    weather: read(weather()),
    traffic: read(traffic(TOMTOM_API_KEY)),
    scores: read(scores()),
    news: together({
      local: read(news('local')),
      tech: read(news('tech')),
      national: read(news('national')),
      world: read(news('world')),
    }),
    comics: read(comics(COMIC_VINE_API_KEY)),
    movies: read(movies(TMDB_READ_TOKEN)),
    // Aircraft move on in seconds, and the GitHub Pages build is minutes old by the time it's
    // read, so that build leaves them out and says why (ADR-034).
    flights: read(
      DEPLOY_TARGET === 'pages'
        ? notAsked(
            flights(),
            'Aircraft are only tracked on the home server. This copy of the town is rebuilt about every half hour, and they would have flown on.',
          )
        : flights(),
    ),
    activity: read(activity(site.github.user, titles)),
  });
}

export type Feeds = Awaited<ReturnType<typeof getFeeds>>;

/** A source this build doesn't ask: its reading comes back offline, with the reason. */
function notAsked<T>(source: Source<T>, why: string): Source<T> {
  return { ...source, unconfigured: undefined, load: () => Promise.reject(new Error(why)) };
}

/** Await a record of promises in parallel, keeping its keys and types. */
async function together<T extends Record<string, Promise<unknown>>>(
  pending: T,
): Promise<{ [K in keyof T]: Awaited<T[K]> }> {
  const keys = Object.keys(pending);
  const values = await Promise.all(Object.values(pending));
  return Object.fromEntries(keys.map((key, i) => [key, values[i]])) as {
    [K in keyof T]: Awaited<T[K]>;
  };
}
