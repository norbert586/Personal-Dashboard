/**
 * Weather you can see (DESIGN: Light, time and weather): low-poly clouds that drift on the real
 * wind and shade the town on a fair day, and rain or snow falling in front of the camera, a pixel
 * at a time. What to draw comes from weather.ts.
 */
import {
  BufferAttribute,
  BufferGeometry,
  Group,
  IcosahedronGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  Points,
  PointsMaterial,
  type OrthographicCamera,
  type Scene,
} from 'three';
import { PXU } from './pixels.ts';
import type { TownWeather } from './weather.ts';
import { hash } from './world/noise.ts';

/** Clouds live in a square this wide around the camera and wrap at its edges, in tiles. */
const WRAP = 48;
const MAX_CLOUDS = 18;
const MAX_FALLING = 520;

const CLOUD_COLOUR: Record<NonNullable<TownWeather['sky']> | 'fair', number> = {
  fair: 0xffffff,
  clear: 0xffffff,
  partly: 0xffffff,
  cloudy: 0xd4dae2,
  fog: 0xd4dae2,
  rain: 0x98a2b0,
  storm: 0x7c8694,
  snow: 0xc8d0da,
};

const wrap = (v: number) => ((((v + WRAP / 2) % WRAP) + WRAP) % WRAP) - WRAP / 2;

export class WeatherBodies {
  private weather: TownWeather | null = null;
  private readonly clouds: Array<{ g: Group; x: number; y: number; h: number }> = [];
  private readonly cloudMat = new MeshLambertMaterial({
    color: 0xffffff,
    flatShading: true,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
    fog: false,
  });
  private readonly rain: LineSegments<BufferGeometry, LineBasicMaterial>;
  private readonly snow: Points<BufferGeometry, PointsMaterial>;
  private readonly flakes: Points<BufferGeometry, PointsMaterial>;
  /** Each falling thing: across and down the view (0 to 1), and its own speed. */
  private readonly drops = new Float32Array(MAX_FALLING * 3);
  private readonly camera: OrthographicCamera;
  private drift = 0;

  constructor(scene: Scene, camera: OrthographicCamera) {
    this.camera = camera;
    const blob = new IcosahedronGeometry(1, 1);
    for (let i = 0; i < MAX_CLOUDS; i++) {
      // A cumulus: a flat-bottomed heap of a few faceted blobs.
      const g = new Group();
      const n = 4 + Math.floor(hash(i, 1) * 3);
      for (let k = 0; k < n; k++) {
        const t = (k + 0.5) / n - 0.5;
        const r = (0.9 + hash(i, k + 9) * 0.7) * (1 - Math.abs(t) * 0.9);
        const m = new Mesh(blob, this.cloudMat);
        m.position.set(t * 4.2, r * 0.45, (hash(i * 7, k) - 0.5) * 1.2);
        m.scale.set(r * 1.25, r * 0.7, r);
        m.rotation.y = hash(k, i) * 6;
        g.add(m);
      }
      g.rotation.y = hash(i, 5) * 6;
      g.scale.setScalar(0.8 + hash(i, 6) * 0.7);
      g.visible = false;
      scene.add(g);
      this.clouds.push({
        g,
        x: (hash(i, 2) - 0.5) * WRAP,
        y: (hash(i, 3) - 0.5) * WRAP,
        h: 7 + hash(i, 4) * 2.4,
      });
    }
    for (let i = 0; i < MAX_FALLING; i++)
      this.drops.set([hash(i, 11), hash(i, 12), 0.6 + hash(i, 13) * 0.8], i * 3);
    // Rain and snow are drawn in the camera's own space, just in front of it, over everything.
    const overlay = { transparent: true, depthTest: false, depthWrite: false, fog: false };
    const points = (size: number) => {
      const g = new BufferGeometry();
      g.setAttribute('position', new BufferAttribute(new Float32Array(MAX_FALLING * 3), 3));
      const p = new Points(
        g,
        new PointsMaterial({ color: 0xf8faff, size, sizeAttenuation: false, ...overlay }),
      );
      p.frustumCulled = false;
      p.renderOrder = 50;
      p.visible = false;
      camera.add(p);
      return p;
    };
    this.snow = points(1);
    this.flakes = points(2);
    const rg = new BufferGeometry();
    rg.setAttribute('position', new BufferAttribute(new Float32Array(MAX_FALLING * 6), 3));
    this.rain = new LineSegments(rg, new LineBasicMaterial({ color: 0xbecde6, ...overlay }));
    this.rain.frustumCulled = false;
    this.rain.renderOrder = 50;
    this.rain.visible = false;
    camera.add(this.rain);
    scene.add(camera);
  }

