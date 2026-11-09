/**
 * Every feed, read in parallel. The Today page and /api/feeds.json both call getFeeds(), so they
 * always agree. Live answers are cached per upstream (src/lib/fetcher.ts); FEEDS=sample answers
 * everything from the saved samples, with no network.
 */
import { getCollection } from 'astro:content';
import { FEEDS } from 'astro:env/server';
import { UpstreamCache, sampleFetcher } from './fetcher.ts';
import { readSource, type ReadOptions, type Source } from './readings.ts';
import { activity, titlesByRepo } from './sources/activity.ts';
import { flights } from './sources/flights.ts';
import { news } from './sources/news.ts';
import { scores } from './sources/scores.ts';
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
    scores: read(scores()),
    news: together({
      local: read(news('local')),
      tech: read(news('tech')),
      national: read(news('national')),
      world: read(news('world')),
    }),
    flights: read(flights()),
    activity: read(activity(site.github.user, titles)),
  });
}

export type Feeds = Awaited<ReturnType<typeof getFeeds>>;

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
