/**
 * The delivery zone as a world you can drive through (ADR-035). It's far too big to draw at once
 * on a phone, so it's built in squares around you, a few a frame, and dropped behind you; fog hides
 * the edge. Each square is three meshes: the ground with its buildings and trees, the streets, and
 * the paint on them. Water, parks and lots are one mesh for the whole zone.
 */
import { Group, type Mesh, type Scene } from 'three';
import type { Road, Zone } from '../../lib/zone/format.ts';
import type { Season } from '../world/materials.ts';
import { addBuilding, fill, wallHeight } from './buildings.ts';
import { SegGrid } from './grid.ts';
import { MeshBuilder } from './mesh.ts';
import { Roads } from './roads.ts';
import {
  CHUNK,
  area2,
  centre,
  chunkKey,
  chunkOf,
  insideRing,
  points,
  rnd,
  type Tint,
  type XY,
} from './space.ts';
import { T, type Materials } from './tiles.ts';
import { addTree, type Tree } from './trees.ts';

/** Squares are built within this many metres of you, and dropped past the second distance. */
const BUILD = 1180;
const DROP = 1500;
/** Where fog starts and where it has swallowed everything, in metres. */
export const FOG = { near: 380, far: 1080 } as const;

const PLAIN: Tint = [1, 1, 1];
const AREA: Record<string, { layer: number; tint: Tint; h: number }> = {
  wood: { layer: T.grass, tint: [0.7, 0.78, 0.68], h: 0.015 },
  park: { layer: T.grass, tint: [0.9, 1.06, 0.88], h: 0.015 },
  golf: { layer: T.grass, tint: [1.02, 1.16, 0.9], h: 0.015 },
  pitch: { layer: T.grass, tint: [1.08, 1.2, 0.88], h: 0.03 },
  water: { layer: T.water, tint: PLAIN, h: 0.045 },
  parking: { layer: T.asphalt, tint: [1.16, 1.16, 1.15], h: 0.045 },
};

interface ChunkStuff {
  buildings: number[];
  /** Trees the map itself marks. */
  trees: Tree[];
  /** Woods and parks that reach into this square, as indices into `green`. */
  green: number[];
}

interface Green {
  ring: XY[];
  wood: boolean;
}

export class World {
  readonly zone: Zone;
  /** Every road's centre line, by road index: which street is this? */
  readonly streets = new SegGrid(48);
  /** Every building's walls, by building index: what's in the way? */
  readonly walls = new SegGrid(24);
  private readonly roads: Roads;
  private readonly materials: Materials;
  private readonly season: Season;
  private readonly group = new Group();
  private readonly built = new Map<number, Mesh[]>();
  private readonly stuff = new Map<number, ChunkStuff>();
  private readonly green: Green[] = [];
  /** Whether buildings and trees throw shadows. */
  shadows = true;

  constructor(scene: Scene, zone: Zone, materials: Materials, season: Season) {
    this.zone = zone;
    this.materials = materials;
    this.season = season;
    this.roads = new Roads(zone);
    scene.add(this.group);

    zone.roads.forEach((road, r) => {
      for (let i = 0; i + 3 < road.pts.length; i += 2)
        this.streets.add(road.pts[i]!, road.pts[i + 1]!, road.pts[i + 2]!, road.pts[i + 3]!, r);
    });
    zone.buildings.forEach((b, i) => {
      // Roofs on posts don't stop a car.
      const solid = b.kind !== 'canopy';
      const n = b.pts.length;
      let x = 0;
      let y = 0;
      for (let k = 0; k < n; k += 2) {
        if (solid)
          this.walls.add(b.pts[k]!, b.pts[k + 1]!, b.pts[(k + 2) % n]!, b.pts[(k + 3) % n]!, i);
        x += b.pts[k]!;
        y += b.pts[k + 1]!;
      }
      this.at((x / n) * 2, (y / n) * 2).buildings.push(i);
    });
    for (const spot of zone.spots)
      if (spot.kind === 'tree')
        this.at(spot.x, spot.y).trees.push({
          x: spot.x,
          y: spot.y,
          size: 2.6 + rnd(spot.x * 10, spot.y * 10) * 1.6,
          pine: rnd(spot.y * 10, spot.x * 10) < 0.15,
        });

    // Water, parks and lots: flat, few, and some of them huge, so they're one mesh for the zone.
    const flat = new MeshBuilder();
    for (const area of zone.areas) {
      const ring = points(area.pts);
      const look = AREA[area.kind]!;
      fill(flat, ring, look.h, look.layer, look.tint);
      if (area.kind !== 'wood' && area.kind !== 'park') continue;
      const g = this.green.push({ ring, wood: area.kind === 'wood' }) - 1;
      let x0 = Infinity;
      let x1 = -Infinity;
      let y0 = Infinity;
      let y1 = -Infinity;
      for (const [x, y] of ring) {
        x0 = Math.min(x0, x);
        x1 = Math.max(x1, x);
        y0 = Math.min(y0, y);
        y1 = Math.max(y1, y);
      }
      for (let cx = chunkOf(x0); cx <= chunkOf(x1); cx++)
        for (let cy = chunkOf(y0); cy <= chunkOf(y1); cy++)
          this.at(cx * CHUNK, cy * CHUNK).green.push(g);
    }
    const areas = flat.build(materials.areas);
    if (areas) {
      areas.receiveShadow = true;
      scene.add(areas);
    }
  }

