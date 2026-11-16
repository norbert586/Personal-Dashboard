import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodeZone, type Road, type Zone, type ZoneFile } from '../../lib/zone/format.ts';
import { PACE, doorSpot, planRun, route, spotNear, stretches, type Spot } from './route.ts';
import { dice } from './traffic.ts';

const MPH = 0.44704;
const MILE = 1609.344;

const road = (
  kind: Road['kind'],
  name: string,
  pts: number[],
  nodes: number[],
  oneway = false,
): Road => ({
  kind,
  name,
  ref: '',
  lanes: kind === 'secondary' ? 4 : 2,
  mph: kind === 'secondary' ? 45 : 25,
  oneway,
  bridge: false,
  concrete: false,
  pts,
  nodes,
});

/**
 * A main road running east, a one-way street crossing it northward in the middle, a lane that
 * loops round the north side from one end of the main road to the other, and another from the
 * west end round to the foot of the one-way street.
 *
 *     5 ------- 4 ------- 6      Back Lane
 *     |         ^         |
 *     0 ------- 1 ------- 2      Main Road
 *     |         ^
 *     + ------- 3                South Lane; Cross Street (one way, north)
 */
const town: Zone = {
  name: 'town',
  imported: '2026-11-16',
  credit: '',
  store: { lat: 0, lon: 0 },
  radius: 500,
  roads: [
    road('secondary', 'Main Road', [-300, 0, 0, 0, 300, 0], [0, 1, 2]),
    road('residential', 'Cross Street', [0, -200, 0, 0, 0, 200], [3, 1, 4], true),
    road(
      'residential',
      'Back Lane',
      [-300, 0, -300, 200, 0, 200, 300, 200, 300, 0],
      [0, 5, 4, 6, 2],
    ),
    road('residential', 'South Lane', [0, -200, -300, -200, -300, 0], [3, -1, 0]),
  ],
  junctions: [
    { x: -300, y: 0, signal: false },
    { x: 0, y: 0, signal: false },
    { x: 300, y: 0, signal: false },
    { x: 0, y: -200, signal: false },
    { x: 0, y: 200, signal: false },
    { x: -300, y: 200, signal: false },
    { x: 300, y: 200, signal: false },
  ],
  paths: [],
  buildings: [],
  areas: [],
  spots: [],
  places: [],
};

const at = (zone: Zone, x: number, y: number): Spot => {
  const spot = spotNear(zone, x, y, 30);
  assert.ok(spot, `no road near ${x}, ${y}`);
  return spot;
};
const go = (zone: Zone, from: Spot, to: Spot) => {
  const found = route(zone, from, to);
  assert.ok(found, 'no route');
  return found;
};
/** Seconds lost stopping from `v` and pulling away again. */
const halt = (v: number) => v / (2 * PACE.brake) + v / (2 * PACE.pull);

test('a two-way road is a stretch each way and a one-way road only one', () => {
  // Main Road has 2 blocks, Back Lane 4 and South Lane 1, both ways; Cross Street has 2, one way.
  assert.equal(stretches(town), 2 * 2 + 4 * 2 + 1 * 2 + 2);
});

test('along one road the route is the road, at its speed limit', () => {
  const found = go(town, at(town, -150, 0), at(town, 150, 0));
  assert.ok(Math.abs(found.metres - 300) < 0.01);
  // Main Road runs through: nothing to stop for where Cross Street meets it.
  assert.ok(Math.abs(found.seconds - 300 / (45 * MPH)) < 0.01);
  assert.deepEqual(found.streets, ['Main Road']);
  assert.deepEqual(found.line, [-150, 0, 0, 0, 150, 0]);
});

test('two places on one block are joined directly, either way', () => {
  const east = go(town, at(town, -250, 0), at(town, -200, 0));
  const west = go(town, at(town, -200, 0), at(town, -250, 0));
  for (const found of [east, west]) {
    assert.ok(Math.abs(found.metres - 50) < 0.01);
    assert.ok(Math.abs(found.seconds - 50 / (45 * MPH)) < 0.01);
  }
  assert.deepEqual(west.line, [-200, 0, -250, 0]);
});

