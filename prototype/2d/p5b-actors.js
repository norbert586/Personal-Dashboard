
// ============ Moving things: people, traffic, aircraft, trains ============
// Everything is drawn straight into the low-res frame with a depth test against the world,
// so people and cars pass behind buildings and trees.
let LF = null; const DLIGHTS = []; const QUEUE = [];
const rgb32 = (c, F, k = 1) => pack(c[0] * F[0] * k, c[1] * F[1] * k, c[2] * F[2] * k);
function spx(x, y, c, key) {
  if (x < 0 || y < 0 || x >= VW || y >= VH) return;
  const wx = x - camX, wy = y - camY; if (wx >= 0 && wy >= 0 && wx < WW && wy < WH && DB[wy * WW + wx] > key) return;
  out32[y * VW + x] = c;
}
function blend(x, y, r, g, b, a) { if (x < 0 || y < 0 || x >= VW || y >= VH) return; const i = y * VW + x, p = out32[i], pr = p & 255, pg = (p >> 8) & 255, pb = (p >> 16) & 255; out32[i] = pack(pr + (r - pr) * a, pg + (g - pg) * a, pb + (b - pb) * a); }
const fquad = (pts, c, key) => scan(pts, (x, y) => spx(x, y, c, key), VW, VH);
const queue = (key, fn) => QUEUE.push({ key, fn });
let SHV = [0, 0];   // screen offset of a shadow per tile of length, for the current sun
function shadowPoly(pts, a = 0.3) { scan(hull(pts), (x, y) => blend(x, y, 14, 20, 38, a), VW, VH); }
function shadowBlob(cx, cy, l, w, h, f, a = 0.3) {   // footprint of a box plus its sun shadow
  const fx = f[0], fy = f[1], rx = -fy, ry = fx, len = Math.min(3, h / 36 / Math.tan((Math.max(LS.s.el, 5) * Math.PI) / 180)), az = (LS.s.az * Math.PI) / 180, dx = Math.cos(az) * len, dy = Math.sin(az) * len;
  const base = [[-l / 2, -w / 2], [l / 2, -w / 2], [l / 2, w / 2], [-l / 2, w / 2]].map(([u, v]) => [cx + fx * u + rx * v, cy + fy * u + ry * v]);
  shadowPoly(base.map(([x, y]) => S2(x, y)).concat(base.map(([x, y]) => S2(x + dx, y + dy))), a);
}
function box3(cx, cy, z0, l, w, h, f, col, key) {
  const fx = f[0], fy = f[1], rx = -fy, ry = fx, hl = l / 2, hw = w / 2;
  const cs = [[-hl, -hw], [hl, -hw], [hl, hw], [-hl, hw]].map(([a, b]) => [cx + fx * a + rx * b, cy + fy * a + ry * b]), bot = cs.map(([x, y]) => S2(x, y, z0)), top = cs.map(([x, y]) => S2(x, y, z0 + h));
  for (const [a, b, nx, ny] of [[0, 1, -rx, -ry], [1, 2, fx, fy], [2, 3, rx, ry], [3, 0, -fx, -fy]]) if (nx + ny > 0.02) fquad([bot[a], bot[b], top[b], top[a]], rgb32(col, lightFor(nx, ny, 0)), key);
  fquad(top, rgb32(col, lightFor(0, 0, 1)), key);
}
function model(parts, x, y, z, f, key) {   // parts: [u, v, z, l, w, h, colour]; painter's order by depth
  const r = [-f[1], f[0]], list = parts.map((p) => ({ p, cx: x + f[0] * p[0] + r[0] * p[1], cy: y + f[1] * p[0] + r[1] * p[1] })).sort((a, b) => a.cx + a.cy - (b.cx + b.cy) || a.p[2] - b.p[2]);
  for (const { p, cx, cy } of list) box3(cx, cy, z + p[2], p[3], p[4], p[5], f, p[6], key);
}

