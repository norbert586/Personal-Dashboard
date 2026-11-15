/**
 * Buildings from their real footprints (DESIGN: Delivery mode). The map gives the outline and
 * the kind; the rest is the usual for that kind of building here: storeys, siding or brick, a
 * shingled roof. Walls are cut into bays about 4 m wide, each wearing a window, a door, a garage
 * door, a shop front or plain wall. The front is the side facing the nearest street.
 */
import { ShapeUtils, Vector2 } from 'three';
import type { Building, BuildingKind } from '../../lib/zone/format.ts';
import type { MeshBuilder } from './mesh.ts';
import { TILE, area2, centre, points, rnd, type P3, type Tint, type XY } from './space.ts';
import { T } from './tiles.ts';

type Wall = 'siding' | 'brick' | 'stucco' | 'block' | 'tin';
type Roof = 'pitched' | 'flat' | 'canopy';

interface Style {
  wall: Wall[];
  roof: Roof;
  /** Height of one storey, in metres. */
  storey: number;
  /** Rise over run of a pitched roof. */
  pitch: number;
  /** The share of windows lit at night. */
  lit: number;
}

const STYLE: Record<BuildingKind, Style> = {
  house: {
    wall: ['siding', 'siding', 'brick'],
    roof: 'pitched',
    storey: 2.9,
    pitch: 0.5,
    lit: 0.55,
  },
  townhouse: { wall: ['brick', 'siding'], roof: 'pitched', storey: 2.9, pitch: 0.5, lit: 0.55 },
  apartments: {
    wall: ['brick', 'brick', 'siding'],
    roof: 'pitched',
    storey: 2.9,
    pitch: 0.38,
    lit: 0.5,
  },
  mobile: { wall: ['siding'], roof: 'pitched', storey: 2.5, pitch: 0.14, lit: 0.5 },
  garage: { wall: ['siding'], roof: 'pitched', storey: 2.6, pitch: 0.42, lit: 0 },
  shed: { wall: ['siding', 'tin'], roof: 'pitched', storey: 2.1, pitch: 0.35, lit: 0 },
  canopy: { wall: ['stucco'], roof: 'canopy', storey: 4.6, pitch: 0, lit: 0 },
  retail: { wall: ['stucco', 'brick'], roof: 'flat', storey: 5, pitch: 0, lit: 0.85 },
  commercial: { wall: ['stucco', 'brick'], roof: 'flat', storey: 4.1, pitch: 0, lit: 0.35 },
  industrial: { wall: ['tin', 'block'], roof: 'flat', storey: 7, pitch: 0, lit: 0.2 },
  school: { wall: ['brick'], roof: 'flat', storey: 4.6, pitch: 0, lit: 0.15 },
  church: { wall: ['brick'], roof: 'pitched', storey: 6.5, pitch: 0.95, lit: 0.3 },
  civic: { wall: ['brick', 'stucco'], roof: 'flat', storey: 4.2, pitch: 0, lit: 0.3 },
};

/** The tiles a wall wears, by what's in the bay. */
const BAYS: Record<Wall, { window: number; blank: number; door: number; garage: number }> = {
  siding: {
    window: T.sidingWindow,
    blank: T.sidingBlank,
    door: T.sidingDoor,
    garage: T.sidingGarage,
  },
  brick: { window: T.brickWindow, blank: T.brickBlank, door: T.brickDoor, garage: T.sidingGarage },
  stucco: { window: T.stuccoWindow, blank: T.stuccoBlank, door: T.stuccoDoor, garage: T.tinDoor },
  block: { window: T.block, blank: T.block, door: T.tinDoor, garage: T.tinDoor },
  tin: { window: T.tin, blank: T.tin, door: T.tinDoor, garage: T.tinDoor },
};

const TINTS: Record<Wall, Tint[]> = {
  siding: [
    [0.98, 0.98, 0.96],
    [0.95, 0.9, 0.76],
    [0.86, 0.79, 0.66],
    [0.74, 0.76, 0.78],
    [0.62, 0.7, 0.78],
    [0.68, 0.76, 0.66],
    [0.78, 0.68, 0.54],
    [0.93, 0.86, 0.6],
    [0.62, 0.5, 0.42],
  ],
  brick: [
    [1, 1, 1],
    [1.12, 0.95, 0.85],
    [0.82, 0.78, 0.8],
    [1.2, 1.1, 0.92],
  ],
  stucco: [
    [1, 1, 1],
    [1.06, 1.03, 0.96],
    [0.9, 0.9, 0.93],
    [1, 0.92, 0.85],
  ],
  block: [
    [1, 1, 1],
    [1.08, 1.06, 1],
  ],
  tin: [
    [1, 1, 1],
    [1.1, 1.05, 0.95],
    [0.85, 0.9, 0.85],
  ],
};

