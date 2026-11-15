import assert from 'node:assert/strict';
import { test } from 'node:test';
import { layOut } from './labels.ts';

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
