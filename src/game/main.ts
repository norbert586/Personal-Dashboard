/**
 * The town's entry point, bundled into the home page only (SPEC: Quality bar), so the 3D library
 * never loads on the other pages. It starts the renderer, or says plainly that this browser can't.
 */
import {
  BasicShadowMap,
  ColorManagement,
  LinearSRGBColorSpace,
  WebGLRenderer,
  type Fog,
} from 'three';
import { CameraRig } from './camera.ts';
import { nearestDoor, walksIn } from './entrance.ts';
import { FeedClient, ageAtAnswer } from './feeds.ts';
import { GoingIn } from './going-in.ts';
import { createLife, stepLife } from './life.ts';
import { LifeBodies } from './life-bodies.ts';
import { PathMarks } from './marks.ts';
import { Shell } from './shell.ts';
import { plotAircraft } from './sky-traffic.ts';
import { comicCovers, comicPages, moviePages, scorePages, signContent } from './sign-pages.ts';
import { SignBoards } from './signs.ts';
import { lookUpLine, tickerLines } from './ticker.ts';
import { fillCards } from './windows.ts';
import { buildNav, findPath, pathLength, type Point } from './nav.ts';
import type { Door } from './world/builders.ts';
import { keys, listen, onKey, startLoop } from './loop.ts';
import { applyLight } from './light.ts';
import { Player } from './player.ts';
import { CAM_DISTANCE, buildTown } from './scene.ts';
import { FEED_SKIES, townWeather } from './weather.ts';
import { WeatherBodies } from './weather-bodies.ts';
import { START, buildWorld } from './world/layout.ts';
import { nightK, seasonOf, type Season } from './world/materials.ts';
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
const SEASONS: readonly Season[] = ['spring', 'summer', 'fall', 'latefall', 'winter'];
/** How long the town waits for its feeds before it builds itself without them, in ms. */
const FEEDS_WAIT = 1500;

