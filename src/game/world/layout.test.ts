import { test } from 'node:test';
import assert from 'node:assert/strict';
import { buildWorld, START } from './layout.ts';
import { M, palette, seasonOf } from './materials.ts';
import { PLACE } from './places.ts';
import { facade, withText } from './painters.ts';

const world = buildWorld({ season: 'fall' });

test('every place you can go into has a door, and its footprint knows it', () => {
  for (const [name, id] of Object.entries(PLACE)) {
    assert.ok(
      world.doors.some((d) => d.id === id),
      `${name} has a door`,
    );
  }
  const terminal = world.colliders.find((c) => c.id === PLACE.terminal);
  assert.ok(terminal, 'the terminal footprint carries its id');
  assert.deepEqual([terminal.x0, terminal.y0, terminal.x1, terminal.y1], [2.6, 5.6, 7.6, 7.4]);
});

test('you start on open ground, not inside a building', () => {
  const inside = world.colliders.some(
    (c) => START.x > c.x0 && START.x < c.x1 && START.y > c.y0 && START.y < c.y1,
  );
  assert.equal(inside, false);
});

test('the ground is roads, runway and grass where the layout says', () => {
  const asph = (t: number) => t >= M.asph && t < M.asph + 8;
  const paintW = (t: number) => t >= M.paintW && t < M.paintW + 8;
  assert.ok(asph(world.ground.at(20.0, 19.85 + 0.3)), 'Main Street is asphalt');
  assert.ok(paintW(world.ground.at(10.0, 13.06)), 'the runway has its edge line');
  const grass = world.ground.at(20, 26.2);
  assert.ok(grass >= M.grass && grass < M.grass + 8, 'a front lawn is grass');
});

test('the same season always builds the same town', () => {
  const again = buildWorld({ season: 'fall' });
  assert.equal(again.atlas.pages.length, world.atlas.pages.length);
  assert.deepEqual(again.ground.tokens.slice(0, 5000), world.ground.tokens.slice(0, 5000));
  assert.equal(again.trees.length, world.trees.length);
});

test('seasons follow the calendar', () => {
  assert.equal(seasonOf(11, 9), 'fall');
  assert.equal(seasonOf(11, 20), 'latefall');
  assert.equal(seasonOf(1, 5), 'winter');
  assert.equal(seasonOf(4, 1), 'spring');
  assert.notDeepEqual(palette('winter').ramps.grass, palette('summer').ramps.grass);
});

test('signs letter over the wall and leave the rest of it alone', () => {
  const wall = facade({ kind: 'plain', mat: 'cmu' });
  const sign = withText(wall, [{ s: 'I', u: 0, v: 0, tok: M.neonY + 1 }]);
  assert.equal(sign(1, 4), M.neonY + 1); // the top bar of the I
  assert.equal(sign(10, 10), wall(10, 10));
});
