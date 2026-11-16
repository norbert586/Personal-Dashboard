/**
 * The delivery zone's data and its file (ADR-037). A zone is everything the delivery mode knows
 * about the real place: the road graph, sidewalks, footprints, lots, water, parks and trees.
 * Positions are metres east (x) and north (y) of the store.
 *
 * The file is JSON with positions as whole decimetres, each line's points stored as steps from the
 * one before, so it stays small and diffs stay readable. The importer encodes; the browser decodes.
 */

export const ROAD_KINDS = [
  'motorway',
  'link',
  'primary',
  'secondary',
  'tertiary',
  'residential',
  'service',
  'aisle',
  'driveway',
] as const;
/**
 * `link` is a ramp or a turning lane, `service` a lane through an apartment complex or behind
 * shops, `aisle` a lane in a parking lot.
 */
export type RoadKind = (typeof ROAD_KINDS)[number];

export const PATH_KINDS = ['walk', 'crossing', 'trail'] as const;
/** `walk` is a sidewalk or footpath, `crossing` a crosswalk, `trail` a wider shared path. */
export type PathKind = (typeof PATH_KINDS)[number];

export const BUILDING_KINDS = [
  'house',
  'townhouse',
  'apartments',
  'mobile',
  'garage',
  'shed',
  'canopy',
  'retail',
  'commercial',
  'industrial',
  'school',
  'church',
  'civic',
  'hospital',
  'fuel',
  'dealer',
] as const;
/**
 * `mobile` is a mobile home; `canopy` is a roof on posts (a carport, a picnic shelter); `fuel` is
 * the canopy over a gas station's pumps; `dealer` is a car dealership's showroom.
 */
export type BuildingKind = (typeof BUILDING_KINDS)[number];

export const AREA_KINDS = ['water', 'park', 'wood', 'golf', 'pitch', 'parking'] as const;
export type AreaKind = (typeof AREA_KINDS)[number];

export const PLACE_KINDS = [
  'school',
  'church',
  'hospital',
  'fuel',
  'dealer',
  'shop',
  'food',
  'civic',
  'park',
  'homes',
  'pizzeria',
] as const;
/**
 * What a named place is, for its sign and its mark on the map. `shop` is a store, a bank or a
 * shopping plaza; `homes` is a named subdivision or apartment complex; `pizzeria` is the store.
 */
export type PlaceKind = (typeof PLACE_KINDS)[number];

export const POINT_KINDS = ['signal', 'stop', 'yield', 'tree', 'turn'] as const;
/** `turn` is the bulb at the end of a court, where cars turn round. */
export type PointKind = (typeof POINT_KINDS)[number];

/** A line or a ring as x, y, x, y… in metres. Rings don't repeat their first point. */
export type Line = number[];

export interface Road {
  kind: RoadKind;
  /** The street's name, or '' when it has none (lot aisles, ramps, most of M-59). */
  name: string;
  /** A route number such as "M 59", or ''. */
  ref: string;
  /** Lanes in all, both ways. */
  lanes: number;
  /** The speed limit, from the map or the usual limit for this kind of road. */
  mph: number;
  /** One-way streets run in the order of their points. */
  oneway: boolean;
  bridge: boolean;
  /** Paved in concrete, as many streets here are; otherwise asphalt. */
  concrete: boolean;
  pts: Line;
  /** Which graph node each point is, or -1 for a point between intersections. */
  nodes: number[];
}

/** Where roads meet or end. */
export interface Junction {
  x: number;
  y: number;
  signal: boolean;
}

export interface Path {
  kind: PathKind;
  pts: Line;
}

export interface Building {
  kind: BuildingKind;
  /** Storeys, when the map says; otherwise 0 and the kind decides. */
  levels: number;
  name: string;
  /** A stand-in the importer placed where the map has a street but no footprints (ADR-038). */
  made: boolean;
  pts: Line;
  /** The road its front faces, as an index into `roads`, or -1 (`addresses.ts`). */
  faces: number;
  /** The road its address is on, or -1 when it has none, and its house number, or 0. */
  street: number;
  number: number;
}

/** A place with a name: it gets a sign in the world and a mark on the map. */
export interface Place {
  kind: PlaceKind;
  name: string;
  x: number;
  y: number;
  /** The building it's in, as an index into `buildings`, or -1 when it has none. */
  building: number;
}

export interface Area {
  kind: AreaKind;
  pts: Line;
}

