import assert from 'node:assert/strict';
import { test } from 'node:test';
import { PAVEMENT, driveCar, newCar, speedMph, type CarInput, type CarState } from './car.ts';
import { collide, fence } from './collide.ts';
import { SegGrid } from './grid.ts';

const MPH = 2.236936;
const gas: CarInput = { gas: 1, back: 0, steer: 0, handbrake: false };
const off: CarInput = { ...gas, gas: 0 };

function wall(ax: number, ay: number, bx: number, by: number): SegGrid {
  const walls = new SegGrid(24);
  walls.add(ax, ay, bx, by, 1);
  return walls;
}

/** A parked car, made solid the way `World.block` does it: a box `hl` long and `hw` wide. */
function parked(x: number, y: number, dir: [number, number], hl = 2.3, hw = 0.9): SegGrid {
  const [dx, dy] = dir;
  const c = [
    [x - dx * hl + dy * hw, y - dy * hl - dx * hw],
    [x + dx * hl + dy * hw, y + dy * hl - dx * hw],
    [x + dx * hl - dy * hw, y + dy * hl + dx * hw],
    [x - dx * hl - dy * hw, y - dy * hl + dx * hw],
  ] as const;
  const things = new SegGrid(24);
  for (let i = 0; i < 4; i++)
    things.add(c[i]![0], c[i]![1], c[(i + 1) % 4]![0], c[(i + 1) % 4]![1], -1);
  return things;
}

interface Frame {
  hit: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  yawRate: number;
  heading: number;
}

/**
 * Drive with the foot down until the first hit, then off the gas (or `after` from then on), and
 * record every frame. Walls and parked cars are settled together, as the game does.
 */
function crash(
  car: CarState,
  solids: readonly SegGrid[],
  { seconds = 9, fps = 60, after = off }: { seconds?: number; fps?: number; after?: CarInput } = {},
): { frames: Frame[]; first: number } {
  const frames: Frame[] = [];
  let first = -1;
  for (let i = 0; i < seconds * fps; i++) {
    const hit = driveCar(car, first < 0 ? gas : after, PAVEMENT, 1 / fps, (c) =>
      collide(c, solids),
    );
    if (first < 0 && hit > 0) first = i;
    const { x, y, vx, vy, yawRate, heading } = car;
    frames.push({ hit, x, y, vx, vy, yawRate, heading });
  }
  assert.ok(first >= 0, 'it hit something');
  return { frames, first };
}

/** After the first hit: the fastest the car moved back along `away`, and the furthest it went. */
function springBack(frames: Frame[], first: number, away: [number, number]) {
  const at = frames[first]!;
  let mph = 0;
  let metres = 0;
  for (const f of frames.slice(first)) {
    mph = Math.max(mph, (f.vx * away[0] + f.vy * away[1]) * MPH);
    metres = Math.max(metres, (f.x - at.x) * away[0] + (f.y - at.y) * away[1]);
  }
  return { mph, metres };
}

test('a wall straight ahead stops the car dead, nose against it, with no spring back', () => {
  const car = newCar(0, 0, 0);
  const { frames, first } = crash(car, [wall(-20, 40, 20, 40)]);
  const hardest = Math.max(...frames.map((f) => f.hit));
  assert.ok(hardest > 15, `hit at ${hardest.toFixed(1)} m/s`);
  const back = springBack(frames, first, [0, -1]);
  assert.ok(back.mph < 0.3, `sprang back at ${back.mph.toFixed(1)} mph`);
  assert.ok(back.metres < 0.1, `sprang back ${back.metres.toFixed(2)} m`);
  // The front circle (1.1 m ahead of the centre of mass, 0.95 m wide) rests on the wall.
  assert.ok(Math.abs(car.y - (40 - 2.05)) < 0.02, `stopped at ${car.y.toFixed(2)}`);
  assert.ok(speedMph(car) < 0.1);
});

test("running into a parked car's tail stops the car against it, with no spring back", () => {
  const car = newCar(0, 0, 0);
  const { frames, first } = crash(car, [wall(-200, 300, 200, 300), parked(0, 40, [0, 1])]);
  const back = springBack(frames, first, [0, -1]);
  assert.ok(back.mph < 0.3, `sprang back at ${back.mph.toFixed(1)} mph`);
  assert.ok(back.metres < 0.1, `sprang back ${back.metres.toFixed(2)} m`);
  assert.ok(Math.abs(car.y - (40 - 2.3 - 2.05)) < 0.02, `stopped at ${car.y.toFixed(2)}`);
  assert.ok(speedMph(car) < 0.1);
});

