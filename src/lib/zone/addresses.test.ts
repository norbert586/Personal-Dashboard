import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { site } from '../../site.config.ts';
import { addresses } from './addresses.ts';
import { buildZone, type OsmElement } from './build.ts';
import type { Building, BuildingKind, Road, RoadKind } from './format.ts';

const road = (name: string, kind: RoadKind, pts: number[]): Road => ({
  kind,
  name,
  ref: '',
  lanes: 2,
  mph: 25,
  oneway: false,
  bridge: false,
  concrete: false,
  pts,
  nodes: pts.filter((_, i) => i % 2 === 0).map(() => -1),
});

/** A 10 by 8 m box centred on (x, y), anticlockwise. */
const house = (x: number, y: number, kind: BuildingKind = 'house'): Building => ({
  kind,
  levels: 0,
  name: '',
  made: false,
  pts: [x - 5, y - 4, x + 5, y - 4, x + 5, y + 4, x - 5, y + 4],
  faces: -1,
  street: -1,
  number: 0,
});

// Two east–west streets 120 m apart, and a north–south one crossing them at x = 300.
const roads = [
  road('Elm Street', 'residential', [-400, 0, 400, 0]),
  road('Oak Street', 'residential', [-400, 120, 400, 120]),
  road('Ryan Road', 'residential', [300, -300, 300, 300]),
];
const row = (y: number) => [-200, -150, -100, -50, 0, 50, 100].map((x) => house(x, y));
const homes = [...row(25), ...row(-25), ...row(95)];
const got = addresses(roads, homes);

test('every house gets a five-digit number on the street it faces', () => {
  for (const [i, a] of got.entries()) {
    assert.ok(a.number >= 10000 && a.number <= 99999, `${a.number}`);
    const expected = homes[i]!.pts[1]! > 60 ? 1 : 0;
    assert.equal(a.street, expected, `house ${i} is on ${roads[a.street]?.name}`);
    assert.equal(a.faces, a.street);
  }
});

test('even numbers are on the north side, odd on the south', () => {
  got.slice(0, 7).forEach((a) => assert.equal(a.number % 2, 0, `${a.number} is north of Elm`));
  got.slice(7, 14).forEach((a) => assert.equal(a.number % 2, 1, `${a.number} is south of Elm`));
});

test('numbers rise going east, about 2,000 a mile, and never repeat on one side', () => {
  const north = got.slice(0, 7).map((a) => a.number);
  for (let i = 1; i < north.length; i++) {
    assert.ok(north[i]! > north[i - 1]!);
    // 50 m apart: about 62 numbers.
    assert.ok(Math.abs(north[i]! - north[i - 1]! - 62) <= 2, `${north[i - 1]} then ${north[i]}`);
  }
  // Doors a metre apart still get their own numbers, in order.
  const close = addresses(roads, [house(0, 25), house(1, 37), house(-1, 49)]);
  const ns = close.map((a) => a.number);
  assert.equal(new Set(ns).size, 3);
  assert.ok(ns[2]! < ns[0]! && ns[0]! < ns[1]!, ns.join(' '));
});

test('the next street over has neighbouring numbers at the same point', () => {
  // Facing Oak from the south (row at y = 95) against facing Elm from the north (y = 25).
  for (let k = 0; k < 7; k++) assert.ok(Math.abs(got[14 + k]!.number - got[k]!.number) <= 2);
});

test('a north–south street counts north, with even numbers on its east side', () => {
  const [east, west, further] = addresses(roads, [house(325, 40), house(275, 40), house(325, 90)]);
  assert.equal(roads[east!.street]!.name, 'Ryan Road');
  assert.equal(east!.number % 2, 0);
  assert.equal(west!.number % 2, 1);
  assert.ok(further!.number > east!.number);
});

test('a shop faces the main road even when a side street is nearer', () => {
  const withMain = [
    ...roads,
    road('Auburn Road', 'secondary', [-400, -150, 400, -150]),
    road('', 'service', [-400, -130, 400, -130]),
  ];
  const [shop, home] = addresses(withMain, [house(0, -100, 'retail'), house(0, -100)]);
  assert.equal(withMain[shop!.faces]!.name, 'Auburn Road');
  assert.equal(withMain[shop!.street]!.name, 'Auburn Road');
  // A home there faces the nearest street; the lane behind the shops has no name, so a home on
  // it would take the nearest named street for its address instead.
  assert.equal(withMain[home!.faces]!.name, '');
  assert.equal(withMain[home!.street]!.name, 'Auburn Road');
});

test('garages, sheds, canopies and pumps get no number', () => {
  const none = addresses(
    roads,
    (['garage', 'shed', 'canopy', 'fuel'] as const).map((k) => house(0, 25, k)),
  );
  for (const a of none) assert.deepEqual([a.street, a.number], [-1, 0]);
});

test('on the real map around the store, the same zone always gives the same addresses', () => {
  const saved = JSON.parse(
    readFileSync(new URL('./fixtures/osm-auburn-dequindre.json', import.meta.url), 'utf8'),
  ) as { elements: OsmElement[] };
  const spec = { name: 'test', store: site.delivery.store, radius: 150, imported: '2026-11-15' };
  const zone = buildZone(saved.elements, spec);
  const numbered = zone.buildings.filter((b) => b.number > 0);
  assert.ok(numbered.length > zone.buildings.length / 2, `${numbered.length} numbered`);
  for (const b of numbered) {
    assert.match(String(b.number), /^\d{5}$/);
    assert.notEqual(zone.roads[b.street]!.name, '');
  }
  assert.deepEqual(buildZone(saved.elements, spec).buildings, zone.buildings);
});
