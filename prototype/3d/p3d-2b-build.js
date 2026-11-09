
function diner(id, x0, y0, x1, y1) {
  const len = Math.round((x1 - x0) * HW), H = 26;
  const Lp = withText(facade({ kind: 'tin', mat: 'tin', wins: [{ u: 4, v: 5, w: len - 8, h: 14, k: 'store', lit: true }], bands: [{ v0: 0, v1: 3, mat: 'steel', lv: 1 }, { v0: 19, v1: 23, mat: 'red', lv: 1 }, { v0: 23, v1: 26, mat: 'trim', lv: 2 }] }), [centerText('OPEN 24 HRS', len, 8, M.trim + 2)]);
  const Rp = facade({ kind: 'tin', mat: 'tin', wins: winGrid(Math.round((y1 - y0) * HW), 2, 8, 12, 6, { k: 'fix', lit: 0.8 }), bands: [{ v0: 19, v1: 23, mat: 'red', lv: 1 }] });
  box3(x0, y0, x1, y1, 0, H, { f: Lp, r: Rp, t: false }); flatRoof3(x0, y0, x1, y1, H, 'flatR', 2, 'tin');
  const signL = withText(() => M.dark + 1, [{ s: 'CONEY', u: 2, v: 11, sc: 1, tok: M.neonR + 1 }, { s: 'OPEN', u: 4, v: 3, sc: 1, tok: M.neonB + 1 }]), sx = x1 - 0.45;
  post3(sx, y1 + 0.35, 0.02, 0, 44, M.steel + 1); roundCollide(sx, y1 + 0.35, 0.05);
  box3(sx - 0.34, y1 + 0.3, sx + 0.34, y1 + 0.4, 44, 19, { f: signL, r: () => M.dark + 0, b: signL, t: () => M.steel + 2 });
  collide(x0, y0, x1, y1); light((x0 + x1) / 2, y1 + 0.2, 14, 56, [255, 200, 120], 1); light(sx, y1 + 0.35, 54, 36, [255, 90, 80], 0.7);
  door(id, x0 + 0.45, y1 + 0.3);
}

function kiosk(id, x0, y0, x1, y1) {
  x1 = Math.max(x1, x0 + 1.2); const len = Math.round((x1 - x0) * HW), cell = Math.floor((len - 8) / 3);
  const machines = (u, v) => { if (v < 3 || v > 19 || u < 4 || u > len - 4) return -1; const m = Math.min(2, Math.floor((u - 4) / cell)), e = (u - 4) % cell; if (e === 0 || v === 3) return M.dark + 0; return [M.neonR, M.neonB, M.neonY][m] + ((u + v) % 4 === 0 ? 1 : 0); };
  const Lp = withText(facade({ kind: 'stucco', mat: 'stucco', bands: [{ v0: 3, v1: 20, fn: machines }, { v0: 21, v1: 26, fn: (u) => M.awnB + (((u >> 2) & 1) ? 2 : 3) }] }), [centerText('CROSSBELL', len, 27, M.neonY + 1)]);
  box3(x0, y0, x1, y1, 0, 32, { f: Lp, r: facade({ kind: 'stucco', mat: 'stucco', seed: 2 }), t: () => M.flatR + 1 });
  collide(x0, y0, x1, y1); light((x0 + x1) / 2, y1 + 0.2, 12, 40, [120, 190, 255], 0.9); light((x0 + x1) / 2, y1 + 0.2, 12, 30, [255, 100, 110], 0.6);
  door(id, (x0 + x1) / 2, y1 + 0.3);
}

