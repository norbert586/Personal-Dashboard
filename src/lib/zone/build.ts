/**
 * OpenStreetMap to a delivery zone (ADR-037). Pure: it takes the elements of OSM's JSON (the OSM
 * API and Overpass share the shape) and returns the typed zone, so it's tested on a saved answer.
 * Where the map is silent (lanes on side streets, most speed limits, what a plain "building" is),
 * the usual value for that kind of road or place stands in.
 */
import type {
  Area,
  AreaKind,
  Building,
  BuildingKind,
  Junction,
  Line,
  Path,
  PathKind,
  Road,
  RoadKind,
  Spot,
  Zone,
} from './format.ts';

type Tags = Record<string, string>;
export interface OsmNode {
  type: 'node';
  id: number;
  lat: number;
  lon: number;
  tags?: Tags;
}
export interface OsmWay {
  type: 'way';
  id: number;
  nodes: number[];
  tags?: Tags;
}
export interface OsmRelation {
  type: 'relation';
  id: number;
  members: Array<{ type: string; ref: number; role: string }>;
  tags?: Tags;
}
export type OsmElement = OsmNode | OsmWay | OsmRelation;

export interface ZoneSpec {
  name: string;
  store: { lat: number; lon: number };
  /** How far the zone reaches from the store, in metres. */
  radius: number;
  /** The date the map data was downloaded. */
  imported: string;
}

/** The world goes on a little past the zone's edge, so the edge isn't a cliff. */
export const MARGIN = 150;
export const CREDIT =
  'Map data © OpenStreetMap contributors, under the Open Database License (ODbL). https://www.openstreetmap.org/copyright';

const tenth = (v: number) => Math.round(v * 10) / 10;

/**
 * Metres east and north of a point. The zone is a few miles across, so it's treated as flat, with
 * the length of a degree taken at the point's latitude (WGS 84).
 */
export function metresFrom(origin: {
  lat: number;
  lon: number;
}): (lat: number, lon: number) => [number, number] {
  const φ = (origin.lat * Math.PI) / 180;
  const perLat = 111132.92 - 559.82 * Math.cos(2 * φ) + 1.175 * Math.cos(4 * φ);
  const perLon = 111412.84 * Math.cos(φ) - 93.5 * Math.cos(3 * φ) + 0.118 * Math.cos(5 * φ);
  return (lat, lon) => [tenth((lon - origin.lon) * perLon), tenth((lat - origin.lat) * perLat)];
}

const HIGHWAY: Record<string, RoadKind> = {
  motorway: 'motorway',
  motorway_link: 'link',
  trunk: 'primary',
  trunk_link: 'link',
  primary: 'primary',
  primary_link: 'link',
  secondary: 'secondary',
  secondary_link: 'link',
  tertiary: 'tertiary',
  tertiary_link: 'link',
  unclassified: 'residential',
  residential: 'residential',
  living_street: 'residential',
  service: 'service',
};

/** What a road of each kind usually has here, when the map doesn't say. */
const USUAL: Record<RoadKind, { lanes: number; mph: number }> = {
  motorway: { lanes: 3, mph: 70 },
  link: { lanes: 1, mph: 35 },
  primary: { lanes: 4, mph: 45 },
  secondary: { lanes: 2, mph: 45 },
  tertiary: { lanes: 2, mph: 35 },
  residential: { lanes: 2, mph: 25 },
  service: { lanes: 2, mph: 15 },
  aisle: { lanes: 2, mph: 10 },
  driveway: { lanes: 1, mph: 10 },
};

function roadKind(tags: Tags): RoadKind | null {
  const kind = HIGHWAY[tags.highway ?? ''];
  if (!kind || tags.area === 'yes') return null;
  if (kind !== 'service') return kind;
  if (tags.service === 'parking_aisle' || tags.service === 'drive-through') return 'aisle';
  return tags.service === 'driveway' ? 'driveway' : 'service';
}

/** A speed limit in mph: "45 mph", or a bare number, which OSM means as km/h. */
export function parseMph(maxspeed: string | undefined): number | null {
  const match = /^(\d+(?:\.\d+)?)\s*(mph)?$/.exec(maxspeed?.trim() ?? '');
  if (!match) return null;
  const value = Number(match[1]);
  return match[2] ? value : Math.round((value * 0.621371) / 5) * 5;
}

