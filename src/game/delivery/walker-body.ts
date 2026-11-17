/**
 * You on foot, as you're seen (DESIGN: Delivery mode, you): the town's figure from bodies.ts,
 * scaled from the town's tiles to a person's real height, in the store's red jacket. Where
 * something hides you from the camera, you show through as the town's maize silhouette.
 */
import type { Scene } from 'three';
import { makeFigure, poseWalk, xray, type Figure } from '../bodies.ts';
import { ZPX } from '../world/atlas.ts';
import { FOOT, type FootState } from './foot.ts';

/** How tall you stand, in metres, and how tall the town's figure is in its own pixels. */
const TALL = 1.75;
const FIGURE_PX = 11.95;

export class WalkerBody {
  private readonly figure: Figure;
  private readonly still: boolean;
  /** How wide the swing is now: it eases in and out, so you don't snap to attention. */
  private swing = 0;

  constructor(scene: Scene, reducedMotion: boolean) {
    this.still = reducedMotion;
    this.figure = makeFigure(scene, {
      skin: [238, 200, 166],
      hair: [96, 64, 40],
      jacket: [176, 42, 38],
      pants: [40, 44, 56],
      shoes: [238, 238, 238],
    });
    this.figure.g.scale.setScalar(TALL / (FIGURE_PX / ZPX));
    this.figure.g.visible = false;
    xray(this.figure.g);
  }

  /** Stand the figure where you are, or put it away with null while you're in the car. */
  sync(foot: FootState | null, dt: number): void {
    this.figure.g.visible = foot !== null;
    if (!foot) return;
    this.figure.g.position.set(foot.x, 0.02, -foot.y);
    // The figure's own forward is +X; heading 0 is north, which is -Z here.
    this.figure.g.rotation.y = Math.PI / 2 - foot.heading;
    const pace = Math.abs(foot.speed);
    const wide = this.still || pace === 0 ? 0 : pace > FOOT.walk ? 0.95 : 0.6;
    this.swing += (wide - this.swing) * Math.min(1, dt * 12);
    poseWalk(this.figure, foot.stride, this.swing, pace > FOOT.walk && !this.still ? 0.16 : 0);
  }
}
