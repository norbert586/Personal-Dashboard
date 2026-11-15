/**
 * The car you see (DESIGN: Delivery mode): boxy and low-poly, with a lit topper sign. The wheels
 * steer and spin, and the body leans on what the car is doing: it rolls in corners, dives under
 * braking and squats pulling away. Headlights throw real light after dark.
 */
import {
  BoxGeometry,
  CylinderGeometry,
  Group,
  Mesh,
  MeshLambertMaterial,
  SpotLight,
  type Scene,
} from 'three';
import { CAR, forwardSpeed, type CarState } from './car.ts';

const flat = (color: number, emissive = 0x000000) =>
  new MeshLambertMaterial({ color, emissive, emissiveIntensity: 0, flatShading: true });

export class CarBody {
  /** Follows the car over the ground. Its nose points down -z. */
  readonly root = new Group();
  /** The part that leans. */
  private readonly shell = new Group();
  private readonly wheels: Mesh[] = [];
  private readonly steered: Group[] = [];
  private readonly tail = flat(0x7a1414, 0xff2a1e);
  private readonly head = flat(0xd9d2b0, 0xfff2c4);
  private readonly sign = flat(0xf2c14e, 0xffc94a);
  private readonly lamp = new SpotLight(0xfff0c8, 0, 75, 0.52, 0.5, 1.2);
  private roll = 0;
  private pitch = 0;
  private spin = 0;

  constructor(scene: Scene, reducedMotion: boolean) {
    this.reducedMotion = reducedMotion;
    const box = (
      parent: Group,
      w: number,
      h: number,
      d: number,
      material: MeshLambertMaterial,
      x: number,
      y: number,
      z: number,
    ) => {
      const mesh = new Mesh(new BoxGeometry(w, h, d), material);
      mesh.position.set(x, y, z);
      mesh.castShadow = true;
      parent.add(mesh);
      return mesh;
    };
    const paint = flat(0xb8362b);
    const glass = flat(0x1c2836);
    const trim = flat(0x23262b);
    // Body, cabin and roof.
    box(this.shell, 1.78, 0.56, 4.3, paint, 0, 0.62, 0);
    box(this.shell, 1.6, 0.5, 2.3, glass, 0, 1.15, 0.25);
    box(this.shell, 1.62, 0.08, 2.1, paint, 0, 1.43, 0.3);
    box(this.shell, 1.8, 0.16, 0.2, trim, 0, 0.42, -2.12);
    box(this.shell, 1.8, 0.16, 0.2, trim, 0, 0.42, 2.12);
    // The topper sign, lit at night.
    box(this.shell, 0.78, 0.3, 0.34, this.sign, 0, 1.63, 0.1);
    for (const side of [-1, 1]) {
      box(this.shell, 0.34, 0.16, 0.06, this.head, side * 0.62, 0.72, -2.16);
      box(this.shell, 0.34, 0.14, 0.06, this.tail, side * 0.62, 0.74, 2.16);
    }
    const tyre = new CylinderGeometry(CAR.wheelRadius, CAR.wheelRadius, 0.24, 10);
    tyre.rotateZ(Math.PI / 2);
    const rubber = flat(0x17181b);
    for (const [x, z, steers] of [
      [-0.84, -CAR.front, true],
      [0.84, -CAR.front, true],
      [-0.84, CAR.rear, false],
      [0.84, CAR.rear, false],
    ] as const) {
      const hub = new Group();
      hub.position.set(x, CAR.wheelRadius, z);
      const wheel = new Mesh(tyre, rubber);
      wheel.castShadow = true;
      hub.add(wheel);
      this.root.add(hub);
      this.wheels.push(wheel);
      if (steers) this.steered.push(hub);
    }
    this.lamp.position.set(0, 0.9, -1.9);
    this.lamp.target.position.set(0, 0, -30);
    this.root.add(this.shell, this.lamp, this.lamp.target);
    scene.add(this.root);
  }

  private readonly reducedMotion: boolean;

  /** Put the body where the car is. `night` is 0 by day to 1 after dark. */
  sync(car: CarState, night: number, dt: number): void {
    this.root.position.set(car.x, 0.02, -car.y);
    this.root.rotation.y = -car.heading;
    for (const hub of this.steered) hub.rotation.y = -car.steer;
    this.spin -= (forwardSpeed(car) / CAR.wheelRadius) * dt;
    for (const wheel of this.wheels) wheel.rotation.x = this.spin;
    // Lean away from the turn, dive on the brakes, squat on the gas.
    const k = Math.min(1, dt * 8);
    const lean = this.reducedMotion ? 0 : 1;
    this.roll += (Math.max(-0.07, Math.min(0.07, car.ay * 0.0065)) * lean - this.roll) * k;
    this.pitch += (Math.max(-0.045, Math.min(0.045, car.ax * 0.0075)) * lean - this.pitch) * k;
    this.shell.rotation.z = this.roll;
    this.shell.rotation.x = this.pitch;
    this.tail.emissiveIntensity = car.brake > 0.05 ? 1.6 : night * 0.6;
    this.head.emissiveIntensity = night > 0.1 ? 1.4 : 0;
    this.sign.emissiveIntensity = night * 0.9;
    this.lamp.intensity = night * 90;
  }
}
