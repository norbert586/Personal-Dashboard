/**
 * Stand-in homes for streets the map left empty (ADR-038). OpenStreetMap has every street here but
 * only some of the houses, and a subdivision street with bare grass either side reads as a field.
 * So a named residential street with nothing mapped along a stretch gets houses there: on lots like
 * its neighbours', set back from the kerb, clear of every real footprint, road, park, pond and
 * shop. Pure and seeded, so the same map always gives the same houses.
 */
import type { Area, Building, Line, Road } from './format.ts';

type Ring = Array<[number, number]>;

export interface FillInput {
  roads: readonly Road[];
  /** Which roads may get homes: named residential streets. */
  streets: readonly boolean[];
  buildings: readonly Building[];
  areas: readonly Area[];
  /** Land that isn't for houses: shops, offices, industry, school and church grounds, fields. */
  keepOut: readonly Line[];
  /** Homes go no further from the store than this, in metres. */
  reach: number;
}

const CELL = 3;
const TAKEN = 1;
const REAL = 2;

/** A steady pseudo-random number in [0, 1) for a pair of whole numbers. */
function roll(a: number, b: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function hashName(name: string): number {
  let h = 2166136261;
  for (let i = 0; i < name.length; i++) h = Math.imul(h ^ name.charCodeAt(i), 16777619);
  return h | 0;
}

const ringOf = (line: Line): Ring => {
  const out: Ring = [];
  for (let i = 0; i < line.length; i += 2) out.push([line[i]!, line[i + 1]!]);
  return out;
};

function inside(ring: Ring, x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

/** How wide a road is, near enough to keep houses off it. */
const widthOf = (road: Road): number =>
  road.kind === 'driveway' ? 3.4 : road.kind === 'aisle' ? 6.8 : road.lanes * 3.4 + 1.5;

/** The zone as a grid of 3 m cells: what's already there. */
class Ground {
  private readonly n: number;
  private readonly reach: number;
  private readonly cells: Uint8Array;

  constructor(reach: number) {
    this.reach = reach;
    this.n = Math.ceil((reach * 2) / CELL) + 2;
    this.cells = new Uint8Array(this.n * this.n);
  }

  private col(v: number): number {
    return Math.floor((v + this.reach) / CELL);
  }

  at(x: number, y: number): number {
    const cx = this.col(x);
    const cy = this.col(y);
    if (cx < 0 || cy < 0 || cx >= this.n || cy >= this.n) return TAKEN;
    return this.cells[cy * this.n + cx]!;
  }

  private each(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    visit: (x: number, y: number, i: number) => void,
  ): void {
    const c0 = Math.max(0, this.col(x0));
    const c1 = Math.min(this.n - 1, this.col(x1));
    const r0 = Math.max(0, this.col(y0));
    const r1 = Math.min(this.n - 1, this.col(y1));
    for (let r = r0; r <= r1; r++)
      for (let c = c0; c <= c1; c++)
        visit((c + 0.5) * CELL - this.reach, (r + 0.5) * CELL - this.reach, r * this.n + c);
  }

  /** Mark everything inside a ring. */
  fill(ring: Ring, bits: number): void {
    let x0 = Infinity;
    let x1 = -Infinity;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [x, y] of ring) {
      x0 = Math.min(x0, x);
      x1 = Math.max(x1, x);
      y0 = Math.min(y0, y);
      y1 = Math.max(y1, y);
    }
    this.each(x0, y0, x1, y1, (x, y, i) => {
      if (inside(ring, x, y)) this.cells[i]! |= bits;
    });
  }

  /** Mark everything within `r` metres of a line. */
  line(pts: Line, r: number, bits: number, closed = false): void {
    const n = pts.length / 2;
    for (let k = 0; k < (closed ? n : n - 1); k++) {
      const ax = pts[k * 2]!;
      const ay = pts[k * 2 + 1]!;
      const bx = pts[((k + 1) % n) * 2]!;
      const by = pts[((k + 1) % n) * 2 + 1]!;
      const ex = bx - ax;
      const ey = by - ay;
      const len2 = ex * ex + ey * ey;
      this.each(
        Math.min(ax, bx) - r,
        Math.min(ay, by) - r,
        Math.max(ax, bx) + r,
        Math.max(ay, by) + r,
        (x, y, i) => {
          const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / len2)) : 0;
          if (Math.hypot(x - ax - ex * t, y - ay - ey * t) <= r) this.cells[i]! |= bits;
        },
      );
    }
  }
}

