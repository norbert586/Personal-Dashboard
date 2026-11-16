/**
 * The GPS's path on the ground (SPEC: Delivery mode, GPS): a row of chevrons painted along the
 * route, in your lane and pointing the way, with a ring and a thin beam of light where it ends.
 * It isn't shaded, so it reads at noon and glows at night; the chevrons you've passed go out.
 * One mesh and one draw call for the path, whatever its length.
 */
import {
  BoxGeometry,
  BufferGeometry,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  RingGeometry,
  type Scene,
} from 'three';
import type { Zone } from '../../lib/zone/format.ts';
import { roadWidth } from './roads.ts';
import type { Route } from './route.ts';

/** A chevron every this many metres, and its size: half its span, its reach and its thickness. */
const EVERY = 12;
const SPAN = 1.4;
const REACH = 2.6;
const BACK = 1.2;
const THICK = 1.7;
/** Just above the lane paint. */
const HEIGHT = 0.21;
/** Corners a chevron has: two arms of two triangles each. */
const CORNERS = 12;

export class GpsPath {
  private readonly path: Mesh<BufferGeometry, MeshBasicMaterial>;
  private readonly ring: Mesh;
  private readonly beam: Mesh;
  /** How far along the route each chevron is, in metres. */
  private at: number[] = [];
  private readonly still: boolean;

  constructor(scene: Scene, colour: string, still: boolean) {
    this.still = still;
    const paint = new MeshBasicMaterial({
      color: colour,
      side: DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    this.path = new Mesh(new BufferGeometry(), paint);
    this.path.frustumCulled = false;
    this.ring = new Mesh(new RingGeometry(2.1, 3.1, 24).rotateX(-Math.PI / 2), paint);
    this.beam = new Mesh(
      new BoxGeometry(0.5, 36, 0.5),
      new MeshBasicMaterial({ color: colour, transparent: true, opacity: 0.5, depthWrite: false }),
    );
    for (const mesh of [this.path, this.ring, this.beam]) {
      mesh.visible = false;
      scene.add(mesh);
    }
  }

  /** How many chevrons are painted, for tests and tools. */
  get marks(): number {
    return this.path.visible ? this.at.length : 0;
  }

  /** Paint a route, or pass null to take the path away. */
  show(zone: Zone, way: Route | null, end: { x: number; y: number } | null): void {
    this.path.visible = way !== null;
    this.ring.visible = this.beam.visible = end !== null;
    if (end) {
      this.ring.position.set(end.x, HEIGHT + 0.02, -end.y);
      this.beam.position.set(end.x, 18, -end.y);
    }
    if (!way) return;
    const corners: number[] = [];
    this.at = [];
    const { line, roads } = way;
    let run = 0;
    let next = EVERY / 2;
    for (let i = 0; i + 3 < line.length; i += 2) {
      const ax = line[i]!;
      const ay = line[i + 1]!;
      const ex = line[i + 2]! - ax;
      const ey = line[i + 3]! - ay;
      const len = Math.hypot(ex, ey);
      if (len < 1e-6) continue;
      const fx = ex / len;
      const fy = ey / len;
      // To your right as you drive: your own lane on a two-way road.
      const road = zone.roads[roads[i / 2 + 1]!]!;
      const lane = road.oneway ? 0 : roadWidth(road) / 4;
      const rx = fy;
      const ry = -fx;
      for (; next <= run + len; next += EVERY) {
        const s = next - run;
        const cx = ax + fx * s + rx * lane;
        const cy = ay + fy * s + ry * lane;
        const put = (along: number, across: number) =>
          corners.push(cx + fx * along + rx * across, HEIGHT, -(cy + fy * along + ry * across));
        for (const side of [-1, 1]) {
          // One arm: from the tip back to the wing, as a slanted bar.
          put(REACH, 0);
          put(-BACK, side * SPAN);
          put(-BACK - THICK, side * SPAN);
          put(REACH, 0);
          put(-BACK - THICK, side * SPAN);
          put(REACH - THICK, 0);
        }
        this.at.push(next);
      }
      run += len;
    }
    const shape = this.path.geometry;
    shape.setAttribute('position', new Float32BufferAttribute(corners, 3));
    shape.setDrawRange(0, corners.length / 3);
  }

  /** Put out the chevrons behind you (`along` metres into the route), and beat the ring. */
  sync(along: number, now: number): void {
    if (this.path.visible) {
      let first = 0;
      while (first < this.at.length && this.at[first]! < along + 3) first++;
      this.path.geometry.setDrawRange(first * CORNERS, (this.at.length - first) * CORNERS);
    }
    if (this.ring.visible && !this.still) {
      const beat = 1 + 0.14 * Math.sin(now * 3.2);
      this.ring.scale.set(beat, 1, beat);
    }
  }
}
