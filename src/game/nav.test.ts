import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildNav, findPath, pathLength } from './nav.ts';
import { blocked } from './you.ts';
import { START, buildWorld } from './world/layout.ts';
import { PLACE } from './world/places.ts';

const world = buildWorld({ season: 'fall' });
const nav = buildNav(world);

test('every building can be walked to from where you start', () => {
  for (const [name, id] of Object.entries(PLACE)) {
    const reachable = world.doors
      .filter((d) => d.id === id)
      .some((d) => findPath(nav, START.x, START.y, d.x, d.y) !== null);
    assert.ok(reachable, `${name} is reachable`);
  }
});

test('a path goes around buildings, never through them', () => {
  // From Main Street to the terminal's front door, past the shops and across the airfield.
  const door = world.doors.find((d) => d.id === PLACE.terminal)!;
  const path = findPath(nav, START.x, START.y, door.x, door.y)!;
  assert.ok(path.length >= 2, 'it turns at least once');
  let x: number = START.x;
  let y: number = START.y;
  for (const [px, py] of path) {
    for (let k = 1; k <= 40; k++) {
      const sx = x + ((px - x) * k) / 40;
      const sy = y + ((py - y) * k) / 40;
      assert.ok(!blocked(world, sx, sy, 0.02), `clear at ${sx.toFixed(2)},${sy.toFixed(2)}`);
    }
    [x, y] = [px, py];
  }
  const last = path[path.length - 1]!;
  assert.deepEqual(last, [door.x, door.y]);
  assert.ok(pathLength(path, START.x, START.y) > Math.hypot(door.x - START.x, door.y - START.y));
});

test('string-pulling makes a straight walk down an open road a single step', () => {
  const path = findPath(nav, 14.6, 19.85, 8, 19.85)!;
  assert.deepEqual(path, [[8, 19.85]]);
});
