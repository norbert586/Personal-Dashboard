/**
 * What makes a landmark read as what it is (DESIGN: Delivery mode): a steeple and a cross on a
 * church, a flat canopy over a school's doors, a hospital's blue band and rooftop plant, a
 * showroom's fascia and its row of cars for sale, pumps under a gas station's canopy, and a strip
 * of lit signs over a row of shops. All of it is boxes and panels added to the building's chunk.
 */
import type { Building } from '../../lib/zone/format.ts';
import { lerp, up, type Built } from './buildings.ts';
import type { MeshBuilder } from './mesh.ts';
import { box } from './props.ts';
import { TILE, area2, centre, rnd, type Tint, type XY } from './space.ts';
import { T } from './tiles.ts';

const WHITE: Tint = [0.96, 0.96, 0.94];

/** One wall of a ring: its ends, length, direction, and the unit normal pointing outside. */
export function wallOf(ring: readonly XY[], i: number) {
  const a = ring[i]!;
  const c = ring[(i + 1) % ring.length]!;
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]) || 1;
  const dir: XY = [(c[0] - a[0]) / len, (c[1] - a[1]) / len];
  const out: XY = [dir[1], -dir[0]];
  return { a, c, len, dir, out, mid: lerp(a, c, 0.5) };
}

/** The wall to hang things on: the one facing the street, or the longest. */
export function mainWall(built: Built): number {
  if (built.frontEdge >= 0) return built.frontEdge;
  let best = 0;
  let longest = 0;
  for (let i = 0; i < built.ring.length; i++) {
    const { len } = wallOf(built.ring, i);
    if (len > longest) {
      longest = len;
      best = i;
    }
  }
  return best;
}

/** A strip standing just proud of a wall, between two heights. */
function strip(
  out: MeshBuilder,
  a: XY,
  c: XY,
  normal: XY,
  h0: number,
  h1: number,
  tint: Tint,
  glow: number,
): void {
  const off = 0.12;
  const p: XY = [a[0] + normal[0] * off, a[1] + normal[1] * off];
  const q: XY = [c[0] + normal[0] * off, c[1] + normal[1] * off];
  const len = Math.hypot(c[0] - a[0], c[1] - a[1]);
  out.quad(up(p, h0), up(q, h0), up(q, h1), up(p, h1), 0, 0, len / TILE, 0.1, T.plain, tint, glow);
}

function church(out: MeshBuilder, built: Built, area: number): void {
  const wall = wallOf(built.ring, mainWall(built));
  const big = area > 1800;
  const half = big ? 2.8 : 1.9;
  const top = built.H + (big ? 9 : 6.5);
  const x = wall.mid[0] - wall.out[0] * (half + 0.4);
  const y = wall.mid[1] - wall.out[1] * (half + 0.4);
  box(out, x, y, wall.dir, half, half, 0, top, [1, 1, 1], 0, T.brickBlank);
  box(out, x, y, wall.dir, half + 0.25, half + 0.25, top, top + 0.35, WHITE);
  // The spire: four faces up to a point.
  const tip = top + (big ? 8 : 6);
  const [dx, dy] = wall.dir;
  const corners: XY[] = [
    [x - dx * half + dy * half, y - dy * half - dx * half],
    [x + dx * half + dy * half, y + dy * half - dx * half],
    [x + dx * half - dy * half, y + dy * half + dx * half],
    [x - dx * half - dy * half, y - dy * half + dx * half],
  ];
  for (let i = 0; i < 4; i++)
    out.tri(
      up(corners[i]!, top + 0.35),
      up(corners[(i + 1) % 4]!, top + 0.35),
      [x, y, tip],
      0,
      0,
      0.5,
      0,
      0.25,
      0.8,
      T.shingle,
      [0.3, 0.33, 0.36],
    );
  box(out, x, y, wall.dir, 0.11, 0.11, tip - 0.2, tip + 1.9, WHITE, -0.4);
  box(out, x, y, wall.dir, 0.62, 0.11, tip + 1.0, tip + 1.24, WHITE, -0.4);
}

function school(out: MeshBuilder, built: Built): void {
  const wall = wallOf(built.ring, mainWall(built));
  const reach = 1.7;
  const x = wall.mid[0] + wall.out[0] * reach;
  const y = wall.mid[1] + wall.out[1] * reach;
  const half = Math.min(5.5, wall.len / 2 - 0.5);
  if (half < 2) return;
  box(out, x, y, wall.dir, half, reach, 3.15, 3.55, WHITE);
  for (const side of [-1, 1])
    box(
      out,
      x + wall.dir[0] * (half - 0.4) * side + wall.out[0] * (reach - 0.4),
      y + wall.dir[1] * (half - 0.4) * side + wall.out[1] * (reach - 0.4),
      wall.dir,
      0.16,
      0.16,
      0,
      3.15,
      [0.2, 0.3, 0.52],
    );
}

const WARD_BLUE: Tint = [0.16, 0.38, 0.66];

