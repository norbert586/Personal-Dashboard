import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { KEEP_TTLS, UpstreamCache, sampleFetcher, type Upstream } from './fetcher.ts';

const MINUTE = 60_000;
const upstream: Upstream = {
  name: 'ESPN',
  url: 'https://example.com/scores?api_key=SECRET',
  ttl: 2 * MINUTE,
  sample: 'espn.json',
  headers: { 'x-extra': 'yes' },
};

/** A fake network: answers in order, counts calls, and records what was asked. */
function network(...answers: Array<() => Promise<Response>>) {
  const calls: Array<{ url: string; headers: Headers }> = [];
  const fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), headers: new Headers(init?.headers) });
    const answer = answers[Math.min(calls.length, answers.length) - 1];
    if (!answer) throw new Error('no answer configured');
    return answer();
  }) as typeof globalThis.fetch;
  return { fetch, calls };
}

const ok = (body: unknown) => () => Promise.resolve(Response.json(body));
const status = (code: number) => () => Promise.resolve(new Response('nope', { status: code }));
const refused = () => () =>
  Promise.reject(new TypeError('fetch failed', { cause: { code: 'ECONNREFUSED' } }));

function setup(...answers: Array<() => Promise<Response>>) {
  let time = 1_000_000;
  const net = network(...answers);
  const cache = new UpstreamCache({
    userAgent: 'RatiuTwp/test',
    fetch: net.fetch,
    clock: () => time,
    timeoutMs: 50,
  });
  return {
    cache,
    calls: net.calls,
    advance: (ms: number) => {
      time += ms;
    },
  };
}

describe('UpstreamCache', () => {
  it('serves a fresh answer without asking again', async () => {
    const { cache, calls, advance } = setup(ok({ n: 1 }));
    assert.deepEqual(await cache.fetcher().json(upstream), { n: 1 });
    advance(MINUTE);
    assert.deepEqual(await cache.fetcher().json(upstream), { n: 1 });
    assert.equal(calls.length, 1);
  });

  it('shares one fetch between requests that arrive together', async () => {
    const { cache, calls } = setup(ok({ n: 1 }));
    const answers = await Promise.all([1, 2, 3].map(() => cache.fetcher().json(upstream)));
    assert.deepEqual(answers, [{ n: 1 }, { n: 1 }, { n: 1 }]);
    assert.equal(calls.length, 1);
  });

  it('asks again once the answer is older than its ttl', async () => {
    const { cache, calls, advance } = setup(ok({ n: 1 }), ok({ n: 2 }));
    await cache.fetcher().json(upstream);
    advance(2 * MINUTE);
    assert.deepEqual(await cache.fetcher().json(upstream), { n: 2 });
    assert.equal(calls.length, 2);
  });

  it('sends the User-Agent and the upstream headers', async () => {
    const { cache, calls } = setup(ok({}));
    await cache.fetcher().json(upstream);
    assert.equal(calls[0]?.headers.get('user-agent'), 'RatiuTwp/test');
    assert.equal(calls[0]?.headers.get('x-extra'), 'yes');
    assert.equal(calls[0]?.headers.get('accept'), 'application/json');
  });

  it('falls back to the last good answer when a refresh fails, and says why', async () => {
    const { cache, advance } = setup(ok({ n: 1 }), status(503));
    await cache.fetcher().json(upstream);
    advance(3 * MINUTE);
    const fetcher = cache.fetcher();
    assert.deepEqual(await fetcher.json(upstream), { n: 1 });
    assert.deepEqual(fetcher.problems, ['ESPN answered 503.']);
    assert.equal(fetcher.oldest?.getTime(), 1_000_000);
  });

  it(`gives up on an answer older than ${KEEP_TTLS} ttls`, async () => {
    const { cache, advance } = setup(ok({ n: 1 }), status(503));
    await cache.fetcher().json(upstream);
    advance(KEEP_TTLS * upstream.ttl);
    await assert.rejects(cache.fetcher().json(upstream), { message: 'ESPN answered 503.' });
  });

  it("doesn't retry a failed upstream for a minute", async () => {
    const { cache, calls, advance } = setup(refused(), refused(), ok({ n: 2 }));
    await assert.rejects(cache.fetcher().json(upstream));
    advance(30_000);
    await assert.rejects(cache.fetcher().json(upstream), {
      message: "Couldn't reach ESPN (ECONNREFUSED).",
    });
    assert.equal(calls.length, 1);
    advance(30_000);
    await assert.rejects(cache.fetcher().json(upstream));
    advance(60_000);
    assert.deepEqual(await cache.fetcher().json(upstream), { n: 2 });
    assert.equal(calls.length, 3);
  });

  it('puts failures into words, without the URL or its key', async () => {
    // AbortSignal.timeout's timer doesn't hold the event loop open (a server always has something
    // else that does), so the hanging fake holds it until the abort arrives.
    const hang = () => (_url: string | URL | Request, init?: RequestInit) =>
      new Promise<Response>((_resolve, reject) => {
        const hold = setTimeout(() => undefined, 5_000);
        init?.signal?.addEventListener('abort', () => {
          clearTimeout(hold);
          reject(init.signal?.reason);
        });
      });
    const cases: Array<[string, typeof globalThis.fetch]> = [
      ['ESPN answered 500.', network(status(500)).fetch],
      ['ESPN refused the request (403).', network(status(403)).fetch],
      ["ESPN says we're asking too often (429).", network(status(429)).fetch],
      ["Couldn't reach ESPN (ECONNREFUSED).", network(refused()).fetch],
      [
        "ESPN sent something that isn't JSON.",
        network(() => Promise.resolve(new Response('<html>'))).fetch,
      ],
      ["ESPN didn't answer within 1 s.", hang() as typeof globalThis.fetch],
    ];
    for (const [message, fetch] of cases) {
      const cache = new UpstreamCache({ userAgent: 'test', fetch, timeoutMs: 50 });
      await assert.rejects(cache.fetcher().json(upstream), (error: Error) => {
        assert.equal(error.message, message);
        assert.doesNotMatch(error.message, /SECRET|example\.com/);
        return true;
      });
    }
  });

  it('blames the key only when the upstream sends one', async () => {
    const cache = new UpstreamCache({ userAgent: 'test', fetch: network(status(401)).fetch });
    await assert.rejects(cache.fetcher().json({ ...upstream, name: 'TMDB', keyed: true }), {
      message: 'TMDB refused the key (401). Check it in .env.',
    });
  });

  it('keeps text answers as text', async () => {
    const { cache } = setup(() => Promise.resolve(new Response('<rss/>')));
    assert.equal(await cache.fetcher().text(upstream), '<rss/>');
  });
});

describe('sampleFetcher', () => {
  const samples = sampleFetcher(async (name) => (name === 'espn.json' ? '{"n":7}' : undefined));

  it('answers from the saved sample named by the upstream', async () => {
    assert.deepEqual(await samples.json(upstream), { n: 7 });
  });

  it('says when there is no saved sample', async () => {
    await assert.rejects(samples.json({ ...upstream, sample: 'missing.json' }), {
      message: "There's no saved sample for ESPN.",
    });
  });
});
