/**
 * The camera behind the car (DESIGN: Delivery mode): it trails the car on a spring, looks a little
 * ahead, widens with speed, and comes in close rather than slide through a wall.
 */
import { PerspectiveCamera } from 'three';
import type { CarState } from './car.ts';
import type { SegGrid } from './grid.ts';

const VIEWS = [
  { name: 'Close', back: 6.4, up: 2.5 },
  { name: 'Far', back: 11, up: 4.4 },
  { name: 'Hood', back: 0, up: 1.3 },
] as const;

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

  update(car: CarState, walls: SegGrid, dt: number): void {
    const view = VIEWS[this.view]!;
    const speed = Math.hypot(car.vx, car.vy);
    // Swing round after the car, the short way.
    const turn = Math.atan2(Math.sin(car.heading - this.yaw), Math.cos(car.heading - this.yaw));
    this.yaw += turn * Math.min(1, dt * (view.back ? 5.5 : 30));
    const sin = Math.sin(this.yaw);
    const cos = Math.cos(this.yaw);
    let back = view.back + (view.back ? Math.min(2.2, speed * 0.05) : -0.5);
    if (view.back) {
      // If a wall stands between the car and the camera, come in closer.
      for (let t = 0.3; t <= 1.001; t += 0.14)
        if (walls.nearest(car.x - sin * back * t, car.y - cos * back * t, 0.8)) {
          back = Math.max(1.6, back * (t - 0.14));
          break;
        }
    }
    this.camera.position.set(car.x - sin * back, view.up, -(car.y - cos * back));
    const ahead = view.back ? 7 + speed * 0.2 : 30;
    this.camera.lookAt(car.x + sin * ahead, view.back ? 1.1 : 1.15, -(car.y + cos * ahead));
    const fov = this.reducedMotion ? 62 : 60 + Math.min(13, speed * 0.3);
    if (Math.abs(fov - this.camera.fov) > 0.05) {
      this.camera.fov = fov;
      this.camera.updateProjectionMatrix();
    }
  }
}