  private at(x: number, y: number): ChunkStuff {
    const key = chunkKey(chunkOf(x), chunkOf(y));
    let s = this.stuff.get(key);
    if (!s) {
      s = { buildings: [], trees: [], green: [] };
      this.stuff.set(key, s);
    }
    return s;
  }

  /** The road nearest a point, within `reach` metres. */
  streetAt(x: number, y: number, reach = 30): { road: Road; d: number } | null {
    const near = this.streets.nearest(x, y, reach);
    return near ? { road: this.zone.roads[near.id]!, d: near.d } : null;
  }

  /** Which way a building faces: toward the nearest street that isn't a freeway or a driveway. */
  private frontOf(ring: readonly XY[]): XY | null {
    const [cx, cy] = centre(ring);
    const roads = this.zone.roads;
    const near = this.streets.nearest(cx, cy, 90, (id) => {
      const kind = roads[id]!.kind;
      return kind !== 'motorway' && kind !== 'link' && kind !== 'driveway';
    });
    if (!near || near.d < 0.5) return null;
    return [(near.x - cx) / near.d, (near.y - cy) / near.d];
  }

  /** Whether a tree could stand here: not in a street, not through a roof. */
  private clear(x: number, y: number): boolean {
    const road = this.streets.nearest(x, y, 16);
    if (road && road.d < 3.5 + (this.zone.roads[road.id]!.lanes * 3.4) / 2) return false;
    return !this.walls.nearest(x, y, 3.4);
  }

  private trees(cx: number, cy: number, stuff: ChunkStuff | undefined): Tree[] {
    const trees: Tree[] = stuff ? [...stuff.trees] : [];
    if (!stuff) return trees;
    const seed = chunkKey(cx, cy);
    // Yards: a tree or two beside homes.
    for (const i of stuff.buildings) {
      const b = this.zone.buildings[i]!;
      if (b.kind !== 'house' && b.kind !== 'townhouse' && b.kind !== 'apartments') continue;
      for (let k = 0; k < 2; k++) {
        if (rnd(i, k + 5) < 0.3) continue;
        const angle = rnd(i, k) * Math.PI * 2;
        const far = 9 + rnd(i, k + 2) * 9;
        const x = b.pts[0]! + Math.cos(angle) * far;
        const y = b.pts[1]! + Math.sin(angle) * far;
        if (!this.clear(x, y)) continue;
        trees.push({ x, y, size: 2.4 + rnd(i, k + 3) * 1.9, pine: rnd(i, k + 4) < 0.14 });
      }
    }
    // Woods are thick with trees, parks dotted with them.
    if (stuff.green.length) {
      const STEP = 11;
      for (let gx = 0; gx < CHUNK; gx += STEP)
        for (let gy = 0; gy < CHUNK; gy += STEP) {
          const x = cx * CHUNK + gx + rnd(seed + gx, gy) * STEP;
          const y = cy * CHUNK + gy + rnd(seed + gy, gx + 1) * STEP;
          const roll = rnd(seed + gx * 3, gy * 7);
          let wood = false;
          let park = false;
          for (const g of stuff.green) {
            const green = this.green[g]!;
            if (!insideRing(green.ring, x, y)) continue;
            if (green.wood) wood = true;
            else park = true;
          }
          if (!(wood ? roll < 0.8 : park && roll < 0.1) || !this.clear(x, y)) continue;
          trees.push({
            x,
            y,
            size: 2.6 + rnd(gx + seed, gy + 9) * 2.2,
            pine: (roll * 97) % 1 < 0.22,
          });
        }
    }
    return trees;
  }

