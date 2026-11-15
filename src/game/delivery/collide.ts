/**
 * What stops the car (ADR-036): building walls, and the edge of the zone. The car is three circles
 * along its length; any that overlaps a wall is pushed back out, and the speed into the wall is
 * taken away, so you scrape along a wall you clip and stop dead at one you hit square. Pure.
 */
import type { CarState } from './car.ts';
import type { SegGrid } from './grid.ts';

/** The car's outline: circles this far ahead of and behind its middle, each this wide. */
const OFFSETS = [1.35, 0, -1.35] as const;
const RADIUS = 0.95;
/** How much of the speed into a wall comes back as bounce. */
const BOUNCE = 0.12;

/** Push the car out of the walls it touches. Returns the speed of the hardest hit, in m/s. */
export function collide(car: CarState, walls: SegGrid): number {
  let hardest = 0;
  for (const offset of OFFSETS) {
    const fx = Math.sin(car.heading) * offset;
    const fy = Math.cos(car.heading) * offset;
    walls.each(car.x + fx, car.y + fy, RADIUS, (ax, ay, bx, by) => {
      const cx = car.x + fx;
      const cy = car.y + fy;
      const ex = bx - ax;
      const ey = by - ay;
      const len2 = ex * ex + ey * ey;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((cx - ax) * ex + (cy - ay) * ey) / len2)) : 0;
      let nx = cx - (ax + ex * t);
      let ny = cy - (ay + ey * t);
      const d = Math.hypot(nx, ny);
      if (d >= RADIUS) return;
      if (d < 1e-6) {
        // Dead on the wall: back out the way we came.
        const speed = Math.hypot(car.vx, car.vy) || 1;
        nx = -car.vx / speed;
        ny = -car.vy / speed;
      } else {
        nx /= d;
        ny /= d;
      }
      car.x += nx * (RADIUS - d);
      car.y += ny * (RADIUS - d);
      const into = car.vx * nx + car.vy * ny;
      if (into >= 0) return;
      hardest = Math.max(hardest, -into);
      car.vx -= (1 + BOUNCE) * into * nx;
      car.vy -= (1 + BOUNCE) * into * ny;
      // Scraping costs a little speed, and a knock on the nose or tail turns the car.
      car.vx *= 0.99;
      car.vy *= 0.99;
      car.yawRate = car.yawRate * 0.9 + (fx * ny - fy * nx) * into * 0.05;
    });
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