// ---- People ----
const SKIN = [[236, 190, 150], [214, 160, 120], [168, 118, 84], [120, 80, 56]], HAIR = [[40, 30, 26], [90, 60, 36], [170, 130, 70], [200, 200, 205], [30, 30, 34]];
const JACKET = [[170, 50, 45], [50, 90, 150], [60, 120, 80], [210, 170, 50], [120, 60, 120], [220, 220, 225], [40, 40, 48], [200, 100, 50]], PANTS = [[40, 50, 80], [50, 50, 56], [90, 70, 50], [30, 36, 44]];
const PEOPLE = [];
function person(path, o = {}) {
  const s = PEOPLE.length * 7 + (o.seed || 0);
  PEOPLE.push({ path, seg: 0, dir: 1, x: path[0][0], y: path[0][1], v: o.v || 0.5, kind: o.kind || 'walk', ph: Math.floor(hash(s, 1) * 8), wait: o.wait || 0, fx: 1, fy: 0, skin: SKIN[Math.floor(hash(s, 2) * 4)], hair: HAIR[Math.floor(hash(s, 3) * 5)], jacket: o.jacket || JACKET[Math.floor(hash(s, 4) * 8)], pants: PANTS[Math.floor(hash(s, 5) * 4)], dog: o.dog });
}
function stepPerson(p, dt) {
  if (p.wait > 0) { p.wait -= dt; return; }
  const tgt = p.path[p.seg + p.dir]; if (!tgt) { p.dir = -p.dir; p.wait = 1 + hash(p.ph, 3) * 3; return; }
  const dx = tgt[0] - p.x, dy = tgt[1] - p.y, d = Math.hypot(dx, dy), step = p.v * dt;
  if (d <= step) { p.x = tgt[0]; p.y = tgt[1]; p.seg += p.dir; if (p.seg + p.dir < 0 || p.seg + p.dir >= p.path.length) { p.dir = -p.dir; p.wait = 1 + hash(p.ph, 4) * 4; } } else { p.x += (dx / d) * step; p.y += (dy / d) * step; p.fx = dx / d; p.fy = dy / d; }
}
function drawPerson(p, t, key) {
  const [sx, sy] = S2(p.x, p.y), cyc = p.kind === 'run' ? 9 : 5, ph = (Math.floor(t * cyc + p.ph) & 3), leg = ph === 1 ? 1 : ph === 3 ? -1 : 0, moving = p.wait <= 0, F = LF.top;
  const hair = rgb32(p.hair, F), skin = rgb32(p.skin, F), jk = rgb32(p.jacket, F), jk2 = rgb32(p.jacket, LF.l, 0.8), pn = rgb32(p.pants, F), sh = rgb32([30, 30, 34], F), front = p.fy + p.fx * 0.2 > 0;
  const a = moving ? leg : 0, S = (dx, dy, c) => spx(sx + dx, sy + dy, c, key);
  S(-1, 0, sh); S(1, 0, sh); if (a !== 0) { S(a > 0 ? 1 : -1, 0, 0); S(a > 0 ? 1 : -1, -1, pn); }
  for (let y = -3; y <= -1; y++) { if (!(a > 0 && y === -1)) S(-1, y, pn); if (!(a < 0 && y === -1)) S(1, y, pn); }
  for (let y = -7; y <= -4; y++) for (let x = -1; x <= 1; x++) S(x, y, x === 0 ? jk : x < 0 ? jk2 : jk);
  S(-2, -6 + (a > 0 ? 1 : 0), jk2); S(2, -6 + (a < 0 ? 1 : 0), jk2); S(-2, -5, skin); S(2, -5, skin);
  for (let x = -1; x <= 1; x++) { S(x, -8, front ? skin : hair); S(x, -9, front ? skin : hair); S(x, -10, hair); }
  if (front) { S(-1, -10, hair); S(1, -10, hair); S(0, -9, rgb32([40, 30, 30], F)); }
  if (p.dog) { const dgx = sx - Math.round(p.fx * 5), dgy = sy + 1; const c = rgb32(p.dog, F); S(dgx - sx - 1, 0 + 1, c); S(dgx - sx, 1, c); S(dgx - sx + 1, 1, c); S(dgx - sx, 0, c); S(dgx - sx - 2, 0, c); }
  if (p.kind === 'bike') { const wc = rgb32([22, 24, 28], F); for (const wx of [-3, 3]) { S(wx, 0, wc); S(wx, -1, wc); S(wx + (wx > 0 ? 1 : -1), -1, wc); S(wx, -2, wc); } for (let x = -3; x <= 3; x++) S(x, -2, wc); }
  const L = Math.min(2.4, 11 / 36 / Math.tan((Math.max(LS.s.el, 6) * Math.PI) / 180)), az = (LS.s.az * Math.PI) / 180, e = [(Math.cos(az) - Math.sin(az)) * HW * L, (Math.cos(az) + Math.sin(az)) * HH * L];
  if (LS.I > 0.05) for (let k = 0; k <= 6; k++) blend(Math.round(sx + (e[0] * k) / 6), Math.round(sy + (e[1] * k) / 6), 14, 20, 38, 0.32);
}