const BUILDING: Record<string, BuildingKind> = {
  house: 'house',
  detached: 'house',
  residential: 'house',
  bungalow: 'house',
  cabin: 'house',
  farm: 'house',
  semidetached_house: 'townhouse',
  terrace: 'townhouse',
  apartments: 'apartments',
  dormitory: 'apartments',
  hotel: 'apartments',
  static_caravan: 'mobile',
  garage: 'garage',
  garages: 'garage',
  shed: 'shed',
  hut: 'shed',
  carport: 'canopy',
  roof: 'canopy',
  retail: 'retail',
  supermarket: 'retail',
  kiosk: 'retail',
  commercial: 'commercial',
  office: 'commercial',
  industrial: 'industrial',
  warehouse: 'industrial',
  school: 'school',
  university: 'school',
  college: 'school',
  kindergarten: 'school',
  church: 'church',
  chapel: 'church',
  religious: 'church',
  civic: 'civic',
  public: 'civic',
  government: 'civic',
  hospital: 'civic',
  fire_station: 'civic',
};

const SHOP_AMENITIES = new Set([
  'restaurant',
  'fast_food',
  'cafe',
  'bank',
  'fuel',
  'pharmacy',
  'bar',
  'pub',
  'car_wash',
]);

type Ring = Array<[number, number]>;

function signedArea(ring: Ring): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i]!;
    const [bx, by] = ring[(i + 1) % ring.length]!;
    sum += ax * by - bx * ay;
  }
  return sum / 2;
}

function centroid(ring: Ring): [number, number] {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  return [x / ring.length, y / ring.length];
}

