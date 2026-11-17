/**
 * The camera behind the car (DESIGN: Delivery mode): it trails the car on a spring, looks a little
 * ahead, widens with speed, and comes in close rather than slide through a wall. On foot it
 * follows you the same way.
 */
import { PerspectiveCamera } from 'three';
import type { SegGrid } from './grid.ts';

const VIEWS = [
  { name: 'Close', back: 6.4, up: 2.5 },
  { name: 'Far', back: 11, up: 4.4 },
  { name: 'Hood', back: 0, up: 1.4 },
] as const;
/** The same views on foot: nearer and lower. There's no hood to look over, so that one is close. */
const ON_FOOT = [
  { name: 'Close', back: 3.4, up: 2.15 },
  { name: 'Far', back: 6.5, up: 3.4 },
  { name: 'Close', back: 3.4, up: 2.15 },
] as const;

/** How far the on-foot camera keeps from a wall behind you, in metres. */
const GAP = 0.35;

/** How far from (x, y) along the unit direction (dx, dy) the first wall is crossed, up to `reach`. */
export function firstWall(
  walls: SegGrid,
  x: number,
  y: number,
  dx: number,
  dy: number,
  reach: number,
): number {
  let first = reach;
  const half = reach / 2;
  walls.each(x + dx * half, y + dy * half, half, (ax, ay, bx, by) => {
    const ex = bx - ax;
    const ey = by - ay;
    const cross = dx * ey - dy * ex;
    if (Math.abs(cross) < 1e-9) return;
    const t = ((ax - x) * ey - (ay - y) * ex) / cross;
    const u = ((ax - x) * dy - (ay - y) * dx) / cross;
    if (t >= 0 && t < first && u >= 0 && u <= 1) first = t;
  });
  return first;
}

/** What the camera follows: the car, or you on foot. */
export interface Followed {
  x: number;
  y: number;
  heading: number;
}

export class Chase {
  readonly camera = new PerspectiveCamera(60, 16 / 9, 0.5, 1600);
  private view = 0;
  /** The compass heading the camera looks along, trailing the car's. */
  private yaw: number;
  private readonly reducedMotion: boolean;

  constructor(heading: number, reducedMotion: boolean) {
    this.yaw = heading;
    this.reducedMotion = reducedMotion;
  }

  /** Step to the next view; returns its name. */
  next(): string {
    this.view = (this.view + 1) % VIEWS.length;
    return VIEWS[this.view]!.name;
  }

  /** Follow `it`, moving at `speed` m/s; `onFoot` picks the nearer views. */
  update(it: Followed, speed: number, onFoot: boolean, walls: SegGrid, dt: number): void {
    const view = (onFoot ? ON_FOOT : VIEWS)[this.view]!;
    // Swing round after the car, the short way.
    const turn = Math.atan2(Math.sin(it.heading - this.yaw), Math.cos(it.heading - this.yaw));
    this.yaw += turn * Math.min(1, dt * (view.back ? 5.5 : 30));
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let back = view.back + (view.back ? Math.min(2.2, speed * 0.05) : -0.5);
    if (view.back && onFoot) {
      // You stand right at walls, so nearness won't do: the camera stops just short of the first
      // wall its line back from you crosses, down to looking over your own head.
      const hit = firstWall(walls, it.x, it.y, -sin, -cos, back + GAP);
      if (hit < back + GAP) back = Math.max(0.15, hit - GAP);
    } else if (view.back) {
      // If a wall stands between the car and the camera, come in closer.
      for (let t = 0.3; t <= 1.001; t += 0.14)
        if (walls.nearest(it.x - sin * back * t, it.y - cos * back * t, 0.8)) {
          back = Math.max(1.6, back * (t - 0.14));
          break;
        }
    }
    this.camera.position.set(it.x - sin * back, view.up, -(it.y - cos * back));
    const ahead = !view.back ? 30 : onFoot ? 5 : 7 + speed * 0.2;
    const at = !view.back ? 1.15 : onFoot ? 1.3 : 1.1;
    this.camera.lookAt(it.x + sin * ahead, at, -(it.y + cos * ahead));
    const fov = this.reducedMotion ? 62 : 60 + Math.min(13, speed * 0.3);
    if (Math.abs(fov - this.camera.fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
