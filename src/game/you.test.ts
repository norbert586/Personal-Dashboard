import { test } from 'node:test';
import assert from 'node:assert/strict';
import { blocked, keyDirection, newYou, step } from './you.ts';
import { START, buildWorld } from './world/layout.ts';

const world = buildWorld({ season: 'fall' });
const near = (a: number, b: number) => Math.abs(a - b) < 1e-9;

test('one key walks along a street, at any camera angle', () => {
  for (const yaw of [Math.PI / 4, Math.PI / 4 + 0.3, (3 * Math.PI) / 4, -1.2]) {
    for (const [ix, iy] of [
      [0, 1],
      [1, 0],
      [0, -1],
      [-1, 0],
    ] as const) {
      const [dx, dy] = keyDirection(ix, iy, yaw);
      assert.ok(near(dx, 0) || near(dy, 0), `yaw ${yaw}, key ${ix},${iy} → ${dx},${dy}`);
      assert.ok(near(Math.hypot(dx, dy), 1));
    }
  }
  // In the default view, up walks north (-x) along Main Street's sidewalk.
  const [dx, dy] = keyDirection(0, 1, Math.PI / 4);
  assert.ok(near(dx, -1) && near(dy, 0));
});

test('walking into a building slides along it instead of stopping', () => {
  const you = newYou(START.x, START.y);
  // Main Street's shops are to the north-west of the start (y < 19.2); walk diagonally into them.
  for (let i = 0; i < 120; i++) step(you, world, -1, -1, false, 1 / 60);
  assert.ok(you.x < START.x - 0.5, 'kept moving along the shopfronts');
  assert.ok(!blocked(world, you.x, you.y, 0.05), 'never inside a wall');
});

test('you can always walk out of something you started inside', () => {
  const terminal = world.colliders.find((c) => c.id === 1)!;
  const you = newYou((terminal.x0 + terminal.x1) / 2, terminal.y1 - 0.02);
  for (let i = 0; i < 60; i++) step(you, world, 0, 1, false, 1 / 60);
  assert.ok(you.y > terminal.y1, 'out the front');
});

test('running is faster than walking, and the bike is faster still', () => {
  const run = (mode: 'walk' | 'bike', fast: boolean) => {
    const you = newYou(5, 19.85);
    you.mode = mode;
    for (let i = 0; i < 180; i++) step(you, world, 1, 0, fast, 1 / 60);
    return you.x - 5;
  };
  const walk = run('walk', false);
  const jog = run('walk', true);
  const bike = run('bike', false);
  assert.ok(jog > walk * 1.7 && bike > jog, `${walk} < ${jog} < ${bike}`);
});
