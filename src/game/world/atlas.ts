/**
 * The texture atlas and the static geometry painted into it. Every wall, roof and sign gets its own
 * rectangle of texels at 32 per tile, painted by code, and the triangles that wear it.
 * World units are tiles. three.js axes: X = grid x (south), Z = grid y (west), Y = up. Heights are
 * written in the 2D art's pixels and converted with ZPX, so one set of numbers draws both towns.
 */
import { M, type MatName, type Palette } from './materials.ts';
import { gravel3, facade, type Painter } from './painters.ts';

/** 2D-art pixels per tile of height. */
export const ZPX = 39.19;
/** Texels per tile along a surface. */
export const T3 = 32;
export const ATLAS = 1024;

export type Vec3 = [number, number, number];
type UV = [number, number];
/** Grid position (gx, gy) at height gz in 2D-art pixels, as a three.js point. */
export const V = (gx: number, gy: number, gz = 0): Vec3 => [gx, gz / ZPX, gy];

export interface Page {
  col: Uint8Array;
  emi: Uint8Array;
  x: number;
  y: number;
  rowH: number;
  pos: number[];
  nor: number[];
  uv: number[];
}
interface Rect {
  p: Page;
  x: number;
  y: number;
  w: number;
  h: number;
}
/** Face painters for a box: f front (+y), r right (+x), b back (-y), l left (-x), t top (false = none). */
export interface BoxFaces {
  f: Painter;
  r?: Painter;
  b?: Painter;
  l?: Painter;
  t?: Painter | false;
}

export class Atlas {
  readonly pages: Page[] = [];
  private page: Page | null = null;
  private readonly solids = new Map<number, Rect>();
  private readonly fallback = M.cmu + 1;
  private readonly pal: Palette;

  constructor(pal: Palette) {
    this.pal = pal;
  }

  private newPage(): Page {
    const page: Page = {
      col: new Uint8Array(ATLAS * ATLAS * 4),
      emi: new Uint8Array(ATLAS * ATLAS * 4),
      x: 0,
      y: 0,
      rowH: 0,
      pos: [],
      nor: [],
      uv: [],
    };
    this.pages.push(page);
    this.page = page;
    return page;
  }

  /** Shelf-pack a w×h rectangle with one texel of border, so nearest sampling never bleeds. */
  alloc(w: number, h: number): Rect {
    w = Math.min(w, ATLAS - 2);
    h = Math.min(h, ATLAS - 2);
    let p = this.page ?? this.newPage();
    if (p.x + w + 2 > ATLAS) {
      p.x = 0;
      p.y += p.rowH;
      p.rowH = 0;
    }
    if (p.y + h + 2 > ATLAS) p = this.newPage();
    const r = { p, x: p.x + 1, y: p.y + 1, w, h };
    p.x += w + 2;
    p.rowH = Math.max(p.rowH, h + 2);
    return r;
  }

  /** Fill a rectangle; fn(u, v) returns a token, with v = 0 the bottom row. */
  paint(r: Rect, fn: Painter): void {
    const { p, x, y, w, h } = r;
    const { rgb, emissive } = this.pal;
    for (let row = -1; row <= h; row++)
      for (let col = -1; col <= w; col++) {
        const u = col < 0 ? 0 : col >= w ? w - 1 : col;
        const v = h - 1 - (row < 0 ? 0 : row >= h ? h - 1 : row);
        let t = fn(u, v);
        if (!(t >= 0) || !rgb[t]) t = this.fallback;
        const i = ((y + row) * ATLAS + x + col) * 4;
        const c = rgb[t]!;
        const e = emissive[t];
        p.col[i] = c[0];
        p.col[i + 1] = c[1];
        p.col[i + 2] = c[2];
        p.col[i + 3] = 255;
        if (e) {
          p.emi[i] = e[0];
          p.emi[i + 1] = e[1];
          p.emi[i + 2] = e[2];
        }
        p.emi[i + 3] = 255;
      }
  }

  private solid(t: number): Rect {
    let r = this.solids.get(t);
    if (!r) {
      r = this.alloc(2, 2);
      this.paint(r, () => t);
      this.solids.set(t, r);
    }
    return r;
  }

