/** Deterministic noise for painters and seeded placement: the same inputs always paint the same town. */

/** A hash of two integers to [0, 1). */
export const hash = (x: number, y: number): number => {
  let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
/** Ordered 4×4 dither threshold in [0, 1). */
export const bay = (x: number, y: number): number => BAYER[((y & 3) << 2) | (x & 3)]! / 16;

const NZT = new Float32Array(64 * 64);
for (let i = 0; i < NZT.length; i++) NZT[i] = hash(i & 63, i >> 6);
const at = (x: number, y: number) => NZT[((y & 63) << 6) | (x & 63)]!;

/** Smooth value noise in [0, 1), tiling every 64 units. */
export function nz(x: number, y: number): number {
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const xf = x - xi;
  const yf = y - yi;
  const u = xf * xf * (3 - 2 * xf);
  const v = yf * yf * (3 - 2 * yf);
  const a = at(xi, yi);
  const b = at(xi + 1, yi);
  const c = at(xi, yi + 1);
  const d = at(xi + 1, yi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

/** Clamp a ramp level to 0..n-1. */
export const clampLv = (lv: number, n: number): number => (lv < 0 ? 0 : lv > n - 1 ? n - 1 : lv);
