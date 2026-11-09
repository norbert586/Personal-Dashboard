/**
 * The town's entry point, bundled into /town only (SPEC: Quality bar), so the 3D library never
 * loads on the other pages. It starts the renderer, or says plainly that this browser can't.
 */
import {
  ColorManagement,
  LinearSRGBColorSpace,
  OrthographicCamera,
  Vector3,
  WebGLRenderer,
} from 'three';
import { listen, onKey, startLoop } from './loop.ts';
import { applyLight } from './light.ts';
import { PXU, pixelScale, zoomStep } from './pixels.ts';
import { buildTown } from './scene.ts';
import { START, buildWorld } from './world/layout.ts';
import { seasonOf } from './world/materials.ts';
import { lighting, todayAt } from './world/sun.ts';
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
    return renderer;
  } catch {
    return null;
  }
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

  const now = new Date();
  const [month, day] = new Intl.DateTimeFormat('en-US', {
    timeZone: site.timeZone,
    month: 'numeric',
    day: 'numeric',
  })
    .formatToParts(now)
    .filter((p) => p.type === 'month' || p.type === 'day')
    .map((p) => Number(p.value));
  const world = buildWorld({ season: seasonOf(month ?? 1, day ?? 1) });
  const town = buildTown(world);
  const { scene } = town;
  const camera = new OrthographicCamera(-8, 8, 5, -5, 0.1, 400);

  // Orthographic, 30° down, at 45° (DESIGN: Camera and scale).
  const elevation = Math.PI / 6;
  const yaw = Math.PI / 4;
  const distance = 90;
  const target = new Vector3(START.x, 0, START.y);
  applyLight(town, lighting(todayAt(12.5)), target.x, target.z);
  camera.position
    .set(
      Math.cos(elevation) * Math.cos(yaw),
      Math.sin(elevation),
      Math.cos(elevation) * Math.sin(yaw),
    )
    .multiplyScalar(distance)
    .add(target);
  camera.lookAt(target);

  let zoom = 0;
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

  listen();
  onKey((event) => {
    if (event.key === '+' || event.key === '=') zoomBy(1);
    else if (event.key === '-') zoomBy(-1);
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

  startLoop(() => renderer.render(scene, camera));
}

boot();
