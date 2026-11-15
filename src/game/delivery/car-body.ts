/**
 * The car you see (DESIGN: Delivery mode): Norbert's silver 2006 Chevrolet HHR, low-poly and at
 * its real size, with a lit topper sign. It's a tall retro wagon: a raised bonnet between
 * separate bulging wings, a chrome grille bar, a high waistline under short windows, running
 * boards, and an upright tailgate with the tail lamps high on its pillars. The wheels
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
    const paint = flat(0xb4b8bd);
    const shade = flat(0x9a9ea4);
    const glass = flat(0x1c2836);
    const trim = flat(0x23262b);
    const chrome = flat(0xe4e6e8);
    const s = this.shell;
    // The car sits about its centre of mass: the nose is 1.98 m ahead of it, the tail 2.5 behind.
    // The body, from the sills up to the waistline.
    box(s, 1.6, 0.62, 4.36, paint, 0, 0.67, 0.26);
    // The bonnet stands proud between the wings and tapers a little to the grille.
    box(s, 1.02, 0.2, 1.3, paint, 0, 1.02, -1.2);
    box(s, 0.94, 0.16, 0.2, paint, 0, 0.98, -1.9);
    for (const side of [-1, 1]) {
      // Wings: bulging out over each wheel in stepped arches, joined by a running board.
      box(s, 0.34, 0.44, 1.5, paint, side * 0.71, 0.65, -1.12);
      box(s, 0.34, 0.12, 1.14, paint, side * 0.71, 0.93, -1.1);
      box(s, 0.34, 0.08, 0.74, shade, side * 0.71, 1.03, -1.08);
      box(s, 0.34, 0.5, 1.42, paint, side * 0.71, 0.67, 1.62);
      box(s, 0.34, 0.1, 1.02, paint, side * 0.71, 0.97, 1.6);
      box(s, 0.34, 0.07, 0.62, shade, side * 0.71, 1.05, 1.58);
      box(s, 0.22, 0.08, 1.5, trim, side * 0.8, 0.36, 0.26);
      // Lamps in the wing fronts, and the tail lamps high on the rear pillars.
      box(s, 0.3, 0.24, 0.08, this.head, side * 0.69, 0.8, -1.88);
      box(s, 0.12, 0.34, 0.08, this.tail, side * 0.76, 1.12, 2.44);
      // Door mirrors.
      box(s, 0.16, 0.12, 0.1, paint, side * 0.9, 1.12, -0.42);
    }
    // The grille: a dark mouth with the chrome bar across it, over a body-colour bumper.
    box(s, 0.98, 0.3, 0.06, trim, 0, 0.74, -1.99);
    box(s, 1.06, 0.07, 0.08, chrome, 0, 0.78, -2);
    box(s, 1.7, 0.2, 0.16, paint, 0, 0.48, -1.94);
    box(s, 1.7, 0.22, 0.16, paint, 0, 0.5, 2.44);
    box(s, 1.5, 0.12, 0.2, trim, 0, 0.34, -1.9);
    box(s, 1.5, 0.12, 0.2, trim, 0, 0.34, 2.4);
    // The cabin: glass all round, with painted pillars and a long flat roof.
    box(s, 1.5, 0.46, 2.86, glass, 0, 1.2, 0.96);
    for (const z of [-0.4, 0.5, 1.42, 2.34])
      for (const side of [-1, 1]) box(s, 0.1, 0.5, 0.12, paint, side * 0.74, 1.2, z);
    box(s, 1.5, 0.5, 0.1, paint, 0, 1.2, 2.39);
    box(s, 1.2, 0.3, 0.06, glass, 0, 1.26, 2.45);
    box(s, 1.56, 0.1, 2.9, paint, 0, 1.48, 0.98);
    // The windscreen leans back from the bonnet to the roof.
    const screen = box(s, 1.44, 0.06, 0.66, glass, 0, 1.27, -0.66);
    screen.rotation.x = -0.92;
    // The number plate, and chrome on the tailgate handle and the door handles.
    box(s, 0.34, 0.14, 0.04, chrome, 0, 0.74, 2.46);
    box(s, 0.5, 0.05, 0.05, chrome, 0, 0.98, 2.46);
    for (const side of [-1, 1])
      for (const z of [0.2, 1.1]) box(s, 0.04, 0.04, 0.16, chrome, side * 0.81, 0.92, z);
    // The topper sign, lit at night.
    box(s, 0.78, 0.3, 0.34, this.sign, 0, 1.68, 0.3);
    const tyre = new CylinderGeometry(CAR.wheelRadius, CAR.wheelRadius, 0.22, 12);
    tyre.rotateZ(Math.PI / 2);
    const rim = new CylinderGeometry(0.21, 0.21, 0.24, 10);
    rim.rotateZ(Math.PI / 2);
    const rubber = flat(0x17181b);
    for (const [x, z, steers] of [
      [-0.745, -CAR.front, true],
      [0.745, -CAR.front, true],
      [-0.745, CAR.rear, false],
      [0.745, CAR.rear, false],
    ] as const) {
      const hub = new Group();
      hub.position.set(x, CAR.wheelRadius, z);
      const wheel = new Mesh(tyre, rubber);
      wheel.castShadow = true;
      // An alloy with five dark gaps, so you can see it turn.
      wheel.add(new Mesh(rim, chrome));
      for (let k = 0; k < 5; k++) {
        const gap = new Mesh(new BoxGeometry(0.26, 0.09, 0.05), trim);
        const a = (k / 5) * Math.PI * 2;
        gap.position.set(0, Math.sin(a) * 0.13, Math.cos(a) * 0.13);
        gap.rotation.x = -a;
        wheel.add(gap);
      }
      hub.add(wheel);
      this.root.add(hub);
      this.wheels.push(wheel);
      if (steers) this.steered.push(hub);
    }
    this.lamp.position.set(0, 0.9, -1.8);
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