const SHINGLES: Tint[] = [
  [0.36, 0.37, 0.4],
  [0.5, 0.4, 0.33],
  [0.55, 0.55, 0.55],
  [0.4, 0.46, 0.42],
  [0.56, 0.36, 0.32],
  [0.28, 0.28, 0.3],
];
const PLAIN: Tint = [1, 1, 1];

/** How many storeys a building has: the map's count, or the usual for its kind and size. */
export function storeysOf(b: Building, area: number, seed: number): number {
  if (b.levels > 0) return Math.min(b.levels, 12);
  const roll = rnd(seed, 11);
  switch (b.kind) {
    case 'house':
      return area > 110 && area < 260 && roll < 0.4 ? 2 : 1;
    case 'townhouse':
      return 2;
    case 'apartments':
      return roll < 0.5 ? 2 : 3;
    case 'commercial':
      return area < 1500 && roll < 0.3 ? 2 : 1;
    default:
      return 1;
  }
}

/** How tall a building's walls stand, in metres. */
export function wallHeight(b: Building, area: number, seed: number): number {
  if (b.kind === 'canopy') return area < 70 ? 2.5 : 4.8;
  return STYLE[b.kind].storey * storeysOf(b, area, seed);
}

/** Fill a flat ring with triangles that face up. */
export function fill(
  out: MeshBuilder,
  ring: readonly XY[],
  h: number,
  layer: number,
  tint: Tint,
): void {
  if (ring.length < 3) return;
  const contour = ring.map((p) => new Vector2(p[0], p[1]));
  for (const [i, j, k] of ShapeUtils.triangulateShape(contour, []) as number[][]) {
    const a = ring[i!]!;
    const b = ring[j!]!;
    const c = ring[k!]!;
    const up = (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]) > 0;
    const pa: P3 = [a[0], a[1], h];
    const pb: P3 = [b[0], b[1], h];
    const pc: P3 = [c[0], c[1], h];
    if (up) out.flat(pa, pb, pc, layer, tint);
    else out.flat(pa, pc, pb, layer, tint);
  }
}

/** A ring pushed outward by `d` metres (the ring runs anticlockwise). */
function grown(ring: readonly XY[], d: number): XY[] {
  const n = ring.length;
  return ring.map((b, i) => {
    const a = ring[(i + n - 1) % n]!;
    const c = ring[(i + 1) % n]!;
    const il = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const ol = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
    // Outward is to the right of the way the ring runs.
    let nx = (b[1] - a[1]) / il + (c[1] - b[1]) / ol;
    let ny = -(b[0] - a[0]) / il - (c[0] - b[0]) / ol;
    const nl = Math.hypot(nx, ny) || 1;
    nx /= nl;
    ny /= nl;
    return [b[0] + nx * d, b[1] + ny * d] as const;
  });
}

function isRectangle(ring: readonly XY[]): boolean {
  if (ring.length !== 4) return false;
  for (let i = 0; i < 4; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % 4]!;
    const c = ring[(i + 2) % 4]!;
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const vx = c[0] - b[0];
    const vy = c[1] - b[1];
    const cos = (ux * vx + uy * vy) / ((Math.hypot(ux, uy) || 1) * (Math.hypot(vx, vy) || 1));
    if (Math.abs(cos) > 0.26) return false;
  }
  return true;
}

const up = (p: XY, h: number): P3 => [p[0], p[1], h];
const lerp = (a: XY, b: XY, t: number): XY => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];

/** A sloped roof face: the texture runs along the eave and up the slope. */
function slope(out: MeshBuilder, e0: P3, e1: P3, r1: P3, r0: P3, layer: number, tint: Tint): void {
  const along = Math.hypot(e1[0] - e0[0], e1[1] - e0[1]) || 1;
  const ux = (e1[0] - e0[0]) / along;
  const uy = (e1[1] - e0[1]) / along;
  const uv = (p: P3): [number, number] => {
    const dx = p[0] - e0[0];
    const dy = p[1] - e0[1];
    const u = dx * ux + dy * uy;
    const across = Math.hypot(dx - ux * u, dy - uy * u);
    return [u / TILE, Math.hypot(across, p[2] - e0[2]) / TILE];
  };
  const [a, b, c, d] = [uv(e0), uv(e1), uv(r1), uv(r0)];
  out.tri(e0, e1, r1, a[0], a[1], b[0], b[1], c[0], c[1], layer, tint);
  out.tri(e0, r1, r0, a[0], a[1], c[0], c[1], d[0], d[1], layer, tint);
}

