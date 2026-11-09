/**
 * The town's entry point, bundled into /town only (SPEC: Quality bar), so the 3D library never
 * loads on the other pages. It starts the renderer, or says plainly that this browser can't.
 */
import { BasicShadowMap, ColorManagement, LinearSRGBColorSpace, WebGLRenderer } from 'three';
import { CameraRig } from './camera.ts';
import { nearestDoor, walksIn } from './entrance.ts';
import { GoingIn } from './going-in.ts';
import { createLife, stepLife } from './life.ts';
import { LifeBodies } from './life-bodies.ts';
import { PathMarks } from './marks.ts';
import { buildNav, findPath, pathLength, type Point } from './nav.ts';
import type { Door } from './world/builders.ts';
import { keys, listen, onKey, startLoop } from './loop.ts';
import { applyLight } from './light.ts';
import { Player } from './player.ts';
import { buildTown } from './scene.ts';
import { START, buildWorld } from './world/layout.ts';
import { nightK, seasonOf } from './world/materials.ts';
import { TIMES, lighting, simDate, type TimeOfDay } from './world/sun.ts';
import { keyDirection, newYou, step } from './you.ts';
import { site } from '../site.config.ts';

// The prototype was tuned on three r149, before colour management and physical light units. Colours
// are painted in display space, so keep them there.
ColorManagement.enabled = false;

const $ = <T extends Element>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`The town page is missing ${selector}`);
  return el;
};

function createRenderer(canvas: HTMLCanvasElement): WebGLRenderer | null {
  try {
    const renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = LinearSRGBColorSpace;
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = BasicShadowMap; // hard-edged, like the pixel art
    return renderer;
  } catch {
    return null;
  }
}

/** Month and day in Michigan, for the season. */
function monthDay(now: Date): [number, number] {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: site.timeZone,
    month: 'numeric',
    day: 'numeric',
  }).formatToParts(now);
  const get = (type: string) => Number(parts.find((p) => p.type === type)?.value ?? 1);
  return [get('month'), get('day')];
}

const held = (...codes: string[]) => codes.some((c) => keys.has(c));

