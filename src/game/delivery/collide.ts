/**
 * What stops the car (ADR-036, ADR-044): building walls, parked cars and posts, and the edge of
 * the zone. The car is three circles along its length. Every wall they touch is settled together,
 * in one pass: first the car is pushed out until nothing overlaps, then the speed into each wall at
 * the point it touches is taken away, all of it, so a car stops dead at a wall it hits square and
 * scrapes along one it clips. Nothing bounces. A knock on the nose or the tail turns the car a
 * little, as if it were heavier to turn than it is. Pure; run after every step of the car.
 */
import { CAR, type CarState } from './car.ts';
import type { SegGrid } from './grid.ts';

/** The car's outline: circles this far ahead of and behind its centre of mass, each this wide. */
const OFFSETS = [1.1, -0.25, -1.6] as const;
const RADIUS = 0.95;
/** In a knock the car turns as if it were this many times harder to turn: a nudge, not a spin. */
const KNOCK = 10;
/** Grip along a wall while pressed against it: scraping a wall at speed costs speed. */
const SCRAPE = 0.3;
/** How close counts as touching, and the most rounds the push-out and the speed take. */
const SKIN = 0.005;
const ROUNDS = 4;

interface Contact {
  /** From the centre of mass to the touching circle's centre. */
  ox: number;
  oy: number;
  /** Out of the wall, a unit vector. */
  nx: number;
  ny: number;
  /** How hard the wall has pushed back so far, in N·s. */
  push: number;
}

/**
 * Visit every wall within `reach` of each of the car's circles: the circle's offset, and the way
 * out of the wall with how far it is.
 */
function touching(
  car: CarState,
  solids: readonly SegGrid[],
  reach: number,
  visit: (ox: number, oy: number, nx: number, ny: number, d: number) => void,
): void {
  const sin = Math.sin(car.heading);
  const cos = Math.cos(car.heading);
  for (const offset of OFFSETS) {
    const ox = sin * offset;
    const oy = cos * offset;
    for (const grid of solids)
      grid.each(car.x + ox, car.y + oy, reach, (ax, ay, bx, by) => {
        const cx = car.x + ox;
        const cy = car.y + oy;
        const ex = bx - ax;
        const ey = by - ay;
        const len2 = ex * ex + ey * ey;
        const t = len2 > 0 ? Math.max(0, Math.min(1, ((cx - ax) * ex + (cy - ay) * ey) / len2)) : 0;
        const nx = cx - (ax + ex * t);
        const ny = cy - (ay + ey * t);
        const d = Math.hypot(nx, ny);
        if (d >= reach) return;
        if (d > 1e-6) visit(ox, oy, nx / d, ny / d, d);
        else {
          // Dead on the wall: back out the way we came.
          const speed = Math.hypot(car.vx, car.vy) || 1;
          visit(ox, oy, -car.vx / speed, -car.vy / speed, 0);
        }
      });
  }
}

/** Settle the car against everything solid it touches. Returns how hard it hit, in m/s. */
export function collide(car: CarState, solids: readonly SegGrid[]): number {
  // ---- Out of the walls. Each push is measured again after the last, so two walls in a corner,
  // or a parked car against a wall, never push the car back into each other.
  for (let round = 0; round < ROUNDS; round++) {
    let deepest = 0;
    touching(car, solids, RADIUS, (_ox, _oy, nx, ny, d) => {
      // Measured after the pushes before it, so only what's still in is taken.
      const still = RADIUS - d - SKIN / 2;
      if (still <= 0) return;
      car.x += nx * still;
      car.y += ny * still;
      deepest = Math.max(deepest, still);
    });
    if (deepest < 1e-3) break;
  }

  // ---- What it's resting on now.
  const contacts: Contact[] = [];
  touching(car, solids, RADIUS + SKIN, (ox, oy, nx, ny) => {
    contacts.push({ ox, oy, nx, ny, push: 0 });
  });
  if (contacts.length === 0) return 0;

  // ---- Take away the speed into each wall, at the point it touches: the car's own turning
  // counts, so a nose swinging into a wall is stopped too. Rounds, so in a corner each wall
  // takes its share once rather than both taking it all.
  const inertia = CAR.inertia * KNOCK;
  const along = (c: Contact, tx: number, ty: number) => {
    // The touching point's velocity along (tx, ty), and how much a unit push there changes it.
    const arm = c.oy * tx - c.ox * ty;
    const speed = car.vx * tx + car.vy * ty + car.yawRate * arm;
    return { speed, arm, give: 1 / CAR.mass + (arm * arm) / inertia };
  };
  const apply = (j: number, tx: number, ty: number, arm: number) => {
    car.vx += (j * tx) / CAR.mass;
    car.vy += (j * ty) / CAR.mass;
    car.yawRate += (j * arm) / inertia;
  };
  let hardest = 0;
  for (const c of contacts) hardest = Math.max(hardest, -along(c, c.nx, c.ny).speed);
  for (let round = 0; round < ROUNDS; round++)
    for (const c of contacts) {
      const into = along(c, c.nx, c.ny);
      const before = c.push;
      c.push = Math.max(0, c.push - into.speed / into.give);
      apply(c.push - before, c.nx, c.ny, into.arm);
    }
  // Scraping: grip along the wall, only as much as the wall pushed back.
  for (const c of contacts) {
    const slide = along(c, -c.ny, c.nx);
    const limit = SCRAPE * c.push;
    apply(Math.max(-limit, Math.min(limit, -slide.speed / slide.give)), -c.ny, c.nx, slide.arm);
  }
  return hardest;
}

/** Keep the car inside a circle around the store: past `reach` metres it's turned back. */
export function fence(car: CarState, reach: number): boolean {
  const d = Math.hypot(car.x, car.y);
  if (d <= reach) return false;
  const nx = car.x / d;
  const ny = car.y / d;
  car.x = nx * reach;
  car.y = ny * reach;
  const out = car.vx * nx + car.vy * ny;
  if (out > 0) {
    car.vx -= out * nx;
    car.vy -= out * ny;
  }
  return true;
}
