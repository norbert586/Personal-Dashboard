import assert from 'node:assert/strict';
import { test } from 'node:test';
import { SegGrid } from './grid.ts';

test('finds the closest segment, its nearest point and its direction', () => {
  const grid = new SegGrid(32);
  grid.add(0, 0, 100, 0, 1); // a street running east
  grid.add(50, -80, 50, 80, 2); // one crossing it, running north
  const a = grid.nearest(20, 6, 30);
  assert.deepEqual([a?.id, a?.d, a?.x, a?.y, a?.dx, a?.dy], [1, 6, 20, 0, 1, 0]);
  const b = grid.nearest(53, 40, 30);
  assert.deepEqual([b?.id, b?.d, b?.dx, b?.dy], [2, 3, 0, 1]);
  // Past the end of a segment, the end is the nearest point.
  assert.deepEqual([grid.nearest(-4, 3, 30)?.x, grid.nearest(-4, 3, 30)?.d], [0, 5]);
});

test('nothing in reach is null, and segments can be ruled out', () => {
  const grid = new SegGrid(32);
  grid.add(0, 0, 100, 0, 1);
  grid.add(0, 10, 100, 10, 2);
  assert.equal(grid.nearest(50, 200, 30), null);
  assert.equal(grid.nearest(50, 1, 30)?.id, 1);
  assert.equal(grid.nearest(50, 1, 30, (id) => id !== 1)?.id, 2);
});

test('a long segment is visited once, however many cells it crosses', () => {
  const grid = new SegGrid(16);
  grid.add(-200, 5, 200, 5, 7);
  let visits = 0;
  grid.each(0, 0, 60, () => visits++);
  assert.equal(visits, 1);
  assert.equal(grid.size, 1);
});
