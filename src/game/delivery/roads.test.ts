import assert from 'node:assert/strict';
import { test } from 'node:test';
import { roadWidth, shifted } from './roads.ts';

const near = (actual: number, expected: number, tolerance = 1e-6) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not ${expected}`);

test('a line shifted left keeps its distance along its whole length, ends included', () => {
  // East, then north: left of east is north, left of north is west.
  const line = shifted(
    [
      [0, 0],
      [10, 0],
      [10, 10],
    ],
    2,
  );
  assert.deepEqual(line[0], [0, 2]);
  near(line[1]![0], 8);
  near(line[1]![1], 2);
  assert.deepEqual(line[2], [8, 10]);
  // A two-point line, however long: both ends move the same.
  assert.deepEqual(
    shifted(
      [
        [0, 0],
        [0, 30],
      ],
      -1.5,
    ),
    [
      [1.5, 0],
      [1.5, 30],
    ],
  );
});

test('roads are as wide as their lanes, and side streets have room to park', () => {
  assert.equal(roadWidth({ kind: 'secondary', lanes: 5, oneway: false }), 18);
  assert.equal(roadWidth({ kind: 'residential', lanes: 2, oneway: false }), 8.2);
  assert.ok(roadWidth({ kind: 'driveway', lanes: 1, oneway: false }) < 4);
  assert.ok(roadWidth({ kind: 'motorway', lanes: 3, oneway: true }) > 15);
});
