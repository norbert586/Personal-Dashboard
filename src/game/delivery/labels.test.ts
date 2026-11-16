import assert from 'node:assert/strict';
import { test } from 'node:test';
import { glyphOf } from '../world/painters.ts';
import { Labels, layOut } from './labels.ts';

test('sign lettering is capitals the pixel font can draw, wrapped to the sign', () => {
  assert.deepEqual(layOut("Ratiu's Pizza", 11, 3), ["RATIU'S", 'PIZZA']);
  assert.deepEqual(layOut('Corewell Health Beaumont Troy Hospital', 11, 3), [
    'COREWELL',
    'HEALTH',
    'BEAUMONT',
  ]);
  assert.deepEqual(layOut('Ace Hardware', 16, 2), ['ACE HARDWARE']);
});

test('accents are dropped, unknown characters skipped, and long words cut', () => {
  assert.deepEqual(layOut('Raíces Mexican Cantina', 16, 2), ['RAICES MEXICAN', 'CANTINA']);
  assert.deepEqual(layOut('Café “Zoë” ★', 16, 2), ['CAFE ZOE']);
  assert.deepEqual(layOut('Supercalifragilistic', 8, 3), ['SUPERCAL', 'IFRAGILI', 'STIC']);
  assert.deepEqual(layOut('', 8, 3), []);
});

test('each digit cell is its glyph with one texel of plate all round', () => {
  const labels = new Labels();
  labels.add("Ratiu's Pizza");
  const texture = labels.build();
  const { width, height } = texture.image;
  const data = texture.image.data as Uint8Array;
  for (let d = 0; d <= 9; d++) {
    const cell = labels.digit(d);
    assert.deepEqual([cell.w, cell.h], [5, 7]);
    const left = Math.round(cell.u0 * width);
    const bottom = Math.round(cell.v0 * height);
    assert.equal(Math.round(cell.u1 * width) - left, 5);
    assert.equal(Math.round(cell.v1 * height) - bottom, 7);
    const glyph = glyphOf(String(d))!;
    for (let y = 0; y < 7; y++)
      for (let x = 0; x < 5; x++) {
        const inGlyph = x >= 1 && x <= 3 && y >= 1 && y <= 5;
        // Texture rows run upward, glyph rows downward.
        const lit = inGlyph && glyph[(5 - y) * 3 + (x - 1)] === '1';
        const alpha = data[((bottom + y) * width + left + x) * 4 + 3];
        assert.equal(alpha, lit ? 128 : 255, `digit ${d} at ${x},${y}`);
      }
  }
});
