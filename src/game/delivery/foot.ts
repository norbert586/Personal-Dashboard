/**
 * You, on foot (SPEC: Delivery mode, on foot; ADR-049): out of the car at a stop, walking at the
 * pace a quote assumes and running when you ask, stopped by whatever stops the car and by the
 * car itself. A pure model like the car's, with every value in one object. Headings are the
 * car's: 0 is north, clockwise.
 */
import { OFFSETS, RADIUS } from './collide.ts';
import type { SegGrid } from './grid.ts';
import { PACE } from './route.ts';

export const FOOT = {
  /** Walking is the quote's own pace (ADR-048), so the walk you're quoted is the walk you get. */
  walk: PACE.walk,
  /** Running, and backing up, in m/s. */
  run: 3.5,
  back: 1,
  /** Turning on the spot, in radians a second. */
  turn: 2.6,
  /** You're a circle this wide, in metres from the middle. */
  radius: 0.3,
  /** Stepping out, you stand this far clear of the car's side. */
  clear: 0.1,
  /** You can get in from this close to the car's side, and you're at a door from this close. */
  reach: 1.5,
  atDoor: 2,
  /** Metres to a full swing of the legs, there and back. */
  stride: 1.5,
} as const;

/** What stops you is settled in this many rounds at most, as for the car. */
const ROUNDS = 4;
const SKIN = 0.005;

export interface FootState {
  /** Metres east and north of the store. */
  x: number;
  y: number;
  heading: number;
  /** Metres a second along your heading: negative backing up. */
  speed: number;
  /** Where your legs are in their swing, in radians. */
  stride: number;
}

export interface FootInput {
  /** 1 is forward, -1 is backing up. */
  go: number;
  /** 1 turns right, -1 left. */
  turn: number;
  run: boolean;
}

/** Anything with a place and a heading: the car, for where its doors are. */
export interface Parked {
  x: number;
  y: number;
  heading: number;
}

const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** One step of walking: turn, then move along the new heading. */
export function stepFoot(foot: FootState, input: FootInput, dt: number): void {
  const go = clamp(input.go, -1, 1);
  foot.heading += clamp(input.turn, -1, 1) * FOOT.turn * dt;
  foot.speed = go > 0 ? go * (input.run ? FOOT.run : FOOT.walk) : go * FOOT.back;
  foot.x += Math.sin(foot.heading) * foot.speed * dt;
  foot.y += Math.cos(foot.heading) * foot.speed * dt;
  foot.stride += ((foot.speed * dt) / FOOT.stride) * Math.PI * 2;
}

/** The car's outline, as collide.ts has it: the middles of its three circles. */
function circles(car: Parked): Array<[number, number]> {
  const sin = Math.sin(car.heading);
  const cos = Math.cos(car.heading);
  return OFFSETS.map((o) => [car.x + sin * o, car.y + cos * o]);
}

/** How far you are from the car's side, in metres: 0 when you're against it. */
export function carGap(foot: { x: number; y: number }, car: Parked): number {
  let gap = Infinity;
  for (const [cx, cy] of circles(car))
    gap = Math.min(gap, Math.hypot(foot.x - cx, foot.y - cy) - RADIUS - FOOT.radius);
  return Math.max(0, gap);
}

/** Close enough to the car to get in. */
export const canGetIn = (foot: { x: number; y: number }, car: Parked): boolean =>
  carGap(foot, car) <= FOOT.reach;

/**
 * Push you out of every wall, post and trunk you overlap, and out of the car: you stop at what
 * you walk into and slide along what you clip. Returns whether anything was touched.
 */
export function settleFoot(
  foot: FootState,
  solids: readonly SegGrid[],
  car: Parked | null,
): boolean {
  let touched = false;
  for (let round = 0; round < ROUNDS; round++) {
    let deepest = 0;
    const out = (nx: number, ny: number, d: number, room: number) => {
      const still = room - d - SKIN / 2;
      if (still <= 0) return;
      // Dead on it: back out the way you came.
      const [ux, uy] =
        d > 1e-6 ? [nx / d, ny / d] : [-Math.sin(foot.heading), -Math.cos(foot.heading)];
      foot.x += ux * still;
      foot.y += uy * still;
      deepest = Math.max(deepest, still);
    };
    for (const grid of solids)
      grid.each(foot.x, foot.y, FOOT.radius, (ax, ay, bx, by) => {
        const ex = bx - ax;
        const ey = by - ay;
        const len2 = ex * ex + ey * ey;
        const t = len2 > 0 ? clamp(((foot.x - ax) * ex + (foot.y - ay) * ey) / len2, 0, 1) : 0;
        const nx = foot.x - (ax + ex * t);
        const ny = foot.y - (ay + ey * t);
        out(nx, ny, Math.hypot(nx, ny), FOOT.radius);
      });
    if (car)
      for (const [cx, cy] of circles(car)) {
        const nx = foot.x - cx;
        const ny = foot.y - cy;
        out(nx, ny, Math.hypot(nx, ny), RADIUS + FOOT.radius);
      }
    if (deepest < 1e-3) break;
    touched = true;
  }
  return touched;
}

/** Keep you inside a circle around the store, as `fence` keeps the car. */
export function fenceFoot(foot: FootState, reach: number): void {
  const d = Math.hypot(foot.x, foot.y);
  if (d <= reach) return;
  foot.x = (foot.x / d) * reach;
  foot.y = (foot.y / d) * reach;
}

/**
 * Where you stand when you get out: beside the driver's door, facing the way the car does, or
 * beside the passenger's when a wall, a post or another car is in the way there. Null when
 * neither door has room to open.
 */
export function stepOut(car: Parked, solids: readonly SegGrid[]): FootState | null {
  const sin = Math.sin(car.heading);
  const cos = Math.cos(car.heading);
  const along = OFFSETS[1];
  const side = RADIUS + FOOT.radius + FOOT.clear;
  // Anything nearer than this is between you and the car, or where you'd stand.
  const room = FOOT.radius + FOOT.clear + 0.05;
  for (const left of [1, -1]) {
    const x = car.x + sin * along - cos * side * left;
    const y = car.y + cos * along + sin * side * left;
    if (solids.every((grid) => !grid.nearest(x, y, room)))
      return { x, y, heading: car.heading, speed: 0, stride: 0 };
  }
  return null;
}
