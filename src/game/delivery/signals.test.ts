import assert from 'node:assert/strict';
import { test } from 'node:test';
import { TURN, lightAt, type Light } from './signals.ts';

const LOOP = (TURN.green + TURN.yellow + TURN.clear) * 2;

test('the two streets at a signal are never let go together', () => {
  for (const signal of [0, 1, 7, 1104])
    for (let t = 0; t < LOOP * 2; t += 0.25) {
      const a = lightAt(0, signal, t);
      const b = lightAt(1, signal, t);
      assert.ok(a === 'red' || b === 'red', `signal ${signal} at ${t}s shows ${a} and ${b}`);
    }
});

test('each street gets green, then yellow, then red, for the times in TURN', () => {
  for (const axis of [0, 1] as const) {
    const seen: Light[] = [];
    const seconds: Record<Light, number> = { green: 0, yellow: 0, red: 0 };
    for (let t = 0; t < LOOP; t += 0.25) {
      const light = lightAt(axis, 3, t);
      seconds[light] += 0.25;
      if (seen.at(-1) !== light) seen.push(light);
    }
    // Wherever in the loop it starts, the order round it is green, yellow, red.
    const order = seen.join(' ');
    assert.ok(`${order} ${order}`.includes('green yellow red'), order);
    assert.ok(!`${order} ${order}`.includes('green red'), order);
    assert.equal(seconds.green, TURN.green);
    assert.equal(seconds.yellow, TURN.yellow);
  }
});

test('signals are out of step with each other, and the timer loops', () => {
  const at = (signal: number) =>
    Array.from({ length: LOOP }, (_, t) => lightAt(0, signal, t)).join(',');
  assert.notEqual(at(0), at(1));
  assert.equal(lightAt(1, 4, 12.5), lightAt(1, 4, 12.5 + LOOP * 3));
  assert.equal(lightAt(0, 2, -5), lightAt(0, 2, LOOP - 5));
});
