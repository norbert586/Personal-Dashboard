/** The path preview, like a modern RPG: a dotted line on the ground and a pulsing ring where you'll stop. */
import {
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  Points,
  PointsMaterial,
  RingGeometry,
  type Scene,
} from 'three';
import type { Point } from './nav.ts';

const MAX = 600;
const SPACING = 0.16;
const LIFT = 0.014;

export class PathMarks {
  private readonly ring: Mesh;
  private readonly dots: Points<BufferGeometry, PointsMaterial>;
  private readonly pos = new Float32Array(MAX * 3);

  constructor(scene: Scene) {
    this.ring = new Mesh(
      new RingGeometry(0.1, 0.16, 24),
      new MeshBasicMaterial({
        color: 0xf2c14e,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        fog: false,
      }),
    );
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.visible = false;
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(this.pos, 3));
    this.dots = new Points(
      g,
      new PointsMaterial({
        color: 0xf2c14e,
        size: 3,
        sizeAttenuation: false,
        transparent: true,
        opacity: 0.85,
        depthWrite: false,
        fog: false,
      }),
    );
    this.dots.frustumCulled = false;
    scene.add(this.ring, this.dots);
  }

  /** Draw the path ahead of you from (x, y); t is the time in seconds, for the ring's pulse. */
  update(path: Point[] | null, x: number, y: number, t: number, still: boolean): void {
    const g = this.dots.geometry;
    const end = path?.[path.length - 1];
    if (!path || !end) {
      this.ring.visible = false;
      g.setDrawRange(0, 0);
      return;
    }
    const s = still ? 1 : 1 + Math.sin(t * 5) * 0.12;
    this.ring.visible = true;
    this.ring.position.set(end[0], LIFT, end[1]);
    this.ring.scale.set(s, s, s);
    let n = 0;
    let at = SPACING;
    for (const [qx, qy] of path) {
      const L = Math.hypot(qx - x, qy - y);
      while (at < L && n < MAX) {
        const f = at / L;
        this.pos[n * 3] = x + (qx - x) * f;
        this.pos[n * 3 + 1] = LIFT;
        this.pos[n * 3 + 2] = y + (qy - y) * f;
        n++;
        at += SPACING;
      }
      at -= L;
      x = qx;
      y = qy;
    }
    g.setDrawRange(0, n);
    g.attributes.position!.needsUpdate = true;
  }
}
