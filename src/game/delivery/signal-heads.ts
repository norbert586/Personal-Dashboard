/**
 * The lit lenses of the signal heads (DESIGN: Delivery mode): the one part of a signal that
 * changes, so they're one instanced mesh, redrawn as the timer turns, while the poles, wires and
 * housings sit in the world's own meshes. Lenses aren't shaded: a signal reads at noon and glows
 * at night. Red is always the top lens and green the bottom, so it isn't told by colour alone.
 */
import { BoxGeometry, Color, InstancedMesh, Matrix4, MeshBasicMaterial, type Scene } from 'three';
import { HEAD } from './props.ts';
import { lightAt, type Light } from './signals.ts';

/** One head: where it hangs, the compass heading it faces, and whose turn it shows. */
export interface SignalHead {
  x: number;
  y: number;
  heading: number;
  /** The signal it keeps time with (`Control.signal`), and which of its streets it's for. */
  signal: number;
  axis: 0 | 1;
}

/** Heads further off than this are too small to see, in metres. */
const REACH = 420;
const MOST = 120;
const ORDER: readonly Light[] = ['red', 'yellow', 'green'];
const LIT: Record<Light, Color> = {
  red: new Color(1, 0.13, 0.1),
  yellow: new Color(1, 0.74, 0.08),
  green: new Color(0.1, 1, 0.55),
};
const DARK: Record<Light, Color> = {
  red: new Color(0.13, 0.03, 0.03),
  yellow: new Color(0.13, 0.1, 0.02),
  green: new Color(0.02, 0.12, 0.07),
};

export class SignalHeads {
  private readonly heads: readonly SignalHead[];
  private readonly mesh: InstancedMesh;
  private readonly at = new Matrix4();

  constructor(scene: Scene, heads: readonly SignalHead[]) {
    this.heads = heads;
    this.mesh = new InstancedMesh(
      new BoxGeometry(HEAD.lens, HEAD.lens, 0.06),
      new MeshBasicMaterial({ color: 0xffffff }),
      MOST * 3,
    );
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    // The colour buffer has to exist before the first frame is drawn.
    this.mesh.setColorAt(0, DARK.red);
    scene.add(this.mesh);
  }

  /** Light the heads around (x, y) for `time` seconds on the streets' clock. */
  sync(time: number, x: number, y: number): void {
    let n = 0;
    for (const head of this.heads) {
      if (n >= MOST * 3) break;
      if (Math.abs(head.x - x) > REACH || Math.abs(head.y - y) > REACH) continue;
      const light = lightAt(head.axis, head.signal, time);
      const sin = Math.sin(head.heading);
      const cos = Math.cos(head.heading);
      this.at.makeRotationY(-head.heading);
      ORDER.forEach((lens, i) => {
        // North is -z; the lens stands just proud of the housing's face.
        this.at.setPosition(head.x + sin * HEAD.out, HEAD.lenses[i]!, -(head.y + cos * HEAD.out));
        this.mesh.setMatrixAt(n, this.at);
        this.mesh.setColorAt(n, lens === light ? LIT[lens] : DARK[lens]);
        n++;
      });
    }
    this.mesh.count = n;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
}