function factory(x, y, len, dep) {
  const H = 38, L = Math.round(len * HW), D = Math.round(dep * HW), teeth = Math.max(2, Math.round(dep / 0.62)), tw = dep / teeth, x1 = x + len, y1 = y + dep;
  const dr = { u: L - 17, w: 10, h: 19, mat: 'doorB' }, wins = winGrid(L, Math.max(2, Math.floor(L / 15)), 8, 12, 12, { k: 'fix', lit: 0.35, seed: 4 }).filter((w) => w.u + w.w < dr.u - 2);
  const f = withText(facade({ kind: 'brick', mat: 'brickB', seed: 2, wins, doors: [dr], bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 1 }, { v0: H - 3, v1: H, mat: 'trim', lv: 0 }] }), [centerText('TOOL & DIE', L, 27, M.trim + 2)]);
  const f2 = facade({ kind: 'brick', mat: 'brickB', seed: 3, wins: [{ u: 8, v: 0, w: 26, h: 22, k: 'garage' }, ...winGrid(D, 3, 8, 12, 12, { k: 'fix', lit: 0.2 }).filter((w) => w.u > 38)], bands: [{ v0: 0, v1: 3, mat: 'cmu', lv: 1 }] });
  const fb = backOf('brick', 'brickB', L, 5);
  box3(x, y, x1, y1, 0, H, { f, r: f2, b: fb, l: fb, t: false });
  for (let k = 0; k < teeth; k++) {
    const ya = y + k * tw, yb = ya + tw;
    wallPoly3(x1, y1, x1, y, [[y1 - yb, H], [y1 - ya, H], [y1 - yb, H + 10]], f2, 0);
    wallPoly3(x, y, x, y1, [[ya - y, H], [yb - y, H], [yb - y, H + 10]], fb, 0);
    slope3(V(x1, ya, H), V(x, ya, H), V(x, yb, H + 10), V(x1, yb, H + 10), seam3('metalR'), len, Math.hypot(tw, 10 / ZPX));
    wall3(x, yb, x1, yb, H, H + 10, (u, v) => M.glass + (u % 12 === 0 ? 0 : v > 5 ? 2 : 1));
  }
  cyl3(x1 - 0.3, y + 0.35, 0.2, H + 2, 140, (u, zr) => M.brickB + clampLv(1 + ((zr + H) % 24 < 1 ? -1 : 0) + (zr > 92 ? -1 : 0) + (hash(Math.floor(zr / 4), 2) < 0.15 ? 1 : 0), 4), 10, M.dark + 0);
  STACKS.push([x1 - 0.3, y + 0.35, 140]); collide(x, y, x1, y1); light(x1, y1 - 0.4, 14, 30, [255, 210, 140], 0.6);
}

function ballField(id, x, y) {
  ground(x, y, x + 2.4, y + 2.4, turfP);
  poly([P(x + 1.2, y + 0.35), P(x + 2.05, y + 1.2), P(x + 1.2, y + 2.05), P(x + 0.35, y + 1.2)], dirtP);
  poly([P(x + 1.2, y + 0.9), P(x + 1.5, y + 1.2), P(x + 1.2, y + 1.5), P(x + 0.9, y + 1.2)], turfP);
  for (const [bx, by] of [[1.2, 0.35], [2.05, 1.2], [0.35, 1.2], [1.2, 2.05]]) { const [px, py] = P(x + bx, y + by); for (let a = 0; a < 3; a++) for (let b = 0; b < 2; b++) put(px - 1 + a, py - 1 + b, pix(M.paintW + 1)); }
  for (let k = 0; k <= 14; k++) post3(x - 0.05, y + k * 0.18, 0.008, 0, 9, M.steel + 1);
  sbox3(x - 0.06, y, x - 0.04, y + 2.52, 8, 1, M.steel + 2);
  for (const [lx, ly] of [[x - 0.2, y - 0.2], [x + 2.6, y - 0.2], [x - 0.2, y + 2.6], [x + 2.6, y + 2.6]]) {
    post3(lx, ly, 0.02, 0, 70, M.steel + 1); sbox3(lx - 0.1, ly - 0.03, lx + 0.1, ly + 0.03, 70, 4, M.lampLit + 1); roundCollide(lx, ly, 0.05);
    light(lx, ly, 66, 90, [255, 235, 190], 0.9);
  }
  for (let s = 0; s < 3; s++) sbox3(x - 0.1, y + 2.5 + s * 0.08, x + 1.0, y + 2.74, 0, 6 + s * 4, M.steel + 2 - (s & 1));
  collide(x - 0.1, y + 2.5, x + 1.0, y + 2.74); door(id, x + 1.2, y + 2.65, 1.3);
}

function emptyLot(id, x, y) {
  ground(x, y, x + 1.5, y + 1.2, gravelP);
  for (const [px, py] of [[x, y], [x + 1.5, y], [x, y + 1.2], [x + 1.5, y + 1.2]]) post3(px, py, 0.02, 0, 8, M.orange + 1);
  const face = withText(() => M.sidW + 2, [{ s: 'COMING', u: 3, v: 10, sc: 1, tok: M.red + 2 }, { s: 'SOON', u: 7, v: 3, sc: 1, tok: M.red + 2 }]);
  post3(x + 0.75, y + 1.2, 0.02, 0, 14, M.wood + 1); box3(x + 0.45, y + 1.18, x + 1.05, y + 1.22, 6, 18, { f: face, b: face, r: () => M.sidW + 0, t: () => M.sidW + 2 });
  door(id, x + 0.75, y + 1.4, 1.2);
}