test('nose first into a corner, the car comes to rest in it instead of rattling round', () => {
  const walls = new SegGrid(24);
  walls.add(-60, 40, 6, 40, 1);
  walls.add(6, -60, 6, 40, 1);
  const car = newCar(6 - 28, 40 - 28, Math.PI / 4);
  const { frames, first } = crash(car, [walls]);
  const rehits = frames.slice(first + 1).filter((f) => f.hit > 1).length;
  assert.ok(rehits <= 2, `${rehits} more hits after the first`);
  assert.ok(Math.abs(car.heading - Math.PI / 4) < 0.3, `turned to ${car.heading.toFixed(2)}`);
  assert.ok(Math.abs(car.yawRate) < 0.01 && speedMph(car) < 0.1, 'at rest');
  const back = springBack(frames, first, [-Math.SQRT1_2, -Math.SQRT1_2]);
  assert.ok(back.mph < 0.3, `sprang back at ${back.mph.toFixed(1)} mph`);
});

test('holding the gas against a wall pushes, without creeping or shaking', () => {
  const car = newCar(0, 40 - 2.1, 0);
  const { frames } = crash(car, [wall(-20, 40, 20, 40)], { seconds: 4, after: gas });
  const ys = frames.slice(30).map((f) => f.y);
  const spread = Math.max(...ys) - Math.min(...ys);
  assert.ok(spread < 0.02, `moved ${spread.toFixed(3)} m`);
  assert.ok(frames.slice(30).every((f) => Math.abs(f.yawRate) < 0.01 && Math.abs(f.vx) < 0.01));
});

test('clipping a wall at a shallow angle scrapes along it, and only a little hit is reported', () => {
  const car = newCar(0, 0, 0.12);
  const { frames } = crash(car, [wall(3, -50, 3, 400)], { seconds: 5, after: gas });
  assert.ok(car.x < 3 - 0.9, 'never through the wall');
  assert.ok(car.y > 40 && speedMph(car) > 20, 'still moving along it');
  const hardest = Math.max(...frames.map((f) => f.hit));
  assert.ok(hardest > 0 && hardest < 4, `hit at ${hardest.toFixed(1)} m/s`);
});

test("clipping a parked car's corner knocks the car aside without spinning it", () => {
  // At 30 mph, a few metres short of it, so the test is of the knock and not the engine.
  const car = newCar(0, 30, 0);
  car.vy = 30 / MPH;
  const { frames, first } = crash(car, [parked(1.7, 40, [0, 1])], { seconds: 6, after: gas });
  // The round nose meets the corner side-on, so the car is pushed aside and turns to follow:
  // a knock off course, settled within a second, not a spin.
  assert.ok(car.heading < -0.02 && car.heading > -0.3, `turned to ${car.heading.toFixed(2)}`);
  const settled = frames.slice(first + 60).every((f) => Math.abs(f.yawRate) < 0.1);
  assert.ok(settled, 'straight again within a second');
  assert.ok(speedMph(car) > 15, 'and still going');
});

test('a hard hit is reported once, at the speed into the wall', () => {
  const car = newCar(0, 0, 0);
  const { frames, first } = crash(car, [wall(-20, 40, 20, 40)]);
  const hit = frames[first]!.hit;
  assert.ok(hit > 16 && hit < 20, `reported ${hit.toFixed(1)} m/s`);
  assert.equal(frames.filter((f) => f.hit > 1).length, 1);
});

test('a hit comes out the same at 10 frames a second as at 120', () => {
  const rest = (fps: number) => {
    const car = newCar(0, 20, 0);
    car.vy = 27;
    crash(car, [parked(0, 60, [1, 0])], { fps, seconds: 4 });
    return car.y;
  };
  const slow = rest(10);
  const fast = rest(120);
  assert.ok(Math.abs(slow - fast) < 0.05, `${slow.toFixed(2)} against ${fast.toFixed(2)}`);
});

test("the zone's edge turns the car back", () => {
  const car = newCar(0, 99, 0);
  car.vy = 20;
  car.y = 101;
  assert.equal(fence(car, 100), true);
  assert.deepEqual([car.y, car.vy], [100, 0]);
  assert.equal(fence(car, 100), false);
});
