/**
 * The boards that show the feeds in town: the cinema's marquee, the comic shop's board, the sports
 * bar's scoreboard. Each is one small quad with its own texture, repainted in the sign font when
 * its page turns; the night layer lights them like the rest of the town's neon. What they say
 * comes from sign-pages.ts.
 */
import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  Mesh,
  MeshLambertMaterial,
  NearestFilter,
  RGBAFormat,
} from 'three';
import type { Town } from './scene.ts';
import { PAGE_SECONDS, type SignContent, type Tone } from './sign-pages.ts';
import { V } from './world/atlas.ts';
import type { BoardSkin, SignSlot, World } from './world/builders.ts';
import { M, type Palette } from './world/materials.ts';
import { textW, withText, type Painter, type SignText } from './world/painters.ts';

/** Rows of the status strip at the foot of a board, rule included. */
const STRIP = 7;

interface Look {
  bg: number;
  ink: Record<Tone, number>;
  /** The frame around the lines; `tick` steps twice a second so bulbs can chase. */
  frame: (along: number, tick: number) => number;
}
const LOOKS: Record<BoardSkin, Look> = {
  marquee: {
    bg: M.boardLit + 1,
    ink: { plain: M.dark, hot: M.red + 1, good: M.dark, bad: M.dark, dim: M.steel + 1 },
    frame: (along, tick) => ((along + tick) % 3 === 0 ? M.lampLit + 1 : M.dark + 2),
  },
  led: {
    bg: M.dark,
    ink: {
      plain: M.neonY + 1,
      hot: M.neonR + 1,
      good: M.ledG + 1,
      bad: M.neonR + 1,
      dim: M.neonY,
    },
    frame: () => M.steel + 1,
  },
  neon: {
    bg: M.doorB,
    ink: {
      plain: M.trim + 2,
      hot: M.neonY + 1,
      good: M.ledG + 1,
      bad: M.neonR + 1,
      dim: M.neonB + 1,
    },
    frame: () => M.neonB + 1,
  },
};

/** The token at each texel of a w×h board showing one page of its content. */
export function boardPainter(
  skin: BoardSkin,
  w: number,
  h: number,
  content: SignContent,
  pageIndex: number,
  tick = 0,
): Painter {
  const look = LOOKS[skin];
  const off = content.state === 'offline' || content.state === 'loading';
  const page = content.pages[pageIndex % Math.max(1, content.pages.length)];
  const texts: SignText[] = [];
  const centre = (s: string) => Math.max(2, Math.floor((w - textW(s)) / 2));
  // Two lines above the strip: the first on top.
  (page?.lines ?? []).forEach((s, i) => {
    if (!s) return;
    const tone = page?.tones?.[i] ?? 'plain';
    texts.push({ s, u: centre(s), v: h - 7 - i * 7, tok: off ? M.steel + 2 : look.ink[tone] });
  });
  const statusTok =
    content.state === 'live' || content.state === 'local'
      ? M.ledG + 1
      : content.state === 'offline'
        ? M.neonR + 1
        : M.boardLit; // lit, so "SAMPLE DATA" still reads after dark
  texts.push({ s: content.status, u: 7, v: 1, tok: statusTok });
  const base: Painter = (u, v) => {
    if (v < STRIP) {
      // The status strip: a pixel mark (filled = live, hollow = sample), then the word.
      if (v === STRIP - 1) return M.steel;
      const mu = u - 2;
      const mv = v - 2;
      if (mu >= 0 && mu < 3 && mv >= 0 && mv < 3 && content.state !== 'loading')
        return content.state === 'sample' && mu === 1 && mv === 1 ? M.dark : statusTok;
      return M.dark;
    }
    if (u === 0 || u === w - 1 || v === h - 1 || v === STRIP)
      return look.frame(u === 0 || u === w - 1 ? v : u, tick);
    return off ? M.dark + 1 : look.bg;
  };
  return withText(base, texts);
}