test('a one-way street is never driven backwards', () => {
  // With the street: straight up it.
  const north = go(town, at(town, 0, -100), at(town, 0, 100));
  assert.ok(Math.abs(north.metres - 200) < 0.01);
  // From its north half to the main road you can't turn back south: it's round by the lane.
  const round = go(town, at(town, 0, 100), at(town, 150, 0));
  assert.ok(Math.abs(round.metres - (100 + 300 + 200 + 150)) < 0.01);
  assert.deepEqual(round.streets, ['Cross Street', 'Back Lane', 'Main Road']);
  // And to its south half it's all the way round to the street's foot.
  const foot = go(town, at(town, 0, 100), at(town, 0, -100));
  assert.ok(Math.abs(foot.metres - (100 + 300 + 200 + 500 + 100)) < 0.01);
  assert.deepEqual(foot.line.slice(-4), [0, -200, 0, -100]);
});

test('a stop sign costs the stop, the look and pulling away', () => {
  const v = 25 * MPH;
  const found = go(town, at(town, 0, -100), at(town, 0, 100));
  assert.ok(Math.abs(found.seconds - (200 / v + halt(v) + PACE.look)) < 0.01);
});

test('a turn costs time, and a left more than a right', () => {
  const right = go(town, at(town, -150, 0), at(town, -300, 100));
  const straight = 150 / (45 * MPH) + 100 / (25 * MPH);
  assert.ok(right.seconds > straight + 1, 'the corner is free');
  // Onto Cross Street from the west is a left, from the east a right; the rest is the same.
  const left = go(town, at(town, -150, 0), at(town, 0, 100));
  const other = go(town, at(town, 150, 0), at(town, 0, 100));
  assert.ok(Math.abs(left.seconds - other.seconds - PACE.left) < 0.01);
});

test('a run takes its drops in the order that keeps them waiting least', () => {
  const store = at(town, -250, 0);
  const near = at(town, -100, 0);
  const far = at(town, 200, 0);
  const run = planRun(town, store, [far, near]);
  assert.ok(run);
  assert.deepEqual(
    run.drops.map((d) => d.door),
    [1, 0],
  );
  // Both are on the way: each arrives when it would alone, and the run is out and back.
  assert.ok(Math.abs(run.drops[0]!.seconds - run.alone[1]!) < 0.01);
  assert.ok(Math.abs(run.drops[1]!.seconds - run.alone[0]!) < 0.01);
  assert.ok(run.seconds > run.drops[1]!.seconds * 2 - 0.01);
  assert.deepEqual(planRun(town, store, []), { drops: [], seconds: 0, metres: 0, alone: [] });
});

// ---- The real streets ----

const real = decodeZone(
  JSON.parse(
    readFileSync(new URL('../../../public/zone/auburn-dequindre.json', import.meta.url), 'utf8'),
  ) as ZoneFile,
);

/** Where two streets meet, by part of their names. */
function corner(a: string, b: string): Spot {
  const found = real.junctions.findIndex((_, j) => {
    const names = real.roads.filter((r) => r.nodes.includes(j)).map((r) => r.name);
    return names.some((n) => n.includes(a)) && names.some((n) => n.includes(b));
  });
  assert.ok(found >= 0, `${a} and ${b} don't meet`);
  return at(real, real.junctions[found]!.x, real.junctions[found]!.y);
}

/** The lane behind the pizzeria, where every run starts. */
const store = (): Spot => {
  const shop = real.places.find((p) => p.kind === 'pizzeria')!;
  return at(real, shop.x + 20, shop.y);
};

test('Auburn and Dequindre to Auburn and John R is a mile along Auburn, in about two minutes', () => {
  for (const [a, b] of [
    ['Dequindre', 'John R'],
    ['John R', 'Dequindre'],
  ] as const) {
    const found = go(real, corner('Auburn', a), corner('Auburn', b));
    assert.ok(Math.abs(found.metres / MILE - 1.02) < 0.05, `${found.metres} m`);
    assert.ok(found.seconds > 90 && found.seconds < 180, `${found.seconds} s`);
    assert.ok(
      found.streets.every((n) => /Auburn|Dequindre|John R/.test(n)),
      found.streets.join(', '),
    );
  }
});

