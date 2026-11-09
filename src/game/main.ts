/**
 * The town's entry point, bundled into /town only (SPEC: Quality bar), so the 3D library never
 * loads on the other pages. It starts the renderer, or says plainly that this browser can't.
 */
import { BasicShadowMap, ColorManagement, LinearSRGBColorSpace, WebGLRenderer } from 'three';
import { CameraRig } from './camera.ts';
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

  listen();
  onKey((event) => {
    if (event.key === '+' || event.key === '=') rig.zoomBy(1);
    else if (event.key === '-') rig.zoomBy(-1);
    else if (event.code === 'KeyN') cycleTime();
    else if (event.code === 'KeyB') setBike(you.mode !== 'bike');
    else if (event.code === 'Space' && you.mode === 'bike') player.bell();
    else return false;
    return true;
  });

  // Drag turns the camera; the wheel zooms.
  let drag: { x: number; y: number; yaw: number; moved: boolean } | null = null;
  canvas.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, y: e.clientY, yaw: rig.yawTarget, moved: false };
    canvas.setPointerCapture(e.pointerId);
  });
  canvas.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    if (Math.abs(dx) + Math.abs(e.clientY - drag.y) > 8) drag.moved = true;
    if (drag.moved) rig.yawTarget = drag.yaw + dx * 0.008;
  });
  canvas.addEventListener('pointerup', () => (drag = null));
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
  if (matchMedia('(hover: none)').matches)
    $('#hint-text').textContent =
      'Drag to turn the camera. The buttons zoom, switch to the bike and change the time.';
  $<HTMLElement>('#loading').hidden = true;
  document.documentElement.dataset.town = 'ready';
  canvas.focus({ focusVisible: false });

  startLoop((dt) => {
    const ix = (held('KeyD', 'ArrowRight') ? 1 : 0) - (held('KeyA', 'ArrowLeft') ? 1 : 0);
    const iy = (held('KeyW', 'ArrowUp') ? 1 : 0) - (held('KeyS', 'ArrowDown') ? 1 : 0);
    const [dx, dy] = keyDirection(ix, iy, rig.yaw);
    step(you, world, dx, dy, held('ShiftLeft', 'ShiftRight'), dt);
    rig.update(dt, you, (held('KeyE') ? 1 : 0) - (held('KeyQ') ? 1 : 0));
    compass.style.transform = `rotate(${-rig.yaw}rad)`;
    // Where you are, to a tenth of a tile, for tests and tools (written only when it changes).
    const at = `${you.x.toFixed(1)},${you.y.toFixed(1)}`;
    if (canvas.dataset.at !== at) canvas.dataset.at = at;

    const L = lighting(simDate(time));
    player.sync(town, nightK(L.night));
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
