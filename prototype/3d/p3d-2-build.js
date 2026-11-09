
// ============ 3D versions of the town's builders (same names and arguments as the 2D ones) ============
// Later declarations win, so buildWorld() runs unchanged and produces geometry instead of pixels.
const backOf = (kind, mat, len, seed, rows = 1) => facade({ kind, mat, seed: seed + 7, wins: winGrid(len, Math.max(1, Math.round(len / 30)), 8, 11, 8, { rows, pitch: 19, seed: seed + 9, lit: 0.3 }) });
const centerText = (s, len, v, tok) => ({ s, u: Math.max(1, Math.round((len - textW(s)) / 2)), v, sc: 1, tok });

function house(o) {
  const { x, y, w, d, f = 1, seed = 0 } = o, st = o.style || HOUSE_STYLES[Math.floor(hash(seed, 3) * HOUSE_STYLES.length)];
  const x1 = x + w, y1 = y + d, wh = f === 2 ? 38 : 20, rh = f === 2 ? 14 : 11, front = o.front || 'L', dir = o.dir || (w >= d ? 'x' : 'y');
  const garageOn = o.garage === undefined ? true : o.garage, LW = Math.round(w * HW), RW = Math.round(d * HW);
  const face = (len, isFront, sd) => {
    const doors = [], rects = [];
    let wins = winGrid(len, Math.max(2, Math.round(len / 24)), 9, 11, 6, { rows: f, pitch: 19, seed: seed + sd, lit: 0.5 });
    if (isFront) { doors.push({ u: 6, w: 9, h: 17, mat: st.door }); rects.push([4, 17]); }
    if (isFront && garageOn && len >= 58) { const gu = len - 31; wins.unshift({ u: gu, v: 0, w: 26, h: 15, k: 'garage' }); rects.push([gu - 2, gu + 28]); }
    wins = wins.filter((wn) => wn.k === 'garage' || !rects.some((r) => wn.u + wn.w > r[0] && wn.u < r[1] && wn.v < 18));
    return facade({ kind: st.kind, mat: st.wall, seed, wins, doors, bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 1 }, { v0: wh - 2, v1: wh, mat: st.wall, lv: 0 }] });
  };
  const endP = facade({ kind: st.kind, mat: st.wall, seed, wins: [{ u: Math.round((dir === 'x' ? RW : LW) / 2) - 3, v: 3, w: 7, h: 7, k: 'fix', lit: hash(seed, 9) < 0.4 }] });
  box3(x, y, x1, y1, 0, wh, { f: face(LW, front === 'L', 1), r: face(RW, front === 'R', 2), b: face(LW, false, 3), l: face(RW, false, 4), t: false });
  gable3(x, y, x1, y1, wh, rh, dir, o.metal ? seam3('metalR') : shingle3(st.roof), endP, 0.07);
  if (o.chimney !== false) {
    const bk = facade({ kind: 'brick', mat: 'brickB' }), cx = x + w * 0.3, cy = dir === 'x' ? (y + y1) / 2 - 0.16 : y + d * 0.3;
    box3(cx, cy, cx + 0.14, cy + 0.14, wh + rh * 0.4, rh * 0.75 + 10, { f: bk, t: () => M.dark + 0 }); CHIMNEYS.push([cx + 0.07, cy + 0.07, wh + rh + 10]);
  }
  collide(x, y, x1, y1);
  const dp = front === 'L' ? [x + 0.33, y1 + 0.22] : [x1 + 0.22, y1 - 0.33];
  if (hash(seed, 7) < 0.7) light(dp[0], dp[1], 14, 30, [255, 190, 100], 0.8);
  door(o.id, dp[0], dp[1]);
}

