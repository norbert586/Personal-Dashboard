/**
 * Bodies for life in town (life.ts): townspeople, cars, the plane and the parked ones, the train,
 * turbine rotors and smoke. Overhead fly the real aircraft from the ADS-B feed (sky-traffic.ts):
 * a low one sweeps right under the camera, and high jets leave contrails (DESIGN: Moving around).
 */
import {
  BufferAttribute,
  BufferGeometry,
  Float32BufferAttribute,
  Group,
  Line,
  LineBasicMaterial,
  Points,
  PointsMaterial,
  type Mesh,
  type Scene,
} from 'three';
import {
  faceTo,
  lambert,
  makeBike,
  makeFigure,
  part,
  poseRide,
  poseWalk,
  type Bike,
  type Figure,
} from './bodies.ts';
import { carAt, carColour, CAR_COLOURS, type Car, type Life, type Person } from './life.ts';
import { glowTexture, type Town } from './scene.ts';
import { planeAt, type Plane } from './sky-traffic.ts';
import { V, ZPX } from './world/atlas.ts';
import type { World } from './world/builders.ts';
import type { RGB } from './world/materials.ts';
import { hash } from './world/noise.ts';

const PX = 1 / ZPX;
/** Parts: [u along, v across, z px, length, width, height px, colour]. */
type Parts = Array<[number, number, number, number, number, number, RGB]>;

const carParts = (col: RGB, big: boolean): Parts =>
  big
    ? [
        [0, 0, 0, 0.8, 0.3, 3, [30, 32, 38]],
        [0, 0, 3, 0.82, 0.32, 6, col],
        [-0.08, 0, 9, 0.46, 0.3, 3, [48, 66, 86]],
        [-0.08, 0, 12, 0.44, 0.28, 1, col],
      ]
    : [
        [0, 0, 0, 0.58, 0.26, 2, [30, 32, 38]],
        [0, 0, 2, 0.62, 0.3, 4, col],
        [-0.04, 0, 6, 0.34, 0.29, 3, [48, 66, 86]],
        [-0.04, 0, 9, 0.3, 0.27, 1, col],
      ];
const WHITE: RGB = [236, 238, 240];
const planeParts = (acc: RGB, jet: boolean): Parts =>
  jet
    ? [
        [0, 0, 4, 1.0, 0.13, 6, WHITE],
        [0.05, 0, 3.4, 0.3, 0.9, 1.2, [220, 224, 228]],
        [-0.44, 0, 8, 0.12, 0.03, 9, acc],
        [-0.43, 0, 15, 0.1, 0.38, 1, [220, 224, 228]],
        [0.46, 0, 8, 0.1, 0.08, 2, [50, 70, 90]],
      ]
    : [
        [0, 0, 3, 0.64, 0.1, 5, WHITE],
        [0, 0, 4.4, 0.66, 0.105, 1.3, acc],
        [0.04, 0, 8.4, 0.16, 0.96, 1, WHITE],
        [-0.29, 0, 8, 0.1, 0.025, 7, acc],
        [-0.28, 0, 14, 0.07, 0.34, 0.9, WHITE],
        [0.18, 0, 8, 0.14, 0.09, 2, [50, 70, 90]],
        [0.34, 0, 5.4, 0.015, 0.3, 1, [30, 30, 34]],
      ];

function model(scene: Scene, parts: Parts): { g: Group; meshes: Mesh[] } {
  const g = new Group();
  const meshes = parts.map(([u, v, z, l, w, h, c]) =>
    part(g, l, h * PX, w, c, u, (z + h / 2) * PX, v),
  );
  scene.add(g);
  return { g, meshes };
}

interface Townsperson {
  p: Person;
  F: Figure;
  B: Bike | null;
  dog: Group | null;
}
/** A real aircraft's body, made the first time it comes into view. */
interface Flyer {
  plane: Plane;
  g: Group | null;
  trail: Line<BufferGeometry, LineBasicMaterial> | null;
}
/** Aircraft further than this from where the camera looks aren't drawn, in tiles. */
const SKY_RANGE = 60;
/** With no fresh answer for this long, an aircraft is gone: seconds. */
const SKY_STALE = 300;
/** A contrail's length, in tiles. */
const TRAIL = 9;

