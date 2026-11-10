/**
 * The town's builders: houses, Main Street shops, the church, the airfield and the project buildings,
 * and street furniture. Each one paints its surfaces into the atlas and records what the rest of the
 * town needs to know: where you bump into it, where its door is, where its lights glow at night.
 */
import { PXU } from '../pixels.ts';
import { Atlas, V, ZPX } from './atlas.ts';
import { M, type MatName, type Palette, type RGB, type Season } from './materials.ts';
import { clampLv, hash } from './noise.ts';
import {
  HW,
  backOf,
  centerText,
  textW,
  corr3,
  facade,
  seam3,
  shingle3,
  winGrid,
  withText,
  type Door as DoorSpec,
  type Painter,
  type WallKind,
  type Win,
} from './painters.ts';
import { Ground, dirtP, gravelP, turfP } from './ground.ts';

/** A place you can go into: a project, a landmark or a feed building, by id. */
export interface Door {
  id: number;
  x: number;
  y: number;
  /** How close you must be for the prompt to show. */
  reach: number;
}
/** An axis-aligned footprint you can't walk through; `id` is the place whose door it has, or 0. */
export interface Collider {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
  id: number;
}
export interface Light {
  x: number;
  y: number;
  /** Height in 2D-art pixels. */
  z: number;
  /** Reach in 2D-art pixels. */
  r: number;
  c: RGB;
  a: number;
}
/** How a board is drawn: a backlit cinema marquee, an LED scoreboard, or neon in a shop front. */
export type BoardSkin = 'marquee' | 'led' | 'neon';
/** A board the town writes on while it runs (src/game/signs.ts): `key` is the feed it shows. */
export interface SignSlot {
  key: string;
  skin: BoardSkin;
  /** Its bottom edge on the ground plan, left to right as seen from outside. */
  ax: number;
  ay: number;
  bx: number;
  by: number;
  /** Bottom and top, in 2D-art pixels. */
  z0: number;
  z1: number;
}
export type TreeSpec =
  | { kind: 'tree'; gx: number; gy: number; r: number; th: number; mats: MatName[] }
  | { kind: 'pine'; gx: number; gy: number; h: number }
  | { kind: 'shrub'; gx: number; gy: number; r: number; mat: MatName };

export interface World {
  season: Season;
  palette: Palette;
  atlas: Atlas;
  ground: Ground;
  doors: Door[];
  colliders: Collider[];
  /** Round obstacles: posts, trunks, poles [x, y, radius]. */
  round: Array<[number, number, number]>;
  /** Utility pole tops [x, y, z px], wired together along each street. */
  poles: Array<[number, number, number]>;
  trees: TreeSpec[];
  lights: Light[];
  chimneys: Array<[number, number, number]>;
  stacks: Array<[number, number, number]>;
  /** Runway, taxiway and threshold lights on the ground: crisp dots that glow at night (0–1 colour). */
  fixtures: Array<{ x: number; y: number; c: RGB }>;
  /** Wind turbine hubs [x, y, z px]; the scene spins their rotors. */
  turbines: Array<[number, number, number]>;
  /** Boards that show the feeds. */
  signs: SignSlot[];
}

let W: World;
let A: Atlas;
let curId = 0;

/** Make `world` the one the builders add to. */
export function building(world: World): void {
  W = world;
  A = world.atlas;
  curId = 0;
}
/** Build something that belongs to place `id` (trees in the orchard, say). */
export function obj(id: number, draw: () => void): void {
  curId = id;
  draw();
  curId = 0;
}

export const collide = (x0: number, y0: number, x1: number, y1: number): void => {
  W.colliders.push({ x0, y0, x1, y1, id: 0 });
};
export const roundCollide = (x: number, y: number, r: number): void => {
  W.round.push([x, y, r]);
};
export const door = (id: number, x: number, y: number, reach = 0.9): void => {
  if (id) W.doors.push({ id, x, y, reach });
};
export const light = (x: number, y: number, z: number, r: number, c: RGB, a = 1): void => {
  W.lights.push({ x, y, z, r, c, a });
};

// ---- Houses ----
interface HouseStyle {
  kind: WallKind;
  wall: MatName;
  roof: MatName;
  door: MatName;
}
const HOUSE_STYLES: HouseStyle[] = [
  { kind: 'siding', wall: 'sidW', roof: 'shG', door: 'doorB' },
  { kind: 'siding', wall: 'sidB', roof: 'shB', door: 'doorR' },
  { kind: 'siding', wall: 'sidY', roof: 'shG', door: 'doorB' },
  { kind: 'brick', wall: 'brickR', roof: 'shG', door: 'doorB' },
  { kind: 'brick', wall: 'brickB', roof: 'shB', door: 'doorR' },
  { kind: 'stucco', wall: 'stucco', roof: 'shR', door: 'doorB' },
  { kind: 'siding', wall: 'sidG', roof: 'shB', door: 'doorR' },
  { kind: 'brick', wall: 'brickY', roof: 'shG', door: 'doorR' },
];

export interface HouseSpec {
  id?: number;
  x: number;
  y: number;
  w: number;
  d: number;
  /** Floors: 1 or 2. */
  f?: number;
  seed?: number;
  style?: HouseStyle;
  front?: 'L' | 'R';
  dir?: 'x' | 'y';
  garage?: boolean;
  chimney?: boolean;
  metal?: boolean;
}

