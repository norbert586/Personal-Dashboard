/** Helpers for source tests (node:test). Never imported by the site. */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { sampleFetcher, type Fetcher, type Upstream } from '../fetcher.ts';
import { readSource, type LoadContext, type Reading, type Source } from '../readings.ts';

const FIXTURES = join(import.meta.dirname, 'fixtures');

/** Answers from the saved samples in ./fixtures, like the site's sample mode. */
export const fixtures: Fetcher = sampleFetcher((name) =>
  readFile(join(FIXTURES, name), 'utf8').catch(() => undefined),
);

/** Read one saved sample as JSON. */
export async function fixture(name: string): Promise<unknown> {
  return JSON.parse(await readFile(join(FIXTURES, name), 'utf8')) as unknown;
}

/** Read one saved sample as text. */
export function fixtureText(name: string): Promise<string> {
  return readFile(join(FIXTURES, name), 'utf8');
}

/** A fetcher where every upstream (or the ones `fails` picks) is down. */
export function outage(message: string, fails: (upstream: Upstream) => boolean = () => true) {
  const down = (upstream: Upstream) => {
    if (fails(upstream)) return Promise.reject(new Error(message));
    return undefined;
  };
  return {
    json: (upstream: Upstream) => down(upstream) ?? fixtures.json(upstream),
    text: (upstream: Upstream) => down(upstream) ?? fixtures.text(upstream),
  } satisfies Fetcher;
}

/** A load context that collects the problems a source reports. */
export function context(fetcher: Fetcher, now: Date): LoadContext & { problems: string[] } {
  const problems: string[] = [];
  return { fetcher, now, problems, problem: (message) => problems.push(message) };
}

/** Read a source live through `fetcher`, the way the site does. */
export function readLive<T>(source: Source<T>, fetcher: Fetcher, now: Date): Promise<Reading<T>> {
  return readSource(source, {
    mode: 'live',
    live: () => ({ json: fetcher.json, text: fetcher.text, oldest: now, problems: [] }),
    sample: fixtures,
    now,
    sampleNow: now,
  });
}
