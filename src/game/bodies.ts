/**
 * Bodies for everything that moves: people (about 12 px tall at the default zoom) and bikes, built
 * from small boxes. Local +X is forward.
 */
import {
  BoxGeometry,
  Color,
  GreaterDepth,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshLambertMaterial,
  TorusGeometry,
  type Object3D,
  type Scene,
} from 'three';
import { ZPX } from './world/atlas.ts';
import type { RGB } from './world/materials.ts';

const BOX = new BoxGeometry(1, 1, 1);
const MATS = new Map<string, MeshLambertMaterial>();
/** One 2D-art pixel of height, in tiles. */
const PX = 1 / ZPX;

export function lambert(c: RGB): MeshLambertMaterial {
  const k = c.join();
  let m = MATS.get(k);
  if (!m) {
    m = new MeshLambertMaterial({ color: new Color(c[0] / 255, c[1] / 255, c[2] / 255) });
    MATS.set(k, m);
  }
  return m;
}

export function part(
  parent: Object3D,
  w: number,
  h: number,
  d: number,
  c: RGB,
  x: number,
  y: number,
  z: number,
): Mesh {
  const m = new Mesh(BOX, lambert(c));
  m.scale.set(w, h, d);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  parent.add(m);
  return m;
}

/** Turn local +X to face grid direction (fx, fy). */
export const faceTo = (o: Object3D, fx: number, fy: number): void => {
  o.rotation.y = Math.atan2(-fy, fx);
};

export interface Colours {
  skin: RGB;
  hair: RGB;
  jacket: RGB;
  pants: RGB;
  shoes: RGB;
}
export interface Figure {
  g: Group;
  legs: Group[];
  arms: Group[];
  body: Group;
}

export function makeFigure(scene: Scene, c: Colours): Figure {
  const g = new Group();
  const legs: Group[] = [];
  const arms: Group[] = [];
  for (const s of [-1, 1]) {
    const hip = new Group();
    hip.position.set(0, 4.6 * PX, s * 0.017);
    part(hip, 0.026, 4.6 * PX, 0.024, c.pants, 0, -2.3 * PX, 0);
    part(hip, 0.042, 0.8 * PX, 0.026, c.shoes, 0.008, -4.4 * PX, 0);
    g.add(hip);
    legs.push(hip);
  }
  const body = new Group();
  body.position.set(0, 4.6 * PX, 0);
  g.add(body);
  part(body, 0.042, 4.2 * PX, 0.07, c.jacket, 0, 2.1 * PX, 0);
  for (const s of [-1, 1]) {
    const sh = new Group();
    sh.position.set(0, 3.9 * PX, s * 0.045);
    part(sh, 0.02, 3.6 * PX, 0.02, c.jacket, 0, -1.8 * PX, 0);
    part(sh, 0.02, 0.8 * PX, 0.02, c.skin, 0, -3.9 * PX, 0);
    body.add(sh);
    arms.push(sh);
  }
  part(body, 0.046, 2.4 * PX, 0.046, c.skin, 0, 5.4 * PX, 0);
  part(body, 0.05, 0.9 * PX, 0.05, c.hair, -0.002, 6.9 * PX, 0);
  part(body, 0.012, 1.8 * PX, 0.05, c.hair, -0.022, 5.8 * PX, 0);
  scene.add(g);
  return { g, legs, arms, body };
}

export function poseWalk(F: Figure, phase: number, amp: number, lean = 0): void {
  const s = Math.sin(phase) * amp;
  F.legs[0]!.rotation.z = s;
  F.legs[1]!.rotation.z = -s;
  F.arms[0]!.rotation.z = -s * 0.8;
  F.arms[1]!.rotation.z = s * 0.8;
  F.body.rotation.z = -lean;
  F.body.position.y = 4.6 * PX + Math.abs(Math.cos(phase)) * amp * 0.4 * PX;
}

export function poseRide(F: Figure, phase: number): void {
  F.legs[0]!.rotation.z = 0.9 + Math.sin(phase) * 0.5;
  F.legs[1]!.rotation.z = 0.9 - Math.sin(phase) * 0.5;
  F.arms[0]!.rotation.z = 1.05;
  F.arms[1]!.rotation.z = 1.05;
  F.body.rotation.z = -0.38;
  F.body.position.y = 4.6 * PX;
}

export interface Bike {
  g: Group;
  wheels: Mesh[];
}

export function makeBike(scene: Scene, frame: RGB): Bike {
  const g = new Group();
  const tire = lambert([26, 26, 30]);
  const wheels: Mesh[] = [];
  for (const x of [-0.078, 0.078]) {
    const w = new Mesh(new TorusGeometry(0.046, 0.009, 4, 10), tire);
    w.position.set(x, 0.055, 0);
    w.castShadow = true;
    g.add(w);
    wheels.push(w);
  }
  part(g, 0.15, 0.012, 0.012, frame, 0, 0.1, 0);
  part(g, 0.012, 0.06, 0.012, frame, -0.035, 0.078, 0);
  part(g, 0.012, 0.075, 0.012, frame, 0.062, 0.085, 0);
  part(g, 0.04, 0.009, 0.022, [22, 22, 26], -0.04, 0.115, 0);
  part(g, 0.01, 0.01, 0.085, [44, 44, 48], 0.066, 0.126, 0);
  scene.add(g);
  return { g, wheels };
}

/**
 * You're always findable: where something stands between you and the camera, you show as a maize
 * silhouette. Each part gets a twin drawn only where it's behind something; the silhouette draws
 * first, so your own limbs never count as walls.
 */
export function xray(root: Object3D): void {
  const sil = new MeshBasicMaterial({
    color: 0xf2c14e,
    transparent: true,
    opacity: 0.6,
    depthFunc: GreaterDepth,
    depthWrite: false,
    fog: false,
  });
  const meshes: Mesh[] = [];
  root.traverse((o) => {
    if (o instanceof Mesh) meshes.push(o);
  });
  for (const o of meshes) {
    const s = new Mesh(o.geometry, sil);
    s.position.copy(o.position);
    s.rotation.copy(o.rotation);
    s.scale.copy(o.scale);
    s.renderOrder = 10;
    o.parent?.add(s);
    const own = (o.material as MeshLambertMaterial).clone();
    own.transparent = true;
    o.material = own;
    o.renderOrder = 11;
  }
}
