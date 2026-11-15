/**
 * The delivery world's textures (DESIGN: Delivery mode): a stack of 64 by 64 pixel tiles painted
 * by the town's painters and ramps, at 8 texels a metre, in one texture array. One material wears
 * them all, so a chunk of the world is a single draw call. Up close a texel is a clear square; far
 * away the tiles average out (mipmaps) so nothing sparkles at speed.
 *
 * A tile's alpha says what each texel is: 255 takes the triangle's tint (a wall, a roof, the
 * ground), 0 keeps its own colour (trim, doors), and 128 is glass, which glows at night.
 */
import {
  DataArrayTexture,
  DoubleSide,
  FrontSide,
  MeshLambertMaterial,
  NearestFilter,
  NearestMipmapLinearFilter,
  RGBAFormat,
  RepeatWrapping,
  type Side,
} from 'three';
import {
  M,
  MAT_NAMES,
  hex,
  palette,
  type MatName,
  type RGB,
  type Season,
} from '../world/materials.ts';
import { facade, texFn, type Painter } from '../world/painters.ts';
import { hash } from '../world/noise.ts';

export const SIZE = 64;
/** A wall tile holds two bays across and two storeys up, each 32 texels. */
export const BAY = 32;

/** The tiles, by name. A triangle's `layer` is one of these. */
export const T = {
  grass: 0,
  asphalt: 1,
  slab: 2,
  walk: 3,
  water: 4,
  paint: 5,
  sidingWindow: 6,
  sidingBlank: 7,
  sidingDoor: 8,
  sidingGarage: 9,
  brickWindow: 10,
  brickBlank: 11,
  brickDoor: 12,
  stuccoShop: 13,
  stuccoBlank: 14,
  stuccoDoor: 15,
  stuccoWindow: 16,
  block: 17,
  tin: 18,
  tinDoor: 19,
  shingle: 20,
  flatRoof: 21,
  metalRoof: 22,
  leaves: 23,
  bark: 24,
  plain: 25,
} as const;
const COUNT = 26;

type RGBA = readonly [number, number, number, number];
type Paint = (u: number, v: number) => RGBA;

/** Materials that keep their own colour whatever the wall's tint. */
const FIXED = new Set<MatName>(['trim', 'doorR', 'doorB', 'dark', 'steel', 'wood']);

/** A steady random level for a clump of texels; tiles repeat, so it only ever sees 0 to 63. */
const clump = (u: number, v: number, size: number, seed: number) =>
  hash((u / size) | 0 | (seed << 8), (v / size) | 0);

