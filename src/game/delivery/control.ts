/**
 * Who has to stop where (SPEC: Delivery mode, traffic control): what meets at every intersection,
 * and how each signal's streets are paired up. The signs and signal heads you see are placed from
 * this, and the other cars obey it, so the two always agree. Pure, and worked out once per zone.
 */
import type { RoadKind, Zone } from '../../lib/zone/format.ts';
import { roadWidth } from './roads.ts';
import { lightAt, type Light } from './signals.ts';

/**
 * Who gives way: a road with a lower number stops for one with a higher. Lanes, lots and
 * driveways have none: they aren't part of an intersection.
 */
export const PRIORITY: Partial<Record<RoadKind, number>> = {
  motorway: 8,
  primary: 6,
  secondary: 5,
  tertiary: 4,
  residential: 3,
  link: 2.5,
};

/** One street's way out of an intersection. */
export interface Arm {
  road: number;
  /** Which of the road's points is the intersection. */
  k: number;
  /** 1 leaves along the road's line, -1 against it. */
  d: 1 | -1;
  /** The compass heading out of the intersection: 0 is north, clockwise, in radians. */
  heading: number;
  /** Half the road's width, in metres. */
  half: number;
  /** Whether anyone may drive in along it (the wrong end of a one-way street takes nobody). */
  inbound: boolean;
  /** At a signal: which of its two crossing streets this is. */
  axis: 0 | 1;
  /** What someone driving in along it meets: nothing, a stop sign, a yield sign or the signal. */
  stop: Stop;
}

export type Stop = 'no' | 'sign' | 'yield' | 'signal';

export interface Control {
  /** Every intersection's arms, by junction index. */
  arms: Arm[][];
  /**
   * For a junction with a signal, the signal it keeps time with: signals a few metres apart are
   * one real intersection, and change together. -1 where there's no signal.
   */
  signal: Int32Array;
}

/** Signals this close together are one intersection, in metres. */
const TOGETHER = 40;

const turnTo = (from: number, to: number): number =>
  Math.atan2(Math.sin(to - from), Math.cos(to - from));

