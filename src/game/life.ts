/**
 * Life in town: townspeople pacing their routes, cars on the streets, the plane landing and taking
 * off into the wind on runway 18/36, the freight train and chimney smoke. Pure, so the simulation
 * runs and is tested without a browser; life-bodies.ts gives it bodies. Sample life until step 4
 * brings the real aircraft and weather.
 */
import type { World } from './world/builders.ts';
import type { RGB } from './world/materials.ts';
import { hash } from './world/noise.ts';

type P2 = [number, number];
export type Rng = () => number;

export interface Person {
  path: P2[];
  seg: number;
  dir: 1 | -1;
  x: number;
  y: number;
  /** Tiles per second. */
  v: number;
  kind: 'walk' | 'run' | 'bike';
  /** Animation phase offset. */
  ph: number;
  /** Seconds to stand still before moving on. */
  wait: number;
  fx: number;
  fy: number;
  skin: RGB;
  hair: RGB;
  jacket: RGB;
  pants: RGB;
  dog?: RGB;
}

export interface Car {
  a: P2;
  b: P2;
  v: number;
  /** 0 to 1 along a→b. */
  t: number;
  /** Laps so far: each lap is a different car, so its colour changes. */
  n: number;
  big: boolean;
}

/** A waypoint: x, y, height (px), speed, hold (s), and whether to ramp speed gently (takeoff, rollout). */
type Waypoint = [number, number, number, number, number?, number?];

export interface Plane {
  path: Waypoint[];
  seg: number;
  x: number;
  y: number;
  /** Height in 2D-art pixels. */
  z: number;
  v: number;
  f: P2;
  wait: number;
  acc: RGB;
}

export interface Smoke {
  x: number;
  y: number;
  z: number;
  life: number;
  big: boolean;
}

export interface Life {
  people: Person[];
  cars: Car[];
  parked: Array<[number, number, P2, number]>;
  plane: Plane;
  arrive: Waypoint[];
  depart: Waypoint[];
  stands: Array<[number, number, P2, RGB]>;
  train: { x: number; wait: number };
  smoke: Smoke[];
  chimneys: World['chimneys'];
  stacks: World['stacks'];
  /** Chimneys smoke outside summer. */
  heating: boolean;
  rng: Rng;
}

export const CAR_COLOURS: RGB[] = [
  [170, 40, 40],
  [40, 80, 150],
  [220, 220, 224],
  [30, 32, 38],
  [160, 160, 168],
  [200, 160, 40],
  [60, 110, 70],
  [120, 40, 60],
];
const SKIN: RGB[] = [
  [236, 190, 150],
  [214, 160, 120],
  [168, 118, 84],
  [120, 80, 56],
];
const HAIR: RGB[] = [
  [40, 30, 26],
  [90, 60, 36],
  [170, 130, 70],
  [200, 200, 205],
  [30, 30, 34],
];
const JACKET: RGB[] = [
  [170, 50, 45],
  [50, 90, 150],
  [60, 120, 80],
  [210, 170, 50],
  [120, 60, 120],
  [220, 220, 225],
  [40, 40, 48],
  [200, 100, 50],
];
const PANTS: RGB[] = [
  [40, 50, 80],
  [50, 50, 56],
  [90, 70, 50],
  [30, 36, 44],
];
const pickOf = <T>(list: T[], h: number): T => list[Math.floor(h * list.length)]!;

/** The colour of a car on its nth lap. */
export const carColour = (c: Car): RGB => pickOf(CAR_COLOURS, hash(c.n, c.a[0] * 7 + c.b[1]));

const RWY = 13.7;
const TWY = 11.75;