export function house(o: HouseSpec): void {
  const { x, y, w, d, f = 1, seed = 0 } = o;
  const st = o.style ?? HOUSE_STYLES[Math.floor(hash(seed, 3) * HOUSE_STYLES.length)]!;
  const x1 = x + w;
  const y1 = y + d;
  const wh = f === 2 ? 38 : 20;
  const rh = f === 2 ? 14 : 11;
  const front = o.front ?? 'L';
  const dir = o.dir ?? (w >= d ? 'x' : 'y');
  const garageOn = o.garage ?? true;
  const LW = Math.round(w * HW);
  const RW = Math.round(d * HW);
  const face = (len: number, isFront: boolean, sd: number): Painter => {
    const doors: DoorSpec[] = [];
    const rects: Array<[number, number]> = [];
    let wins: Win[] = winGrid(len, Math.max(2, Math.round(len / 24)), 9, 11, 6, {
      rows: f,
      pitch: 19,
      seed: seed + sd,
      lit: 0.5,
    });
    if (isFront) {
      doors.push({ u: 6, w: 9, h: 17, mat: st.door });
      rects.push([4, 17]);
    }
    if (isFront && garageOn && len >= 58) {
      const gu = len - 31;
      wins.unshift({ u: gu, v: 0, w: 26, h: 15, k: 'garage' });
      rects.push([gu - 2, gu + 28]);
    }
    wins = wins.filter(
      (wn) =>
        wn.k === 'garage' || !rects.some((r) => wn.u + wn.w > r[0] && wn.u < r[1] && wn.v < 18),
    );
    return facade({
      kind: st.kind,
      mat: st.wall,
      seed,
      wins,
      doors,
      bands: [
        { v0: 0, v1: 3, mat: 'cmu', lv: 1 },
        { v0: wh - 2, v1: wh, mat: st.wall, lv: 0 },
      ],
    });
  };
  const endP = facade({
    kind: st.kind,
    mat: st.wall,
    seed,
    wins: [
      {
        u: Math.round((dir === 'x' ? RW : LW) / 2) - 3,
        v: 3,
        w: 7,
        h: 7,
        k: 'fix',
        lit: hash(seed, 9) < 0.4,
      },
    ],
  });
  A.box(x, y, x1, y1, 0, wh, {
    f: face(LW, front === 'L', 1),
    r: face(RW, front === 'R', 2),
    b: face(LW, false, 3),
    l: face(RW, false, 4),
    t: false,
  });
  A.gable(x, y, x1, y1, wh, rh, dir, o.metal ? seam3('metalR') : shingle3(st.roof), endP, 0.07);
  if (o.chimney !== false) {
    const bk = facade({ kind: 'brick', mat: 'brickB' });
    const cx = x + w * 0.3;
    const cy = dir === 'x' ? (y + y1) / 2 - 0.16 : y + d * 0.3;
    A.box(cx, cy, cx + 0.14, cy + 0.14, wh + rh * 0.4, rh * 0.75 + 10, { f: bk, t: () => M.dark });
    W.chimneys.push([cx + 0.07, cy + 0.07, wh + rh + 10]);
  }
  collide(x, y, x1, y1);
  const dp: [number, number] = front === 'L' ? [x + 0.33, y1 + 0.22] : [x1 + 0.22, y1 - 0.33];
  if (hash(seed, 7) < 0.7) light(dp[0], dp[1], 14, 30, [255, 190, 100], 0.8);
  door(o.id ?? 0, dp[0], dp[1]);
}

// ---- Main Street ----
export interface ShopSpec {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  floors?: number;
  brick?: MatName;
  awn?: MatName;
  id?: number;
  name?: string;
  ntok?: number;
  seed?: number;
  lit?: number;
  /** A feed's board over the shop front; with `canopy`, on a marquee that sticks out over the walk. */
  board?: { key: string; skin: BoardSkin; canopy?: boolean };
}

/** Board height in pixels: a frame, two lines of the sign font and a status strip (signs.ts). */
export const BOARD_H = 22;

