import { test } from 'node:test';
import assert from 'node:assert/strict';
import { pixelScale, zoomStep } from './pixels.ts';

test('scales a desktop window by whole device pixels to a view about a third as wide', () => {
  const s = pixelScale(1440, 900, 1);
  assert.equal(s.device, 3);
  assert.equal(s.css, 3);
  assert.deepEqual([s.width, s.height], [480, 300]);
});

test('counts device pixels on a high-density phone, not CSS pixels', () => {
  const s = pixelScale(390, 844, 3);
  assert.equal(Number.isInteger(s.device), true);
  assert.equal(s.device, 4); // 1170 device px / 300 target
  assert.equal(s.css, 4 / 3);
  // The framebuffer covers the whole viewport once scaled back up.
  assert.ok(s.width * s.css >= 390 && s.height * s.css >= 844);
});

test('never drops below one device pixel per texel', () => {
  assert.equal(pixelScale(200, 200, 1).device, 1);
});

test('a chosen zoom wins, and zoom steps stay in range', () => {
  assert.equal(pixelScale(1440, 900, 1, 5).device, 5);
  assert.equal(zoomStep(1, -1, 1), 1);
  assert.equal(zoomStep(7, 1, 1), 7);
  assert.equal(zoomStep(3, 1, 2), 4);
});
