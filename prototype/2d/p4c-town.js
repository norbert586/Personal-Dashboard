
// ============ Town buildings: houses, Main Street, church, props ============
const CHIMNEYS = [], STACKS = [];
// Sign text painted in wall space, so it shears correctly on isometric walls.
function textPaint(texts) {
  return (u, v) => {
    for (const t of texts) {
      const sc = t.sc || 1, du = u - t.u, dv = v - t.v; if (du < 0 || dv < 0 || dv >= 5 * sc || du >= textW(t.s, sc)) continue;
      const ci = Math.floor(du / (4 * sc)), cx = Math.floor((du - ci * 4 * sc) / sc); if (cx > 2) continue;
      const g = FONT[t.s[ci]] || FONT[' ']; if (g[(4 - Math.floor(dv / sc)) * 3 + cx] === '1') return t.tok;
    }
    return -1;
  };
}
const withText = (face, texts) => { const tp = textPaint(texts); return (u, v) => { const t = tp(u, v); return t >= 0 ? t : face(u, v); }; };

const HOUSE_STYLES = [
  { kind: 'siding', wall: 'sidW', roof: 'shG', door: 'doorB' }, { kind: 'siding', wall: 'sidB', roof: 'shB', door: 'doorR' },
  { kind: 'siding', wall: 'sidY', roof: 'shG', door: 'doorB' }, { kind: 'brick', wall: 'brickR', roof: 'shG', door: 'doorB' },
  { kind: 'brick', wall: 'brickB', roof: 'shB', door: 'doorR' }, { kind: 'stucco', wall: 'stucco', roof: 'shR', door: 'doorB' },
  { kind: 'siding', wall: 'sidG', roof: 'shB', door: 'doorR' }, { kind: 'brick', wall: 'brickY', roof: 'shG', door: 'doorR' },
];
function house(o) {
  const { x, y, w, d, f = 1, seed = 0 } = o, st = o.style || HOUSE_STYLES[Math.floor(hash(seed, 3) * HOUSE_STYLES.length)];
  const x1 = x + w, y1 = y + d, wh = f === 2 ? 38 : 20, rh = f === 2 ? 14 : 11, front = o.front || 'L', dir = o.dir || (w >= d ? 'x' : 'y');
  const lens = { L: Math.round(w * HW), R: Math.round(d * HW) }, garageOn = o.garage === undefined ? true : o.garage;
  const face = (side) => {
    const len = lens[side], isFront = side === front, doors = [], rects = [];
    let wins = winGrid(len, Math.max(2, Math.round(len / 24)), 9, 11, 6, { rows: f, pitch: 19, seed: seed + (side === 'L' ? 1 : 2), lit: 0.5 });
    if (isFront) { doors.push({ u: 6, w: 9, h: 17, mat: st.door }); rects.push([4, 17]); }
    if (isFront && garageOn && len >= 58) { const gu = len - 31; wins.unshift({ u: gu, v: 0, w: 26, h: 15, k: 'garage' }); rects.push([gu - 2, gu + 28]); }
    wins = wins.filter((wn) => wn.k === 'garage' || !rects.some((r) => wn.u + wn.w > r[0] && wn.u < r[1] && wn.v < 18));
    return facade({ kind: st.kind, mat: st.wall, seed, wins, doors, bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 1 }, { v0: wh - 2, v1: wh, mat: st.wall, lv: 0 }] });
  };
  const Lp = face('L'), Rp = face('R');
  const endP = facade({ kind: st.kind, mat: st.wall, seed, wins: [{ u: Math.round((dir === 'x' ? lens.R : lens.L) / 2) - 3, v: 3, w: 7, h: 7, k: 'fix', lit: hash(seed, 9) < 0.4 }] });
  obj(o.id || 0, keyOf(x1, y1), () => {
    aoStrip([P(x, y1), P(x1, y1), P(x1, y1 + 0.14), P(x, y1 + 0.14)]); aoStrip([P(x1, y), P(x1 + 0.14, y), P(x1 + 0.14, y1), P(x1, y1)]);
    box(x, y, x1, y1, 0, wh, { L: Lp, R: Rp });
    gable(x, y, x1, y1, wh, rh, dir, o.metal ? seamP(st.roof === 'shR' ? 'metalR' : 'metalR', dir) : shingleP(st.roof, dir), endP);
    if (o.chimney !== false) { const bk = facade({ kind: 'brick', mat: 'brickB' }), cx = x + w * 0.3, cy = (dir === 'x' ? (y + y1) / 2 - 0.16 : y + d * 0.3); box(cx, cy, cx + 0.14, cy + 0.14, wh + rh * 0.55, rh * 0.55 + 10, { L: bk, R: bk, top: flat(M.brickB + 0) }); }
  });
  caster(x, y, x1, y1, wh + rh * 0.75);
  if (o.chimney !== false) CHIMNEYS.push([x + w * 0.3 + 0.07, (dir === 'x' ? (y + y1) / 2 - 0.09 : y + d * 0.3 + 0.07), wh + rh + 10]);
  const lf = front === 'L' ? [x + w * 0.5, y1, 12] : [x1, y + d * 0.5, 12]; if (hash(seed, 7) < 0.7) light(lf[0], lf[1], lf[2], 30, [255, 190, 100], 0.8);
}
function mailbox(gx, gy) { const [x, y] = P(gx, gy); for (let z = 0; z < 8; z++) put(x, y - z, pix(M.wood + 1, 2)); for (let k = -2; k <= 2; k++) { put(x + k, y - 9, pix(M.steel + 1, 1)); put(x + k, y - 10, pix(M.steel + 2, 0)); } put(x + 3, y - 10, pix(M.red + 2, 2)); }
function lampPost(gx, gy, h = 26) { pole(gx, gy, 0, h, pix(M.dark + 1, 2), 2); const [x, y] = P(gx, gy, h); for (let k = -3; k <= 3; k++) put(x + k, y - 1, pix(M.dark + 1, 0)); put(x - 3, y, pix(M.lampLit + 1)); put(x - 2, y, pix(M.lampLit + 1)); light(gx, gy, h - 2, 46, [255, 190, 100], 0.9); caster(gx - 0.02, gy - 0.02, gx + 0.02, gy + 0.02, h); }
function bench(gx, gy) { const [x, y] = P(gx, gy); for (let k = -5; k <= 5; k++) { put(x + k, y - 5 + (k >> 1) * 0, pix(M.wood + 2, 0)); put(x + k, y - 3, pix(M.wood + 1, 1)); } for (const k of [-4, 4]) for (let z = 0; z < 4; z++) put(x + k, y - z, pix(M.steel, 2)); }
function utilityPole(gx, gy, h = 70) {
  pole(gx, gy, 0, h, pix(M.trunk + 1, 2), 2);
  const [x, y] = P(gx, gy, h); for (let k = -7; k <= 7; k++) put(x + k, y + (k >> 3), pix(M.trunk + 2, 0)); for (let k = -5; k <= 5; k++) put(x + k, y + 6, pix(M.trunk + 2, 0));
  return [x, y];
}
function wire(a, b, sag = 6) {
  const n = Math.max(Math.abs(b[0] - a[0]), 1), c = pix(M.steel + 0, 2);
  for (let i = 0; i <= n; i++) { const t = i / n; put(Math.round(a[0] + (b[0] - a[0]) * t), Math.round(a[1] + (b[1] - a[1]) * t + sag * 4 * t * (1 - t)), c); }
}
function fence(x0, y0, x1, y1, h = 6, mat = 'wood') {
  const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 0.12));
  for (let i = 0; i <= n; i++) pole(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 0, h, pix(M[mat] + 2, 2));
}