function boot(): void {
  const canvas = $<HTMLCanvasElement>('#world');
  const renderer = createRenderer(canvas);
  if (!renderer) {
    $<HTMLElement>('#loading').hidden = true;
    $<HTMLElement>('#no-webgl').hidden = false;
    document.documentElement.dataset.town = 'no-webgl';
    return;
  }

  const world = buildWorld({ season: seasonOf(...monthDay(new Date())) });
  const town = buildTown(world);
  const rig = new CameraRig(renderer, canvas, START.x, START.y);
  const player = new Player(town, newYou(START.x, START.y));
  const you = player.you;

  // ---- Controls: keys, buttons, drag and wheel ----
  let time: TimeOfDay = 'auto';
  const timeButton = $<HTMLButtonElement>('#b-time');
  const cycleTime = () => {
    const next = TIMES[(TIMES.findIndex((t) => t.id === time) + 1) % TIMES.length]!;
    time = next.id;
    timeButton.textContent = next.label;
    document.documentElement.dataset.time = time;
  };
  const bikeButton = $<HTMLButtonElement>('#b-bike');
  const setBike = (on: boolean) => {
    player.setBike(on);
    bikeButton.setAttribute('aria-pressed', String(on));
    document.documentElement.dataset.mode = you.mode;
  };
  timeButton.addEventListener('click', cycleTime);
  bikeButton.addEventListener('click', () => setBike(you.mode !== 'bike'));
  $('#b-left').addEventListener('click', () => rig.turn(-1));
  $('#b-right').addEventListener('click', () => rig.turn(1));
  $('#b-in').addEventListener('click', () => rig.zoomBy(1));
  $('#b-out').addEventListener('click', () => rig.zoomBy(-1));

  // ---- Going in, and the door prompt ----
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const going = new GoingIn(
    town.scene,
    world,
    player,
    rig,
    {
      dialog: $<HTMLDialogElement>('#window'),
      title: $<HTMLElement>('#window-title'),
      body: $<HTMLElement>('#window-body'),
      dim: $<HTMLElement>('#dim'),
      template: (id) => document.querySelector<HTMLTemplateElement>(`template[data-place="${id}"]`),
    },
    still,
  );
  going.onOut = () => canvas.focus({ focusVisible: false });
  const enter = (id: number) => {
    path = null;
    enterId = 0;
    keys.clear();
    going.enter(id);
  };
  const prompt = $<HTMLButtonElement>('#prompt');
  const promptText = $<HTMLElement>('#prompt-text');
  const touch = matchMedia('(hover: none)').matches;
  if (touch) $('#prompt-key').textContent = 'Tap';
  let near: Door | null = null;
  const updatePrompt = () => {
    const d = going.busy ? null : nearestDoor(world, you.x, you.y);
    if (d === near) return;
    near = d;
    prompt.hidden = !d;
    if (d)
      promptText.textContent =
        document.querySelector<HTMLTemplateElement>(`template[data-place="${d.id}"]`)?.dataset
          .label ?? '';
  };
  prompt.addEventListener('click', () => near && enter(near.id));

  listen();
  onKey((event) => {
    if (going.busy) return true; // the window has the keys
    if (event.key === '+' || event.key === '=') rig.zoomBy(1);
    else if (event.key === '-') rig.zoomBy(-1);
    else if (event.code === 'KeyN') cycleTime();
    else if (event.code === 'KeyB') setBike(you.mode !== 'bike');
    else if (event.code === 'Space' && you.mode === 'bike') player.bell();
    else if ((event.code === 'KeyF' || event.code === 'Enter') && near) enter(near.id);
    else return false;
    return true;
  });

  // ---- Click or tap to walk; click a building to walk to its door and go in ----
  let path: Point[] | null = null;
  let enterId = 0;
  const nav = buildNav(world);
  const pick = (cx: number, cy: number): { x: number; y: number; id: number } | null => {
    const hit = rig.pointAt(cx, cy).intersectObjects(town.hits, false)[0];
    if (hit && hit.point.y > 0.03) {
      // Canopies, awnings and signs stick out past the footprint: take the nearest within half a tile.
      const { x, z: y } = hit.point;
      let id = 0;
      let bd = 0.5;
      for (const c of world.colliders) {
        const d = Math.hypot(Math.max(c.x0 - x, 0, x - c.x1), Math.max(c.y0 - y, 0, y - c.y1));
        if (d < bd) {
          bd = d;
          id = c.id;
        }
      }
      return { x, y, id };
    }
    const g = rig.groundAt(cx, cy);
    return g ? { x: g[0], y: g[1], id: 0 } : null;
  };
  const clickAt = (cx: number, cy: number) => {
    if (going.busy) return;
    const p = pick(cx, cy);
    if (!p) return;
    const door = world.doors
      .filter((d) => d.id === p.id)
      .sort(
        (a, b) => Math.hypot(a.x - you.x, a.y - you.y) - Math.hypot(b.x - you.x, b.y - you.y),
      )[0];
    if (door && Math.hypot(door.x - you.x, door.y - you.y) < door.reach) return enter(door.id);
    const found = findPath(nav, you.x, you.y, door ? door.x : p.x, door ? door.y : p.y);
    if (!found) return;
    path = found;
    enterId = door ? door.id : 0;
  };

  // Drag turns the camera, a click or tap walks; the wheel zooms.
  let drag: { x: number; y: number; yaw: number; moved: boolean } | null = null;
  let hoverAt = 0;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw: rig.yawTarget, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (drag) {
      const dx = e.clientX - drag.x;
      if (Math.abs(dx) + Math.abs(e.clientY - drag.y) > 8) drag.moved = true;
      if (drag.moved) rig.yawTarget = drag.yaw + dx * 0.008;
      return;
    }
    // A hand over a building you can go into.
    if (e.pointerType === 'touch' || e.timeStamp - hoverAt < 120) return;
    hoverAt = e.timeStamp;
    canvas.style.cursor = pick(e.clientX, e.clientY)?.id ? 'pointer' : 'crosshair';
  });
  canvas.addEventListener('pointerup', (e) => {
    if (drag && !drag.moved) clickAt(e.clientX, e.clientY);
    drag = null;
  });
  canvas.addEventListener('pointercancel', () => (drag = null));
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      rig.zoomBy(event.deltaY < 0 ? 1 : -1);
    },
    { passive: false },
  );
  addEventListener('resize', () => rig.resize());
  rig.resize();

  const compass = $<HTMLElement>('#compass i');
  if (touch)
    $('#hint-text').textContent =
      'Tap anywhere to walk there, or tap a building to go in. Drag to turn the camera.';
  const marks = new PathMarks(town.scene);
  // Life in town; with reduced motion it holds still (SPEC: Quality bar).
  const life = createLife(world, true);
  const bodies = new LifeBodies(town.scene, world, life);
  $<HTMLElement>('#loading').hidden = true;
  document.documentElement.dataset.town = 'ready';
  canvas.focus({ focusVisible: false });

  startLoop((dt, now) => {
    if (going.busy) going.update(dt);
    else {
      const ix = (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0);
      const iy = (held('KeyW', 'ArrowUp') ? 1 : 0) - (held('KeyS', 'ArrowDown') ? 1 : 0);
      let [dx, dy] = keyDirection(ix, iy, rig.yaw);
      let run = held('ShiftLeft', 'ShiftRight');
      if (ix || iy) path = null;
      else if (path) {
        // Follow the path; long trips break into a run.
        const [px, py] = path[0]!;
        const d = Math.hypot(px - you.x, py - you.y);
        if (d < (you.mode === 'bike' ? 0.22 : 0.07)) {
          path.shift();
          if (!path.length) {
            path = null;
            if (enterId) enter(enterId);
          }
        } else {
          dx = (px - you.x) / d;
          dy = (py - you.y) / d;
          run ||= pathLength(path, you.x, you.y) > 5;
        }
      }
      if (!going.busy) {
        step(you, world, dx, dy, run, dt);
        // Walking straight into a door goes in.
        const d = (ix || iy) && nearestDoor(world, you.x, you.y);
        if (d && walksIn(world, d, you.x, you.y, you.fx, you.fy)) enter(d.id);
      }
    }
    updatePrompt();
    rig.update(dt, you, going.busy ? 0 : (held('KeyE') ? 1 : 0) - (held('KeyQ') ? 1 : 0));
    compass.style.transform = `rotate(${-rig.yaw}rad)`;
    // Where you are, to a tenth of a tile, for tests and tools (written only when it changes).
    const at = `${you.x.toFixed(1)},${you.y.toFixed(1)}`;
    if (canvas.dataset.at !== at) canvas.dataset.at = at;
    const inside = going.phase === 'inside' ? 'inside' : 'out';
    if (document.documentElement.dataset.place !== inside)
      document.documentElement.dataset.place = inside;

    const L = lighting(simDate(time));
    const night = nightK(L.night);
    if (!still) {
      stepLife(life, dt);
      bodies.sky(dt, rig.target.x, rig.target.z, rig.yaw);
    }
    player.sync(town, night);
    bodies.sync(town, still ? 0 : now, night, still);
    marks.update(path, you.x, you.y, now, still);
    town.moving.flush();
    applyLight(town, L, {
      x: rig.target.x,
      z: rig.target.z,
      span: rig.span,
      toCamera: rig.toCamera,
    });
    renderer.render(town.scene, rig.camera);
  });
}

boot();