/**
 * Add one building. `seed` keeps its look steady from visit to visit; `front` is the unit
 * direction from the building toward its street, or null when there's none nearby.
 */
export function addBuilding(out: MeshBuilder, b: Building, seed: number, front: XY | null): void {
  const ring = points(b.pts);
  if (ring.length < 3) return;
  const area = Math.abs(area2(ring)) / 2;
  const style = STYLE[b.kind];
  const storeys = storeysOf(b, area, seed);
  const H = wallHeight(b, area, seed);
  if (style.roof === 'canopy') return canopy(out, ring, H, area);

  const wall = style.wall[Math.floor(rnd(seed, 1) * style.wall.length)]!;
  const bays = BAYS[wall];
  const tints = TINTS[wall];
  const tint = tints[Math.floor(rnd(seed, 2) * tints.length)]!;
  const n = ring.length;

  // The front wall: the one that most faces the street, longer walls first.
  let frontEdge = -1;
  let best = 0;
  const facing: number[] = [];
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

  const base = style.storey;
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const c = ring[(i + 1) % n]!;
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    const count = len < 2.2 ? 0 : Math.max(1, Math.round(len / 4));
    if (count === 0) {
      out.quad(
        up(a, 0),
        up(c, 0),
        up(c, H),
        up(a, H),
        0,
        0,
        len / TILE,
        storeys / 2,
        bays.blank,
        tint,
      );
      continue;
    }
    const isFront = i === frontEdge;
    const shopFront = b.kind === 'retail' && facing[i]! > 0.35;
    const door = Math.floor(count / 2);
    // A house with room for it has its garage at one end of the front.
    const garage =
      b.kind === 'garage'
        ? door
        : b.kind === 'house' && isFront && count >= 3
          ? rnd(seed, 3) < 0.5
            ? 0
            : count - 1
          : -1;
    for (let k = 0; k < count; k++) {
      const p0 = lerp(a, c, k / count);
      const p1 = lerp(a, c, (k + 1) / count);
      const roll = rnd(seed * 31 + i, k);
      let layer = roll < 0.22 ? bays.blank : bays.window;
      if (b.kind === 'garage' || b.kind === 'shed' || b.kind === 'industrial') layer = bays.blank;
      if (shopFront) layer = k % 3 === 1 ? T.stuccoDoor : T.stuccoShop;
      else if (isFront && k === garage) layer = bays.garage;
      else if (isFront && k === door && b.kind !== 'shed') layer = bays.door;
      const glow = rnd(seed * 17 + i, k + 40) < style.lit ? 0.55 + 0.45 * roll : 0;
      out.quad(up(p0, 0), up(p1, 0), up(p1, base), up(p0, base), 0, 0, 0.5, 0.5, layer, tint, glow);
      if (storeys > 1) {
        const upper = roll > 0.85 ? bays.blank : bays.window;
        const lit = rnd(seed * 13 + i, k + 80) < style.lit ? 0.5 + 0.5 * roll : 0;
        out.quad(
          up(p0, base),
          up(p1, base),
          up(p1, H),
          up(p0, H),
          0,
          0,
          0.5,
          (storeys - 1) / 2,
          upper,
          tint,
          lit,
        );
      }
    }
  }

  if (style.roof === 'flat') {
    fill(out, ring, H - 0.4, T.flatRoof, PLAIN);
    return;
  }
  const metal = b.kind === 'mobile';
  const roofLayer = metal ? T.metalRoof : T.shingle;
  const roofTint = metal ? PLAIN : SHINGLES[Math.floor(rnd(seed, 4) * SHINGLES.length)]!;
  if (isRectangle(ring))
    gable(out, ring, H, style.pitch, roofLayer, roofTint, bays.blank, tint, base);
  else hip(out, ring, H, area, style.pitch, roofLayer, roofTint);
}