export class LifeBodies {
  private readonly people: Townsperson[] = [];
  private readonly cars: Array<{ c: Car; g: Group; body: Mesh[]; n: number; len: number }> = [];
  private readonly plane: Group;
  private readonly train: Group[] = [];
  private readonly rotors: Group[] = [];
  private readonly smoke: Points<BufferGeometry, PointsMaterial>;
  private readonly smokePos = new Float32Array(400 * 3);
  private readonly scene: Scene;
  private readonly flyers = new Map<string, Flyer>();
  private readonly trailMat = new LineBasicMaterial({
    color: 0xf4f6fa,
    transparent: true,
    opacity: 0.6,
    fog: false,
  });
  /** When the feed saw the aircraft, on the frame clock (seconds), and which answer that was. */
  private skyT0 = 0;
  private skyKey = '';
  private skyLoops = false;
  /** How many aircraft are in view right now. */
  inView = 0;
  private readonly life: Life;

  constructor(scene: Scene, world: World, life: Life) {
    this.life = life;
    this.scene = scene;
    for (const p of life.people) {
      const F = makeFigure(scene, {
        skin: p.skin,
        hair: p.hair,
        jacket: p.jacket,
        pants: p.pants,
        shoes: [210, 210, 214],
      });
      const B =
        p.kind === 'bike'
          ? makeBike(scene, [40 + hash(p.ph, 3) * 180, 60, 70 + hash(p.ph, 4) * 150])
          : null;
      let dog: Group | null = null;
      if (p.dog) {
        dog = new Group();
        part(dog, 0.07, 1.6 * PX, 0.028, p.dog, 0, 1.8 * PX, 0);
        part(dog, 0.03, 1.4 * PX, 0.026, p.dog, 0.045, 2.8 * PX, 0);
        for (const [dx, dz] of [
          [-0.025, -0.01],
          [-0.025, 0.01],
          [0.025, -0.01],
          [0.025, 0.01],
        ] as const)
          part(dog, 0.008, PX, 0.008, p.dog, dx, 0.5 * PX, dz);
        scene.add(dog);
      }
      this.people.push({ p, F, B, dog });
    }
    for (const c of life.cars) {
      const m = model(scene, carParts(CAR_COLOURS[0]!, c.big));
      // the body panels change colour with each lap
      this.cars.push({
        c,
        g: m.g,
        body: m.meshes.filter((_, i) => i === 1 || i === 3),
        n: -1,
        len: c.big ? 0.8 : 0.6,
      });
    }
    for (const [x, y, f, ci] of life.parked) {
      const { g } = model(scene, carParts(CAR_COLOURS[ci]!, false));
      g.position.set(x, 0, y);
      faceTo(g, f[0], f[1]);
    }
    this.plane = model(scene, planeParts(life.plane.acc, false)).g;
    for (const [x, y, f, acc] of life.stands) {
      const { g } = model(scene, planeParts(acc, false));
      g.position.set(x, 0, y);
      faceTo(g, f[0], f[1]);
    }
    for (let i = 0; i < 14; i++) {
      const g = new Group();
      const col: RGB =
        i === 0
          ? [40, 90, 70]
          : (
              [
                [120, 70, 50],
                [110, 112, 118],
                [150, 60, 40],
                [40, 42, 48],
              ] as RGB[]
            )[i % 4]!;
      const h = i === 0 ? 11 : 9;
      part(g, 0.56, h * PX, 0.26, col, 0, (h / 2 + 1) * PX, 0);
      for (const dx of [-0.2, 0.2]) part(g, 0.08, 1.4 * PX, 0.22, [30, 30, 34], dx, 0.7 * PX, 0);
      scene.add(g);
      this.train.push(g);
    }
    for (const [gx, gy, h] of world.turbines) {
      const hub = new Group();
      hub.position.set(gx + 0.1, h / ZPX + 0.06, gy);
      for (let k = 0; k < 3; k++) {
        const arm = new Group();
        arm.rotation.x = (k * Math.PI * 2) / 3;
        part(arm, 0.012, 0.5, 0.035, WHITE, 0, 0.25, 0);
        hub.add(arm);
      }
      scene.add(hub);
      this.rotors.push(hub);
    }
    const sg = new BufferGeometry();
    sg.setAttribute('position', new BufferAttribute(this.smokePos, 3));
    this.smoke = new Points(
      sg,
      new PointsMaterial({
        size: 7,
        map: glowTexture(),
        color: 0xd8dde4,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
        sizeAttenuation: false,
      }),
    );
    this.smoke.frustumCulled = false;
    scene.add(this.smoke);
  }

