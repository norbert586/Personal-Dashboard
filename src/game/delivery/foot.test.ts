import assert from 'node:assert/strict';
import { test } from 'node:test';
import { RADIUS } from './collide.ts';
import {
  FOOT,
  canGetIn,
  carGap,
  fenceFoot,
  settleFoot,
  stepFoot,
  stepOut,
  type FootInput,
  type FootState,
} from './foot.ts';
import { SegGrid } from './grid.ts';
import { PACE, quote } from './route.ts';

const DT = 1 / 60;
const walk: FootInput = { go: 1, turn: 0, run: false };
const stand = (x = 0, y = 0, heading = 0): FootState => ({ x, y, heading, speed: 0, stride: 0 });

function wall(ax: number, ay: number, bx: number, by: number): SegGrid {
  const walls = new SegGrid(24);
  walls.add(ax, ay, bx, by, 1);
  return walls;
}

/** Walk for some seconds, settling against what's solid after every step. */
function go(
  foot: FootState,
  input: FootInput,
  seconds: number,
  solids: SegGrid[] = [],
  car: { x: number; y: number; heading: number } | null = null,
): void {
  for (let t = 0; t < seconds - 1e-9; t += DT) {
    stepFoot(foot, input, DT);
    settleFoot(foot, solids, car);
  }
}

test("walking is the quote's pace: the walk a customer is quoted is the walk you get", () => {
  const foot = stand();
  go(foot, walk, 10);
  assert.ok(Math.abs(foot.y - PACE.walk * 10) < 0.05, `walked ${foot.y} m north in 10 s`);
  assert.equal(foot.x, 0);
  // A door 21 m from the curb: there and back at a walk is the 30 s the quote adds for it.
  const there = stand();
  let seconds = 0;
  while (there.y < 21) {
    stepFoot(there, walk, DT);
    seconds += DT;
  }
  const added = quote(0, 21) - quote(0, 0);
  assert.ok(Math.abs(seconds * 2 - 30) < 0.5, `${seconds * 2} s there and back`);
  assert.ok(added >= 0 && added <= PACE.quoteStep);
});

test('running is faster than walking, and backing up is slower', () => {
  const runner = stand();
  go(runner, { ...walk, run: true }, 4);
  assert.ok(Math.abs(runner.y - FOOT.run * 4) < 0.05);
  assert.ok(FOOT.run > FOOT.walk * 2);
  const back = stand();
  go(back, { go: -1, turn: 0, run: true }, 4);
  assert.ok(Math.abs(back.y + FOOT.back * 4) < 0.05, 'Shift does not run backwards');
});

test('headings are the compass: 90 walks east, and D turns you right', () => {
  const east = stand(0, 0, Math.PI / 2);
  go(east, walk, 2);
  assert.ok(east.x > 2.7 && Math.abs(east.y) < 1e-6);
  const turning = stand();
  go(turning, { go: 0, turn: 1, run: false }, 0.5);
  assert.ok(turning.heading > 1 && turning.x === 0 && turning.y === 0);
});

test('the legs swing only while you move', () => {
  const foot = stand();
  go(foot, { go: 0, turn: 1, run: false }, 1);
  assert.equal(foot.stride, 0);
  go(foot, walk, 1);
  assert.ok(foot.stride > 3);
});

test('a wall stops you, however long you walk into it', () => {
  const walls = wall(-10, 5, 10, 5);
  const foot = stand();
  go(foot, { ...walk, run: true }, 6, [walls]);
  assert.ok(Math.abs(foot.y - (5 - FOOT.radius)) < 0.02, `stopped at ${foot.y}`);
});

test('you slide along a wall you walk into at an angle', () => {
  const walls = wall(-50, 5, 50, 5);
  const foot = stand(0, 0, Math.PI / 4);
  go(foot, walk, 10, [walls]);
  assert.ok(foot.y <= 5 - FOOT.radius + 0.02);
  assert.ok(foot.x > 8, `slid ${foot.x} m east`);
});

test('a corner holds you: two walls never push you through each other', () => {
  const walls = new SegGrid(24);
  walls.add(-10, 5, 5, 5, 1);
  walls.add(5, 5, 5, -10, 1);
  const foot = stand(0, 0, Math.PI / 4);
  go(foot, { ...walk, run: true }, 8, [walls]);
  assert.ok(foot.x <= 5 - FOOT.radius + 0.02 && foot.y <= 5 - FOOT.radius + 0.02);
});

test("you can't walk through your own car", () => {
  const car = { x: 0, y: 10, heading: Math.PI / 2 };
  const foot = stand();
  go(foot, walk, 12, [], car);
  assert.ok(foot.y < 10 - RADIUS, `stopped at ${foot.y}, short of the car`);
  assert.equal(carGap(foot, car) < 0.02, true);
});

test('you get out on the driver’s side, facing the way the car does', () => {
  const car = { x: 0, y: 0, heading: 0 };
  const out = stepOut(car, []);
  assert.ok(out);
  // Heading north, the driver's door is on the west.
  assert.ok(out.x < -RADIUS && out.x > -2);
  assert.equal(out.heading, 0);
  assert.ok(canGetIn(out, car));
  // And it's a spot you can stand on: nothing pushes you off it.
  const before = { ...out };
  assert.equal(settleFoot(out, [], car), false);
  assert.deepEqual(out, before);
});

test('with a wall along the driver’s side you get out on the other; boxed in, not at all', () => {
  const car = { x: 0, y: 0, heading: 0 };
  // As close as the car can get to it.
  const west = wall(-RADIUS - 0.02, -10, -RADIUS - 0.02, 10);
  const out = stepOut(car, [west]);
  assert.ok(out && out.x > RADIUS, 'out on the passenger side');
  // A wall half a metre off still leaves no room to stand between it and the car.
  assert.ok(stepOut(car, [wall(-1.5, -10, -1.5, 10)])!.x > 0);
  const east = wall(RADIUS + 0.02, -10, RADIUS + 0.02, 10);
  assert.equal(stepOut(car, [west, east]), null);
});

test('getting in needs you beside the car', () => {
  const car = { x: 0, y: 0, heading: 0 };
  assert.equal(canGetIn({ x: -2, y: 0 }, car), true);
  assert.equal(canGetIn({ x: 0, y: -3.6 }, car), true, 'at the tailgate');
  assert.equal(canGetIn({ x: -4, y: 0 }, car), false);
  assert.equal(canGetIn({ x: 0, y: 40 }, car), false);
});

test("the zone's edge turns you back", () => {
  const foot = stand(0, 99.9);
  go(foot, { ...walk, run: true }, 2);
  fenceFoot(foot, 100);
  assert.ok(Math.abs(Math.hypot(foot.x, foot.y) - 100) < 1e-9);
});
