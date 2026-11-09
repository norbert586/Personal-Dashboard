/**
 * The town as three.js meshes: the atlas pages as static geometry, the ground as two textured
 * planes (the town at 32 texels per tile, the farmland beyond at 6), trees as instanced low-poly
 * blobs, and the power lines.
 */
import {
  BufferAttribute,
  BoxGeometry,
  BufferGeometry,
  Color,
  ConeGeometry,
  DataTexture,
  DirectionalLight,
  Float32BufferAttribute,
  HemisphereLight,
  IcosahedronGeometry,
  InstancedMesh,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshLambertMaterial,
  AdditiveBlending,
  CanvasTexture,
  Fog,
  MeshBasicMaterial,
  NearestFilter,
  Object3D,
  Points,
  PointsMaterial,
  RGBAFormat,
  Scene,
  type Material,
} from 'three';
import { PXU } from './pixels.ts';
import { ATLAS, V, ZPX } from './world/atlas.ts';
import type { Light, World } from './world/builders.ts';
import { farP, screenX, screenY } from './world/ground.ts';
import type { RGB } from './world/materials.ts';
import { hash } from './world/noise.ts';

export interface Town {
  scene: Scene;
  hemi: HemisphereLight;
  sun: DirectionalLight;
  /** Meshes a click can land on (buildings and props). */
  hits: Mesh[];
  /** Materials whose emissive night layer fades in after dark. */
  lit: MeshLambertMaterial[];
  /** Halos and light pools: their opacity is the night's strength. */
  glows: Material[];
  /** Halos drawn as screen-space points, lifted toward the camera so nearby walls don't clip them. */
  halos: Object3D[];
  /** The runway's crisp light dots, faint by day. */
  dots: PointsMaterial;
  /** Lights that move (headlights, nav lights), refilled every frame. */
  moving: MovingLights;
}

/** A point cloud of moving glows, refilled every frame: call add() for each, then flush(). */
export class MovingLights {
  readonly points: Points<BufferGeometry, PointsMaterial>;
  private readonly pos: Float32Array;
  private readonly col: Float32Array;
  private n = 0;
  private readonly max: number;

  constructor(points: Points<BufferGeometry, PointsMaterial>, max: number) {
    this.points = points;
    this.max = max;
    this.pos = new Float32Array(max * 3);
    this.col = new Float32Array(max * 3);
    points.geometry.setAttribute('position', new BufferAttribute(this.pos, 3));
    points.geometry.setAttribute('color', new BufferAttribute(this.col, 3));
  }

  /** A glow at grid (x, y), z pixels up, colour 0–1. */
  add(x: number, y: number, z: number, c: RGB): void {
    if (this.n >= this.max) return;
    const i = this.n * 3;
    const p = V(x, y, z);
    this.pos.set(p, i);
    this.col.set(c, i);
    this.n++;
  }

  flush(): void {
    const g = this.points.geometry;
    g.setDrawRange(0, this.n);
    g.attributes.position!.needsUpdate = true;
    g.attributes.color!.needsUpdate = true;
    this.n = 0;
  }
}

/** How far the camera sits from what it looks at, in tiles; fog starts a little past it. */
export const CAM_DISTANCE = 90;

const rgbN = (c: RGB) => new Color(c[0] / 255, c[1] / 255, c[2] / 255);

function dataTex(arr: Uint8Array, w: number, h: number): DataTexture {
  const t = new DataTexture(arr, w, h, RGBAFormat);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  t.flipY = false;
  t.needsUpdate = true;
  return t;
}

