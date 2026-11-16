/**
 * Routing (SPEC: Delivery mode, routing; ADR-047): the quickest drive between any two points on
 * the zone's streets, and so between any two doors. One piece of code for three things: the GPS
 * path on the ground, the time a customer is quoted, and the check on whether a bundle of orders
 * is really one run (ADR-043).
 *
 * A drive time is every stretch of road at its speed limit, plus what each intersection costs: a
 * stop sign, a signal's average wait, slowing for a turn. Who stops where comes from `control.ts`
 * and the signal's timing from `signals.ts`, so a quote can't disagree with the signs you see.
 * Pure, and worked out once per zone.
 */
import { doorOf, nearestOnRoad } from '../../lib/zone/addresses.ts';
import type { Building, RoadKind, Zone } from '../../lib/zone/format.ts';
import { PRIORITY, controlOf } from './control.ts';
import { SegGrid } from './grid.ts';
import { TURN } from './signals.ts';

const MPH = 0.44704;

/** How a quoted drive is driven. Every value the router's times depend on is here. */
export const PACE = {
  /** Easing down for a stop or a corner, and pulling away again, in m/s². */
  brake: 3,
  pull: 2.2,
  /** Seconds stopped at a stop sign, looking both ways. */
  look: 1.5,
  /** The speed through a right-angle turn, in m/s; sharper turns are slower, down to `hairpin`. */
  corner: 5,
  hairpin: 2.5,
  /** A bend gentler than this, in radians, costs nothing. */
  straight: 0.35,
  /** Seconds waiting for a gap to turn left where there's no signal. */
  left: 2,
  /** Seconds it costs to turn into a driveway: it's the way into some lots, never a short cut. */
  driveway: 20,
  /** Seconds to turn round where a road ends. */
  turnRound: 6,
  /** How far a point looks for a road to be on, and a door for pavement, in metres. */
  reach: 70,
  /** A door takes the street it faces unless other pavement is this much nearer, in metres. */
  preferFaced: 12,
} as const;

/** A signal's loop, the share of it a street isn't green, and the average wait when it isn't. */
const LOOP = (TURN.green + TURN.yellow + TURN.clear) * 2;
const RED = LOOP - TURN.green;
const RED_SHARE = RED / LOOP;

/** Roads a route never starts or ends on for a door: you don't park on them. */
const NO_PARKING: ReadonlySet<RoadKind> = new Set(['driveway', 'link', 'motorway']);

const NO_STOP = 0;
const SIGN = 1;
const YIELD = 2;
const SIGNAL = 3;

/** A place on a road: where a route starts or ends. */
export interface Spot {
  road: number;
  /** The point of the road's line it comes after. */
  seg: number;
  /** Metres along the road's line. */
  s: number;
  x: number;
  y: number;
}

export interface Route {
  /** The drive time, in seconds. */
  seconds: number;
  metres: number;
  /** The way, as x, y, x, y… in metres, from the start to the end. */
  line: number[];
  /** Which road each point of the line is on, as an index into the zone's roads. */
  roads: number[];
  /** The named streets it takes, in order. */
  streets: string[];
}

/**
 * The road graph. A stretch is one road between two neighbouring junctions, in one direction; a
 * two-way road has a stretch each way.
 */
interface Graph {
  count: number;
  road: Int32Array;
  /** The road's points a stretch starts and ends at. */
  a: Int32Array;
  b: Int32Array;
  from: Int32Array;
  to: Int32Array;
  /** Its speed in m/s, and its time in seconds. */
  speed: Float64Array;
  secs: Float64Array;
  /** Compass headings: leaving its first junction, and arriving at its last. */
  headOut: Float64Array;
  headIn: Float64Array;
  /** What it meets at its last junction. */
  stop: Uint8Array;
  driveway: Uint8Array;
  /** The stretches that leave each junction. */
  out: number[][];
  /** Per road: the points that are junctions, and the stretch each pair bounds, each way. */
  stops: number[][];
  forward: number[][];
  backward: number[][];
  /** Per road: metres along the line at each point. */
  along: Float64Array[];
  /** Junctions you can drive to from the middle of the zone and back from. */
  main: Uint8Array;
  /** Every segment that's part of a stretch, by its number in `segRoad` and `segPoint`. */
  grid: SegGrid;
  segRoad: number[];
  segPoint: number[];
  /** The fastest limit in the zone, in m/s: nothing gets anywhere faster. */
  fastest: number;
  // The search's own working space, reused between routes.
  cost: Float64Array;
  prev: Int32Array;
  seen: Uint32Array;
  run: number;
}

