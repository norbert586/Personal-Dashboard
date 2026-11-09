/**
 * The town's entry point, bundled into /town only (SPEC: Quality bar), so the 3D library never
 * loads on the other pages. It starts the renderer, or says plainly that this browser can't.
 */
import {
  BasicShadowMap,
  ColorManagement,
  LinearSRGBColorSpace,
  OrthographicCamera,
  Vector3,
  WebGLRenderer,
} from 'three';
import { listen, onKey, startLoop } from './loop.ts';
import { applyLight } from './light.ts';
import { PXU, pixelScale, zoomStep } from './pixels.ts';
import { CAM_DISTANCE, buildTown } from './scene.ts';
import { START, buildWorld } from './world/layout.ts';
import { seasonOf } from './world/materials.ts';
import { TIMES, lighting, simDate, type TimeOfDay } from './world/sun.ts';
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
  const camera = new OrthographicCamera(-8, 8, 5, -5, 0.1, 400);

  // Orthographic, 30° down, at 45° (DESIGN: Camera and scale).
  const elevation = Math.PI / 6;
  const yaw = Math.PI / 4;
  const target = new Vector3(START.x, 0, START.y);
  const toCamera = new Vector3(
    Math.cos(elevation) * Math.cos(yaw),
    Math.sin(elevation),
    Math.cos(elevation) * Math.sin(yaw),
  );
  camera.position.copy(toCamera).multiplyScalar(CAM_DISTANCE).add(target);
  camera.lookAt(target);

  let zoom = 0;
  let span = 16;
  const resize = () => {
    const dpr = window.devicePixelRatio || 1;
    const s = pixelScale(innerWidth, innerHeight, dpr, zoom);
    zoom = zoom && s.device;
    renderer.setSize(s.width, s.height, false);
    canvas.style.width = `${s.width * s.css}px`;
    canvas.style.height = `${s.height * s.css}px`;
    canvas.dataset.scale = String(s.device);
    camera.left = -s.width / 2 / PXU;
    camera.right = s.width / 2 / PXU;
    camera.top = s.height / 2 / PXU;
    camera.bottom = -s.height / 2 / PXU;
    camera.updateProjectionMatrix();
    span = Math.max(s.width, s.height) / PXU;
  };
  const zoomBy = (dir: number) => {
    const dpr = window.devicePixelRatio || 1;
    const current = Number(canvas.dataset.scale) || 1;
    const next = zoomStep(current, dir, dpr);
    if (next !== current) {
      zoom = next;
      resize();
    }
  };

  // Time of day: the real clock, or a preset (N, or the time button).
  let time: TimeOfDay = 'auto';
  const timeButton = $<HTMLButtonElement>('#b-time');
  const cycleTime = () => {
    const i = (TIMES.findIndex((t) => t.id === time) + 1) % TIMES.length;
    const next = TIMES[i]!;
    time = next.id;
    timeButton.textContent = next.label;
    document.documentElement.dataset.time = time;
  };
  timeButton.addEventListener('click', cycleTime);

  listen();
  onKey((event) => {
    if (event.key === '+' || event.key === '=') zoomBy(1);
    else if (event.key === '-') zoomBy(-1);
    else if (event.code === 'KeyN') cycleTime();
    else return false;
    return true;
  });
  canvas.addEventListener(
    'wheel',
    (event) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1 : -1);
    },
    { passive: false },
  );
  addEventListener('resize', resize);
  resize();

  $<HTMLElement>('#loading').hidden = true;
  document.documentElement.dataset.town = 'ready';
  canvas.focus({ focusVisible: false });

  startLoop(() => {
    applyLight(town, lighting(simDate(time)), { x: target.x, z: target.z, span, toCamera });
    renderer.render(town.scene, camera);
  });
}

boot();
