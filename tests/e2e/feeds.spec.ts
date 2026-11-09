import { test, expect } from '@playwright/test';

// The e2e server runs with FEEDS=sample (serve.mjs), so every feed answers from its saved sample.

test('serves every feed as JSON, each with its provenance', async ({ request }) => {
  const response = await request.get('/api/feeds.json');
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/json');
  expect(response.headers()['cache-control']).toBe('private, no-store');

  const body = await response.json();
  expect(Date.parse(body.generatedAt)).not.toBeNaN();

  const weather = body.feeds.weather;
  expect(weather.source).toBe('National Weather Service');
  expect(weather.provenance).toBe('sample');
  expect(weather.data.now.tempF).toBe(52);
  expect(weather.data.days).toHaveLength(8);

  const scores = body.feeds.scores;
  expect(scores.source).toBe('ESPN');
  expect(scores.provenance).toBe('sample');
  expect(scores.data.map((team: { name: string }) => team.name)).toEqual([
    'Pistons',
    'Lions',
    'Tigers',
    'Red Wings',
    'Michigan basketball',
    'Michigan football',
    'Georgia Tech football',
  ]);
  const lions = scores.data.find((team: { id: string }) => team.id === 'lions');
  expect(lions.last).toMatchObject({ result: 'W', score: { us: 19, them: 9 } });

  for (const section of ['local', 'tech', 'national', 'world']) {
    const reading = body.feeds.news[section];
    expect(reading.provenance, section).toBe('sample');
    expect(reading.data.length, section).toBeGreaterThanOrEqual(6);
    expect(reading.data[0].url, section).toMatch(/^https:\/\//);
  }

  const flights = body.feeds.flights;
  expect(flights.provenance).toBe('sample');
  expect(flights.data.via).toBe('adsb.lol');
  expect(flights.data.aircraft[0]).toMatchObject({ callsign: 'N831VP', direction: 'WSW' });

  const traffic = body.feeds.traffic;
  expect(traffic.source).toBe('TomTom');
  expect(traffic.provenance).toBe('sample');
  expect(traffic.data.incidents[1]).toMatchObject({ road: '24 Mile Rd', bothWays: true });

  const movies = body.feeds.movies;
  expect(movies.source).toBe('TMDB');
  expect(movies.provenance).toBe('sample');
  expect(movies.data.movies[0]).toMatchObject({ title: 'Wildwood', rating: 'PG-13' });

  const activity = body.feeds.activity;
  expect(activity.source).toBe('GitHub');
  expect(activity.provenance).toBe('sample');
  expect(activity.data.repos[0]).toMatchObject({ name: 'Ratiu Twp', pushes: 7 });
});