interface Board {
  slot: SignSlot;
  w: number;
  h: number;
  col: DataTexture;
  emi: DataTexture;
  content: SignContent;
  painted: string;
  version: number;
}

function texture(w: number, h: number): DataTexture {
  const t = new DataTexture(new Uint8Array(w * h * 4), w, h, RGBAFormat);
  t.magFilter = NearestFilter;
  t.minFilter = NearestFilter;
  t.generateMipmaps = false;
  return t;
}

export class SignBoards {
  private readonly boards = new Map<string, Board>();
  private readonly palette: Palette;

  constructor(town: Town, world: World) {
    this.palette = world.palette;
    for (const slot of world.signs) {
      const w = Math.max(8, Math.round(Math.hypot(slot.bx - slot.ax, slot.by - slot.ay) * 32));
      const h = Math.round(slot.z1 - slot.z0);
      const col = texture(w, h);
      const emi = texture(w, h);
      const g = new BufferGeometry();
      const a0 = V(slot.ax, slot.ay, slot.z0);
      const b0 = V(slot.bx, slot.by, slot.z0);
      const b1 = V(slot.bx, slot.by, slot.z1);
      const a1 = V(slot.ax, slot.ay, slot.z1);
      g.setAttribute(
        'position',
        new Float32BufferAttribute([...a0, ...b0, ...b1, ...a0, ...b1, ...a1], 3),
      );
      g.setAttribute('uv', new Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 0, 1, 1, 0, 1], 2));
      g.computeVertexNormals();
      const material = new MeshLambertMaterial({
        map: col,
        emissive: 0xffffff,
        emissiveMap: emi,
        emissiveIntensity: 0,
      });
      const mesh = new Mesh(g, material);
      mesh.receiveShadow = true;
      town.scene.add(mesh);
      town.hits.push(mesh); // a click on the board walks you to its door
      town.lit.push(material);
      this.boards.set(slot.key, {
        slot,
        w,
        h,
        col,
        emi,
        content: { state: 'loading', status: 'TUNING IN', pages: [{ lines: ['ONE MOMENT', ''] }] },
        painted: '',
        version: 0,
      });
    }
  }

  /** Change what a feed's board says. */
  set(key: string, content: SignContent): void {
    const board = this.boards.get(key);
    if (!board) return;
    board.content = content;
    board.version++;
  }

  /** Turn pages for time t (seconds); `still` holds the first page and the bulbs (reduced motion). */
  update(t: number, still: boolean): void {
    for (const board of this.boards.values()) {
      const pages = Math.max(1, board.content.pages.length);
      const page = still ? 0 : Math.floor(t / PAGE_SECONDS) % pages;
      const tick = still || board.slot.skin !== 'marquee' ? 0 : Math.floor(t * 2) % 3;
      const key = `${board.version}:${page}:${tick}`;
      if (key === board.painted) continue;
      board.painted = key;
      this.paint(board, boardPainter(board.slot.skin, board.w, board.h, board.content, page, tick));
    }
  }

  private paint(board: Board, painter: Painter): void {
    const { w, h } = board;
    const { rgb, emissive } = this.palette;
    const col = board.col.image.data as Uint8Array;
    const emi = board.emi.image.data as Uint8Array;
    for (let v = 0; v < h; v++)
      for (let u = 0; u < w; u++) {
        const t = painter(u, v);
        const c = rgb[t] ?? rgb[M.dark]!;
        const e = emissive[t];
        const i = (v * w + u) * 4;
        col[i] = c[0];
        col[i + 1] = c[1];
        col[i + 2] = c[2];
        col[i + 3] = 255;
        emi[i] = e ? e[0] : 0;
        emi[i + 1] = e ? e[1] : 0;
        emi[i + 2] = e ? e[2] : 0;
        emi[i + 3] = 255;
      }
    board.col.needsUpdate = true;
    board.emi.needsUpdate = true;
  }
}