export function createLife(world: World, northbound: boolean, rng: Rng = Math.random): Life {
  const people: Person[] = [];
  const person = (
    path: P2[],
    o: {
      v?: number;
      kind?: Person['kind'];
      seed?: number;
      wait?: number;
      jacket?: RGB;
      dog?: RGB;
    } = {},
  ) => {
    const s = people.length * 7 + (o.seed ?? 0);
    const [x, y] = path[0]!;
    people.push({
      path,
      seg: 0,
      dir: 1,
      x,
      y,
      v: o.v ?? 0.5,
      kind: o.kind ?? 'walk',
      ph: Math.floor(hash(s, 1) * 8),
      wait: o.wait ?? 0,
      fx: 1,
      fy: 0,
      skin: pickOf(SKIN, hash(s, 2)),
      hair: pickOf(HAIR, hash(s, 3)),
      jacket: o.jacket ?? pickOf(JACKET, hash(s, 4)),
      pants: pickOf(PANTS, hash(s, 5)),
      ...(o.dog ? { dog: o.dog } : {}),
    });
  };
  const hiVis: RGB = [230, 200, 40];
  person(
    [
      [2.4, 19.2],
      [30, 19.2],
    ],
    { v: 0.5, seed: 1 },
  );
  person(
    [
      [28, 19.2],
      [4, 19.2],
    ],
    { v: 0.42, seed: 2 },
  );
  person(
    [
      [6, 19.3],
      [14, 19.3],
    ],
    { v: 0.38, seed: 3, dog: [150, 110, 70] },
  );
  person(
    [
      [3, 16.3],
      [26, 16.3],
    ],
    { v: 0.5, seed: 4 },
  );
  person(
    [
      [14.2, 24.1],
      [25.5, 24.1],
    ],
    { v: 0.46, seed: 5, dog: [40, 40, 44] },
  );
  person(
    [
      [25.5, 22.95],
      [14.5, 22.95],
    ],
    { v: 0.44, seed: 6 },
  );
  person(
    [
      [10.4, 20.8],
      [10.4, 31],
    ],
    { v: 0.95, kind: 'run', seed: 7 },
  );
  person(
    [
      [10.4, 31],
      [10.4, 20.8],
    ],
    { v: 1.7, kind: 'bike', seed: 8 },
  );
  person(
    [
      [10.4, 21.5],
      [10.4, 30.5],
    ],
    { v: 1.4, kind: 'bike', seed: 9 },
  );
  person(
    [
      [6.1, 7.9],
      [6.1, 8.7],
      [8.8, 9.0],
    ],
    { v: 0.4, seed: 10, jacket: hiVis },
  );
  person(
    [
      [12.0, 8.1],
      [12.6, 10.6],
    ],
    { v: 0.35, seed: 11, jacket: hiVis },
  );
  person(
    [
      [4.4, 7.7],
      [8.6, 9.2],
      [8.6, 7.7],
    ],
    { v: 0.45, seed: 12 },
  );
  person(
    [
      [16.9, 19.1],
      [19.9, 19.1],
    ],
    { v: 0.3, seed: 13 },
  );
  person(
    [
      [2.8, 25.6],
      [8.5, 25.6],
    ],
    { v: 0.35, seed: 14 },
  );
  person(
    [
      [3.4, 22.4],
      [3.4, 23.6],
      [4.2, 23.0],
    ],
    { v: 0.4, seed: 15, wait: 1 },
  );

  const cars: Car[] = [];
  const route = (a: P2, b: P2, v: number, t: number, big = false) =>
    cars.push({ a, b, v, t, n: 0, big });
  route([0, 20.08], [32, 20.08], 1.5, 0.1);
  route([32, 19.62], [0, 19.62], 1.3, 0.45);
  route([0, 20.08], [32, 20.08], 1.7, 0.7, true);
  route([32, 15.5], [0, 15.5], 1.6, 0.3);
  route([0, 15.9], [32, 15.9], 1.4, 0.8);
  route([30.65, 8], [30.65, 32], 2.4, 0.2);
  route([30.15, 32], [30.15, 8], 2.2, 0.6);
  route([30.65, 8], [30.65, 32], 2.0, 0.9, true);
  route([12.6, 23.75], [26.6, 23.75], 1.0, 0.3);
  route([26.6, 29.2], [12.6, 29.2], 0.9, 0.7);
  route([1.65, 0], [1.65, 32], 1.3, 0.5);
  route([13.35, 20.7], [13.35, 32], 1.0, 0.2);

  const parked: Life['parked'] = [
    [5.3, 19.55, [1, 0], 0], [8.9, 19.55, [1, 0], 2], [12.1, 19.5, [1, 0], 4], [28.4, 19.5, [1, 0], 6],
    [17.2, 19.15, [0, 1], 1], [18.4, 19.15, [0, 1], 5], [19.6, 19.15, [0, 1], 3], [22.0, 19.1, [0, 1], 7],
    [23.6, 19.1, [0, 1], 2], [4.0, 3.9, [0, 1], 3], [5.2, 4.3, [0, 1], 0], [6.4, 3.8, [0, 1], 6],
  ]; // prettier-ignore
  // cars in the subdivision's driveways
  for (const [x, y] of [
    [16.3, 24.2],
    [18.7, 24.2],
    [23.5, 24.2],
  ] as const)
    parked.push([x + 1.4, y - 1.2, [0, 1], Math.floor(hash(x, y) * 8)]);

  // Land and take off into the wind (ADR: the sample wind is from the north-west).
  const arrive: Waypoint[] = northbound
    ? [[44, RWY, 150, 3.4], [24.0, RWY, 0, 2.8], [14.0, RWY, 0, 0.6, 0, 1], [14.0, 12.6, 0, 0.45], [14.0, TWY, 0, 0.45], [9.4, TWY, 0, 0.45], [9.4, 9.7, 0, 0.4, 9]]
    : [[-14, RWY, 150, 3.4], [3.0, RWY, 0, 2.8], [14.0, RWY, 0, 0.6, 0, 1], [14.0, 12.6, 0, 0.45], [14.0, TWY, 0, 0.45], [9.4, TWY, 0, 0.45], [9.4, 9.7, 0, 0.4, 9]]; // prettier-ignore
  const depart: Waypoint[] = northbound
    ? [[9.4, 9.7, 0, 0.4], [9.4, TWY, 0, 0.45], [23.05, TWY, 0, 0.45], [23.05, 13.1, 0, 0.45], [23.05, RWY, 0, 0.4, 2.5], [19.0, RWY, 0, 2.8, 0, 1], [9.0, RWY, 40, 3.4], [-16, RWY, 160, 3.8]]
    : [[9.4, 9.7, 0, 0.4], [9.4, TWY, 0, 0.45], [5.6, TWY, 0, 0.45], [5.6, 13.1, 0, 0.45], [5.6, RWY, 0, 0.4, 2.5], [9.0, RWY, 0, 2.8, 0, 1], [19.0, RWY, 40, 3.4], [40, RWY, 160, 3.8]]; // prettier-ignore
  const plane: Plane = {
    path: arrive,
    seg: 1,
    x: arrive[0]![0],
    y: RWY,
    z: 150,
    v: 3.4,
    f: [northbound ? -1 : 1, 0],
    wait: 6,
    acc: [200, 50, 40],
  };
  const stands: Life['stands'] = [
    [5.0, 9.0, [0, 1], [40, 90, 160]],
    [7.4, 9.4, [0.2, 0.98], [30, 120, 80]],
    [12.4, 9.2, [-0.1, 1], [220, 170, 40]],
    [16.2, 9.0, [0.1, 1], [160, 60, 110]],
    [18.6, 9.6, [0, 1], [200, 50, 40]],
  ];
  return {
    people,
    cars,
    parked,
    plane,
    arrive,
    depart,
    stands,
    train: { x: -30, wait: 5 },
    smoke: [],
    chimneys: world.chimneys,
    stacks: world.stacks,
    heating: world.season !== 'summer',
    rng,
  };
}

