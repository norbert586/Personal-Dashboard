/**
 * You on screen: a figure and a bike that follow the pure movement in you.ts, a headlight on the
 * bike after dark, and a bell.
 */
import { SpotLight } from 'three';
import {
  faceTo,
  makeBike,
  makeFigure,
  poseRide,
  poseWalk,
  xray,
  type Bike,
  type Figure,
} from './bodies.ts';
import type { Town } from './scene.ts';
import { RUN, WALK, type You } from './you.ts';

const LEGACY = Math.PI; // see light.ts

export class Player {
  readonly you: You;
  readonly figure: Figure;
  readonly bike: Bike;
  private readonly head = new SpotLight(0xfff1cc, 0, 7, 0.5, 0.45, 1);
  private bellCtx: AudioContext | null = null;
  /** Hidden while you're inside a building. */
  inside = false;

  constructor(town: Town, you: You) {
    this.you = you;
    this.figure = makeFigure(town.scene, {
      skin: [238, 200, 166],
      hair: [96, 64, 40],
      jacket: [46, 62, 98],
      pants: [58, 78, 116],
      shoes: [238, 238, 238],
    });
    this.bike = makeBike(town.scene, [176, 42, 38]);
    this.bike.g.visible = false;
    xray(this.figure.g);
    xray(this.bike.g);
    town.scene.add(this.head, this.head.target);
  }

  setBike(on: boolean): void {
    this.you.mode = on ? 'bike' : 'walk';
    this.you.speed = 0;
  }

  /** Two notes of a bicycle bell, made on the spot. */
  bell(): void {
    try {
      this.bellCtx ??= new AudioContext();
      const ctx = this.bellCtx;
      const t = ctx.currentTime;
      for (const [f, d] of [
        [1760, 0],
        [2217, 0.12],
      ] as const) {
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t + d);
        g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.6);
        o.connect(g).connect(ctx.destination);
        o.start(t + d);
        o.stop(t + d + 0.65);
      }
    } catch {
      // no sound here; the ride goes on
    }
  }

  /** Put the bodies where you are, posed for what you're doing; night is 0 by day to 1. */
  sync(town: Town, night: number): void {
    const { you, figure: F, bike: B } = this;
    const onBike = you.mode === 'bike';
    F.g.visible = !this.inside;
    B.g.visible = onBike && !this.inside;
    F.g.position.set(you.x, 0, you.y);
    faceTo(F.g, you.fx, you.fy);
    if (onBike) {
      B.g.position.set(you.x, 0, you.y);
      faceTo(B.g, you.fx, you.fy);
      B.g.rotation.x = you.lean;
      F.g.rotation.x = you.lean;
      F.g.position.x -= you.fx * 0.03;
      F.g.position.z -= you.fy * 0.03;
      poseRide(F, you.phase);
      for (const w of B.wheels) w.rotation.z -= you.speed * 0.25;
    } else {
      F.g.rotation.x = 0;
      const running = you.speed > (WALK + RUN) / 2 - 0.1;
      poseWalk(F, you.phase, you.speed > 0.05 ? (running ? 0.85 : 0.55) : 0, running ? 0.22 : 0);
    }
    // The bike's headlight: a real light on the road, and a glow you can see from afar.
    const lit = onBike && !this.inside;
    this.head.intensity = lit ? 3 * night * LEGACY : 0;
    this.head.position.set(you.x + you.fx * 0.12, 0.16, you.y + you.fy * 0.12);
    this.head.target.position.set(you.x + you.fx * 2.4, 0, you.y + you.fy * 2.4);
    if (lit && night > 0.2)
      town.moving.add(you.x + you.fx * 0.09, you.y + you.fy * 0.09, 5, [1, 0.95, 0.8]);
  }
}
