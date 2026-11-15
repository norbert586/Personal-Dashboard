import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { distanceMiles } from '../geo.ts';
import { site } from '../../site.config.ts';
import { MARGIN, buildZone, metresFrom, parseMph, type OsmElement } from './build.ts';
import { decodeZone, encodeZone, zoneStats, type Line, type ZoneFile } from './format.ts';

const store = site.delivery.store;
const spec = { name: 'test', store, radius: 150, imported: '2026-11-15' };

// A real answer from the OpenStreetMap API: the few blocks around Auburn and Dequindre
// (`npm run zone:import -- --sample`).
const saved = JSON.parse(
  readFileSync(new URL('./fixtures/osm-auburn-dequindre.json', import.meta.url), 'utf8'),
) as { elements: OsmElement[] };
const zone = buildZone(saved.elements, spec);

const near = (actual: number, expected: number, tolerance: number) =>
  assert.ok(
    Math.abs(actual - expected) <= tolerance,
    `${actual} is not within ${tolerance} of ${expected}`,
  );

const area = (pts: Line) => {
  let sum = 0;
  for (let i = 0; i < pts.length; i += 2) {
    const j = (i + 2) % pts.length;
    sum += pts[i]! * pts[j + 1]! - pts[j]! * pts[i + 1]!;
  }
  return sum / 2;
};

test('metres run east and north of the store, true to the real distance', () => {
  const metres = metresFrom(store);
  assert.deepEqual(metres(store.lat, store.lon), [0, 0]);
  const north = { lat: store.lat + 0.01, lon: store.lon };
  const west = { lat: store.lat, lon: store.lon - 0.01 };
  // The feeds measure on a sphere, which agrees to within half a percent.
  near(metres(north.lat, north.lon)[1], distanceMiles(store, north) * 1609.344, 6);
  near(metres(west.lat, west.lon)[0], -distanceMiles(store, west) * 1609.344, 5);
  assert.equal(metres(north.lat, north.lon)[0], 0);
});

test('speed limits read as mph, with bare numbers taken as km/h', () => {
  assert.equal(parseMph('45 mph'), 45);
  assert.equal(parseMph('40mph'), 40);
  assert.equal(parseMph('50'), 30);
  assert.equal(parseMph('signals'), null);
  assert.equal(parseMph(undefined), null);
});

test('Auburn and Dequindre meet at a signal, at the store', () => {
  const junction = zone.junctions.findIndex((j) => j.signal);
  assert.ok(junction >= 0, 'a junction with a signal');
  near(zone.junctions[junction]!.x, 0, 2);
  near(zone.junctions[junction]!.y, 0, 2);
  const through = new Set(zone.roads.filter((r) => r.nodes.includes(junction)).map((r) => r.name));
  assert.ok(through.has('Dequindre Road'));
  assert.ok(through.has('Auburn Road') || through.has('East Auburn Road'));
  assert.ok(zone.spots.some((s) => s.kind === 'signal'));
});

test("main roads carry the map's lanes and limits; side streets get the usual ones", () => {
  const dequindre = zone.roads.filter((r) => r.name === 'Dequindre Road');
  assert.ok(dequindre.length > 0);
  for (const road of dequindre) {
    assert.equal(road.kind, 'secondary');
    assert.equal(road.mph, 45);
    assert.ok(road.lanes >= 3);
  }
  // Dequindre is concrete here, and the map says so.
  assert.ok(dequindre.some((road) => road.concrete));
  const dawes = zone.roads.find((r) => r.name === 'Dawes Avenue');
  assert.deepEqual([dawes?.kind, dawes?.lanes, dawes?.mph], ['residential', 2, 25]);
  // Lots and lanes have no names, and nobody speeds through them.
  for (const road of zone.roads.filter((r) => r.kind === 'aisle')) assert.equal(road.mph, 10);
});

