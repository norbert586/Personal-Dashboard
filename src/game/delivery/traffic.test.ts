import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildZone, type OsmElement } from '../../lib/zone/build.ts';
import type { Road, Zone } from '../../lib/zone/format.ts';
import { site } from '../../site.config.ts';
import { newCar } from './car.ts';
import { SegGrid } from './grid.ts';
import { Traffic, bump, dice, type Rider } from './traffic.ts';

const road = (kind: Road['kind'], name: string, pts: number[], nodes: number[]): Road => ({
  kind,
  name,
  ref: '',
  lanes: kind === 'secondary' ? 4 : 2,
  mph: kind === 'secondary' ? 45 : 25,
  oneway: false,
  bridge: false,
  concrete: false,
  pts,
  nodes,
});

/** A main road running east, and a side street that ends at it from the south. */
const tee: Zone = {
  name: 'tee',
  imported: '2026-11-15',
  credit: '',
  store: { lat: 0, lon: 0 },
  radius: 500,
  roads: [
    road('secondary', 'Main Road', [-300, 0, 0, 0, 300, 0], [0, 1, 2]),
    road('residential', 'Side Street', [0, -200, 0, 0], [3, 1]),
  ],
  junctions: [
    { x: -300, y: 0, signal: false },
    { x: 0, y: 0, signal: false },
    { x: 300, y: 0, signal: false },
    { x: 0, y: -200, signal: false },
  ],
  paths: [{ kind: 'walk', pts: [-200, 12, 200, 12] }],
  buildings: [],
  areas: [],
  spots: [],
  places: [],
};

function grids(zone: Zone): [SegGrid, SegGrid] {
  const streets = new SegGrid(48);
  const walks = new SegGrid(48);
  zone.roads.forEach((r, id) => {
    for (let i = 0; i + 3 < r.pts.length; i += 2)
      streets.add(r.pts[i]!, r.pts[i + 1]!, r.pts[i + 2]!, r.pts[i + 3]!, id);
  });
  zone.paths.forEach((p, id) => {
    if (p.kind === 'crossing') return;
    for (let i = 0; i + 3 < p.pts.length; i += 2)
      walks.add(p.pts[i]!, p.pts[i + 1]!, p.pts[i + 2]!, p.pts[i + 3]!, id);
  });
  return [streets, walks];
}

const rider = (over: Partial<Rider>): Rider => ({
  bike: false,
  road: 0,
  s: 0,
  dir: 1,
  x: 0,
  y: 0,
  heading: 0,
  speed: 0,
  halt: 0,
  look: 0,
  turn: null,
  waited: 0,
  go: false,
  corner: 0,
  gone: false,
  ...over,
});

const nobody = { cars: 0, bikes: 0, walkers: 0, random: dice(1) };
/** Looking away from everything, from far off: nothing is added or taken away. */
const away = { x: 0, y: -100, heading: Math.PI };

test('a car on the side street stops for the main road, then pulls out', () => {
  const traffic = new Traffic(tee, ...grids(tee), nobody);
  const car = rider({ road: 1, s: 100, x: 2, y: -100, speed: 10 });
  traffic.riders.push(car);
  let stopped = false;
  let nearest = Infinity;
  for (let i = 0; i < 60 * 20 && car.road === 1; i++) {
    traffic.update(1 / 60, away, null);
    if (car.speed < 0.2) {
      stopped = true;
      nearest = Math.min(nearest, Math.abs(car.y));
    }
  }
  assert.ok(stopped, 'it came to a stop');
  assert.ok(
    nearest > 6 && nearest < 16,
    `it stopped ${nearest.toFixed(1)} m short of the main road`,
  );
  assert.equal(car.road, 0, 'and then turned onto the main road');
});

test('a car on the main road keeps to its side and goes straight through', () => {
  const traffic = new Traffic(tee, ...grids(tee), { ...nobody, random: () => 0 });
  const car = rider({ road: 0, s: 150, x: -150, y: -4, heading: Math.PI / 2, speed: 18 });
  traffic.riders.push(car);
  let slowest = Infinity;
  for (let i = 0; i < 60 * 12; i++) {
    traffic.update(1 / 60, away, null);
    slowest = Math.min(slowest, car.speed);
    // Heading east, the right-hand side of the road is the south side.
    assert.ok(car.y < -1 && car.y > -8, `in its lanes at y = ${car.y.toFixed(1)}`);
  }
  assert.ok(slowest > 15, 'no stop for the side street');
  assert.ok(car.x > 40);
});

test('traffic waits behind your car rather than driving through it', () => {
  const traffic = new Traffic(tee, ...grids(tee), nobody);
  const car = rider({
    road: 0,
    s: 100,
    x: -200,
    y: -6.2,
    heading: Math.PI / 2,
    speed: 18,
    look: 1,
  });
  traffic.riders.push(car);
  const you = newCar(-120, -6.2, Math.PI / 2);
  for (let i = 0; i < 60 * 15; i++) traffic.update(1 / 60, away, you);
  assert.ok(car.speed < 0.1);
  assert.ok(you.x - car.x > 5 && you.x - car.x < 10, `${(you.x - car.x).toFixed(1)} m behind`);
});

test('bumping another car pushes yours back out and stops theirs for a moment', () => {
  const other = rider({ x: 0, y: 0, heading: 0, speed: 8 });
  const you = newCar(1.2, 0.5, 0);
  you.vx = -4;
  assert.equal(bump(you, [other]), 1);
  assert.ok(you.x > 1.9, 'pushed clear, sideways');
  assert.ok(you.vx >= 0, 'no longer moving into it');
  assert.ok(other.speed === 0 && other.halt > 0);
  assert.equal(bump(newCar(40, 0, 0), [other]), 0);
});

test('the streets around you fill up, out of sight, and stay on the map', () => {
  const saved = JSON.parse(
    readFileSync(
      new URL('../../lib/zone/fixtures/osm-auburn-dequindre.json', import.meta.url),
      'utf8',
    ),
  ) as { elements: OsmElement[] };
  const zone = buildZone(saved.elements, {
    name: 'test',
    store: site.delivery.store,
    radius: 150,
    imported: '2026-11-15',
  });
  const [streets, walks] = grids(zone);
  const traffic = new Traffic(zone, streets, walks, {
    cars: 6,
    bikes: 2,
    walkers: 6,
    random: dice(42),
  });
  const view = { x: 0, y: -40, heading: 0 };
  for (let i = 0; i < 60 * 40; i++) {
    const before = new Set([...traffic.riders, ...traffic.walkers]);
    traffic.update(1 / 60, view, null);
    // Whoever is new this step is a long way off, or out of your view.
    for (const one of [...traffic.riders, ...traffic.walkers]) {
      if (before.has(one)) continue;
      const d = Math.hypot(one.x - view.x, one.y - view.y);
      assert.ok(d >= 44 && (d > 115 || one.y < view.y + d * 0.4), 'appeared out of sight');
    }
  }
  assert.ok(traffic.riders.length >= 3, `${traffic.riders.length} riders`);
  assert.ok(traffic.walkers.length >= 2, `${traffic.walkers.length} walkers`);
  for (const one of traffic.riders) {
    assert.ok(Number.isFinite(one.x + one.y + one.heading + one.speed));
    assert.ok(streets.nearest(one.x, one.y, 14), 'a rider is on a street');
  }
  for (const one of traffic.walkers) assert.ok(walks.nearest(one.x, one.y, 2), 'on a sidewalk');
});