const turnTo = (from: number, to: number): number =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));

function build(zone: Zone): Graph {
  const { roads, junctions } = zone;
  const control = controlOf(zone);
  const road: number[] = [];
  const a: number[] = [];
  const b: number[] = [];
  const from: number[] = [];
  const to: number[] = [];
  const out: number[][] = junctions.map(() => []);
  const stops: number[][] = [];
  const forward: number[][] = [];
  const backward: number[][] = [];
  const along: Float64Array[] = [];
  const grid = new SegGrid(96);
  const segRoad: number[] = [];
  const segPoint: number[] = [];

  roads.forEach((line, r) => {
    const n = line.nodes.length;
    const at = new Float64Array(n);
    for (let i = 1; i < n; i++)
      at[i] =
        at[i - 1]! +
        Math.hypot(
          line.pts[i * 2]! - line.pts[i * 2 - 2]!,
          line.pts[i * 2 + 1]! - line.pts[i * 2 - 1]!,
        );
    along.push(at);
    const joints: number[] = [];
    line.nodes.forEach((j, i) => {
      if (j >= 0) joints.push(i);
    });
    const fwd: number[] = [];
    const bwd: number[] = [];
    for (let k = 0; k + 1 < joints.length; k++) {
      const p = joints[k]!;
      const q = joints[k + 1]!;
      const add = (i0: number, i1: number): number => {
        const e = road.length;
        road.push(r);
        a.push(i0);
        b.push(i1);
        from.push(line.nodes[i0]!);
        to.push(line.nodes[i1]!);
        out[line.nodes[i0]!]!.push(e);
        return e;
      };
      fwd.push(add(p, q));
      bwd.push(line.oneway ? -1 : add(q, p));
      for (let i = p; i < q; i++) {
        grid.add(
          line.pts[i * 2]!,
          line.pts[i * 2 + 1]!,
          line.pts[i * 2 + 2]!,
          line.pts[i * 2 + 3]!,
          segRoad.length,
        );
        segRoad.push(r);
        segPoint.push(i);
      }
    }
    stops.push(joints);
    forward.push(fwd);
    backward.push(bwd);
  });

  const count = road.length;
  const speed = new Float64Array(count);
  const secs = new Float64Array(count);
  const headOut = new Float64Array(count);
  const headIn = new Float64Array(count);
  const stop = new Uint8Array(count);
  const driveway = new Uint8Array(count);
  let fastest = 1;
  for (let e = 0; e < count; e++) {
    const line = roads[road[e]!]!;
    const d = b[e]! > a[e]! ? 1 : -1;
    const at = along[road[e]!]!;
    speed[e] = Math.max(5, line.mph) * MPH;
    fastest = Math.max(fastest, speed[e]!);
    secs[e] = Math.abs(at[b[e]!]! - at[a[e]!]!) / speed[e]!;
    const heading = (i: number, j: number) =>
      Math.atan2(line.pts[j * 2]! - line.pts[i * 2]!, line.pts[j * 2 + 1]! - line.pts[i * 2 + 1]!);
    headOut[e] = heading(a[e]!, a[e]! + d);
    headIn[e] = heading(b[e]! - d, b[e]!);
    driveway[e] = line.kind === 'driveway' ? 1 : 0;
    // What it meets where it arrives: the arm of the intersection that points back along it.
    const j = to[e]!;
    const arms = control.arms[j]!;
    const arm = arms.find((m) => m.road === road[e] && m.k === b[e] && m.d === -d);
    if (junctions[j]!.signal) {
      // A big intersection is drawn as several signals a few metres apart: wait at the first only.
      const same = control.signal[from[e]!] === control.signal[j] && junctions[from[e]!]!.signal;
      stop[e] = same ? NO_STOP : SIGNAL;
    } else if (arm) stop[e] = arm.stop === 'sign' ? SIGN : arm.stop === 'yield' ? YIELD : NO_STOP;
    // A lot or a lane coming out onto a street stops for it.
    else if (PRIORITY[line.kind] === undefined && arms.length) stop[e] = SIGN;
  }

  // The part of the map you can drive to and back from, starting at the middle of the zone.
  const reach = (seed: number, next: (j: number, visit: (k: number) => void) => void) => {
    const got = new Uint8Array(junctions.length);
    got[seed] = 1;
    const queue = [seed];
    for (let i = 0; i < queue.length; i++)
      next(queue[i]!, (k) => {
        if (got[k]) return;
        got[k] = 1;
        queue.push(k);
      });
    return got;
  };
  const into: number[][] = junctions.map(() => []);
  for (let e = 0; e < count; e++) into[to[e]!]!.push(e);
  // Start from the junction of the most streets nearest the store: never a stray lane.
  let seed = 0;
  let least = Infinity;
  junctions.forEach((junction, j) => {
    if (out[j]!.length < 3) return;
    const d = Math.hypot(junction.x, junction.y);
    if (d < least) {
      least = d;
      seed = j;
    }
  });
  const there = reach(seed, (j, visit) => out[j]!.forEach((e) => visit(to[e]!)));
  const back = reach(seed, (j, visit) => into[j]!.forEach((e) => visit(from[e]!)));
  const main = new Uint8Array(junctions.length);
  for (let j = 0; j < main.length; j++) main[j] = there[j]! & back[j]!;

  return {
    count,
    road: Int32Array.from(road),
    a: Int32Array.from(a),
    b: Int32Array.from(b),
    from: Int32Array.from(from),
    to: Int32Array.from(to),
    speed,
    secs,
    headOut,
    headIn,
    stop,
    driveway,
    out,
    stops,
    forward,
    backward,
    along,
    main,
    grid,
    segRoad,
    segPoint,
    fastest,
    cost: new Float64Array(count),
    prev: new Int32Array(count),
    seen: new Uint32Array(count),
    run: 0,
  };
}

