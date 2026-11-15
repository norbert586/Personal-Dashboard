/**
 * The other cars, the cyclists and the people on foot, as you see them (DESIGN: Delivery mode):
 * boxy and low-poly like your own car. Each kind of part is one instanced mesh, so a street full
 * of them is a dozen draw calls. Where they are and what they do is traffic.ts.
 */
import {
  BoxGeometry,
  Color,
  CylinderGeometry,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  type BufferGeometry,
  type Scene,
} from 'three';
import { CAR_PAINTS } from './props.ts';
import { rnd } from './space.ts';
import type { Rider, Traffic, Walker } from './traffic.ts';

const MOST = { cars: 40, people: 48 } as const;

/** One instanced part: a unit box (or wheel) placed many times a frame. */
class Parts {
  readonly mesh: InstancedMesh;
  private n = 0;

  constructor(
    scene: Scene,
    geometry: BufferGeometry,
    material: MeshLambertMaterial,
    most: number,
    shadow: boolean,
  ) {
    this.mesh = new InstancedMesh(geometry, material, most);
    this.mesh.frustumCulled = false;
    this.mesh.castShadow = shadow;
    this.mesh.count = 0;
    // The colour buffer has to exist before the first frame is drawn.
    this.mesh.setColorAt(0, new Color(1, 1, 1));
    scene.add(this.mesh);
  }

  put(matrix: Matrix4, colour: Color): void {
    if (this.n >= this.mesh.instanceMatrix.count) return;
    this.mesh.setMatrixAt(this.n, matrix);
    this.mesh.setColorAt(this.n, colour);
    this.n++;
  }

  done(): void {
    this.mesh.count = this.n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
    this.n = 0;
  }
}

/** The shapes of the other cars: a saloon, an SUV and a pickup. Sizes in metres. */
const SHAPES = [
  { wide: 1.78, long: 4.3, deck: 0.88, body: 0.52, cab: 2.2, cabAt: 0.25, cabHigh: 0.5 },
  { wide: 1.86, long: 4.55, deck: 1.08, body: 0.72, cab: 2.9, cabAt: 0.4, cabHigh: 0.56 },
  { wide: 1.92, long: 5.3, deck: 1.1, body: 0.72, cab: 1.75, cabAt: -0.5, cabHigh: 0.62 },
] as const;

const SHIRTS = [0xc0392b, 0x2c6fb0, 0xe8e4d8, 0x2e7d4f, 0xe0a030, 0x6b4c9a, 0x30343c, 0xd9739a];
const TROUSERS = [0x2a3040, 0x3b3f46, 0x4a5a7a, 0x5a4a3a, 0x202226];
const SKIN = [0xf0c8a0, 0xd9a878, 0xb07c50, 0x7a5236, 0xf4d6b8];

export class Life {
  private readonly traffic: Traffic;
  private readonly still: boolean;
  private readonly tyres: Parts;
  private readonly bodies: Parts;
  private readonly cabins: Parts;
  private readonly heads: Parts;
  private readonly tails: Parts;
  private readonly torsos: Parts;
  private readonly faces: Parts;
  private readonly limbs: Parts;
  private readonly frames: Parts;
  private readonly wheels: Parts;
  private readonly headlamp: MeshLambertMaterial;
  private readonly taillamp: MeshLambertMaterial;
  private readonly root = new Matrix4();
  private readonly part = new Matrix4();
  private readonly turn = new Matrix4();
  private readonly size = new Matrix4();
  private readonly colour = new Color();
  private readonly white = new Color(1, 1, 1);

  constructor(scene: Scene, traffic: Traffic, shadows: boolean, reducedMotion: boolean) {
    this.traffic = traffic;
    this.still = reducedMotion;
    const cube = new BoxGeometry(1, 1, 1);
    const flat = (color: number, emissive = 0x000000) =>
      new MeshLambertMaterial({ color, emissive, emissiveIntensity: 0, flatShading: true });
    this.headlamp = flat(0xd9d2b0, 0xfff2c4);
    this.taillamp = flat(0x7a1414, 0xff2a1e);
    const wheel = new CylinderGeometry(0.34, 0.34, 0.05, 10);
    wheel.rotateZ(Math.PI / 2);
    this.tyres = new Parts(scene, cube, flat(0x17181b), MOST.cars, false);
    this.bodies = new Parts(scene, cube, flat(0xffffff), MOST.cars, shadows);
    this.cabins = new Parts(scene, cube, flat(0x1c2836), MOST.cars, false);
    this.heads = new Parts(scene, cube, this.headlamp, MOST.cars * 2, false);
    this.tails = new Parts(scene, cube, this.taillamp, MOST.cars * 2, false);
    this.torsos = new Parts(scene, cube, flat(0xffffff), MOST.people, shadows);
    this.faces = new Parts(scene, cube, flat(0xffffff), MOST.people, false);
    this.limbs = new Parts(scene, cube, flat(0xffffff), MOST.people * 4, false);
    this.frames = new Parts(scene, cube, flat(0x23262b), MOST.people, false);
    this.wheels = new Parts(scene, wheel, flat(0x17181b), MOST.people * 2, false);
  }