/** A gable roof on a rectangle: the ridge runs the long way, with eaves that overhang. */
function gable(
  out: MeshBuilder,
  ring: readonly XY[],
  H: number,
  pitch: number,
  layer: number,
  tint: Tint,
  wallLayer: number,
  wallTint: Tint,
  storey: number,
): void {
  const long0 = Math.hypot(ring[1]![0] - ring[0]![0], ring[1]![1] - ring[0]![1]);
  const long1 = Math.hypot(ring[2]![0] - ring[1]![0], ring[2]![1] - ring[1]![1]);
  const turn = long0 >= long1 ? 0 : 1;
  const [p0, p1, p2, p3] = [0, 1, 2, 3].map((i) => ring[(i + turn) % 4]!) as [XY, XY, XY, XY];
  const len = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
  const dx = (p1[0] - p0[0]) / len;
  const dy = (p1[1] - p0[1]) / len;
  // Outward from the first long wall is to the right of the way the ring runs.
  const ox = dy;
  const oy = -dx;
  const half = Math.hypot(p2[0] - p1[0], p2[1] - p1[1]) / 2;
  const rise = half * pitch;
  const eave = 0.4;
  const rake = 0.3;
  const low = H - eave * pitch;
  const top = H + rise;
  const ridgeA = lerp(p3, p0, 0.5);
  const ridgeB = lerp(p1, p2, 0.5);
  const e0: P3 = [p0[0] + ox * eave - dx * rake, p0[1] + oy * eave - dy * rake, low];
  const e1: P3 = [p1[0] + ox * eave + dx * rake, p1[1] + oy * eave + dy * rake, low];
  const e2: P3 = [p2[0] - ox * eave + dx * rake, p2[1] - oy * eave + dy * rake, low];
  const e3: P3 = [p3[0] - ox * eave - dx * rake, p3[1] - oy * eave - dy * rake, low];
  const rA: P3 = [ridgeA[0] - dx * rake, ridgeA[1] - dy * rake, top];
  const rB: P3 = [ridgeB[0] + dx * rake, ridgeB[1] + dy * rake, top];
  slope(out, e0, e1, rB, rA, layer, tint);
  slope(out, e2, e3, rA, rB, layer, tint);
  // The gable ends: wall, up to the ridge.
  const w = (half * 2) / TILE;
  const v = (rise / storey) * 0.5;
  out.tri(up(p1, H), up(p2, H), up(ridgeB, top), 0, 0, w, 0, w / 2, v, wallLayer, wallTint);
  out.tri(up(p3, H), up(p0, H), up(ridgeA, top), 0, 0, w, 0, w / 2, v, wallLayer, wallTint);
}

/** A hip roof on any outline: the eaves overhang, and the faces lean in to a small flat top. */
function hip(
  out: MeshBuilder,
  ring: readonly XY[],
  H: number,
  area: number,
  pitch: number,
  layer: number,
  tint: Tint,
): void {
  const mid = centre(ring);
  const rise = Math.min(3.4, Math.sqrt(area) * 0.42 * pitch);
  const outer = grown(ring, 0.38);
  const inner = ring.map((p): XY => [
    mid[0] + (p[0] - mid[0]) * 0.3,
    mid[1] + (p[1] - mid[1]) * 0.3,
  ]);
  const low = H - 0.14;
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    slope(
      out,
      up(outer[i]!, low),
      up(outer[j]!, low),
      up(inner[j]!, H + rise),
      up(inner[i]!, H + rise),
      layer,
      tint,
    );
  }
  fill(out, inner, H + rise, layer, tint);
}

/** A roof on posts: a carport, or the canopy over a gas station's pumps. */
function canopy(out: MeshBuilder, ring: readonly XY[], H: number, area: number): void {
  const thick = area < 70 ? 0.2 : 0.7;
  const n = ring.length;
  fill(out, ring, H, T.flatRoof, PLAIN);
  for (let i = 0; i < n; i++) {
    const a = ring[i]!;
    const c = ring[(i + 1) % n]!;
    const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
    out.quad(
      up(a, H - thick),
      up(c, H - thick),
      up(c, H),
      up(a, H),
      0,
      0,
      len / TILE,
      thick / TILE,
      T.plain,
      [0.9, 0.9, 0.88],
    );
  }
  if (n > 8) return;
  const mid = centre(ring);
  const post = 0.14;
  for (const corner of ring) {
    // Posts stand a little in from the corners.
    const x = corner[0] + (mid[0] - corner[0]) * 0.12;
    const y = corner[1] + (mid[1] - corner[1]) * 0.12;
    const square: XY[] = [
      [x - post, y - post],
      [x + post, y - post],
      [x + post, y + post],
      [x - post, y + post],
    ];
    for (let i = 0; i < 4; i++)
      out.quad(
        up(square[i]!, 0),
        up(square[(i + 1) % 4]!, 0),
        up(square[(i + 1) % 4]!, H - thick),
        up(square[i]!, H - thick),
        0,
        0,
        0.04,
        0.5,
        T.plain,
        [0.72, 0.72, 0.72],
      );
  }
}
