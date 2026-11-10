import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { TownFeeds } from './feeds.ts';
import { plotAircraft } from './sky-traffic.ts';
import { lookUpLine, tickerLines } from './ticker.ts';

const reading = <T>(
  data: T,
  provenance: 'live' | 'sample' | 'offline' = 'live',
  detail?: string,
) => ({
  source: 'Test',
  provenance,
  fetchedAt: '2026-11-10T03:58:00.000Z',
  data,
  ...(detail ? { detail } : {}),
});

/** Just enough of every feed for the line each one gets. */
const feeds = (over: Record<string, unknown> = {}) =>
  ({
    weather: reading({
      now: { tempF: 47, text: 'Mostly Cloudy', windMph: 8, windFrom: { point: 'W' } },
      periods: [],
    }),
    traffic: reading({
      incidents: [
        { label: 'Closed', road: '24 Mile Rd' },
        { label: 'Road work', road: 'Van Dyke' },
      ],
    }),
    scores: reading([
      {
        name: 'Pistons',
        last: {
          start: '2026-11-07T00:00:00.000Z',
          result: 'L',
          score: { us: 116, them: 121 },
          home: true,
          opponent: { abbreviation: 'LAL' },
        },
      },
      {
        name: 'Lions',
        last: {
          start: '2026-11-08T18:00:00.000Z',
          result: 'W',
          score: { us: 19, them: 9 },
          home: false,
          opponent: { abbreviation: 'MIA' },
        },
      },
    ]),
    news: {
      local: reading([{ title: 'Mild start to the workweek' }]),
    },
    movies: reading({
      movies: [{ title: 'Wildwood' }, { title: 'Verity' }, { title: 'Buddy' }, { title: 'X' }],
    }),
    comics: reading({ current: true, groups: [{ comics: [{}, {}] }, { comics: [{}] }] }, 'sample'),
    flights: reading({
      radiusMi: 28.8,
      aircraft: [
        { callsign: 'N831VP', distanceMi: 13.4, direction: 'WSW', altitudeFt: 2650 },
        { callsign: 'DAL1065' },
      ],
    }),
    ...over,
  }) as unknown as TownFeeds;

test('one line for each feed, in plain words', () => {
  assert.deepEqual(tickerLines(feeds(), null), [
    '47°F, mostly cloudy, wind W 8 mph',
    'Traffic: closed on 24 Mile Rd, and 1 more',
    'Lions won 19–9 at MIA', // the most recent result
    'Local: Mild start to the workweek',
    'Now playing: Wildwood, Verity, Buddy',
    '3 new comics this week (sample data)', // a saved sample says so
    '2 aircraft within 29 miles. Nearest: N831VP, 13 mi WSW at 2,650 ft',
  ]);
});

test('a live game leads the scores', () => {
  const scores = reading([
    {
      name: 'Red Wings',
      live: { score: { us: 2, them: 1 }, home: true, opponent: { abbreviation: 'TOR' } },
    },
  ]);
  assert.equal(tickerLines(feeds({ scores }), null)[2], 'Live: Red Wings 2–1 vs TOR');
});

test('an offline feed says so and why', () => {
  const traffic = reading({ incidents: [] }, 'offline', "TomTom didn't answer within 8 s.");
  assert.equal(
    tickerLines(feeds({ traffic }), null)[1],
    "Traffic is offline. TomTom didn't answer within 8 s.",
  );
});

test('with no feeds at all, the line says why', () => {
  assert.deepEqual(tickerLines(null, null), ['Reading the morning update…']);
  assert.deepEqual(tickerLines(null, "The town couldn't reach its feeds: it's down."), [
    "The town couldn't reach its feeds: it's down.",
  ]);
});

test('a weather preview is named as one', () => {
  assert.equal(
    tickerLines(feeds(), null, 'snow')[0],
    'Weather preview: snow. The real forecast is on Today.',
  );
});

test('an aircraft crossing the view gets a "look up"', () => {
  const [plane] = plotAircraft([
    {
      hex: 'a6dbf3',
      callsign: 'DAL1065',
      registration: 'N541DE',
      type: 'A21N',
      onGround: false,
      altitudeFt: 35_000,
      speedKt: 480,
      track: 97,
      lat: 42.72,
      lon: -83.03,
      distanceMi: 0,
      bearing: 0,
      direction: 'N',
      military: false,
      emergency: undefined,
    },
  ]);
  assert.ok(plane);
  assert.equal(lookUpLine(plane, false), 'Look up: DAL1065, 35,000 ft, heading E');
  assert.equal(lookUpLine(plane, true), 'Look up: DAL1065, 35,000 ft, heading E (sample data)');
});
