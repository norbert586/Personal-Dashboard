import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodeZone, type Road, type Zone, type ZoneFile } from '../../lib/zone/format.ts';
import { armFor, controlOf, lightFor } from './control.ts';

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
