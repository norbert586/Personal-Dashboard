/**
 * Click to walk (DESIGN: Moving around): a walkable grid at 4 cells per tile, A* around buildings,
 * then string-pulling so you walk straight lines between the corners you can't see past.
 */
import { blocked } from './you.ts';
import type { World } from './world/builders.ts';

export type Point = [number, number];

export interface Nav {
  x0: number;
  y0: number;
  /** Cells per tile. */
  n: number;
  w: number;
  h: number;
  block: Uint8Array;
}

export function buildNav(world: World): Nav {
  const nav: Nav = { x0: -3, y0: -3, n: 4, w: 152, h: 152, block: new Uint8Array(152 * 152) };
  for (let j = 0; j < nav.h; j++)
    for (let i = 0; i < nav.w; i++)
      nav.block[j * nav.w + i] = blocked(
        world,
        nav.x0 + (i + 0.5) / nav.n,
        nav.y0 + (j + 0.5) / nav.n,
        0.1,
      )
        ? 1
        : 0;
  return nav;
}

const cellOf = (nav: Nav, x: number, y: number): Point => [
  Math.floor((x - nav.x0) * nav.n),
  Math.floor((y - nav.y0) * nav.n),
];
const cellAt = (nav: Nav, i: number, j: number): Point => [
  nav.x0 + (i + 0.5) / nav.n,
  nav.y0 + (j + 0.5) / nav.n,
];
const free = (nav: Nav, i: number, j: number) =>
  i >= 0 && j >= 0 && i < nav.w && j < nav.h && !nav.block[j * nav.w + i];

function nearestFree(nav: Nav, [i, j]: Point): Point | null {
  if (free(nav, i, j)) return [i, j];
  for (let r = 1; r < 30; r++)
    for (let dj = -r; dj <= r; dj++)
      for (let di = -r; di <= r; di++)
        if (Math.max(Math.abs(di), Math.abs(dj)) === r && free(nav, i + di, j + dj))
          return [i + di, j + dj];
  return null;
}

function sight(nav: Nav, p: Point, q: Point): boolean {
  const steps = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) * nav.n * 2);
  for (let k = 1; k <= steps; k++) {
    const [i, j] = cellOf(
      nav,
      p[0] + ((q[0] - p[0]) * k) / steps,
      p[1] + ((q[1] - p[1]) * k) / steps,
    );
    if (!free(nav, i, j)) return false;
  }
  return true;
}

/** A path from (sx, sy) to (tx, ty) as the corners to walk through, or null if there's none. */
export function findPath(nav: Nav, sx: number, sy: number, tx: number, ty: number): Point[] | null {
  const s = nearestFree(nav, cellOf(nav, sx, sy));
  const t = nearestFree(nav, cellOf(nav, tx, ty));
  if (!s || !t) return null;
  const W = nav.w;
  const N = W * nav.h;
  const g = new Float32Array(N).fill(Infinity);
  const came = new Int32Array(N).fill(-1);
  const done = new Uint8Array(N);
  // a binary heap of [f, cell]
  const heap: Array<[number, number]> = [];
  const push = (f: number, k: number) => {
    heap.push([f, k]);
    let c = heap.length - 1;
    while (c > 0) {
      const p = (c - 1) >> 1;
      if (heap[p]![0] <= heap[c]![0]) break;
      [heap[p], heap[c]] = [heap[c]!, heap[p]!];
      c = p;
    }
  };
  const pop = (): number => {
    const top = heap[0]!;
    const last = heap.pop()!;
    if (heap.length) {
      heap[0] = last;
      let c = 0;
      for (;;) {
        const l = 2 * c + 1;
        const r = l + 1;
        let m = c;
        if (l < heap.length && heap[l]![0] < heap[m]![0]) m = l;
        if (r < heap.length && heap[r]![0] < heap[m]![0]) m = r;
        if (m === c) break;
        [heap[m], heap[c]] = [heap[c]!, heap[m]!];
        c = m;
      }
    }
    return top[1];
  };
  const h = (i: number, j: number) => {
    const a = Math.abs(i - t[0]);
    const b = Math.abs(j - t[1]);
    return Math.max(a, b) + 0.414 * Math.min(a, b);
  };
  const si = s[1] * W + s[0];
  const ti = t[1] * W + t[0];
  g[si] = 0;
  push(h(s[0], s[1]), si);
  while (heap.length) {
    const k = pop();
    if (done[k]) continue;
    done[k] = 1;
    if (k === ti) break;
    const i = k % W;
    const j = (k / W) | 0;
    for (let dj = -1; dj <= 1; dj++)
      for (let di = -1; di <= 1; di++) {
        if ((!di && !dj) || !free(nav, i + di, j + dj)) continue;
        // no cutting corners
        if (di && dj && (!free(nav, i + di, j) || !free(nav, i, j + dj))) continue;
        const nk = (j + dj) * W + i + di;
        const ng = g[k]! + (di && dj ? 1.414 : 1);
        if (ng < g[nk]!) {
          g[nk] = ng;
          came[nk] = k;
          push(ng + h(i + di, j + dj), nk);
        }
      }
  }
  if (ti !== si && came[ti]! < 0) return null;
  const pts: Point[] = [];
  for (let k = ti; ; k = came[k]!) {
    pts.push(cellAt(nav, k % W, (k / W) | 0));
    if (k === si || came[k]! < 0) break;
  }
  pts.reverse();
  const [ci, cj] = cellOf(nav, tx, ty);
  if (free(nav, ci, cj)) pts[pts.length - 1] = [tx, ty];
  // string-pull: keep only the corners you can't see past
  const out: Point[] = [[sx, sy]];
  let a = 0;
  while (a < pts.length - 1) {
    let b = pts.length - 1;
    while (b > a + 1 && !sight(nav, out[out.length - 1]!, pts[b]!)) b--;
    out.push(pts[b]!);
    a = b;
  }
  return out.slice(1);
}

/** How far is left to walk along a path from (x, y). */
export function pathLength(path: Point[], x: number, y: number): number {
  let L = 0;
  for (const [px, py] of path) {
    L += Math.hypot(px - x, py - y);
    x = px;
    y = py;
  }
  return L;
}
