/**
 * A little life on the streets (SPEC: Delivery mode): a few other cars and cyclists that follow
 * the real road graph, and people walking the real sidewalks. It's there to fill the void, not to
 * be a traffic sim: riders keep to their lane, slow for corners, stop where a side street meets a
 * bigger road, take turns at signals, and wait behind whatever is in front, you included. Only the
 * streets around you have any. Pure, with its own seeded dice, so it's unit-tested.
 */
import type { Road, RoadKind, Zone } from '../../lib/zone/format.ts';
import type { CarState } from './car.ts';
import { PRIORITY, controlOf, lightFor, type Control } from './control.ts';
import type { SegGrid } from './grid.ts';
import { roadWidth } from './roads.ts';

/** How likely a new car is to start on each kind of road: busy roads are busier. */
const BUSY: Partial<Record<RoadKind, number>> = {
  motorway: 1,
  link: 0.3,
  primary: 1,
  secondary: 1,
  tertiary: 0.7,
  residential: 0.12,
};
const MPH = 0.44704;

export interface Rider {
  bike: boolean;
  road: number;
  /** Metres along the road's line. */
  s: number;
  /** 1 rides the way the line runs, -1 against it. */
  dir: 1 | -1;
  x: number;
  y: number;
  /** Compass heading in radians: 0 is north, clockwise. */
  heading: number;
  speed: number;
  /** Seconds left of standing still after a bump. */
  halt: number;
  /** A number of its own, for its colour and shape. */
  look: number;
  /** What it will do at the next intersection, decided on the way there. */
  turn: Turn | null;
  waited: number;
  go: boolean;
  /** Metres left of a corner, taken slowly. */
  corner: number;
  /** No way on from here: it leaves the road. */
  gone: boolean;
}

interface Turn {
  /** Where the intersection is along the current road. */
  at: number;
  junction: number;
  road: number;
  s: number;
  dir: 1 | -1;
  /** How far the way on bends, in radians. */
  angle: number;
  stop: 'no' | 'sign' | 'signal';
  /** How far short of the intersection to stop, in metres. */
  hold: number;
}

export interface Walker {
  path: number;
  s: number;
  dir: 1 | -1;
  x: number;
  y: number;
  heading: number;
  speed: number;
  look: number;
  /** How far along its stride it is, for the legs. */
  stride: number;
}

/** Where you are and which way you're looking, so nothing appears or vanishes in view. */
export interface Viewer {
  x: number;
  y: number;
  /** The camera's compass heading. */
  heading: number;
}

/** A line with distances along it. */
class Track {
  readonly pts: readonly number[];
  readonly at: number[] = [0];

  constructor(pts: readonly number[]) {
    this.pts = pts;
    for (let i = 2; i < pts.length; i += 2)
      this.at.push(this.at.at(-1)! + Math.hypot(pts[i]! - pts[i - 2]!, pts[i + 1]! - pts[i - 1]!));
  }

  get length(): number {
    return this.at.at(-1)!;
  }

  /** The point `s` metres along, and the unit direction of the line there. */
  point(s: number): [number, number, number, number] {
    const at = this.at;
    let i = 0;
    while (i < at.length - 2 && at[i + 1]! <= s) i++;
    const span = at[i + 1]! - at[i]! || 1;
    const t = Math.max(0, Math.min(1, (s - at[i]!) / span));
    const ax = this.pts[i * 2]!;
    const ay = this.pts[i * 2 + 1]!;
    const ex = this.pts[i * 2 + 2]! - ax;
    const ey = this.pts[i * 2 + 3]! - ay;
    return [ax + ex * t, ay + ey * t, ex / span, ey / span];
  }
}

const turnTo = (from: number, to: number): number =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));

export interface TrafficOptions {
  cars: number;
  bikes: number;
  walkers: number;
  /** A number from 0 to 1 each time it's called. */
  random: () => number;
}

