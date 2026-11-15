/**
 * Streets as geometry (DESIGN: Delivery mode): a ribbon for every road at its real width, round
 * pads where roads end at one another, centre and lane lines that stop short of intersections,
 * sidewalks and trails from the mapped footways, and bars for crosswalks. Everything is sorted
 * into chunks once, so the world can build a chunk at a time.
 */
import type { Road, RoadKind, Zone } from '../../lib/zone/format.ts';
import type { MeshBuilder } from './mesh.ts';
import { chunkKey, chunkOf, points, type P3, type Tint, type XY } from './space.ts';
import { T } from './tiles.ts';

/** How wide a road is drawn, edge to edge, in metres. */
export function roadWidth(road: Pick<Road, 'kind' | 'lanes' | 'oneway'>): number {
  switch (road.kind) {
    case 'motorway':
      return road.lanes * 3.7 + 4.5;
    case 'link':
      return road.lanes * 3.8 + 2.4;
    case 'primary':
    case 'secondary':
    case 'tertiary':
      return road.lanes * 3.4 + 1;
    case 'residential':
      return Math.max(road.oneway ? 5.6 : 8.2, road.lanes * 3.3);
    case 'service':
      return road.oneway ? 4.6 : 6.4;
    case 'aisle':
      return road.oneway ? 4.6 : 6.8;
    case 'driveway':
      return 3.4;
  }
}

const RANK: Record<RoadKind, number> = {
  driveway: 0,
  aisle: 1,
  service: 2,
  residential: 3,
  tertiary: 4,
  secondary: 5,
  primary: 6,
  link: 7,
  motorway: 8,
};
/** Busier roads lie a hair above quieter ones, so where they overlap the busier one shows. */
export const roadHeight = (kind: RoadKind): number => 0.07 + RANK[kind] * 0.01;
const PATH_HEIGHT = 0.055;
const MARK_HEIGHT = 0.18;
const LANE = 3.4;

const ASPHALT: Tint = [1, 1, 1];
const LOT: Tint = [1.16, 1.16, 1.15];
const CONCRETE: Tint = [0.96, 0.96, 0.95];
const YELLOW: Tint = [0.95, 0.76, 0.2];
const WHITE: Tint = [0.95, 0.95, 0.92];

function surface(road: Road): { layer: number; tint: Tint } {
  // Driveways here are nearly all concrete, whatever the map leaves unsaid.
  if (road.concrete || road.kind === 'driveway') return { layer: T.slab, tint: CONCRETE };
  return { layer: T.asphalt, tint: RANK[road.kind] <= RANK.service ? LOT : ASPHALT };
}

/** A line shifted sideways: `left` metres to the left of its direction, with mitred corners. */
export function shifted(line: readonly XY[], left: number): XY[] {
  const n = line.length;
  const out: XY[] = [];
  for (let i = 0; i < n; i++) {
    const a = line[Math.max(0, i - 1)]!;
    const b = line[i]!;
    const c = line[Math.min(n - 1, i + 1)]!;
    let ix = b[0] - a[0];
    let iy = b[1] - a[1];
    let ox = c[0] - b[0];
    let oy = c[1] - b[1];
    const il = Math.hypot(ix, iy);
    const ol = Math.hypot(ox, oy);
    if (il > 1e-6) {
      ix /= il;
      iy /= il;
    }
    if (ol > 1e-6) {
      ox /= ol;
      oy /= ol;
    }
    // At either end of the line there's only one direction to go by.
    if (il <= 1e-6) {
      ix = ox;
      iy = oy;
    }
    if (ol <= 1e-6) {
      ox = ix;
      oy = iy;
    }
    // The corner's normal is the average of the two sides' normals, stretched to keep the width.
    let nx = -(iy + oy);
    let ny = ix + ox;
    const nl = Math.hypot(nx, ny);
    if (nl < 1e-6) {
      nx = -iy;
      ny = ix;
    } else {
      nx /= nl;
      ny /= nl;
    }
    const stretch = Math.min(2.5, 1 / Math.max(0.4, nx * -iy + ny * ix));
    out.push([b[0] + nx * left * stretch, b[1] + ny * left * stretch]);
  }
  return out;
}

/** A line with distances along it, for cutting out stretches. */
class Run {
  readonly pts: XY[];
  readonly at: number[] = [0];

