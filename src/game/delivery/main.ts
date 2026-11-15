/**
 * The delivery mode's entry point (ADR-035), bundled into /delivery only. It loads the zone,
 * builds the world around the car, and runs the drive: input, the car model, collisions, the
 * camera and the dashboard. Or it says plainly that this browser can't.
 */
import { BasicShadowMap, ColorManagement, LinearSRGBColorSpace, Scene, WebGLRenderer } from 'three';
import { path } from '../../lib/paths.ts';
import { decodeZone, type Road, type Zone, type ZoneFile } from '../../lib/zone/format.ts';
import { site } from '../../site.config.ts';
import { keys, listen, onKey, startLoop } from '../loop.ts';
import { driveScale } from '../pixels.ts';
import { seasonOf } from '../world/materials.ts';
import { TIMES, lighting, simDate, type TimeOfDay } from '../world/sun.ts';
import {
  GRASS,
  PAVEMENT,
  driveCar,
  gearLabel,
  newCar,
  speedMph,
  CAR,
  type CarInput,
} from './car.ts';
import { CarBody } from './car-body.ts';
import { Chase } from './chase.ts';
import { collide, fence } from './collide.ts';
import { roadWidth } from './roads.ts';
import { Sky } from './sky.ts';
import { insideRing, points, type XY } from './space.ts';
import { makeMaterials } from './tiles.ts';
import { World } from './world.ts';

// Colours are painted in display space, as in the town.
ColorManagement.enabled = false;

const $ = <T extends Element>(selector: string): T => {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`The delivery page is missing ${selector}`);
  return el;
};

/** What to call a road that has no name. */
const UNNAMED: Partial<Record<Road['kind'], string>> = {
  motorway: 'Freeway',
  link: 'Ramp',
  service: 'Service lane',
  aisle: 'Parking lot',
  driveway: 'Driveway',
};

function cannot(title: string, why: string): void {
  $<HTMLElement>('#loading').hidden = true;
  $<HTMLElement>('#no-webgl-title').textContent = title;
  $<HTMLElement>('#no-webgl-why').textContent = why;
  $<HTMLElement>('#no-webgl').hidden = false;
}

