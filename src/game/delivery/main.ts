/**
 * The delivery mode's entry point (ADR-035), bundled into /delivery only. It loads the zone,
 * builds the world around the car, and runs the drive: input, the car model, collisions, the
 * camera and the dashboard. Or it says plainly that this browser can't.
 */
import {
  BasicShadowMap,
  ColorManagement,
  LinearSRGBColorSpace,
  PointLight,
  Scene,
  SpotLight,
  WebGLRenderer,
} from 'three';
import { path } from '../../lib/paths.ts';
import {
  decodeZone,
  type PlaceKind,
  type Road,
  type Zone,
  type ZoneFile,
} from '../../lib/zone/format.ts';
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
import { Life } from './life.ts';
import { Sky } from './sky.ts';
import { insideRing, points, type XY } from './space.ts';
import { makeMaterials } from './tiles.ts';
import { Traffic, bump } from './traffic.ts';
import { World, type LampHead } from './world.ts';

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

/** What each kind of place is called on the dashboard, and its letter on the small map. */
const PLACE_WORD: Record<PlaceKind, string> = {
  school: 'School',
  church: 'Church',
  hospital: 'Hospital',
  fuel: 'Gas station',
  dealer: 'Car dealer',
  shop: 'Shop',
  food: 'Food',
  civic: 'Public building',
  park: 'Park',
  homes: 'Neighborhood',
  pizzeria: 'The store',
};
const MAP_LETTER: Partial<Record<PlaceKind, string>> = {
  school: 'S',
  church: 'C',
  hospital: 'H',
  fuel: 'G',
  dealer: 'D',
  pizzeria: 'P',
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
  // The store: its delivery stalls are paved, and its front throws light after dark.
  const glow = new PointLight(0xffb070, 0, 34, 1.4);
  // Street lamps: every head glows, and the few nearest you throw real light on the road. Each
  // fades out before it's handed to another lamp, so the light never jumps.
  const heads: LampHead[] = [];
  const beams = Array.from({ length: touch ? 4 : 6 }, () => {
    const beam = new SpotLight(0xffd6a0, 0, 30, 1.05, 0.9, 1.1);
    scene.add(beam, beam.target);
    return beam;
  });
  const lightLamps = (night: number) => {
    const count = night > 0.02 ? world.lampsNear(car.x, car.y, heads) : 0;
    // Past the last beam's reach there's no light to give: the next lamp out sets the edge.
    const edge = Math.min(120, heads[beams.length]?.d ?? 120);
    beams.forEach((beam, i) => {
      const head = i < count ? heads[i]! : null;
      const fade = head ? Math.min(1, Math.max(0, (edge - head.d) / 25)) : 0;
      beam.intensity = night * fade * 110;
      if (!head || fade === 0) return;
      beam.position.set(head.x, head.h, -head.y);
      beam.target.position.set(head.x, 0, -head.y);
    });
  };
  if (world.shop) {
    lots.push(world.shop.apron);
    const { door, out } = world.shop;
    glow.position.set(door[0] + out[0] * 4, 3.2, -(door[1] + out[1] * 4));
    scene.add(glow);
  }

  // ---- Where you start: in the delivery stall at the store, facing it, or where ?at= says ----
  const start = (): [number, number, number] => {
    const [x, y] = (asked.get('at') ?? '').split(',').map(Number);
    if (Number.isFinite(x) && Number.isFinite(y))
      return [x!, y!, ((Number(asked.get('heading')) || 0) * Math.PI) / 180];
    if (world.shop) return [world.shop.park.x, world.shop.park.y, world.shop.park.heading];
    const near = world.streets.nearest(-90, 0, 80, (id) => zone.roads[id]!.name.includes('Auburn'));
    if (!near) return [0, 0, Math.PI / 2];
    const east = near.dx >= 0 ? 1 : -1;
    const dx = near.dx * east;
    const dy = near.dy * east;
    const lane = roadWidth(zone.roads[near.id]!) / 4;
    return [near.x + dy * lane, near.y - dx * lane, Math.atan2(dx, dy)];
  };
  const car = newCar(...start());
  // A few other cars, cyclists and people on foot; fewer on a phone. ?traffic=0 empties the streets.
  const busy = asked.get('traffic') !== '0';
  const traffic = new Traffic(zone, world.streets, world.walks, {
    cars: busy ? (touch ? 10 : 18) : 0,
    bikes: busy ? 3 : 0,
    walkers: busy ? (touch ? 8 : 14) : 0,
    random: Math.random,
  });
  const life = new Life(scene, traffic, shadows, still);
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
  const placeLine = $<HTMLElement>('#place');
  const placeBox = $<HTMLElement>('#place-box');
  const clock = $<HTMLElement>('#clock');
  const map = $<HTMLCanvasElement>('#minimap');
  const pen = map.getContext('2d');
  const tokens = getComputedStyle(document.documentElement);
  const colour = (name: string) => tokens.getPropertyValue(name).trim();
  const INK = colour('--ink');
  const DIM = colour('--ink-dim');
  const MAIZE = colour('--maize');
  const WELL = colour('--panel-lo');
  const FONT = colour('--font-ui') || 'sans-serif';
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
    // The landmarks around you, each with its letter.
    pen.font = `10px ${FONT}`;
    pen.textAlign = 'center';
    pen.textBaseline = 'middle';
    for (const place of zone.places) {
      const letter = MAP_LETTER[place.kind];
      if (!letter || Math.hypot(place.x - car.x, place.y - car.y) > reach * 1.25) continue;
      const [x, y] = put(place.x, place.y);
      pen.fillStyle = place.kind === 'pizzeria' ? MAIZE : INK;
      pen.fillRect(Math.round(x) - 5, Math.round(y) - 5, 11, 11);
      pen.fillStyle = WELL;
      pen.fillText(letter, Math.round(x) + 0.5, Math.round(y) + 1);
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
  const solids = [world.walls, world.things];
  startLoop((dt, now) => {
    if (playing) {
      // Returns the hardest hit of the frame, in m/s: the pizza's damage will read it (step 6).
      driveCar(car, input(), surface, dt, (c) => collide(c, solids));
      traffic.update(dt, car, car);
      bump(car, traffic.riders);
      fence(car, edge);
    }
    world.update(car.x, car.y, 5);
    chase.update(car, world.walls, dt);
    const L = lighting(simDate(time));
    const eye = chase.camera.position;
    sky.update(L, eye.x, eye.y, eye.z, still ? 0 : now);
    materials.night.value = sky.night;
    glow.intensity = sky.night * 60;
    lightLamps(sky.night);
    body.sync(car, sky.night, dt);
    life.sync(sky.night, now);
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
    const home = world.shop && insideRing(world.shop.apron, car.x, car.y);
    const name = past
      ? 'Past the delivery area'
      : home
        ? 'Delivery parking'
        : on
          ? on.road.name || on.road.ref || UNNAMED[on.road.kind] || 'Street'
          : under
            ? 'Off the road'
            : 'Out in the grass';
    say(street, name);
    // Lots, lanes and driveways have no posted limit.
    const posted =
      on && !home && !['service', 'aisle', 'driveway'].includes(on.road.kind) ? on.road.mph : 0;
    limit.hidden = !posted;
    if (posted) say(limitMph, String(posted));
    const place = past ? null : world.placeNear(car.x, car.y);
    const here = place ? `${PLACE_WORD[place.kind]} · ${place.name}` : '';
    placeBox.hidden = !place;
    if (place) say(placeLine, here);
    say(clock, clockFormat.format(new Date()));
    drawMap();
    // For tests and tools: what the drive is showing, written only when it changes.
    const data = canvas.dataset;
    const at = `${car.x.toFixed(1)},${car.y.toFixed(1)}`;
    if (data.at !== at) data.at = at;
    if (data.street !== name) data.street = name;
    if (data.place !== here) data.place = here;
    const cars = traffic.riders.filter((r) => !r.bike).length;
    data.traffic = `${cars} cars, ${traffic.riders.length - cars} bikes, ${traffic.walkers.length} on foot`;
    if (data.mph !== String(speed)) data.mph = String(speed);
    if (data.gear !== gear.textContent) data.gear = gear.textContent ?? '';
    const built = world.load;
    data.load = `${built.chunks} chunks, ${built.triangles} triangles`;
  });
}

void boot();
