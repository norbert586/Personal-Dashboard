/**
 * Trees for the delivery world: faceted low-poly crowns on short trunks, and pines as stacked
 * cones, coloured by the season like the town's (DESIGN: Light, time and weather).
 */
import type { Season } from '../world/materials.ts';
import type { MeshBuilder } from './mesh.ts';
import { rnd, type P3, type Tint } from './space.ts';
import { T } from './tiles.ts';

export interface Tree {
  x: number;
  y: number;
  /** The crown's radius, in metres. */
  size: number;
  pine: boolean;
}

const G = (1 + Math.sqrt(5)) / 2;
const NORM = Math.hypot(1, G);
/** A unit icosahedron, as three.js draws it: x right, y up, z toward you. */
const VERTS: ReadonlyArray<readonly [number, number, number]> = (
  [
    [-1, G, 0],
    [1, G, 0],
    [-1, -G, 0],
    [1, -G, 0],
    [0, -1, G],
    [0, 1, G],
    [0, -1, -G],
    [0, 1, -G],
    [G, 0, -1],
    [G, 0, 1],
    [-G, 0, -1],
    [-G, 0, 1],
  ] as const
).map(([x, y, z]) => [x / NORM, y / NORM, z / NORM] as const);
const FACES: ReadonlyArray<readonly [number, number, number]> = [
  [0, 11, 5],
  [0, 5, 1],
  [0, 1, 7],
  [0, 7, 10],
  [0, 10, 11],
  [1, 5, 9],
  [5, 11, 4],
  [11, 10, 2],
  [10, 7, 6],
  [7, 1, 8],
  [3, 9, 4],
  [3, 4, 2],
  [3, 2, 6],
  [3, 6, 8],
  [3, 8, 9],
  [4, 9, 5],
  [2, 4, 11],
  [6, 2, 10],
  [8, 6, 7],
  [9, 8, 1],
];

const LEAVES: Record<Season, { tints: Tint[]; scale: number }> = {
  spring: {
    tints: [
      [0.5, 0.78, 0.36],
      [0.44, 0.72, 0.34],
      [0.95, 0.72, 0.82],
      [0.56, 0.8, 0.4],
    ],
    scale: 0.95,
  },
  summer: {
    tints: [
      [0.36, 0.62, 0.3],
      [0.42, 0.68, 0.32],
      [0.3, 0.55, 0.28],
      [0.48, 0.7, 0.36],
    ],
    scale: 1,
  },
  fall: {
    tints: [
      [0.95, 0.56, 0.2],
      [0.82, 0.3, 0.2],
      [0.95, 0.8, 0.28],
      [0.52, 0.62, 0.3],
      [0.9, 0.44, 0.18],
    ],
    scale: 1,
  },
  latefall: {
    tints: [
      [0.56, 0.42, 0.3],
      [0.5, 0.4, 0.32],
      [0.62, 0.46, 0.28],
    ],
    scale: 0.78,
  },
  winter: {
    tints: [
      [0.42, 0.36, 0.33],
      [0.46, 0.4, 0.36],
    ],
    scale: 0.62,
  },
};
const PINE: Tint = [0.26, 0.44, 0.32];
const BARK: Tint = [1, 1, 1];

export function addTree(out: MeshBuilder, tree: Tree, season: Season): void {
  const seed = Math.round(tree.x * 7) ^ Math.round(tree.y * 13);
  const { x, y } = tree;
  const trunk = tree.pine ? 1.1 : 2.2 + rnd(seed, 1) * 1.1;
  const w = tree.pine ? 0.18 : 0.2 + tree.size * 0.03;
  // The trunk: four sides.
  const corners = [
    [x - w, y - w],
    [x + w, y - w],
    [x + w, y + w],
    [x - w, y + w],
  ] as const;
  for (let i = 0; i < 4; i++) {
    const a = corners[i]!;
    const b = corners[(i + 1) % 4]!;
    out.quad(
      [a[0], a[1], 0],
      [b[0], b[1], 0],
      [b[0], b[1], trunk + 0.4],
      [a[0], a[1], trunk + 0.4],
      0,
      0,
      0.1,
      0.4,
      T.bark,
      BARK,
    );
  }
  if (tree.pine) {
    const R = tree.size;
    for (const [r, h0, h1] of [
      [R * 0.9, trunk, trunk + R * 1.7],
      [R * 0.62, trunk + R * 1.0, trunk + R * 2.5],
    ] as const) {
      const SIDES = 6;
      const turn = rnd(seed, 2) * 6;
      for (let s = 0; s < SIDES; s++) {
        const a0 = turn + (s / SIDES) * Math.PI * 2;
        const a1 = turn + ((s + 1) / SIDES) * Math.PI * 2;
        const shade = 0.9 + rnd(seed, s + 10) * 0.2;
        out.tri(
          [x + Math.cos(a0) * r, y + Math.sin(a0) * r, h0],
          [x + Math.cos(a1) * r, y + Math.sin(a1) * r, h0],
          [x, y, h1],
          0,
          0,
          0.3,
          0,
          0.15,
          0.4,
          T.leaves,
          [PINE[0] * shade, PINE[1] * shade, PINE[2] * shade],
        );
      }
    }
    return;
  }
  const look = LEAVES[season];
  const tint = look.tints[Math.floor(rnd(seed, 3) * look.tints.length)]!;
  const R = tree.size * look.scale;
  // A crown is three overlapping blobs, like the town's trees: one big, one low, one high.
  const BLOBS = [
    [0, 0, 0.8, 1],
    [0.5, -0.3, 0.5, 0.7],
    [-0.38, 0.36, 1.25, 0.66],
  ] as const;
  BLOBS.forEach(([ox, oy, oh, scale], blob) => {
    const r = R * scale;
    const spin = rnd(seed, 4 + blob) * Math.PI * 2;
    const cos = Math.cos(spin);
    const sin = Math.sin(spin);
    const place = (v: readonly [number, number, number]): P3 => [
      x + ox * R + (v[0] * cos - v[2] * sin) * r,
      y + oy * R - (v[0] * sin + v[2] * cos) * r,
      trunk + oh * R + v[1] * r * 0.95,
    ];
    const k = r / 5;
    FACES.forEach(([a, b, c], f) => {
      const shade = (0.86 + rnd(seed + blob, f + 20) * 0.26) * (blob === 1 ? 0.9 : 1);
      const va = VERTS[a]!;
      const vb = VERTS[b]!;
      const vc = VERTS[c]!;
      out.tri(
        place(va),
        place(vb),
        place(vc),
        va[0] * k,
        va[1] * k,
        vb[0] * k,
        vb[1] * k,
        vc[0] * k,
        vc[1] * k,
        T.leaves,
        [tint[0] * shade, tint[1] * shade, tint[2] * shade],
      );
    });
  });
}
