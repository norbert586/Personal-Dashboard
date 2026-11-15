/**
 * A grid of line segments, for the questions the delivery mode keeps asking: which street am I on,
 * which walls are near the car, is there room for a tree here. Pure, so it's unit-tested.
 */

export interface Near {
  /** The id the segment was added with. */
  id: number;
  /** Distance to the segment, in metres. */
  d: number;
  /** The closest point on it. */
  x: number;
  y: number;
  /** The segment's direction, as a unit vector. */
  dx: number;
  dy: number;
}

export class SegGrid {
  private readonly cell: number;
  private readonly cells = new Map<number, number[]>();
  /** ax, ay, bx, by, id for each segment. */
  private readonly segs: number[] = [];

  constructor(cell: number) {
    this.cell = cell;
  }

  get size(): number {
    return this.segs.length / 5;
  }

  private key(cx: number, cy: number): number {
    return (cx + 32768) * 65536 + (cy + 32768);
  }

  add(ax: number, ay: number, bx: number, by: number, id: number): void {
    const at = this.segs.length;
    this.segs.push(ax, ay, bx, by, id);
    const c = this.cell;
    const x0 = Math.floor(Math.min(ax, bx) / c);
    const x1 = Math.floor(Math.max(ax, bx) / c);
    const y0 = Math.floor(Math.min(ay, by) / c);
    const y1 = Math.floor(Math.max(ay, by) / c);
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const k = this.key(cx, cy);
        const list = this.cells.get(k);
        if (list) list.push(at);
        else this.cells.set(k, [at]);
      }
  }

  /** Call `visit` for every segment that might be within `reach` of a point (some will be further). */
  each(
    x: number,
    y: number,
    reach: number,
    visit: (ax: number, ay: number, bx: number, by: number, id: number) => void,
  ): void {
    const c = this.cell;
    const s = this.segs;
    const x0 = Math.floor((x - reach) / c);
    const x1 = Math.floor((x + reach) / c);
    const y0 = Math.floor((y - reach) / c);
    const y1 = Math.floor((y + reach) / c);
    const one = x0 === x1 && y0 === y1;
    const seen = one ? null : new Set<number>();
    for (let cx = x0; cx <= x1; cx++)
      for (let cy = y0; cy <= y1; cy++) {
        const list = this.cells.get(this.key(cx, cy));
        if (!list) continue;
        for (const at of list) {
          if (seen) {
            if (seen.has(at)) continue;
            seen.add(at);
          }
          visit(s[at]!, s[at + 1]!, s[at + 2]!, s[at + 3]!, s[at + 4]!);
        }
      }
  }

  /** The closest segment within `reach` of a point, or null. `accept` can rule segments out. */
  nearest(x: number, y: number, reach: number, accept?: (id: number) => boolean): Near | null {
    let best: Near | null = null;
    this.each(x, y, reach, (ax, ay, bx, by, id) => {
      if (accept && !accept(id)) return;
      const ex = bx - ax;
      const ey = by - ay;
      const len2 = ex * ex + ey * ey;
      const t = len2 > 0 ? Math.max(0, Math.min(1, ((x - ax) * ex + (y - ay) * ey) / len2)) : 0;
      const px = ax + ex * t;
      const py = ay + ey * t;
      const d = Math.hypot(x - px, y - py);
      if (d > reach || (best && d >= best.d)) return;
      const len = Math.sqrt(len2) || 1;
      best = { id, d, x: px, y: py, dx: ex / len, dy: ey / len };
    });
    return best;
  }
}