export function shop(o: ShopSpec): void {
  const { x0, x1, y0, y1, floors = 2, brick = 'brickR', awn = 'awnR', id = 0, name = '', ntok } = o;
  const len = Math.round((x1 - x0) * HW);
  const side = Math.round((y1 - y0) * HW);
  const seed = o.seed ?? 1;
  const lit = o.lit ?? 0.5;
  const one = floors === 1;
  const canopy = o.board?.canopy === true;
  const H = one ? 31 : 33 + (floors - 1) * 20;
  const wins: Win[] = [
    { u: 5, v: 3, w: len - 22, h: one ? 17 : 18, k: 'store', lit: hash(seed, 2) < lit + 0.2 },
  ];
  const cols = Math.max(2, Math.round(len / 22));
  const gap = (len - cols * 9) / (cols + 1);
  if (!one)
    for (let r = 1; r < floors; r++)
      for (let c = 0; c < cols; c++) {
        if (o.board && r === 1) continue; // the board hangs here
        wins.push({
          u: Math.round(gap + c * (9 + gap)),
          v: 35 + (r - 1) * 20,
          w: 9,
          h: 14,
          k: 'arch',
          lit: hash(c + r * 5, seed) < lit,
        });
      }
  const stripe = (u: number) => ((u + seed) >> 2) & 1;
  const awning: Painter = (u, v) =>
    v === 21 ? M[awn] : M[awn] + (stripe(u) ? 2 : 3) - (v > 22 ? 1 : 0);
  const bands = [
    { v0: H - 4, v1: H - 3, mat: 'trim' as const, lv: 2 },
    { v0: H - 3, v1: H, mat: 'trim' as const, lv: 1 },
  ];
  let Lp = facade({
    kind: 'brick',
    mat: brick,
    seed,
    wins,
    doors: [{ u: len - 16, w: 11, h: 21, mat: 'doorR', glass: true, lit: true }],
    bands: one || canopy ? bands : [{ v0: 21, v1: 26, fn: awning }, ...bands],
  });
  const tok = ntok ?? M.neonY + 1;
  // Over a marquee, the name is written large above it.
  if (name && canopy)
    Lp = withText(Lp, [
      { s: name, u: Math.round((len - textW(name, 2)) / 2), v: 21 + BOARD_H + 2, sc: 2, tok },
    ]);
  else if (name) Lp = withText(Lp, [centerText(name, len, one ? 22 : 27, tok)]);
  const sideWins: Win[] = [];
  for (let r = 0; r < floors; r++)
    for (let c = 0; c < 2; c++)
      sideWins.push({
        u: 8 + c * Math.round(side / 2),
        v: r ? 35 + (r - 1) * 20 : 8,
        w: 8,
        h: 11,
        k: 'arch',
        lit: false,
      });
  const Rp = facade({
    kind: 'brick',
    mat: brick,
    seed: seed + 3,
    wins: sideWins,
    bands: [{ v0: H - 4, v1: H, mat: 'trim', lv: 1 }],
  });
  A.box(x0, y0, x1, y1, 0, H, {
    f: Lp,
    r: Rp,
    b: backOf('brick', brick, len, seed, floors),
    l: Rp,
    t: false,
  });
  A.flatRoof(x0, y0, x1, y1, H, 'flatR', 3, brick);
  if (hash(seed, 4) < 0.6) {
    const ux = x0 + (x1 - x0) * 0.3;
    const uy = y0 + (y1 - y0) * 0.3;
    A.box(ux, uy, ux + 0.3, uy + 0.25, H, 7, {
      f: facade({ kind: 'tin', mat: 'tin' }),
      t: () => M.steel + 2,
    });
  }
  if (o.board && canopy) {
    // a marquee: a box over the walk with bulbs around its sides and a lit soffit
    const out = y1 + 0.34;
    const bulbs: Painter = (u, v) =>
      u === 0 || v === 0 || v === BOARD_H - 1
        ? (u + v) & 1
          ? M.lampLit + 1
          : M.dark + 1
        : M.boardLit + 1;
    const blank: Painter = (_u, v) => (v < 7 ? M.dark : M.boardLit + 1);
    A.wall(x0, out, x1, out, 21, 21 + BOARD_H, blank);
    A.wall(x1, out, x1, y1, 21, 21 + BOARD_H, bulbs);
    A.wall(x0, y1, x0, out, 21, 21 + BOARD_H, bulbs);
    A.top(x0, y1, x1, out, 21 + BOARD_H, () => M.flatR + 1);
    A.slope(
      V(x0, y1, 21),
      V(x1, y1, 21),
      V(x1, out, 21),
      V(x0, out, 21),
      (u, v) => (u % 6 === 2 && v % 5 === 2 ? M.lampLit + 1 : M.dark + 2),
      x1 - x0,
      out - y1,
    );
    W.signs.push({
      ...o.board,
      ax: x0,
      ay: out + 0.012,
      bx: x1,
      by: out + 0.012,
      z0: 21,
      z1: 21 + BOARD_H,
    });
    light((x0 + x1) / 2, out - 0.1, 6, 44, [255, 226, 160], 0.5); // spilling on the walk below
  } else if (o.board) {
    W.signs.push({
      ...o.board,
      ax: x0,
      ay: y1 + 0.02,
      bx: x1,
      by: y1 + 0.02,
      z0: 33,
      z1: 33 + BOARD_H,
    });
    const glow: RGB = o.board.skin === 'led' ? [255, 190, 90] : [120, 180, 255];
    light((x0 + x1) / 2, y1 + 0.3, 8, 40, glow, 0.45);
  }
  if (!one && !canopy) {
    // a real awning that sticks out over the sidewalk
    const a0 = x0 + 0.08;
    const a1 = x1 - 0.08;
    const out = y1 + 0.22;
    A.slope(
      V(a0, out, 20),
      V(a1, out, 20),
      V(a1, y1, 26),
      V(a0, y1, 26),
      (u, v) => M[awn] + (stripe(u) ? 2 : 3) - (v < 2 ? 1 : 0),
      a1 - a0,
      0.26,
    );
    A.wall(a0, out, a1, out, 17, 20, (u) => M[awn] + (stripe(u) ? 1 : 3));
  }
  collide(x0, y0, x1, y1);
  light((x0 + x1) / 2, y1 + 0.2, 14, 34, [255, 200, 120], 0.7);
  door(id, x0 + (len - 10.5) / HW, y1 + 0.3);
}

export function church(x: number, y: number): void {
  const nx1 = x + 3.0;
  const y1 = y + 1.5;
  const plain = facade({ kind: 'brick', mat: 'brickB', seed: 5 });
  const nave = facade({
    kind: 'brick',
    mat: 'brickB',
    seed: 5,
    wins: [8, 30, 52, 74].map((u): Win => ({ u, v: 8, w: 9, h: 22, k: 'arch', lit: true })),
    bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 1 }],
  });
  const tx0 = nx1 - 0.15;
  const ty0 = y + 0.3;
  const tx1 = nx1 + 0.8;
  const ty1 = y1 - 0.3;
  const tH = 62;
  const tower = facade({
    kind: 'brick',
    mat: 'brickB',
    seed: 8,
    wins: [
      { u: 10, v: 40, w: 9, h: 16, k: 'arch', lit: true },
      { u: 11, v: 8, w: 9, h: 16, k: 'arch', lit: false },
    ],
    doors: [{ u: 9, w: 12, h: 20, mat: 'doorR' }],
    bands: [
      { v0: 0, v1: 3, mat: 'cmu', lv: 1 },
      { v0: tH - 3, v1: tH, mat: 'trim', lv: 2 },
    ],
  });
  A.box(x, y, nx1, y1, 0, 34, { f: nave, r: plain, b: nave, l: plain, t: false });
  A.gable(x, y, nx1, y1, 34, 22, 'x', shingle3('shG'), plain, 0.06);
  A.box(tx0, ty0, tx1, ty1, 0, tH, { f: tower, t: false });
  A.cone(
    (tx0 + tx1) / 2,
    (ty0 + ty1) / 2,
    0.66,
    tH,
    tH + 46,
    (_u, v) => M.shG + clampLv(2 + (Math.floor(v / 4) & 1 ? -1 : 0), 4),
    4,
    Math.PI / 4,
  );
  const cx = (tx0 + tx1) / 2;
  const cy = (ty0 + ty1) / 2;
  A.post(cx, cy, 0.012, tH + 44, 12, M.trim + 2);
  A.sbox(cx - 0.05, cy - 0.012, cx + 0.05, cy + 0.012, tH + 51, 2, M.trim + 2);
  collide(x, y, nx1, y1);
  collide(tx0, ty0, tx1, ty1);
  light(x + 1.5, y1 + 0.2, 20, 40, [255, 170, 80], 0.8);
}

