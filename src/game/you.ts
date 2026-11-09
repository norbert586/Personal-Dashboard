/**
 * You: a regular guy who walks, runs and bikes (SPEC: MVP). Pure movement rules, so "keys follow
 * the streets" and "never gets stuck" are tested without a browser.
 */
import type { World } from './world/builders.ts';

export interface You {
  x: number;
  y: number;
  /** Facing, a unit vector on the grid. */
  fx: number;
  fy: number;
  /** Tiles per second. */
  speed: number;
  mode: 'walk' | 'bike';
  /** Stride (or pedal) phase for the animation. */
  phase: number;
  /** Bike lean into turns, radians. */
  lean: number;
}

/** Keys held this frame: ix is right/left, iy is up/down the screen. */
export interface Input {
  ix: number;
  iy: number;
  run: boolean;
}

export const WALK = 1.15;
export const RUN = 2.3;
export const BIKE_MAX = 4.4;
/** The town's walkable bounds, a little past its edges. */
const BOUNDS = { min: -3, max: 35 };

export function newYou(x: number, y: number): You {
  return { x, y, fx: -0.7, fy: 0.7, speed: 0, mode: 'walk', phase: 0, lean: 0 };
}

/** Whether a body of radius r at (x, y) overlaps anything solid. */
export function blocked(world: World, x: number, y: number, r: number): boolean {
  if (x < BOUNDS.min || y < BOUNDS.min || x > BOUNDS.max || y > BOUNDS.max) return true;
  for (const c of world.colliders)
    if (x > c.x0 - r && x < c.x1 + r && y > c.y0 - r && y < c.y1 + r) return true;
  for (const [cx, cy, cr] of world.round)
    if ((x - cx) ** 2 + (y - cy) ** 2 < (cr + r) ** 2) return true;
  return false;
}

/**
 * Move by (dx, dy), sliding along walls. Brushing something, you shrink to a point; if you're
 * somehow inside it, you move freely until you're out. Either way you can never get stuck.
 */
export function move(
  you: You,
  world: World,
  dx: number,
  dy: number,
  r: number,
  bike = false,
): void {
  if (blocked(world, you.x, you.y, r)) {
    r = 0.03;
    if (blocked(world, you.x, you.y, r)) {
      you.x += dx;
      you.y += dy;
      return;
    }
  }
  if (!blocked(world, you.x + dx, you.y + dy, r)) {
    you.x += dx;
    you.y += dy;
    return;
  }
  if (Math.abs(dx) > 1e-6 && !blocked(world, you.x + dx, you.y, r)) {
    you.x += dx;
    if (bike) you.speed *= 0.96;
    return;
  }
  if (Math.abs(dy) > 1e-6 && !blocked(world, you.x, you.y + dy, r)) {
    you.y += dy;
    if (bike) you.speed *= 0.96;
    return;
  }
  if (bike) you.speed *= 0.3;
}

/**
 * Keys follow the streets (DESIGN: Moving around): the input is turned 45° and read in the nearest
 * classic isometric view, so one key keeps you on a sidewalk and two walk straight up or across the
 * screen. Returns a grid direction, not normalised.
 */
export function keyDirection(ix: number, iy: number, yaw: number): [number, number] {
  const q = Math.round((yaw - Math.PI / 4) / (Math.PI / 2)) * (Math.PI / 2) + Math.PI / 4;
  const rx = (ix - iy) * Math.SQRT1_2;
  const ry = (ix + iy) * Math.SQRT1_2;
  return [Math.sin(q) * rx - Math.cos(q) * ry, -Math.cos(q) * rx - Math.sin(q) * ry];
}

/**
 * One frame of movement toward grid direction (dx, dy) (zero to stand still). Walking turns at
 * once; the bike steers, coasts and leans.
 */
export function step(
  you: You,
  world: World,
  dx: number,
  dy: number,
  run: boolean,
  dt: number,
): void {
  const m = Math.hypot(dx, dy);
  if (m > 0) {
    dx /= m;
    dy /= m;
  }
  if (you.mode === 'walk') {
    const want = m > 0 ? (run ? RUN : WALK) : 0;
    you.speed += (want - you.speed) * Math.min(1, dt * 10);
    if (m > 0) {
      you.fx = dx;
      you.fy = dy;
    }
    move(you, world, you.fx * you.speed * dt, you.fy * you.speed * dt, 0.09);
    you.phase += dt * (run ? 11 : 7.5) * Math.min(1.2, you.speed / WALK);
    return;
  }
  const hd = Math.atan2(you.fy, you.fx);
  if (m > 0) {
    const diff = ((Math.atan2(dy, dx) - hd + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    if (Math.abs(diff) > 2.5 && you.speed > 0.3) you.speed = Math.max(0, you.speed - 6 * dt);
    else {
      const turn =
        Math.sign(diff) * Math.min(Math.abs(diff), dt * (3.4 - (1.7 * you.speed) / BIKE_MAX));
      you.fx = Math.cos(hd + turn);
      you.fy = Math.sin(hd + turn);
      you.speed = Math.min(BIKE_MAX, you.speed + dt * (Math.abs(diff) > 1.2 ? 0.8 : 2.6));
      you.lean +=
        ((-turn / Math.max(dt, 1e-3)) * 0.09 * (you.speed / BIKE_MAX) - you.lean) *
        Math.min(1, dt * 8);
    }
  } else {
    you.speed = Math.max(0, you.speed - dt * 0.8);
    you.lean *= 0.9;
  }
  move(you, world, you.fx * you.speed * dt, you.fy * you.speed * dt, 0.13, true);
  you.phase += dt * you.speed * 5;
}