export interface Spot {
  kind: PointKind;
  x: number;
  y: number;
}

export interface Zone {
  /** The file's name, without its extension. */
  name: string;
  /** The date the map data was downloaded. */
  imported: string;
  /** Who the data is from, and its licence. Shown in the credits. */
  credit: string;
  store: { lat: number; lon: number };
  /** How far the zone reaches from the store, in metres. */
  radius: number;
  roads: Road[];
  junctions: Junction[];
  paths: Path[];
  buildings: Building[];
  areas: Area[];
  spots: Spot[];
  places: Place[];
}

export const ZONE_VERSION = 3;

/** Road flags in the file. */
const ONEWAY = 1;
const BRIDGE = 2;
const CONCRETE = 4;

type RoadRow = [
  kind: number,
  name: number,
  ref: number,
  lanes: number,
  mph: number,
  flags: number,
  pts: number[],
  nodes: number[],
];

/** The zone as it's written to disk. */
export interface ZoneFile {
  version: number;
  name: string;
  imported: string;
  credit: string;
  store: { lat: number; lon: number };
  radius: number;
  /** Every name and route number, once. Index 0 is ''. */
  names: string[];
  roads: RoadRow[];
  /** x, y, flags for each junction, in decimetres. */
  junctions: number[];
  paths: Array<[kind: number, pts: number[]]>;
  /** `made` is 1 for a stand-in the importer placed; `faces` and `street` are road indexes or -1. */
  buildings: Array<
    [
      kind: number,
      levels: number,
      name: number,
      pts: number[],
      made: number,
      faces: number,
      street: number,
      number: number,
    ]
  >;
  areas: Array<[kind: number, pts: number[]]>;
  /** kind, x, y for each spot, in decimetres. */
  spots: number[];
  /** kind, name, x, y in decimetres, and the building's index (or -1) for each place. */
  places: number[];
}

const dm = (metres: number) => Math.round(metres * 10);

/** Metres to decimetre steps: the first point as it is, then each point as a step from the last. */
function pack(line: Line): number[] {
  const out: number[] = [];
  let px = 0;
  let py = 0;
  for (let i = 0; i < line.length; i += 2) {
    const x = dm(line[i]!);
    const y = dm(line[i + 1]!);
    out.push(x - px, y - py);
    px = x;
    py = y;
  }
  return out;
}

function unpack(steps: number[]): Line {
  const out: Line = [];
  let x = 0;
  let y = 0;
  for (let i = 0; i < steps.length; i += 2) {
    x += steps[i]!;
    y += steps[i + 1]!;
    out.push(x / 10, y / 10);
  }
  return out;
}

export function encodeZone(zone: Zone): ZoneFile {
  const names = [''];
  const index = new Map<string, number>([['', 0]]);
  const nameOf = (name: string): number => {
    let i = index.get(name);
    if (i === undefined) {
      i = names.push(name) - 1;
      index.set(name, i);
    }
    return i;
  };
  return {
    version: ZONE_VERSION,
    name: zone.name,
    imported: zone.imported,
    credit: zone.credit,
    store: zone.store,
    radius: zone.radius,
    names,
    roads: zone.roads.map((road) => {
      // Only the points that are junctions: their place in the line, then the junction.
      const at: number[] = [];
      road.nodes.forEach((node, i) => {
        if (node >= 0) at.push(i, node);
      });
      return [
        ROAD_KINDS.indexOf(road.kind),
        nameOf(road.name),
        nameOf(road.ref),
        road.lanes,
        road.mph,
        (road.oneway ? ONEWAY : 0) | (road.bridge ? BRIDGE : 0) | (road.concrete ? CONCRETE : 0),
        pack(road.pts),
        at,
      ];
    }),
    junctions: zone.junctions.flatMap((j) => [dm(j.x), dm(j.y), j.signal ? 1 : 0]),
    paths: zone.paths.map((p) => [PATH_KINDS.indexOf(p.kind), pack(p.pts)]),
    buildings: zone.buildings.map((b) => [
      BUILDING_KINDS.indexOf(b.kind),
      b.levels,
      nameOf(b.name),
      pack(b.pts),
      b.made ? 1 : 0,
      b.faces,
      b.street,
      b.number,
    ]),
    areas: zone.areas.map((a) => [AREA_KINDS.indexOf(a.kind), pack(a.pts)]),
    spots: zone.spots.flatMap((s) => [POINT_KINDS.indexOf(s.kind), dm(s.x), dm(s.y)]),
    places: zone.places.flatMap((p) => [
      PLACE_KINDS.indexOf(p.kind),
      nameOf(p.name),
      dm(p.x),
      dm(p.y),
      p.building,
    ]),
  };
}