// ---- Cars ----
const CARCOL = [[170, 40, 40], [40, 80, 150], [220, 220, 224], [30, 32, 38], [160, 160, 168], [200, 160, 40], [60, 110, 70], [120, 40, 60]];
const CARS = [];
function route(a, b, v, o = {}) { CARS.push({ a, b, v, t: o.t0 ?? Math.random(), n: o.n || 0, big: o.big, col: o.col }); }
const carParts = (col, big) => big ? [[0, 0, 0, 0.8, 0.3, 3, [30, 32, 38]], [0, 0, 3, 0.82, 0.32, 6, col], [-0.08, 0, 9, 0.46, 0.3, 3, [48, 66, 86]], [-0.08, 0, 12, 0.44, 0.28, 1, col]] : [[0, 0, 0, 0.58, 0.26, 2, [30, 32, 38]], [0, 0, 2, 0.62, 0.3, 4, col], [-0.04, 0, 6, 0.34, 0.29, 3, [48, 66, 86]], [-0.04, 0, 9, 0.3, 0.27, 1, col]];
function drawCar(x, y, f, col, big, key, moving) {
  shadowBlob(x, y, big ? 0.8 : 0.62, 0.3, big ? 12 : 9, f, 0.3); model(carParts(col, big), x, y, 0, f, key);
  if (LS.night > 0.4) { const fx = f[0], fy = f[1], rx = -fy, ry = fx; for (const sgn of [-1, 1]) { const [hx, hy] = S2(x + fx * 0.33 + rx * 0.09 * sgn, y + fy * 0.33 + ry * 0.09 * sgn, 4); if (moving) { spx(hx, hy, pack(255, 244, 200), key + 4); DLIGHTS.push({ x, y, z: 4, ox: fx * 0.5, oy: fy * 0.5, r: 38, c: [255, 232, 170], a: 0.65 }); } const [tx, ty] = S2(x - fx * 0.31 + rx * 0.09 * sgn, y - fy * 0.31 + ry * 0.09 * sgn, 4); spx(tx, ty, pack(230, 40, 34), key + 4); } }
}
const PARKED = [[5.3, 19.55, [1, 0], 0], [8.9, 19.55, [1, 0], 2], [12.1, 19.5, [1, 0], 4], [28.4, 19.5, [1, 0], 6], [17.2, 19.15, [0, 1], 1], [18.4, 19.15, [0, 1], 5], [19.6, 19.15, [0, 1], 3], [22.0, 19.1, [0, 1], 7], [23.6, 19.1, [0, 1], 2], [4.0, 3.9, [0, 1], 3], [5.2, 4.3, [0, 1], 0], [6.4, 3.8, [0, 1], 6]];
for (const [x, y] of [[16.3, 24.2], [18.7, 24.2], [23.5, 24.2]]) PARKED.push([x + 1.4, y - 1.4 + 0.2, [0, 1], Math.floor(hash(x, y) * 8)]);