// ---- The airfield and the project buildings ----
export function hangar(
  id: number,
  x0: number,
  y0: number,
  x1: number,
  y1: number,
  R: number,
  open: boolean,
): void {
  const xc = (x0 + x1) / 2;
  const rx = (x1 - x0) / 2;
  const N = 14;
  const len = x1 - x0;
  const pr: Array<[number, number]> = [];
  for (let i = 0; i <= N; i++) {
    const a = (Math.PI * i) / N;
    pr.push([xc + rx * Math.cos(a), R * Math.sin(a)]);
  }
  const dw = Math.round(rx * HW * 1.3);
  const dh = Math.round(R * 0.7);
  const du0 = Math.round(rx * HW - dw / 2);
  const front: Painter = (u, v) => {
    if (u >= du0 && u < du0 + dw && v < dh) {
      if (open)
        return v > dh - 3
          ? M.dark + 2
          : v > dh * 0.55 && u > du0 + 3 && u < du0 + dw - 3 && v < dh * 0.62
            ? M.lampLit + 1
            : M.dark + (v > dh * 0.6 ? 1 : 0);
      return (u - du0) % 9 === 0 || v % 7 === 0 ? M.steel : M.steel + (u < du0 + dw / 2 ? 2 : 1);
    }
    if (v >= dh && v < dh + 2 && u >= du0 - 2 && u < du0 + dw + 2)
      return (u >> 2) & 1 ? M.orange + 1 : M.dark + 1;
    return v < 2 ? M.cmu + 1 : corr3(u, v);
  };
  for (let i = 1; i <= N; i++) {
    const [xa, za] = pr[i - 1]!;
    const [xb, zb] = pr[i]!;
    A.slope(
      V(xa, y1, za),
      V(xa, y0, za),
      V(xb, y0, zb),
      V(xb, y1, zb),
      corr3,
      y1 - y0,
      Math.hypot(xb - xa, (zb - za) / ZPX),
    );
  }
  const arcF: Array<[number, number]> = [
    [0, 0],
    [len, 0],
  ];
  const arcB: Array<[number, number]> = [
    [0, 0],
    [len, 0],
  ];
  for (let i = 1; i < N; i++) arcF.push([pr[i]![0] - x0, pr[i]![1]]);
  for (let i = N - 1; i >= 1; i--) arcB.push([x1 - pr[i]![0], pr[i]![1]]);
  A.wallPoly(x0, y1, x1, y1, arcF, front, 0);
  A.wallPoly(x1, y0, x0, y0, arcB, (u, v) => (v < 2 ? M.cmu + 1 : corr3(u, v)), 0);
  collide(x0, y0, x1, y1);
  if (open) light(xc, y1 + 0.2, 14, 40, [255, 220, 150], 0.7);
  door(id, xc, y1 + 0.3);
}

export function terminal(id: number, x0: number, y0: number, x1: number, y1: number): void {
  const len = Math.round((x1 - x0) * HW);
  const H = 36;
  const side = Math.round((y1 - y0) * HW);
  const trimBands = [
    { v0: 0, v1: 3, mat: 'cmu' as const, lv: 1 },
    { v0: 26, v1: 36, mat: 'trim' as const, lv: 1 },
  ];
  const sign = withText(
    facade({
      kind: 'cmu',
      mat: 'cmu',
      wins: winGrid(len, Math.round(len / 14), 11, 22, 3, { k: 'fix', lit: 0.9, seed: 3 }),
      bands: trimBands,
    }),
    [centerText('RATIU FIELD', len, 29, M.neonB + 1)],
  );
  const land = withText(
    facade({
      kind: 'cmu',
      mat: 'cmu',
      seed: 6,
      wins: winGrid(len, 6, 11, 14, 8, { k: 'fix', lit: 0.7, seed: 5 }).filter(
        (w) => Math.abs(w.u - len / 2) > 18,
      ),
      doors: [{ u: Math.round(len / 2) - 10, w: 20, h: 22, mat: 'doorB', glass: true, lit: true }],
      bands: trimBands,
    }),
    [centerText('RATIU FIELD', len, 29, M.neonB + 1)],
  );
  const Rp = facade({
    kind: 'stucco',
    mat: 'stucco',
    wins: winGrid(side, 2, 9, 12, 8, { k: 'fix', lit: 0.4 }),
    bands: [{ v0: H - 4, v1: H, mat: 'trim', lv: 1 }],
  });
  A.box(x0, y0, x1, y1, 0, H, { f: sign, r: Rp, b: land, l: Rp, t: false });
  A.flatRoof(x0, y0, x1, y1, H, 'flatR', 3, 'cmu');
  const tin = facade({ kind: 'tin', mat: 'tin' });
  A.box(x0 + 0.4, y0 + 0.3, x0 + 0.9, y0 + 0.7, H, 7, { f: tin, t: () => M.steel + 2 });
  A.box(x1 - 1.0, y0 + 0.4, x1 - 0.4, y0 + 0.8, H, 7, { f: tin, t: () => M.steel + 2 });
  for (let x = x0 + 0.3; x < x1; x += 1.0) {
    A.post(x, y1 + 0.3, 0.02, 0, 22, M.steel + 1);
    roundCollide(x, y1 + 0.3, 0.05);
  }
  A.box(x0, y1, x1, y1 + 0.35, 22, 3, { f: () => M.steel + 1, t: () => M.conc + 1 });
  collide(x0, y0, x1, y1);
  light((x0 + x1) / 2, y1 + 0.2, 14, 70, [255, 214, 140], 1);
  light((x0 + x1) / 2, y0 - 0.2, 14, 50, [255, 214, 140], 0.8);
  door(id, (x0 + x1) / 2, y1 + 0.55);
  door(id, (x0 + x1) / 2, y0 - 0.3);
}

