import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Aircraft } from '../lib/sources/flights.ts';
import { site } from '../site.config.ts';
import type { Wire } from './feeds.ts';
import { heightTiles, planeAt, plotAircraft } from './sky-traffic.ts';
import { TILES_PER_MILE, TOWN_POINT } from './world/projection.ts';

const aircraft = (over: Partial<Wire<Aircraft>>): Wire<Aircraft> => ({
  hex: 'a6dbf3',
  callsign: 'DAL1065',
  registration: 'N541DE',
  type: 'A21N',
  onGround: false,
  altitudeFt: 35_000,
  speedKt: 480,
  track: 90,
  lat: site.place.lat,
  lon: site.place.lon,
  distanceMi: 0,
  bearing: 0,
  direction: 'N',
  military: false,
  emergency: undefined,
  ...over,
});

test('an aircraft over the town is drawn over the town, heading where it really is', () => {
  const [plane] = plotAircraft([aircraft({})]);
  assert.ok(plane);
  assert.ok(Math.hypot(plane.x - TOWN_POINT[0], plane.y - TOWN_POINT[1]) < 0.01);
  // Track 090 is due east: -y on the grid.
  assert.ok(Math.abs(plane.fx) < 1e-9 && Math.abs(plane.fy + 1) < 1e-9);
  assert.equal(plane.label, 'DAL1065');
  assert.equal(plane.kind, 'jet');
  assert.equal(plane.contrail, true);
});

test('between answers, it flies on at its real ground speed', () => {
  const [plane] = plotAircraft([aircraft({ speedKt: 360, track: 0 })]);
  assert.ok(plane);
  // 360 knots is 6.9 miles a minute, due north.
  const [x, y] = planeAt(plane, 60);
  const miles = (plane.x - x) / TILES_PER_MILE;
  assert.ok(Math.abs(miles - 6.905) < 0.01, String(miles));
  assert.ok(Math.abs(y - plane.y) < 1e-6);
});

test('heights keep their order and stay inside the view', () => {
  const heights = [0, 1_000, 2_650, 10_000, 35_000, 60_000].map(heightTiles);
  for (let i = 1; i < heights.length; i++) assert.ok(heights[i]! >= heights[i - 1]!);
  assert.ok(heights[0]! >= 3 && heights.at(-1)! <= 12.5);
  // Lower aircraft are drawn larger, as if nearer.
  const [low, high] = plotAircraft([
    aircraft({ hex: 'a1', type: 'C172', altitudeFt: 1_500, speedKt: 95 }),
    aircraft({ hex: 'a2' }),
  ]);
  assert.ok(low && high && low.scale > high.scale);
  assert.equal(low.kind, 'prop');
  assert.equal(low.contrail, false);
});

test('aircraft on the ground, or with no height, are left out', () => {
  const planes = plotAircraft([
    aircraft({ hex: 'g1', onGround: true, altitudeFt: undefined }),
    aircraft({ hex: 'g2', altitudeFt: undefined }),
    aircraft({ hex: 'ok', callsign: undefined }),
  ]);
  assert.deepEqual(
    planes.map((p) => [p.hex, p.label]),
    [['ok', 'N541DE']],
  );
});