const built = new WeakMap<Zone, Graph>();

function graphOf(zone: Zone): Graph {
  let graph = built.get(zone);
  if (!graph) {
    graph = build(zone);
    built.set(zone, graph);
  }
  return graph;
}

/** How many stretches of road the zone's graph has, each way counted once. */
export function stretches(zone: Zone): number {
  return graphOf(zone).count;
}

/** Which pair of a road's junctions a point index lies between. */
function stretchAt(g: Graph, road: number, seg: number): number {
  const joints = g.stops[road]!;
  let k = 0;
  while (k + 2 < joints.length && joints[k + 1]! <= seg) k++;
  return k;
}

/**
 * The nearest place on a road to a point, within `reach` metres, or null. Only roads you can
 * drive to and back from count; `accept` can rule out kinds of road.
 */
export function spotNear(
  zone: Zone,
  x: number,
  y: number,
  reach: number = PACE.reach,
  accept?: (road: number) => boolean,
): Spot | null {
  const g = graphOf(zone);
  const near = g.grid.nearest(x, y, reach, (id) => {
    const r = g.segRoad[id]!;
    if (accept && !accept(r)) return false;
    const e = g.forward[r]![stretchAt(g, r, g.segPoint[id]!)]!;
    return g.main[g.from[e]!] === 1 && g.main[g.to[e]!] === 1;
  });
  if (!near) return null;
  const road = g.segRoad[near.id]!;
  const seg = g.segPoint[near.id]!;
  const pts = zone.roads[road]!.pts;
  return {
    road,
    seg,
    s: g.along[road]![seg]! + Math.hypot(near.x - pts[seg * 2]!, near.y - pts[seg * 2 + 1]!),
    x: near.x,
    y: near.y,
  };
}

const ringOf = (pts: readonly number[]): Array<[number, number]> => {
  const out: Array<[number, number]> = [];
  for (let i = 0; i < pts.length; i += 2) out.push([pts[i]!, pts[i + 1]!]);
  return out;
};

/** A building's front door: the middle of the wall that faces its street. */
export function doorAt(zone: Zone, building: Building): [number, number] {
  const ring = ringOf(building.pts);
  let cx = 0;
  let cy = 0;
  for (const p of ring) {
    cx += p[0] / ring.length;
    cy += p[1] / ring.length;
  }
  const faced = zone.roads[building.faces];
  const near = faced ? nearestOnRoad(faced, cx, cy) : null;
  const door = doorOf(
    ring,
    near && near.d >= 0.5 ? [(near.x - cx) / near.d, (near.y - cy) / near.d] : null,
  );
  return [door[0], door[1]];
}