function shop(o) {
  const { x0, x1, y0, y1, floors = 2, brick = 'brickR', awn = 'awnR', id = 0, name = '', ntok } = o, len = Math.round((x1 - x0) * HW), side = Math.round((y1 - y0) * HW), seed = o.seed || 1, lit = o.lit ?? 0.5;
  const one = floors === 1, H = one ? 31 : 33 + (floors - 1) * 20, wins = [{ u: 5, v: 3, w: len - 22, h: one ? 17 : 18, k: 'store', lit: hash(seed, 2) < lit + 0.2 }];
  const cols = Math.max(2, Math.round(len / 22)), gap = (len - cols * 9) / (cols + 1);
  if (!one) for (let r = 1; r < floors; r++) for (let c = 0; c < cols; c++) wins.push({ u: Math.round(gap + c * (9 + gap)), v: 35 + (r - 1) * 20, w: 9, h: 14, k: 'arch', lit: hash(c + r * 5, seed) < lit });
  const stripe = (u) => ((u + seed) >> 2) & 1, awning = (u, v) => (v === 21 ? M[awn] + 0 : M[awn] + (stripe(u) ? 2 : 3) - (v > 22 ? 1 : 0));
  const bands = [{ v0: H - 4, v1: H - 3, mat: 'trim', lv: 2 }, { v0: H - 3, v1: H, mat: 'trim', lv: 1 }]; if (!one) bands.unshift({ v0: 21, v1: 26, fn: awning });
  let Lp = facade({ kind: 'brick', mat: brick, seed, wins, doors: [{ u: len - 16, w: 11, h: 21, mat: 'doorR', glass: true, lit: true }], bands });
  if (name) Lp = withText(Lp, [centerText(name, len, one ? 22 : 27, ntok ?? M.neonY + 1)]);
  const sideWins = []; for (let r = 0; r < floors; r++) for (let c = 0; c < 2; c++) sideWins.push({ u: 8 + c * Math.round(side / 2), v: r ? 35 + (r - 1) * 20 : 8, w: 8, h: 11, k: 'arch', lit: false });
  const Rp = facade({ kind: 'brick', mat: brick, seed: seed + 3, wins: sideWins, bands: [{ v0: H - 4, v1: H, mat: 'trim', lv: 1 }] });
  box3(x0, y0, x1, y1, 0, H, { f: Lp, r: Rp, b: backOf('brick', brick, len, seed, floors), l: Rp, t: false });
  flatRoof3(x0, y0, x1, y1, H, 'flatR', 3, brick);
  if (hash(seed, 4) < 0.6) { const ux = x0 + (x1 - x0) * 0.3, uy = y0 + (y1 - y0) * 0.3, tin = facade({ kind: 'tin', mat: 'tin' }); box3(ux, uy, ux + 0.3, uy + 0.25, H, 7, { f: tin, t: () => M.steel + 2 }); }
  if (!one) { // a real awning that sticks out over the sidewalk
    const a0 = x0 + 0.08, a1 = x1 - 0.08, out = y1 + 0.22;
    slope3(V(a0, out, 20), V(a1, out, 20), V(a1, y1, 26), V(a0, y1, 26), (u, v) => M[awn] + (stripe(u) ? 2 : 3) - (v < 2 ? 1 : 0), a1 - a0, 0.26);
    wall3(a0, out, a1, out, 17, 20, (u) => M[awn] + (stripe(u) ? 1 : 3));
  }
  collide(x0, y0, x1, y1); light((x0 + x1) / 2, y1 + 0.2, 14, 34, [255, 200, 120], 0.7);
  door(id, x0 + (len - 10.5) / HW, y1 + 0.3);
}

function church(x, y, id = 0) {
  const nx1 = x + 3.0, y1 = y + 1.5, plain = facade({ kind: 'brick', mat: 'brickB', seed: 5 });
  const nave = facade({ kind: 'brick', mat: 'brickB', seed: 5, wins: [8, 30, 52, 74].map((u) => ({ u, v: 8, w: 9, h: 22, k: 'arch', lit: true })), bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 1 }] });
  const tx0 = nx1 - 0.15, ty0 = y + 0.3, tx1 = nx1 + 0.8, ty1 = y1 - 0.3, tH = 62;
  const tower = facade({ kind: 'brick', mat: 'brickB', seed: 8, wins: [{ u: 10, v: 40, w: 9, h: 16, k: 'arch', lit: true }, { u: 11, v: 8, w: 9, h: 16, k: 'arch', lit: false }], doors: [{ u: 9, w: 12, h: 20, mat: 'doorR' }], bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 1 }, { v0: tH - 3, v1: tH, mat: 'trim', lv: 2 }] });
  box3(x, y, nx1, y1, 0, 34, { f: nave, r: plain, b: nave, l: plain, t: false });
  gable3(x, y, nx1, y1, 34, 22, 'x', shingle3('shG'), plain, 0.06);
  box3(tx0, ty0, tx1, ty1, 0, tH, { f: tower, t: false });
  cone3((tx0 + tx1) / 2, (ty0 + ty1) / 2, 0.66, tH, tH + 46, (u, v) => M.shG + clampLv(2 + ((Math.floor(v / 4) & 1) ? -1 : 0), 4), 4, Math.PI / 4);
  const cx = (tx0 + tx1) / 2, cy = (ty0 + ty1) / 2; post3(cx, cy, 0.012, tH + 44, 12, M.trim + 2); sbox3(cx - 0.05, cy - 0.012, cx + 0.05, cy + 0.012, tH + 51, 2, M.trim + 2);
  collide(x, y, nx1, y1); collide(tx0, ty0, tx1, ty1); light(x + 1.5, y1 + 0.2, 20, 40, [255, 170, 80], 0.8);
}