function hospital(out: MeshBuilder, built: Built, area: number): void {
  const { ring, H } = built;
  if (H < 9) return;
  for (let i = 0; i < ring.length; i++) {
    const w = wallOf(ring, i);
    if (w.len > 2.2) strip(out, w.a, w.c, w.out, H - 1.5, H + 0.05, WARD_BLUE, -0.3);
  }
  // Plant on the roof: the lift and air-handling rooms.
  const mid = centre(ring);
  const size = Math.min(9, Math.sqrt(area) * 0.16);
  const wall = wallOf(ring, mainWall(built));
  box(out, mid[0], mid[1], wall.dir, size, size * 0.6, H - 0.4, H + 3.2, [0.74, 0.75, 0.76]);
}

type Park = (x: number, y: number, dir: XY, seed: number) => void;

function dealer(
  out: MeshBuilder,
  built: Built,
  seed: number,
  clear: (x: number, y: number) => boolean,
  park: Park,
): void {
  const { ring, H } = built;
  for (let i = 0; i < ring.length; i++) {
    const w = wallOf(ring, i);
    if (w.len < 2.2 || built.facing[i]! <= -0.3) continue;
    strip(out, w.a, w.c, w.out, H - 1.5, H + 0.05, [0.2, 0.24, 0.3], 0);
    strip(out, w.a, w.c, w.out, H - 1.7, H - 1.5, [0.85, 0.88, 0.92], -0.8);
  }
  if (built.frontEdge < 0) return;
  // The front line: cars for sale, nose out toward the street.
  const wall = wallOf(ring, built.frontEdge);
  for (const row of [9, 15.5])
    for (let s = 1.8; s < wall.len - 1.5; s += 3.3) {
      const x = wall.a[0] + wall.dir[0] * s + wall.out[0] * row;
      const y = wall.a[1] + wall.dir[1] * s + wall.out[1] * row;
      if (clear(x, y)) park(x, y, wall.out, seed * 131 + Math.round(s * 3) + row);
    }
}

function fuel(out: MeshBuilder, built: Built): void {
  const { ring } = built;
  let long = 0;
  for (let i = 1; i < ring.length; i++) if (wallOf(ring, i).len > wallOf(ring, long).len) long = i;
  const wall = wallOf(ring, long);
  const mid = centre(ring);
  const pumps = Math.max(1, Math.min(4, Math.round(wall.len / 7.5)));
  for (let k = 0; k < pumps; k++) {
    const s = (k - (pumps - 1) / 2) * Math.min(7.5, wall.len / pumps);
    const x = mid[0] + wall.dir[0] * s;
    const y = mid[1] + wall.dir[1] * s;
    box(out, x, y, wall.dir, 1.5, 0.55, 0, 0.16, [0.78, 0.78, 0.76]);
    box(out, x, y, wall.dir, 0.42, 0.3, 0.16, 1.75, [0.9, 0.9, 0.9]);
    box(out, x, y, wall.dir, 0.44, 0.32, 1.2, 1.55, [0.82, 0.18, 0.16], -0.5);
  }
}

/** The colours of shop signs along a strip mall. */
const SIGNS: Tint[] = [
  [0.72, 0.14, 0.14],
  [0.12, 0.3, 0.6],
  [0.1, 0.42, 0.26],
  [0.85, 0.5, 0.08],
  [0.36, 0.16, 0.5],
  [0.14, 0.14, 0.16],
  [0.08, 0.44, 0.5],
];

function shops(out: MeshBuilder, built: Built, seed: number): void {
  const { ring } = built;
  for (let i = 0; i < ring.length; i++) {
    const w = wallOf(ring, i);
    if (built.facing[i]! <= 0.35 || w.len < 6) continue;
    const count = Math.max(1, Math.round(w.len / 4));
    // A shop is two or three bays wide, each with its own sign.
    for (let k = 0; k < count;) {
      const span = Math.min(count - k, 2 + Math.floor(rnd(seed * 7 + i, k) * 2));
      const p0 = lerp(w.a, w.c, (k + 0.12) / count);
      const p1 = lerp(w.a, w.c, (k + span - 0.12) / count);
      const tint = SIGNS[Math.floor(rnd(seed * 3 + i, k + 9) * SIGNS.length)]!;
      strip(out, p0, p1, w.out, 3.62, 4.52, tint, -0.6);
      k += span;
    }
  }
}

/**
 * Dress a building as the landmark it is. `clear` says whether a spot is free of streets and
 * walls, for the things that stand out in front; `park` parks a car.
 */
export function dress(
  out: MeshBuilder,
  b: Building,
  built: Built,
  seed: number,
  clear: (x: number, y: number) => boolean,
  park: Park,
): void {
  const area = Math.abs(area2(built.ring)) / 2;
  switch (b.kind) {
    case 'church':
      return church(out, built, area);
    case 'school':
      return school(out, built);
    case 'hospital':
      return hospital(out, built, area);
    case 'dealer':
      return dealer(out, built, seed, clear, park);
    case 'fuel':
      return fuel(out, built);
    case 'retail':
      return shops(out, built, seed);
    default:
  }
}