test('every road point marked as a junction sits on that junction', () => {
  for (const road of zone.roads) {
    assert.equal(road.nodes.length, road.pts.length / 2);
    assert.ok(road.nodes[0]! >= 0 && road.nodes.at(-1)! >= 0, 'a road ends at junctions');
    road.nodes.forEach((node, i) => {
      if (node < 0) return;
      const junction = zone.junctions[node]!;
      assert.deepEqual([road.pts[i * 2], road.pts[i * 2 + 1]], [junction.x, junction.y]);
    });
  }
});

test('the zone stops a little past its edge', () => {
  const reach = spec.radius + MARGIN + 0.1;
  for (const road of zone.roads)
    for (let i = 0; i < road.pts.length; i += 2)
      assert.ok(Math.hypot(road.pts[i]!, road.pts[i + 1]!) <= reach);
  // The answer reaches further than that, so something was left out.
  const metres = metresFrom(store);
  const far = saved.elements.filter(
    (el) => el.type === 'node' && Math.hypot(...metres(el.lat, el.lon)) > reach,
  );
  assert.ok(far.length > 0);
});

test('buildings are anticlockwise rings with a kind, and shops are told from houses', () => {
  assert.ok(zone.buildings.length > 40);
  for (const building of zone.buildings) {
    assert.ok(building.pts.length >= 6);
    assert.ok(area(building.pts) > 0, 'anticlockwise');
    const n = building.pts.length;
    assert.ok(
      building.pts[0] !== building.pts[n - 2] || building.pts[1] !== building.pts[n - 1],
      'the first point is not repeated',
    );
  }
  const kinds = new Set(zone.buildings.map((b) => b.kind));
  for (const kind of ['house', 'garage', 'retail', 'church'] as const) assert.ok(kinds.has(kind));
  assert.equal(zone.buildings.find((b) => b.name === 'Ace Hardware')?.kind, 'retail');
});

test('sidewalks, crosswalks, lots and trees come along', () => {
  const paths = new Set(zone.paths.map((p) => p.kind));
  assert.ok(paths.has('walk') && paths.has('crossing'));
  assert.ok(zone.areas.some((a) => a.kind === 'parking'));
  assert.ok(zone.spots.some((s) => s.kind === 'tree'));
});

// ---- Small made-up maps, for the rules the saved blocks don't exercise ----
const node = (id: number, east: number, north: number, tags?: Record<string, string>) =>
  ({
    type: 'node',
    id,
    lat: store.lat + north / 111_086,
    lon: store.lon + east / 82_004,
    ...(tags ? { tags } : {}),
  }) satisfies OsmElement;
const way = (id: number, nodes: number[], tags: Record<string, string>) =>
  ({ type: 'way', id, nodes, tags }) satisfies OsmElement;

test('a street mapped against its one-way direction is turned around', () => {
  const made = buildZone(
    [
      node(1, 0, 0),
      node(2, 100, 0),
      way(10, [1, 2], { highway: 'residential', oneway: '-1', name: 'Backwards Street' }),
    ],
    spec,
  );
  const road = made.roads[0]!;
  assert.equal(road.oneway, true);
  assert.equal(road.lanes, 1);
  near(road.pts[0]!, 100, 0.2);
  near(road.pts[2]!, 0, 0.2);
});

test('a road that leaves the zone is cut where it leaves', () => {
  const made = buildZone(
    [
      node(1, 0, 0),
      node(2, 200, 0),
      node(3, 400, 0),
      node(4, 600, 0),
      way(10, [1, 2, 3, 4], { highway: 'tertiary', name: 'Long Road', maxspeed: '35 mph' }),
    ],
    spec,
  );
  assert.equal(made.roads.length, 1);
  assert.equal(made.roads[0]!.pts.length, 4);
});

