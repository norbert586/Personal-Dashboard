/**
 * The ground: grass, roads, paint, fields and the woods past the edge, as one token per texel at 32
 * texels per tile. The painters were written for the 2D town's isometric screen, so each texel asks
 * them at the screen position the 2D art would have drawn it; the noise and stripes come out the
 * same, painted straight onto the grid instead of through a screen-sized raster.
 */
import { M, type MatName } from './materials.ts';
import { bay, clampLv, hash, nz } from './noise.ts';

/** A ground painter: a token for the 2D-art screen pixel (x, y). */
export type GroundPaint = (x: number, y: number) => number;

// The 2D town's isometric projection: 64×32 tiles, +x runs south (down-right), +y west (down-left).
const HW = 32;
const HH = 16;
const OX = 1100;
const OY = 205;
export const screenX = (gx: number, gy: number): number => Math.round(OX + (gx - gy) * HW);
export const screenY = (gx: number, gy: number): number => Math.round(OY + (gx + gy) * HH);
const gxOf = (x: number, y: number) => ((x - OX) / HW + (y - OY) / HH) / 2;
const gyOf = (x: number, y: number) => ((y - OY) / HH - (x - OX) / HW) / 2;

// ---- Painters ----
export const grassP: GroundPaint = (x, y) => {
  const n = nz(x * 0.04, y * 0.065) + (bay(x, y) - 0.5) * 0.16;
  const h = hash(x, y);
  let lv = n < 0.42 ? 1 : n < 0.7 ? 2 : 3;
  if (h < 0.05) lv--;
  else if (h > 0.955) lv++;
  return M.grass + clampLv(lv, 4);
};
/** Mown stripes along x. */
export const turfP: GroundPaint = (x, y) => {
  const stripe = Math.floor(gxOf(x, y) * 2) & 1;
  const h = hash(x, y);
  return M.turf + clampLv(1 + stripe + (h < 0.05 ? -1 : h > 0.96 ? 1 : 0), 4);
};
export const dirtP: GroundPaint = (x, y) => {
  const n = nz(x * 0.08, y * 0.1);
  const h = hash(x, y);
  return M.dirt + clampLv((n < 0.45 ? 0 : n < 0.7 ? 1 : 2) + (h > 0.94 ? 1 : h < 0.04 ? -1 : 0), 3);
};
export const gravelP: GroundPaint = (x, y) => {
  const h = hash(x, y);
  const n = nz(x * 0.05, y * 0.08);
  return M.gravel + clampLv((n < 0.5 ? 1 : 2) + (h < 0.18 ? -1 : h > 0.86 ? 1 : 0), 4);
};
export const asphP: GroundPaint = (x, y) => {
  const h = hash(x, y);
  const blk = hash(x >> 5, (y >> 4) + 777);
  let lv = 1;
  if (blk > 0.985) lv = 2;
  else if (blk < 0.012) lv = 0;
  if (h < 0.05) lv++;
  else if (h > 0.97) lv--;
  return M.asph + clampLv(lv, 4);
};
export const concP: GroundPaint = (x, y) => {
  const h = hash(x, y);
  const stain = nz(x * 0.02, y * 0.03) < 0.3 && bay(x, y) < 0.3 ? 1 : 0;
  return M.conc + clampLv(2 + (h < 0.07 ? -1 : h > 0.95 ? 1 : 0) - stain, 4);
};
/** Sidewalk slabs: seams every 0.2 tile across the path. */
export const walkP =
  (axis: 'x' | 'y'): GroundPaint =>
  (x, y) => {
    const s = axis === 'x' ? gxOf(x, y) : gyOf(x, y);
    const h = hash(x, y);
    const seam = (((s * 5) % 1) + 1) % 1 < 0.05;
    return M.walk + (seam ? 0 : clampLv(2 + (h < 0.07 ? -1 : h > 0.94 ? 1 : 0), 4));
  };
/** Rows of crops; the phase is a diagonal wave, so a colour cycle would ripple across the field. */
export const fieldP =
  (name: 'crop' | 'soy', dir: 'x' | 'y'): GroundPaint =>
  (x, y) => {
    const row = dir === 'x' ? Math.floor(gyOf(x, y) * 7) : Math.floor(gxOf(x, y) * 7);
    const wave = Math.floor((gxOf(x, y) + gyOf(x, y)) * 0.8);
    return M[name] + (((((row & 1) + wave) % 6) + 6) % 6);
  };