  constructor(pts: XY[]) {
    this.pts = pts;
    for (let i = 1; i < pts.length; i++)
      this.at.push(
        this.at[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]),
      );
  }

  get length(): number {
    return this.at.at(-1)!;
  }

  private point(s: number, i: number): XY {
    const a = this.pts[i]!;
    const b = this.pts[i + 1]!;
    const span = this.at[i + 1]! - this.at[i]!;
    const t = span > 0 ? (s - this.at[i]!) / span : 0;
    return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
  }

  /** The stretch from s0 to s1 metres along, corners included. */
  slice(s0: number, s1: number): XY[] {
    const out: XY[] = [];
    let i = 0;
    while (i < this.pts.length - 2 && this.at[i + 1]! <= s0) i++;
    out.push(this.point(s0, i));
    while (i < this.pts.length - 2 && this.at[i + 1]! < s1) {
      i++;
      out.push(this.pts[i]!);
    }
    out.push(this.point(s1, i));
    return out;
  }
}

/** A painted line: a short stretch of road paint, with its width and colour. */
interface Mark {
  pts: XY[];
  width: number;
  tint: Tint;
}

interface Pad {
  x: number;
  y: number;
  r: number;
  h: number;
  layer: number;
  tint: Tint;
}

interface ChunkRoads {
  /** Road index and segment index, in pairs. */
  segs: number[];
  /** Path index and segment index, in pairs. */
  paths: number[];
  pads: Pad[];
  marks: Mark[];
  /** Crosswalk bars: four corners each. */
  bars: XY[][];
}

const at = (p: XY, h: number): P3 => [p[0], p[1], h];

export class Roads {
  readonly zone: Zone;
  private readonly chunks = new Map<number, ChunkRoads>();
  private readonly edges = new Map<number, { left: XY[]; right: XY[] }>();
  private readonly pathEdges = new Map<number, { left: XY[]; right: XY[] }>();

  constructor(zone: Zone) {
    this.zone = zone;
    this.sortRoads();
    this.sortPaths();
  }

  private chunk(x: number, y: number): ChunkRoads {
    const key = chunkKey(chunkOf(x), chunkOf(y));
    let c = this.chunks.get(key);
    if (!c) {
      c = { segs: [], paths: [], pads: [], marks: [], bars: [] };
      this.chunks.set(key, c);
    }
    return c;
  }

  private sortRoads(): void {
    const { roads, junctions, spots } = this.zone;
    // What meets at each junction: how many arms, how many of them streets, and the widest road.
    const arms = new Uint8Array(junctions.length);
    const streets = new Uint8Array(junctions.length);
    const through = new Uint8Array(junctions.length);
    const widest = new Int32Array(junctions.length).fill(-1);
    const headings: number[][] = junctions.map(() => []);
    roads.forEach((road, r) => {
      const last = road.nodes.length - 1;
      road.nodes.forEach((j, i) => {
        if (j < 0) return;
        const n = i === 0 || i === last ? 1 : 2;
        arms[j]! += n;
        if (RANK[road.kind] >= RANK.residential) streets[j]! += n;
        if (n === 2) through[j] = 1;
        if (widest[j]! < 0 || roadWidth(road) > roadWidth(roads[widest[j]!]!)) widest[j] = r;
        if (n === 1) {
          const k = i === 0 ? 1 : last - 1;
          headings[j]!.push(
            Math.atan2(
              road.pts[k * 2 + 1]! - road.pts[i * 2 + 1]!,
              road.pts[k * 2]! - road.pts[i * 2]!,
            ),
          );
        }
      });
    });
    const bulbs = new Set(
      spots.filter((s) => s.kind === 'turn').map((s) => `${s.x.toFixed(0)},${s.y.toFixed(0)}`),
    );
    const padRadius = new Float32Array(junctions.length);
    junctions.forEach((junction, j) => {
      const road = roads[widest[j]!];
      if (!road) return;
      const half = roadWidth(road) / 2;
      const bulb = bulbs.has(`${junction.x.toFixed(0)},${junction.y.toFixed(0)}`);
      // Two roads end to end need a pad only where the street bends between them.
      const [h0, h1] = headings[j]!;
      const bend =
        arms[j] === 2 && h0 !== undefined && h1 !== undefined
          ? Math.abs(Math.PI - Math.abs(((h0 - h1 + Math.PI * 3) % (Math.PI * 2)) - Math.PI))
          : 0;
      const r = bulb ? Math.max(11, half * 1.6) : arms[j]! >= 3 ? half * 1.1 : half;
      padRadius[j] = r;
      // A road running straight through already covers the joint.
      if (through[j] && !bulb) return;
      if (arms[j] === 2 && bend < 0.2) return;
      const { layer, tint } = surface(road);
      this.chunk(junction.x, junction.y).pads.push({
        x: junction.x,
        y: junction.y,
        r,
        h: roadHeight(road.kind) + 0.004,
        layer,
        tint,
      });
    });

    roads.forEach((road, r) => {
      for (let i = 0; i + 3 < road.pts.length; i += 2) {
        const c = this.chunk(
          (road.pts[i]! + road.pts[i + 2]!) / 2,
          (road.pts[i + 1]! + road.pts[i + 3]!) / 2,
        );
        c.segs.push(r, i / 2);
      }
      this.paint(road, streets, padRadius);
    });
  }