  private build(cx: number, cy: number): void {
    const key = chunkKey(cx, cy);
    const base = new MeshBuilder();
    const ground = new MeshBuilder();
    const marks = new MeshBuilder();
    const x0 = cx * CHUNK;
    const y0 = cy * CHUNK;
    base.flatQuad(
      [x0, y0, 0],
      [x0 + CHUNK, y0, 0],
      [x0 + CHUNK, y0 + CHUNK, 0],
      [x0, y0 + CHUNK, 0],
      T.grass,
      PLAIN,
    );
    this.roads.emit(key, ground, marks);
    const stuff = this.stuff.get(key);
    for (const i of stuff?.buildings ?? []) {
      const b = this.zone.buildings[i]!;
      addBuilding(base, b, i, this.frontOf(points(b.pts)));
    }
    for (const tree of this.trees(cx, cy, stuff)) addTree(base, tree, this.season);

    const meshes: Mesh[] = [];
    const add = (mesh: Mesh | null, casts: boolean) => {
      if (!mesh) return;
      mesh.castShadow = casts && this.shadows;
      mesh.receiveShadow = true;
      this.group.add(mesh);
      meshes.push(mesh);
    };
    add(base.build(this.materials.base), true);
    add(ground.build(this.materials.roads), false);
    add(marks.build(this.materials.marks), false);
    this.built.set(key, meshes);
  }

  /**
   * Keep the world built around (x, y). It builds the nearest missing squares first and stops
   * when `budgetMs` is spent, so a frame never stalls; pass Infinity to build everything in reach.
   */
  update(x: number, y: number, budgetMs: number, reach = BUILD): void {
    const start = performance.now();
    const ccx = chunkOf(x);
    const ccy = chunkOf(y);
    const span = Math.ceil(reach / CHUNK);
    const want: Array<[number, number, number]> = [];
    for (let cx = ccx - span; cx <= ccx + span; cx++)
      for (let cy = ccy - span; cy <= ccy + span; cy++) {
        if (this.built.has(chunkKey(cx, cy))) continue;
        const d = Math.hypot((cx + 0.5) * CHUNK - x, (cy + 0.5) * CHUNK - y);
        if (d < reach) want.push([d, cx, cy]);
      }
    want.sort((a, b) => a[0] - b[0]);
    for (const [, cx, cy] of want) {
      this.build(cx, cy);
      if (performance.now() - start > budgetMs) break;
    }
    for (const [key, meshes] of this.built) {
      const cx = Math.floor(key / 1024) - 512;
      const cy = (key % 1024) - 512;
      if (Math.hypot((cx + 0.5) * CHUNK - x, (cy + 0.5) * CHUNK - y) < DROP) continue;
      for (const mesh of meshes) {
        this.group.remove(mesh);
        mesh.geometry.dispose();
      }
      this.built.delete(key);
    }
  }

  /** How much is built right now, for tests and tuning. */
  get load(): { chunks: number; triangles: number } {
    let triangles = 0;
    for (const meshes of this.built.values())
      for (const mesh of meshes) triangles += mesh.geometry.attributes.position!.count / 3;
    return { chunks: this.built.size, triangles };
  }

  /** The height of the tallest wall near a point: the camera uses it to stay out of buildings. */
  wallNear(x: number, y: number, reach: number): number {
    const near = this.walls.nearest(x, y, reach);
    if (!near) return 0;
    const b = this.zone.buildings[near.id]!;
    return wallHeight(b, Math.abs(area2(points(b.pts))) / 2, near.id);
  }
}
