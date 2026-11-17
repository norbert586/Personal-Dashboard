import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Building, BuildingKind } from '../../lib/zone/format.ts';
import { paintedDoor } from './buildings.ts';

/** A box `wide` along its south wall, which runs east from the origin, and 8 m deep. */
const box = (kind: BuildingKind, wide: number): Building => ({
  kind,
  levels: 0,
  name: '',
  made: false,
  pts: [0, 0, wide, 0, wide, 8, 0, 8],
  faces: 0,
  street: 0,
  number: 100,
});
const SOUTH = [0, -1] as const;

test("a house's door is in the middle bay of its front wall, on the wall", () => {
  // 12 m is three bays: the door is the middle one, so it's the wall's middle too.
  const three = paintedDoor(box('house', 12), SOUTH)!;
  assert.deepEqual(three, [6, 0]);
  // 9 m is two bays, and the door is the second: three quarters of the way along, where you see
  // it, not at the wall's middle.
  const two = paintedDoor(box('house', 9), SOUTH)!;
  assert.ok(Math.abs(Math.abs(two[0] - 4.5) - 2.25) < 1e-9 && two[1] === 0, `at ${two}`);
});

test('the door follows the side the building faces', () => {
  const east = paintedDoor(box('house', 12), [1, 0])!;
  assert.equal(east[0], 12);
  assert.ok(east[1] > 0 && east[1] < 8);
});

test("a shop's door is the door bay nearest the middle of its front", () => {
  // 24 m is six bays with doors in the second and fifth.
  const door = paintedDoor(box('retail', 24), SOUTH)!;
  assert.equal(door[1], 0);
  assert.ok([6, 18].includes(door[0]), `at ${door}`);
});

test('a gas station has no wall to knock on', () => {
  assert.equal(paintedDoor(box('fuel', 12), SOUTH), null);
});
