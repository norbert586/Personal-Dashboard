/**
 * Going in (ADR-027): the geometry of a doorway. Pure, so where you stop, step through and come
 * back out is tested without a browser.
 */
import type { Door, World } from './world/builders.ts';

export interface Doorway {
  /** Where you stand to knock: the door's own point. */
  step: [number, number];
  /** The door in the wall, and how far inside you walk. */
  sill: [number, number];
  inside: [number, number];
  /** Outward normal of the wall the door is in, or null for places without a wall (a field, a tree). */
  normal: [number, number] | null;
}

/** The doorway for a door: the wall face it sits in front of, if any. */
export function doorway(world: World, door: Door): Doorway {
  const step: [number, number] = [door.x, door.y];
  let best = null;
  let bd = 0.7;
  for (const c of world.colliders) {
    if (c.id !== door.id) continue;
    const d = Math.hypot(
      Math.max(c.x0 - door.x, 0, door.x - c.x1),
      Math.max(c.y0 - door.y, 0, door.y - c.y1),
    );
    if (d < bd) {
      bd = d;
      best = c;
    }
  }
  if (!best) return { step, sill: step, inside: step, normal: null };
  const c = best;
  const clampX = Math.min(Math.max(door.x, c.x0 + 0.1), c.x1 - 0.1);
  const clampY = Math.min(Math.max(door.y, c.y0 + 0.1), c.y1 - 0.1);
  if (door.y >= c.y1)
    return { step, sill: [clampX, c.y1], inside: [clampX, c.y1 - 0.3], normal: [0, 1] };
  if (door.y <= c.y0)
    return { step, sill: [clampX, c.y0], inside: [clampX, c.y0 + 0.3], normal: [0, -1] };
  if (door.x >= c.x1)
    return { step, sill: [c.x1, clampY], inside: [c.x1 - 0.3, clampY], normal: [1, 0] };
  return { step, sill: [c.x0, clampY], inside: [c.x0 + 0.3, clampY], normal: [-1, 0] };
}

/** The door you're nearest, within its reach. */
export function nearestDoor(world: World, x: number, y: number): Door | null {
  let best: Door | null = null;
  let bd = Infinity;
  for (const d of world.doors) {
    const dd = Math.hypot(d.x - x, d.y - y);
    if (dd < d.reach && dd < bd) {
      bd = dd;
      best = d;
    }
  }
  return best;
}

/**
 * Walking straight into a door goes in: you're close to it and heading into its wall. Places
 * without a wall (a field, the orchard) wait for F or a tap.
 */
export function walksIn(
  world: World,
  door: Door,
  x: number,
  y: number,
  fx: number,
  fy: number,
): boolean {
  const way = doorway(world, door);
  if (!way.normal) return false;
  const close = Math.hypot(way.sill[0] - x, way.sill[1] - y) < 0.42;
  const heading = -(fx * way.normal[0] + fy * way.normal[1]) > 0.6;
  return close && heading;
}