function stepPerson(p: Person, dt: number): void {
  if (p.wait > 0) {
    p.wait -= dt;
    return;
  }
  const tgt = p.path[p.seg + p.dir];
  if (!tgt) {
    p.dir = p.dir === 1 ? -1 : 1;
    p.wait = 1 + hash(p.ph, 3) * 3;
    return;
  }
  const dx = tgt[0] - p.x;
  const dy = tgt[1] - p.y;
  const d = Math.hypot(dx, dy);
  const step = p.v * dt;
  if (d <= step) {
    [p.x, p.y] = tgt;
    p.seg += p.dir;
    if (p.seg + p.dir < 0 || p.seg + p.dir >= p.path.length) {
      p.dir = p.dir === 1 ? -1 : 1;
      p.wait = 1 + hash(p.ph, 4) * 4;
    }
  } else {
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
    p.fx = dx / d;
    p.fy = dy / d;
  }
}

function stepPlane(L: Life, dt: number): void {
  const p = L.plane;
  if (p.wait > 0) {
    p.wait -= dt;
    return;
  }
  const tgt = p.path[p.seg];
  if (!tgt) {
    // at the end of a trip, start the other one
    p.path = p.path === L.arrive ? L.depart : L.arrive;
    p.seg = 1;
    const [x, y, z, v] = p.path[0]!;
    Object.assign(p, { x, y, z, v, wait: p.path === L.depart ? 5 : 14 });
    return;
  }
  const [tx, ty, tz, tv, hold = 0, ramp = 0] = tgt;
  const dx = tx - p.x;
  const dy = ty - p.y;
  const dz = (tz - p.z) / 40;
  const d = Math.hypot(dx, dy, dz);
  const flat = Math.hypot(dx, dy);
  p.v += (tv - p.v) * Math.min(1, dt * (ramp ? 0.5 : 2.2));
  const step = Math.max(0.06, p.v) * dt;
  if (flat > 0.001) {
    const k = Math.min(1, dt * 3);
    const fx = p.f[0] + (dx / flat - p.f[0]) * k;
    const fy = p.f[1] + (dy / flat - p.f[1]) * k;
    const m = Math.hypot(fx, fy) || 1;
    p.f = [fx / m, fy / m];
  }
  if (d <= step) {
    p.x = tx;
    p.y = ty;
    p.z = tz;
    p.seg++;
    p.wait = hold;
  } else {
    p.x += (dx / d) * step;
    p.y += (dy / d) * step;
    p.z += (dz / d) * step * 40;
  }
}

