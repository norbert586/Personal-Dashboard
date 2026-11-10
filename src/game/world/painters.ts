/**
 * Painters turn a texel position into a material token. Wall painters get u (texels along the wall,
 * left to right as seen from outside) and v (texels up from the base); one texel is one 2D-art pixel,
 * so the same numbers describe the 2D and 3D towns (DESIGN: Camera and scale).
 * A painter returns -1 for "nothing here" (a band or sign that lets the wall show through).
 */
import { M, type MatName } from './materials.ts';
import { clampLv, hash, nz } from './noise.ts';

export type Painter = (u: number, v: number) => number;

/** Texels per tile along the 2D art's isometric axes, used to size facades the way the 2D town did. */
export const HW = 32;

export type WallKind = 'brick' | 'siding' | 'stucco' | 'cmu' | 'tin' | 'plain';

export function texFn(kind: WallKind, mat: MatName, seed = 0): Painter {
  const m = M[mat];
  switch (kind) {
    case 'brick':
      return (u, v) => {
        const row = Math.floor(v / 4);
        const r = v - row * 4;
        const uu = u + (row & 1) * 4;
        const col = Math.floor(uu / 8);
        const c = uu - col * 8;
        if (r === 0 || c === 0) return M.mortar + (hash(u, v) < 0.3 ? 1 : 0);
        const h = hash(col + seed, row);
        const lv = h < 0.12 ? 0 : h < 0.5 ? 1 : h < 0.88 ? 2 : 3;
        return m + clampLv(lv + (r === 1 ? 1 : r === 3 ? -1 : 0), 4);
      };
    case 'siding':
      return (u, v) => {
        const r = v & 3;
        return m + (r === 0 ? 0 : r === 1 ? 3 : hash(u, v) < 0.08 ? 1 : 2);
      };
    case 'stucco':
      return (u, v) => {
        const h = hash(u + seed, v);
        const n = nz(u * 0.2, v * 0.25);
        return m + clampLv((n < 0.45 ? 1 : 2) + (h < 0.1 ? -1 : h > 0.92 ? 1 : 0), 4);
      };
    case 'cmu':
      return (u, v) => {
        const row = Math.floor(v / 8);
        const r = v - row * 8;
        const uu = u + (row & 1) * 8;
        if (r === 0 || uu % 16 === 0) return m;
        return (
          m +
          clampLv(1 + (hash(Math.floor(uu / 16) + seed, row) < 0.5 ? 0 : 1) + (r === 1 ? 1 : 0), 4)
        );
      };
    case 'tin':
      return (u) => m + [3, 2, 1, 0][u & 3]!;
    default:
      return () => m + 2;
  }
}

export type WindowKind = 'sash' | 'fix' | 'arch' | 'store' | 'garage';
export interface Win {
  u: number;
  v: number;
  w: number;
  h: number;
  k: WindowKind;
  lit?: boolean;
}
export interface Door {
  u: number;
  w: number;
  h: number;
  mat?: MatName;
  glass?: boolean;
  lit?: boolean;
}
export interface Band {
  v0: number;
  v1: number;
  mat?: MatName;
  lv?: number;
  fn?: Painter;
}