/**
 * Where you pull up for a door: the nearest pavement to it that isn't a private driveway, a ramp
 * or the freeway. The street the building faces wins unless a lot or a lane is clearly nearer;
 * failing all that, it's the nearest point of the address's own street.
 */
export function doorSpot(zone: Zone, building: Building): Spot | null {
  const [x, y] = doorAt(zone, building);
  const park = (r: number) => !NO_PARKING.has(zone.roads[r]!.kind);
  const near = spotNear(zone, x, y, PACE.reach, park);
  if (building.faces >= 0 && park(building.faces)) {
    const faced = spotNear(zone, x, y, PACE.reach, (r) => r === building.faces);
    if (
      faced &&
      (!near || Math.hypot(faced.x - x, faced.y - y) <= dist(near, x, y) + PACE.preferFaced)
    )
      return faced;
  }
  if (near) return near;
  if (building.street < 0) return null;
  return spotNear(zone, x, y, 400, (r) => r === building.street);
}

const dist = (spot: Spot, x: number, y: number): number => Math.hypot(spot.x - x, spot.y - y);

/** Seconds lost slowing from `v` to `slow` and getting back up to `w`, against holding speed. */
function lost(v: number, w: number, slow: number): number {
  return (
    (v > slow ? (v - slow) ** 2 / (2 * PACE.brake * v) : 0) +
    (w > slow ? (w - slow) ** 2 / (2 * PACE.pull * w) : 0)
  );
}

/** What going from stretch `p` onto stretch `f` costs at the junction between, in seconds. */
function crossing(g: Graph, p: number, f: number): number {
  const j = g.to[p]!;
  // Back the way you came: only where the road ends.
  if (g.road[f] === g.road[p] && g.a[f] === g.b[p] && g.b[f] === g.a[p])
    return g.out[j]!.length > 1 ? Infinity : PACE.turnRound;
  const v = g.speed[p]!;
  const w = g.speed[f]!;
  const angle = turnTo(g.headIn[p]!, g.headOut[f]!);
  const bend = Math.abs(angle);
  const turn =
    bend < PACE.straight
      ? 0
      : lost(v, w, Math.max(PACE.hairpin, PACE.corner * Math.min(2, Math.PI / 2 / bend)));
  const halt = lost(v, w, 0);
  const stop = g.stop[p]!;
  let cost: number;
  if (stop === SIGN) cost = halt + PACE.look;
  else if (stop === YIELD) cost = Math.max(halt / 2, turn);
  else if (stop === SIGNAL) cost = RED_SHARE * (halt + RED / 2) + (1 - RED_SHARE) * turn;
  else cost = turn;
  // A left across the other lane waits for a gap, unless a signal gives it a turn.
  if (angle < -Math.PI / 4 && stop !== SIGNAL && g.out[j]!.length >= 3) cost += PACE.left;
  if (g.driveway[f] && !g.driveway[p]) cost += PACE.driveway;
  return cost;
}

/** The two ways along the stretch a spot is on: with the road's line, and against it (or -1). */
function ways(g: Graph, spot: Spot): [number, number] {
  const k = stretchAt(g, spot.road, spot.seg);
  return [g.forward[spot.road]![k]!, g.backward[spot.road]![k]!];
}

/** A small heap of stretches, cheapest first. */
class Heap {
  private readonly keys: number[] = [];
  private readonly ids: number[] = [];

  get size(): number {
    return this.ids.length;
  }

  push(key: number, id: number): void {
    const { keys, ids } = this;
    let i = ids.length;
    keys.push(key);
    ids.push(id);
    while (i > 0) {
      const up = (i - 1) >> 1;
      if (keys[up]! <= key) break;
      keys[i] = keys[up]!;
      ids[i] = ids[up]!;
      i = up;
    }
    keys[i] = key;
    ids[i] = id;
  }

  /** The cheapest key, without taking it. */
  get least(): number {
    return this.keys[0]!;
  }

  pop(): number {
    const { keys, ids } = this;
    const top = ids[0]!;
    const key = keys.pop()!;
    const id = ids.pop()!;
    const n = ids.length;
    if (n) {
      let i = 0;
      for (;;) {
        let down = i * 2 + 1;
        if (down >= n) break;
        if (down + 1 < n && keys[down + 1]! < keys[down]!) down++;
        if (keys[down]! >= key) break;
        keys[i] = keys[down]!;
        ids[i] = ids[down]!;
        i = down;
      }
      keys[i] = key;
      ids[i] = id;
    }
    return top;
  }
}