function hangar(id, x0, y0, x1, y1, R, open) {
  const xc = (x0 + x1) / 2, rx = (x1 - x0) / 2, N = 14, pr = [], len = (x1 - x0);
  for (let i = 0; i <= N; i++) { const a = (Math.PI * i) / N; pr.push([xc + rx * Math.cos(a), R * Math.sin(a)]); }
  const dw = Math.round(rx * HW * 1.3), dh = Math.round(R * 0.7), du0 = Math.round(rx * HW - dw / 2);
  const front = (u, v) => {
    if (u >= du0 && u < du0 + dw && v < dh) {
      if (open) return v > dh - 3 ? M.dark + 2 : (v > dh * 0.55 && u > du0 + 3 && u < du0 + dw - 3 && v < dh * 0.62) ? M.lampLit + 1 : M.dark + (v > dh * 0.6 ? 1 : 0);
      return (u - du0) % 9 === 0 || v % 7 === 0 ? M.steel + 0 : M.steel + (u < du0 + dw / 2 ? 2 : 1);
    }
    if (v >= dh && v < dh + 2 && u >= du0 - 2 && u < du0 + dw + 2) return (u >> 2) & 1 ? M.orange + 1 : M.dark + 1;
    return v < 2 ? M.cmu + 1 : corr3(u);
  };
  for (let i = 1; i <= N; i++) {
    const [xa, za] = pr[i - 1], [xb, zb] = pr[i];
    slope3(V(xa, y1, za), V(xa, y0, za), V(xb, y0, zb), V(xb, y1, zb), corr3, y1 - y0, Math.hypot(xb - xa, (zb - za) / ZPX));
  }
  const arcF = [[0, 0], [len, 0]], arcB = [[0, 0], [len, 0]];
  for (let i = 1; i < N; i++) arcF.push([pr[i][0] - x0, pr[i][1]]);
  for (let i = N - 1; i >= 1; i--) arcB.push([x1 - pr[i][0], pr[i][1]]);
  wallPoly3(x0, y1, x1, y1, arcF, front, 0);
  wallPoly3(x1, y0, x0, y0, arcB, (u, v) => (v < 2 ? M.cmu + 1 : corr3(u)), 0);
  collide(x0, y0, x1, y1); if (open) light(xc, y1 + 0.2, 14, 40, [255, 220, 150], 0.7);
  door(id, xc, y1 + 0.3);
}