function meshFrom(
  scene: Scene,
  pos: number[],
  nor: number[],
  uv: number[],
  mat: Material,
  cast = true,
): Mesh {
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('normal', new Float32BufferAttribute(nor, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  const m = new Mesh(g, mat);
  m.castShadow = cast;
  m.receiveShadow = true;
  scene.add(m);
  return m;
}

/** A square ground plane from (x0, x0), n tiles a side, at height y. */
function groundQuad(scene: Scene, x0: number, n: number, y: number, tex: DataTexture): void {
  const x1 = x0 + n;
  meshFrom(
    scene,
    [x0, y, x1, x1, y, x1, x1, y, x0, x0, y, x1, x1, y, x0, x0, y, x0],
    [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0],
    [0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0],
    new MeshLambertMaterial({ map: tex }),
    false,
  );
}

function groundTextures(scene: Scene, world: World): void {
  const { rgb } = world.palette;
  const fallback: RGB = [40, 60, 40];
  // the town, texel for texel
  const G = world.ground;
  const near = new Uint8Array(G.n * G.n * 4);
  G.tokens.forEach((t, k) => {
    const c = rgb[t] ?? fallback;
    near[k * 4] = c[0];
    near[k * 4 + 1] = c[1];
    near[k * 4 + 2] = c[2];
    near[k * 4 + 3] = 255;
  });
  // farmland to the horizon, coarser
  const x0 = -40;
  const n = 112;
  const per = 6;
  const s = n * per;
  const far = new Uint8Array(s * s * 4);
  for (let j = 0; j < s; j++)
    for (let i = 0; i < s; i++) {
      const gx = x0 + (i + 0.5) / per;
      const gy = x0 + (j + 0.5) / per;
      const c = rgb[farP(screenX(gx, gy), screenY(gx, gy))] ?? fallback;
      const k = (j * s + i) * 4;
      far[k] = c[0];
      far[k + 1] = c[1];
      far[k + 2] = c[2];
      far[k + 3] = 255;
    }
  groundQuad(scene, x0, n, -0.01, dataTex(far, s, s));
  groundQuad(scene, G.origin, G.size, 0, dataTex(near, G.n, G.n));
}

/** Facets get a little colour noise, so a blob reads as leaves rather than plastic. */
function facetNoise<T extends BufferGeometry>(geo: T, seed: number): T {
  const n = geo.attributes.position!.count;
  const c: number[] = [];
  for (let i = 0; i < n; i += 3) {
    const k = 0.82 + hash(i, seed) * 0.32;
    c.push(k, k, k, k, k, k, k, k, k);
  }
  geo.setAttribute('color', new Float32BufferAttribute(c, 3));
  return geo;
}

function instanced<T>(
  scene: Scene,
  geo: BufferGeometry,
  mat: Material,
  list: T[],
  put: (it: T, o: Object3D, col: Color) => void,
): void {
  if (!list.length) return;
  const m = new InstancedMesh(geo, mat, list.length);
  const o = new Object3D();
  const col = new Color();
  list.forEach((it, i) => {
    put(it, o, col);
    o.updateMatrix();
    m.setMatrixAt(i, o.matrix);
    m.setColorAt(i, col);
  });
  m.castShadow = true;
  m.receiveShadow = true;
  scene.add(m);
}

function trees(scene: Scene, world: World): void {
  const { ramps } = world.palette;
  const bare = world.season === 'winter' ? 0.55 : world.season === 'latefall' ? 0.85 : 1;
  const trunks: Array<{ x: number; y: number; h: number; w: number }> = [];
  const blobs: Array<{ x: number; y: number; z: number; r: number; c: RGB; k: number }> = [];
  const cones: Array<{ x: number; y: number; z: number; h: number; r: number; c: RGB }> = [];
  for (const t of world.trees) {
    if (t.kind === 'tree') {
      const sd = hash(Math.round(t.gx * 37), Math.round(t.gy * 41));
      const ramp = ramps[t.mats[Math.floor(sd * t.mats.length)]!];
      const R = ((t.r * 0.82) / PXU) * bare;
      const base = t.th / ZPX;
      trunks.push({ x: t.gx, y: t.gy, h: base + R * 0.8, w: 0.045 });
      blobs.push({ x: t.gx, y: t.gy, z: base + R * 0.85, r: R, c: ramp[2]!, k: 1 });
      blobs.push({
        x: t.gx + R * 0.45,
        y: t.gy - R * 0.3,
        z: base + R * 0.55,
        r: R * 0.72,
        c: ramp[1]!,
        k: 0.95,
      });
      blobs.push({
        x: t.gx - R * 0.35,
        y: t.gy + R * 0.35,
        z: base + R * 1.25,
        r: R * 0.68,
        c: ramp[3]!,
        k: 1,
      });
    } else if (t.kind === 'pine') {
      const H = t.h / ZPX;
      trunks.push({ x: t.gx, y: t.gy, h: H * 0.2, w: 0.04 });
      for (let k = 0; k < 3; k++)
        cones.push({
          x: t.gx,
          y: t.gy,
          z: H * (0.18 + k * 0.24),
          h: H * (0.5 - k * 0.08),
          r: 0.2 - k * 0.045,
          c: ramps.pine[k === 2 ? 1 : 2]!,
        });
    } else {
      const R = (t.r * 0.9) / PXU;
      blobs.push({ x: t.gx, y: t.gy, z: R * 0.6, r: R, c: ramps[t.mat][2]!, k: 0.9 });
    }
  }
  const trunk = rgbN(ramps.trunk[1]!);
  instanced(
    scene,
    new BoxGeometry(1, 1, 1),
    new MeshLambertMaterial({ color: 0xffffff }),
    trunks,
    (it, o, col) => {
      o.position.set(it.x, it.h / 2, it.y);
      o.scale.set(it.w, it.h, it.w);
      col.copy(trunk);
    },
  );
  const leafy = new MeshLambertMaterial({ vertexColors: true, flatShading: true });
  instanced(scene, facetNoise(new IcosahedronGeometry(1, 1), 7), leafy, blobs, (it, o, col) => {
    o.position.set(it.x, it.z, it.y);
    o.scale.set(it.r, it.r * 0.92, it.r);
    o.rotation.set(0, hash(it.x * 50, it.y * 50) * 6, 0);
    col.copy(rgbN(it.c)).multiplyScalar(it.k);
  });
  instanced(scene, facetNoise(new ConeGeometry(1, 1, 7), 3), leafy, cones, (it, o, col) => {
    o.position.set(it.x, it.z + it.h / 2, it.y);
    o.scale.set(it.r, it.h, it.r);
    o.rotation.set(0, hash(it.x * 9, it.z * 9) * 6, 0);
    col.copy(rgbN(it.c));
  });
}

/** Power lines between neighbouring poles on the same street, sagging a little. */
function wires(scene: Scene, world: World): void {
  const byRow = new Map<string, Array<[number, number, number]>>();
  for (const p of world.poles) {
    const k = p[1].toFixed(2);
    byRow.set(k, [...(byRow.get(k) ?? []), p]);
  }
  const pts: number[] = [];
  for (const row of byRow.values()) {
    row.sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < row.length; i++)
      for (const off of [-0.18, 0.18]) {
        const a = row[i - 1]!;
        const b = row[i]!;
        for (let k = 0; k < 12; k++) {
          const t0 = k / 12;
          const t1 = (k + 1) / 12;
          const s0 = 4 * t0 * (1 - t0);
          const s1 = 4 * t1 * (1 - t1);
          pts.push(
            a[0] + (b[0] - a[0]) * t0,
            (a[2] - 6 * s0) / ZPX,
            a[1] + off,
            a[0] + (b[0] - a[0]) * t1,
            (a[2] - 6 * s1) / ZPX,
            a[1] + off,
          );
        }
      }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pts, 3));
  scene.add(new LineSegments(g, new LineBasicMaterial({ color: 0x23262c })));
}