// ---- Main Street storefront ----
function shop(o) {
  const { x0, x1, y0, y1, floors = 2, brick = 'brickR', awn = 'awnR', id = 0, name = '', ntok } = o, len = Math.round((x1 - x0) * HW), side = Math.round((y1 - y0) * HW), seed = o.seed || 1, lit = o.lit ?? 0.5;
  const one = floors === 1, H = one ? 31 : 33 + (floors - 1) * 20, wins = [{ u: 5, v: 3, w: len - 22, h: one ? 17 : 18, k: 'store', lit: hash(seed, 2) < lit + 0.2 }];
  const cols = Math.max(2, Math.round(len / 22)), gap = (len - cols * 9) / (cols + 1);
  if (!one) for (let r = 1; r < floors; r++) for (let c = 0; c < cols; c++) wins.push({ u: Math.round(gap + c * (9 + gap)), v: 35 + (r - 1) * 20, w: 9, h: 14, k: 'arch', lit: hash(c + r * 5, seed) < lit });
  const texts = name ? [{ s: name, u: Math.max(2, Math.round((len - textW(name, 1)) / 2)), v: one ? 22 : 27, sc: 1, tok: ntok ?? M.neonY + 1 }] : [];
  const awning = (u, v) => { const t = ((u + seed) >> 2) & 1; return v === 21 ? M[awn] + 0 : M[awn] + (t ? 2 : 3) - (v > 22 ? 1 : 0); };
  const bands = [{ v0: H - 4, v1: H - 3, mat: 'trim', lv: 2 }, { v0: H - 3, v1: H, mat: 'trim', lv: 1 }]; if (!one) bands.unshift({ v0: 21, v1: 26, fn: awning });
  let Lp = facade({ kind: 'brick', mat: brick, seed, wins, doors: [{ u: len - 16, w: 11, h: 21, mat: 'doorR', glass: true, lit: true }], bands }); if (texts.length) Lp = withText(Lp, texts);
  const sideWins = []; for (let r = 0; r < floors; r++) for (let c = 0; c < 2; c++) sideWins.push({ u: 8 + c * Math.round(side / 2), v: r ? 35 + (r - 1) * 20 : 8, w: 8, h: 11, k: 'arch', lit: false });
  const Rp = facade({ kind: 'brick', mat: brick, seed: seed + 3, wins: sideWins, bands: [{ v0: H - 4, v1: H, mat: 'trim', lv: 1 }] });
  obj(id, keyOf(x1, y1), () => { box(x0, y0, x1, y1, 0, H, { L: Lp, R: Rp }); flatRoof(x0, y0, x1, y1, H, 'flatR', 3, brick); if (hash(seed, 4) < 0.6) { const f = facade({ kind: 'tin', mat: 'tin' }); box(x0 + (x1 - x0) * 0.3, y0 + (y1 - y0) * 0.3, x0 + (x1 - x0) * 0.3 + 0.3, y0 + (y1 - y0) * 0.3 + 0.25, H, 7, { L: f, R: f, top: flat(M.steel + 2) }); } });
  caster(x0, y0, x1, y1, H + 3); light((x0 + x1) / 2, y1, 12, 34, [255, 200, 120], 0.7);
}

