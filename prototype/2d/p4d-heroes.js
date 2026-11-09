
// ============ Airfield and project buildings ============
const corrP = (x, y) => M.tin + [3, 2, 1, 0][Math.floor(y + x * 0.5) & 3];
function hangar(id, x0, y0, x1, y1, R, open) {
  const xc = (x0 + x1) / 2, rx = (x1 - x0) / 2, N = 14, pr = [];
  for (let i = 0; i <= N; i++) { const a = (Math.PI * i) / N; pr.push([xc + rx * Math.cos(a), R * Math.sin(a)]); }
  const dw = Math.round(rx * HW * 1.3), dh = Math.round(R * 0.7), du0 = Math.round(rx * HW - dw / 2);
  const door = (u, v) => {
    if (u >= du0 && u < du0 + dw && v < dh) {
      if (open) return v > dh - 3 ? M.dark + 2 : (v > dh * 0.55 && u > du0 + 3 && u < du0 + dw - 3 && v < dh * 0.62) ? M.lampLit + 1 : M.dark + (v > dh * 0.6 ? 1 : 0);
      return (u - du0) % 9 === 0 || v % 7 === 0 ? M.steel + 0 : M.steel + (u < du0 + dw / 2 ? 2 : 1);
    }
    if (v >= dh && v < dh + 2 && u >= du0 - 2 && u < du0 + dw + 2) return (u >> 2) & 1 ? M.orange + 1 : M.dark + 1;
    return v < 2 ? M.cmu + 1 : M.tin + [3, 2, 1, 0][u & 3];
  };
  obj(id, keyOf(x1, y1), () => {
    for (let i = N; i > 0; i--) {
      const [xa, za] = pr[i - 1], [xb, zb] = pr[i], nx = Math.cos((Math.PI * (i - 0.5)) / N);
      slope([P(xa, y0, za), P(xb, y0, zb), P(xb, y1, zb), P(xa, y1, za)], nx > 0.55 ? 2 : nx > 0 ? 4 : 6, corrP);
    }
    wallLPoly(pr.map(([x, z]) => P(x, y1, z)), y1, x0, 0, door);
  });
  caster(x0, y0, x1, y1, R * 0.85);
  if (open) light(xc, y1, 14, 40, [255, 220, 150], 0.7);
}
function terminal(id, x0, y0, x1, y1) {
  const len = Math.round((x1 - x0) * HW), H = 36, side = Math.round((y1 - y0) * HW);
  const Lp = facade({ kind: 'cmu', mat: 'cmu', wins: winGrid(len, Math.round(len / 14), 11, 22, 3, { k: 'fix', lit: 0.9, seed: 3 }), bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 1 }, { v0: 26, v1: 36, mat: 'trim', lv: 1 }] });
  const sign = withText(Lp, [{ s: 'NORBERT FIELD', u: Math.round((len - textW('NORBERT FIELD')) / 2), v: 29, sc: 1, tok: M.neonB + 1 }]);
  const Rp = facade({ kind: 'stucco', mat: 'stucco', wins: winGrid(side, 2, 9, 12, 8, { k: 'fix', lit: 0.4 }), doors: [], bands: [{ v0: H - 4, v1: H, mat: 'trim', lv: 1 }] });
  obj(id, keyOf(x1, y1 + 0.35), () => {
    box(x0, y0, x1, y1, 0, H, { L: sign, R: Rp });
    flatRoof(x0, y0, x1, y1, H, 'flatR', 3, 'cmu'); rooftopUnit(x0 + 0.4, y0 + 0.3, 0.5, 0.4); rooftopUnit(x1 - 1.0, y0 + 0.4, 0.6, 0.4);
    for (let x = x0 + 0.3; x < x1; x += 1.0) pole(x, y1 + 0.3, 0, 22, pix(M.steel + 1, 2), 2);
    box(x0, y1, x1, y1 + 0.35, 22, 3, { L: flat(M.steel + 1), R: flat(M.steel + 0), top: flat(M.conc + 1) });
  });
  caster(x0, y0, x1, y1 + 0.35, H + 3); light((x0 + x1) / 2, y1 + 0.2, 14, 70, [255, 214, 140], 1);
}
function tower(id, x0, y0) {
  const x1 = x0 + 0.62, y1 = y0 + 0.62, sh = 92, shaft = facade({ kind: 'stucco', mat: 'cmu', wins: [14, 40, 66].map((v) => ({ u: 14, v, w: 5, h: 10, k: 'fix', lit: false })), bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 0 }] });
  const cab = facade({ kind: 'plain', mat: 'steel', wins: winGrid(32, 3, 8, 14, 3, { k: 'fix', lit: 0.95 }), bands: [{ v0: 0, v1: 3, mat: 'steel', lv: 0 }, { v0: 20, v1: 24, mat: 'steel', lv: 2 }] });
  obj(id, keyOf(x1 + 0.15, y1 + 0.15), () => {
    box(x0 - 0.35, y0 - 0.2, x1 + 0.2, y1 + 0.5, 0, 12, { L: facade({ kind: 'cmu', mat: 'cmu', wins: [{ u: 6, v: 3, w: 8, h: 6, k: 'fix', lit: true }] }), R: flat(M.cmu + 1), top: flat(M.flatR + 2) });
    box(x0, y0, x1, y1, 12, sh - 12, { L: shaft, R: shaft });
    box(x0 - 0.16, y0 - 0.16, x1 + 0.16, y1 + 0.16, sh, 24, { L: cab, R: cab, top: flat(M.shG + 1) });
    box(x0 - 0.2, y0 - 0.2, x1 + 0.2, y1 + 0.2, sh + 24, 2, { top: flat(M.steel + 3), L: flat(M.steel + 1), R: flat(M.steel + 0) });
    pole((x0 + x1) / 2, (y0 + y1) / 2, sh + 26, sh + 46, pix(M.steel + 2, 2), 2);
    const [bx, by] = P((x0 + x1) / 2, (y0 + y1) / 2, sh + 48); put(bx, by, pix(M.beacon + 0)); put(bx + 1, by, pix(M.beacon + 1)); put(bx, by - 1, pix(M.beacon + 0)); put(bx + 1, by - 1, pix(M.beacon + 1));
  });
  caster(x0 - 0.2, y0 - 0.2, x1 + 0.2, y1 + 0.2, sh + 24); light((x0 + x1) / 2, (y0 + y1) / 2, sh + 12, 60, [255, 220, 150], 0.9);
}
function fireStation(id, x0, y0, x1, y1) {
  const len = Math.round((x1 - x0) * HW), H = 30, bays = [{ u: 5, v: 0, w: 22, h: 22, k: 'garage' }, { u: 31, v: 0, w: 22, h: 22, k: 'garage' }];
  const Lp = withText(facade({ kind: 'brick', mat: 'brickR', wins: [...bays, { u: len - 14, v: 6, w: 8, h: 12, k: 'sash', lit: true }], bands: [{ v0: H - 5, v1: H - 3, mat: 'trim', lv: 2 }, { v0: H - 3, v1: H, mat: 'trim', lv: 1 }] }), [{ s: 'FIRE', u: 22, v: 24, sc: 1, tok: M.trim + 2 }]);
  const Rp = facade({ kind: 'brick', mat: 'brickR', seed: 4, wins: winGrid(Math.round((y1 - y0) * HW), 2, 8, 11, 8, { k: 'sash', lit: 0.2 }) });
  obj(id, keyOf(x1 + 0.4, y1), () => {
    box(x0, y0, x1, y1, 0, H, { L: Lp, R: Rp }); flatRoof(x0, y0, x1, y1, H, 'flatR', 3, 'brickR');
    const ht = facade({ kind: 'brick', mat: 'brickR', seed: 7, wins: [{ u: 5, v: 40, w: 8, h: 12, k: 'arch', lit: true }] }); box(x1, y0 + 0.1, x1 + 0.4, y0 + 0.6, 0, 58, { L: ht, R: ht, top: flat(M.brickR + 0) });
  });
  caster(x0, y0, x1 + 0.4, y1, 58); light((x0 + x1) / 2, y1, 12, 40, [255, 210, 130], 0.8);
}
function radarDome(id, cx, cy) {
  const x0 = cx - 0.35, y0 = cy - 0.35, x1 = cx + 0.35, y1 = cy + 0.35, f = facade({ kind: 'cmu', mat: 'cmu' });
  obj(id, keyOf(x1 + 0.1, y1 + 0.1), () => {
    box(x0, y0, x1, y1, 0, 10, { L: f, R: f, top: flat(M.flatR + 1) });
    for (const [dx, dy] of [[-0.18, -0.18], [0.18, -0.18], [-0.18, 0.18], [0.18, 0.18]]) pole(cx + dx, cy + dy, 10, 44, pix(M.steel + 2, 2), 1);
    dome(cx, cy, 56, 18, 'trim'); const [lx, ly] = P(cx, cy, 78); put(lx, ly, pix(M.radarL)); put(lx, ly - 1, pix(M.radarL));
  });
  caster(x0, y0, x1, y1, 60);
}
function waterTower(id, cx, cy) {
  obj(id, keyOf(cx + 0.5, cy + 0.5), () => {
    for (const [dx, dy] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3]]) pole(cx + dx, cy + dy, 0, 78, pix(M.steel + 1, 2), 2);
    cylinder(cx, cy, 0.5, 78, 118, (t, zr) => M.trim + clampLv(1 + (Math.floor(zr / 18) & 1 ? 0 : 1) + (zr % 18 < 1 ? -1 : 0), 3));
    const [sx, sy] = P(cx, cy, 118); for (let i = 0; i < 12; i++) for (let x = -22 + i * 1.8; x <= 22 - i * 1.8; x++) put(Math.round(sx + x), sy - i, pix(M.steel + (x < 0 ? 2 : 1), x < 0 ? 1 : 2));
  });
  caster(cx - 0.5, cy - 0.5, cx + 0.5, cy + 0.5, 130);
}
function elevator(id, x, y) {
  const f = facade({ kind: 'cmu', mat: 'cmu', wins: [{ u: 10, v: 70, w: 6, h: 10, k: 'fix', lit: false }, { u: 10, v: 40, w: 6, h: 10, k: 'fix', lit: false }] });
  obj(id, keyOf(x + 3.4, y + 0.9), () => {
    for (let i = 0; i < 4; i++) cylinder(x + 0.4 + i * 0.78, y + 0.45, 0.34, 0, 84, (t, zr) => M.cmu + clampLv(2 + (zr % 21 < 1 ? -2 : 0) - (hash(Math.floor(zr / 21), 3) < 0.2 ? 1 : 0), 4));
    box(x + 3.2, y + 0.1, x + 3.9, y + 0.8, 0, 118, { L: f, R: f, top: flat(M.shG + 1) });
    box(x + 3.2, y + 0.1, x + 3.9, y + 0.8, 118, 8, { L: flat(M.steel + 1), R: flat(M.steel + 0), top: flat(M.shG + 2) });
  });
  caster(x, y, x + 3.9, y + 0.9, 118);
}
function diner(id, x0, y0, x1, y1) {
  const len = Math.round((x1 - x0) * HW), H = 26;
  const Lp = withText(facade({ kind: 'tin', mat: 'tin', wins: [{ u: 4, v: 5, w: len - 8, h: 14, k: 'store', lit: true }], bands: [{ v0: 0, v1: 3, mat: 'steel', lv: 1 }, { v0: 19, v1: 23, mat: 'red', lv: 1 }, { v0: 23, v1: 26, mat: 'trim', lv: 2 }] }), [{ s: '(586) 555-0148', u: 8, v: 7, sc: 1, tok: M.trim + 2 }]);
  const Rp = facade({ kind: 'tin', mat: 'tin', wins: winGrid(Math.round((y1 - y0) * HW), 2, 8, 12, 6, { k: 'fix', lit: 0.8 }), bands: [{ v0: 19, v1: 23, mat: 'red', lv: 1 }] });
  const signL = withText(flat(M.dark + 1), [{ s: 'CONEY', u: 2, v: 11, sc: 1, tok: M.neonR + 1 }, { s: 'OPEN', u: 4, v: 3, sc: 1, tok: M.neonB + 1 }]), sx = x1 - 0.45;
  obj(id, keyOf(x1, y1), () => {
    box(x0, y0, x1, y1, 0, H, { L: Lp, R: Rp, top: flat(M.red + 0) }); flatRoof(x0, y0, x1, y1, H, 'flatR', 2, 'tin');
    pole(sx, y1 + 0.35, 0, 44, pix(M.steel + 1, 2), 2); box(sx - 0.34, y1 + 0.3, sx + 0.34, y1 + 0.4, 44, 19, { L: signL, R: flat(M.dark + 0), top: flat(M.steel + 2) });
  });
  caster(x0, y0, x1, y1, H + 2); light((x0 + x1) / 2, y1, 14, 56, [255, 200, 120], 1); light(sx, y1 + 0.35, 54, 36, [255, 90, 80], 0.7);
}
function kiosk(id, x0, y0, x1, y1) {
  const len = Math.round((x1 - x0) * HW);
  const machines = (u, v) => { if (v < 3 || v > 19 || u < 4 || u > len - 4) return -1; const m = Math.min(2, Math.floor((u - 4) / ((len - 8) / 3))), e = (u - 4) % Math.floor((len - 8) / 3); if (e === 0 || v === 3) return M.dark + 0; return [M.neonR, M.neonB, M.neonY][m] + ((u + v) % 4 === 0 ? 1 : 0); };
  const Lp = withText(facade({ kind: 'stucco', mat: 'stucco', bands: [{ v0: 3, v1: 20, fn: machines }, { v0: 21, v1: 26, fn: (u, v) => M.awnB + (((u >> 2) & 1) ? 2 : 3) }] }), [{ s: 'CROSSBELL', u: 2, v: 27, sc: 1, tok: M.neonY + 1 }]);
  const Rp = facade({ kind: 'stucco', mat: 'stucco', seed: 2 });
  obj(id, keyOf(x1, y1), () => { box(x0, y0, x1, y1, 0, 32, { L: Lp, R: Rp, top: flat(M.flatR + 1) }); });
  caster(x0, y0, x1, y1, 32); light((x0 + x1) / 2, y1, 12, 40, [120, 190, 255], 0.9); light((x0 + x1) / 2, y1, 12, 30, [255, 100, 110], 0.6);
}
function factory(x, y, len, dep) {
  const H = 38, L = Math.round(len * HW), D = Math.round(dep * HW), teeth = Math.max(2, Math.round(dep / 0.62)), tw = dep / teeth, x1 = x + len, y1 = y + dep;
  const door = { u: L - 17, w: 10, h: 19, mat: 'doorB' }, wins = winGrid(L, Math.max(2, Math.floor(L / 15)), 8, 12, 12, { k: 'fix', lit: 0.35, seed: 4 }).filter((w) => w.u + w.w < door.u - 2);
  const f = withText(facade({ kind: 'brick', mat: 'brickB', seed: 2, wins, doors: [door], bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 1 }, { v0: H - 3, v1: H, mat: 'trim', lv: 0 }] }), [{ s: 'TOOL & DIE', u: Math.round((L - textW('TOOL & DIE')) / 2), v: 27, tok: M.trim + 2 }]);
  const f2 = facade({ kind: 'brick', mat: 'brickB', seed: 3, wins: [{ u: 8, v: 0, w: 26, h: 22, k: 'garage' }, ...winGrid(D, 3, 8, 12, 12, { k: 'fix', lit: 0.2 }).filter((w) => w.u > 38)], bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 1 }] });
  obj(0, keyOf(x1, y1), () => {
    box(x, y, x1, y1, 0, H, { L: f, R: f2 });
    for (let k = 0; k < teeth; k++) {
      const ya = y + k * tw, yb = ya + tw;
      wallRPoly([P(x1, ya, H), P(x1, yb, H), P(x1, yb, H + 10)], x1, y1, 0, f2);
      slope([P(x, ya, H), P(x1, ya, H), P(x1, yb, H + 10), P(x, yb, H + 10)], 5, seamP('metalR', 'x'));
      wallL(yb, x, x1, H, H + 10, (u, v) => M.glass + (u % 12 === 0 ? 0 : v > 5 ? 2 : 1));
    }
    cylinder(x1 - 0.3, y + 0.35, 0.2, H + 2, 140, (t, zr) => M.brickB + clampLv(1 + ((zr + H) % 24 < 1 ? -1 : 0) + (zr > 92 ? -1 : 0) + (hash(Math.floor(zr / 4), 2) < 0.15 ? 1 : 0), 4));
  });
  caster(x, y, x1, y1, H + 10); caster(x1 - 0.5, y + 0.15, x1 - 0.1, y + 0.55, 140);
  STACKS.push([x1 - 0.3, y + 0.35, 140]); light(x1, y1 - 0.4, 14, 30, [255, 210, 140], 0.6);
}
function ballField(id, x, y) {
  obj(id, keyOf(x + 2.4, y + 2.4), () => {
    ground(x, y, x + 2.4, y + 2.4, turfP);
    poly([P(x + 1.2, y + 0.35), P(x + 2.05, y + 1.2), P(x + 1.2, y + 2.05), P(x + 0.35, y + 1.2)], dirtP);
    poly([P(x + 1.2, y + 0.9), P(x + 1.5, y + 1.2), P(x + 1.2, y + 1.5), P(x + 0.9, y + 1.2)], turfP);
    for (const [bx, by] of [[1.2, 0.35], [2.05, 1.2], [0.35, 1.2], [1.2, 2.05]]) { const [px, py] = P(x + bx, y + by); for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) put(px - 1 + a, py - 1 + b, pix(M.paintW + 1)); }
    for (let k = 0; k < 14; k++) { fence(x - 0.05, y + k * 0.18, x - 0.05, y + k * 0.18 + 0.01, 7, 'steel'); }
    for (const [lx, ly] of [[x - 0.2, y - 0.2], [x + 2.6, y - 0.2], [x - 0.2, y + 2.6], [x + 2.6, y + 2.6]]) { pole(lx, ly, 0, 70, pix(M.steel + 1, 2), 2); const [hx, hy] = P(lx, ly, 70); for (let k = -4; k <= 4; k++) { put(hx + k, hy - 1, pix(M.dark + 1)); put(hx + k, hy, pix(M.lampLit + 1)); } light(lx, ly, 66, 90, [255, 235, 190], 0.9); caster(lx - 0.03, ly - 0.03, lx + 0.03, ly + 0.03, 70); }
    box(x - 0.1, y + 2.5, x + 1.0, y + 2.65, 0, 6, { L: flat(M.steel + 2), R: flat(M.steel + 1), top: flat(M.steel + 3) });
  });
}
function emptyLot(id, x, y) {
  obj(id, keyOf(x + 1.5, y + 1.2), () => {
    ground(x, y, x + 1.5, y + 1.2, gravelP);
    for (const [px, py] of [[x, y], [x + 1.5, y], [x, y + 1.2], [x + 1.5, y + 1.2]]) pole(px, py, 0, 8, pix(M.orange + 1, 2), 2);
    const f = withText(flat(M.sidW + 2), [{ s: 'COMING', u: 3, v: 13, sc: 1, tok: M.red + 2 }, { s: 'SOON', u: 8, v: 6, sc: 1, tok: M.red + 2 }]);
    pole(x + 0.75, y + 1.2, 0, 14, pix(M.wood + 1, 2), 2); box(x + 0.5, y + 1.18, x + 1.0, y + 1.22, 6, 18, { L: f, R: flat(M.sidW + 0), top: flat(M.sidW + 2) });
  });
}
function farmStand(id, x, y) {
  const f = facade({ kind: 'siding', mat: 'sidR', wins: [{ u: 6, v: 3, w: 24, h: 14, k: 'store', lit: true }], bands: [{ v0: 17, v1: 22, fn: (u, v) => M.awnG + (((u >> 2) & 1) ? 2 : 3) }] });
  obj(id, keyOf(x + 1.2, y + 0.9), () => {
    box(x, y, x + 1.2, y + 0.9, 0, 24, { L: withText(f, [{ s: 'PEACHES', u: 4, v: 18, sc: 1, tok: M.trim + 2 }]), R: facade({ kind: 'siding', mat: 'sidR' }), top: flat(M.shR + 1) });
    for (let k = 0; k < 5; k++) { const [cx, cy] = P(x + 0.1 + k * 0.17, y + 0.95); for (let a = 0; a < 5; a++) for (let b = 0; b < 3; b++) put(cx + a, cy - b, pix(M.wood + 1 + (b === 2 ? 1 : 0), 1)); put(cx + 1, cy - 4, pix(M.orange + 2)); put(cx + 3, cy - 4, pix(M.orange + 1)); }
  });
  caster(x, y, x + 1.2, y + 0.9, 24);
}
function turbine(id, gx, gy, h = 130) { obj(id, keyOf(gx, gy), () => { cylinder(gx, gy, 0.07, 0, h, (t, zr) => M.trim + clampLv(2 - (t > 0.3 ? 1 : 0), 3)); const [x, y] = P(gx, gy, h); for (let a = -3; a <= 3; a++) for (let b = -2; b <= 2; b++) put(x + a, y + b, pix(M.trim + 1, a < 0 ? 1 : 2)); }); caster(gx - 0.05, gy - 0.05, gx + 0.05, gy + 0.05, h); }