/** A window's texel at (du, dv) inside it; -2 means outside an arched top. */
function winTok(du: number, dv: number, w: Win): number {
  const W = w.w;
  const H = w.h;
  if (w.k === 'garage') {
    if (du === 0 || du === W - 1 || dv === H - 1) return M.trim + 1;
    if (dv % 6 === 0) return M.trim;
    if (dv > H - 8 && dv < H - 2 && du % 8 > 1 && du % 8 < 7) return M.glass + 1;
    return M.trim + 2 - (du < W / 2 ? 0 : 1);
  }
  if (w.k === 'store') {
    // shop window: dark kick panel, big glass, thin mullions
    if (dv < 3) return M.brickB + 1;
    if (du === 0 || du === W - 1 || dv === H - 1) return M.trim + 1;
    if (du % 14 === 0) return M.trim;
    if (w.lit) return M.glassLit + (dv > H * 0.55 ? 2 : 1);
    return M.glass + ((du + dv) % 11 < 2 ? 2 : dv > H * 0.5 ? 1 : 0);
  }
  if (du === 0 || du === W - 1 || dv === H - 1 || dv === 0) return M.trim + (dv === 0 ? 2 : 1);
  if (w.k === 'arch') {
    const r = W / 2;
    const cx = (W - 1) / 2;
    const top = H - 1 - r;
    if (dv > top && (du - cx) ** 2 + (dv - top) ** 2 > r * r) return -2;
  }
  if (du === W >> 1 || (w.k !== 'fix' && dv === H >> 1)) return M.trim + 1;
  if (w.lit) return M.glassLit + (dv > H * 0.6 ? 2 : dv > H * 0.3 ? 1 : 0);
  return M.glass + ((du + dv) % 9 < 2 ? 2 : dv > H * 0.55 ? 1 : 0);
}

function doorTok(du: number, dv: number, d: Door): number {
  const W = d.w;
  const H = d.h;
  const mat = M[d.mat ?? 'doorR'];
  if (du === 0 || du === W - 1 || dv === H - 1) return M.trim + 1;
  if (d.glass && dv > H * 0.42 && du > 1 && du < W - 2) return d.lit ? M.glassLit + 1 : M.glass + 1;
  if (du === W >> 1 && dv > 1) return mat;
  if (dv === Math.floor(H * 0.45) && du === W - 3) return M.trim + 2;
  return mat + (du < W / 2 ? 2 : 1);
}

export interface FacadeSpec {
  kind?: WallKind;
  mat: MatName;
  seed?: number;
  wins?: Win[];
  doors?: Door[];
  bands?: Band[];
}

/** A facade painter: base wall, then bands, windows and doors on top. */
export function facade(o: FacadeSpec): Painter {
  const tex = texFn(o.kind ?? 'siding', o.mat, o.seed ?? 0);
  const wins = o.wins ?? [];
  const doors = o.doors ?? [];
  const bands = o.bands ?? [];
  return (u, v) => {
    for (const d of doors) if (u >= d.u && u < d.u + d.w && v < d.h) return doorTok(u - d.u, v, d);
    for (const w of wins)
      if (u >= w.u && u < w.u + w.w && v >= w.v && v < w.v + w.h) {
        const t = winTok(u - w.u, v - w.v, w);
        if (t !== -2) return t;
      }
    for (const b of bands)
      if (v >= b.v0 && v < b.v1) {
        const t = b.fn ? b.fn(u, v) : M[b.mat ?? 'trim'] + (b.lv ?? 1);
        if (t >= 0) return t;
      }
    return tex(u, v);
  };
}

export interface GridOpts {
  rows?: number;
  pitch?: number;
  seed?: number;
  k?: WindowKind;
  lit?: number;
  skip?: number[];
}

/** Evenly spaced windows: `cols` across a wall `len` texels long, in `rows` floors. */
export function winGrid(
  len: number,
  cols: number,
  w: number,
  h: number,
  v0: number,
  o: GridOpts = {},
): Win[] {
  const out: Win[] = [];
  const gap = (len - cols * w) / (cols + 1);
  const seed = o.seed ?? 0;
  for (let r = 0; r < (o.rows ?? 1); r++)
    for (let c = 0; c < cols; c++) {
      if (o.skip?.includes(c + r * 100)) continue;
      out.push({
        u: Math.round(gap + c * (w + gap)),
        v: v0 + r * (o.pitch ?? 24),
        w,
        h,
        k: o.k ?? 'sash',
        lit: hash(c * 13 + r * 7 + seed, 5) < (o.lit ?? 0.55),
      });
    }
  return out;
}

