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
});
