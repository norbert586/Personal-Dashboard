/**
 * The delivery mode's space (ADR-035): one unit is one real metre. Zone positions are metres east
 * (x) and north (y) of the store, with height (h) up; in three.js that's (x, h, -y), so north is -z.
 * Seen from above with north up, an anticlockwise triangle faces up.
 */

/** The world is built and dropped in squares this many metres a side. */
export const CHUNK = 256;
/** One repeat of a texture tile, in metres: 64 texels at 8 texels a metre. */
export const TILE = 8;

export type XY = readonly [number, number];
export type P3 = readonly [number, number, number];
/** A tint that multiplies a texture's colour: [1, 1, 1] leaves it alone. */
export type Tint = readonly [number, number, number];

export const chunkOf = (v: number): number => Math.floor(v / CHUNK);
/** One number for a chunk's column and row. */
export const chunkKey = (cx: number, cy: number): number => (cx + 512) * 1024 + (cy + 512);

/** A steady pseudo-random number in [0, 1) for a pair of numbers. */
export function rnd(a: number, b: number): number {
  let h = (Math.imul(a | 0, 374761393) + Math.imul(b | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

/** A flat line (x, y, x, y…) as points. */
export function points(line: readonly number[]): XY[] {
  const out: XY[] = [];
  for (let i = 0; i < line.length; i += 2) out.push([line[i]!, line[i + 1]!]);
  return out;
}

/** Twice a ring's area: positive when it runs anticlockwise. */
export function area2(ring: readonly XY[]): number {
  let sum = 0;
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!;
    const b = ring[(i + 1) % ring.length]!;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum;
}

export function centre(ring: readonly XY[]): XY {
  let x = 0;
  let y = 0;
  for (const p of ring) {
    x += p[0];
    y += p[1];
  }
  return [x / ring.length, y / ring.length];
}

export function insideRing(ring: readonly XY[], x: number, y: number): boolean {
  let hit = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!;
    const [xj, yj] = ring[j]!;
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}