export interface RouteOptions {
  /**
   * False searches without the straight-line guess (plain Dijkstra): slower, the same answer.
   * It's there so a test can hold the two together.
   */
  guess?: boolean;
}

/**
 * The quickest drive from one spot to another, or null when there's no way. A\* over stretches of
 * road, so that a turn or a stop can cost time; the guess for what's left is the straight line at
 * the zone's fastest limit, which is never too much.
 */
export function route(zone: Zone, from: Spot, to: Spot, options: RouteOptions = {}): Route | null {
  const g = graphOf(zone);
  const guess = options.guess === false ? 0 : 1 / g.fastest;
  const { cost, prev, seen } = g;
  const run = ++g.run;
  const heap = new Heap();
  const left = (e: number) => {
    const j = zone.junctions[g.to[e]!]!;
    return Math.hypot(j.x - to.x, j.y - to.y) * guess;
  };
  const goals = ways(g, to);
  const toAlong = g.along[to.road]!;
  /** Seconds from the start of goal stretch `f` to the spot itself. */
  const lastLeg = (f: number) => Math.abs(to.s - toAlong[g.a[f]!]!) / g.speed[f]!;

  // The best way found so far: its time, the stretch it arrives from (-1: none), and the stretch
  // it ends on.
  let best = Infinity;
  let bestFrom = -1;
  let bestOn = -1;

  // Straight there, when both spots are on one stretch and the end is ahead.
  const starts = ways(g, from);
  if (from.road === to.road && starts[0] === goals[0]) {
    const e = to.s >= from.s ? starts[0] : starts[1];
    if (e >= 0) {
      best = Math.abs(to.s - from.s) / g.speed[e]!;
      bestOn = e;
    }
  }
  const fromAlong = g.along[from.road]!;
  for (const e of starts) {
    if (e < 0) continue;
    cost[e] = Math.abs(fromAlong[g.b[e]!]! - from.s) / g.speed[e]!;
    prev[e] = -1;
    seen[e] = run;
    heap.push(cost[e]! + left(e), e);
  }

  while (heap.size && heap.least < best) {
    const key = heap.least;
    const p = heap.pop();
    const sofar = cost[p]!;
    // An older, dearer entry for a stretch since reached more cheaply.
    if (key > sofar + left(p) + 1e-9) continue;
    for (const f of g.out[g.to[p]!]!) {
      const step = crossing(g, p, f);
      if (step === Infinity) continue;
      const at = sofar + step;
      if (f === goals[0] || f === goals[1]) {
        const total = at + lastLeg(f);
        if (total < best) {
          best = total;
          bestFrom = p;
          bestOn = f;
        }
      }
      const reached = at + g.secs[f]!;
      if (seen[f] === run && cost[f]! <= reached) continue;
      cost[f] = reached;
      prev[f] = p;
      seen[f] = run;
      heap.push(reached + left(f), f);
    }
  }
  if (bestOn < 0) return null;

  // Walk the way back to the start, then lay it out forwards.
  const chain: number[] = [];
  for (let e = bestFrom; e >= 0; e = prev[e]!) chain.push(e);
  chain.reverse();
  const line: number[] = [from.x, from.y];
  const roads: number[] = [from.road];
  const streets: string[] = [];
  let metres = 0;
  /** Add the road's points from `i0` to `i1` in the order driven (none when that's backwards). */
  const walk = (r: number, s0: number, s1: number, up: boolean, i0: number, i1: number) => {
    const pts = zone.roads[r]!.pts;
    for (let i = i0; up ? i <= i1 : i >= i1; i += up ? 1 : -1) {
      line.push(pts[i * 2]!, pts[i * 2 + 1]!);
      roads.push(r);
    }
    metres += Math.abs(s1 - s0);
    const name = zone.roads[r]!.name;
    if (name && streets.at(-1) !== name) streets.push(name);
  };
  if (!chain.length) {
    // One stretch, start to end.
    const up = to.s >= from.s;
    walk(from.road, from.s, to.s, up, up ? from.seg + 1 : from.seg, up ? to.seg : to.seg + 1);
  } else {
    chain.forEach((e, n) => {
      const r = g.road[e]!;
      const at = g.along[r]!;
      const up = g.b[e]! > g.a[e]!;
      if (n === 0) walk(r, from.s, at[g.b[e]!]!, up, up ? from.seg + 1 : from.seg, g.b[e]!);
      else walk(r, at[g.a[e]!]!, at[g.b[e]!]!, up, g.a[e]! + (up ? 1 : -1), g.b[e]!);
    });
    const up = g.b[bestOn]! > g.a[bestOn]!;
    const first = g.a[bestOn]! + (up ? 1 : -1);
    walk(to.road, toAlong[g.a[bestOn]!]!, to.s, up, first, up ? to.seg : to.seg + 1);
  }
  line.push(to.x, to.y);
  roads.push(to.road);
  return { seconds: best, metres, line, roads, streets };
}