function paintTiles(season: Season): Uint8Array {
  const pal = palette(season);
  const tok = (t: number): RGBA => {
    const c = pal.rgb[t] ?? pal.rgb[M.cmu + 1]!;
    const name = MAT_NAMES[t >> 3]!;
    return [c[0], c[1], c[2], name === 'glass' ? 128 : FIXED.has(name) ? 0 : 255];
  };
  const of =
    (painter: Painter): Paint =>
    (u, v) =>
      tok(painter(u, v));
  /** A wall bay, repeated across the tile and up it. */
  const bay =
    (painter: Painter): Paint =>
    (u, v) =>
      tok(painter(u % BAY, v % BAY));
  /** A material's ramp, picked by level; a level between two steps is a blend of them. */
  const ramp = (mat: MatName, pick: (u: number, v: number) => number): Paint => {
    const levels = pal.ramps[mat];
    return (u, v) => {
      const lv = Math.max(0, Math.min(levels.length - 1, pick(u, v)));
      const a = levels[Math.floor(lv)]!;
      const b = levels[Math.ceil(lv)]!;
      const t = lv - Math.floor(lv);
      return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t, 255];
    };
  };
  const greys = (levels: number[], pick: (u: number, v: number) => number): Paint => {
    return (u, v) => {
      const g = levels[Math.max(0, Math.min(levels.length - 1, pick(u, v)))]!;
      return [g, g, g, 255];
    };
  };
  const speckle = (u: number, v: number, seed: number, base: number) => {
    const h = clump(u, v, 1, seed);
    return base + (h < 0.07 ? -1 : h > 0.93 ? 1 : 0);
  };
  const WATER: RGB[] = ['#2c5a80', '#356b96', '#3f7dab', '#6ba3cc'].map(hex);
  const stucco: Painter = (u, v) => {
    const h = hash(u + 300, v);
    return M.stucco + 2 + (h < 0.07 ? -1 : h > 0.95 ? 1 : 0);
  };
  /** Bricks half a metre long in staggered courses, with darker joints rather than white mortar. */
  const brick: Painter = (u, v) => {
    const row = v >> 1;
    const uu = u + (row & 1) * 2;
    if ((uu & 3) === 0) return M.brickR;
    const h = hash((uu >> 2) + 60, row);
    return M.brickR + (h < 0.2 ? 1 : h < 0.8 ? 2 : 3);
  };
  const withWall = (wall: Painter, spec: Parameters<typeof facade>[0]): Painter => {
    const front = facade({ ...spec, kind: 'plain' });
    const blank = M[spec.mat] + 2;
    // The facade painter draws its own plain wall; swap that for the wall we want.
    return (u, v) => {
      const t = front(u, v);
      return t === blank ? wall(u, v) : t;
    };
  };

  const sash = { u: 11, v: 8, w: 10, h: 15, k: 'sash' } as const;
  const paints: Paint[] = [];
  // Quiet ground: a mid tone with soft patches and a few flecks, so it's calm at speed.
  paints[T.grass] = ramp('grass', (u, v) => {
    const fleck = clump(u, v, 1, 1);
    return 1.3 + clump(u, v, 4, 11) * 0.5 + (fleck < 0.08 ? -0.6 : fleck > 0.93 ? 0.7 : 0);
  });
  paints[T.asphalt] = ramp('asph', (u, v) => {
    const fleck = clump(u, v, 1, 2);
    return 2.3 + clump(u, v, 8, 12) * 0.3 + (fleck < 0.06 ? -0.5 : fleck > 0.95 ? 0.6 : 0);
  });
  // Concrete streets are poured in slabs: a faint joint every four metres.
  paints[T.slab] = ramp('conc', (u, v) => (u % 32 === 0 || v % 32 === 0 ? 1 : speckle(u, v, 3, 2)));
  paints[T.walk] = ramp('walk', (u, v) => (u % 16 === 0 || v % 16 === 0 ? 0 : speckle(u, v, 4, 2)));
  paints[T.water] = (u, v) => {
    const row = v & 7;
    const wave = row === 0 && ((u + (v >> 3) * 5) & 15) < 6;
    const c = WATER[wave ? 3 : clump(u, v, 4, 5) < 0.3 ? 0 : 1]!;
    return [c[0], c[1], c[2], 255];
  };
  paints[T.paint] = greys([196, 236], (u, v) => (clump(u, v, 1, 6) < 0.07 ? 0 : 1));
  paints[T.sidingWindow] = bay(facade({ kind: 'siding', mat: 'sidW', wins: [sash] }));
  paints[T.sidingBlank] = bay(texFn('siding', 'sidW'));
  paints[T.sidingDoor] = bay(
    facade({ kind: 'siding', mat: 'sidW', doors: [{ u: 11, w: 10, h: 23, mat: 'doorR' }] }),
  );
  paints[T.sidingGarage] = bay(
    facade({ kind: 'siding', mat: 'sidW', wins: [{ u: 3, v: 0, w: 26, h: 23, k: 'garage' }] }),
  );
  paints[T.brickWindow] = bay(withWall(brick, { mat: 'brickR', wins: [sash] }));
  paints[T.brickBlank] = bay(brick);
  paints[T.brickDoor] = bay(
    withWall(brick, { mat: 'brickR', doors: [{ u: 11, w: 10, h: 23, mat: 'doorB' }] }),
  );
  paints[T.stuccoShop] = bay(
    withWall(stucco, { mat: 'stucco', wins: [{ u: 2, v: 0, w: 28, h: 21, k: 'store' }] }),
  );
  paints[T.stuccoBlank] = bay(stucco);
  paints[T.stuccoDoor] = bay(
    withWall(stucco, {
      mat: 'stucco',
      doors: [{ u: 10, w: 12, h: 22, mat: 'steel', glass: true }],
      wins: [
        { u: 2, v: 0, w: 7, h: 21, k: 'store' },
        { u: 23, v: 0, w: 7, h: 21, k: 'store' },
      ],
    }),
  );
  paints[T.stuccoWindow] = bay(
    withWall(stucco, { mat: 'stucco', wins: [{ u: 8, v: 9, w: 16, h: 13, k: 'fix' }] }),
  );
  paints[T.block] = bay(texFn('cmu', 'cmu'));
  paints[T.tin] = bay(texFn('tin', 'tin'));
  paints[T.tinDoor] = bay(
    facade({ kind: 'tin', mat: 'tin', wins: [{ u: 3, v: 0, w: 26, h: 27, k: 'garage' }] }),
  );
  // Shingles in courses, the tabs staggered row to row. Light greys, so the tint is the roof's colour.
  paints[T.shingle] = greys([122, 150, 178, 204], (u, v) => {
    const row = v >> 2;
    const tab = (u + (row & 1) * 4) & 7;
    const h = hash(((u + (row & 1) * 4) >> 3) + 40, row);
    return 2 + ((v & 3) === 3 ? -1 : 0) + (tab === 0 ? -1 : 0) + (h < 0.15 ? -1 : h > 0.88 ? 1 : 0);
  });
  paints[T.flatRoof] = ramp('flatR', (u, v) => speckle(u, v, 7, 2));
  paints[T.metalRoof] = ramp('metalR', (u) => {
    const k = u & 7;
    return k === 0 ? 3 : k === 1 ? 0 : k < 5 ? 2 : 1;
  });
  paints[T.leaves] = greys([128, 168, 204, 240], (u, v) => {
    const h = clump(u, v, 2, 8);
    return h < 0.2 ? 0 : h < 0.55 ? 1 : h < 0.88 ? 2 : 3;
  });
  paints[T.bark] = ramp('trunk', (u, v) => (clump(u, 0, 2, 9) < 0.4 ? 0 : (v & 7) === 0 ? 1 : 2));
  paints[T.plain] = () => [255, 255, 255, 255];

  const data = new Uint8Array(SIZE * SIZE * 4 * COUNT);
  for (let layer = 0; layer < COUNT; layer++) {
    const paint = paints[layer] ?? paints[T.plain]!;
    for (let row = 0; row < SIZE; row++)
      for (let col = 0; col < SIZE; col++) {
        // Row 0 of the data is the bottom of the tile.
        const c = paint(col, row);
        data.set(c, ((layer * SIZE + row) * SIZE + col) * 4);
      }
  }
  return data;
}