function createRenderer(canvas: HTMLCanvasElement, shadows: boolean): WebGLRenderer | null {
  try {
    const renderer = new WebGLRenderer({
      canvas,
      antialias: false,
      powerPreference: 'high-performance',
    });
    renderer.outputColorSpace = LinearSRGBColorSpace;
    renderer.setPixelRatio(1);
    renderer.shadowMap.enabled = shadows;
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

async function boot(): Promise<void> {
  const canvas = $<HTMLCanvasElement>('#world');
  const asked = new URLSearchParams(location.search);
  const touch = matchMedia('(hover: none)').matches;
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Shadows cost the most on phones, so they're a desktop default; ?shadows=0 or 1 overrides.
  const shadows = asked.has('shadows') ? asked.get('shadows') !== '0' : !touch;
  const renderer = createRenderer(canvas, shadows);
  if (!renderer) {
    document.documentElement.dataset.delivery = 'no-webgl';
    return cannot(
      'Delivery needs WebGL',
      "This browser couldn't start it, so the 3D streets can't open here.",
    );
  }

  let zone: Zone;
  try {
    const response = await fetch(path(`/zone/${site.delivery.zone}.json`));
    if (!response.ok) throw new Error(String(response.status));
    zone = decodeZone((await response.json()) as ZoneFile);
  } catch {
    document.documentElement.dataset.delivery = 'no-map';
    return cannot(
      "The map didn't load",
      'The streets are one file, and it failed to arrive. Reloading usually fixes it.',
    );
  }

  const season = seasonOf(...monthDay(new Date()));
  const scene = new Scene();
  const materials = makeMaterials(season, Math.min(4, renderer.capabilities.getMaxAnisotropy()));
  const world = new World(scene, zone, materials, season);
  world.shadows = shadows;
  const sky = new Sky(scene, shadows);
  const lots = zone.areas.filter((a) => a.kind === 'parking').map((a) => points(a.pts));

  // ---- Where you start: on Auburn Road beside the store, heading east, or where ?at= says ----
  const start = (): [number, number, number] => {
    const [x, y] = (asked.get('at') ?? '').split(',').map(Number);
    if (Number.isFinite(x) && Number.isFinite(y))
      return [x!, y!, ((Number(asked.get('heading')) || 0) * Math.PI) / 180];
    const near = world.streets.nearest(-90, 0, 80, (id) => zone.roads[id]!.name.includes('Auburn'));
    if (!near) return [0, 0, Math.PI / 2];
    const east = near.dx >= 0 ? 1 : -1;
    const dx = near.dx * east;
    const dy = near.dy * east;
    const lane = roadWidth(zone.roads[near.id]!) / 4;
    return [near.x + dy * lane, near.y - dx * lane, Math.atan2(dx, dy)];
  };
  const car = newCar(...start());
  const body = new CarBody(scene, still);
  const chase = new Chase(car.heading, still);

  // ---- The picture: about 360 lines, scaled up by whole device pixels ----
  const resize = () => {
    const s = driveScale(innerWidth, innerHeight, window.devicePixelRatio || 1);
    renderer.setSize(s.width, s.height, false);
    canvas.style.width = `${s.width * s.css}px`;
    canvas.style.height = `${s.height * s.css}px`;
    canvas.dataset.scale = String(s.device);
    chase.camera.aspect = s.width / s.height;
    chase.camera.updateProjectionMatrix();
  };
  addEventListener('resize', resize);
  resize();

  // ---- Controls ----
  let time: TimeOfDay = TIMES.find((t) => t.id === asked.get('time'))?.id ?? 'auto';
  const timeButton = $<HTMLButtonElement>('#b-time');
  timeButton.textContent = TIMES.find((t) => t.id === time)!.label;
  const cycleTime = () => {
    const next = TIMES[(TIMES.findIndex((t) => t.id === time) + 1) % TIMES.length]!;
    time = next.id;
    timeButton.textContent = next.label;
    document.documentElement.dataset.time = time;
  };
  timeButton.addEventListener('click', cycleTime);
  const cameraButton = $<HTMLButtonElement>('#b-camera');
  const cycleCamera = () => {
    cameraButton.textContent = `Camera: ${chase.next().toLowerCase()}`;
  };
  cameraButton.addEventListener('click', cycleCamera);
  const reset = () => {
    Object.assign(car, newCar(...start()));
    canvas.focus({ focusVisible: false });
  };

  // The menu: the drive holds still behind it.
  const pause = $<HTMLDialogElement>('#pause');
  let playing = true;
  const openMenu = () => {
    if (pause.open) return;
    playing = false;
    keys.clear();
    pause.showModal();
  };
  pause.addEventListener('close', () => {
    playing = true;
    keys.clear();
    canvas.focus({ focusVisible: false });
  });
  $('#btn-menu').addEventListener('click', openMenu);
  $('#b-reset').addEventListener('click', () => {
    reset();
    pause.close();
  });

  listen();
  onKey((event) => {
    if (pause.open) return true; // the menu has the keys
    if (event.code === 'Escape') {
      // Or the same key press would close the menu it just opened.
      event.preventDefault();
      openMenu();
    } else if (event.code === 'KeyC') cycleCamera();
    else if (event.code === 'KeyN') cycleTime();
    else if (event.code === 'KeyR') reset();
    else return false;
    return true;
  });

  // On-screen pedals and steering, for phones.
  const held = new Set<string>();
  for (const id of ['t-left', 't-right', 't-gas', 't-brake']) {
    const pad = $<HTMLButtonElement>(`#${id}`);
    const set = (on: boolean) => (event: Event) => {
      event.preventDefault();
      if (on) held.add(id);
      else held.delete(id);
      pad.toggleAttribute('data-held', on);
    };
    pad.addEventListener('pointerdown', set(true));
    for (const type of ['pointerup', 'pointercancel', 'pointerleave'])
      pad.addEventListener(type, set(false));
    pad.addEventListener('contextmenu', (event) => event.preventDefault());
  }
  if (touch) cameraButton.textContent = 'Camera';

  const key = (...codes: string[]) => codes.some((code) => keys.has(code));
  const input = (): CarInput => {
    const out: CarInput = {
      gas: key('KeyW', 'ArrowUp') || held.has('t-gas') ? 1 : 0,
      back: key('KeyS', 'ArrowDown') || held.has('t-brake') ? 1 : 0,
      steer:
        (key('KeyD', 'ArrowRight') || held.has('t-right') ? 1 : 0) -
        (key('KeyA', 'ArrowLeft') || held.has('t-left') ? 1 : 0),
      handbrake: key('Space'),
    };
    // A controller: triggers for the pedals, the left stick to steer, A for the handbrake.
    const gamepad = navigator.getGamepads?.().find((g) => g?.connected);
    if (gamepad) {
      const stick = gamepad.axes[0] ?? 0;
      if (Math.abs(stick) > 0.12) out.steer = stick;
      out.gas = Math.max(out.gas, gamepad.buttons[7]?.value ?? 0);
      out.back = Math.max(out.back, gamepad.buttons[6]?.value ?? 0);
      out.handbrake ||= gamepad.buttons[0]?.pressed ?? false;
    }
    return out;
  };

  // ---- The dashboard ----
  const mph = $<HTMLElement>('#mph');
  const gear = $<HTMLElement>('#gear');
  const revs = $<SVGRectElement>('#revs');
  const street = $<HTMLElement>('#street');
  const limit = $<HTMLElement>('#limit');
  const limitMph = $<HTMLElement>('#limit-mph');
  const clock = $<HTMLElement>('#clock');
  const map = $<HTMLCanvasElement>('#minimap');
  const pen = map.getContext('2d');
  const tokens = getComputedStyle(document.documentElement);
  const colour = (name: string) => tokens.getPropertyValue(name).trim();
  const INK = colour('--ink');
  const DIM = colour('--ink-dim');
  const MAIZE = colour('--maize');
  const WELL = colour('--panel-lo');
  const clockFormat = new Intl.DateTimeFormat(site.locale, {
    timeZone: site.timeZone,
    hour: 'numeric',
    minute: '2-digit',
    hourCycle: site.hourCycle,
  });
  const say = (el: HTMLElement, text: string) => {
    if (el.textContent !== text) el.textContent = text;
  };

  /** A small map of the streets around you, turned so that ahead is up. */
  const drawMap = () => {
    if (!pen) return;
    const size = map.width;
    const reach = 230;
    const scale = size / 2 / reach;
    const sin = Math.sin(car.heading);
    const cos = Math.cos(car.heading);
    pen.fillStyle = WELL;
    pen.fillRect(0, 0, size, size);
    const put = (x: number, y: number): [number, number] => {
      const dx = x - car.x;
      const dy = y - car.y;
      return [
        size / 2 + (dx * cos - dy * sin) * scale,
        size * 0.62 - (dx * sin + dy * cos) * scale,
      ];
    };
    for (const pass of [0, 1]) {
      pen.beginPath();
      world.streets.each(car.x, car.y, reach * 1.3, (ax, ay, bx, by, id) => {
        const kind = zone.roads[id]!.kind;
        const minor = kind === 'driveway' || kind === 'aisle' || kind === 'service';
        if ((pass === 0) !== minor) return;
        pen.moveTo(...put(ax, ay));
        pen.lineTo(...put(bx, by));
      });
      pen.strokeStyle = pass ? INK : DIM;
      pen.lineWidth = pass ? 2 : 1;
      pen.stroke();
    }
    // You, pointing up.
    pen.fillStyle = MAIZE;
    pen.beginPath();
    pen.moveTo(size / 2, size * 0.62 - 7);
    pen.lineTo(size / 2 + 5, size * 0.62 + 5);
    pen.lineTo(size / 2 - 5, size * 0.62 + 5);
    pen.fill();
  };

  /** What's under the car: pavement on a road or in a lot, grass anywhere else. */
  let under: { road: Road; d: number } | null = null;
  const paved = () => {
    if (under && under.d < roadWidth(under.road) / 2 + 0.9) return true;
    return lots.some((ring: XY[]) => insideRing(ring, car.x, car.y));
  };

  // ---- Go ----
  const edge = zone.radius + 110;
  world.update(car.x, car.y, Infinity, 520);
  $<HTMLElement>('#loading').hidden = true;
  document.documentElement.dataset.delivery = 'ready';
  document.documentElement.dataset.time = time;
  canvas.focus({ focusVisible: false });

  let slow = 0;
  let surface = PAVEMENT;
  startLoop((dt, now) => {
    if (playing) {
      driveCar(car, input(), surface, dt);
      collide(car, world.walls);
      fence(car, edge);
    }
    world.update(car.x, car.y, 5);
    chase.update(car, world.walls, dt);
    const L = lighting(simDate(time));
    const eye = chase.camera.position;
    sky.update(L, eye.x, eye.y, eye.z, still ? 0 : now);
    materials.night.value = sky.night;
    body.sync(car, sky.night, dt);
    renderer.render(scene, chase.camera);

    // The dashboard: the dials every frame, the slower things a few times a second.
    const speed = Math.round(speedMph(car));
    say(mph, String(speed));
    say(gear, gearLabel(car));
    revs.setAttribute('width', (Math.min(1, car.rpm / (CAR.redline + 200)) * 100).toFixed(1));
    slow -= dt;
    if (slow > 0) return;
    slow = 0.15;
    under = world.streetAt(car.x, car.y, 26);
    surface = paved() ? PAVEMENT : GRASS;
    const on = surface === PAVEMENT ? under : null;
    const past = Math.hypot(car.x, car.y) > zone.radius;
    const name = past
      ? 'Past the delivery area'
      : on
        ? on.road.name || on.road.ref || UNNAMED[on.road.kind] || 'Street'
        : under
          ? 'Off the road'
          : 'Out in the grass';
    say(street, name);
    // Lots, lanes and driveways have no posted limit.
    const posted = on && !['service', 'aisle', 'driveway'].includes(on.road.kind) ? on.road.mph : 0;
    limit.hidden = !posted;
    if (posted) say(limitMph, String(posted));
    say(clock, clockFormat.format(new Date()));
    drawMap();
    // For tests and tools: what the drive is showing, written only when it changes.
    const data = canvas.dataset;
    const at = `${car.x.toFixed(1)},${car.y.toFixed(1)}`;
    if (data.at !== at) data.at = at;
    if (data.street !== name) data.street = name;
    if (data.mph !== String(speed)) data.mph = String(speed);
    if (data.gear !== gear.textContent) data.gear = gear.textContent ?? '';
    const built = world.load;
    data.load = `${built.chunks} chunks, ${built.triangles} triangles`;
  });
}

void boot();