/**
 * Where a point is against a route's line: how many metres along the line the nearest point of
 * it is, and how far off the line the point is. The GPS reads it for what's left and for
 * noticing you've left the route.
 */
export function alongLine(
  line: readonly number[],
  x: number,
  y: number,
): { along: number; off: number } {
  let along = 0;
  let off = Infinity;
  let run = 0;
  for (let i = 0; i + 3 < line.length; i += 2) {
    const ax = line[i]!;
    const ay = line[i + 1]!;
    const ex = line[i + 2]! - ax;
    const ey = line[i + 3]! - ay;
    const len = Math.hypot(ex, ey);
    const t = len > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / (len * len))) : 0;
    const d = Math.hypot(x - ax - ex * t, y - ay - ey * t);
    if (d < off) {
      off = d;
      along = run + len * t;
    }
    run += len;
  }
  if (off === Infinity) off = Math.hypot(x - (line[0] ?? x), y - (line[1] ?? y));
  return { along, off };
}

/** One drop of a run: which of the doors asked for, and when you pull up, in seconds. */
export interface Drop {
  door: number;
  seconds: number;
}

export interface Run {
  /** The drops in the order that gets everyone their food soonest. */
  drops: Drop[];
  /** Back at the start, in seconds from leaving it. */
  seconds: number;
  metres: number;
  /** What each door would take on its own, straight from the start, in the order asked. */
  alone: number[];
}

/**
 * A run from `start` to every one of `doors` and back, in the best order: the one whose drops
 * wait the least in all, with ties to the shorter run. It gives the numbers for the bundle check
 * (ADR-043): a drop that arrives far later than it would alone isn't really on this run. Time
 * spent at each door isn't counted. Null when any door can't be reached.
 */
export function planRun(zone: Zone, start: Spot, doors: readonly Spot[]): Run | null {
  const n = doors.length;
  const all = [start, ...doors];
  // Every leg's time and length, worked out once.
  const legs: Array<Array<Route | null>> = all.map((a, i) =>
    all.map((b, j) => (i === j ? null : route(zone, a, b))),
  );
  const alone: number[] = [];
  for (let i = 1; i <= n; i++) {
    const leg = legs[0]![i];
    if (!leg || !legs[i]![0]) return null;
    alone.push(leg.seconds);
  }
  let best: Run | null = null;
  let bestWait = Infinity;
  const order: number[] = [];
  const used = new Array<boolean>(n).fill(false);
  const visit = () => {
    if (order.length === n) {
      let at = 0;
      let time = 0;
      let metres = 0;
      let wait = 0;
      const drops: Drop[] = [];
      for (const i of order) {
        const leg = legs[at]![i + 1];
        if (!leg) return;
        time += leg.seconds;
        metres += leg.metres;
        wait += time;
        drops.push({ door: i, seconds: time });
        at = i + 1;
      }
      const home = legs[at]![0];
      if (!home) return;
      const seconds = time + (n ? home.seconds : 0);
      if (
        wait < bestWait - 1e-9 ||
        (Math.abs(wait - bestWait) <= 1e-9 && seconds < best!.seconds)
      ) {
        bestWait = wait;
        best = { drops, seconds, metres: metres + (n ? home.metres : 0), alone };
      }
      return;
    }
    for (let i = 0; i < n; i++) {
      if (used[i]) continue;
      used[i] = true;
      order.push(i);
      visit();
      order.pop();
      used[i] = false;
    }
  };
  if (n === 0) return { drops: [], seconds: 0, metres: 0, alone };
  visit();
  return best;
}
