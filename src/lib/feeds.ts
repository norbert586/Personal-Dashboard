/**
 * Every feed, read in parallel. The Today page and /api/feeds.json both call getFeeds(), so they
 * always agree. Live answers are cached per upstream (src/lib/fetcher.ts); FEEDS=sample answers
 * everything from the saved samples, with no network.
 */
import { FEEDS } from 'astro:env/server';
import { UpstreamCache, sampleFetcher } from './fetcher.ts';
import { readSource, type ReadOptions, type Source } from './readings.ts';
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
  const [weatherReading, scoresReading, local, tech, national, world] = await Promise.all([
    read(weather()),
    read(scores()),
    read(news('local')),
    read(news('tech')),
    read(news('national')),
    read(news('world')),
  ]);
  return {
    weather: weatherReading,
    scores: scoresReading,
    news: { local, tech, national, world },
  };
}

export type Feeds = Awaited<ReturnType<typeof getFeeds>>;
