import assert from 'node:assert/strict';
import { test } from 'node:test';
import { bearing, distanceMiles } from '../../lib/geo.ts';
import { site } from '../../site.config.ts';
import {
  ORIGIN,
  TILES_PER_MILE,
  TOWN_POINT,
  headingVector,
  toLatLon,
  toTile,
} from './projection.ts';

const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`,
  );

test("the town's point is the middle of the first section", () => {
  near(TOWN_POINT[0], 16, 0.01);
  near(TOWN_POINT[1], 16, 0.01);
  assert.deepEqual(toTile(ORIGIN.lat, ORIGIN.lon), [0, 0]);
});

test('a real mile is one section: north is -x and west is +y', () => {
  const here = site.place;
  // One mile north and one mile west. The feeds measure on a sphere, within half a percent.
  const north = { lat: here.lat + 1 / 69.026, lon: here.lon };
  const west = { lat: here.lat, lon: here.lon - 1 / 50.897 };
  near(distanceMiles(here, north), 1, 0.005);
  near(distanceMiles(here, west), 1, 0.005);
  const [nx, ny] = toTile(north.lat, north.lon);
  const [wx, wy] = toTile(west.lat, west.lon);
  near(nx - TOWN_POINT[0], -TILES_PER_MILE, 0.01);
  near(ny - TOWN_POINT[1], 0, 0.01);
  near(wx - TOWN_POINT[0], 0, 0.01);
  near(wy - TOWN_POINT[1], TILES_PER_MILE, 0.01);
});

test('tiles and real points convert both ways', () => {
  const { lat, lon } = toLatLon(100.5, -42.25);
  const [x, y] = toTile(lat, lon);
  near(x, 100.5, 1e-9);
  near(y, -42.25, 1e-9);
});

test("a point's distance and bearing in tiles match the feeds' miles and degrees", () => {
  // Selfridge, the nearest weather station: about 13 miles east-south-east of the town's point.
  const selfridge = { lat: 42.6083, lon: -82.8355 };
  const [x, y] = toTile(selfridge.lat, selfridge.lon);
  const dx = x - TOWN_POINT[0];
  const dy = y - TOWN_POINT[1];
  near(Math.hypot(dx, dy) / TILES_PER_MILE, distanceMiles(site.place, selfridge), 0.05);
  const [fx, fy] = headingVector(bearing(site.place, selfridge));
  near(dx / Math.hypot(dx, dy), fx, 0.01);
  near(dy / Math.hypot(dx, dy), fy, 0.01);
});

test('headings point the way the grid does', () => {
  const [nx, ny] = headingVector(0);
  near(nx, -1, 1e-9);
  near(ny, 0, 1e-9);
  const [ex, ey] = headingVector(90);
  near(ex, 0, 1e-9);
  near(ey, -1, 1e-9);
});