  /** A box of a size at a place inside whatever `root` is, optionally tipped about its top. */
  private box(
    parts: Parts,
    w: number,
    h: number,
    d: number,
    x: number,
    y: number,
    z: number,
    colour: Color,
    tip = 0,
  ): void {
    this.size.makeScale(w, h, d);
    if (tip) {
      // Hinged at (x, y, z): the box hangs below the hinge and swings fore and aft.
      this.part.makeTranslation(x, y, z);
      this.turn.makeRotationX(tip);
      this.part.multiply(this.turn);
      this.turn.makeTranslation(0, -h / 2, 0);
      this.part.multiply(this.turn);
    } else this.part.makeTranslation(x, y, z);
    this.part.multiply(this.size);
    this.part.premultiply(this.root);
    parts.put(this.part, colour);
  }

  private place(x: number, y: number, heading: number, lift = 0): void {
    this.root.makeRotationY(-heading);
    this.root.setPosition(x, lift, -y);
  }

  private car(rider: Rider): void {
    const shape = SHAPES[rider.look % SHAPES.length]!;
    const paint = CAR_PAINTS[(rider.look >> 3) % CAR_PAINTS.length]!;
    this.place(rider.x, rider.y, rider.heading, 0.02);
    const half = shape.long / 2;
    const low = shape.deck - shape.body;
    this.box(this.tyres, shape.wide - 0.14, 0.4, shape.long - 0.5, 0, 0.2, 0, this.white);
    this.colour.setRGB(paint[0], paint[1], paint[2]);
    this.box(
      this.bodies,
      shape.wide,
      shape.body,
      shape.long,
      0,
      low + shape.body / 2,
      0,
      this.colour,
    );
    this.box(
      this.cabins,
      shape.wide - 0.18,
      shape.cabHigh,
      shape.cab,
      0,
      shape.deck + shape.cabHigh / 2,
      shape.cabAt,
      this.white,
    );
    for (const side of [-1, 1]) {
      const x = side * (shape.wide / 2 - 0.27);
      this.box(this.heads, 0.34, 0.16, 0.06, x, shape.deck - 0.16, -half - 0.02, this.white);
      this.box(this.tails, 0.34, 0.14, 0.06, x, shape.deck - 0.14, half + 0.02, this.white);
    }
  }

  /** A person: standing and walking, or sat on a bike with `seat` metres under them. */
  private person(look: number, stride: number, seat: number): void {
    const swing = this.still ? 0 : Math.sin(stride * (seat ? 3.2 : 4.4)) * (seat ? 0.7 : 0.55);
    const lean = seat ? -0.38 : 0;
    const shirt = this.colour.setHex(SHIRTS[look % SHIRTS.length]!);
    this.box(this.torsos, 0.44, 0.62, 0.26, 0, 1.07 + seat, lean * 0.3, shirt);
    for (const side of [-1, 1])
      this.box(
        this.limbs,
        0.12,
        0.56,
        0.14,
        side * 0.29,
        1.36 + seat,
        lean * 0.3,
        shirt,
        seat ? -1.1 : -swing * side,
      );
    const legs = this.colour.setHex(TROUSERS[(look >> 4) % TROUSERS.length]!);
    for (const side of [-1, 1])
      this.box(
        this.limbs,
        0.17,
        0.78,
        0.19,
        side * 0.12,
        0.78 + seat,
        0,
        legs,
        seat ? -0.5 + swing * side : swing * side,
      );
    const skin = this.colour.setHex(SKIN[(look >> 8) % SKIN.length]!);
    this.box(this.faces, 0.25, 0.26, 0.25, 0, 1.53 + seat, lean * 0.55, skin);
  }

  private bike(rider: Rider, time: number): void {
    this.place(rider.x, rider.y, rider.heading);
    this.box(this.frames, 0.07, 0.42, 1.1, 0, 0.62, 0, this.white);
    this.box(this.frames, 0.42, 0.05, 0.06, 0, 1.0, -0.52, this.white);
    for (const z of [-0.55, 0.55]) {
      this.part.makeTranslation(0, 0.34, z);
      this.part.premultiply(this.root);
      this.wheels.put(this.part, this.white);
    }
    this.person(rider.look, rider.speed > 0.5 ? time : 0, 0.2);
  }

  private walker(walker: Walker): void {
    this.place(walker.x, walker.y, walker.heading);
    this.person(walker.look, walker.stride, 0);
    // A few have the dog with them: it trots a step behind.
    if (rnd(walker.look, 7) > 0.2) return;
    const coat = this.colour.setHex([0x8a5a2b, 0x2b2b2b, 0xd8c9a8][walker.look % 3]!);
    this.box(this.torsos, 0.2, 0.24, 0.58, 0.5, 0.36, 0.5, coat);
    this.box(this.faces, 0.18, 0.2, 0.2, 0.5, 0.52, 0.16, coat);
  }

  /** Draw everyone where the traffic has them. `night` is 0 by day to 1 after dark. */
  sync(night: number, time: number): void {
    for (const rider of this.traffic.riders)
      if (rider.bike) this.bike(rider, time / 1000);
      else this.car(rider);
    for (const walker of this.traffic.walkers) this.walker(walker);
    this.headlamp.emissiveIntensity = night > 0.1 ? 1.4 : 0;
    this.taillamp.emissiveIntensity = 0.2 + night * 0.7;
    for (const parts of [
      this.tyres,
      this.bodies,
      this.cabins,
      this.heads,
      this.tails,
      this.torsos,
      this.faces,
      this.limbs,
      this.frames,
      this.wheels,
    ])
      parts.done();
  }
}