  /** Pose everything for time t (seconds); `still` holds the rotors for reduced motion. */
  sync(town: Town, t: number, night: number, still: boolean): void {
    const add = (x: number, y: number, z: number, c: RGB) => town.moving.add(x, y, z, c);
    for (const { p, F, B, dog } of this.people) {
      F.g.position.set(p.x, 0, p.y);
      faceTo(F.g, p.fx, p.fy);
      if (B) {
        B.g.position.set(p.x, 0, p.y);
        faceTo(B.g, p.fx, p.fy);
        poseRide(F, t * 9 + p.ph);
        if (!still) for (const w of B.wheels) w.rotation.z -= 0.2;
      } else {
        const run = p.kind === 'run';
        poseWalk(
          F,
          t * (run ? 11 : 7) + p.ph,
          p.wait <= 0 && !still ? (run ? 0.85 : 0.5) : 0,
          run ? 0.25 : 0,
        );
      }
      if (dog) {
        dog.position.set(p.x - p.fx * 0.16 + p.fy * 0.06, 0, p.y - p.fy * 0.16 - p.fx * 0.06);
        faceTo(dog, p.fx, p.fy);
      }
    }
    for (const v of this.cars) {
      const { x, y, fx, fy } = carAt(v.c);
      if (v.n !== v.c.n) {
        v.n = v.c.n;
        const mat = lambert(carColour(v.c));
        for (const m of v.body) m.material = mat;
      }
      v.g.position.set(x, 0, y);
      faceTo(v.g, fx, fy);
      const h = v.len / 2;
      for (const s of [-1, 1]) {
        add(x + fx * h - fy * 0.09 * s, y + fy * h + fx * 0.09 * s, 4, [1, 0.92, 0.7]);
        add(x - fx * h - fy * 0.09 * s, y - fy * h + fx * 0.09 * s, 4, [0.6, 0.06, 0.04]);
      }
    }
    const P = this.life.plane;
    this.plane.position.set(P.x, P.z / ZPX, P.y);
    faceTo(this.plane, P.f[0], P.f[1]);
    if (Math.floor(t * 1.4) % 2 === 0)
      add(P.x - P.f[0] * 0.3, P.y - P.f[1] * 0.3, P.z + 17, [1, 1, 1]);
    add(P.x + P.f[1] * 0.48, P.y - P.f[0] * 0.48, P.z + 9, [1, 0.2, 0.15]);
    add(P.x - P.f[1] * 0.48, P.y + P.f[0] * 0.48, P.z + 9, [0.2, 1, 0.4]);
    const T = this.life.train;
    this.train.forEach((g, i) => {
      g.visible = T.wait <= 0;
      g.position.set(T.x - i * 0.62, 0, 1.19);
    });
    if (T.wait <= 0) add(T.x + 0.3, 1.19, 6, [1, 0.95, 0.75]);
    for (const r of this.rotors) {
      r.rotation.x = (still ? 0.4 : t * 1.3) + r.position.x;
      if (Math.floor(t) % 2 === 0)
        add(r.position.x - 0.1, r.position.z, (r.position.y + 0.08) * ZPX, [1, 0.15, 0.1]);
    }
    let k = 0;
    for (const s of this.life.smoke) {
      if (k >= 400) break;
      this.smokePos.set(V(s.x, s.y, s.z), k * 3);
      k++;
    }
    this.smoke.geometry.setDrawRange(0, k);
    this.smoke.geometry.attributes.position!.needsUpdate = true;
    // Navigation lights on the real aircraft: red to port, green to starboard, a white strobe.
    if (night > 0.3)
      for (const { plane, g } of this.flyers.values()) {
        if (!g?.visible) continue;
        const p = g.position;
        const z = p.y * ZPX;
        const w = 0.48 * plane.scale;
        add(p.x + plane.fy * w, p.z - plane.fx * w, z + 9, [1, 0.2, 0.15]);
        add(p.x - plane.fy * w, p.z + plane.fx * w, z + 9, [0.2, 1, 0.4]);
        if (Math.floor(t * 1.6) % 2 === 0) add(p.x, p.z, z + 12, [1, 1, 1]);
      }
  }