/** A small steady random source: the same seed gives the same streets. */
export function dice(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export class Traffic {
  readonly riders: Rider[] = [];
  readonly walkers: Walker[] = [];
  private readonly zone: Zone;
  private readonly streets: SegGrid;
  private readonly walks: SegGrid;
  private readonly options: TrafficOptions;
  private readonly tracks = new Map<number, Track>();
  private readonly pathTracks = new Map<number, Track>();
  /** What meets at each intersection: road and point index, in pairs. */
  private readonly joins: number[][];
  private readonly control: Control;
  private clock = 0;

  constructor(zone: Zone, streets: SegGrid, walks: SegGrid, options: TrafficOptions) {
    this.zone = zone;
    this.streets = streets;
    this.walks = walks;
    this.options = options;
    this.control = controlOf(zone);
    this.joins = zone.junctions.map(() => []);
    zone.roads.forEach((road, r) => {
      if (PRIORITY[road.kind] === undefined) return;
      road.nodes.forEach((j, k) => {
        if (j >= 0) this.joins[j]!.push(r, k);
      });
    });
  }

  private track(road: number): Track {
    let t = this.tracks.get(road);
    if (!t) {
      t = new Track(this.zone.roads[road]!.pts);
      this.tracks.set(road, t);
    }
    return t;
  }

  private pathTrack(path: number): Track {
    let t = this.pathTracks.get(path);
    if (!t) {
      t = new Track(this.zone.paths[path]!.pts);
      this.pathTracks.set(path, t);
    }
    return t;
  }

  /** How far right of the road's middle a rider keeps. */
  private lane(road: Road, rider: Pick<Rider, 'bike' | 'look'>): number {
    const half = roadWidth(road) / 2;
    if (rider.bike) return half - 0.7;
    if (road.oneway) return ((rider.look % road.lanes) - (road.lanes - 1) / 2) * 3.4;
    const perSide = Math.max(1, Math.floor(road.lanes / 2));
    if (road.kind === 'residential' || perSide === 1) return half / 2;
    const middle = road.lanes % 2 === 1 ? 1.7 : 0;
    return middle + ((rider.look % perSide) + 0.5) * 3.4;
  }

  /** Where a rider should be right now: in its lane, on its road. */
  private spot(
    rider: Pick<Rider, 'road' | 's' | 'dir' | 'bike' | 'look'>,
  ): [number, number, number] {
    const road = this.zone.roads[rider.road]!;
    const [px, py, tx, ty] = this.track(rider.road).point(rider.s);
    const dx = tx * rider.dir;
    const dy = ty * rider.dir;
    const off = this.lane(road, rider);
    return [px + dy * off, py - dx * off, Math.atan2(dx, dy)];
  }

  /** Decide what a rider does at the next intersection ahead of it. */
  private plan(rider: Rider): void {
    const road = this.zone.roads[rider.road]!;
    const track = this.track(rider.road);
    const { nodes } = road;
    let k = -1;
    if (rider.dir > 0) {
      for (let i = 0; i < nodes.length; i++)
        if (nodes[i]! >= 0 && track.at[i]! > rider.s + 0.05) {
          k = i;
          break;
        }
    } else
      for (let i = nodes.length - 1; i >= 0; i--)
        if (nodes[i]! >= 0 && track.at[i]! < rider.s - 0.05) {
          k = i;
          break;
        }
    if (k < 0) {
      rider.gone = true;
      return;
    }
    const j = nodes[k]!;
    const roads = this.zone.roads;
    const headingAt = (r: number, i: number, d: number): number => {
      const p = roads[r]!.pts;
      const a = Math.max(0, Math.min(p.length / 2 - 2, d > 0 ? i : i - 1));
      return Math.atan2((p[a * 2 + 2]! - p[a * 2]!) * d, (p[a * 2 + 3]! - p[a * 2 + 1]!) * d);
    };
    const here = headingAt(rider.road, rider.dir > 0 ? k - 1 : k + 1, rider.dir);
    const ways: Array<{ road: number; k: number; dir: 1 | -1; angle: number; weight: number }> = [];
    const joins = this.joins[j]!;
    for (let n = 0; n < joins.length; n += 2) {
      const r = joins[n]!;
      const i = joins[n + 1]!;
      const other = roads[r]!;
      // Bikes keep off the freeway and the big roads' ramps.
      if (rider.bike && (other.kind === 'motorway' || other.kind === 'link')) continue;
      for (const d of [1, -1] as const) {
        if (i + d < 0 || i + d >= other.nodes.length) continue;
        if (other.oneway && d < 0) continue;
        if (r === rider.road && i === k && d === -rider.dir) continue;
        const angle = turnTo(here, headingAt(r, i, d));
        if (Math.abs(angle) > 2.5) continue;
        ways.push({ road: r, k: i, dir: d, angle, weight: 1 + (PRIORITY[other.kind] ?? 0) * 0.4 });
      }
    }
    // What it meets there is the same thing the signs and signal heads show (control.ts). It
    // came in along the arm that points back at it. A yield is taken as a stop for now.
    const met = this.control.arms[j]!.find(
      (a) => a.road === rider.road && a.k === k && a.d === -rider.dir,
    )?.stop;
    const stop: Turn['stop'] = met === 'yield' ? 'sign' : (met ?? 'no');
    let widest = 6;
    for (let n = 0; n < joins.length; n += 2)
      widest = Math.max(widest, roadWidth(roads[joins[n]!]!));
    const base = { at: track.at[k]!, junction: j, stop, hold: widest / 2 + 2.5 };
    if (!ways.length) {
      // A dead end: turn round, where the street allows it.
      if (road.oneway) rider.gone = true;
      else
        rider.turn = {
          ...base,
          road: rider.road,
          s: track.at[k]!,
          dir: -rider.dir as 1 | -1,
          angle: Math.PI,
          stop: 'no',
        };
      return;
    }
    const straight = ways.reduce((a, b) => (Math.abs(b.angle) < Math.abs(a.angle) ? b : a));
    let pick = straight;
    if (Math.abs(straight.angle) > 0.6 || this.options.random() > 0.74) {
      let roll = this.options.random() * ways.reduce((sum, w) => sum + w.weight, 0);
      for (const way of ways) {
        pick = way;
        roll -= way.weight;
        if (roll <= 0) break;
      }
    }
    rider.turn = {
      ...base,
      road: pick.road,
      s: this.track(pick.road).at[pick.k]!,
      dir: pick.dir,
      angle: pick.angle,
    };
  }

  /** Seconds the streets have been running: the signals keep time by it. */
  get time(): number {
    return this.clock;
  }

  /** Whether an intersection is clear to pull out into. */
  private clear(rider: Rider, car: CarState | null): boolean {
    const j = this.zone.junctions[rider.turn!.junction]!;
    if (car && Math.hypot(car.x - j.x, car.y - j.y) < 26 && Math.hypot(car.vx, car.vy) > 2.5)
      return false;
    for (const other of this.riders)
      if (other !== rider && other.speed > 1.5 && Math.hypot(other.x - j.x, other.y - j.y) < 22)
        return false;
    return true;
  }

  private ride(rider: Rider, car: CarState | null, dt: number): void {
    if (!rider.turn && !rider.gone) this.plan(rider);
    const road = this.zone.roads[rider.road]!;
    const cruise = rider.bike ? 5.2 : Math.max(6, road.mph * MPH * 0.92);
    let want = rider.corner > 0 ? Math.min(cruise, 5) : cruise;
    const turn = rider.turn;
    if (turn) {
      const gap = (turn.at - rider.s) * rider.dir;
      if (
        turn.stop === 'signal' &&
        !rider.go &&
        gap < 40 &&
        lightFor(this.control, turn.junction, rider.heading, this.clock) === 'green'
      )
        rider.go = rider.speed > 0.5 || rider.waited > 0.4;
      if (turn.stop !== 'no' && !rider.go) {
        want = Math.min(want, Math.sqrt(2 * 2.6 * Math.max(0, gap - turn.hold)));
        if (rider.speed < 0.4 && gap < turn.hold + 2.5) {
          rider.waited += dt;
          if (turn.stop === 'sign' && rider.waited > 0.8)
            rider.go = rider.waited > 7 || this.clear(rider, car);
        }
      }
      if (Math.abs(turn.angle) > 0.5)
        want = Math.min(want, Math.sqrt(4.5 * 4.5 + 2 * 2 * Math.max(0, gap - 4)));
    }
    // Whatever is ahead in the lane: wait behind it.
    const sin = Math.sin(rider.heading);
    const cos = Math.cos(rider.heading);
    const behind = (x: number, y: number, vx: number, vy: number, wide: number) => {
      const fx = x - rider.x;
      const fy = y - rider.y;
      const ahead = fx * sin + fy * cos;
      if (ahead < 0.5 || ahead > 9 + rider.speed * 1.6 || Math.abs(fx * cos - fy * sin) > wide)
        return;
      const pace = Math.max(0, vx * sin + vy * cos);
      want = Math.min(want, ahead < 7.5 ? 0 : pace + (ahead - 7.5) * 0.7);
    };
    if (car) behind(car.x, car.y, car.vx, car.vy, 2);
    for (const other of this.riders)
      if (other !== rider)
        behind(
          other.x,
          other.y,
          Math.sin(other.heading) * other.speed,
          Math.cos(other.heading) * other.speed,
          rider.bike || other.bike ? 1 : 2,
        );
    if (rider.halt > 0) {
      rider.halt -= dt;
      want = 0;
    }
    rider.speed +=
      want > rider.speed
        ? Math.min(want - rider.speed, (rider.bike ? 1.2 : 2.2) * dt)
        : Math.max(want - rider.speed, -6 * dt);

    let step = rider.speed * dt;
    rider.corner = Math.max(0, rider.corner - step);
    // Through any intersections reached this step.
    for (let hops = 0; hops < 4 && rider.turn; hops++) {
      const t: Turn = rider.turn;
      const gap = (t.at - rider.s) * rider.dir;
      if (gap > step) break;
      step -= Math.max(0, gap);
      rider.road = t.road;
      rider.s = t.s;
      rider.dir = t.dir;
      if (Math.abs(t.angle) > 0.5) rider.corner = 10;
      rider.turn = null;
      rider.waited = 0;
      rider.go = false;
      this.plan(rider);
      if (rider.gone) return;
    }
    rider.s += step * rider.dir;

    // The body follows its place in the lane, cutting corners as a car does.
    const [tx, ty, along] = this.spot(rider);
    const dx = tx - rider.x;
    const dy = ty - rider.y;
    const d = Math.hypot(dx, dy);
    if (d > 0.001) {
      const move = Math.min(d, rider.speed * dt + d * Math.min(1, dt * 2.5));
      rider.x += (dx / d) * move;
      rider.y += (dy / d) * move;
    }
    const aim = d > 0.6 && rider.speed > 0.5 ? Math.atan2(dx, dy) : along;
    rider.heading += turnTo(rider.heading, aim) * Math.min(1, dt * 5);
  }

  private walk(walker: Walker, car: CarState | null, dt: number): void {
    const track = this.pathTrack(walker.path);
    // Nobody steps out in front of a moving car.
    const near = car && Math.hypot(car.x - walker.x, car.y - walker.y) < 4.5;
    const pace = near && Math.hypot(car.vx, car.vy) > 1 ? 0 : walker.speed;
    walker.s += pace * walker.dir * dt;
    walker.stride += pace * dt;
    if (walker.s <= 0 || walker.s >= track.length) {
      walker.s = Math.max(0, Math.min(track.length, walker.s));
      walker.dir = -walker.dir as 1 | -1;
    }
    const [x, y, tx, ty] = track.point(walker.s);
    // Keep to the right of the walk.
    const side = 0.35 * walker.dir;
    walker.x = x + ty * side;
    walker.y = y - tx * side;
    const aim = Math.atan2(tx * walker.dir, ty * walker.dir);
    walker.heading += turnTo(walker.heading, aim) * Math.min(1, dt * 6);
  }

  /** Whether a spot is somewhere the viewer wouldn't see a thing appear or vanish. */
  private unseen(x: number, y: number, view: Viewer, close: number, far: number): boolean {
    const dx = x - view.x;
    const dy = y - view.y;
    const d = Math.hypot(dx, dy);
    if (d < close) return false;
    if (d > far) return true;
    return (dx * Math.sin(view.heading) + dy * Math.cos(view.heading)) / d < 0.35;
  }

  private addRider(view: Viewer, bike: boolean): void {
    const { random } = this.options;
    const angle = random() * Math.PI * 2;
    const far = (bike ? 70 : 120) + random() * (bike ? 200 : 300);
    const x = view.x + Math.sin(angle) * far;
    const y = view.y + Math.cos(angle) * far;
    const roads = this.zone.roads;
    const near = this.streets.nearest(x, y, 70, (id) => {
      const kind = roads[id]!.kind;
      if (bike) return kind === 'residential' || kind === 'tertiary' || kind === 'secondary';
      return BUSY[kind] !== undefined;
    });
    if (!near) return;
    const road = roads[near.id]!;
    if (!bike && random() > BUSY[road.kind]!) return;
    if (!this.unseen(near.x, near.y, view, bike ? 60 : 110, bike ? 170 : 300)) return;
    if (this.riders.some((r) => Math.hypot(r.x - near.x, r.y - near.y) < 30)) return;
    // Where on the road's line that is.
    const track = this.track(near.id);
    let s = 0;
    let best = Infinity;
    for (let i = 0; i + 3 < road.pts.length; i += 2) {
      const ax = road.pts[i]!;
      const ay = road.pts[i + 1]!;
      const ex = road.pts[i + 2]! - ax;
      const ey = road.pts[i + 3]! - ay;
      const len2 = ex * ex + ey * ey || 1;
      const t = Math.max(0, Math.min(1, ((near.x - ax) * ex + (near.y - ay) * ey) / len2));
      const d = Math.hypot(near.x - ax - ex * t, near.y - ay - ey * t);
      if (d < best) {
        best = d;
        s = track.at[i / 2]! + Math.sqrt(len2) * t;
      }
    }
    const rider: Rider = {
      bike,
      road: near.id,
      s,
      dir: road.oneway || random() < 0.5 ? 1 : -1,
      x: 0,
      y: 0,
      heading: 0,
      speed: 0,
      halt: 0,
      look: Math.floor(random() * 1e6),
      turn: null,
      waited: 0,
      go: false,
      corner: 0,
      gone: false,
    };
    [rider.x, rider.y, rider.heading] = this.spot(rider);
    rider.speed = bike ? 5 : Math.max(6, road.mph * MPH * 0.9);
    this.riders.push(rider);
  }

  private addWalker(view: Viewer): void {
    const { random } = this.options;
    const angle = random() * Math.PI * 2;
    const far = 35 + random() * 170;
    const x = view.x + Math.sin(angle) * far;
    const y = view.y + Math.cos(angle) * far;
    const paths = this.zone.paths;
    const near = this.walks.nearest(x, y, 45);
    if (!near || !this.unseen(near.x, near.y, view, 45, 120)) return;
    const track = this.pathTrack(near.id);
    if (track.length < 25) return;
    // People are spread out, not in a crowd.
    if (this.walkers.some((w) => Math.hypot(w.x - near.x, w.y - near.y) < 28)) return;
    const path = paths[near.id]!;
    let s = 0;
    let best = Infinity;
    for (let i = 0; i + 3 < path.pts.length; i += 2) {
      const d = Math.hypot(near.x - path.pts[i]!, near.y - path.pts[i + 1]!);
      if (d < best) {
        best = d;
        s = track.at[i / 2]!;
      }
    }
    // Most people stroll; one in six is out for a run.
    const walker: Walker = {
      path: near.id,
      s,
      dir: random() < 0.5 ? 1 : -1,
      x: near.x,
      y: near.y,
      heading: 0,
      speed: random() < 0.17 ? 2.9 : 1.2 + random() * 0.4,
      look: Math.floor(random() * 1e6),
      stride: 0,
    };
    this.walk(walker, null, 0);
    walker.heading = Math.atan2(near.dx * walker.dir, near.dy * walker.dir);
    this.walkers.push(walker);
  }

  /** Move everyone on, and keep the streets around the viewer peopled. */
  update(dt: number, view: Viewer, car: CarState | null): void {
    this.clock += dt;
    for (const rider of this.riders) this.ride(rider, car, dt);
    for (const walker of this.walkers) this.walk(walker, car, dt);
    // Whoever is far behind you, or has run out of road, is gone.
    for (let i = this.riders.length - 1; i >= 0; i--) {
      const r = this.riders[i]!;
      const d = Math.hypot(r.x - view.x, r.y - view.y);
      if (r.gone || d > 640 || (d > 320 && this.unseen(r.x, r.y, view, 0, 640)))
        this.riders.splice(i, 1);
    }
    for (let i = this.walkers.length - 1; i >= 0; i--) {
      const w = this.walkers[i]!;
      const d = Math.hypot(w.x - view.x, w.y - view.y);
      if (d > 300 || (d > 150 && this.unseen(w.x, w.y, view, 0, 300))) this.walkers.splice(i, 1);
    }
    // A couple of tries a step is plenty: most land somewhere that won't do.
    const bikes = this.riders.filter((r) => r.bike).length;
    for (let tries = 0; tries < 3; tries++) {
      if (this.riders.length - bikes < this.options.cars) this.addRider(view, false);
      if (bikes < this.options.bikes && tries === 0) this.addRider(view, true);
      if (this.walkers.length < this.options.walkers) this.addWalker(view);
    }
  }
}

/**
 * Keep your car out of the others: where it overlaps one it's pushed back out and loses the speed
 * it had into it, and the other driver stops for a moment. Returns how many it touched.
 */
export function bump(car: CarState, riders: readonly Rider[]): number {
  let hits = 0;
  for (const rider of riders) {
    if (Math.hypot(rider.x - car.x, rider.y - car.y) > 6) continue;
    const reach = rider.bike ? 0.5 : 1.05;
    let hit = false;
    for (const mine of [1.35, 0, -1.35])
      for (const theirs of rider.bike ? [0] : [1.1, -1.1]) {
        const ax = car.x + Math.sin(car.heading) * mine;
        const ay = car.y + Math.cos(car.heading) * mine;
        const bx = rider.x + Math.sin(rider.heading) * theirs;
        const by = rider.y + Math.cos(rider.heading) * theirs;
        const d = Math.hypot(ax - bx, ay - by);
        const room = 0.95 + reach;
        if (d >= room || d < 1e-6) continue;
        const nx = (ax - bx) / d;
        const ny = (ay - by) / d;
        car.x += nx * (room - d);
        car.y += ny * (room - d);
        const into = car.vx * nx + car.vy * ny;
        if (into < 0) {
          car.vx -= 1.1 * into * nx;
          car.vy -= 1.1 * into * ny;
        }
        hit = true;
      }
    if (hit) {
      rider.halt = 1.5;
      rider.speed = 0;
      hits++;
    }
  }
  return hits;
}