/** The stand-in homes for a zone, to add after its real buildings. */
export function fillHomes(input: FillInput): Building[] {
  const ground = new Ground(input.reach + 60);
  for (const area of input.areas) ground.fill(ringOf(area.pts), TAKEN);
  for (const line of input.keepOut) ground.fill(ringOf(line), TAKEN);
  for (const b of input.buildings) {
    ground.fill(ringOf(b.pts), TAKEN | REAL);
    // Homes keep a side yard's distance from whatever's already built.
    ground.line(b.pts, 4.5, TAKEN, true);
    ground.line(b.pts, 1.5, REAL, true);
  }
  for (const road of input.roads) {
    const freeway = road.kind === 'motorway' || road.kind === 'link';
    const lane = road.kind === 'service' || road.kind === 'aisle' || road.kind === 'driveway';
    ground.line(road.pts, widthOf(road) / 2 + (freeway ? 22 : lane ? 1.5 : 4), TAKEN);
  }

  const homes: Building[] = [];
  input.roads.forEach((road, r) => {
    if (!input.streets[r]) return;
    const seed = hashName(road.name);
    // A street's houses are of a size: its lots, how deep they sit, how big they were built.
    const wide = 11.5 + roll(seed, 1) * 4.5;
    const deep = 8.5 + roll(seed, 2) * 3;
    const back = 7.5 + roll(seed, 3) * 3.5;
    const lot = wide + 6.5 + roll(seed, 4) * 3.5;
    const half = widthOf(road) / 2;

    const pts = road.pts;
    let along = 0;
    let next = lot / 2 + 7;
    for (let i = 0; i + 3 < pts.length; i += 2) {
      const ax = pts[i]!;
      const ay = pts[i + 1]!;
      const ex = pts[i + 2]! - ax;
      const ey = pts[i + 3]! - ay;
      const len = Math.hypot(ex, ey);
      if (len < 0.01) continue;
      const tx = ex / len;
      const ty = ey / len;
      for (; next < along + len; next += lot) {
        const s = next - along;
        const px = ax + tx * s;
        const py = ay + ty * s;
        for (const side of [1, -1]) {
          const id = Math.round(px * 3) * 7 + side;
          const jig = Math.round(py * 3);
          // Away from the street, on this side.
          const nx = -ty * side;
          const ny = tx * side;
          const w = wide + (roll(id, jig) - 0.5) * 2.4;
          const d = deep + (roll(id, jig + 1) - 0.5) * 1.6;
          const front = half + back + (roll(id, jig + 2) - 0.5) * 1.4;
          if (Math.hypot(px + nx * (front + d / 2), py + ny * (front + d / 2)) > input.reach)
            continue;
          const at = (u: number, v: number): [number, number] => [
            px + tx * u + nx * (front + v),
            py + ty * u + ny * (front + v),
          ];
          // Room for the house and its side yards; and nothing real behind, where a house that
          // sits far back from the street would be.
          let free = true;
          for (let u = -w / 2 - 2; free && u <= w / 2 + 2; u += 2)
            for (let v = -front + half + 2; free && v <= 36; v += 2) {
              const cell = ground.at(...at(u, v));
              if (v >= -3 && v <= d + 2 ? cell & TAKEN : cell & REAL) free = false;
            }
          if (!free) continue;
          // Nearly half have the garage standing forward at one end, as the houses here do.
          const wing = roll(id, jig + 3) < 0.45 ? 2.4 + roll(id, jig + 4) * 1.8 : 0;
          const end = roll(id, jig + 5) < 0.5 ? 1 : -1;
          const ring: Ring = wing
            ? [
                at((-w / 2) * end, 0),
                at((w / 2 - 6.4) * end, 0),
                at((w / 2 - 6.4) * end, -wing),
                at((w / 2) * end, -wing),
                at((w / 2) * end, d),
                at((-w / 2) * end, d),
              ]
            : [at(-w / 2, 0), at(w / 2, 0), at(w / 2, d), at(-w / 2, d)];
          let area = 0;
          for (let k = 0; k < ring.length; k++) {
            const a = ring[k]!;
            const b = ring[(k + 1) % ring.length]!;
            area += a[0] * b[1] - b[0] * a[1];
          }
          if (area < 0) ring.reverse();
          const flat = ring.flat().map((v) => Math.round(v * 10) / 10);
          homes.push({
            kind: 'house',
            levels: 0,
            name: '',
            made: true,
            pts: flat,
            faces: -1,
            street: -1,
            number: 0,
          });
          ground.fill(ring, TAKEN);
          ground.line(flat, 4.5, TAKEN, true);
        }
      }
      along += len;
    }
  });
  return homes;
}
