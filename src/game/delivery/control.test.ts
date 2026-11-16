import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodeZone, type Road, type Zone, type ZoneFile } from '../../lib/zone/format.ts';
import { armFor, bladeText, controlOf, lightFor } from './control.ts';

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
 * A main road running east with a signal where a one-way street crosses it northward, and a
 * second signal 20 m further east where a driveway comes out.
 */
const town: Zone = {
  name: 'town',
  imported: '2026-11-16',
  credit: '',
  store: { lat: 0, lon: 0 },
  radius: 500,
  roads: [
    road('secondary', 'Main Road', [-300, 0, 0, 0, 20, 0, 300, 0], [0, 1, 2, 3]),
    road('residential', 'Cross Street', [0, -200, 0, 0, 0, 200], [4, 1, 5], true),
    road('driveway', '', [20, 0, 20, 40], [2, -1]),
  ],
  junctions: [
    { x: -300, y: 0, signal: false },
    { x: 0, y: 0, signal: true },
    { x: 20, y: 0, signal: true },
    { x: 300, y: 0, signal: false },
    { x: 0, y: -200, signal: false },
    { x: 0, y: 200, signal: false },
  ],
  paths: [],
  buildings: [],
  areas: [],
  spots: [],
  places: [],
};

const NORTH = 0;
const EAST = Math.PI / 2;

test('an intersection has an arm for every way out, and driveways are not part of it', () => {
  const { arms } = controlOf(town);
  assert.equal(arms[1]!.length, 4);
  assert.equal(arms[2]!.length, 2, 'the driveway adds no arm');
  assert.equal(arms[0]!.length, 1, 'a road that ends has one way out');
  const headings = arms[1]!.map((a) => Math.round((a.heading * 180) / Math.PI));
  assert.deepEqual(
    headings.sort((a, b) => a - b),
    [-90, 0, 90, 180],
  );
});

test('nobody drives in along the far end of a one-way street', () => {
  const { arms } = controlOf(town);
  const north = arms[1]!.find((a) => a.road === 1 && a.d === 1)!;
  const south = arms[1]!.find((a) => a.road === 1 && a.d === -1)!;
  assert.equal(south.inbound, true, 'traffic comes up from the south');
  assert.equal(north.inbound, false, 'and none comes down from the north');
});

test("a signal's biggest street is its first, and what crosses it is its second", () => {
  const control = controlOf(town);
  assert.equal(armFor(control, 1, EAST)!.axis, 0);
  assert.equal(armFor(control, 1, -EAST)!.axis, 0);
  assert.equal(armFor(control, 1, NORTH)!.axis, 1);
  // Someone heading east came in along the arm that points west.
  assert.ok(Math.abs(armFor(control, 1, EAST)!.heading + EAST) < 1e-9);
  for (let t = 0; t < 96; t += 0.5) {
    const main = lightFor(control, 1, EAST, t);
    const side = lightFor(control, 1, NORTH, t);
    assert.ok(main === 'red' || side === 'red', `${main} and ${side} at ${t}s`);
  }
});

test('signals a few metres apart keep time together', () => {
  const control = controlOf(town);
  assert.equal(control.signal[1], 1);
  assert.equal(control.signal[2], 1);
  assert.equal(control.signal[0], -1);
  for (let t = 0; t < 96; t += 0.5)
    assert.equal(lightFor(control, 1, EAST, t), lightFor(control, 2, EAST, t));
});

test('the real zone: 44 signals, and each one that has two streets gives both a turn', () => {
  const zone = decodeZone(
    JSON.parse(
      readFileSync(new URL('../../../public/zone/auburn-dequindre.json', import.meta.url), 'utf8'),
    ) as ZoneFile,
  );
  const control = controlOf(zone);
  assert.equal(controlOf(zone), control, 'worked out once');
  let signals = 0;
  let crossed = 0;
  zone.junctions.forEach((junction, j) => {
    if (!junction.signal) return assert.equal(control.signal[j], -1);
    signals++;
    assert.ok(control.signal[j]! >= 0 && zone.junctions[control.signal[j]!]!.signal);
    const axes = new Set(control.arms[j]!.map((a) => a.axis));
    if (axes.size === 2) crossed++;
  });
  assert.equal(signals, 44);
  // Auburn and Dequindre: both streets, four ways in.
  const home = zone.junctions.findIndex((j) => j.signal && Math.hypot(j.x, j.y) < 5);
  assert.equal(control.arms[home]!.filter((a) => a.inbound).length, 4);
  assert.ok(crossed >= 35, `${crossed} signals have a crossing street`);
});

