/**
 * The camera (DESIGN: Camera and scale): orthographic, 30° down, turning freely around you and
 * following with a little look-ahead. Its target is snapped to whole low-res pixels on the screen
 * plane, so walls don't shimmer while it pans.
 */
import { OrthographicCamera, Plane, Raycaster, Vector2, Vector3, type WebGLRenderer } from 'three';
import { PXU, pixelScale, zoomStep } from './pixels.ts';
import { CAM_DISTANCE } from './scene.ts';
import type { You } from './you.ts';

const ELEVATION = Math.PI / 6;
const UP = new Vector3(0, 1, 0);

export class CameraRig {
  readonly camera = new OrthographicCamera(-8, 8, 5, -5, 0.1, 400);
  /** Where the camera looks, before snapping (grid x in .x, grid y in .z). */
  readonly target: Vector3;
  /** Unit vector from the target toward the camera. */
  readonly toCamera = new Vector3();
  yaw = Math.PI / 4;
  yawTarget = Math.PI / 4;
  /** The larger side of the view, in tiles. */
  span = 16;
  /** Device pixels per texel, or 0 for the default for this window. */
  private zoom = 0;
  private scale = 1;
  private readonly fwd = new Vector3();
  private readonly right = new Vector3();
  private readonly up = new Vector3();
  private readonly snap = new Vector3();
  private readonly ray = new Raycaster();
  private readonly ground = new Plane(UP, 0);
  private readonly hit = new Vector3();
  private readonly renderer: WebGLRenderer;
  private readonly canvas: HTMLCanvasElement;

  constructor(renderer: WebGLRenderer, canvas: HTMLCanvasElement, x: number, y: number) {
    this.renderer = renderer;
    this.canvas = canvas;
    this.target = new Vector3(x, 0, y);
  }

  resize(): void {
    const dpr = window.devicePixelRatio || 1;
    const s = pixelScale(innerWidth, innerHeight, dpr, this.zoom);
    this.scale = s.device;
    this.renderer.setSize(s.width, s.height, false);
    this.canvas.style.width = `${s.width * s.css}px`;
    this.canvas.style.height = `${s.height * s.css}px`;
    this.canvas.dataset.scale = String(s.device);
    const c = this.camera;
    c.left = -s.width / 2 / PXU;
    c.right = s.width / 2 / PXU;
    c.top = s.height / 2 / PXU;
    c.bottom = -s.height / 2 / PXU;
    c.updateProjectionMatrix();
    this.span = Math.max(s.width, s.height) / PXU;
  }

  /** Zoom in (+1) or out (-1) by one whole pixel step. */
  zoomBy(dir: number): void {
    const next = zoomStep(this.scale, dir, window.devicePixelRatio || 1);
    if (next === this.scale) return;
    this.zoom = next;
    this.resize();
  }

  /** Turn by a quarter of a right angle (the camera buttons). */
  turn(dir: number): void {
    this.yawTarget += (dir * Math.PI) / 4;
  }

  update(dt: number, you: You, turning: number): void {
    this.yawTarget += turning * dt * 1.7;
    this.yaw += (this.yawTarget - this.yaw) * Math.min(1, dt * 9);
    // Follow you, looking a little ahead of where you're heading.
    const k = Math.min(1, dt * 5);
    this.target.x += (you.x + you.fx * you.speed * 0.28 - this.target.x) * k;
    this.target.z += (you.y + you.fy * you.speed * 0.28 - this.target.z) * k;
    this.toCamera.set(
      Math.cos(ELEVATION) * Math.cos(this.yaw),
      Math.sin(ELEVATION),
      Math.cos(ELEVATION) * Math.sin(this.yaw),
    );
    this.fwd.copy(this.toCamera).negate();
    this.right.crossVectors(this.fwd, UP).normalize();
    this.up.crossVectors(this.right, this.fwd).normalize();
    const tr = Math.round(this.target.dot(this.right) * PXU) / PXU;
    const tu = Math.round(this.target.dot(this.up) * PXU) / PXU;
    const tf = this.target.dot(this.fwd);
    this.snap
      .copy(this.right)
      .multiplyScalar(tr)
      .addScaledVector(this.up, tu)
      .addScaledVector(this.fwd, tf);
    this.camera.position.copy(this.snap).addScaledVector(this.toCamera, CAM_DISTANCE);
    this.camera.up.copy(UP);
    this.camera.lookAt(this.snap);
  }

  /** Point a ray from a screen position (CSS pixels) for picking. */
  pointAt(clientX: number, clientY: number): Raycaster {
    const r = this.canvas.getBoundingClientRect();
    const ndc = new Vector2(
      ((clientX - r.left) / r.width) * 2 - 1,
      -((clientY - r.top) / r.height) * 2 + 1,
    );
    this.ray.setFromCamera(ndc, this.camera);
    return this.ray;
  }

  /** The grid point on the ground under a screen position. */
  groundAt(clientX: number, clientY: number): [number, number] | null {
    return this.pointAt(clientX, clientY).ray.intersectPlane(this.ground, this.hit)
      ? [this.hit.x, this.hit.z]
      : null;
  }
}
