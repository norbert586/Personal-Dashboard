import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Sky, Weather } from '../lib/sources/weather.ts';
import type { WireReading } from './feeds.ts';
import { townWeather } from './weather.ts';

const reading = (
  sky: Sky,
  tempF: number | undefined,
  over: { forecast?: Sky; offline?: boolean; wind?: number } = {},
) =>
  ({
    source: 'National Weather Service',
    provenance: over.offline ? 'offline' : 'live',
    fetchedAt: '2026-11-10T03:58:00.000Z',
    data: {
      place: 'Washington Twp',
      now: {
        tempF,
        text: sky,
        sky,
        windMph: 10,
        windFrom: { degrees: over.wind ?? 270, point: 'W' },
        observedAt: '2026-11-10T03:56:00.000Z',
        station: 'Selfridge',
      },
      periods: [
        {
          name: 'Tonight',
          start: '2026-11-10T03:00:00.000Z',
          isDaytime: false,
          tempF: 30,
          text: over.forecast ?? sky,
          sky: over.forecast ?? sky,
          precipChance: undefined,
          wind: '5 mph W',
        },
      ],
      days: [],
    },
  }) as WireReading<Weather>;

test('the forecast decides the light, the cloud and what falls', () => {
  assert.deepEqual(
    (['clear', 'partly', 'cloudy', 'rain', 'storm', 'snow', 'fog'] as const).map((sky) => {
      const w = townWeather(reading(sky, 50));
      return [sky, w.light, w.falling, w.heavy, w.fog];
    }),
    [
      ['clear', 'clear', null, false, false],
      ['partly', 'clear', null, false, false],
      ['cloudy', 'cloud', null, false, false],
      ['rain', 'rain', 'rain', false, false],
      ['storm', 'rain', 'rain', true, false],
      ['snow', 'snow', 'snow', false, false],
      ['fog', 'cloud', null, false, true],
    ],
  );
  const covers = (['clear', 'partly', 'cloudy', 'storm'] as const).map(
    (sky) => townWeather(reading(sky, 50)).cover,
  );
  assert.deepEqual(
    covers,
    [...covers].sort((a, b) => a - b),
  );
});

test('snow lies when it snows near freezing, or stays cold with snow forecast', () => {
  assert.equal(townWeather(reading('snow', 31)).snowCover, true);
  assert.equal(townWeather(reading('snow', 38)).snowCover, false); // wet flakes melt
  assert.equal(townWeather(reading('cloudy', 24, { forecast: 'snow' })).snowCover, true);
  assert.equal(townWeather(reading('cloudy', 24)).snowCover, false);
  assert.equal(townWeather(reading('clear', 47)).snowCover, false);
});

test('clouds drift downwind', () => {
  // A west wind blows east: -y on the town's grid.
  const [dx, dy] = townWeather(reading('partly', 50, { wind: 270 })).drift;
  assert.ok(Math.abs(dx) < 1e-9 && dy < -0.1);
});

test('with no forecast the town draws fair weather, and says it does not know', () => {
  for (const w of [townWeather(undefined), townWeather(reading('snow', 20, { offline: true }))]) {
    assert.equal(w.sky, null);
    assert.deepEqual([w.light, w.falling, w.snowCover], ['clear', null, false]);
  }
});

test('a preview overrides the forecast', () => {
  const w = townWeather(reading('clear', 60), 'snow');
  assert.deepEqual([w.sky, w.falling, w.snowCover], ['snow', 'snow', true]);
});