export function stepLife(L: Life, dt: number): void {
  for (const p of L.people) stepPerson(p, dt);
  for (const c of L.cars) {
    c.t += (c.v * dt) / Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]);
    if (c.t > 1) {
      c.t = 0;
      c.n++;
    }
  }
  stepPlane(L, dt);
  const T = L.train;
  if (T.wait > 0) T.wait -= dt;
  else {
    T.x += 2.2 * dt;
    if (T.x > 52) {
      T.x = -34;
      T.wait = 30 + L.rng() * 30;
    }
  }
  for (const s of L.smoke) {
    s.life += dt;
    s.z += 9 * dt;
    s.x += 0.16 * dt;
    s.y -= 0.12 * dt;
  }
  while (L.smoke.length && L.smoke[0]!.life > 6) L.smoke.shift();
  if (L.rng() < dt * 5)
    for (const [x, y, z] of L.stacks) L.smoke.push({ x, y, z, life: 0, big: true });
  if (L.heating && L.rng() < dt * 2.5)
    for (const [x, y, z] of L.chimneys)
      if (hash(x * 9, y * 9) < 0.5) L.smoke.push({ x, y, z, life: 0, big: false });
}

/** Where a car is along its route, and which way it faces. */
export function carAt(c: Car): { x: number; y: number; fx: number; fy: number } {
  const l = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]);
  return {
    x: c.a[0] + (c.b[0] - c.a[0]) * c.t,
    y: c.a[1] + (c.b[1] - c.a[1]) * c.t,
    fx: (c.b[0] - c.a[0]) / l,
    fy: (c.b[1] - c.a[1]) / l,
  };
}