test('from behind the store, the corner is a minute away by the lane and Auburn Road', () => {
  const found = go(real, store(), corner('Auburn', 'Dequindre'));
  assert.ok(found.metres > 200 && found.metres < 400, `${found.metres} m`);
  assert.ok(found.seconds > 30 && found.seconds < 90, `${found.seconds} s`);
  assert.ok(found.streets.includes('Auburn Road'));
  // The line is one unbroken path from the lane to the corner.
  for (let i = 2; i < found.line.length; i += 2)
    assert.ok(
      Math.hypot(found.line[i]! - found.line[i - 2]!, found.line[i + 1]! - found.line[i - 1]!) <
        120,
    );
});

test('the freeway is only driven the way it runs', () => {
  const m59 = real.roads.findIndex((r) => r.kind === 'motorway' && r.oneway && r.pts.length > 12);
  const pts = real.roads[m59]!.pts;
  const first = at(real, pts[2]!, pts[3]!);
  const last = at(real, pts.at(-4)!, pts.at(-3)!);
  const along = go(real, first, last);
  assert.ok(Math.abs(along.metres - (last.s - first.s)) < 1);
  // Back to where you started means coming off, turning round and getting on again.
  const back = route(real, last, first);
  assert.ok(!back || back.metres > along.metres + 400);
});

test('A* finds what a plain search finds, and nothing beats the fastest limit', () => {
  const random = dice(47);
  const doors = real.buildings.filter((b) => b.number > 0);
  const pick = (): Spot => {
    for (;;) {
      const spot = doorSpot(real, doors[Math.floor(random() * doors.length)]!);
      if (spot) return spot;
    }
  };
  for (let i = 0; i < 200; i++) {
    const a = pick();
    const b = pick();
    const quick = go(real, a, b);
    const plain = route(real, a, b, { guess: false });
    assert.ok(plain);
    assert.ok(Math.abs(quick.seconds - plain.seconds) < 1e-6, `${quick.seconds} ${plain.seconds}`);
    assert.ok(quick.seconds >= quick.metres / (70 * MPH) - 1e-6);
    // Straight there is never further than the drive.
    assert.ok(quick.metres >= Math.hypot(a.x - b.x, a.y - b.y) - 0.5);
  }
});

test('nearly every numbered door can be driven to from the store, and back', () => {
  const from = store();
  let none = 0;
  let longest = 0;
  let tried = 0;
  real.buildings.forEach((b, i) => {
    if (b.number === 0) return;
    const spot = doorSpot(real, b);
    if (!spot) return void none++;
    // You pull up on pavement, never on someone's driveway or the freeway.
    assert.ok(!['driveway', 'link', 'motorway'].includes(real.roads[spot.road]!.kind));
    if (i % 16) return;
    tried++;
    const out = route(real, from, spot);
    const home = route(real, spot, from);
    assert.ok(out && home, `building ${i} has no route`);
    longest = Math.max(longest, out.seconds);
  });
  assert.ok(tried > 900);
  // The doors with nowhere to pull up are on streets the zone's edge cuts off from the rest.
  // Orders never go to them. Held here so an import that strands more is noticed.
  assert.equal(none, 266);
  // The far corner of a 2.5 mile zone is under ten minutes at the limit.
  assert.ok(longest > 300 && longest < 600, `${longest} s`);
});

test('two doors on one street are a real double; opposite ends of the zone are not', () => {
  const from = store();
  const numbered = real.buildings.filter((b) => b.number > 0 && doorSpot(real, b));
  const on = (street: string) => numbered.filter((b) => real.roads[b.street]!.name === street);
  const [first, next] = on('Mayapple Drive');
  const across = on('Saxon Court')[0];
  assert.ok(first && next && across);
  const spots = (...list: (typeof first)[]) => list.map((b) => doorSpot(real, b)!);

  const double = planRun(real, from, spots(first, next));
  assert.ok(double);
  // The second neighbour gets theirs within a minute of when they would alone.
  const late = (run: NonNullable<typeof double>) =>
    Math.max(...run.drops.map((d) => d.seconds - run.alone[d.door]!));
  assert.ok(late(double) < 60, `${late(double)} s late`);

  const bad = planRun(real, from, spots(first, across));
  assert.ok(bad);
  assert.ok(late(bad) > 300, `${late(bad)} s late`);
  // And it's still the better of the two orders.
  assert.ok(bad.drops[0]!.seconds <= Math.max(...bad.alone));
});
