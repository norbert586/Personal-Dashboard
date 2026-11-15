/**
 * The delivery mode's sky and light (DESIGN: Delivery mode): a dome around the camera with a
 * gradient for the hour, the real sun where it really is, blocky clouds that drift, and stars at
 * night, all dithered down to 15-bit colour like a 32-bit console. The same moment lights the
 * world: a sky light, the sun with hard shadows, and fog in the horizon's colour.
 */
import {
  BackSide,
  Color,
  DirectionalLight,
  Fog,
  HemisphereLight,
  Mesh,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Scene,
} from 'three';
import { mix3, nightK, type RGB } from '../world/materials.ts';
import type { Lighting } from '../world/sun.ts';
import { FOG } from './world.ts';

// three r155 dropped the legacy light scale the town's colours were tuned on; this restores it.
const LEGACY = Math.PI;

const VERTEX = `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT = `
uniform vec3 zenith;
uniform vec3 horizon;
uniform vec3 sunDir;
uniform vec3 sunCol;
uniform vec3 cloudCol;
uniform float night;
uniform float cover;
uniform float time;
uniform vec2 wind;
varying vec3 vDir;

float hash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float noise(vec2 p) {
  vec2 i = floor(p);
  vec2 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
             mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float bayer(vec2 p) {
  vec2 q = floor(mod(p, 4.0));
  float i = q.x + q.y * 4.0;
  // The 4 by 4 ordered-dither matrix, row by row.
  float m = i < 0.5 ? 0.0 : i < 1.5 ? 8.0 : i < 2.5 ? 2.0 : i < 3.5 ? 10.0
          : i < 4.5 ? 12.0 : i < 5.5 ? 4.0 : i < 6.5 ? 14.0 : i < 7.5 ? 6.0
          : i < 8.5 ? 3.0 : i < 9.5 ? 11.0 : i < 10.5 ? 1.0 : i < 11.5 ? 9.0
          : i < 12.5 ? 15.0 : i < 13.5 ? 7.0 : i < 14.5 ? 13.0 : 5.0;
  return (m + 0.5) / 16.0;
}

void main() {
  vec3 d = normalize(vDir);
  float up = max(d.y, 0.0);
  vec3 col = mix(horizon, zenith, pow(up, 0.5));

  // The sun: a disc, and its glow.
  float s = dot(d, sunDir);
  float low = smoothstep(-0.06, 0.02, sunDir.y);
  col += sunCol * 0.3 * pow(max(s, 0.0), 28.0) * low;
  col = mix(col, sunCol, smoothstep(0.99925, 0.9995, s) * low);

  if (d.y > 0.0) {
    // Stars, each a cell of a grid stretched over the dome.
    vec2 cell = floor(d.xz / (d.y + 0.4) * 110.0);
    float star = step(0.9965, hash(cell)) * smoothstep(0.03, 0.25, d.y);
    col += vec3(0.95, 0.95, 1.0) * star * night;

    // Clouds on a flat ceiling: big square texels, drifting with the wind.
    vec2 p = d.xz / (d.y + 0.11) * 1.5 + wind * time;
    vec2 block = floor(p * 26.0) / 26.0;
    float n = noise(block * 1.3) * 0.62 + noise(block * 3.1 + 7.0) * 0.38;
    float edge = 1.0 - cover;
    float c = smoothstep(edge, edge + 0.07, n) * smoothstep(0.02, 0.2, d.y);
    float shade = 0.78 + 0.22 * smoothstep(edge + 0.05, edge + 0.3, n);
    col = mix(col, cloudCol * shade, c * 0.94);
  }

  // Fifteen-bit colour, with ordered dither so the gradient bands break up.
  col = floor(col * 31.0 + bayer(gl_FragCoord.xy)) / 31.0;
  gl_FragColor = vec4(col, 1.0);
}
`;

const DAY_ZENITH: RGB = [0.24, 0.46, 0.8];
const DAY_HORIZON: RGB = [0.7, 0.83, 0.93];
const DUSK_ZENITH: RGB = [0.22, 0.24, 0.5];
const DUSK_HORIZON: RGB = [0.98, 0.58, 0.34];
const NIGHT_ZENITH: RGB = [0.015, 0.025, 0.07];
const NIGHT_HORIZON: RGB = [0.06, 0.08, 0.15];

export class Sky {
  readonly hemi = new HemisphereLight(0xffffff, 0x888888, 1);
  readonly sun = new DirectionalLight(0xffffff, 1);
  /** 0 by day to 1 at night: how far lit windows and lamps have faded in. */
  night = 0;
  private readonly dome: Mesh<SphereGeometry, ShaderMaterial>;
  private readonly fog: Fog;
  private readonly background = new Color();
  private readonly toSun = new Vector3();

  constructor(scene: Scene, shadows: boolean) {
    this.dome = new Mesh(
      new SphereGeometry(1, 24, 16),
      new ShaderMaterial({
        vertexShader: VERTEX,
        fragmentShader: FRAGMENT,
        side: BackSide,
        depthTest: false,
        depthWrite: false,
        fog: false,
        uniforms: {
          zenith: { value: new Color() },
          horizon: { value: new Color() },
          sunDir: { value: new Vector3(0, 1, 0) },
          sunCol: { value: new Color() },
          cloudCol: { value: new Color() },
          night: { value: 0 },
          cover: { value: 0.42 },
          time: { value: 0 },
          wind: { value: [0.006, 0.002] },
        },
      }),
    );
    this.dome.scale.setScalar(1400);
    this.dome.renderOrder = -10;
    this.dome.frustumCulled = false;
    this.fog = new Fog(0x8899aa, FOG.near, FOG.far);
    scene.fog = this.fog;
    scene.background = this.background;

    const sun = this.sun;
    sun.castShadow = shadows;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, {
      left: -110,
      right: 110,
      top: 110,
      bottom: -110,
      near: 1,
      far: 900,
    });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.08;
    scene.add(this.dome, this.hemi, sun, sun.target);
  }

  /**
   * Light a moment. `L` is the sun and sky for the real date; (x, z) is where you are in three.js
   * space, which the dome and the shadows follow; `now` is the frame clock, in seconds.
   */
  update(L: Lighting, x: number, y: number, z: number, now: number): void {
    const day = L.day;
    const twilight = day > 0.02 && day < 0.98 ? Math.max(0, 1 - Math.abs(day * 2 - 1)) : 0;
    const overcast = L.I < 0.3 * day ? 0.5 : 0;
    let zenith = mix3(NIGHT_ZENITH, DAY_ZENITH, day);
    let horizon = mix3(NIGHT_HORIZON, DAY_HORIZON, day);
    zenith = mix3(zenith, DUSK_ZENITH, twilight * 0.6);
    horizon = mix3(horizon, DUSK_HORIZON, twilight * 0.85);
    if (overcast) {
      const grey: RGB = [
        0.62 * (0.25 + 0.75 * day),
        0.66 * (0.25 + 0.75 * day),
        0.7 * (0.25 + 0.75 * day),
      ];
      zenith = mix3(zenith, grey, overcast);
      horizon = mix3(horizon, grey, overcast);
    }
    const u = this.dome.material.uniforms;
    (u.zenith!.value as Color).setRGB(zenith[0], zenith[1], zenith[2]);
    (u.horizon!.value as Color).setRGB(horizon[0], horizon[1], horizon[2]);
    // The town's grid runs south (+x) and west (+y); here east is +x and south is +z.
    // Its true height, too: below the horizon at night, where `L.d` stops at the ground.
    this.toSun.set(-L.d[1], Math.sin((L.sun.el * Math.PI) / 180), L.d[0]).normalize();
    (u.sunDir!.value as Vector3).copy(this.toSun);
    (u.sunCol!.value as Color).setRGB(
      Math.min(1.3, L.sunCol[0] * 1.05),
      Math.min(1.3, L.sunCol[1] * 1.02),
      Math.min(1.3, L.sunCol[2]),
    );
    const cloud = mix3(
      mix3([0.1, 0.11, 0.16], [0.98, 0.98, 0.97], day),
      [1, 0.72, 0.56],
      twilight * 0.6,
    );
    (u.cloudCol!.value as Color).setRGB(cloud[0], cloud[1], cloud[2]);
    this.night = nightK(L.night);
    u.night!.value = this.night;
    u.time!.value = now;
    this.dome.position.set(x, y, z);

    // Fog and the clear colour are the horizon's, so the far edge of the world melts into the sky.
    this.background.setRGB(horizon[0], horizon[1], horizon[2]);
    this.fog.color.copy(this.background);

    const { hemi, sun } = this;
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
    this.toSun.y = Math.max(0.08, this.toSun.y);
    this.toSun.normalize();
    // Shadows cover the block around you; snapping the box keeps their edges from crawling.
    const snap = 4;
    sun.target.position.set(Math.round(x / snap) * snap, 0, Math.round(z / snap) * snap);
    sun.position.copy(sun.target.position).addScaledVector(this.toSun, 400);
  }
}