function farmStand(id, x, y) {
  const red = facade({ kind: 'siding', mat: 'sidR' });
  const f = withText(facade({ kind: 'siding', mat: 'sidR', wins: [{ u: 6, v: 3, w: 24, h: 14, k: 'store', lit: true }], bands: [{ v0: 17, v1: 22, fn: (u) => M.awnG + (((u >> 2) & 1) ? 2 : 3) }] }), [{ s: 'PEACHES', u: 4, v: 18, sc: 1, tok: M.trim + 2 }]);
  box3(x, y, x + 1.2, y + 0.9, 0, 24, { f, r: red, t: false }); gable3(x, y, x + 1.2, y + 0.9, 24, 9, 'x', shingle3('shR'), red, 0.05);
  for (let k = 0; k < 5; k++) { const cx = x + 0.12 + k * 0.2; sbox3(cx - 0.07, y + 0.95, cx + 0.07, y + 1.07, 0, 4, M.wood + 1); for (const dx of [-0.03, 0.03]) sbox3(cx + dx - 0.015, y + 0.99, cx + dx + 0.015, y + 1.02, 4, 1.5, M.orange + 2); }
  collide(x, y, x + 1.2, y + 0.9); door(id, x + 0.6, y + 1.2);
}

// Turbine towers are static; their rotors are animated by the scene.
const TURB3 = [];
function turbine(id, gx, gy, h = 130) {
  cyl3(gx, gy, 0.07, 0, h, () => M.trim + 2, 8, M.trim + 2); sbox3(gx - 0.12, gy - 0.05, gx + 0.08, gy + 0.05, h - 2, 7, M.trim + 1);
  TURB3.push([gx, gy, h]); roundCollide(gx, gy, 0.1); door(id, gx + 0.25, gy + 0.25, 0.9);
}

// Trees become instanced meshes later; here they are only recorded.
function tree(gx, gy, o = {}) {
  TREES3.push({ kind: 'tree', gx, gy, r: o.r || 19, th: o.th || 24, mats: o.mats || ['leafA', 'leafB', 'leafC'] }); roundCollide(gx, gy, 0.07);
  if (curId && !DOORS.some((dd) => dd.id === curId)) door(curId, gx, gy, 1.6);
}
function pineTree(gx, gy, h = 56) { TREES3.push({ kind: 'pine', gx, gy, h }); roundCollide(gx, gy, 0.07); }
function shrub(gx, gy, r = 8, mat = 'shrub') { TREES3.push({ kind: 'shrub', gx, gy, r, mat }); }

// ---- Street furniture ----
function pole(gx, gy, z0, z1, tok, w = 1) { post3(gx, gy, 0.012 * w, z0, z1 - z0, tokOf(tok)); }
function fence(x0, y0, x1, y1, h = 6, mat = 'wood') { const n = Math.max(1, Math.round(Math.hypot(x1 - x0, y1 - y0) / 0.12)); for (let i = 0; i <= n; i++) post3(x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n, 0.01, 0, h, M[mat] + 2); }
function lampPost(gx, gy, h = 26) {
  post3(gx, gy, 0.018, 0, h, M.dark + 1); sbox3(gx - 0.035, gy - 0.035, gx + 0.035, gy + 0.035, h, 5, M.lampLit + 1); sbox3(gx - 0.045, gy - 0.045, gx + 0.045, gy + 0.045, h + 5, 2, M.dark + 1);
  light(gx, gy, h + 2, 46, [255, 190, 100], 0.9); roundCollide(gx, gy, 0.05);
}
function bench(gx, gy) { sbox3(gx - 0.14, gy - 0.04, gx + 0.14, gy + 0.04, 4, 1, M.wood + 2); sbox3(gx - 0.14, gy + 0.03, gx + 0.14, gy + 0.05, 5, 5, M.wood + 1); for (const dx of [-0.12, 0.12]) post3(gx + dx, gy, 0.01, 0, 4, M.steel + 0); roundCollide(gx, gy, 0.12); }
function mailbox(gx, gy) { post3(gx, gy, 0.01, 0, 8, M.wood + 1); sbox3(gx - 0.04, gy - 0.025, gx + 0.04, gy + 0.025, 8, 3, M.steel + 2); post3(gx + 0.045, gy, 0.006, 9, 3, M.red + 2); }
function utilityPole(gx, gy, h = 70) {
  post3(gx, gy, 0.022, 0, h, M.trunk + 1); sbox3(gx - 0.012, gy - 0.22, gx + 0.012, gy + 0.22, h - 3, 2, M.trunk + 2); sbox3(gx - 0.012, gy - 0.14, gx + 0.012, gy + 0.14, h - 10, 2, M.trunk + 2);
  POLES3.push([gx, gy, h - 2]); roundCollide(gx, gy, 0.05);
}
function wire() {}