export const plowP: GroundPaint = (x, y) => {
  const row = Math.floor((gxOf(x, y) + gyOf(x, y)) * 6);
  return M.plow + clampLv((((row % 3) + 3) % 3) - (hash(x, y) < 0.08 ? 1 : 0), 3);
};
/** Woods seen from above: a field of round tree crowns. */
export const woodsP: GroundPaint = (x, y) => {
  const cx = Math.floor(x / 12);
  const cy = Math.floor(y / 10);
  let best = 9;
  let tone = 0.5;
  for (let j = -1; j <= 1; j++)
    for (let i = -1; i <= 1; i++) {
      const kx = cx + i;
      const ky = cy + j;
      const px = kx * 12 + 3 + hash(kx, ky) * 6;
      const py = ky * 10 + 2.5 + hash(ky + 91, kx) * 5;
      const d = ((x - px) / 7) ** 2 + ((y - py) / 6) ** 2;
      if (d < best) {
        best = d;
        tone = hash(kx + 11, ky + 5);
      }
    }
  const m = tone > 0.72 ? M.shrub : M.pine;
  return (
    m +
    clampLv(
      (best > 0.8 ? 0 : best < 0.36 ? 2 : 1) + (tone > 0.86 ? 1 : 0) + (hash(x, y) > 0.94 ? 1 : 0),
      4,
    )
  );
};
/** Farmland and woods past the town's edge, in patches about 7 tiles across. */
export const farP: GroundPaint = (x, y) => {
  const k = hash(Math.floor(gxOf(x, y) / 7) * 3 + 1, Math.floor(gyOf(x, y) / 7) * 5 + 2);
  if (k < 0.16) return fieldP('crop', 'x')(x, y);
  if (k < 0.27) return plowP(x, y);
  if (k < 0.42) return grassP(x, y);
  return woodsP(x, y);
};
/** Solid paint: road lines, lights, bases. */
export const mark =
  (name: MatName, lv: number): GroundPaint =>
  () =>
    M[name] + lv;

/** The ground near the town, from (origin, origin) for `size` tiles each way. */
export class Ground {
  readonly per = 32;
  readonly n: number;
  readonly tokens: Uint16Array;
  readonly origin: number;
  readonly size: number;

  /** Paint `inside` within x0..x1 on both axes and `outside` beyond. */
  constructor(
    origin: number,
    size: number,
    inside: { x0: number; x1: number; paint: GroundPaint; outside: GroundPaint },
  ) {
    this.origin = origin;
    this.size = size;
    this.n = size * this.per;
    this.tokens = new Uint16Array(this.n * this.n);
    for (let j = 0; j < this.n; j++)
      for (let i = 0; i < this.n; i++) {
        const gx = origin + (i + 0.5) / this.per;
        const gy = origin + (j + 0.5) / this.per;
        const p =
          gx > inside.x0 && gx < inside.x1 && gy > inside.x0 && gy < inside.x1
            ? inside.paint
            : inside.outside;
        this.tokens[j * this.n + i] = p(screenX(gx, gy), screenY(gx, gy));
      }
  }

  /** The token at a grid point, or -1 outside. */
  at(gx: number, gy: number): number {
    const i = Math.floor((gx - this.origin) * this.per);
    const j = Math.floor((gy - this.origin) * this.per);
    if (i < 0 || j < 0 || i >= this.n || j >= this.n) return -1;
    return this.tokens[j * this.n + i]!;
  }

  private range(a: number, b: number): [number, number] {
    const lo = Math.max(0, Math.ceil((a - this.origin) * this.per - 0.5));
    const hi = Math.min(this.n - 1, Math.floor((b - this.origin) * this.per - 0.5));
    return [lo, hi];
  }

  /** Paint the texels whose centres fall inside a grid rectangle. */
  rect(x0: number, y0: number, x1: number, y1: number, paint: GroundPaint): void {
    const [i0, i1] = this.range(x0, x1);
    const [j0, j1] = this.range(y0, y1);
    for (let j = j0; j <= j1; j++)
      for (let i = i0; i <= i1; i++) {
        const gx = this.origin + (i + 0.5) / this.per;
        const gy = this.origin + (j + 0.5) / this.per;
        this.tokens[j * this.n + i] = paint(screenX(gx, gy), screenY(gx, gy));
      }
  }

  /** Paint the texels whose centres fall inside a polygon in grid coordinates. */
  poly(pts: Array<[number, number]>, paint: GroundPaint): void {
    const ys = pts.map((p) => p[1]);
    const [j0, j1] = this.range(Math.min(...ys), Math.max(...ys));
    const xs: number[] = [];
    for (let j = j0; j <= j1; j++) {
      const gy = this.origin + (j + 0.5) / this.per;
      xs.length = 0;
      for (let a = 0, b = pts.length - 1; a < pts.length; b = a++) {
        const [xa, ya] = pts[a]!;
        const [xb, yb] = pts[b]!;
        if (ya > gy !== yb > gy) xs.push(xa + ((gy - ya) * (xb - xa)) / (yb - ya));
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const [i0, i1] = this.range(xs[k]!, xs[k + 1]!);
        for (let i = i0; i <= i1; i++) {
          const gx = this.origin + (i + 0.5) / this.per;
          this.tokens[j * this.n + i] = paint(screenX(gx, gy), screenY(gx, gy));
        }
      }
    }
  }
}
