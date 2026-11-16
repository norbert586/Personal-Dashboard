/**
 * Addresses (ADR-042): which street every building faces, and a house number on a street. Run by
 * the importer, so the browser only reads the answer; pure and steady, so the same zone always
 * gives the same numbers.
 *
 * Numbers follow one grid across the whole zone, as in Macomb and Oakland: a street that runs
 * east and west counts with how far east its door is, one that runs north and south with how far
 * north, about 2,000 numbers a mile and five digits everywhere in the zone. So the next street
 * over has neighbouring numbers. Even numbers are on the north and east sides, odd on the south
 * and west, and along one side of a street they always rise and never repeat. They don't match the
 * real houses, which keeps any real home out of an order.
 */
import type { Building, BuildingKind, Road } from './format.ts';

type XY = readonly [number, number];

export interface Address {
  /** The road the building faces, as an index into `roads`, or -1: its front wall looks at it. */
  faces: number;
  /** The road its address is on (a named one), or -1 when it has no address. */
  street: number;
  /** Its house number, or 0 when it has none. */
  number: number;
}

/** Buildings that face the nearest street; everything else faces the main road when in reach. */
const HOMES: ReadonlySet<BuildingKind> = new Set([
  'house',
  'townhouse',
  'apartments',
  'mobile',
  'garage',
  'shed',
]);
/** Buildings that get no number: outbuildings and roofs on posts. */
const UNNUMBERED: ReadonlySet<BuildingKind> = new Set(['garage', 'shed', 'canopy', 'fuel']);
const MAIN = new Set(['primary', 'secondary', 'tertiary']);
const NOT_A_STREET = new Set(['motorway', 'link', 'driveway']);

/** Numbers a metre (about 2,000 a mile), and the number at the store. */
const PER_METRE = 1.243;
const BASE = 45000;
/** How far a building looks for a named street when the one it faces has no name. */
const NAMED_REACH = 150;
const CELL = 64;

/** The centre of a ring: the average of its corners. */
export function centreOf(ring: readonly XY[]): XY {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  return [x / ring.length, y / ring.length];
}

/** The wall that most faces the street (longer walls first), and how each wall faces it. */
export function frontOfRing(
  ring: readonly XY[],
  front: XY | null,
): { frontEdge: number; facing: number[] } {
  let frontEdge = -1;
  let best = 0;
  const facing: number[] = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const c = ring[(i + 1) % n]!;
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
    const dot = front ? ((c[1] - a[1]) / len) * front[0] - ((c[0] - a[0]) / len) * front[1] : 0;
    facing.push(dot);
    if (dot > 0.35 && dot * len > best) {
      best = dot * len;
      frontEdge = i;
    }
  }
  return { frontEdge, facing };
}

/** The point on a road's centre line nearest a point. */
export function nearestOnRoad(
  road: Road,
  x: number,
  y: number,
): { x: number; y: number; d: number } {
  let best = { x: road.pts[0]!, y: road.pts[1]!, d: Infinity };
  for (let i = 0; i + 3 < road.pts.length; i += 2) {
    const p = closest(road.pts[i]!, road.pts[i + 1]!, road.pts[i + 2]!, road.pts[i + 3]!, x, y);
    if (p.d < best.d) best = p;
  }
  if (best.d === Infinity) best.d = Math.hypot(best.x - x, best.y - y);
  return best;
}

function closest(ax: number, ay: number, bx: number, by: number, x: number, y: number) {
  const ex = bx - ax;
  const ey = by - ay;
  const len2 = ex * ex + ey * ey;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / len2)) : 0;
  const px = ax + ex * t;
  const py = ay + ey * t;
  return { x: px, y: py, d: Math.hypot(x - px, y - py) };
}

/** Every road's segments in coarse squares, for "which road is nearest?". */
class Segments {
  private readonly cells = new Map<number, number[]>();
  private readonly segs: number[] = [];

  constructor(roads: readonly Road[]) {
    roads.forEach((road, r) => {
      for (let i = 0; i + 3 < road.pts.length; i += 2) {
        const at = this.segs.length;
        const [ax, ay, bx, by] = [
          road.pts[i]!,
          road.pts[i + 1]!,
          road.pts[i + 2]!,
          road.pts[i + 3]!,
        ];
        this.segs.push(ax, ay, bx, by, r);
        for (
          let cx = Math.floor(Math.min(ax, bx) / CELL);
          cx <= Math.floor(Math.max(ax, bx) / CELL);
          cx++
        )
          for (
            let cy = Math.floor(Math.min(ay, by) / CELL);
            cy <= Math.floor(Math.max(ay, by) / CELL);
            cy++
          ) {
            const k = (cx + 4096) * 8192 + (cy + 4096);
            const list = this.cells.get(k);
            if (list) list.push(at);
            else this.cells.set(k, [at]);
          }
      }
    });
  }