function terminal(id, x0, y0, x1, y1) {
  const len = Math.round((x1 - x0) * HW), H = 36, side = Math.round((y1 - y0) * HW);
  const glassFront = facade({ kind: 'cmu', mat: 'cmu', wins: winGrid(len, Math.round(len / 14), 11, 22, 3, { k: 'fix', lit: 0.9, seed: 3 }), bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 1 }, { v0: 26, v1: 36, mat: 'trim', lv: 1 }] });
  const sign = withText(glassFront, [centerText('RATIU FIELD', len, 29, M.neonB + 1)]);
  const land = withText(facade({ kind: 'cmu', mat: 'cmu', seed: 6, wins: winGrid(len, 6, 11, 14, 8, { k: 'fix', lit: 0.7, seed: 5 }).filter((w) => Math.abs(w.u - len / 2) > 18), doors: [{ u: Math.round(len / 2) - 10, w: 20, h: 22, mat: 'doorB', glass: true, lit: true }], bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 1 }, { v0: 26, v1: 36, mat: 'trim', lv: 1 }] }), [centerText('RATIU FIELD', len, 29, M.neonB + 1)]);
  const Rp = facade({ kind: 'stucco', mat: 'stucco', wins: winGrid(side, 2, 9, 12, 8, { k: 'fix', lit: 0.4 }), bands: [{ v0: H - 4, v1: H, mat: 'trim', lv: 1 }] });
  box3(x0, y0, x1, y1, 0, H, { f: sign, r: Rp, b: land, l: Rp, t: false });
  flatRoof3(x0, y0, x1, y1, H, 'flatR', 3, 'cmu');
  const tin = facade({ kind: 'tin', mat: 'tin' }); box3(x0 + 0.4, y0 + 0.3, x0 + 0.9, y0 + 0.7, H, 7, { f: tin, t: () => M.steel + 2 }); box3(x1 - 1.0, y0 + 0.4, x1 - 0.4, y0 + 0.8, H, 7, { f: tin, t: () => M.steel + 2 });
  for (let x = x0 + 0.3; x < x1; x += 1.0) { post3(x, y1 + 0.3, 0.02, 0, 22, M.steel + 1); roundCollide(x, y1 + 0.3, 0.05); }
  box3(x0, y1, x1, y1 + 0.35, 22, 3, { f: () => M.steel + 1, t: () => M.conc + 1 });
  collide(x0, y0, x1, y1); light((x0 + x1) / 2, y1 + 0.2, 14, 70, [255, 214, 140], 1); light((x0 + x1) / 2, y0 - 0.2, 14, 50, [255, 214, 140], 0.8);
  door(id, (x0 + x1) / 2, y1 + 0.55); door(id, (x0 + x1) / 2, y0 - 0.3);
}

function tower(id, x0, y0) {
  const x1 = x0 + 0.62, y1 = y0 + 0.62, sh = 92;
  const shaft = facade({ kind: 'stucco', mat: 'cmu', wins: [14, 40, 66].map((v) => ({ u: 14, v, w: 5, h: 10, k: 'fix', lit: false })), bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 0 }] });
  const cab = facade({ kind: 'plain', mat: 'steel', wins: winGrid(30, 3, 8, 14, 3, { k: 'fix', lit: 0.95 }), bands: [{ v0: 0, v1: 3, mat: 'steel', lv: 0 }, { v0: 20, v1: 24, mat: 'steel', lv: 2 }] });
  box3(x0 - 0.35, y0 - 0.2, x1 + 0.2, y1 + 0.5, 0, 12, { f: facade({ kind: 'cmu', mat: 'cmu', wins: [{ u: 6, v: 3, w: 8, h: 6, k: 'fix', lit: true }], doors: [{ u: 20, w: 8, h: 10, mat: 'doorB' }] }), r: facade({ kind: 'cmu', mat: 'cmu' }), t: () => M.flatR + 2 });
  box3(x0, y0, x1, y1, 12, sh - 12, { f: shaft, t: false });
  box3(x0 - 0.16, y0 - 0.16, x1 + 0.16, y1 + 0.16, sh, 24, { f: cab, t: () => M.shG + 1 });
  sbox3(x0 - 0.2, y0 - 0.2, x1 + 0.2, y1 + 0.2, sh + 24, 2, M.steel + 3);
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2; post3(cx, cy, 0.012, sh + 26, 20, M.steel + 2); sbox3(cx - 0.02, cy - 0.02, cx + 0.02, cy + 0.02, sh + 46, 3, M.beacon + 0);
  collide(x0 - 0.35, y0 - 0.2, x1 + 0.2, y1 + 0.5); light(cx, cy, sh + 12, 60, [255, 220, 150], 0.9);
  door(id, x0 + 0.2, y1 + 0.75);
}