/** The back of a building: plain wall with a sparse grid of mostly dark windows. */
export const backOf = (
  kind: WallKind,
  mat: MatName,
  len: number,
  seed: number,
  rows = 1,
): Painter =>
  facade({
    kind,
    mat,
    seed: seed + 7,
    wins: winGrid(len, Math.max(1, Math.round(len / 30)), 8, 11, 8, {
      rows,
      pitch: 19,
      seed: seed + 9,
      lit: 0.3,
    }),
  });

// ---- Sign lettering: a 3×5 pixel font ----
const FONT: Record<string, string> = {
  A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110',
  E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101',
  I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111',
  M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100',
  Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010',
  U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101',
  Y: '101101010010010', Z: '111001010100111', '0': '111101101101111', '1': '010110010010111',
  '2': '110001010100111', '3': '110001010001110', '4': '101101111001001', '5': '111100110001110',
  '6': '011100111101111', '7': '111001010100100', '8': '111101111101111', '9': '111101111001110',
  '(': '001010010010001', ')': '100010010010100', '-': '000000111000000', '&': '010101010101011',
  '.': '000000000000010', ',': '000000000010100', ':': '000010000010000', "'": '010010000000000',
  '!': '010010010000010', '?': '110001010000010', '/': '001001010100100', '#': '101111101111101',
  '+': '000010111010000', '@': '111101111100011', '%': '101001010100101',
  ' ': '000000000000000',
}; // prettier-ignore

/** Whether the sign font can draw a character. */
export const hasGlyph = (ch: string): boolean => ch in FONT;

export const textW = (s: string, sc = 1): number => s.length * 4 * sc - sc;

export interface SignText {
  s: string;
  u: number;
  v: number;
  sc?: number;
  tok: number;
}

/** Sign lettering painted in wall space, so it follows the wall. */
function textPaint(texts: SignText[]): Painter {
  return (u, v) => {
    for (const t of texts) {
      const sc = t.sc ?? 1;
      const du = u - t.u;
      const dv = v - t.v;
      if (du < 0 || dv < 0 || dv >= 5 * sc || du >= textW(t.s, sc)) continue;
      const ci = Math.floor(du / (4 * sc));
      const cx = Math.floor((du - ci * 4 * sc) / sc);
      if (cx > 2) continue;
      const g = FONT[t.s[ci] ?? ' '] ?? FONT[' ']!;
      if (g[(4 - Math.floor(dv / sc)) * 3 + cx] === '1') return t.tok;
    }
    return -1;
  };
}

export const withText = (face: Painter, texts: SignText[]): Painter => {
  const tp = textPaint(texts);
  return (u, v) => {
    const t = tp(u, v);
    return t >= 0 ? t : face(u, v);
  };
};

export const centerText = (s: string, len: number, v: number, tok: number): SignText => ({
  s,
  u: Math.max(1, Math.round((len - textW(s)) / 2)),
  v,
  tok,
});

// ---- Roof painters in roof space: u runs along the ridge, v up the slope from the eave ----
export const shingle3 =
  (mat: MatName): Painter =>
  (u, v) => {
    const row = Math.floor(v / 4);
    const r = v - row * 4;
    const tj = u + (row & 1) * 6;
    const jr = ((tj % 12) + 12) % 12;
    const h = hash(Math.floor(tj / 12), row + 50);
    return (
      M[mat] +
      clampLv(2 + (r === 3 ? -1 : 0) + (jr < 1 ? -1 : 0) + (h < 0.14 ? -1 : h > 0.9 ? 1 : 0), 4)
    );
  };
export const seam3 =
  (mat: MatName): Painter =>
  (u) => {
    const k = ((u % 7) + 7) % 7;
    return M[mat] + (k === 0 ? 3 : k === 1 ? 0 : k < 4 ? 2 : 1);
  };
export const gravel3 =
  (mat: MatName): Painter =>
  (u, v) => {
    const h = hash(u + 900, v);
    return M[mat] + clampLv(2 + (h < 0.1 ? -1 : h > 0.93 ? 1 : 0), 4);
  };
export const corr3: Painter = (u) => M.tin + [3, 2, 1, 0][u & 3]!;
export const flat =
  (t: number): Painter =>
  () =>
    t;