  /** Lay out a road's painted lines, leaving gaps at real intersections. */
  private paint(road: Road, streets: Uint8Array, padRadius: Float32Array): void {
    const main = RANK[road.kind] >= RANK.tertiary && road.kind !== 'link';
    if (!main || road.lanes < 2) return;
    const lines: Array<{ left: number; dash: boolean; tint: Tint; width: number }> = [];
    if (road.oneway) {
      // Lanes all going one way: dashes between them, and edge lines on the freeway.
      for (let k = 1; k < road.lanes; k++)
        lines.push({ left: (k - road.lanes / 2) * LANE, dash: true, tint: WHITE, width: 0.16 });
      if (road.kind === 'motorway') {
        const edge = (road.lanes / 2) * LANE + 0.3;
        lines.push({ left: edge, dash: false, tint: YELLOW, width: 0.16 });
        lines.push({ left: -edge, dash: false, tint: WHITE, width: 0.16 });
      }
    } else {
      // An odd count means a shared turn lane down the middle, with a yellow line each side.
      const turnLane = road.lanes % 2 === 1 && road.lanes >= 3;
      const inner = turnLane ? LANE / 2 : 0;
      if (turnLane)
        for (const side of [-1, 1])
          lines.push({ left: side * inner, dash: false, tint: YELLOW, width: 0.16 });
      else lines.push({ left: 0, dash: false, tint: YELLOW, width: 0.3 });
      const perSide = Math.floor(road.lanes / 2);
      for (let k = 1; k < perSide; k++)
        for (const side of [-1, 1])
          lines.push({ left: side * (inner + k * LANE), dash: true, tint: WHITE, width: 0.16 });
    }
    const run = new Run(points(road.pts));
    // Where the paint goes: the whole road, less a gap at each street intersection.
    let keep: Array<[number, number]> = [[0, run.length]];
    road.nodes.forEach((j, i) => {
      if (j < 0 || streets[j]! < 3) return;
      const gap = padRadius[j]! + 1.5;
      const s = run.at[i]!;
      keep = keep.flatMap(([a, b]): Array<[number, number]> => {
        if (s + gap <= a || s - gap >= b) return [[a, b]];
        const out: Array<[number, number]> = [];
        if (s - gap > a) out.push([a, s - gap]);
        if (s + gap < b) out.push([s + gap, b]);
        return out;
      });
    });
    for (const [a, b] of keep) {
      for (const line of lines) {
        // A few metres of road between two intersections gets no stray dash.
        if (b - a < (line.dash ? 24 : 6)) continue;
        // Solid lines are cut into pieces so each can sit in the chunk it's in; dashes are 3 m in 12.
        const step = line.dash ? 12 : 40;
        const on = line.dash ? 3 : 40;
        for (let s = a; s < b; s += step) {
          const end = Math.min(b, s + on);
          if (end - s < 0.5) continue;
          const pts = shifted(run.slice(s, end), line.left);
          this.chunk(pts[0]![0], pts[0]![1]).marks.push({
            pts,
            width: line.width,
            tint: line.tint,
          });
        }
      }
    }
  }

