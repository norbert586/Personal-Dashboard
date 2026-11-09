/**
 * The town's layout: a small Michigan town with an airfield, 32 tiles square (the feel test's
 * town). Roads, the runway and the fields are painted on the ground; buildings, trees and street
 * furniture go into the atlas. Step 7 replaces this with the real grid (ADR-016).
 */
import { Atlas } from './atlas.ts';
import {
  ballField,
  bench,
  building,
  church,
  diner,
  elevator,
  emptyLot,
  factory,
  farmStand,
  fireStation,
  hangar,
  house,
  kiosk,
  lampPost,
  light,
  mailbox,
  obj,
  pineTree,
  pole,
  radarDome,
  shop,
  shrub,
  terminal,
  tower,
  tree,
  turbine,
  utilityPole,
  waterTower,
  type World,
} from './builders.ts';
import {
  Ground,
  asphP,
  concP,
  farP,
  grassP,
  gravelP,
  mark,
  walkP,
  type GroundPaint,
} from './ground.ts';
import { M, palette, type MatName, type RGB, type Season } from './materials.ts';
import { hash } from './noise.ts';
import { PLACE } from './places.ts';

/** The town is G×G tiles. */
export const G = 32;
/** Where you start: on Main Street's sidewalk, by the cinema. */
export const START = { x: 14.6, y: 19.22 } as const;
const TURBINE_POS: Array<[number, number]> = [
  [28.3, 9.2],
  [28.6, 12.7],
  [31.0, 6.0],
];

// Painted runway numbers (5×7, two-pixel strokes), upright for a pilot landing on that end.
const RWYFONT: Record<string, string[]> = {
  '1': ['00110', '01110', '00110', '00110', '00110', '00110', '01111'],
  '3': ['11110', '00011', '00011', '01110', '00011', '00011', '11110'],
  '6': ['01110', '11000', '11000', '11110', '11011', '11011', '01110'],
  '8': ['01110', '11011', '11011', '01110', '11011', '11011', '01110'],
};

export interface Options {
  season: Season;
  /** Land and take off into the wind: true when it blows from the north. */
  northbound?: boolean;
}