// ---- Night glows: lamp halos (points sized in screen pixels) and pools of light on the ground ----
let glowTex: CanvasTexture | null = null;
export function glowTexture(): CanvasTexture {
  if (glowTex) return glowTex;
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  if (g) {
    const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)');
    gr.addColorStop(0.22, 'rgba(255,255,255,0.42)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fillRect(0, 0, 64, 64);
  }
  glowTex = new CanvasTexture(c);
  return glowTex;
}

/** An additive point cloud of halos `size` low-res pixels across. */
export function glowPoints(
  scene: Scene,
  list: Light[],
  size: number,
): Points<BufferGeometry, PointsMaterial> {
  const pos: number[] = [];
  const col: number[] = [];
  for (const L of list) {
    pos.push(...V(L.x, L.y, L.z));
    col.push((L.c[0] / 255) * L.a, (L.c[1] / 255) * L.a, (L.c[2] / 255) * L.a);
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  const m = new PointsMaterial({
    size,
    map: glowTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    opacity: 0,
    sizeAttenuation: false,
    fog: false,
  });
  const p = new Points(g, m);
  p.frustumCulled = false;
  scene.add(p);
  return p;
}

function glows(scene: Scene, world: World): Pick<Town, 'glows' | 'halos' | 'dots' | 'moving'> {
  const mats: Material[] = [];
  const halos: Object3D[] = [];
  const buckets = new Map<number, Light[]>();
  for (const L of world.lights) {
    const s = Math.max(12, Math.min(108, Math.round((L.r * 1.5) / 12) * 12));
    buckets.set(s, [...(buckets.get(s) ?? []), L]);
  }
  for (const [size, list] of buckets) {
    const p = glowPoints(scene, list, size);
    mats.push(p.material);
    halos.push(p);
  }
  // pools of light on the ground under each lamp
  const pos: number[] = [];
  const col: number[] = [];
  const uv: number[] = [];
  for (const L of world.lights) {
    const R = (L.r * 0.75) / PXU;
    const k = L.a * 0.55;
    const c = [(L.c[0] / 255) * k, (L.c[1] / 255) * k, (L.c[2] / 255) * k];
    for (const [a, b, u, v] of [
      [L.x - R, L.y + R, 0, 1],
      [L.x + R, L.y + R, 1, 1],
      [L.x + R, L.y - R, 1, 0],
      [L.x - R, L.y + R, 0, 1],
      [L.x + R, L.y - R, 1, 0],
      [L.x - R, L.y - R, 0, 0],
    ] as const) {
      pos.push(a, 0.004, b);
      col.push(...c);
      uv.push(u, v);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute('position', new Float32BufferAttribute(pos, 3));
  g.setAttribute('color', new Float32BufferAttribute(col, 3));
  g.setAttribute('uv', new Float32BufferAttribute(uv, 2));
  const pool = new MeshBasicMaterial({
    map: glowTexture(),
    vertexColors: true,
    transparent: true,
    depthWrite: false,
    blending: AdditiveBlending,
    opacity: 0,
    fog: false,
  });
  scene.add(new Mesh(g, pool));
  mats.push(pool);
  // runway, taxiway and threshold lights: crisp dots, with a small halo at night
  const dpos: number[] = [];
  const dcol: number[] = [];
  for (const f of world.fixtures) {
    dpos.push(...V(f.x, f.y, 1.5));
    dcol.push(...f.c);
  }
  const dg = new BufferGeometry();
  dg.setAttribute('position', new Float32BufferAttribute(dpos, 3));
  dg.setAttribute('color', new Float32BufferAttribute(dcol, 3));
  const dots = new PointsMaterial({
    size: 2,
    vertexColors: true,
    transparent: true,
    opacity: 0.3,
    sizeAttenuation: false,
    fog: false,
  });
  scene.add(new Points(dg, dots));
  const halo = glowPoints(
    scene,
    world.fixtures.map((f) => ({
      x: f.x,
      y: f.y,
      z: 1.5,
      r: 0,
      c: [f.c[0] * 255, f.c[1] * 255, f.c[2] * 255],
      a: 0.5,
    })),
    14,
  );
  mats.push(halo.material);
  halos.push(halo);
  const moving = new MovingLights(glowPoints(scene, [], 18), 160);
  mats.push(moving.points.material);
  halos.push(moving.points);
  return { glows: mats, halos, dots, moving };
}

export function buildTown(world: World): Town {
  const scene = new Scene();
  scene.background = new Color(0x8899aa);
  const hemi = new HemisphereLight(0xffffff, 0x888888, 1);
  const sun = new DirectionalLight(0xffffff, 1);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  Object.assign(sun.shadow.camera, {
    left: -16,
    right: 16,
    top: 16,
    bottom: -16,
    near: 1,
    far: 260,
  });
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.02;
  scene.add(hemi, sun, sun.target);
  // Fog only touches the far edges of the world.
  scene.fog = new Fog(0x8899aa, CAM_DISTANCE + 14, CAM_DISTANCE + 62);
  const hits: Mesh[] = [];
  const lit: MeshLambertMaterial[] = [];
  for (const p of world.atlas.pages) {
    const m = new MeshLambertMaterial({
      map: dataTex(p.col, ATLAS, ATLAS),
      emissive: 0xffffff,
      emissiveMap: dataTex(p.emi, ATLAS, ATLAS),
      emissiveIntensity: 0,
    });
    hits.push(meshFrom(scene, p.pos, p.nor, p.uv, m));
    lit.push(m);
  }
  groundTextures(scene, world);
  trees(scene, world);
  wires(scene, world);
  return { scene, hemi, sun, hits, lit, ...glows(scene, world) };
}