// ---- Aircraft ----
const planeParts = (acc, jet) => jet ? [[0, 0, 4, 1.0, 0.13, 6, [236, 238, 240]], [0.05, 0, 3.4, 0.3, 0.9, 1.2, [220, 224, 228]], [-0.44, 0, 8, 0.12, 0.03, 9, acc], [-0.43, 0, 15, 0.1, 0.38, 1, [220, 224, 228]], [0.46, 0, 8, 0.1, 0.08, 2, [50, 70, 90]]] :
  [[0, 0, 3, 0.64, 0.1, 5, [236, 238, 240]], [0, 0, 4.4, 0.66, 0.105, 1.3, acc], [0.04, 0, 8.4, 0.16, 0.96, 1, [236, 238, 240]], [-0.29, 0, 8, 0.1, 0.025, 7, acc], [-0.28, 0, 14, 0.07, 0.34, 0.9, [236, 238, 240]], [0.18, 0, 8, 0.14, 0.09, 2, [50, 70, 90]], [0.34, 0, 5.4, 0.015, 0.3, 1, [30, 30, 34]]];
function drawPlane(x, y, z, f, t, acc, key, o = {}) {
  const alt = z; shadowPoly([[0.34, 0], [-0.3, 0], [0.04, 0.5], [0.04, -0.5]].map(([u, v]) => { const L = Math.min(3, (alt + 6) / 36 / Math.tan((Math.max(LS.s.el, 8) * Math.PI) / 180)), az = (LS.s.az * Math.PI) / 180; return S2(x + f[0] * u - f[1] * v + Math.cos(az) * L, y + f[1] * u + f[0] * v + Math.sin(az) * L); }), 0.28);
  model(planeParts(acc, o.jet), x, y, z, f, key);
  if (z < 4 && !o.parked) for (const [u, v] of [[0.2, 0], [-0.04, -0.1], [-0.04, 0.1]]) box3(x + f[0] * u - f[1] * v, y + f[1] * u + f[0] * v, z, 0.05, 0.04, 3, f, [30, 30, 34], key);
  if (LS.night > 0.3) { const lw = S2(x + f[0] * 0.04 + f[1] * 0.48, y + f[1] * 0.04 - f[0] * 0.48, z + 9), rw = S2(x + f[0] * 0.04 - f[1] * 0.48, y + f[1] * 0.04 + f[0] * 0.48, z + 9); for (const [p, c] of [[lw, [255, 60, 50]], [rw, [60, 255, 110]]]) { spx(p[0], p[1], pack(...c), key + 5); spx(p[0] + 1, p[1], pack(...c), key + 5); } if (Math.floor(t * 1.4) % 2 === 0) { const tl = S2(x - f[0] * 0.3, y - f[1] * 0.3, z + 17); spx(tl[0], tl[1], pack(255, 255, 255), key + 5); DLIGHTS.push({ x: x - f[0] * 0.3, y: y - f[1] * 0.3, z: z + 17, ox: 0, oy: 0, r: 22, c: [255, 255, 255], a: 0.5 }); } }
}
const RWY = 13.7, TWY = 11.75;
const ARRIVE = NORTHBOUND
  ? [[44, RWY, 150, 3.4], [24.0, RWY, 0, 2.8], [14.0, RWY, 0, 0.6, 0, 1], [14.0, 12.6, 0, 0.45], [14.0, TWY, 0, 0.45], [9.4, TWY, 0, 0.45], [9.4, 9.7, 0, 0.4, 9]]
  : [[-14, RWY, 150, 3.4], [3.0, RWY, 0, 2.8], [14.0, RWY, 0, 0.6, 0, 1], [14.0, 12.6, 0, 0.45], [14.0, TWY, 0, 0.45], [9.4, TWY, 0, 0.45], [9.4, 9.7, 0, 0.4, 9]];
const DEPART = NORTHBOUND
  ? [[9.4, 9.7, 0, 0.4], [9.4, TWY, 0, 0.45], [23.05, TWY, 0, 0.45], [23.05, 13.1, 0, 0.45], [23.05, RWY, 0, 0.4, 2.5], [19.0, RWY, 0, 2.8, 0, 1], [9.0, RWY, 40, 3.4], [-16, RWY, 160, 3.8]]
  : [[9.4, 9.7, 0, 0.4], [9.4, TWY, 0, 0.45], [5.6, TWY, 0, 0.45], [5.6, 13.1, 0, 0.45], [5.6, RWY, 0, 0.4, 2.5], [9.0, RWY, 0, 2.8, 0, 1], [19.0, RWY, 40, 3.4], [40, RWY, 160, 3.8]];