export function buildWorld({ season, northbound = true }: Options): World {
  const pal = palette(season);
  const ground = new Ground(-4, 40, { x0: -0.6, x1: G + 0.6, paint: grassP, outside: farP });
  const W: World = {
    season,
    palette: pal,
    atlas: new Atlas(pal),
    ground,
    doors: [],
    colliders: [],
    round: [],
    poles: [],
    trees: [],
    lights: [],
    chimneys: [],
    stacks: [],
    fixtures: [],
    turbines: [],
  };
  building(W);
  const g = (x0: number, y0: number, x1: number, y1: number, p: GroundPaint) =>
    ground.rect(x0, y0, x1, y1, p);
  const paint = (name: MatName, lv: number) => mark(name, lv);

  // Places trees must stay out of.
  const notree: Array<[number, number, number, number]> = [];
  const keep = (x0: number, y0: number, x1: number, y1: number) => notree.push([x0, y0, x1, y1]);
  const free = (x: number, y: number, m = 0.3) =>
    !notree.some((r) => x > r[0] - m && x < r[2] + m && y > r[1] - m && y < r[3] + m);

  // ---- roads: sidewalks first, then asphalt, then parking lots ----
  const walks: Array<() => void> = [];
  const roads: Array<() => void> = [];
  const decals: Array<() => void> = [];
  const roadX = (yc: number, w: number, x0: number, x1: number) => {
    const h = w / 2;
    keep(x0, yc - h - 0.4, x1, yc + h + 0.4);
    walks.push(() => {
      g(x0, yc - h - 0.4, x1, yc - h, walkP('x'));
      g(x0, yc + h, x1, yc + h + 0.4, walkP('x'));
    });
    roads.push(() => {
      g(x0, yc - h, x1, yc + h, asphP);
      for (let x = x0 + 0.2; x < x1; x += 0.7)
        g(x, yc - 0.02, x + 0.38, yc + 0.02, paint('paintY', 1));
    });
  };
  const roadY = (xc: number, w: number, y0: number, y1: number) => {
    const h = w / 2;
    keep(xc - h - 0.4, y0, xc + h + 0.4, y1);
    walks.push(() => {
      g(xc - h - 0.4, y0, xc - h, y1, walkP('y'));
      g(xc + h, y0, xc + h + 0.4, y1, walkP('y'));
    });
    roads.push(() => {
      g(xc - h, y0, xc + h, y1, asphP);
      for (let y = y0 + 0.2; y < y1; y += 0.7)
        g(xc - 0.02, y, xc + 0.02, y + 0.38, paint('paintY', 1));
    });
  };
  const parkingLot = (x0: number, y0: number, x1: number, y1: number) => {
    keep(x0, y0, x1, y1);
    decals.push(() => {
      g(x0, y0, x1, y1, asphP);
      for (let x = x0 + 0.1; x <= x1 - 0.05; x += 0.3)
        g(x, y0 + 0.05, x + 0.025, y0 + 0.4, paint('paintW', 0));
    });
  };
  roadX(15.7, 0.8, 0, G);
  roadX(19.85, 0.9, 0, G);
  roadX(23.55, 0.7, 12.6, 26.6);
  roadX(29.0, 0.7, 12.6, 26.6);
  roadY(1.4, 0.8, 0, G);
  roadY(26.5, 0.8, 0, 15.3);
  roadY(13.1, 0.7, 20.7, G);
  roadY(30.4, 1.1, 8, G);
  roadY(26.3, 0.7, 20.7, G);
  keep(0, 0.4, 32, 1.9); // rail corridor
  keep(26.9, 2, 28.4, 14); // a verge
  parkingLot(2.6, 2.7, 7.6, 5.3);
  parkingLot(16.3, 18.9, 20.6, 19.4);
  parkingLot(21.0, 18.65, 26.4, 19.4);
  for (const f of [...walks, ...roads, ...decals]) f();
  keep(2.6, 5.4, 22.0, 14.6); // airfield
  keep(2.0, 0, 27, 5.3);
  // a rail trail through the park, like the Macomb Orchard Trail
  g(10.15, 20.3, 10.65, 31.5, walkP('y'));
  keep(10.0, 20.3, 10.8, 31.6);

  // ---- apron, taxiway and runway 18/36 ----
  g(3.0, 7.4, 22.0, 11.4, concP);
  for (let x = 3.6; x < 22; x += 1.0) g(x, 7.4, x + 0.025, 11.4, paint('conc', 0));
  for (let y = 8.2; y < 11.4; y += 0.8) g(3.0, y, 22.0, y + 0.025, paint('conc', 0));
  g(2.4, 11.4, 22.8, 12.1, asphP);
  g(2.6, 11.72, 22.6, 11.76, paint('paintY', 1));
  for (const cx of [5.2, 13.6]) g(cx, 12.1, cx + 0.8, 13.0, asphP);
  g(2.2, 13.0, 25.2, 14.4, asphP);
  g(2.2, 13.04, 25.2, 13.08, paint('paintW', 1));
  g(2.2, 14.3, 25.2, 14.34, paint('paintW', 1));
  for (let x = 4.6; x < 22.7; x += 1.0) g(x, 13.68, x + 0.5, 13.72, paint('paintW', 1));
  const runwayNumber = (s: string, cx: number, cy: number, north: boolean) => {
    const px = 0.1;
    const w = (s.length * 6 - 1) * px;
    const h = 7 * px;
    for (let i = 0; i < s.length; i++) {
      const glyph = RWYFONT[s[i]!]!;
      for (let r = 0; r < 7; r++)
        for (let k = 0; k < 5; k++) {
          if (glyph[r]![k] !== '1') continue;
          const u = i * 6 + k + 0.5;
          const v = r + 0.5;
          const gx = north ? cx - h / 2 + v * px : cx + h / 2 - v * px;
          const gy = north ? cy + w / 2 - u * px : cy - w / 2 + u * px;
          g(gx - px / 2, gy - px / 2, gx + px / 2, gy + px / 2, paint('paintW', 1));
        }
    }
  };
  runwayNumber('36', 23.55, 13.7, true);
  runwayNumber('18', 3.85, 13.7, false);
  for (let k = 0; k < 6; k++) {
    const y = 13.15 + k * 0.17;
    g(2.4, y, 3.1, y + 0.08, paint('paintW', 1));
    g(24.3, y, 25.0, y + 0.08, paint('paintW', 1));
  }
  g(22.6, 2.0, 23.5, 13.0, asphP);
  for (let y = 2.5; y < 12.6; y += 0.8) g(23.02, y, 23.06, y + 0.4, paint('paintW', 1));
  g(22.8, 12.1, 23.3, 13.0, asphP);
  // edge, threshold, taxiway and approach lights, as small fixtures on the ground
  const EDGE: RGB = [1, 0.96, 0.82];
  const TAXI: RGB = [0.3, 0.5, 1];
  const THRESHOLD: RGB = [0.35, 1, 0.5];
  const dot = (x: number, y: number, t: number, c?: RGB) => {
    g(x - 0.03, y - 0.03, x + 0.03, y + 0.03, () => t);
    if (c) W.fixtures.push({ x, y, c });
  };
  for (let x = 2.2; x <= 25.2; x += 0.75) {
    dot(x, 13.0, M.rwyL, EDGE);
    dot(x, 14.4, M.rwyL, EDGE);
    if ((x * 4) % 3 === 0) light(x, 13.0, 1, 18, [255, 240, 200], 0.55);
  }
  for (let y = 13.05; y < 14.4; y += 0.2)
    for (const tx of [2.2, 25.2]) dot(tx, y, M.thrG, THRESHOLD);
  for (let x = 2.8; x < 22.4; x += 1) {
    dot(x, 11.4, M.twyL, TAXI);
    dot(x, 12.1, M.twyL, TAXI);
  }
  for (let k = 0; k < 5; k++) dot(northbound ? 25.9 + k * 0.6 : 1.5 - k * 0.6, 13.7, M.rwyL);
  // the railway along the north edge
  g(-0.5, 0.75, 32.5, 1.65, gravelP);
  for (let x = 0; x < 32.4; x += 0.24) g(x, 0.85, x + 0.07, 1.55, paint('trunk', 0));
  g(0, 1.0, 32, 1.04, paint('steel', 3));
  g(0, 1.34, 32, 1.38, paint('steel', 3));
  // a fence along Airport Rd
  for (let x = 2.4; x < 25; x += 0.6) pole(x, 14.62, 0, 9, M.steel + 1, 1);

  // ---- the airfield and the project buildings ----
  terminal(PLACE.terminal, 2.6, 5.6, 7.6, 7.4);
  tower(PLACE.tower, 8.0, 6.1);
  hangar(PLACE.hangarA, 9.8, 5.0, 12.2, 7.2, 44, true);
  hangar(PLACE.hangarB, 12.8, 5.0, 15.2, 7.2, 44, false);
  fireStation(PLACE.fireStation, 16.0, 5.8, 18.0, 7.4);
  const barracks = { kind: 'siding', wall: 'sidY', roof: 'shN', door: 'doorB' } as const;
  for (const [y, seed] of [
    [2.4, 41],
    [3.9, 42],
  ] as const)
    house({
      id: PLACE.barracks,
      x: 19.2,
      y,
      w: 2.6,
      d: 1.0,
      f: 1,
      style: barracks,
      front: 'L',
      garage: false,
      chimney: false,
      seed,
    });
  radarDome(PLACE.radarDome, 21.2, 6.6);

  // ---- Main Street ----
  const row: Array<[number, number, number, MatName, MatName, string]> = [
    [PLACE.cinema, 2.0, 3.7, 'brickB', 'awnB', 'CINEMA'],
    [PLACE.comicShop, 3.7, 5.3, 'brickR', 'awnR', 'COMICS'],
    [PLACE.sportsBar, 5.3, 6.9, 'brickY', 'awnG', 'SPORTS'],
    [0, 6.9, 8.4, 'brickR', 'awnG', 'BAKERY'],
    [0, 8.4, 10.0, 'brickB', 'awnR', 'HARDWARE'],
    [0, 10.0, 11.4, 'brickY', 'awnB', ''],
  ];
  row.forEach(([id, x0, x1, brick, awn, name], i) =>
    shop({
      id,
      x0,
      x1,
      y0: 16.9,
      y1: 19.2,
      floors: i % 3 === 1 ? 3 : 2,
      brick,
      awn,
      name,
      seed: i * 5 + 2,
      ntok: [M.neonY, M.neonR, M.neonB][i % 3]! + 1,
    }),
  );
  church(12.2, 16.9);
  diner(PLACE.coney, 16.6, 17.5, 18.8, 18.7);
  kiosk(PLACE.kiosk, 19.3, 17.9, 20.2, 18.65);
  (['PIZZA', 'NAILS', 'VAPE', 'LOANS'] as const).forEach((name, i) =>
    shop({
      x0: 21.2 + i * 1.3,
      x1: 22.5 + i * 1.3,
      y0: 17.0,
      y1: 18.5,
      floors: 1,
      brick: (['brickY', 'brickR', 'brickB', 'brickY'] as const)[i],
      awn: (['awnR', 'awnB', 'awnG', 'awnR'] as const)[i],
      name,
      seed: 30 + i,
      ntok: M.neonB + 1,
    }),
  );

  // ---- the park, the trail and the ball field ----
  ballField(PLACE.ballField, 2.2, 21.6);
  keep(1.8, 21.2, 5.0, 24.4);
  emptyLot(PLACE.emptyLot, 7.0, 21.4);
  keep(6.8, 21.2, 8.7, 22.8);
  for (const [bx, by] of [
    [10.9, 22.0],
    [10.9, 26.0],
  ] as const)
    bench(bx, by);
  for (let y = 21; y < 31; y += 2.6) lampPost(10.4, y);

  // ---- the orchard and its farm stand ----
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 8; c++) {
      const x = 2.3 + c * 0.95 + (r & 1) * 0.35;
      const y = 26.4 + r * 0.9;
      keep(x - 0.3, y - 0.3, x + 0.3, y + 0.3);
      obj(PLACE.orchard, () => tree(x, y, { r: 11, th: 11, mats: ['leafA', 'leafC'] }));
    }
  farmStand(PLACE.orchard, 5.0, 24.7);
  keep(4.8, 24.5, 6.4, 25.8);

  // ---- industry by the tracks ----
  elevator(PLACE.grainElevator, 13.0, 1.9);
  keep(12.8, 1.8, 17.2, 3.0);
  factory(26.95, 16.75, 2.25, 2.1);
  keep(26.7, 16.5, 29.45, 19.0);
  waterTower(PLACE.waterTower, 24.7, 3.4);
  keep(24.2, 2.9, 25.3, 4.0);
  for (const [tx, ty] of TURBINE_POS) {
    turbine(PLACE.windFarm, tx, ty);
    keep(tx - 0.3, ty - 0.3, tx + 0.3, ty + 0.3);
  }

  // ---- the subdivision ----
  const xs = [13.9, 16.3, 18.7, 21.1, 23.5];
  const rows = [
    { y: 21.3, front: 'L', st: 23.55 },
    { y: 24.4, front: 'R', st: 23.55 },
    { y: 27.0, front: 'L', st: 29.0 },
    { y: 29.9, front: 'R', st: 29.0 },
  ] as const;
  const driveways: Array<() => void> = [];
  rows.forEach((rw, ri) =>
    xs.forEach((x, i) => {
      const seed = ri * 11 + i * 3 + 5;
      const w = 2.1;
      const d = 1.35;
      const y = rw.y;
      keep(x, y, x + w, y + d + 0.4);
      house({
        x,
        y,
        w,
        d,
        f: hash(seed, 1) < 0.4 ? 2 : 1,
        seed,
        front: rw.front,
        garage: hash(seed, 2) < 0.8,
      });
      if (rw.front === 'L') {
        driveways.push(() => {
          g(x + w - 0.95, y + d, x + w - 0.1, rw.st - 0.4, concP);
          g(x + 0.15, y + d, x + 0.45, rw.st - 0.4, walkP('y'));
        });
        mailbox(x + 0.9, rw.st - 0.52);
      }
      if (hash(seed, 6) < 0.6) tree(x + 0.5, y + d + 0.55, { r: 15, th: 16 });
      if (hash(seed, 8) < 0.7) shrub(x + 0.15, y + d + 0.1, 7);
    }),
  );
  for (let x = 3; x < 31; x += 3.6) lampPost(x, 19.25);
  for (let x = 2.5; x < 30; x += 4.5) lampPost(x, 16.3);
  for (let x = 14.5; x < 26; x += 3.4) {
    lampPost(x, 23.05);
    lampPost(x, 28.55);
  }
  // a power line along Airport Rd
  for (let x = 1.2; x < 31; x += 3.4) utilityPole(x, 16.45);

  // ---- trees around the edges and between blocks, kept off roads and lots ----
  const grove = (
    x0: number,
    y0: number,
    x1: number,
    y1: number,
    n: number,
    seed: number,
    pines = 0.35,
  ) => {
    for (let i = 0; i < n; i++) {
      const x = x0 + hash(i, seed) * (x1 - x0);
      const y = y0 + hash(i, seed + 9) * (y1 - y0);
      if (!free(x, y)) continue;
      if (hash(i, seed + 3) < pines) pineTree(x, y, 46 + Math.round(hash(i, seed + 5) * 22));
      else
        tree(x, y, {
          r: 16 + Math.round(hash(i, seed + 7) * 8),
          th: 19 + Math.round(hash(i, seed + 8) * 9),
        });
    }
  };
  grove(0, 1.9, 32, 5, 40, 1, 0.5);
  grove(0, 15.7, 32, 16.5, 12, 2, 0.2);
  grove(0, 20.5, 11, 32, 60, 3, 0.3);
  grove(26.8, 5, 30, 14.6, 16, 5, 0.6);
  grove(0, 0, 4, 32, 40, 6, 0.5);
  grove(26.5, 20, 32, 32, 40, 7, 0.45);
  grove(11, 29.5, 26, 32, 18, 8, 0.3);
  grove(0, 30, 32, 32, 20, 9, 0.5);
  for (const f of driveways) f();

  assignDoorIds(W);
  return W;
}

/** Doors belong to the footprint they sit in front of, so a click on a wall or roof finds its door. */
function assignDoorIds(W: World): void {
  for (const d of W.doors) {
    let best = null;
    let bd = 0.7;
    for (const c of W.colliders) {
      const dx = Math.max(c.x0 - d.x, 0, d.x - c.x1);
      const dy = Math.max(c.y0 - d.y, 0, d.y - c.y1);
      const dd = Math.hypot(dx, dy);
      if (dd < bd) {
        bd = dd;
        best = c;
      }
    }
    if (best && !best.id) best.id = d.id;
  }
}