function fireStation(id, x0, y0, x1, y1) {
  const len = Math.round((x1 - x0) * HW), H = 30, bays = [{ u: 5, v: 0, w: 22, h: 22, k: 'garage' }, { u: 31, v: 0, w: 22, h: 22, k: 'garage' }];
  const Lp = withText(facade({ kind: 'brick', mat: 'brickR', wins: [...bays, { u: len - 14, v: 6, w: 8, h: 12, k: 'sash', lit: true }], bands: [{ v0: H - 5, v1: H - 3, mat: 'trim', lv: 2 }, { v0: H - 3, v1: H, mat: 'trim', lv: 1 }] }), [{ s: 'FIRE', u: 22, v: 24, sc: 1, tok: M.trim + 2 }]);
  const Rp = facade({ kind: 'brick', mat: 'brickR', seed: 4, wins: winGrid(Math.round((y1 - y0) * HW), 2, 8, 11, 8, { k: 'sash', lit: 0.2 }) });
  box3(x0, y0, x1, y1, 0, H, { f: Lp, r: Rp, b: backOf('brick', 'brickR', len, 4), l: Rp, t: false }); flatRoof3(x0, y0, x1, y1, H, 'flatR', 3, 'brickR');
  const ht = facade({ kind: 'brick', mat: 'brickR', seed: 7, wins: [{ u: 5, v: 40, w: 8, h: 12, k: 'arch', lit: true }] }); box3(x1, y0 + 0.1, x1 + 0.4, y0 + 0.6, 0, 58, { f: ht, t: () => M.brickR });
  collide(x0, y0, x1 + 0.4, y1); light((x0 + x1) / 2, y1 + 0.2, 12, 40, [255, 210, 130], 0.8); door(id, x0 + 0.9, y1 + 0.3);
}

function radarDome(id, cx, cy) {
  const f = facade({ kind: 'cmu', mat: 'cmu', doors: [{ u: 8, w: 7, h: 9, mat: 'doorB' }] });
  box3(cx - 0.35, cy - 0.35, cx + 0.35, cy + 0.35, 0, 10, { f, r: facade({ kind: 'cmu', mat: 'cmu' }), t: () => M.flatR + 1 });
  for (const [dx, dy] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) post3(cx + dx, cy + dy, 0.012, 10, 34, M.steel + 2);
  sphere3(cx, cy, 56, 18 / PXU, M.trim + 2, 14, 9);
  post3(cx, cy, 0.015, 56 + (18 / PXU) * ZPX - 1, 3, M.radarL);
  collide(cx - 0.35, cy - 0.35, cx + 0.35, cy + 0.35); door(id, cx, cy + 0.6);
}

function waterTower(id, cx, cy) {
  for (const [dx, dy] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) { post3(cx + dx, cy + dy, 0.025, 0, 80, M.steel + 1); roundCollide(cx + dx, cy + dy, 0.06); }
  sbox3(cx - 0.31, cy - 0.31, cx + 0.31, cy + 0.31, 38, 2, M.steel + 0);
  cyl3(cx, cy, 0.5, 78, 118, (u, zr) => M.trim + clampLv(1 + (Math.floor((zr + 78) / 18) & 1 ? 0 : 1) + ((zr + 78) % 18 < 1 ? -1 : 0), 3), 16);
  cone3(cx, cy, 0.53, 118, 132, () => M.steel + 2, 16);
  door(id, cx, cy, 0.8);
}

function elevator(id, x, y) {
  const f = facade({ kind: 'cmu', mat: 'cmu', wins: [{ u: 10, v: 70, w: 6, h: 10, k: 'fix', lit: false }, { u: 10, v: 40, w: 6, h: 10, k: 'fix', lit: false }], doors: [{ u: 4, w: 9, h: 16, mat: 'doorB' }] });
  for (let i = 0; i < 4; i++) cyl3(x + 0.4 + i * 0.78, y + 0.45, 0.34, 0, 84, (u, zr) => M.cmu + clampLv(2 + (zr % 21 < 1 ? -2 : 0) - (hash(Math.floor(zr / 21) + i, 3) < 0.2 ? 1 : 0), 4), 14, M.cmu + 2);
  box3(x + 3.2, y + 0.1, x + 3.9, y + 0.8, 0, 118, { f, t: () => M.shG + 1 }); sbox3(x + 3.2, y + 0.1, x + 3.9, y + 0.8, 118, 8, M.steel + 1);
  collide(x + 0.05, y + 0.1, x + 3.9, y + 0.8); door(id, x + 3.5, y + 1.05);
}
