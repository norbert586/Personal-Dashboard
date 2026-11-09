import { test } from 'node:test';
import assert from 'node:assert/strict';
import { carAt, createLife, stepLife } from './life.ts';
import { buildWorld } from './world/layout.ts';

const world = buildWorld({ season: 'fall' });
const fixed = () => 0.5;

test('townspeople pace their routes and turn around at the ends', () => {
  const life = createLife(world, true, fixed);
  const walker = life.people[0]!;
  const start = walker.x;
  for (let i = 0; i < 60 * 10; i++) stepLife(life, 1 / 60);
  assert.ok(walker.x > start + 3, 'walked along Main Street');
  for (let i = 0; i < 60 * 120; i++) stepLife(life, 1 / 60);
  // still on the route, between its ends
  const [a, b] = walker.path;
  assert.ok(walker.x >= Math.min(a![0], b![0]) - 1e-9 && walker.x <= Math.max(a![0], b![0]) + 1e-9);
});

test('cars loop their routes, a new car (and colour) each lap', () => {
  const life = createLife(world, true, fixed);
  const car = life.cars[0]!;
  for (let i = 0; i < 60 * 30; i++) stepLife(life, 1 / 60);
  assert.ok(car.n >= 1);
  const at = carAt(car);
  assert.ok(at.x >= 0 && at.x <= 32 && at.fx === 1 && at.fy === 0);
});

test('the plane lands into the wind, taxis in, parks, and takes off again', () => {
  const life = createLife(world, true, fixed);
  const p = life.plane;
  let landed = false;
  let departed = false;
  for (let i = 0; i < 60 * 240; i++) {
    stepLife(life, 1 / 60);
    if (p.path === life.arrive && p.z === 0) landed = true;
    if (landed && p.path === life.depart && p.z > 100) departed = true;
  }
  assert.ok(landed && departed);
});

test('chimneys smoke in the cold months, and smoke fades away', () => {
  const life = createLife(world, true, () => 0);
  for (let i = 0; i < 60 * 20; i++) stepLife(life, 1 / 60);
  assert.ok(life.smoke.length > 0);
  assert.ok(life.smoke.every((s) => s.life <= 6));
  const summer = createLife(buildWorld({ season: 'summer' }), true, () => 0);
  stepLife(summer, 1 / 60);
  assert.ok(
    summer.smoke.every((s) => s.big),
    'only the factory smokes in summer',
  );
});