const plane = { path: ARRIVE, seg: 1, x: ARRIVE[0][0], y: RWY, z: 150, v: 3.4, f: [NORTHBOUND ? -1 : 1, 0], wait: 6, acc: [200, 50, 40] };
function stepPlane(dt) {
  if (plane.wait > 0) { plane.wait -= dt; return; }
  const tgt = plane.path[plane.seg];
  if (!tgt) { plane.path = plane.path === ARRIVE ? DEPART : ARRIVE; plane.seg = 1; [plane.x, plane.y, plane.z] = plane.path[0]; plane.v = plane.path[0][3]; plane.wait = plane.path === DEPART ? 5 : 14; return; }
  const [tx, ty, tz, tv, hold = 0, ramp = 0] = tgt, dx = tx - plane.x, dy = ty - plane.y, dz = (tz - plane.z) / 40, d = Math.hypot(dx, dy, dz), flat = Math.hypot(dx, dy);
  plane.v += (tv - plane.v) * Math.min(1, dt * (ramp ? 0.5 : 2.2)); const step = Math.max(0.06, plane.v) * dt;
  if (flat > 0.001) { const nf = [dx / flat, dy / flat], k = Math.min(1, dt * 3); plane.f = [plane.f[0] + (nf[0] - plane.f[0]) * k, plane.f[1] + (nf[1] - plane.f[1]) * k]; const m = Math.hypot(...plane.f); plane.f = [plane.f[0] / m, plane.f[1] / m]; }
  if (d <= step) { plane.x = tx; plane.y = ty; plane.z = tz; plane.seg++; plane.wait = hold; } else { plane.x += (dx / d) * step; plane.y += (dy / d) * step; plane.z += (dz / d) * step * 40; }
}
const STANDS = [[5.0, 9.0, [0, 1], [40, 90, 160]], [7.4, 9.4, [0.2, 0.98], [30, 120, 80]], [12.4, 9.2, [-0.1, 1], [220, 170, 40]], [16.2, 9.0, [0.1, 1], [160, 60, 110]], [18.6, 9.6, [0, 1], [200, 50, 40]]];