/** A main road, a side street that ends at it, and two equal streets that cross further east. */
const signs = (spots: Zone['spots']): Zone => ({
  ...town,
  name: 'signs',
  roads: [
    road('secondary', 'Main Road', [-300, 0, 0, 0, 300, 0], [0, 1, 2]),
    road('residential', 'Side Street', [0, -200, 0, -30, 0, 0], [3, -1, 1]),
    road('residential', 'Elm Street', [100, 100, 200, 100, 300, 100], [4, 5, 6]),
    road('residential', 'Oak Street', [200, 0, 200, 70, 200, 100, 200, 200], [-1, -1, 5, 7]),
  ],
  junctions: [
    { x: -300, y: 0, signal: false },
    { x: 0, y: 0, signal: false },
    { x: 300, y: 0, signal: false },
    { x: 0, y: -200, signal: false },
    { x: 100, y: 100, signal: false },
    { x: 200, y: 100, signal: false },
    { x: 300, y: 100, signal: false },
    { x: 200, y: 200, signal: false },
  ],
  spots,
});

const stopsAt = (zone: Zone, junction: number) =>
  controlOf(zone)
    .arms[junction]!.filter((a) => a.inbound)
    .map((a) => `${zone.roads[a.road]!.name} ${a.stop}`)
    .sort();

test('by rule, the side street stops for the main road and nobody else does', () => {
  const zone = signs([]);
  assert.deepEqual(stopsAt(zone, 1), ['Main Road no', 'Main Road no', 'Side Street sign']);
  // Two equal streets that both run through: nobody has a sign.
  assert.deepEqual(stopsAt(zone, 5), [
    'Elm Street no',
    'Elm Street no',
    'Oak Street no',
    'Oak Street no',
  ]);
});

test("a stop sign the map marks on a street's way in stops that way in only", () => {
  // On Oak Street, 30 m south of where it crosses Elm.
  const zone = signs([{ kind: 'stop', x: 200, y: 70 }]);
  const arms = controlOf(zone).arms[5]!;
  const fromSouth = arms.find((a) => a.road === 3 && a.d === -1)!;
  assert.equal(fromSouth.stop, 'sign');
  assert.equal(arms.filter((a) => a.stop === 'sign').length, 1);
});

test("a stop the map marks on the intersection's own point is an all-way stop", () => {
  const zone = signs([{ kind: 'stop', x: 200, y: 100 }]);
  assert.deepEqual(stopsAt(zone, 5), [
    'Elm Street sign',
    'Elm Street sign',
    'Oak Street sign',
    'Oak Street sign',
  ]);
});

test('a yield sign the map marks takes the place of the stop the rule would give', () => {
  const zone = signs([{ kind: 'yield', x: 0, y: -30 }]);
  assert.deepEqual(stopsAt(zone, 1), ['Main Road no', 'Main Road no', 'Side Street yield']);
});

test('the real zone: signs stand where cars stop, and never at a signal', () => {
  const zone = decodeZone(
    JSON.parse(
      readFileSync(new URL('../../../public/zone/auburn-dequindre.json', import.meta.url), 'utf8'),
    ) as ZoneFile,
  );
  const control = controlOf(zone);
  const count = { no: 0, sign: 0, yield: 0, signal: 0 };
  control.arms.forEach((arms, j) => {
    for (const arm of arms) {
      if (!arm.inbound) continue;
      count[arm.stop]++;
      assert.equal(arm.stop === 'signal', zone.junctions[j]!.signal);
    }
  });
  // About 1,200 stop signs by the rule and the map together; the map alone marks 68.
  assert.ok(count.sign > 900 && count.sign < 1600, `${count.sign} stop signs`);
  assert.ok(count.yield >= 20 && count.yield <= 40, `${count.yield} yield signs`);
  // Hessel Avenue stops for Auburn Road on both sides, a block west of the store.
  const hessel = zone.junctions.findIndex((p) => Math.hypot(p.x + 99, p.y + 22) < 3);
  const there = control.arms[hessel]!.map((a) => `${zone.roads[a.road]!.name} ${a.stop}`).sort();
  assert.deepEqual(there, [
    'East Auburn Road no',
    'East Auburn Road no',
    'Hessel Avenue sign',
    'Hessel Avenue sign',
  ]);
});

test("a street's name is shortened the way its sign at the corner has it", () => {
  assert.equal(bladeText('East Auburn Road'), 'E Auburn Rd');
  assert.equal(bladeText('Dequindre Road'), 'Dequindre Rd');
  assert.equal(bladeText('Hessel Avenue'), 'Hessel Ave');
  assert.equal(bladeText('South Rochester Road'), 'S Rochester Rd');
  // The compass point is the street's name here, not its side of town.
  assert.equal(bladeText('South Boulevard'), 'South Blvd');
  assert.equal(bladeText('East South Boulevard'), 'E South Blvd');
  assert.equal(bladeText('23 Mile Road'), '23 Mile Rd');
  assert.equal(bladeText('Barclay Circle'), 'Barclay Cir');
  assert.equal(bladeText('Broadway'), 'Broadway');
  assert.equal(bladeText('Court Street'), 'Court St');
});
