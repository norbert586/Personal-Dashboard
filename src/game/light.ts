/**
 * Light that follows the real sun: a hemisphere light carries the sky's colour and the sun carries
 * the shadows (DESIGN: Light, time and weather).
 */
import { Color, Vector3 } from 'three';
import type { Town } from './scene.ts';
import { mix3, nightK } from './world/materials.ts';
import type { Lighting } from './world/sun.ts';

// three r155 dropped the legacy light scale the prototype was tuned on (r149); this restores it.
const LEGACY = Math.PI;
const toSun = new Vector3();

/** Light the town for a moment, with the sun's shadow box centred on (x, z). */
export function applyLight(town: Town, L: Lighting, x: number, z: number): void {
  const { hemi, sun, scene } = town;
  hemi.intensity = 0.86 * LEGACY;
  hemi.color.setRGB(L.sky[0], L.sky[1], L.sky[2]);
  hemi.groundColor.setRGB(L.sky[0] * 0.45, L.sky[1] * 0.45, L.sky[2] * 0.45);
  // A low sun is boosted a little so November shadows still read.
  sun.intensity = L.sun.el > 0.5 ? L.I * (1 + 0.9 * (1 - Math.max(0, L.d[2]))) * LEGACY : 0;
  sun.color.setRGB(
    Math.min(1.4, L.sunCol[0]),
    Math.min(1.4, L.sunCol[1]),
    Math.min(1.4, L.sunCol[2]),
  );
  toSun.set(L.d[0], Math.max(0.05, L.d[2]), L.d[1]).normalize();
  sun.target.position.set(x, 0, z);
  sun.position.copy(sun.target.position).addScaledVector(toSun, 120);
  const bg = mix3(
    [0.05, 0.07, 0.13],
    [L.sky[0] * 0.9 + 0.06, L.sky[1] * 0.9 + 0.06, L.sky[2] * 0.9 + 0.06],
    1 - nightK(L.night),
  );
  if (scene.background instanceof Color) scene.background.setRGB(bg[0], bg[1], bg[2]);
}
