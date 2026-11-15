import { test } from 'node:test';
import assert from 'node:assert/strict';
import { driveScale, pixelScale, zoomStep } from './pixels.ts';

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

test('the delivery view is about 360 lines on the short side, whatever the screen', () => {
  assert.deepEqual(pick(driveScale(1920, 1080, 1)), [3, 640, 360]);
  assert.deepEqual(pick(driveScale(1366, 768, 1)), [2, 683, 384]);
  // A phone held upright: the short side is its width.
  const phone = driveScale(390, 844, 3);
  assert.deepEqual(pick(phone), [3, 390, 844]);
  assert.equal(phone.css, 1);
  assert.equal(driveScale(200, 120, 1).device, 1);
});

function pick(s: { device: number; width: number; height: number }): number[] {
  return [s.device, s.width, s.height];
}