  /**
   * The aircraft in the feed's latest answer. `key` names the answer, so hearing the same one again
   * changes nothing and they fly on; `age` is how old it was on arrival, in seconds; `now` is the
   * frame clock. A saved sample has no clock of its own, so it replays from the start (`loops`).
   */
  setAircraft(planes: Plane[], key: string, age: number, now: number, loops = false): void {
    if (key === this.skyKey) return;
    this.skyKey = key;
    this.skyT0 = now - age;
    this.skyLoops = loops;
    const seen = new Set(planes.map((plane) => plane.hex));
    for (const [hex, flyer] of this.flyers)
      if (!seen.has(hex)) {
        if (flyer.g) this.scene.remove(flyer.g);
        if (flyer.trail) this.scene.remove(flyer.trail);
        this.flyers.delete(hex);
      }
    for (const plane of planes) {
      const flyer = this.flyers.get(plane.hex);
      if (flyer) flyer.plane = plane;
      else this.flyers.set(plane.hex, { plane, g: null, trail: null });
    }
  }

  /**
   * Fly the real aircraft to where they are at time `now` (the frame clock, seconds), and draw the
   * ones near where the camera looks. A point h tiles up shows mid-screen when it sits h·√3 toward
   * the camera from what you look at, so that's where "near" is measured from.
   */
  sky(now: number, cx: number, cz: number, yaw: number): void {
    let elapsed = now - this.skyT0;
    if (this.skyLoops) elapsed %= SKY_STALE;
    this.inView = 0;
    for (const flyer of this.flyers.values()) {
      const { plane } = flyer;
      const [x, y] = planeAt(plane, elapsed);
      const mx = cx + Math.cos(yaw) * plane.h * 1.732;
      const my = cz + Math.sin(yaw) * plane.h * 1.732;
      const near = elapsed < SKY_STALE && Math.hypot(x - mx, y - my) < SKY_RANGE;
      if (!near) {
        if (flyer.g) flyer.g.visible = false;
        if (flyer.trail) flyer.trail.visible = false;
        continue;
      }
      this.inView++;
      if (!flyer.g) {
        const accent: RGB = plane.kind === 'jet' ? [200, 52, 44] : [46, 92, 168];
        flyer.g = model(this.scene, planeParts(accent, plane.kind === 'jet')).g;
      }
      const g = flyer.g;
      g.visible = true;
      g.scale.setScalar(plane.scale);
      g.position.set(x, plane.h, y);
      faceTo(g, plane.fx, plane.fy);
      if (!plane.contrail) continue;
      if (!flyer.trail) {
        const lg = new BufferGeometry();
        lg.setAttribute('position', new BufferAttribute(new Float32Array(6), 3));
        flyer.trail = new Line(lg, this.trailMat);
        flyer.trail.frustumCulled = false;
        this.scene.add(flyer.trail);
      }
      const tail = flyer.trail.geometry.attributes.position!;
      const back = 0.5 * plane.scale;
      tail.setXYZ(0, x - plane.fx * back, plane.h + 0.1, y - plane.fy * back);
      tail.setXYZ(1, x - plane.fx * (back + TRAIL), plane.h + 0.1, y - plane.fy * (back + TRAIL));
      tail.needsUpdate = true;
      flyer.trail.visible = true;
    }
  }
}