export function decodeZone(file: ZoneFile): Zone {
  if (file.version !== ZONE_VERSION)
    throw new Error(`This zone file is version ${file.version}; this build reads ${ZONE_VERSION}.`);
  const name = (i: number) => file.names[i] ?? '';
  const junctions: Junction[] = [];
  for (let i = 0; i < file.junctions.length; i += 3)
    junctions.push({
      x: file.junctions[i]! / 10,
      y: file.junctions[i + 1]! / 10,
      signal: file.junctions[i + 2] === 1,
    });
  const spots: Spot[] = [];
  for (let i = 0; i < file.spots.length; i += 3)
    spots.push({
      kind: POINT_KINDS[file.spots[i]!] ?? 'tree',
      x: file.spots[i + 1]! / 10,
      y: file.spots[i + 2]! / 10,
    });
  const places: Place[] = [];
  for (let i = 0; i < file.places.length; i += 5)
    places.push({
      kind: PLACE_KINDS[file.places[i]!] ?? 'shop',
      name: name(file.places[i + 1]!),
      x: file.places[i + 2]! / 10,
      y: file.places[i + 3]! / 10,
      building: file.places[i + 4]!,
    });
  return {
    name: file.name,
    imported: file.imported,
    credit: file.credit,
    store: file.store,
    radius: file.radius,
    roads: file.roads.map(([kind, nameAt, refAt, lanes, mph, flags, steps, at]) => {
      const pts = unpack(steps);
      const nodes = new Array<number>(pts.length / 2).fill(-1);
      for (let i = 0; i < at.length; i += 2) nodes[at[i]!] = at[i + 1]!;
      return {
        kind: ROAD_KINDS[kind] ?? 'residential',
        name: name(nameAt),
        ref: name(refAt),
        lanes,
        mph,
        oneway: (flags & ONEWAY) !== 0,
        bridge: (flags & BRIDGE) !== 0,
        concrete: (flags & CONCRETE) !== 0,
        pts,
        nodes,
      };
    }),
    junctions,
    paths: file.paths.map(([kind, steps]) => ({
      kind: PATH_KINDS[kind] ?? 'walk',
      pts: unpack(steps),
    })),
    buildings: file.buildings.map(([kind, levels, nameAt, steps, made, faces, street, number]) => ({
      kind: BUILDING_KINDS[kind] ?? 'house',
      levels,
      name: name(nameAt),
      made: made === 1,
      pts: unpack(steps),
      faces,
      street,
      number,
    })),
    areas: file.areas.map(([kind, steps]) => ({
      kind: AREA_KINDS[kind] ?? 'park',
      pts: unpack(steps),
    })),
    spots,
    places,
  };
}

const METRES_PER_MILE = 1609.344;

/** What's in a zone, for the importer's report and the tests. */
export function zoneStats(zone: Zone): Record<string, number> {
  const length = (pts: Line) => {
    let d = 0;
    for (let i = 2; i < pts.length; i += 2)
      d += Math.hypot(pts[i]! - pts[i - 2]!, pts[i + 1]! - pts[i - 1]!);
    return d;
  };
  const minor = new Set<RoadKind>(['service', 'aisle', 'driveway']);
  const streets = zone.roads.filter((r) => !minor.has(r.kind));
  const miles = (roads: Road[]) =>
    Math.round((roads.reduce((sum, r) => sum + length(r.pts), 0) / METRES_PER_MILE) * 10) / 10;
  return {
    streets: streets.length,
    streetMiles: miles(streets),
    streetNames: new Set(streets.map((r) => r.name).filter(Boolean)).size,
    lanesAndLots: zone.roads.length - streets.length,
    laneAndLotMiles: miles(zone.roads.filter((r) => minor.has(r.kind))),
    junctions: zone.junctions.length,
    signals: zone.junctions.filter((j) => j.signal).length,
    paths: zone.paths.length,
    buildings: zone.buildings.length,
    standInHomes: zone.buildings.filter((b) => b.made).length,
    places: zone.places.length,
    areas: zone.areas.length,
    trees: zone.spots.filter((s) => s.kind === 'tree').length,
  };
}