  // ---- Emitters: flat normals, counter-clockwise seen from outside ----
  tri(r: Rect, a: Vec3, b: Vec3, c: Vec3, ta: UV, tb: UV, tc: UV): void {
    const ux = b[0] - a[0];
    const uy = b[1] - a[1];
    const uz = b[2] - a[2];
    const vx = c[0] - a[0];
    const vy = c[1] - a[1];
    const vz = c[2] - a[2];
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const l = Math.hypot(nx, ny, nz);
    if (l < 1e-9) return;
    nx /= l;
    ny /= l;
    nz /= l;
    const p = r.p;
    for (const [q, s] of [
      [a, ta],
      [b, tb],
      [c, tc],
    ] as const) {
      p.pos.push(q[0], q[1], q[2]);
      p.nor.push(nx, ny, nz);
      p.uv.push((r.x + s[0] * r.w) / ATLAS, (r.y + (1 - s[1]) * r.h) / ATLAS);
    }
  }

  /** a, b: bottom edge left to right; c, d: top edge right to left (as seen from outside). */
  quad(r: Rect, a: Vec3, b: Vec3, c: Vec3, d: Vec3): void {
    this.tri(r, a, b, c, [0, 0], [1, 0], [1, 1]);
    this.tri(r, a, c, d, [0, 0], [1, 1], [0, 1]);
  }

  /** A wall from (ax, ay) to (bx, by), left to right seen from outside, z0..z1 in 2D pixels. */
  wall(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    z0: number,
    z1: number,
    fn: Painter,
    vBase = z0,
  ): void {
    const len = Math.hypot(bx - ax, by - ay);
    const w = Math.max(1, Math.round(len * T3));
    const h = Math.max(1, Math.round(z1 - z0));
    const off = Math.round(z0 - vBase);
    const r = this.alloc(w, h);
    this.paint(r, (u, v) => fn(u, v + off));
    this.quad(r, V(ax, ay, z0), V(bx, by, z0), V(bx, by, z1), V(ax, ay, z1));
  }

  /** A convex polygon on a wall plane; pts are [s tiles along A→B, z pixels], counter-clockwise. */
  wallPoly(
    ax: number,
    ay: number,
    bx: number,
    by: number,
    pts: Array<[number, number]>,
    fn: Painter,
    vBase = 0,
  ): void {
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const dx = (bx - ax) / len;
    const dy = (by - ay) / len;
    const ss = pts.map((q) => q[0]);
    const zs = pts.map((q) => q[1]);
    const s0 = Math.min(...ss);
    const s1 = Math.max(...ss);
    const z0 = Math.min(...zs);
    const z1 = Math.max(...zs);
    const w = Math.max(1, Math.round((s1 - s0) * T3));
    const h = Math.max(1, Math.round(z1 - z0));
    const r = this.alloc(w, h);
    const u0 = Math.round(s0 * T3);
    const off = Math.round(z0 - vBase);
    this.paint(r, (u, v) => fn(u + u0, v + off));
    const at = ([s, z]: [number, number]) => V(ax + dx * s, ay + dy * s, z);
    const st = ([s, z]: [number, number]): UV => [
      (s - s0) / (s1 - s0 || 1),
      (z - z0) / (z1 - z0 || 1),
    ];
    const first = pts[0]!;
    for (let i = 1; i + 1 < pts.length; i++) {
      const b = pts[i]!;
      const c = pts[i + 1]!;
      this.tri(r, at(first), at(b), at(c), st(first), st(b), st(c));
    }
  }

  top(x0: number, y0: number, x1: number, y1: number, z: number, fn: Painter): void {
    const r = this.alloc(
      Math.max(1, Math.round((x1 - x0) * T3)),
      Math.max(1, Math.round((y1 - y0) * T3)),
    );
    this.paint(r, fn);
    this.quad(r, V(x0, y1, z), V(x1, y1, z), V(x1, y0, z), V(x0, y0, z));
  }