export function tower(id: number, x0: number, y0: number): void {
  const x1 = x0 + 0.62;
  const y1 = y0 + 0.62;
  const sh = 92;
  const shaft = facade({
    kind: 'stucco',
    mat: 'cmu',
    wins: [14, 40, 66].map((v): Win => ({ u: 14, v, w: 5, h: 10, k: 'fix', lit: false })),
    bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 0 }],
  });
  const cab = facade({
    kind: 'plain',
    mat: 'steel',
    wins: winGrid(30, 3, 8, 14, 3, { k: 'fix', lit: 0.95 }),
    bands: [
      { v0: 0, v1: 3, mat: 'steel', lv: 0 },
      { v0: 20, v1: 24, mat: 'steel', lv: 2 },
    ],
  });
  A.box(x0 - 0.35, y0 - 0.2, x1 + 0.2, y1 + 0.5, 0, 12, {
    f: facade({
      kind: 'cmu',
      mat: 'cmu',
      wins: [{ u: 6, v: 3, w: 8, h: 6, k: 'fix', lit: true }],
      doors: [{ u: 20, w: 8, h: 10, mat: 'doorB' }],
    }),
    r: facade({ kind: 'cmu', mat: 'cmu' }),
    t: () => M.flatR + 2,
  });
  A.box(x0, y0, x1, y1, 12, sh - 12, { f: shaft, t: false });
  A.box(x0 - 0.16, y0 - 0.16, x1 + 0.16, y1 + 0.16, sh, 24, { f: cab, t: () => M.shG + 1 });
  A.sbox(x0 - 0.2, y0 - 0.2, x1 + 0.2, y1 + 0.2, sh + 24, 2, M.steel + 3);
  const cx = (x0 + x1) / 2;
  const cy = (y0 + y1) / 2;
  A.post(cx, cy, 0.012, sh + 26, 20, M.steel + 2);
  A.sbox(cx - 0.02, cy - 0.02, cx + 0.02, cy + 0.02, sh + 46, 3, M.beacon);
  collide(x0 - 0.35, y0 - 0.2, x1 + 0.2, y1 + 0.5);
  light(cx, cy, sh + 12, 60, [255, 220, 150], 0.9);
  door(id, x0 + 0.2, y1 + 0.75);
}

export function fireStation(id: number, x0: number, y0: number, x1: number, y1: number): void {
  const len = Math.round((x1 - x0) * HW);
  const H = 30;
  const Lp = withText(
    facade({
      kind: 'brick',
      mat: 'brickR',
      wins: [
        { u: 5, v: 0, w: 22, h: 22, k: 'garage' },
        { u: 31, v: 0, w: 22, h: 22, k: 'garage' },
        { u: len - 14, v: 6, w: 8, h: 12, k: 'sash', lit: true },
      ],
      bands: [
        { v0: H - 5, v1: H - 3, mat: 'trim', lv: 2 },
        { v0: H - 3, v1: H, mat: 'trim', lv: 1 },
      ],
    }),
    [{ s: 'FIRE', u: 22, v: 24, tok: M.trim + 2 }],
  );
  const Rp = facade({
    kind: 'brick',
    mat: 'brickR',
    seed: 4,
    wins: winGrid(Math.round((y1 - y0) * HW), 2, 8, 11, 8, { k: 'sash', lit: 0.2 }),
  });
  A.box(x0, y0, x1, y1, 0, H, {
    f: Lp,
    r: Rp,
    b: backOf('brick', 'brickR', len, 4),
    l: Rp,
    t: false,
  });
  A.flatRoof(x0, y0, x1, y1, H, 'flatR', 3, 'brickR');
  const ht = facade({
    kind: 'brick',
    mat: 'brickR',
    seed: 7,
    wins: [{ u: 5, v: 40, w: 8, h: 12, k: 'arch', lit: true }],
  });
  A.box(x1, y0 + 0.1, x1 + 0.4, y0 + 0.6, 0, 58, { f: ht, t: () => M.brickR });
  collide(x0, y0, x1 + 0.4, y1);
  light((x0 + x1) / 2, y1 + 0.2, 12, 40, [255, 210, 130], 0.8);
  door(id, x0 + 0.9, y1 + 0.3);
}

export function radarDome(id: number, cx: number, cy: number): void {
  const f = facade({ kind: 'cmu', mat: 'cmu', doors: [{ u: 8, w: 7, h: 9, mat: 'doorB' }] });
  A.box(cx - 0.35, cy - 0.35, cx + 0.35, cy + 0.35, 0, 10, {
    f,
    r: facade({ kind: 'cmu', mat: 'cmu' }),
    t: () => M.flatR + 1,
  });
  for (const [dx, dy] of [
    [-0.18, -0.18],
    [0.18, -0.18],
    [-0.18, 0.18],
    [0.18, 0.18],
  ] as const)
    A.post(cx + dx, cy + dy, 0.012, 10, 34, M.steel + 2);
  const r = 18 / PXU;
  A.sphere(cx, cy, 56, r, M.trim + 2, 14, 9);
  A.post(cx, cy, 0.015, 56 + r * ZPX - 1, 3, M.radarL);
  collide(cx - 0.35, cy - 0.35, cx + 0.35, cy + 0.35);
  door(id, cx, cy + 0.6);
}

