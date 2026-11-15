/**
 * The delivery zone as a world you can drive through (ADR-035). It's far too big to draw at once
 * on a phone, so it's built in squares around you, a few a frame, and dropped behind you; fog hides
 * the edge. Each square is three meshes: the ground with its buildings and trees, the streets, and
 * the paint on them. Water, parks and lots are one mesh for the whole zone.
 */
import { Group, type Mesh, type Scene } from 'three';
import type { Place, PlaceKind, Road, Zone } from '../../lib/zone/format.ts';
import type { Season } from '../world/materials.ts';
import { addBuilding, fill, up, wallHeight, type Built } from './buildings.ts';
import { SegGrid } from './grid.ts';
import { Labels } from './labels.ts';
import { dress, mainWall, wallOf } from './landmarks.ts';
import { MeshBuilder } from './mesh.ts';
import { box, flagpole, panel, parkedCar, sign } from './props.ts';
import { Roads, roadHeight, roadWidth } from './roads.ts';
import {
  CHUNK,
  area2,
  centre,
  chunkKey,
  chunkOf,
  insideRing,
  points,
  rnd,
  TILE,
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

/** A roadside sign, placed when the world is made and built with its chunk. */
interface RoadSign {
  x: number;
  y: number;
  dir: XY;
  label: number;
  scale: number;
  tint: Tint;
  tall: boolean;
  flag: boolean;
}

/** How each kind of place signs itself: the panel's colour, and a tall pole or a low base. */
const SIGN: Record<PlaceKind, { tint: Tint; tall: boolean }> = {
  school: { tint: [0.14, 0.27, 0.52], tall: false },
  church: { tint: [0.34, 0.2, 0.15], tall: false },
  hospital: { tint: [0.1, 0.36, 0.66], tall: true },
  fuel: { tint: [0.74, 0.13, 0.12], tall: true },
  dealer: { tint: [0.12, 0.14, 0.19], tall: true },
  shop: { tint: [0.13, 0.3, 0.44], tall: true },
  food: { tint: [0.6, 0.2, 0.1], tall: true },
  civic: { tint: [0.12, 0.34, 0.27], tall: false },
  park: { tint: [0.3, 0.22, 0.13], tall: false },
  homes: { tint: [0.3, 0.3, 0.3], tall: false },
  pizzeria: { tint: [0.76, 0.1, 0.08], tall: true },
};
const MAIZE: Tint = [1, 0.8, 0.22];
const HOMES = new Set(['house', 'townhouse', 'apartments', 'mobile', 'garage', 'shed']);

/** The pizzeria's front: its door, which way it faces, and the delivery stalls beside it. */
export interface Shop {
  door: XY;
  /** Unit vectors: out from the wall, and along it toward the stalls. */
  out: XY;
  along: XY;
  building: number;
  wall: number;
  /** The paved pad under the stalls, as a ring. */
  apron: XY[];
  /** Where the car waits: the middle stall, nose in, so the first thing you see is the store. */
  park: { x: number; y: number; heading: number };
}

const STALL = { wide: 2.9, near: 2.4, far: 8.2, first: 3.4, count: 3 } as const;

interface ChunkStuff {
  buildings: number[];
  signs: RoadSign[];
  /** Cars parked in lots: x, y and the direction they point, in threes. */
  parked: number[];
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
  /** Every sidewalk and trail, by path index: where people walk. */
  readonly walks = new SegGrid(48);
  private readonly roads: Roads;
  private readonly materials: Materials;
  private readonly season: Season;
  private readonly group = new Group();
  private readonly built = new Map<number, Mesh[]>();
  private readonly stuff = new Map<number, ChunkStuff>();
  private readonly green: Green[] = [];
  /** Parked cars and sign posts, by chunk: they stop the car but not the camera. */
  readonly things = new SegGrid(24);
  private readonly solid = new Set<number>();
  private readonly labels = new Labels();
  /** The names on each building's wall: label ids and the places they're for. */
  private readonly wallSigns = new Map<number, Array<{ label: number; place: Place }>>();
  /** The pizzeria, when the zone has one. */
  readonly shop: Shop | null = null;
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
    zone.paths.forEach((path, p) => {
      if (path.kind === 'crossing') return;
      for (let i = 0; i + 3 < path.pts.length; i += 2)
        this.walks.add(path.pts[i]!, path.pts[i + 1]!, path.pts[i + 2]!, path.pts[i + 3]!, p);
    });
    zone.buildings.forEach((b, i) => {
      // Roofs on posts don't stop a car.
      const solid = b.kind !== 'canopy' && b.kind !== 'fuel';
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
    this.shop = this.findShop();
    this.placeSigns();
    this.parkLots();
    materials.labels.value = this.labels.build();
  }

  /** Whether a spot is free: no wall within `room` metres, and off every street. */
  private open(x: number, y: number, room: number): boolean {
    if (this.walls.nearest(x, y, room)) return false;
    const roads = this.zone.roads;
    let free = true;
    this.streets.each(x, y, 14, (ax, ay, bx, by, id) => {
      if (!free) return;
      const ex = bx - ax;
      const ey = by - ay;
      const len2 = ex * ex + ey * ey;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / len2)) : 0;
      if (Math.hypot(x - ax - ex * t, y - ay - ey * t) < roadWidth(roads[id]!) / 2 + room * 0.5)
        free = false;
    });
    return free;
  }

  private findShop(): Shop | null {
    const place = this.zone.places.find((p) => p.kind === 'pizzeria');
    const b = place && this.zone.buildings[place.building];
    if (!place || !b) return null;
    const ring = points(b.pts);
    // The front is the wall the door's point is nearest.
    let wall = 0;
    let nearest = Infinity;
    for (let i = 0; i < ring.length; i++) {
      const w = wallOf(ring, i);
      const t = Math.max(
        0,
        Math.min(w.len, (place.x - w.a[0]) * w.dir[0] + (place.y - w.a[1]) * w.dir[1]),
      );
      const d = Math.hypot(place.x - w.a[0] - w.dir[0] * t, place.y - w.a[1] - w.dir[1] * t);
      if (d < nearest && w.len > 4) {
        nearest = d;
        wall = i;
      }
    }
    const w = wallOf(ring, wall);
    const t = Math.max(
      3,
      Math.min(w.len - 3, (place.x - w.a[0]) * w.dir[0] + (place.y - w.a[1]) * w.dir[1]),
    );
    const door: XY = [w.a[0] + w.dir[0] * t, w.a[1] + w.dir[1] * t];
    const span = STALL.first + STALL.wide * STALL.count;
    const at = (side: number, s: number, d: number): XY => [
      door[0] + w.dir[0] * s * side + w.out[0] * d,
      door[1] + w.dir[1] * s * side + w.out[1] * d,
    ];
    // The stalls go on whichever side of the door has the room.
    const room = (side: number) => {
      let free = 0;
      for (let s = STALL.first; s <= span; s += 1.45)
        for (const d of [3.5, 6.5]) if (!this.walls.nearest(...at(side, s, d), 1.2)) free++;
      return free;
    };
    const side = room(1) >= room(-1) ? 1 : -1;
    const along: XY = [w.dir[0] * side, w.dir[1] * side];
    const mid = STALL.first + STALL.wide * (STALL.count / 2);
    const [px, py] = at(side, mid, (STALL.near + STALL.far) / 2);
    return {
      door,
      out: w.out,
      along,
      building: place.building,
      wall,
      apron: [
        at(side, STALL.first - 0.8, 0.3),
        at(side, span + 0.8, 0.3),
        at(side, span + 0.8, STALL.far + 1),
        at(side, STALL.first - 0.8, STALL.far + 1),
      ],
      park: { x: px, y: py, heading: Math.atan2(-w.out[0], -w.out[1]) },
    };
  }

  /** Give every named place its signs: its name on its wall, and a sign out by the road. */
  private placeSigns(): void {
    const { places, buildings, roads } = this.zone;
    const tenants = new Map<number, number>();
    for (const p of places)
      if (p.building >= 0) tenants.set(p.building, (tenants.get(p.building) ?? 0) + 1);
    const taken: XY[] = [];
    for (const place of places) {
      if (place.kind === 'homes') continue;
      const b = buildings[place.building];
      if (b && place.kind !== 'park' && place.kind !== 'fuel') {
        const list = this.wallSigns.get(place.building) ?? [];
        list.push({ label: this.labels.add(place.name, 16, 2), place });
        this.wallSigns.set(place.building, list);
      }
      // A shop in a row of shops has its name over its door; one that stands alone has a sign
      // out by the road as well, like every landmark.
      const alone = !b || tenants.get(place.building) === 1;
      if ((place.kind === 'shop' || place.kind === 'food') && !alone) continue;
      const near =
        this.streets.nearest(place.x, place.y, 340, (id) => {
          const kind = roads[id]!.kind;
          return kind !== 'motorway' && kind !== 'link' && kind !== 'driveway' && kind !== 'aisle';
        }) ?? this.streets.nearest(place.x, place.y, 60, (id) => roads[id]!.kind === 'aisle');
      if (!near) continue;
      const side = (place.x - near.x) * -near.dy + (place.y - near.y) * near.dx >= 0 ? 1 : -1;
      const nx = -near.dy * side;
      const ny = near.dx * side;
      const back = roadWidth(roads[near.id]!) / 2 + 3.4;
      for (const shift of [0, 8, -8, 16, -16, 24, -24, 34, -34]) {
        const x = near.x + near.dx * shift + nx * back;
        const y = near.y + near.dy * shift + ny * back;
        if (!this.open(x, y, 2.4) || taken.some((t) => Math.hypot(t[0] - x, t[1] - y) < 9))
          continue;
        taken.push([x, y]);
        const look = SIGN[place.kind];
        this.at(x, y).signs.push({
          x,
          y,
          dir: [nx, ny],
          label: this.labels.add(place.name, 11, 3),
          scale: look.tall ? 0.105 : 0.085,
          tint: look.tint,
          tall: look.tall,
          flag: place.kind === 'school' || /fire station/i.test(place.name),
        });
        break;
      }
    }
    // Lettering that isn't a place's name.
    this.labels.add('H', 1, 1);
    this.labels.add('EMERGENCY', 9, 1);
    this.labels.add('DELIVERY', 8, 1);
    this.labels.add('DELIVERY PARKING', 8, 2);
  }

  /** Park cars in the lots: beside the aisles, where the map has a parking lot. */
  private parkLots(): void {
    const { roads, areas } = this.zone;
    const lots = areas
      .filter((a) => a.kind === 'parking')
      .map((a) => {
        const ring = points(a.pts);
        const xs = ring.map((p) => p[0]);
        const ys = ring.map((p) => p[1]);
        return {
          ring,
          x0: Math.min(...xs),
          x1: Math.max(...xs),
          y0: Math.min(...ys),
          y1: Math.max(...ys),
        };
      });
    const inLot = (x: number, y: number) =>
      lots.some(
        (l) => x >= l.x0 && x <= l.x1 && y >= l.y0 && y <= l.y1 && insideRing(l.ring, x, y),
      );
    roads.forEach((road, r) => {
      if (road.kind !== 'aisle') return;
      const half = roadWidth(road) / 2 + 2.7;
      for (let i = 0; i + 3 < road.pts.length; i += 2) {
        const ax = road.pts[i]!;
        const ay = road.pts[i + 1]!;
        const ex = road.pts[i + 2]! - ax;
        const ey = road.pts[i + 3]! - ay;
        const len = Math.hypot(ex, ey);
        if (len < 4) continue;
        const dx = ex / len;
        const dy = ey / len;
        for (let s = 2.2; s < len - 1.5; s += 2.9)
          for (const side of [1, -1]) {
            // About one space in three is taken.
            if (rnd(r * 977 + i * 31 + side, Math.round(s * 10)) > 0.32) continue;
            const x = ax + dx * s - dy * half * side;
            const y = ay + dy * s + dx * half * side;
            if (!inLot(x, y) || this.walls.nearest(x, y, 2.8)) continue;
            const other = this.streets.nearest(x, y, 9, (id) => id !== r);
            if (other && other.d < roadWidth(roads[other.id]!) / 2 + 2.6) continue;
            this.at(x, y).parked.push(x, y, Math.atan2(-dy * side, dx * side));
          }
      }
    });
  }

  private at(x: number, y: number): ChunkStuff {
    const key = chunkKey(chunkOf(x), chunkOf(y));
    let s = this.stuff.get(key);
    if (!s) {
      s = { buildings: [], signs: [], parked: [], trees: [], green: [] };
      this.stuff.set(key, s);
    }
    return s;
  }

  /** The road nearest a point, within `reach` metres. */
  streetAt(x: number, y: number, reach = 30): { road: Road; d: number } | null {
    const near = this.streets.nearest(x, y, reach);
    return near ? { road: this.zone.roads[near.id]!, d: near.d } : null;
  }

  /**
   * Which way a building faces. A home faces the nearest street that isn't a freeway or a
   * driveway; a shop, a school or a hospital faces the main road when one is in reach, since
   * that's where its sign and its front door are.
   */
  private frontOf(ring: readonly XY[], home: boolean): XY | null {
    const [cx, cy] = centre(ring);
    const roads = this.zone.roads;
    const reach = home ? 90 : Math.max(220, Math.sqrt(Math.abs(area2(ring)) / 2) * 1.6);
    const main = home
      ? null
      : this.streets.nearest(cx, cy, reach, (id) => {
          const kind = roads[id]!.kind;
          return kind === 'primary' || kind === 'secondary' || kind === 'tertiary';
        });
    const near =
      main ??
      this.streets.nearest(cx, cy, reach, (id) => {
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

  /** Make a box-shaped thing solid: the car bumps into it. */
  private block(x: number, y: number, dir: XY, hl: number, hw: number): void {
    const [dx, dy] = dir;
    const c: XY[] = [
      [x - dx * hl + dy * hw, y - dy * hl - dx * hw],
      [x + dx * hl + dy * hw, y + dy * hl - dx * hw],
      [x + dx * hl - dy * hw, y + dy * hl + dx * hw],
      [x - dx * hl - dy * hw, y - dy * hl + dx * hw],
    ];
    for (let i = 0; i < 4; i++)
      this.things.add(c[i]![0], c[i]![1], c[(i + 1) % 4]![0], c[(i + 1) % 4]![1], -1);
  }

  /** A place's name on its building: over its own door in a row of shops, or mid-wall. */
  private nameOnWall(out: MeshBuilder, i: number, built: Built): void {
    const b = this.zone.buildings[i]!;
    const mid = centre(built.ring);
    for (const { label, place } of this.wallSigns.get(i) ?? []) {
      const own = Math.hypot(place.x - mid[0], place.y - mid[1]) < 2.5;
      let wall = mainWall(built);
      if (place.kind === 'pizzeria' && this.shop) wall = this.shop.wall;
      else if (!own) {
        // The street-facing wall nearest the shop's own point on the map.
        let nearest = Infinity;
        for (let k = 0; k < built.ring.length; k++) {
          const w = wallOf(built.ring, k);
          if (built.facing[k]! <= 0.35 || w.len < 5) continue;
          const d = Math.hypot(place.x - w.mid[0], place.y - w.mid[1]) - w.len / 2;
          if (d < nearest) {
            nearest = d;
            wall = k;
          }
        }
      }
      const w = wallOf(built.ring, wall);
      const rect = this.labels.get(label);
      const tall = built.H > 9;
      // As big as the wall allows: big-box lettering on a big box.
      const scale = Math.max(
        0.07,
        Math.min(tall ? 0.34 : 0.21, (w.len * 0.62) / rect.w, (tall ? 3.4 : 1.9) / rect.h),
      );
      const width = rect.w * scale;
      const height = rect.h * scale;
      if (width > w.len - 0.6) continue;
      const along =
        place.kind === 'pizzeria' && this.shop
          ? (this.shop.door[0] - w.a[0]) * w.dir[0] + (this.shop.door[1] - w.a[1]) * w.dir[1]
          : own
            ? w.len / 2
            : (place.x - w.a[0]) * w.dir[0] + (place.y - w.a[1]) * w.dir[1];
      const s = Math.max(width / 2 + 0.3, Math.min(w.len - width / 2 - 0.3, along));
      const top = b.kind === 'hospital' && tall ? built.H - 1.9 : built.H - 0.3;
      const at = (d: number): XY => [
        w.a[0] + w.dir[0] * (s + d) + w.out[0] * 0.2,
        w.a[1] + w.dir[1] * (s + d) + w.out[1] * 0.2,
      ];
      const look = SIGN[place.kind];
      const tint =
        place.kind === 'shop' || place.kind === 'food' ? this.shopTint(place) : look.tint;
      panel(out, at(-width / 2), at(width / 2), top - height, top, rect, tint, -1);
      if (b.kind !== 'hospital' || !tall) continue;
      // A hospital says so from a long way off: a white H on blue, high on the wall.
      const h = this.labels.get(this.labels.add('H', 1, 1));
      const size = 0.42;
      const left = s + width / 2 + 1.2;
      if (left + h.w * size < w.len - 0.5)
        panel(
          out,
          at(width / 2 + 1.2),
          at(width / 2 + 1.2 + h.w * size),
          top - h.h * size,
          top,
          h,
          look.tint,
          -1.2,
        );
      const er = this.labels.get(this.labels.add('EMERGENCY', 9, 1));
      panel(
        out,
        at(-er.w * 0.09),
        at(er.w * 0.09),
        3.3,
        3.3 + er.h * 0.18,
        er,
        [0.7, 0.1, 0.1],
        -1.2,
      );
    }
  }

  /** A shop's sign colour: steady for the shop, varied along a row. */
  private shopTint(place: Place): Tint {
    const tints: Tint[] = [
      [0.66, 0.12, 0.12],
      [0.1, 0.27, 0.56],
      [0.08, 0.38, 0.24],
      [0.72, 0.4, 0.06],
      [0.32, 0.14, 0.46],
      [0.13, 0.13, 0.15],
    ];
    return tints[Math.floor(rnd(Math.round(place.x * 3), Math.round(place.y * 3)) * tints.length)]!;
  }

  /** A concrete driveway from a house's garage to its street, sometimes with a car on it. */
  private driveway(
    ground: MeshBuilder,
    built: Built,
    seed: number,
    park: (x: number, y: number, dir: XY, seed: number) => void,
  ): void {
    if (!built.garage) return;
    const [g0, g1] = built.garage;
    const gx = (g0[0] + g1[0]) / 2;
    const gy = (g0[1] + g1[1]) / 2;
    const roads = this.zone.roads;
    const near = this.streets.nearest(gx, gy, 34, (id) => {
      const kind = roads[id]!.kind;
      return kind !== 'motorway' && kind !== 'link';
    });
    // A house the map already gives a driveway keeps the real one.
    if (!near || roads[near.id]!.kind === 'driveway' || near.d < 5) return;
    const ux = (near.x - gx) / near.d;
    const uy = (near.y - gy) / near.d;
    const len = near.d - roadWidth(roads[near.id]!) / 2 + 0.4;
    if (len < 3) return;
    // Not across another house's lot.
    for (let t = 2; t < len; t += 2.5)
      if (this.walls.nearest(gx + ux * t, gy + uy * t, 1.2)) return;
    const hw = 1.55;
    const h = roadHeight('driveway');
    const a: XY = [gx - uy * hw, gy + ux * hw];
    const b: XY = [gx + uy * hw, gy - ux * hw];
    ground.flatQuad(
      up(a, h),
      up(b, h),
      [b[0] + ux * len, b[1] + uy * len, h],
      [a[0] + ux * len, a[1] + uy * len, h],
      T.slab,
      [0.96, 0.96, 0.95],
    );
    if (len > 7.5 && rnd(seed, 71) < 0.36)
      park(gx + ux * 3.4, gy + uy * 3.4, rnd(seed, 72) < 0.6 ? [-ux, -uy] : [ux, uy], seed);
  }

  /** The pizzeria's front: a lit shop front under a striped awning, and the delivery stalls. */
  private dressShop(
    base: MeshBuilder,
    ground: MeshBuilder,
    marks: MeshBuilder,
    built: Built,
  ): void {
    const shop = this.shop!;
    const w = wallOf(built.ring, shop.wall);
    const RED: Tint = [0.8, 0.12, 0.1];
    const half = Math.min(7, w.len / 2 - 0.2);
    const at = (s: number, d: number): XY => [
      shop.door[0] + w.dir[0] * s + w.out[0] * d,
      shop.door[1] + w.dir[1] * s + w.out[1] * d,
    ];
    // Windows with the lights on, and a glass door in the middle.
    const bays = Math.max(1, Math.round((half * 2) / 4));
    for (let k = 0; k < bays; k++) {
      const s0 = -half + (k * half * 2) / bays;
      const s1 = -half + ((k + 1) * half * 2) / bays;
      const layer = k === Math.floor(bays / 2) ? T.stuccoDoor : T.stuccoShop;
      base.quad(
        up(at(s0, 0.06), 0),
        up(at(s1, 0.06), 0),
        up(at(s1, 0.06), 3.4),
        up(at(s0, 0.06), 3.4),
        0,
        0,
        0.5,
        0.5,
        layer,
        [1.05, 0.97, 0.9],
        1.25,
      );
    }
    // The awning: red and white stripes, sloping out over the walk.
    const stripes = (half * 2) / TILE;
    base.quad(
      up(at(-half, 1.7), 2.75),
      up(at(half, 1.7), 2.75),
      up(at(half, 0.08), 3.5),
      up(at(-half, 0.08), 3.5),
      0,
      0,
      stripes * 2,
      0.1,
      T.awning,
      RED,
      -0.25,
    );
    base.quad(
      up(at(-half, 1.7), 2.45),
      up(at(half, 1.7), 2.45),
      up(at(half, 1.7), 2.75),
      up(at(-half, 1.7), 2.75),
      0,
      0,
      stripes * 2,
      0.1,
      T.awning,
      RED,
      -0.25,
    );
    // A band of red light along the roof line.
    base.quad(
      up(at(-half, 0.14), built.H - 0.28),
      up(at(half, 0.14), built.H - 0.28),
      up(at(half, 0.14), built.H - 0.1),
      up(at(-half, 0.14), built.H - 0.1),
      0,
      0,
      1,
      0.1,
      T.plain,
      [1, 0.24, 0.16],
      -1.6,
    );

    // The delivery stalls: a paved pad, maize lines, and the word in each stall.
    const side = shop.along[0] * w.dir[0] + shop.along[1] * w.dir[1] >= 0 ? 1 : -1;
    const lot = (s: number, d: number) => at(s * side, d);
    const h = roadHeight('aisle');
    const [a, b, c, d] = shop.apron as [XY, XY, XY, XY];
    const ring = area2([a, b, c, d]) > 0 ? [a, b, c, d] : [d, c, b, a];
    ground.flatQuad(
      up(ring[0]!, h),
      up(ring[1]!, h),
      up(ring[2]!, h),
      up(ring[3]!, h),
      T.asphalt,
      [1.16, 1.16, 1.15],
    );
    const line = (p: XY, q: XY, wide: number) => {
      const len = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      const nx = (-(q[1] - p[1]) / len) * (wide / 2);
      const ny = ((q[0] - p[0]) / len) * (wide / 2);
      marks.flatQuad(
        [p[0] - nx, p[1] - ny, 0.18],
        [q[0] - nx, q[1] - ny, 0.18],
        [q[0] + nx, q[1] + ny, 0.18],
        [p[0] + nx, p[1] + ny, 0.18],
        T.paint,
        MAIZE,
      );
    };
    const word = this.labels.get(this.labels.add('DELIVERY', 8, 1));
    for (let k = 0; k <= STALL.count; k++) {
      const s = STALL.first + k * STALL.wide;
      line(lot(s, STALL.near), lot(s, STALL.far), 0.16);
      if (k === STALL.count) break;
      // The word reads the right way up as you pull in, at the mouth of the stall.
      const mid = s + STALL.wide / 2;
      const ww = word.w * 0.062;
      const wh = word.h * 0.062;
      const foot = STALL.far - 0.6;
      // Corners as you see them pulling in: far left, far right, near right, near left.
      const corners: Array<[XY, number, number]> = [
        [lot(mid - (ww / 2) * side, foot - wh), word.u0, word.v1],
        [lot(mid + (ww / 2) * side, foot - wh), word.u1, word.v1],
        [lot(mid + (ww / 2) * side, foot), word.u1, word.v0],
        [lot(mid - (ww / 2) * side, foot), word.u0, word.v0],
      ];
      // Whichever way round faces up.
      const order = area2(corners.map((c) => c[0])) > 0 ? [0, 1, 2, 0, 2, 3] : [0, 2, 1, 0, 3, 2];
      for (let n = 0; n < 6; n += 3) {
        const [a, b, c] = [corners[order[n]!]!, corners[order[n + 1]!]!, corners[order[n + 2]!]!];
        marks.tri(
          up(a[0], 0.18),
          up(b[0], 0.18),
          up(c[0], 0.18),
          a[1],
          a[2],
          b[1],
          b[2],
          c[1],
          c[2],
          -1,
          MAIZE,
        );
      }
    }
    line(
      lot(STALL.first, STALL.near),
      lot(STALL.first + STALL.wide * STALL.count, STALL.near),
      0.16,
    );
    // A sign at the head of the stalls.
    const post = lot(STALL.first + (STALL.wide * STALL.count) / 2, 1.5);
    sign(base, {
      x: post[0],
      y: post[1],
      dir: w.dir,
      label: this.labels.get(this.labels.add('DELIVERY PARKING', 8, 2)),
      scale: 0.05,
      tint: [0.1, 0.25, 0.5],
      tall: false,
    });
    // Planters either side of the door.
    for (const s of [-2.2, 2.2])
      box(base, ...at(s, 0.7), w.dir, 0.45, 0.35, 0, 0.6, [0.42, 0.26, 0.2]);
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
    // The first time a chunk is built, its parked cars and sign posts become things to hit.
    const first = !this.solid.has(key);
    this.solid.add(key);
    const park = (x: number, y: number, dir: XY, seed: number) => {
      parkedCar(base, x, y, dir, seed);
      if (first) this.block(x, y, dir, 2.2, 0.9);
    };
    const clear = (x: number, y: number) => this.open(x, y, 2.2);
    for (const i of stuff?.buildings ?? []) {
      const b = this.zone.buildings[i]!;
      const ring = points(b.pts);
      const built = addBuilding(base, b, i, this.frontOf(ring, HOMES.has(b.kind)));
      if (!built) continue;
      dress(base, b, built, i, clear, park);
      this.nameOnWall(base, i, built);
      if (b.kind === 'house') this.driveway(ground, built, i, park);
      if (this.shop?.building === i) this.dressShop(base, ground, marks, built);
    }
    for (const s of stuff?.signs ?? []) {
      sign(base, { ...s, label: this.labels.get(s.label) });
      if (first) this.block(s.x, s.y, s.dir, 0.3, 0.3);
      if (s.flag) {
        const fx = s.x - s.dir[1] * 4.5;
        const fy = s.y + s.dir[0] * 4.5;
        if (this.open(fx, fy, 1)) flagpole(base, fx, fy, [-s.dir[1], s.dir[0]]);
      }
    }
    const parked = stuff?.parked ?? [];
    for (let k = 0; k < parked.length; k += 3) {
      const a = parked[k + 2]!;
      park(parked[k]!, parked[k + 1]!, [Math.cos(a), Math.sin(a)], Math.round(parked[k]! * 7) + k);
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

  /**
   * What's here, for the dashboard: the landmark you're beside, or else the neighbourhood you're
   * in. Places are few, so it looks through them all.
   */
  placeNear(x: number, y: number): Place | null {
    let best: Place | null = null;
    let score = Infinity;
    for (const place of this.zone.places) {
      const d = Math.hypot(place.x - x, place.y - y);
      const homes = place.kind === 'homes';
      const big = place.kind === 'hospital' || place.kind === 'school' || place.kind === 'park';
      if (d > (homes ? 330 : big ? 150 : 70)) continue;
      // A landmark beside you beats the neighbourhood around you.
      const rank = d + (homes ? 1000 : 0);
      if (rank < score) {
        score = rank;
        best = place;
      }
    }
    return best;
  }

  /** The height of the tallest wall near a point: the camera uses it to stay out of buildings. */
  wallNear(x: number, y: number, reach: number): number {
    const near = this.walls.nearest(x, y, reach);
    if (!near) return 0;
    const b = this.zone.buildings[near.id]!;
    return wallHeight(b, Math.abs(area2(points(b.pts))) / 2, near.id);
  }
}