  /** The nearest road within `reach` that `accept` lets through, and its nearest point. */
  nearest(x: number, y: number, reach: number, accept: (road: number) => boolean) {
    let best: { id: number; x: number; y: number; d: number } | null = null;
    const seen = new Set<number>();
    for (let cx = Math.floor((x - reach) / CELL); cx <= Math.floor((x + reach) / CELL); cx++)
      for (let cy = Math.floor((y - reach) / CELL); cy <= Math.floor((y + reach) / CELL); cy++)
        for (const at of this.cells.get((cx + 4096) * 8192 + (cy + 4096)) ?? []) {
          if (seen.has(at)) continue;
          seen.add(at);
          const s = this.segs;
          const id = s[at + 4]!;
          if (!accept(id)) continue;
          const p = closest(s[at]!, s[at + 1]!, s[at + 2]!, s[at + 3]!, x, y);
          // Ties go to the road listed first, whatever order the squares are visited in.
          if (p.d > reach || (best && (p.d > best.d || (p.d === best.d && id >= best.id))))
            continue;
          best = { id, ...p };
        }
    return best;
  }
}

/**
 * Which way a building faces: a home faces the nearest street that isn't a freeway, a ramp or a
 * driveway; a shop, a school or a hospital faces the main road when one is in reach, since that's
 * where its sign and its front door are.
 */
function facingRoad(roads: readonly Road[], grid: Segments, b: Building, ring: readonly XY[]) {
  const [cx, cy] = centreOf(ring);
  const home = HOMES.has(b.kind);
  const reach = home ? 90 : Math.max(220, Math.sqrt(Math.abs(area2(ring)) / 2) * 1.6);
  const main = home ? null : grid.nearest(cx, cy, reach, (id) => MAIN.has(roads[id]!.kind));
  const near = main ?? grid.nearest(cx, cy, reach, (id) => !NOT_A_STREET.has(roads[id]!.kind));
  return near && near.d >= 0.5 ? near : null;
}

function area2(ring: readonly XY[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum;
}

const ringOf = (pts: readonly number[]): XY[] => {
  const out: XY[] = [];
  for (let i = 0; i < pts.length; i += 2) out.push([pts[i]!, pts[i + 1]!]);
  return out;
};

/** The middle of a building's front wall: its front door. */
export function doorOf(ring: readonly XY[], front: XY | null): XY {
  const { frontEdge } = frontOfRing(ring, front);
  if (frontEdge < 0) return centreOf(ring);
  const a = ring[frontEdge]!;
  const c = ring[(frontEdge + 1) % ring.length]!;
  return [(a[0] + c[0]) / 2, (a[1] + c[1]) / 2];
}

/** Every building's street and number. */
export function addresses(roads: readonly Road[], buildings: readonly Building[]): Address[] {
  const grid = new Segments(roads);
  const named = (id: number) => roads[id]!.name !== '' && !NOT_A_STREET.has(roads[id]!.kind);

  // Which way each street name runs: east and west, or north and south, by its spread.
  const runsEast = new Map<string, boolean>();
  const spread = new Map<string, [number, number, number, number]>();
  for (const road of roads) {
    if (!road.name) continue;
    const s = spread.get(road.name) ?? [Infinity, Infinity, -Infinity, -Infinity];
    for (let i = 0; i < road.pts.length; i += 2) {
      s[0] = Math.min(s[0], road.pts[i]!);
      s[1] = Math.min(s[1], road.pts[i + 1]!);
      s[2] = Math.max(s[2], road.pts[i]!);
      s[3] = Math.max(s[3], road.pts[i + 1]!);
    }
    spread.set(road.name, s);
  }
  for (const [name, s] of spread) runsEast.set(name, s[2] - s[0] >= s[3] - s[1]);

  const out: Address[] = [];
  // Doors waiting for a number, by street name and side.
  const sides = new Map<string, Array<{ i: number; along: number }>>();
  buildings.forEach((b, i) => {
    const ring = ringOf(b.pts);
    const none: Address = { faces: -1, street: -1, number: 0 };
    if (ring.length < 3) return out.push(none);
    const [cx, cy] = centreOf(ring);
    const faced = facingRoad(roads, grid, b, ring);
    const front: XY | null = faced ? [(faced.x - cx) / faced.d, (faced.y - cy) / faced.d] : null;
    const address: Address = { ...none, faces: faced?.id ?? -1 };
    out.push(address);
    if (UNNUMBERED.has(b.kind)) return;
    const door = doorOf(ring, front);
    const street =
      faced && named(faced.id) ? faced : grid.nearest(door[0], door[1], NAMED_REACH, named);
    if (!street) return;
    address.street = street.id;
    const name = roads[street.id]!.name;
    const east = runsEast.get(name)!;
    // North or east of the street is the even side.
    const even = east ? door[1] > street.y : door[0] > street.x;
    const key = `${name}\n${even ? 0 : 1}`;
    const list = sides.get(key) ?? [];
    list.push({ i, along: east ? door[0] : door[1] });
    sides.set(key, list);
  });

  for (const [key, list] of sides) {
    const odd = key.endsWith('1') ? 1 : 0;
    list.sort((a, b) => a.along - b.along || a.i - b.i);
    let last = -Infinity;
    for (const { i, along } of list) {
      let n = 2 * Math.round((BASE + along * PER_METRE) / 2) + odd;
      if (n <= last) n = last + 2;
      out[i]!.number = n;
      last = n;
    }
  }
  return out;
}