function build(zone: Zone): Control {
  const { roads, junctions } = zone;
  const arms: Arm[][] = junctions.map(() => []);
  roads.forEach((road, r) => {
    if (PRIORITY[road.kind] === undefined) return;
    const half = roadWidth(road) / 2;
    road.nodes.forEach((j, k) => {
      if (j < 0) return;
      for (const d of [1, -1] as const) {
        const to = k + d;
        if (to < 0 || to >= road.nodes.length) continue;
        const heading = Math.atan2(
          road.pts[to * 2]! - road.pts[k * 2]!,
          road.pts[to * 2 + 1]! - road.pts[k * 2 + 1]!,
        );
        arms[j]!.push({
          road: r,
          k,
          d,
          heading,
          half,
          inbound: !road.oneway || d < 0,
          axis: 0,
          stop: 'no',
        });
      }
    });
  });
  // A signal's first street is its biggest; whatever crosses that is its second.
  arms.forEach((list, j) => {
    if (!junctions[j]!.signal || !list.length) return;
    const size = (a: Arm) => PRIORITY[roads[a.road]!.kind]! * 100 + a.half;
    const main = list.reduce((a, b) => (size(b) > size(a) ? b : a));
    for (const arm of list) {
      const off = Math.abs(turnTo(main.heading, arm.heading));
      arm.axis = off < Math.PI / 4 || off > (Math.PI * 3) / 4 ? 0 : 1;
    }
  });
  // Stop signs by rule: a smaller road stops for a bigger one, and a road that ends stops for one
  // that runs through. A ramp joins the freeway without stopping.
  arms.forEach((list, j) => {
    let major = 0;
    let through = -1;
    for (const arm of list) {
      const road = roads[arm.road]!;
      const priority = PRIORITY[road.kind]!;
      major = Math.max(major, priority);
      if (arm.k > 0 && arm.k < road.nodes.length - 1) through = Math.max(through, priority);
    }
    for (const arm of list) {
      const road = roads[arm.road]!;
      const mine = PRIORITY[road.kind]!;
      const ends = arm.k === 0 || arm.k === road.nodes.length - 1;
      const ramp = road.kind === 'link' || road.kind === 'motorway';
      if (junctions[j]!.signal) arm.stop = 'signal';
      else if (ramp && major >= 8) arm.stop = 'no';
      else if (mine < major || (ends && through >= mine)) arm.stop = 'sign';
    }
  });
  // Then the signs the map itself marks, which is where all-way stops come from. A sign is a
  // point on its road a little before the intersection, or the intersection's own point.
  const where = new Map<string, Array<[road: number, point: number]>>();
  const key = (x: number, y: number) => `${Math.round(x * 10)},${Math.round(y * 10)}`;
  roads.forEach((road, r) => {
    if (PRIORITY[road.kind] === undefined) return;
    for (let i = 0; i < road.nodes.length; i++) {
      const k = key(road.pts[i * 2]!, road.pts[i * 2 + 1]!);
      const list = where.get(k);
      if (list) list.push([r, i]);
      else where.set(k, [[r, i]]);
    }
  });
  for (const spot of zone.spots) {
    if (spot.kind !== 'stop' && spot.kind !== 'yield') continue;
    const stop: Stop = spot.kind === 'stop' ? 'sign' : 'yield';
    for (const [r, i] of where.get(key(spot.x, spot.y)) ?? []) {
      const { nodes, pts } = roads[r]!;
      const mark = (j: number, k: number, d: 1 | -1 | 0) => {
        for (const arm of arms[j]!)
          if (
            arm.stop !== 'signal' &&
            arm.inbound &&
            (d === 0 || (arm.road === r && arm.k === k && arm.d === d))
          )
            arm.stop = stop;
      };
      if (nodes[i]! >= 0) {
        mark(nodes[i]!, i, 0);
        continue;
      }
      // The nearer intersection along the road, within a short block, is the one it's for.
      let best: [number, number, 1 | -1] | null = null;
      let nearest = 60;
      for (const d of [1, -1] as const) {
        let far = 0;
        for (let k = i + d; k >= 0 && k < nodes.length && far < nearest; k += d) {
          far += Math.hypot(
            pts[k * 2]! - pts[(k - d) * 2]!,
            pts[k * 2 + 1]! - pts[(k - d) * 2 + 1]!,
          );
          if (nodes[k]! < 0) continue;
          if (far < nearest) {
            nearest = far;
            // The arm points from the intersection back toward the sign.
            best = [nodes[k]!, k, -d as 1 | -1];
          }
          break;
        }
      }
      if (best) mark(...best);
    }
  }
  const signal = new Int32Array(junctions.length).fill(-1);
  const lit: number[] = [];
  junctions.forEach((junction, j) => {
    if (!junction.signal) return;
    const lead = lit.find(
      (i) => Math.hypot(junctions[i]!.x - junction.x, junctions[i]!.y - junction.y) < TOGETHER,
    );
    signal[j] = signal[lead ?? j] === -1 ? j : signal[lead!]!;
    lit.push(j);
  });
  return { arms, signal };
}

const built = new WeakMap<Zone, Control>();

/** The zone's traffic control, worked out the first time it's asked for. */
export function controlOf(zone: Zone): Control {
  let control = built.get(zone);
  if (!control) {
    control = build(zone);
    built.set(zone, control);
  }
  return control;
}

/** The arm someone travelling on `heading` comes in along: the one that points back at them. */
export function armFor(control: Control, junction: number, heading: number): Arm | null {
  let best: Arm | null = null;
  let least = Infinity;
  for (const arm of control.arms[junction] ?? []) {
    const off = Math.abs(turnTo(heading + Math.PI, arm.heading));
    if (off < least) {
      least = off;
      best = arm;
    }
  }
  return best;
}

/** What the signal at a junction shows someone arriving on `heading`, at `time` seconds. */
export function lightFor(control: Control, junction: number, heading: number, time: number): Light {
  const arm = armFor(control, junction, heading);
  return lightAt(arm?.axis ?? 0, control.signal[junction]!, time);
}