  set(weather: TownWeather): void {
    this.weather = weather;
    const count = Math.max(2, Math.round(weather.cover * MAX_CLOUDS));
    // On a fair day clouds are bright and throw shadows; under overcast the light is flat.
    const fair = weather.light === 'clear';
    this.cloudMat.color.setHex(CLOUD_COLOUR[weather.sky ?? 'fair']);
    this.cloudMat.opacity = fair ? 0.6 : 0.72;
    this.clouds.forEach((cloud, i) => {
      cloud.g.visible = i < count;
      cloud.g.traverse((o) => (o.castShadow = fair));
    });
  }

  /**
   * Move the weather on by dt seconds around where the camera looks (cx, cz); `day` is 0 at night
   * to 1 by day. With reduced motion (`still`), nothing drifts or falls.
   */
  update(dt: number, cx: number, cz: number, day: number, still: boolean): void {
    const w = this.weather;
    if (!w) return;
    if (!still) this.drift += dt;
    for (const cloud of this.clouds) {
      if (!cloud.g.visible) continue;
      cloud.g.position.set(
        cx + wrap(cloud.x + w.drift[0] * this.drift - cx),
        cloud.h,
        cz + wrap(cloud.y + w.drift[1] * this.drift - cz),
      );
    }
    const { left, right, top, bottom } = this.camera;
    const wide = right - left;
    const tall = top - bottom;
    const wpx = wide * PXU;
    const hpx = tall * PXU;
    const area = (wpx * hpx) / 1300;
    const n = w.falling ? Math.min(MAX_FALLING, Math.round(area * (w.heavy ? 1.8 : 1))) : 0;
    const dim = 0.35 + 0.65 * day;
    const raining = w.falling === 'rain';
    this.rain.visible = raining;
    this.snow.visible = this.flakes.visible = w.falling === 'snow';
    if (!w.falling) return;
    const d = this.drops;
    const speed = (raining ? 150 : 16) * (w.heavy ? 1.3 : 1);
    if (!still)
      for (let i = 0; i < n; i++) {
        const s = d[i * 3 + 2]!;
        let u = d[i * 3]!;
        let v = d[i * 3 + 1]! + ((speed * s) / hpx) * dt;
        u += raining ? (-24 / wpx) * dt : ((Math.sin((v * hpx + s * 50) / 14) * 7 + 4) / wpx) * dt;
        if (v > 1) {
          v -= 1;
          u = hash(i, Math.floor(this.drift * 60));
        }
        d[i * 3] = ((u % 1) + 1) % 1;
        d[i * 3 + 1] = v;
      }
    const z = -2;
    if (raining) {
      const pos = this.rain.geometry.attributes.position!;
      for (let i = 0; i < n; i++) {
        const x = left + d[i * 3]! * wide;
        const y = top - d[i * 3 + 1]! * tall;
        pos.setXYZ(i * 2, x, y, z);
        pos.setXYZ(i * 2 + 1, x + 1.5 / PXU, y + 3.5 / PXU, z);
      }
      pos.needsUpdate = true;
      this.rain.geometry.setDrawRange(0, n * 2);
      this.rain.material.opacity = 0.62 * dim;
      return;
    }
    // Snow: two of every three flakes are a single pixel, the rest two.
    const small = this.snow.geometry.attributes.position!;
    const big = this.flakes.geometry.attributes.position!;
    let ns = 0;
    let nb = 0;
    for (let i = 0; i < n; i++) {
      const x = left + d[i * 3]! * wide;
      const y = top - d[i * 3 + 1]! * tall;
      if (i % 3 === 0) big.setXYZ(nb++, x, y, z);
      else small.setXYZ(ns++, x, y, z);
    }
    small.needsUpdate = big.needsUpdate = true;
    this.snow.geometry.setDrawRange(0, ns);
    this.flakes.geometry.setDrawRange(0, nb);
    this.snow.material.opacity = this.flakes.material.opacity = 0.9 * dim;
  }
}
