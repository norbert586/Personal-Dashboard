/**
 * Small things built from boxes (DESIGN: Delivery mode): signs on poles, flagpoles, gas pumps,
 * parked cars. Detail comes from many simple shapes, so everything here is a box or a panel that
 * goes into a chunk's one mesh.
 */
import type { Label } from './labels.ts';
import type { MeshBuilder } from './mesh.ts';
import { TILE, rnd, type P3, type Tint, type XY } from './space.ts';
import { LABEL, T } from './tiles.ts';

const up = (p: XY, h: number): P3 => [p[0], p[1], h];

/**
 * A box standing at (x, y): `dir` is the unit direction of its length, `hl` and `hw` half its
 * length and width, from height `h0` to `h1`. A glow below zero lights it at night.
 */
export function box(
  out: MeshBuilder,
  x: number,
  y: number,
  dir: XY,
  hl: number,
  hw: number,
  h0: number,
  h1: number,
  tint: Tint,
  glow = 0,
  layer: number = T.plain,
): void {
  const [dx, dy] = dir;
  const ring: XY[] = [
    [x - dx * hl + dy * hw, y - dy * hl - dx * hw],
    [x + dx * hl + dy * hw, y + dy * hl - dx * hw],
    [x + dx * hl - dy * hw, y + dy * hl + dx * hw],
    [x - dx * hl - dy * hw, y - dy * hl + dx * hw],
  ];
  for (let i = 0; i < 4; i++) {
    const a = ring[i]!;
    const c = ring[(i + 1) % 4]!;
    const len = i % 2 ? hw * 2 : hl * 2;
    out.quad(
      up(a, h0),
      up(c, h0),
      up(c, h1),
      up(a, h1),
      0,
      0,
      len / TILE,
      (h1 - h0) / TILE,
      layer,
      tint,
      glow,
    );
  }
  const [a, b, c, d] = ring as [XY, XY, XY, XY];
  const u = (hl * 2) / TILE;
  const v = (hw * 2) / TILE;
  out.quad(up(a, h1), up(b, h1), up(c, h1), up(d, h1), 0, 0, u, v, layer, tint, glow);
  // Seen from below when it's off the ground: a canopy, a sign.
  if (h0 > 0.3) out.quad(up(d, h0), up(c, h0), up(b, h0), up(a, h0), 0, 0, u, v, layer, tint, glow);
}

/** A flat panel wearing a label, from `a` to `b` along its foot, between two heights. */
export function panel(
  out: MeshBuilder,
  a: XY,
  b: XY,
  h0: number,
  h1: number,
  label: Label,
  tint: Tint,
  glow: number,
): void {
  out.quad(
    up(a, h0),
    up(b, h0),
    up(b, h1),
    up(a, h1),
    label.u0,
    label.v0,
    label.u1,
    label.v1,
    LABEL,
    tint,
    glow,
  );
}

const POST: Tint = [0.3, 0.31, 0.33];
const BRICK: Tint = [1, 1, 1];

export interface SignSpec {
  x: number;
  y: number;
  /** The unit direction the sign's face runs along; it reads from both sides. */
  dir: XY;
  label: Label;
  /** Metres to a pixel of lettering. */
  scale: number;
  tint: Tint;
  /** A sign up on a pole, or a low one on a brick base. */
  tall: boolean;
}

/** A roadside sign: a lit panel on a pole, or a low monument sign on brick. */
export function sign(out: MeshBuilder, s: SignSpec): void {
  const w = s.label.w * s.scale;
  const h = s.label.h * s.scale;
  const foot = s.tall ? 3.4 : 0.7;
  const [dx, dy] = s.dir;
  const thick = 0.18;
  if (s.tall) box(out, s.x, s.y, s.dir, 0.16, 0.16, 0, foot + h, POST);
  else box(out, s.x, s.y, s.dir, w / 2 + 0.25, 0.32, 0, foot, BRICK, 0, T.brickBlank);
  box(out, s.x, s.y, s.dir, w / 2 + 0.12, thick, foot, foot + h + 0.12, s.tint, -0.5);
  for (const side of [1, -1]) {
    // Each face reads left to right from its own side.
    const ox = -dy * (thick + 0.02) * side;
    const oy = dx * (thick + 0.02) * side;
    const a: XY = [s.x + (dx * w * side) / 2 + ox, s.y + (dy * w * side) / 2 + oy];
    const b: XY = [s.x - (dx * w * side) / 2 + ox, s.y - (dy * w * side) / 2 + oy];
    panel(out, a, b, foot + 0.06, foot + 0.06 + h, s.label, s.tint, -1);
  }
}

/** A flagpole flying the flag, for schools and fire stations. */
export function flagpole(out: MeshBuilder, x: number, y: number, dir: XY): void {
  const H = 9;
  box(out, x, y, dir, 0.07, 0.07, 0, H, [0.82, 0.83, 0.85]);
  const [dx, dy] = dir;
  const a: XY = [x + dx * 0.1, y + dy * 0.1];
  const b: XY = [x + dx * 2.5, y + dy * 2.5];
  // Stripes, and a blue corner by the pole.
  out.quad(
    up(a, H - 1.5),
    up(a, H - 0.1),
    up(b, H - 0.1),
    up(b, H - 1.5),
    0,
    0,
    7 / 16,
    0.1,
    T.awning,
    [0.78, 0.16, 0.18],
  );
  const c: XY = [x + dx * 1.1, y + dy * 1.1];
  const lift: XY = [-dy * 0.02, dx * 0.02];
  for (const side of [1, -1])
    out.quad(
      up([a[0] + lift[0] * side, a[1] + lift[1] * side], H - 0.85),
      up([c[0] + lift[0] * side, c[1] + lift[1] * side], H - 0.85),
      up([c[0] + lift[0] * side, c[1] + lift[1] * side], H - 0.1),
      up([a[0] + lift[0] * side, a[1] + lift[1] * side], H - 0.1),
      0,
      0,
      0.1,
      0.1,
      T.plain,
      [0.17, 0.22, 0.48],
    );
}

/** Car colours as they are in a Michigan lot: mostly white, black, grey and silver. */
export const CAR_PAINTS: Tint[] = [
  [0.92, 0.92, 0.9],
  [0.13, 0.13, 0.15],
  [0.55, 0.57, 0.6],
  [0.74, 0.75, 0.77],
  [0.3, 0.32, 0.36],
  [0.62, 0.14, 0.14],
  [0.16, 0.25, 0.48],
  [0.92, 0.92, 0.9],
  [0.2, 0.34, 0.26],
  [0.5, 0.36, 0.22],
];
const GLASS: Tint = [0.15, 0.19, 0.25];
const TYRE: Tint = [0.09, 0.09, 0.1];

/** A parked car: three boxes. `dir` is the unit direction it points. */
export function parkedCar(out: MeshBuilder, x: number, y: number, dir: XY, seed: number): void {
  const paint = CAR_PAINTS[Math.floor(rnd(seed, 61) * CAR_PAINTS.length)]!;
  // A car, or something taller: an SUV or a pickup.
  const tall = rnd(seed, 62) < 0.45;
  const hl = tall ? 2.35 : 2.15;
  const top = tall ? 1.02 : 0.84;
  box(out, x, y, dir, hl - 0.25, 0.8, 0.02, 0.36, TYRE);
  box(out, x, y, dir, hl, 0.9, 0.3, top, paint);
  const back = tall ? 0.15 : 0.25;
  box(
    out,
    x - dir[0] * back,
    y - dir[1] * back,
    dir,
    tall ? 1.35 : 1.1,
    0.8,
    top,
    top + 0.56,
    GLASS,
  );
}