function inside(ring: Ring, x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const flat = (ring: Ring): Line => ring.flat();

/** What a building tagged only "yes" most likely is, from its own tags, its size and the land it's on. */
function plainBuilding(tags: Tags, area: number, landuse: string | null): BuildingKind {
  if (tags.shop || SHOP_AMENITIES.has(tags.amenity ?? '')) return 'retail';
  if (tags.amenity === 'school') return 'school';
  if (tags.amenity === 'place_of_worship') return 'church';
  if (tags.office) return 'commercial';
  if (area < 45) return 'shed';
  if (landuse === 'retail') return 'retail';
  if (landuse === 'commercial') return 'commercial';
  if (landuse === 'industrial') return 'industrial';
  if (landuse === 'residential') return area > 600 ? 'apartments' : 'house';
  return area > 320 ? 'commercial' : 'house';
}

function areaKind(tags: Tags): AreaKind | null {
  if (tags.natural === 'water' || tags.landuse === 'basin' || tags.landuse === 'reservoir')
    return 'water';
  if (tags.leisure === 'golf_course') return 'golf';
  if (tags.leisure === 'pitch') return 'pitch';
  if (
    ['park', 'nature_reserve', 'playground', 'garden', 'dog_park'].includes(tags.leisure ?? '') ||
    ['recreation_ground', 'village_green', 'cemetery'].includes(tags.landuse ?? '')
  )
    return 'park';
  if (tags.natural === 'wood' || tags.natural === 'scrub' || tags.landuse === 'forest')
    return 'wood';
  if (tags.amenity === 'parking' && tags.parking !== 'underground' && !tags.building)
    return 'parking';
  return null;
}

function pathKind(tags: Tags): PathKind | null {
  const h = tags.highway;
  if (tags.area === 'yes' || tags.indoor === 'yes') return null;
  if (h === 'cycleway') return 'trail';
  if (h !== 'footway' && h !== 'path' && h !== 'pedestrian') return null;
  if (tags.footway === 'crossing' || tags.path === 'crossing') return 'crossing';
  return h === 'path' && tags.bicycle === 'designated' ? 'trail' : 'walk';
}

/** Join the ways of a multipolygon's outline end to end into closed rings of node ids. */
function stitch(ways: number[][]): number[][] {
  const rings: number[][] = [];
  const open = ways.filter((w) => w.length > 1).map((w) => [...w]);
  while (open.length) {
    const ring = open.pop()!;
    let grew = true;
    while (ring[0] !== ring.at(-1) && grew) {
      grew = false;
      for (let i = 0; i < open.length; i++) {
        const next = open[i]!;
        if (next[0] === ring.at(-1)) ring.push(...next.slice(1));
        else if (next.at(-1) === ring.at(-1)) ring.push(...next.reverse().slice(1));
        else continue;
        open.splice(i, 1);
        grew = true;
        break;
      }
    }
    if (ring[0] === ring.at(-1) && ring.length > 3) rings.push(ring);
  }
  return rings;
}

export function buildZone(elements: readonly OsmElement[], spec: ZoneSpec): Zone {
  const metres = metresFrom(spec.store);
  const reach = spec.radius + MARGIN;
  const within = (p: readonly [number, number]) => Math.hypot(p[0], p[1]) <= reach;

  const at = new Map<number, [number, number]>();
  const nodeTags = new Map<number, Tags>();
  const ways: OsmWay[] = [];
  const wayById = new Map<number, OsmWay>();
  const relations: OsmRelation[] = [];
  for (const el of elements) {
    if (el.type === 'node') {
      if (at.has(el.id)) continue;
      at.set(el.id, metres(el.lat, el.lon));
      if (el.tags) nodeTags.set(el.id, el.tags);
    } else if (el.type === 'way') {
      if (wayById.has(el.id)) continue;
      wayById.set(el.id, el);
      ways.push(el);
    } else if (!relations.some((r) => r.id === el.id)) relations.push(el);
  }
  ways.sort((a, b) => a.id - b.id);
  relations.sort((a, b) => a.id - b.id);

  /** A closed way or ring of node ids as points, anticlockwise, without the repeated last point. */
  const ringOf = (ids: readonly number[]): Ring | null => {
    if (ids.length < 4 || ids[0] !== ids.at(-1)) return null;
    const ring: Ring = [];
    for (const id of ids.slice(0, -1)) {
      const p = at.get(id);
      if (!p) return null;
      const last = ring.at(-1);
      if (!last || last[0] !== p[0] || last[1] !== p[1]) ring.push(p);
    }
    if (ring.length < 3 || Math.abs(signedArea(ring)) < 0.5) return null;
    return signedArea(ring) < 0 ? ring.reverse() : ring;
  };

  /** A way cut down to the stretches inside the zone, as runs of node ids. */
  const runsOf = (ids: readonly number[]): number[][] => {
    const runs: number[][] = [];
    let run: number[] = [];
    for (const id of ids) {
      const p = at.get(id);
      if (p && within(p)) {
        // Two nodes can round to the same spot; the first stands for both.
        const last = run.at(-1);
        const q = last === undefined ? undefined : at.get(last);
        if (!q || q[0] !== p[0] || q[1] !== p[1]) run.push(id);
      } else {
        if (run.length > 1) runs.push(run);
        run = [];
      }
    }
    if (run.length > 1) runs.push(run);
    return runs;
  };

  // ---- Roads, and the graph they make ----
  const drafts: Array<{ road: Omit<Road, 'nodes'>; ids: number[] }> = [];
  for (const way of ways) {
    const tags = way.tags ?? {};
    const kind = roadKind(tags);
    if (!kind) continue;
    const backwards = tags.oneway === '-1';
    const oneway =
      backwards ||
      ['yes', 'true', '1'].includes(tags.oneway ?? '') ||
      kind === 'motorway' ||
      tags.junction === 'roundabout';
    const lanes = Number.parseInt(tags.lanes ?? '', 10);
    const usual = USUAL[kind];
    for (const run of runsOf(way.nodes)) {
      const ids = backwards ? [...run].reverse() : run;
      drafts.push({
        ids,
        road: {
          kind,
          name: tags.name ?? '',
          ref: tags.ref ?? '',
          lanes:
            lanes > 0
              ? lanes
              : oneway && kind !== 'motorway'
                ? Math.max(1, usual.lanes / 2)
                : usual.lanes,
          mph: parseMph(tags.maxspeed) ?? usual.mph,
          oneway,
          bridge: Boolean(tags.bridge) && tags.bridge !== 'no',
          pts: ids.flatMap((id) => at.get(id)!),
        },
      });
    }
  }
  // A point is a junction where a road ends, or where it's used more than once.
  const uses = new Map<number, number>();
  for (const { ids } of drafts) {
    ids.forEach((id, i) => {
      const ends = i === 0 || i === ids.length - 1;
      uses.set(id, (uses.get(id) ?? 0) + (ends ? 2 : 1));
    });
  }
  const junctionIds = [...uses].filter(([, n]) => n > 1).map(([id]) => id);
  junctionIds.sort((a, b) => a - b);
  const junctionAt = new Map(junctionIds.map((id, i) => [id, i]));
  const junctions: Junction[] = junctionIds.map((id) => {
    const [x, y] = at.get(id)!;
    return { x, y, signal: nodeTags.get(id)?.highway === 'traffic_signals' };
  });
  const roads: Road[] = drafts.map(({ road, ids }) => ({
    ...road,
    nodes: ids.map((id) => junctionAt.get(id) ?? -1),
  }));

  // ---- Signs, signals and trees ----
  const spots: Spot[] = [];
  const CONTROL: Record<string, Spot['kind']> = {
    traffic_signals: 'signal',
    stop: 'stop',
    give_way: 'yield',
  };
  for (const id of [...nodeTags.keys()].sort((a, b) => a - b)) {
    const tags = nodeTags.get(id)!;
    const p = at.get(id)!;
    if (!within(p)) continue;
    const control = CONTROL[tags.highway ?? ''];
    if (control && uses.has(id)) spots.push({ kind: control, x: p[0], y: p[1] });
    else if (tags.natural === 'tree') spots.push({ kind: 'tree', x: p[0], y: p[1] });
  }

  // ---- Sidewalks, crosswalks and trails ----
  const paths: Path[] = [];
  for (const way of ways) {
    const kind = pathKind(way.tags ?? {});
    if (!kind) continue;
    for (const run of runsOf(way.nodes))
      paths.push({ kind, pts: run.flatMap((id) => at.get(id)!) });
  }

  // ---- Land: water, parks, woods, lots, and what plain buildings stand on ----
  const areas: Area[] = [];
  const landuse: Array<{ kind: string; ring: Ring }> = [];
  const addArea = (tags: Tags, ids: readonly number[]) => {
    const ring = ringOf(ids);
    if (!ring) return;
    if (['retail', 'commercial', 'industrial', 'residential'].includes(tags.landuse ?? ''))
      landuse.push({ kind: tags.landuse!, ring });
    const kind = areaKind(tags);
    if (kind && ring.some(within)) areas.push({ kind, pts: flat(ring) });
  };
  const buildings: Building[] = [];
  /** Buildings tagged only "yes": sorted out once every landuse is known. */
  const plain: Array<{ building: Building; tags: Tags; ring: Ring }> = [];
  const addBuilding = (tags: Tags, ids: readonly number[]) => {
    const ring = ringOf(ids);
    if (!ring || !within(centroid(ring))) return;
    buildings.push({
      kind: BUILDING[tags.building ?? ''] ?? 'house',
      levels: Math.max(0, Math.round(Number.parseFloat(tags['building:levels'] ?? '') || 0)),
      name: tags.name ?? '',
      pts: flat(ring),
    });
    if (!BUILDING[tags.building ?? '']) plain.push({ building: buildings.at(-1)!, tags, ring });
  };
  for (const way of ways) {
    const tags = way.tags ?? {};
    if (tags.building && tags.building !== 'no') addBuilding(tags, way.nodes);
    else addArea(tags, way.nodes);
  }
  for (const relation of relations) {
    const tags = relation.tags ?? {};
    if (tags.type !== 'multipolygon') continue;
    const outline = relation.members
      .filter((m) => m.type === 'way' && m.role !== 'inner')
      .map((m) => wayById.get(m.ref)?.nodes ?? []);
    for (const ring of stitch(outline))
      if (tags.building && tags.building !== 'no') addBuilding(tags, ring);
      else addArea(tags, ring);
  }
  for (const { building, tags, ring } of plain) {
    const [cx, cy] = centroid(ring);
    const on = landuse.find((l) => inside(l.ring, cx, cy))?.kind ?? null;
    building.kind = plainBuilding(tags, Math.abs(signedArea(ring)), on);
  }

  return {
    name: spec.name,
    imported: spec.imported,
    credit: CREDIT,
    store: spec.store,
    radius: spec.radius,
    roads,
    junctions,
    paths,
    buildings,
    areas,
    spots,
  };
}