async function boot(): Promise<void> {
  const canvas = $<HTMLCanvasElement>('#world');
  const renderer = createRenderer(canvas);
  if (!renderer) {
    $<HTMLElement>('#loading').hidden = true;
    $<HTMLElement>('#no-webgl').hidden = false;
    document.documentElement.dataset.town = 'no-webgl';
    return;
  }

  // For screenshots and tests: ?at=x,y starts you somewhere else, ?time=night picks the light,
  // and ?sky=snow or ?season=spring previews weather and seasons (the heads-up says it's a preview).
  const asked = new URLSearchParams(location.search);
  const [atX, atY] = (asked.get('at') ?? '').split(',').map(Number);
  const start =
    Number.isFinite(atX) && Number.isFinite(atY)
      ? { x: atX!, y: atY! }
      : { x: START.x, y: START.y };

  // The town asks for its feeds first, and waits a moment: snow on the ground is painted when the
  // world is built, so it needs the forecast. A slow answer is used when it lands, without the snow.
  const feeds = new FeedClient();
  await Promise.race([
    feeds.refresh(true),
    new Promise((resolve) => setTimeout(resolve, FEEDS_WAIT)),
  ]);
  const previewSky = FEED_SKIES.find((sky) => sky === asked.get('sky')) ?? null;
  let weather = townWeather(feeds.snapshot?.feeds.weather, previewSky);
  const season =
    SEASONS.find((name) => name === asked.get('season')) ?? seasonOf(...monthDay(new Date()));

  // Ratiu Field lands and takes off into the real wind: runway 36 when it blows from the north.
  const northbound = weather.drift[0] >= 0;
  const world = buildWorld({ season, snow: weather.snowCover, northbound });
  const town = buildTown(world);
  const rig = new CameraRig(renderer, canvas, start.x, start.y);
  const player = new Player(town, newYou(start.x, start.y));
  const you = player.you;

  // ---- Controls: keys, buttons, drag and wheel ----
  let time: TimeOfDay = TIMES.find((t) => t.id === asked.get('time'))?.id ?? 'auto';
  const timeButton = $<HTMLButtonElement>('#b-time');
  timeButton.textContent = TIMES.find((t) => t.id === time)!.label;
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

  // Life in town; with reduced motion it holds still (SPEC: Quality bar).
  const life = createLife(world, northbound);
  const bodies = new LifeBodies(town.scene, world, life);

  // ---- The feeds: the same answers the Today panel shows, read again every half minute ----
  const boards = new SignBoards(town, world);
  const sky = new WeatherBodies(town.scene, rig.camera);
  /** When the latest answer arrived, on the frame clock (seconds). */
  let skyHeld = 0;
  const windowBody = $<HTMLElement>('#window-body');
  const todayDialog = $<HTMLDialogElement>('#today');
  const todayBody = $<HTMLElement>('#today-body');
  // The Today line at the foot of the screen: one feed at a time, in words.
  const ticker = $<HTMLElement>('#ticker');
  const tickerText = $<HTMLElement>('#ticker-text');
  let tickerAt = 0;
  /** The real aircraft crossing the view, if any: the line says to look up while it does. */
  let lookUp = '';
  const showTicker = () => {
    const now = feeds.snapshot?.feeds ?? null;
    const lines = tickerLines(now, feeds.problem, previewSky);
    const plane = bodies.overhead;
    const text = plane
      ? lookUpLine(plane, now?.flights.provenance === 'sample')
      : (lines[tickerAt % lines.length] ?? '');
    if (tickerText.textContent !== text) tickerText.textContent = text;
  };
  setInterval(() => {
    // It waits while you're reading it, and while the town is paused.
    if (document.hidden || !shell.playing || ticker.matches(':hover, :focus-visible')) return;
    tickerAt++;
    showTicker();
  }, 6000);

  const showFeeds = () => {
    const now = feeds.snapshot?.feeds;
    const down = !now && feeds.problem !== null;
    showTicker();
    // The weather: cloud, rain or snow from the forecast, and fog that closes in.
    weather = townWeather(now?.weather, previewSky);
    sky.set(weather);
    const fog = town.scene.fog as Fog;
    fog.near = CAM_DISTANCE + (weather.fog ? -16 : 14);
    fog.far = CAM_DISTANCE + (weather.fog ? 24 : 62);
    canvas.dataset.weather = [
      weather.sky ?? 'unknown',
      ...(previewSky ? ['preview'] : []),
      ...(world.palette.snow ? ['snow on the ground'] : []),
    ].join(', ');
    const show = <T>(key: string, content: ReturnType<typeof signContent<T>>) => {
      boards.set(key, content);
      canvas.dataset[`sign${key[0]!.toUpperCase()}${key.slice(1)}`] = [
        content.status,
        ...content.pages.flatMap((page) => page.lines),
      ].join('|');
    };
    show('movies', signContent(now?.movies, moviePages, down));
    show(
      'scores',
      // Like the panel, a saved sample counts its days from when it was saved.
      signContent(
        now?.scores,
        (reading) =>
          scorePages(
            reading,
            reading.provenance === 'sample' ? new Date(reading.fetchedAt) : new Date(),
          ),
        down,
      ),
    );
    const comics = signContent(now?.comics, comicPages, down);
    show('comics', comics);
    // The shop window has a cover for every book; it's empty when there's no data.
    const live = now && now.comics.provenance !== 'offline';
    boards.set('comics-window', { ...comics, covers: live ? comicCovers(now.comics) : [] });
    // Real aircraft, where they really are. A saved sample replays from when the page opened.
    const snap = feeds.snapshot;
    if (snap) {
      skyHeld = snap.receivedAt / 1000;
      const flights = snap.feeds.flights;
      const planes = plotAircraft(flights.data.aircraft);
      bodies.setAircraft(
        planes,
        `${flights.provenance} ${flights.fetchedAt}`,
        ageAtAnswer(flights, snap),
        snap.receivedAt / 1000,
        flights.provenance === 'sample',
      );
      canvas.dataset.aircraft =
        flights.provenance === 'offline' ? 'offline' : String(planes.length);
    }
    fillCards(windowBody, feeds);
    if (todayDialog.open) fillCards(todayBody, feeds);
    document.documentElement.dataset.feeds = now ? 'ready' : down ? 'unreachable' : 'loading';
  };
  feeds.onChange(showFeeds);
  showFeeds();
  setInterval(() => {
    if (!document.hidden) void feeds.refresh();
  }, 30_000);

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
      body: windowBody,
      dim: $<HTMLElement>('#dim'),
      template: (id) => document.querySelector<HTMLTemplateElement>(`template[data-place="${id}"]`),
      opened: (body) => {
        fillCards(body, feeds);
        // Cards more than a minute old are read again; the listener above swaps them in.
        if (body.querySelector('[data-cards]') && feeds.cardsAge > 60) void feeds.refresh(true);
      },
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

  // The old-PC shell: boot, setup, title and the pause menu.
  const shell = new Shell();
  shell.onPlay = () => {
    keys.clear();
    canvas.focus({ focusVisible: false });
  };
  // Today opens over the town with T, from the Today line, or from the pause menu.
  shell.onToday = () => {
    keys.clear();
    fillCards(todayBody, feeds);
    if (feeds.cardsAge > 60) void feeds.refresh(true);
  };
  // Nothing stays behind to clash with a building window's ids.
  todayDialog.addEventListener('close', () =>
    todayBody.querySelector('[data-cards]')?.replaceChildren(),
  );
  ticker.addEventListener('click', (event) => {
    if (!shell.playing) return;
    event.preventDefault();
    shell.openToday();
  });

  listen();
  onKey((event) => {
    if (going.busy) return true; // the window has the keys
    if (shell.key(event)) return true;
    if (event.key === '+' || event.key === '=') rig.zoomBy(1);
    else if (event.key === '-') rig.zoomBy(-1);
    else if (event.code === 'KeyN') cycleTime();
    else if (event.code === 'KeyB') setBike(you.mode !== 'bike');
    else if (event.code === 'Space' && you.mode === 'bike') {
      if (shell.sound) player.bell();
    } else if ((event.code === 'KeyF' || event.code === 'Enter') && near) enter(near.id);
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
    if (going.busy || !shell.playing) return;
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
  $<HTMLElement>('#loading').hidden = true;
  document.documentElement.dataset.town = 'ready';
  // Phones open straight to the Today panel, over the town (site.config.ts).
  const phone = matchMedia('(hover: none) and (max-width: 40rem)').matches;
  if (phone && site.phonesOpenToday) {
    shell.play();
    shell.openToday();
  } else void shell.boot(still);

  startLoop((dt, now) => {
    if (!shell.playing) {
      // the town holds still behind the menus
    } else if (going.busy) going.update(dt);
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

    const L = lighting(simDate(time), weather.light);
    const night = nightK(L.night);
    if (!still && shell.playing) stepLife(life, dt);
    // With reduced motion the aircraft hold still between answers, like the rest of the town.
    if (shell.playing) {
      bodies.sky(still ? skyHeld : now, rig.target.x, rig.target.z, rig.yaw);
      if (canvas.dataset.overhead !== String(bodies.inView))
        canvas.dataset.overhead = String(bodies.inView);
      const crossing = bodies.overhead?.hex ?? '';
      if (crossing !== lookUp) {
        lookUp = crossing;
        showTicker();
      }
    }
    player.sync(town, night);
    sky.update(dt, rig.target.x, rig.target.z, L.day, still || !shell.playing);
    if (shell.playing) boards.update(now, still);
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

void boot();