export interface Materials {
  /** Buildings, trees and the ground: seen from both sides, so eaves have undersides. */
  base: MeshLambertMaterial;
  /** Flat things lying on the ground, each drawn a little nearer than the one beneath it. */
  areas: MeshLambertMaterial;
  roads: MeshLambertMaterial;
  marks: MeshLambertMaterial;
  /** 0 by day to 1 at night: how strongly windows glow. */
  night: { value: number };
}

const VERTEX_HEAD = `
attribute float layer;
attribute float glow;
attribute vec3 tint;
varying float vLayer;
varying float vGlow;
varying vec3 vTint;
varying vec2 vTile;
`;
const VERTEX_BODY = `
vLayer = layer;
vGlow = glow;
vTint = tint;
vTile = uv;
`;
const FRAGMENT_HEAD = `
uniform highp sampler2DArray tiles;
uniform float night;
varying float vLayer;
varying float vGlow;
varying vec3 vTint;
varying vec2 vTile;
`;
const FRAGMENT_MAP = `
vec4 tile = texture(tiles, vec3(vTile, floor(vLayer + 0.5)));
float glass = 1.0 - smoothstep(0.12, 0.38, abs(tile.a - 0.5));
diffuseColor.rgb = tile.rgb * mix(vec3(1.0), vTint, smoothstep(0.6, 0.9, tile.a));
`;
const FRAGMENT_GLOW = `
totalEmissiveRadiance += vec3(1.0, 0.8, 0.46) * (glass * vGlow * night);
`;

/** The world's materials for a season: they share one texture array and one shader. */
export function makeMaterials(season: Season, anisotropy: number): Materials {
  const tiles = new DataArrayTexture(paintTiles(season), SIZE, SIZE, COUNT);
  tiles.format = RGBAFormat;
  tiles.magFilter = NearestFilter;
  tiles.minFilter = NearestMipmapLinearFilter;
  tiles.generateMipmaps = true;
  tiles.wrapS = tiles.wrapT = RepeatWrapping;
  tiles.anisotropy = anisotropy;
  tiles.needsUpdate = true;
  const night = { value: 0 };
  const make = (side: Side, lift: number): MeshLambertMaterial => {
    const material = new MeshLambertMaterial({
      side,
      polygonOffset: lift > 0,
      polygonOffsetFactor: -lift,
      polygonOffsetUnits: -lift,
    });
    material.onBeforeCompile = (shader) => {
      shader.uniforms.tiles = { value: tiles };
      shader.uniforms.night = night;
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', `#include <common>${VERTEX_HEAD}`)
        .replace('#include <begin_vertex>', `#include <begin_vertex>${VERTEX_BODY}`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>${FRAGMENT_HEAD}`)
        .replace('#include <map_fragment>', FRAGMENT_MAP)
        .replace(
          '#include <emissivemap_fragment>',
          `#include <emissivemap_fragment>${FRAGMENT_GLOW}`,
        );
    };
    material.customProgramCacheKey = () => 'delivery-tiles';
    return material;
  };
  return {
    base: make(DoubleSide, 0),
    areas: make(FrontSide, 1),
    roads: make(FrontSide, 2),
    marks: make(FrontSide, 4),
    night,
  };
}