// ---- Church with steeple ----
function church(x, y, id = 0) {
  const nx1 = x + 3.0, y1 = y + 1.5, brick = facade({ kind: 'brick', mat: 'brickB', seed: 5 });
  const side = facade({ kind: 'brick', mat: 'brickB', seed: 5, wins: [8, 30, 52, 74].map((u) => ({ u, v: 8, w: 9, h: 22, k: 'arch', lit: true })), bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 1 }] });
  const tx0 = nx1 - 0.15, ty0 = y + 0.3, tx1 = nx1 + 0.8, ty1 = y1 - 0.3, tH = 62, tower = facade({ kind: 'brick', mat: 'brickB', seed: 8, wins: [{ u: 10, v: 40, w: 9, h: 16, k: 'arch', lit: true }, { u: 11, v: 8, w: 9, h: 16, k: 'arch', lit: false }], bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 1 }, { v0: tH - 3, v1: tH, mat: 'trim', lv: 2 }] });
  obj(id, keyOf(tx1, ty1), () => {
    box(x, y, nx1, y1, 0, 34, { L: brick, R: side });
    gable(x, y, nx1, y1, 34, 22, 'x', shingleP('shG', 'x', 5), brick);
    box(tx0, ty0, tx1, ty1, 0, tH, { L: tower, R: tower });
    const xm = (tx0 + tx1) / 2, ym = (ty0 + ty1) / 2, sp = [P(xm, ym, tH + 46)], slateP = (x, y) => M.shG + clampLv(2 + (((Math.floor(y / 4)) & 1) ? -1 : 0), 4);
    slope([P(tx0, ty1, tH), P(tx1, ty1, tH), sp[0]], 3, slateP); slope([P(tx1, ty0, tH), P(tx1, ty1, tH), sp[0]], 4, slateP);
    const [cx, cy] = P(xm, ym, tH + 46); for (let k = 1; k <= 9; k++) put(cx, cy - k, pix(M.trim + 2, 2)); for (let k = -2; k <= 2; k++) put(cx + k, cy - 6, pix(M.trim + 2, 2));
  });
  caster(x, y, nx1, y1, 40); caster(tx0, ty0, tx1, ty1, tH + 30);
  light(x + 1.5, y1, 20, 40, [255, 170, 80], 0.8);
}