test('a plain building is a shop on shopping land, a house on housing land, a shed when tiny', () => {
  const square = (id: number, x: number, y: number, side: number) => [
    node(id, x, y),
    node(id + 1, x + side, y),
    node(id + 2, x + side, y + side),
    node(id + 3, x, y + side),
  ];
  const ring = (id: number) => [id, id + 1, id + 2, id + 3, id];
  const made = buildZone(
    [
      ...square(100, -100, -100, 90),
      way(1, ring(100), { landuse: 'retail' }),
      ...square(200, 10, 10, 90),
      way(2, ring(200), { landuse: 'residential' }),
      ...square(300, -60, -60, 12),
      way(3, ring(300), { building: 'yes' }),
      ...square(400, 40, 40, 12),
      way(4, ring(400), { building: 'yes' }),
      ...square(500, 70, 70, 5),
      way(5, ring(500), { building: 'yes' }),
    ],
    spec,
  );
  assert.deepEqual(
    made.buildings.map((b) => b.kind),
    ['retail', 'house', 'shed'],
  );
});

test('a pond drawn as several ways is joined into one ring', () => {
  const made = buildZone(
    [
      node(1, 0, 0),
      node(2, 40, 0),
      node(3, 40, 30),
      node(4, 0, 30),
      way(10, [1, 2, 3], {}),
      way(11, [1, 4, 3], {}),
      {
        type: 'relation',
        id: 20,
        members: [
          { type: 'way', ref: 10, role: 'outer' },
          { type: 'way', ref: 11, role: 'outer' },
        ],
        tags: { type: 'multipolygon', natural: 'water' },
      },
    ],
    spec,
  );
  assert.deepEqual(
    made.areas.map((a) => [a.kind, a.pts.length / 2]),
    [['water', 4]],
  );
  near(Math.abs(area(made.areas[0]!.pts)), 1200, 5);
});

const square = (id: number, x: number, y: number, w: number, h = w) => [
  node(id, x, y),
  node(id + 1, x + w, y),
  node(id + 2, x + w, y + h),
  node(id + 3, x, y + h),
];
const loop = (id: number) => [id, id + 1, id + 2, id + 3, id];

test('landmarks are told apart: a school by its grounds, a gas station by its pumps', () => {
  const made = buildZone(
    [
      // A school mapped as grounds, with a plain building on them.
      ...square(100, -120, 40, 100, 80),
      way(1, loop(100), { amenity: 'school', name: 'Maple Elementary School' }),
      ...square(200, -100, 60, 40, 30),
      way(2, loop(200), { building: 'yes' }),
      // A gas station mapped as a point, beside a roof and a shop.
      node(300, 60, 60, { amenity: 'fuel', name: 'Corner Gas' }),
      ...square(310, 50, 50, 16, 12),
      way(3, loop(310), { building: 'roof' }),
      // A dealership and a church, each a named building.
      ...square(400, 40, -90, 40, 30),
      way(4, loop(400), { building: 'yes', shop: 'car', name: 'Motor City Cars' }),
      ...square(500, -90, -90, 30, 20),
      way(5, loop(500), { building: 'yes', amenity: 'place_of_worship', name: 'First Church' }),
    ],
    {
      ...spec,
      shop: { name: 'Test Pizza', lat: store.lat - 80 / 111_086, lon: store.lon + 55 / 82_004 },
    },
  );
  assert.deepEqual(
    made.buildings.map((b) => b.kind),
    ['school', 'fuel', 'dealer', 'church'],
  );
  const places = new Map(made.places.map((p) => [p.name, p]));
  // The school's place stands at its building, not in the middle of its field.
  assert.equal(places.get('Maple Elementary School')?.building, 0);
  near(places.get('Maple Elementary School')!.x, -80, 2);
  assert.equal(places.get('Corner Gas')?.kind, 'fuel');
  assert.equal(places.get('Motor City Cars')?.kind, 'dealer');
  assert.equal(places.get('First Church')?.kind, 'church');
  // The pizzeria is the shop front its point is in.
  assert.deepEqual(
    [places.get('Test Pizza')?.kind, places.get('Test Pizza')?.building],
    ['pizzeria', 2],
  );
});

