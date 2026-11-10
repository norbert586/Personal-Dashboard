/**
 * Going in (ADR-027): the door swings open, you walk through as the camera eases in and the view
 * dims, and the building's window opens as a dialog. Closing it walks you back out and shuts the
 * door. With reduced motion, you go straight in and out.
 */
import { Group, type Scene } from 'three';
import { faceTo, part } from './bodies.ts';
import type { CameraRig } from './camera.ts';
import { doorway, type Doorway } from './entrance.ts';
import type { Player } from './player.ts';
import { ZPX } from './world/atlas.ts';
import type { World } from './world/builders.ts';
import { WALK } from './you.ts';

type Phase = 'out' | 'entering' | 'inside' | 'leaving';

const DOOR_W = 0.3;
const DOOR_H = 20 / ZPX;
const ENTER = 1.1;
const LEAVE = 0.9;
const ZOOM_IN = 1.35;
const DIM = 0.85;

const ease = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
const span = (t: number, a: number, b: number) => ease((t - a) / (b - a));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

export interface Windows {
  dialog: HTMLDialogElement;
  title: HTMLElement;
  body: HTMLElement;
  dim: HTMLElement;
  /** The window's contents for a place, server-rendered. */
  template: (id: number) => HTMLTemplateElement | null;
  /** Called once the contents are in the window, to fill in what's live (a feed's card). */
  opened?: (body: HTMLElement) => void;
}

export class GoingIn {
  phase: Phase = 'out';
  private t = 0;
  private id = 0;
  private way: Doorway | null = null;
  private from: [number, number] = [0, 0];
  private readonly door = new Group();
  private readonly panel = new Group();
  private readonly world: World;
  private readonly player: Player;
  private readonly rig: CameraRig;
  private readonly ui: Windows;
  private readonly still: boolean;
  /** Called when you're back outside, so the canvas can take the keys again. */
  onOut: () => void = () => {};

  constructor(
    scene: Scene,
    world: World,
    player: Player,
    rig: CameraRig,
    ui: Windows,
    still: boolean,
  ) {
    this.world = world;
    this.player = player;
    this.rig = rig;
    this.ui = ui;
    this.still = still;
    // A dark doorway and a door panel hinged at one side, shown only while you go through.
    part(this.door, DOOR_W, DOOR_H, 0.01, [14, 16, 22], DOOR_W / 2, DOOR_H / 2, 0.006);
    part(this.panel, DOOR_W, DOOR_H, 0.025, [126, 44, 44], DOOR_W / 2, DOOR_H / 2, 0.02);
    this.door.add(this.panel);
    this.door.visible = false;
    scene.add(this.door);
    ui.dialog.addEventListener('close', () => this.leave());
  }

  get busy(): boolean {
    return this.phase !== 'out';
  }

  /** Go into place `id` through its door nearest you. */
  enter(id: number): void {
    if (this.busy) return;
    const { you } = this.player;
    const doors = this.world.doors.filter((d) => d.id === id);
    const door = doors.sort(
      (a, b) => Math.hypot(a.x - you.x, a.y - you.y) - Math.hypot(b.x - you.x, b.y - you.y),
    )[0];
    if (!door) return;
    this.id = id;
    this.way = doorway(this.world, door);
    this.from = [you.x, you.y];
    this.phase = 'entering';
    this.t = 0;
    you.speed = 0;
    const n = this.way.normal;
    if (n) {
      // The doorway lies in the wall; local +X runs along it.
      const tx = -n[1];
      const ty = n[0];
      this.door.position.set(
        this.way.sill[0] - (tx * DOOR_W) / 2 + n[0] * 0.004,
        0,
        this.way.sill[1] - (ty * DOOR_W) / 2 + n[1] * 0.004,
      );
      faceTo(this.door, tx, ty);
      this.door.visible = true;
    }
    if (this.still) this.finishEntering();
  }

  private finishEntering(): void {
    this.phase = 'inside';
    this.player.inside = true;
    this.setView(1, 1);
    const tpl = this.ui.template(this.id);
    this.ui.title.textContent = tpl?.dataset.title ?? '';
    this.ui.body.replaceChildren(tpl ? tpl.content.cloneNode(true) : document.createTextNode(''));
    this.ui.opened?.(this.ui.body);
    this.ui.dialog.showModal();
  }

  private leave(): void {
    if (this.phase !== 'inside') return;
    this.ui.body.replaceChildren(); // nothing stays behind to clash with the next window's ids
    this.player.inside = false;
    this.phase = 'leaving';
    this.t = 0;
    const way = this.way;
    if (way) {
      const { you } = this.player;
      [you.x, you.y] = way.inside;
      if (way.normal) [you.fx, you.fy] = way.normal;
    }
    if (this.still) this.finishLeaving();
  }

  private finishLeaving(): void {
    const { you } = this.player;
    if (this.way) [you.x, you.y] = this.way.step;
    you.speed = 0;
    this.door.visible = false;
    this.panel.rotation.y = 0;
    this.setView(0, 0);
    this.phase = 'out';
    this.onOut();
  }

  /** k: 0 outside to 1 inside, for the camera; dim: 0 to 1 for the veil. */
  private setView(k: number, dim: number): void {
    const cam = this.rig.camera;
    cam.zoom = lerp(1, ZOOM_IN, k);
    cam.updateProjectionMatrix();
    this.ui.dim.style.opacity = String(dim * DIM);
  }

  /** Walk along step → sill → inside (or back), f from 0 to 1. */
  private walk(f: number, out: boolean): void {
    const way = this.way;
    if (!way) return;
    const { you } = this.player;
    const a = out ? way.inside : this.from;
    const b = way.sill;
    const c = out ? way.step : way.inside;
    const [p, q, k] = f < 0.5 ? [a, b, f * 2] : [b, c, f * 2 - 1];
    const nx = lerp(p[0], q[0], k);
    const ny = lerp(p[1], q[1], k);
    const d = Math.hypot(nx - you.x, ny - you.y);
    if (d > 1e-4) {
      you.fx = (nx - you.x) / d;
      you.fy = (ny - you.y) / d;
    }
    you.x = nx;
    you.y = ny;
    you.speed = f < 1 ? WALK : 0;
    you.phase += 0.12;
  }

  update(dt: number): void {
    if (this.phase === 'entering') {
      this.t += dt;
      const t = this.t;
      this.panel.rotation.y = -1.7 * span(t, 0, 0.35);
      this.walk(span(t, 0.15, 1.0), false);
      this.setView(span(t, 0, ENTER), span(t, 0.5, ENTER));
      if (t >= ENTER) this.finishEntering();
    } else if (this.phase === 'leaving') {
      this.t += dt;
      const t = this.t;
      this.walk(span(t, 0, 0.6), true);
      this.panel.rotation.y = -1.7 * (1 - span(t, 0.6, LEAVE));
      this.setView(1 - span(t, 0, 0.8), 1 - span(t, 0, 0.4));
      if (t >= LEAVE) this.finishLeaving();
    }
  }
}
