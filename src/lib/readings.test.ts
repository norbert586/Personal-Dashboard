import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readSource, type ReadOptions, type Source } from './readings.ts';
import type { Fetcher, TrackedFetcher } from './fetcher.ts';

const NOW = new Date('2026-11-09T12:00:00Z');
const SAMPLE_NOW = new Date('2026-11-09T04:30:00Z');
const FETCHED = new Date('2026-11-09T11:55:00Z');

const fetcherSaying = (word: string): Fetcher => ({
  json: async () => ({ word }),
  text: async () => word,
});

function options(overrides: Partial<ReadOptions> = {}, problems: string[] = []): ReadOptions {
  const live = fetcherSaying('live');
  const tracked: TrackedFetcher = { ...live, oldest: FETCHED, problems };
  return {
    mode: 'live',
    live: () => tracked,
    sample: fetcherSaying('sample'),
    now: NOW,
    sampleNow: SAMPLE_NOW,
    ...overrides,
  };
}

/** A source that reports which fetcher it was given and when it thinks it is. */
const echo: Source<string> = {
  name: 'Echo',
  empty: '',
  async load({ fetcher, now }) {
    return `${await fetcher.text({ name: 'echo', url: 'https://example.com', ttl: 1, sample: 'x' })} at ${now.toISOString()}`;
  },
};

describe('readSource', () => {
  it('reads live data, dated by its oldest answer', async () => {
    const reading = await readSource(echo, options());
    assert.deepEqual(reading, {
      source: 'Echo',
      provenance: 'live',
      fetchedAt: FETCHED,
      data: `live at ${NOW.toISOString()}`,
    });
  });

  it('says why when some of the data is old or missing', async () => {
    const partial: Source<string> = {
      ...echo,
      async load(context) {
        context.problem("Couldn't load the Tigers.");
        return echo.load(context);
      },
    };
    const reading = await readSource(partial, options({}, ['ESPN answered 503.']));
    assert.equal(reading.provenance, 'live');
    assert.equal(reading.detail, "ESPN answered 503. Couldn't load the Tigers.");
  });

  it('is offline, with the reason and the empty data, when the source throws', async () => {
    const broken: Source<string> = {
      ...echo,
      empty: 'nothing',
      load: () => Promise.reject(new Error('ESPN answered 503.')),
    };
    assert.deepEqual(await readSource(broken, options()), {
      source: 'Echo',
      provenance: 'offline',
      fetchedAt: NOW,
      data: 'nothing',
      detail: 'ESPN answered 503.',
    });
  });

  it('answers from saved samples, as of their capture, in sample mode', async () => {
    const reading = await readSource(echo, options({ mode: 'sample' }));
    assert.deepEqual(reading, {
      source: 'Echo',
      provenance: 'sample',
      fetchedAt: SAMPLE_NOW,
      data: `sample at ${SAMPLE_NOW.toISOString()}`,
    });
  });

  it('shows the saved sample, and what to add, when a key is missing', async () => {
    const keyless = { ...echo, unconfigured: 'Add TMDB_READ_TOKEN to .env for live data.' };
    const reading = await readSource(keyless, options());
    assert.equal(reading.provenance, 'sample');
    assert.equal(reading.detail, 'Add TMDB_READ_TOKEN to .env for live data.');
    assert.match(reading.data, /^sample/);
  });
});