  box(x0: number, y0: number, x1: number, y1: number, z0: number, h: number, o: BoxFaces): void {
    const z1 = z0 + h;
    const fr = o.f;
    const rt = o.r ?? fr;
    const bk = o.b ?? fr;
    const lf = o.l ?? rt;
    this.wall(x0, y1, x1, y1, z0, z1, fr);
    this.wall(x1, y1, x1, y0, z0, z1, rt);
    this.wall(x1, y0, x0, y0, z0, z1, bk);
    this.wall(x0, y0, x0, y1, z0, z1, lf);
    if (o.t !== false) this.top(x0, y0, x1, y1, z1, o.t ?? (() => this.fallback));
  }

  /** A box in one solid token: posts, rails, signs. */
  sbox(x0: number, y0: number, x1: number, y1: number, z0: number, h: number, t: number): void {
    const r = this.solid(t);
    const z1 = z0 + h;
    this.quad(r, V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1));
    this.quad(r, V(x1, y1, z0), V(x1, y0, z0), V(x1, y0, z1), V(x1, y1, z1));
    this.quad(r, V(x1, y0, z0), V(x0, y0, z0), V(x0, y0, z1), V(x1, y0, z1));
    this.quad(r, V(x0, y0, z0), V(x0, y1, z0), V(x0, y1, z1), V(x0, y0, z1));
    this.quad(r, V(x0, y1, z1), V(x1, y1, z1), V(x1, y0, z1), V(x0, y0, z1));
  }

  post(gx: number, gy: number, half: number, z0: number, h: number, t: number): void {
    this.sbox(gx - half, gy - half, gx + half, gy + half, z0, h, t);
  }

  /** A planar quad (a roof slope); sizes in tiles set the texel density. */
  slope(a: Vec3, b: Vec3, c: Vec3, d: Vec3, fn: Painter, wT: number, hT: number): void {
    const r = this.alloc(Math.max(1, Math.round(wT * T3)), Math.max(1, Math.round(hT * T3)));
    this.paint(r, fn);
    this.quad(r, a, b, c, d);
  }

  /** A gable roof with ridge along x or y, rh pixels high, oh tiles of overhang, and painted ends. */
  gable(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    z: number,
    rh: number,
    dir: 'x' | 'y',
    roof: Painter,
    end: Painter | null,
    oh = 0,
  ): void {
    const zr = z + rh;
    if (dir === 'x') {
      const ym = (y0 + y1) / 2;
      const run = (y1 - y0) / 2;
      const ez = z - rh * (oh / run);
      const sl = Math.hypot(run + oh, (zr - ez) / ZPX);
      const L = x1 - x0 + 2 * oh;
      this.slope(
        V(x1 + oh, y0 - oh, ez),
        V(x0 - oh, y0 - oh, ez),
        V(x0 - oh, ym, zr),
        V(x1 + oh, ym, zr),
        roof,
        L,
        sl,
      );
      this.slope(
        V(x0 - oh, y1 + oh, ez),
        V(x1 + oh, y1 + oh, ez),
        V(x1 + oh, ym, zr),
        V(x0 - oh, ym, zr),
        roof,
        L,
        sl,
      );
      if (end) {
        const pts: Array<[number, number]> = [
          [0, z],
          [y1 - y0, z],
          [run, zr],
        ];
        this.wallPoly(x0, y0, x0, y1, pts, end, z);
        this.wallPoly(x1, y1, x1, y0, pts, end, z);
      }
    } else {
      const xm = (x0 + x1) / 2;
      const run = (x1 - x0) / 2;
      const ez = z - rh * (oh / run);
      const sl = Math.hypot(run + oh, (zr - ez) / ZPX);
      const L = y1 - y0 + 2 * oh;
      this.slope(
        V(x1 + oh, y1 + oh, ez),
        V(x1 + oh, y0 - oh, ez),
        V(xm, y0 - oh, zr),
        V(xm, y1 + oh, zr),
        roof,
        L,
        sl,
      );
      this.slope(
        V(x0 - oh, y0 - oh, ez),
        V(x0 - oh, y1 + oh, ez),
        V(xm, y1 + oh, zr),
        V(xm, y0 - oh, zr),
        roof,
        L,
        sl,
      );
      if (end) {
        const pts: Array<[number, number]> = [
          [0, z],
          [x1 - x0, z],
          [run, zr],
        ];
        this.wallPoly(x0, y1, x1, y1, pts, end, z);
        this.wallPoly(x1, y0, x0, y0, pts, end, z);
      }
    }
  }

  /** A flat gravel roof with a parapet. */
  flatRoof(
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    z: number,
    mat: 'flatR',
    par: number,
    trim: MatName = 'cmu',
  ): void {
    this.top(x0, y0, x1, y1, z, gravel3(mat));
    const t = 0.06;
    const w = facade({ kind: 'cmu', mat: trim });
    const cap = () => M[trim] + 3;
    const pb = (a: number, b: number, c: number, d: number) =>
      this.box(a, b, c, d, z, par, { f: w, t: cap });
    pb(x0, y0, x1, y0 + t);
    pb(x0, y0, x0 + t, y1);
    pb(x0, y1 - t, x1, y1);
    pb(x1 - t, y0, x1, y1);
  }

  /** A cylinder's side (and an optional cap); fn(u, v) wraps around. */
  cyl(
    cx: number,
    cy: number,
    r: number,
    z0: number,
    z1: number,
    fn: Painter,
    segs = 12,
    capTok = -1,
  ): void {
    const w = Math.max(2, Math.round(2 * Math.PI * r * T3));
    const h = Math.max(1, Math.round(z1 - z0));
    const rr = this.alloc(w, h);
    this.paint(rr, fn);
    const pt = (i: number, z: number) => {
      const a = (i / segs) * Math.PI * 2;
      return V(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z);
    };
    for (let i = 0; i < segs; i++) {
      const s0 = (segs - i - 1) / segs;
      const s1 = (segs - i) / segs;
      this.tri(rr, pt(i + 1, z0), pt(i, z0), pt(i, z1), [s0, 0], [s1, 0], [s1, 1]);
      this.tri(rr, pt(i + 1, z0), pt(i, z1), pt(i + 1, z1), [s0, 0], [s1, 1], [s0, 1]);
    }
    if (capTok >= 0) {
      const c = this.solid(capTok);
      const ctr = V(cx, cy, z1);
      for (let i = 0; i < segs; i++)
        this.tri(c, ctr, pt(i + 1, z1), pt(i, z1), [0.5, 0.5], [0, 0], [1, 0]);
    }
  }

  cone(
    cx: number,
    cy: number,
    r: number,
    z0: number,
    z1: number,
    fn: Painter,
    segs = 12,
    rot = 0,
  ): void {
    const w = Math.max(2, Math.round(2 * Math.PI * r * T3));
    const h = Math.max(1, Math.round(z1 - z0));
    const rr = this.alloc(w, h);
    this.paint(rr, fn);
    const pt = (i: number) => {
      const a = rot + (i / segs) * Math.PI * 2;
      return V(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z0);
    };
    const apex = V(cx, cy, z1);
    for (let i = 0; i < segs; i++)
      this.tri(
        rr,
        pt(i + 1),
        pt(i),
        apex,
        [(segs - i - 1) / segs, 0],
        [(segs - i) / segs, 0],
        [(segs - i - 0.5) / segs, 1],
      );
  }

  sphere(cx: number, cy: number, cz: number, r: number, t: number, segs = 12, rings = 8): void {
    const c = this.solid(t);
    const at = (i: number, j: number): Vec3 => {
      const a = (i / segs) * Math.PI * 2;
      const b = -Math.PI / 2 + (j / rings) * Math.PI;
      return [
        cx + Math.cos(a) * Math.cos(b) * r,
        cz / ZPX + Math.sin(b) * r,
        cy + Math.sin(a) * Math.cos(b) * r,
      ];
    };
    for (let j = 0; j < rings; j++)
      for (let i = 0; i < segs; i++)
        this.quad(c, at(i + 1, j), at(i, j), at(i, j + 1), at(i + 1, j + 1));
  }
}
