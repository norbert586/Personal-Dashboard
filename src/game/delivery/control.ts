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
}

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
        arms[j]!.push({ road: r, k, d, heading, half, inbound: !road.oneway || d < 0, axis: 0 });
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