export function waterTower(id: number, cx: number, cy: number): void {
  for (const [dx, dy] of [
    [-0.3, -0.3],
    [0.3, -0.3],
    [-0.3, 0.3],
    [0.3, 0.3],
  ] as const) {
    A.post(cx + dx, cy + dy, 0.025, 0, 80, M.steel + 1);
    roundCollide(cx + dx, cy + dy, 0.06);
  }
  A.sbox(cx - 0.31, cy - 0.31, cx + 0.31, cy + 0.31, 38, 2, M.steel);
  A.cyl(
    cx,
    cy,
    0.5,
    78,
    118,
    (_u, zr) =>
      M.trim +
      clampLv(1 + (Math.floor((zr + 78) / 18) & 1 ? 0 : 1) + ((zr + 78) % 18 < 1 ? -1 : 0), 3),
    16,
  );
  A.cone(cx, cy, 0.53, 118, 132, () => M.steel + 2, 16);
  door(id, cx, cy, 0.8);
}

export function elevator(id: number, x: number, y: number): void {
  const f = facade({
    kind: 'cmu',
    mat: 'cmu',
    wins: [
      { u: 10, v: 70, w: 6, h: 10, k: 'fix', lit: false },
      { u: 10, v: 40, w: 6, h: 10, k: 'fix', lit: false },
    ],
    doors: [{ u: 4, w: 9, h: 16, mat: 'doorB' }],
  });
  for (let i = 0; i < 4; i++)
    A.cyl(
      x + 0.4 + i * 0.78,
      y + 0.45,
      0.34,
      0,
      84,
      (_u, zr) =>
        M.cmu +
        clampLv(2 + (zr % 21 < 1 ? -2 : 0) - (hash(Math.floor(zr / 21) + i, 3) < 0.2 ? 1 : 0), 4),
      14,
      M.cmu + 2,
    );
  A.box(x + 3.2, y + 0.1, x + 3.9, y + 0.8, 0, 118, { f, t: () => M.shG + 1 });
  A.sbox(x + 3.2, y + 0.1, x + 3.9, y + 0.8, 118, 8, M.steel + 1);
  collide(x + 0.05, y + 0.1, x + 3.9, y + 0.8);
  door(id, x + 3.5, y + 1.05);
}

export function diner(id: number, x0: number, y0: number, x1: number, y1: number): void {
  const len = Math.round((x1 - x0) * HW);
  const H = 26;
  const Lp = withText(
    facade({
      kind: 'tin',
      mat: 'tin',
      wins: [{ u: 4, v: 5, w: len - 8, h: 14, k: 'store', lit: true }],
      bands: [
        { v0: 0, v1: 3, mat: 'steel', lv: 1 },
        { v0: 19, v1: 23, mat: 'red', lv: 1 },
        { v0: 23, v1: 26, mat: 'trim', lv: 2 },
      ],
    }),
    [centerText('OPEN 24 HRS', len, 8, M.trim + 2)],
  );
  const Rp = facade({
    kind: 'tin',
    mat: 'tin',
    wins: winGrid(Math.round((y1 - y0) * HW), 2, 8, 12, 6, { k: 'fix', lit: 0.8 }),
    bands: [{ v0: 19, v1: 23, mat: 'red', lv: 1 }],
  });
  A.box(x0, y0, x1, y1, 0, H, { f: Lp, r: Rp, t: false });
  A.flatRoof(x0, y0, x1, y1, H, 'flatR', 2, 'tin');
  const signL = withText(
    () => M.dark + 1,
    [
      { s: 'CONEY', u: 2, v: 11, tok: M.neonR + 1 },
      { s: 'OPEN', u: 4, v: 3, tok: M.neonB + 1 },
    ],
  );
  const sx = x1 - 0.45;
  A.post(sx, y1 + 0.35, 0.02, 0, 44, M.steel + 1);
  roundCollide(sx, y1 + 0.35, 0.05);
  A.box(sx - 0.34, y1 + 0.3, sx + 0.34, y1 + 0.4, 44, 19, {
    f: signL,
    r: () => M.dark,
    b: signL,
    t: () => M.steel + 2,
  });
  collide(x0, y0, x1, y1);
  light((x0 + x1) / 2, y1 + 0.2, 14, 56, [255, 200, 120], 1);
  light(sx, y1 + 0.35, 54, 36, [255, 90, 80], 0.7);
  door(id, x0 + 0.45, y1 + 0.3);
}

export function kiosk(id: number, x0: number, y0: number, x1: number, y1: number): void {
  x1 = Math.max(x1, x0 + 1.2);
  const len = Math.round((x1 - x0) * HW);
  const cell = Math.floor((len - 8) / 3);
  const machines: Painter = (u, v) => {
    if (v < 3 || v > 19 || u < 4 || u > len - 4) return -1;
    const m = Math.min(2, Math.floor((u - 4) / cell));
    if ((u - 4) % cell === 0 || v === 3) return M.dark;
    return [M.neonR, M.neonB, M.neonY][m]! + ((u + v) % 4 === 0 ? 1 : 0);
  };
  const Lp = withText(
    facade({
      kind: 'stucco',
      mat: 'stucco',
      bands: [
        { v0: 3, v1: 20, fn: machines },
        { v0: 21, v1: 26, fn: (u) => M.awnB + ((u >> 2) & 1 ? 2 : 3) },
      ],
    }),
    [centerText('CROSSBELL', len, 27, M.neonY + 1)],
  );
  A.box(x0, y0, x1, y1, 0, 32, {
    f: Lp,
    r: facade({ kind: 'stucco', mat: 'stucco', seed: 2 }),
    t: () => M.flatR + 1,
  });
  collide(x0, y0, x1, y1);
  light((x0 + x1) / 2, y1 + 0.2, 12, 40, [120, 190, 255], 0.9);
  light((x0 + x1) / 2, y1 + 0.2, 12, 30, [255, 100, 110], 0.6);
  door(id, (x0 + x1) / 2, y1 + 0.3);
}

