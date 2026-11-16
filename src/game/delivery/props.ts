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
/** Reflective address signs, like the township's: white digits on blue, lit up at night. */
const ADDRESS: Tint = [0.16, 0.3, 0.62];
const MAILBOX: Tint = [0.14, 0.14, 0.16];

/**
 * A house number in the sign font, one digit cell at a time, centred at (x, y) on a face whose
 * outward normal is `n`, from height `h0`, `height` metres tall. It reads left to right from in
 * front of the face.
 */
export function houseNumber(
  out: MeshBuilder,
  x: number,
  y: number,
  n: XY,
  h0: number,
  height: number,
  text: string,
  digit: (d: number) => Label,
  tint: Tint = ADDRESS,
): void {
  const cell = (height * 5) / 7;
  // Facing the face, its left is to the right of the normal.
  const along: XY = [-n[1], n[0]];
  const start = -(text.length * cell) / 2;
  [...text].forEach((ch, k) => {
    const s0 = start + k * cell;
    const a: XY = [x + along[0] * s0, y + along[1] * s0];
    const b: XY = [a[0] + along[0] * cell, a[1] + along[1] * cell];
    panel(out, a, b, h0, h0 + height, digit(Number(ch)), tint, -1);
  });
}

/** How wide a house number of `digits` digits is, `height` metres tall. */
export const numberWidth = (digits: number, height: number): number => (digits * height * 5) / 7;

/**
 * A mailbox at the curb, its box pointing at the street along `toward`, with the house number on
 * a blue board under it, double-sided and square to the street so it reads from a car either way.
 */
export function mailbox(
  out: MeshBuilder,
  x: number,
  y: number,
  toward: XY,
  text: string,
  digit: (d: number) => Label,
): void {
  const height = 0.3;
  const w = numberWidth(text.length, height);
  box(out, x, y, toward, 0.045, 0.045, 0, 1.02, POST);
  box(out, x + toward[0] * 0.08, y + toward[1] * 0.08, toward, 0.26, 0.12, 1.02, 1.26, MAILBOX);
  // The board hangs off the post, back from the street.
  const bx = x - toward[0] * (w / 2 - 0.06);
  const by = y - toward[1] * (w / 2 - 0.06);
  box(out, bx, by, toward, w / 2 + 0.05, 0.02, 0.5, 0.56 + height, ADDRESS);
  const side: XY = [-toward[1], toward[0]];
  for (const s of [1, -1]) {
    const n: XY = [side[0] * s, side[1] * s];
    houseNumber(out, bx + n[0] * 0.025, by + n[1] * 0.025, n, 0.53, height, text, digit);
  }
}
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

/**
 * A street lamp: a pole, an arm reaching `arm` metres along `dir` over the road, and a head
 * that's lit at night.
 */
export function streetLamp(
  out: MeshBuilder,
  x: number,
  y: number,
  dir: XY,
  tall: number,
  arm: number,
): void {
  box(out, x, y, dir, 0.09, 0.09, 0, tall, POST);
  box(
    out,
    x + (dir[0] * arm) / 2,
    y + (dir[1] * arm) / 2,
    dir,
    arm / 2 + 0.09,
    0.05,
    tall,
    tall + 0.1,
    POST,
  );
  const hx = x + dir[0] * arm;
  const hy = y + dir[1] * arm;
  box(out, hx, hy, dir, 0.42, 0.17, tall - 0.14, tall, [1, 0.9, 0.7], -2.2);
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

/** A signal head hanging from a span wire: where it is, and the unit direction it faces. */
export interface HeadSpot {
  x: number;
  y: number;
  face: XY;
}

/**
 * Signal heads, bigger than life so three lights read from a block away at this picture's size.
 * Heights of the red, yellow and green lenses, the lens's size, and how far it stands out from
 * the middle of its housing, in metres.
 */
export const HEAD = { lenses: [6.8, 6.25, 5.7], lens: 0.44, out: 0.24, wire: 7.6 } as const;
const WOOD: Tint = [0.36, 0.27, 0.2];
const HOUSING: Tint = [0.86, 0.66, 0.1];

/**
 * A signal the way they hang here: a wire strung between two wooden poles on opposite corners,
 * with the yellow heads hanging from it over the lanes they're for. The lit lenses aren't here:
 * they change, so `signal-heads.ts` draws them.
 */
export function signalSpan(out: MeshBuilder, a: XY, b: XY, heads: readonly HeadSpot[]): void {
  const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
  const dir: XY = [(b[0] - a[0]) / len, (b[1] - a[1]) / len];
  for (const p of [a, b]) box(out, p[0], p[1], dir, 0.14, 0.14, 0, HEAD.wire + 0.7, WOOD);
  box(
    out,
    (a[0] + b[0]) / 2,
    (a[1] + b[1]) / 2,
    dir,
    len / 2,
    0.035,
    HEAD.wire,
    HEAD.wire + 0.08,
    POST,
  );
  for (const head of heads) {
    box(out, head.x, head.y, head.face, 0.04, 0.04, 7.1, HEAD.wire, POST);
    box(out, head.x, head.y, head.face, 0.22, 0.36, 5.4, 7.1, HOUSING);
  }
}