  private sortPaths(): void {
    this.zone.paths.forEach((path, p) => {
      if (path.kind === 'crossing') {
        // A bar every 1.2 m along the crossing, 2.6 m wide.
        const run = new Run(points(path.pts));
        for (let s = 0.6; s < run.length - 0.3; s += 1.2) {
          const [a, b] = run.slice(s - 0.3, s + 0.3) as [XY, XY];
          const len = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
          const nx = (-(b[1] - a[1]) / len) * 1.3;
          const ny = ((b[0] - a[0]) / len) * 1.3;
          this.chunk(a[0], a[1]).bars.push([
            [a[0] - nx, a[1] - ny],
            [b[0] - nx, b[1] - ny],
            [b[0] + nx, b[1] + ny],
            [a[0] + nx, a[1] + ny],
          ]);
        }
        return;
      }
      for (let i = 0; i + 3 < path.pts.length; i += 2)
        this.chunk(
          (path.pts[i]! + path.pts[i + 2]!) / 2,
          (path.pts[i + 1]! + path.pts[i + 3]!) / 2,
        ).paths.push(p, i / 2);
    });
  }

  private roadEdges(r: number): { left: XY[]; right: XY[] } {
    let e = this.edges.get(r);
    if (!e) {
      const road = this.zone.roads[r]!;
      const line = points(road.pts);
      const half = roadWidth(road) / 2;
      e = { left: shifted(line, half), right: shifted(line, -half) };
      this.edges.set(r, e);
    }
    return e;
  }

  private walkEdges(p: number): { left: XY[]; right: XY[] } {
    let e = this.pathEdges.get(p);
    if (!e) {
      const path = this.zone.paths[p]!;
      const line = points(path.pts);
      const half = path.kind === 'trail' ? 1.4 : 0.8;
      e = { left: shifted(line, half), right: shifted(line, -half) };
      this.pathEdges.set(p, e);
    }
    return e;
  }

  /** Add one chunk's streets to `ground` and its paint to `marks`. */
  emit(key: number, ground: MeshBuilder, marks: MeshBuilder): void {
    const c = this.chunks.get(key);
    if (!c) return;
    for (let k = 0; k < c.paths.length; k += 2) {
      const { left, right } = this.walkEdges(c.paths[k]!);
      const i = c.paths[k + 1]!;
      const trail = this.zone.paths[c.paths[k]!]!.kind === 'trail';
      ground.flatQuad(
        at(left[i]!, PATH_HEIGHT),
        at(right[i]!, PATH_HEIGHT),
        at(right[i + 1]!, PATH_HEIGHT),
        at(left[i + 1]!, PATH_HEIGHT),
        T.walk,
        trail ? [0.9, 0.9, 0.89] : [1, 1, 1],
      );
    }
    for (let k = 0; k < c.segs.length; k += 2) {
      const road = this.zone.roads[c.segs[k]!]!;
      const { left, right } = this.roadEdges(c.segs[k]!);
      const i = c.segs[k + 1]!;
      const h = roadHeight(road.kind);
      const { layer, tint } = surface(road);
      ground.flatQuad(
        at(left[i]!, h),
        at(right[i]!, h),
        at(right[i + 1]!, h),
        at(left[i + 1]!, h),
        layer,
        tint,
      );
    }
    for (const pad of c.pads) {
      const SIDES = 14;
      const centre: P3 = [pad.x, pad.y, pad.h];
      for (let s = 0; s < SIDES; s++) {
        const a0 = (s / SIDES) * Math.PI * 2;
        const a1 = ((s + 1) / SIDES) * Math.PI * 2;
        ground.flat(
          centre,
          [pad.x + Math.cos(a0) * pad.r, pad.y + Math.sin(a0) * pad.r, pad.h],
          [pad.x + Math.cos(a1) * pad.r, pad.y + Math.sin(a1) * pad.r, pad.h],
          pad.layer,
          pad.tint,
        );
      }
    }
    for (const mark of c.marks) {
      const left = shifted(mark.pts, mark.width / 2);
      const right = shifted(mark.pts, -mark.width / 2);
      for (let i = 0; i + 1 < mark.pts.length; i++)
        marks.flatQuad(
          at(left[i]!, MARK_HEIGHT),
          at(right[i]!, MARK_HEIGHT),
          at(right[i + 1]!, MARK_HEIGHT),
          at(left[i + 1]!, MARK_HEIGHT),
          T.paint,
          mark.tint,
        );
    }
    for (const bar of c.bars)
      marks.flatQuad(
        at(bar[0]!, MARK_HEIGHT),
        at(bar[1]!, MARK_HEIGHT),
        at(bar[2]!, MARK_HEIGHT),
        at(bar[3]!, MARK_HEIGHT),
        T.paint,
        WHITE,
      );
  }
}