export function factory(x: number, y: number, len: number, dep: number): void {
  const H = 38;
  const L = Math.round(len * HW);
  const D = Math.round(dep * HW);
  const teeth = Math.max(2, Math.round(dep / 0.62));
  const tw = dep / teeth;
  const x1 = x + len;
  const y1 = y + dep;
  const dr: DoorSpec = { u: L - 17, w: 10, h: 19, mat: 'doorB' };
  const wins = winGrid(L, Math.max(2, Math.floor(L / 15)), 8, 12, 12, {
    k: 'fix',
    lit: 0.35,
    seed: 4,
  }).filter((w) => w.u + w.w < dr.u - 2);
  const f = withText(
    facade({
      kind: 'brick',
      mat: 'brickB',
      seed: 2,
      wins,
      doors: [dr],
      bands: [
        { v0: 0, v1: 3, mat: 'cmu', lv: 1 },
        { v0: H - 3, v1: H, mat: 'trim', lv: 0 },
      ],
    }),
    [centerText('TOOL & DIE', L, 27, M.trim + 2)],
  );
  const f2 = facade({
    kind: 'brick',
    mat: 'brickB',
    seed: 3,
    wins: [
      { u: 8, v: 0, w: 26, h: 22, k: 'garage' },
      ...winGrid(D, 3, 8, 12, 12, { k: 'fix', lit: 0.2 }).filter((w) => w.u > 38),
    ],
    bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 1 }],
  });
  const fb = backOf('brick', 'brickB', L, 5);
  A.box(x, y, x1, y1, 0, H, { f, r: f2, b: fb, l: fb, t: false });
  for (let k = 0; k < teeth; k++) {
    // a sawtooth roof: glass to the north, metal to the south
    const ya = y + k * tw;
    const yb = ya + tw;
    A.wallPoly(
      x1,
      y1,
      x1,
      y,
      [
        [y1 - yb, H],
        [y1 - ya, H],
        [y1 - yb, H + 10],
      ],
      f2,
      0,
    );
    A.wallPoly(
      x,
      y,
      x,
      y1,
      [
        [ya - y, H],
        [yb - y, H],
        [yb - y, H + 10],
      ],
      fb,
      0,
    );
    A.slope(
      V(x1, ya, H),
      V(x, ya, H),
      V(x, yb, H + 10),
      V(x1, yb, H + 10),
      seam3('metalR'),
      len,
      Math.hypot(tw, 10 / ZPX),
    );
    A.wall(x, yb, x1, yb, H, H + 10, (u, v) => M.glass + (u % 12 === 0 ? 0 : v > 5 ? 2 : 1));
  }
  A.cyl(
    x1 - 0.3,
    y + 0.35,
    0.2,
    H + 2,
    140,
    (_u, zr) =>
      M.brickB +
      clampLv(
        1 +
          ((zr + H) % 24 < 1 ? -1 : 0) +
          (zr > 92 ? -1 : 0) +
          (hash(Math.floor(zr / 4), 2) < 0.15 ? 1 : 0),
        4,
      ),
    10,
    M.dark,
  );
  W.stacks.push([x1 - 0.3, y + 0.35, 140]);
  collide(x, y, x1, y1);
  light(x1, y1 - 0.4, 14, 30, [255, 210, 140], 0.6);
}

export function ballField(id: number, x: number, y: number): void {
  const G = W.ground;
  G.rect(x, y, x + 2.4, y + 2.4, turfP);
  G.poly(
    [
      [x + 1.2, y + 0.35],
      [x + 2.05, y + 1.2],
      [x + 1.2, y + 2.05],
      [x + 0.35, y + 1.2],
    ],
    dirtP,
  );
  G.poly(
    [
      [x + 1.2, y + 0.9],
      [x + 1.5, y + 1.2],
      [x + 1.2, y + 1.5],
      [x + 0.9, y + 1.2],
    ],
    turfP,
  );
  for (const [bx, by] of [
    [1.2, 0.35],
    [2.05, 1.2],
    [0.35, 1.2],
    [1.2, 2.05],
  ] as const)
    G.rect(x + bx - 0.04, y + by - 0.04, x + bx + 0.04, y + by + 0.04, () => M.paintW + 1);
  for (let k = 0; k <= 14; k++) A.post(x - 0.05, y + k * 0.18, 0.008, 0, 9, M.steel + 1);
  A.sbox(x - 0.06, y, x - 0.04, y + 2.52, 8, 1, M.steel + 2);
  for (const [lx, ly] of [
    [x - 0.2, y - 0.2],
    [x + 2.6, y - 0.2],
    [x - 0.2, y + 2.6],
    [x + 2.6, y + 2.6],
  ] as const) {
    A.post(lx, ly, 0.02, 0, 70, M.steel + 1);
    A.sbox(lx - 0.1, ly - 0.03, lx + 0.1, ly + 0.03, 70, 4, M.lampLit + 1);
    roundCollide(lx, ly, 0.05);
    light(lx, ly, 66, 90, [255, 235, 190], 0.9);
  }
  for (let s = 0; s < 3; s++)
    A.sbox(x - 0.1, y + 2.5 + s * 0.08, x + 1.0, y + 2.74, 0, 6 + s * 4, M.steel + 2 - (s & 1));
  collide(x - 0.1, y + 2.5, x + 1.0, y + 2.74);
  door(id, x + 1.2, y + 2.65, 1.3);
}

