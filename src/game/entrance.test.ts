import { test } from 'node:test';
import assert from 'node:assert/strict';
import { doorway, nearestDoor, walksIn } from './entrance.ts';
import { START, buildWorld } from './world/layout.ts';
import { PLACE, PLACES } from './world/places.ts';

const world = buildWorld({ season: 'fall' });
const doorOf = (id: number) => world.doors.find((d) => d.id === id)!;

test('every place you can go into is described', () => {
  for (const id of Object.values(PLACE))
    assert.ok(
      PLACES.some((p) => p.id === id),
      `place ${id}`,
    );
});

test("the terminal's front door is in its front wall, and you step inside it", () => {
  const way = doorway(world, doorOf(PLACE.terminal));
  assert.deepEqual(way.normal, [0, 1]);
  assert.equal(way.sill[1], 7.4); // the terminal's front wall
  assert.ok(way.inside[1] < way.sill[1] && way.step[1] > way.sill[1]);
});

test('places without a wall have no doorway to walk through', () => {
  assert.equal(doorway(world, doorOf(PLACE.waterTower)).normal, null);
});

test('the newspaper box is read from where you stand, right where you start', () => {
  const box = doorOf(PLACE.newsBox);
  const way = doorway(world, box);
  assert.equal(way.normal, null);
  assert.deepEqual(way.inside, way.step);
  assert.equal(walksIn(world, box, box.x, box.y, 0, -1), false);
  assert.equal(nearestDoor(world, START.x, START.y)?.id, PLACE.newsBox);
});

test('walking into a door goes in; walking past it does not', () => {
  const cinema = doorOf(PLACE.cinema);
  const way = doorway(world, cinema);
  const [x, y] = [way.sill[0], way.sill[1] + 0.3];
  assert.equal(nearestDoor(world, x, y)?.id, PLACE.cinema);
  assert.equal(walksIn(world, cinema, x, y, 0, -1), true, 'heading into the shopfront');
  assert.equal(walksIn(world, cinema, x, y, 1, 0), false, 'walking along the sidewalk');
});