test('an empty residential street gets stand-in homes; a built-up one keeps what it has', () => {
  const made = buildZone(
    [
      node(1, -140, 0),
      node(2, 140, 0),
      way(10, [1, 2], { highway: 'residential', name: 'Empty Street' }),
      // One real house on the north side, and a pond on the south.
      ...square(100, -8, 10, 14, 10),
      way(11, loop(100), { building: 'house' }),
      ...square(200, 40, -60, 60, 50),
      way(12, loop(200), { natural: 'water' }),
      // A lane behind shops gets nothing.
      node(3, -140, -120),
      node(4, 140, -120),
      way(13, [3, 4], { highway: 'service' }),
    ],
    spec,
  );
  const homes = made.buildings.filter((b) => b.made);
  assert.equal(made.buildings.filter((b) => !b.made).length, 1);
  assert.ok(homes.length >= 12 && homes.length <= 24, `${homes.length} homes`);
  for (const home of homes) {
    assert.equal(home.kind, 'house');
    assert.ok(area(home.pts) > 60, 'anticlockwise, and house-sized');
    for (let i = 0; i < home.pts.length; i += 2) {
      const [x, y] = [home.pts[i]!, home.pts[i + 1]!];
      assert.ok(Math.abs(y) > 8 && Math.abs(y) < 40, 'set back from the street, in a row');
      assert.ok(!(x > 36 && x < 104 && y < -6), 'not in the pond');
      assert.ok(!(x > -13 && x < 11 && y > 0), "not on the real house's lot");
    }
  }
  // The same map always gives the same homes.
  assert.deepEqual(
    buildZone(saved.elements, spec).buildings,
    buildZone(saved.elements, spec).buildings,
  );
});

test('the file round-trips, and names are stored once', () => {
  const file = encodeZone(zone);
  assert.deepEqual(decodeZone(JSON.parse(JSON.stringify(file)) as ZoneFile), zone);
  assert.equal(new Set(file.names).size, file.names.length);
  assert.throws(() => decodeZone({ ...file, version: 99 }), /version 99/);
});

test('the baked zone in public/ is the real one: about 245 miles of streets', () => {
  const baked = decodeZone(
    JSON.parse(
      readFileSync(
        new URL(`../../../public/zone/${site.delivery.zone}.json`, import.meta.url),
        'utf8',
      ),
    ) as ZoneFile,
  );
  const stats = zoneStats(baked);
  assert.ok(stats.streets! > 1800 && stats.streetMiles! > 220, JSON.stringify(stats));
  assert.ok(stats.buildings! > 11_000 && stats.streetNames! > 700, JSON.stringify(stats));
  assert.match(baked.credit, /OpenStreetMap contributors/);
  const names = new Set(baked.roads.map((r) => r.name));
  for (const name of ['Auburn Road', 'Dequindre Road', 'Dawes Avenue', 'Hamlin Road'])
    assert.ok(names.has(name), name);
  assert.ok(baked.roads.some((r) => r.kind === 'motorway' && r.ref.includes('59')));
  // The landmarks came along, and the streets the map left empty have homes.
  assert.ok(stats.standInHomes! > 3000 && stats.places! > 250, JSON.stringify(stats));
  const place = (kind: string, name: RegExp) =>
    baked.places.find((p) => p.kind === kind && name.test(p.name));
  const hospital = place('hospital', /Corewell Health Beaumont Troy/);
  assert.equal(baked.buildings[hospital!.building]?.kind, 'hospital');
  assert.ok(place('school', /Reuther Middle School/) && place('church', /Gethsemane/));
  assert.ok(place('dealer', /BMW/) && place('dealer', /Audi/) && place('fuel', /Marathon/));
  const shop = place('pizzeria', /Pizza/);
  assert.equal(shop?.name, site.delivery.storeName);
  assert.ok(shop!.building >= 0 && Math.hypot(shop!.x, shop!.y) < 400);
  // The store stands at a signal.
  assert.ok(baked.junctions.some((j) => j.signal && Math.hypot(j.x, j.y) < 5));
});