export function emptyLot(id: number, x: number, y: number): void {
  W.ground.rect(x, y, x + 1.5, y + 1.2, gravelP);
  for (const [px, py] of [
    [x, y],
    [x + 1.5, y],
    [x, y + 1.2],
    [x + 1.5, y + 1.2],
  ] as const)
    A.post(px, py, 0.02, 0, 8, M.orange + 1);
  const face = withText(
    () => M.sidW + 2,
    [
      { s: 'COMING', u: 3, v: 10, tok: M.red + 2 },
      { s: 'SOON', u: 7, v: 3, tok: M.red + 2 },
    ],
  );
  A.post(x + 0.75, y + 1.2, 0.02, 0, 14, M.wood + 1);
  A.box(x + 0.45, y + 1.18, x + 1.05, y + 1.22, 6, 18, {
    f: face,
    b: face,
    r: () => M.sidW,
    t: () => M.sidW + 2,
  });
  door(id, x + 0.75, y + 1.4, 1.2);
}

export function farmStand(id: number, x: number, y: number): void {
  const red = facade({ kind: 'siding', mat: 'sidR' });
  const f = withText(
    facade({
      kind: 'siding',
      mat: 'sidR',
      wins: [{ u: 6, v: 3, w: 24, h: 14, k: 'store', lit: true }],
      bands: [{ v0: 17, v1: 22, fn: (u) => M.awnG + ((u >> 2) & 1 ? 2 : 3) }],
    }),
    [{ s: 'PEACHES', u: 4, v: 18, tok: M.trim + 2 }],
  );
  A.box(x, y, x + 1.2, y + 0.9, 0, 24, { f, r: red, t: false });
  A.gable(x, y, x + 1.2, y + 0.9, 24, 9, 'x', shingle3('shR'), red, 0.05);
  for (let k = 0; k < 5; k++) {
    // crates of peaches out front
    const cx = x + 0.12 + k * 0.2;
    A.sbox(cx - 0.07, y + 0.95, cx + 0.07, y + 1.07, 0, 4, M.wood + 1);
    for (const dx of [-0.03, 0.03])
      A.sbox(cx + dx - 0.015, y + 0.99, cx + dx + 0.015, y + 1.02, 4, 1.5, M.orange + 2);
  }
  collide(x, y, x + 1.2, y + 0.9);
  door(id, x + 0.6, y + 1.2);
}

/** A wind turbine's tower; the scene adds and spins the rotor. */
export function turbine(id: number, gx: number, gy: number, h = 130): void {
  A.cyl(gx, gy, 0.07, 0, h, () => M.trim + 2, 8, M.trim + 2);
  A.sbox(gx - 0.12, gy - 0.05, gx + 0.08, gy + 0.05, h - 2, 7, M.trim + 1);
  W.turbines.push([gx, gy, h]);
  roundCollide(gx, gy, 0.1);
  door(id, gx + 0.25, gy + 0.25, 0.9);
}

// ---- Trees: recorded here, drawn as instanced meshes by the scene ----
export function tree(
  gx: number,
  gy: number,
  o: { r?: number; th?: number; mats?: MatName[] } = {},
): void {
  W.trees.push({
    kind: 'tree',
    gx,
    gy,
    r: o.r ?? 19,
    th: o.th ?? 24,
    mats: o.mats ?? ['leafA', 'leafB', 'leafC'],
  });
  roundCollide(gx, gy, 0.07);
  // the first tree of a place (the orchard) is its door
  if (curId && !W.doors.some((d) => d.id === curId)) door(curId, gx, gy, 1.6);
}
export function pineTree(gx: number, gy: number, h = 56): void {
  W.trees.push({ kind: 'pine', gx, gy, h });
  roundCollide(gx, gy, 0.07);
}
export function shrub(gx: number, gy: number, r = 8, mat: MatName = 'shrub'): void {
  W.trees.push({ kind: 'shrub', gx, gy, r, mat });
}

// ---- Street furniture ----
export function pole(gx: number, gy: number, z0: number, z1: number, tok: number, w = 1): void {
  A.post(gx, gy, 0.012 * w, z0, z1 - z0, tok);
}
export function lampPost(gx: number, gy: number, h = 26): void {
  A.post(gx, gy, 0.018, 0, h, M.dark + 1);
  A.sbox(gx - 0.035, gy - 0.035, gx + 0.035, gy + 0.035, h, 5, M.lampLit + 1);
  A.sbox(gx - 0.045, gy - 0.045, gx + 0.045, gy + 0.045, h + 5, 2, M.dark + 1);
  light(gx, gy, h + 2, 46, [255, 190, 100], 0.9);
  roundCollide(gx, gy, 0.05);
}
export function bench(gx: number, gy: number): void {
  A.sbox(gx - 0.14, gy - 0.04, gx + 0.14, gy + 0.04, 4, 1, M.wood + 2);
  A.sbox(gx - 0.14, gy + 0.03, gx + 0.14, gy + 0.05, 5, 5, M.wood + 1);
  for (const dx of [-0.12, 0.12]) A.post(gx + dx, gy, 0.01, 0, 4, M.steel);
  roundCollide(gx, gy, 0.12);
}
export function mailbox(gx: number, gy: number): void {
  A.post(gx, gy, 0.01, 0, 8, M.wood + 1);
  A.sbox(gx - 0.04, gy - 0.025, gx + 0.04, gy + 0.025, 8, 3, M.steel + 2);
  A.post(gx + 0.045, gy, 0.006, 9, 3, M.red + 2);
}
export function utilityPole(gx: number, gy: number, h = 70): void {
  A.post(gx, gy, 0.022, 0, h, M.trunk + 1);
  A.sbox(gx - 0.012, gy - 0.22, gx + 0.012, gy + 0.22, h - 3, 2, M.trunk + 2);
  A.sbox(gx - 0.012, gy - 0.14, gx + 0.012, gy + 0.14, h - 10, 2, M.trunk + 2);
  W.poles.push([gx, gy, h - 2]);
  roundCollide(gx, gy, 0.05);
}