// ---- Train, turbines, smoke, windsock ----
const TRAIN = { x: -30, wait: 5 }, SMOKE = [];
const TURBINES = TURBINE_POS;
function setupActors() {
  PEOPLE.length = 0; CARS.length = 0;
  person([[2.4, 19.2], [30, 19.2]], { v: 0.5, seed: 1 }); person([[28, 19.2], [4, 19.2]], { v: 0.42, seed: 2 }); person([[6, 19.3], [14, 19.3]], { v: 0.38, seed: 3, dog: [150, 110, 70] });
  person([[3, 16.3], [26, 16.3]], { v: 0.5, seed: 4 }); person([[14.2, 24.1], [25.5, 24.1]], { v: 0.46, seed: 5, dog: [40, 40, 44] }); person([[25.5, 22.95], [14.5, 22.95]], { v: 0.44, seed: 6 });
  person([[10.4, 20.8], [10.4, 31]], { v: 0.95, kind: 'run', seed: 7 }); person([[10.4, 31], [10.4, 20.8]], { v: 1.7, kind: 'bike', seed: 8 }); person([[10.4, 21.5], [10.4, 30.5]], { v: 1.4, kind: 'bike', seed: 9 });
  person([[6.1, 7.9], [6.1, 8.7], [8.8, 9.0]], { v: 0.4, seed: 10, jacket: [230, 200, 40] }); person([[12.0, 8.1], [12.6, 10.6]], { v: 0.35, seed: 11, jacket: [230, 200, 40] }); person([[4.4, 7.7], [8.6, 9.2], [8.6, 7.7]], { v: 0.45, seed: 12 });
  person([[16.9, 19.1], [19.9, 19.1]], { v: 0.3, seed: 13 }); person([[2.8, 25.6], [8.5, 25.6]], { v: 0.35, seed: 14 }); person([[3.4, 22.4], [3.4, 23.6], [4.2, 23.0]], { v: 0.4, seed: 15, wait: 1 });
  route([0, 20.08], [32, 20.08], 1.5, { t0: 0.1 }); route([32, 19.62], [0, 19.62], 1.3, { t0: 0.45 }); route([0, 20.08], [32, 20.08], 1.7, { t0: 0.7, big: 1 });
  route([32, 15.5], [0, 15.5], 1.6, { t0: 0.3 }); route([0, 15.9], [32, 15.9], 1.4, { t0: 0.8 });
  route([30.65, 8], [30.65, 32], 2.4, { t0: 0.2 }); route([30.15, 32], [30.15, 8], 2.2, { t0: 0.6 }); route([30.65, 8], [30.65, 32], 2.0, { t0: 0.9, big: 1 });
  route([12.6, 23.75], [26.6, 23.75], 1.0, { t0: 0.3 }); route([26.6, 29.2], [12.6, 29.2], 0.9, { t0: 0.7 });
  route([1.65, 0], [1.65, 32], 1.3, { t0: 0.5 }); route([13.35, 20.7], [13.35, 32], 1.0, { t0: 0.2 });
}
function updateActors(dt) {
  for (const p of PEOPLE) stepPerson(p, dt);
  for (const c of CARS) { const len = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]); c.t += (c.v * dt) / len; if (c.t > 1) { c.t = 0; c.n++; } }
  stepPlane(dt);
  if (TRAIN.wait > 0) TRAIN.wait -= dt; else { TRAIN.x += 2.2 * dt; if (TRAIN.x > 52) { TRAIN.x = -34; TRAIN.wait = 30 + Math.random() * 30; } }
  SMOKE.length && SMOKE.forEach((s) => { s.life += dt; s.z += 9 * dt; s.x += 0.16 * dt; s.y -= 0.12 * dt; });
  while (SMOKE.length && SMOKE[0].life > 6) SMOKE.shift();
  if (Math.random() < dt * 5) for (const [x, y, z] of STACKS) SMOKE.push({ x, y, z, life: 0, big: 1 });
  if (seasonNow() !== 'summer' && Math.random() < dt * 2.5) for (const [x, y, z] of CHIMNEYS) if (hash(x * 9, y * 9) < 0.5) SMOKE.push({ x, y, z, life: 0 });
}
function drawActors(t) {
  lightFrame(); DLIGHTS.length = 0; QUEUE.length = 0;
  const az = (LS.s.az * Math.PI) / 180; SHV = [(Math.cos(az) - Math.sin(az)) * HW, (Math.cos(az) + Math.sin(az)) * HH];
  for (const p of PEOPLE) queue(keyOf(p.x, p.y) + 1, () => drawPerson(p, t, keyOf(p.x, p.y) + 1));
  for (const c of CARS) { const x = c.a[0] + (c.b[0] - c.a[0]) * c.t, y = c.a[1] + (c.b[1] - c.a[1]) * c.t, l = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]), f = [(c.b[0] - c.a[0]) / l, (c.b[1] - c.a[1]) / l], col = c.col || CARCOL[Math.floor(hash(c.n, c.a[0] * 7 + c.b[1]) * 8)]; queue(keyOf(x, y) + 2, () => drawCar(x, y, f, col, c.big, keyOf(x, y) + 2, true)); }
  for (const [x, y, f, ci] of PARKED) queue(keyOf(x, y) + 2, () => drawCar(x, y, f, CARCOL[ci], 0, keyOf(x, y) + 2, false));
  queue(keyOf(plane.x, plane.y) + 3, () => drawPlane(plane.x, plane.y, plane.z, plane.f, t, plane.acc, keyOf(plane.x, plane.y) + 3));
  for (const [x, y, f, acc] of STANDS) queue(keyOf(x, y) + 3, () => drawPlane(x, y, 0, f, t, acc, keyOf(x, y) + 3, { parked: true }));
  if (TRAIN.wait <= 0) for (let i = 0; i < 14; i++) { const gx = TRAIN.x - i * 0.62, col = i === 0 ? [40, 90, 70] : [[120, 70, 50], [110, 112, 118], [150, 60, 40], [40, 42, 48]][i % 4]; queue(keyOf(gx, 1.2) + 2, () => { shadowBlob(gx, 1.2, 0.56, 0.26, 10, [1, 0], 0.3); box3(gx, 1.19, 1, 0.56, 0.26, i === 0 ? 11 : 9, [1, 0], col, keyOf(gx, 1.2) + 2); if (i === 0 && LS.night > 0.4) { const [hx, hy] = S2(gx + 0.3, 1.19, 6); spx(hx, hy, pack(255, 246, 200), 9999); DLIGHTS.push({ x: gx + 0.3, y: 1.19, z: 6, ox: 0.6, oy: 0, r: 46, c: [255, 240, 190], a: 0.7 }); } }); }
  QUEUE.sort((a, b) => a.key - b.key); for (const q of QUEUE) q.fn();
  // turbines
  for (const [gx, gy] of TURBINES) { const [hx, hy] = S2(gx, gy, 132), a0 = (S.detail === 'off' ? 0.4 : t * 1.3) + gx; for (let k = 0; k < 3; k++) { const a = a0 + (k * Math.PI * 2) / 3, ex = hx + Math.round(Math.cos(a) * 20 * -0.894), ey = hy + Math.round(Math.cos(a) * 20 * 0.447 - Math.sin(a) * 20); dline(hx, hy, ex, ey, pack(...[236, 238, 240].map((v, i) => v * LS.F[0][i])), 0); } if (LS.night > 0.35 && (S.detail === 'off' || Math.floor(t) % 2 === 0)) { spx(hx, hy - 3, pack(255, 58, 42), 9999); DLIGHTS.push({ x: gx, y: gy, z: 135, ox: 0, oy: 0, r: 20, c: [255, 60, 50], a: 0.6 }); } }
  // windsock, pointing where the wind is going
  { const wd = (MORNING.weather.windDir + 180) * Math.PI / 180, dgx = -Math.cos(wd), dgy = -Math.sin(wd); const [bx, by] = S2(11.0, 12.6, 0); for (let z = 0; z < 22; z++) spx(bx, by - z, pack(...[80, 84, 92].map((v, i) => v * LS.F[2][i])), keyOf(11, 12.6)); for (let k = 0; k < 4; k++) { const [sx, sy] = S2(11.0 + dgx * (0.12 + k * 0.1), 12.6 + dgy * (0.12 + k * 0.1), 21 - k * 0.8 - Math.sin(t * 2 + k) * 0.6); const c = k % 2 ? [236, 238, 240] : [240, 110, 40]; for (let a = 0; a < 3 - (k >> 1); a++) spx(sx, sy + a, pack(...c.map((v, i) => v * LS.F[0][i])), 9999); } }
  // smoke
  for (const s of SMOKE) { const [x, y] = S2(s.x, s.y, s.z), r = s.big ? 2 + s.life * 0.9 : 1 + s.life * 0.5, a = Math.max(0, (s.big ? 0.4 : 0.3) - s.life / (s.big ? 16 : 12)), g = 190 * Math.min(1, LS.F[0][0]) + 20; for (let dy = -Math.floor(r); dy <= r; dy++) for (let dx = -Math.floor(r); dx <= r; dx++) if (dx * dx + dy * dy <= r * r && bay(x + dx, y + dy) < 0.8) blend(x + dx, y + dy, g, g + 4, g + 8, a); }
}
function dline(x0, y0, x1, y1, c, key) { const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1); for (let i = 0; i <= n; i++) spx(Math.round(x0 + ((x1 - x0) * i) / n), Math.round(y0 + ((y1 - y0) * i) / n), c, key); }
