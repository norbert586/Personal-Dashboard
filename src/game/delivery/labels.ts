/**
 * Sign lettering (DESIGN: Delivery mode): every sign's words, painted once into one small texture
 * in the town's 3 by 5 pixel font. Letters are "glass" texels, so they glow after dark; the panel
 * behind them takes the sign's tint. Laying the words out is pure, so it's unit-tested.
 */
import { DataTexture, LinearMipmapLinearFilter, NearestFilter, RGBAFormat } from 'three';
import { glyphOf } from '../world/painters.ts';

/** Where a label sits in the texture (0 to 1), and its size in pixels. */
export interface Label {
  u0: number;
  v0: number;
  u1: number;
  v1: number;
  w: number;
  h: number;
}

const PAD = 2;
const LINE = 6;
const WIDTH = 512;

/** Words as the sign font can draw them, wrapped to lines of at most `chars` letters. */
export function layOut(text: string, chars: number, lines: number): string[] {
  const plain = [...text.normalize('NFD').toUpperCase()]
    .map((ch) => (ch === '’' ? "'" : ch === '–' || ch === '—' ? '-' : ch))
    .filter((ch) => glyphOf(ch) !== null)
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
  const out: string[] = [];
  let line = '';
  for (const word of plain.split(' ')) {
    let rest = word;
    // A word too long for a line is cut.
    while (rest.length > chars) {
      if (line) out.push(line);
      line = '';
      out.push(rest.slice(0, chars));
      rest = rest.slice(chars);
    }
    if (!rest) continue;
    if (line && line.length + 1 + rest.length > chars) {
      out.push(line);
      line = rest;
    } else line = line ? `${line} ${rest}` : rest;
  }
  if (line) out.push(line);
  return out.slice(0, lines);
}

export class Labels {
  private readonly ids = new Map<string, number>();
  private readonly texts: string[][] = [];
  private readonly rects: Label[] = [];

  /** Ask for a label; returns its id. The same words asked for twice share one. */
  add(text: string, chars = 11, lines = 3): number {
    const laid = layOut(text, chars, lines);
    const key = laid.join('\n');
    let id = this.ids.get(key);
    if (id === undefined) {
      id = this.texts.push(laid) - 1;
      this.ids.set(key, id);
    }
    return id;
  }

  get(id: number): Label {
    return this.rects[id]!;
  }

  /** Paint every label asked for so far. */
  build(): DataTexture {
    // Shelves: labels side by side, a new row when one doesn't fit.
    const spots: Array<{ x: number; y: number; w: number; h: number }> = [];
    let x = 0;
    let y = 0;
    let shelf = 0;
    for (const lines of this.texts) {
      const w = Math.max(1, ...lines.map((l) => l.length * 4 - 1)) + PAD * 2;
      const h = Math.max(1, lines.length) * LINE - 1 + PAD * 2;
      if (x + w > WIDTH) {
        x = 0;
        y += shelf + 1;
        shelf = 0;
      }
      spots.push({ x, y, w, h });
      x += w + 1;
      shelf = Math.max(shelf, h);
    }
    let height = 16;
    while (height < y + shelf + 1) height *= 2;
    const data = new Uint8Array(WIDTH * height * 4).fill(255);
    this.texts.forEach((lines, id) => {
      const { x: left, y: bottom, w, h } = spots[id]!;
      lines.forEach((line, row) => {
        // Rows of the texture run upward; lines of a sign run downward.
        const base = bottom + h - PAD - (row + 1) * LINE + 1;
        const start = left + Math.floor((w - (line.length * 4 - 1)) / 2);
        [...line].forEach((ch, i) => {
          const glyph = glyphOf(ch) ?? '';
          for (let gy = 0; gy < 5; gy++)
            for (let gx = 0; gx < 3; gx++)
              if (glyph[gy * 3 + gx] === '1')
                data[((base + 4 - gy) * WIDTH + start + i * 4 + gx) * 4 + 3] = 128;
        });
      });
      this.rects[id] = {
        u0: left / WIDTH,
        v0: bottom / height,
        u1: (left + w) / WIDTH,
        v1: (bottom + h) / height,
        w,
        h,
      };
    });
    const texture = new DataTexture(data, WIDTH, height, RGBAFormat);
    texture.magFilter = NearestFilter;
    texture.minFilter = LinearMipmapLinearFilter;
    texture.generateMipmaps = true;
    texture.needsUpdate = true;
    return texture;
  }
}
