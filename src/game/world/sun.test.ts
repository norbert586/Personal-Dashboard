import { test } from 'node:test';
import assert from 'node:assert/strict';
import { lighting, simDate, sunPos, todayAt } from './sun.ts';

// Reference values for Washington Twp (42.72 N, 83.03 W) from NOAA's solar calculator.
test('the sun is due south and low at solar noon in November', () => {
  const s = sunPos(new Date('2026-11-09T17:09:00Z'));
  assert.ok(Math.abs(s.az - 180) < 2, `azimuth ${s.az}`);
  assert.ok(Math.abs(s.el - 30.6) < 1, `elevation ${s.el}`);
});

test('the sun is high at midsummer noon and below the horizon at midnight', () => {
  assert.ok(sunPos(new Date('2026-06-21T17:28:00Z')).el > 69);
  assert.ok(sunPos(new Date('2026-11-10T05:00:00Z')).el < -40);
});

test('day and night follow the sun, and cloud dims it', () => {
  const noon = new Date('2026-11-09T17:09:00Z');
  const midnight = new Date('2026-11-10T05:00:00Z');
  assert.equal(lighting(noon).day, 1);
  assert.equal(lighting(midnight).night, 1);
  assert.equal(lighting(midnight).I, 0);
  assert.ok(lighting(noon, 'cloud').I < lighting(noon).I / 2);
  // At noon the sun shines from the south: the light comes from +x (south) and above.
  const d = lighting(noon).d;
  assert.ok(d[0] > 0.8 && d[2] > 0.4);
});

test('today at an hour is that hour in Michigan', () => {
  const t = todayAt(12.5, new Date('2026-11-09T15:00:00Z')); // 10:00 in Detroit
  assert.equal(t.toISOString(), '2026-11-09T17:30:00.000Z');
});

test('time presets light the town at their hour, and real time is now', () => {
  const now = new Date('2026-11-09T15:00:00Z');
  assert.equal(simDate('auto', now), now);
  assert.equal(simDate('night', now).toISOString(), '2026-11-10T03:30:00.000Z');
  assert.ok(lighting(simDate('night', now)).night > 0.99);
  assert.ok(lighting(simDate('day', now)).day > 0.99);
});
