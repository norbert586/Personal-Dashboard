
// ============ Map layout: a small Michigan town with an airfield (G = 32 tiles) ============
const NOTREE = [], ROADS = [], WALKS = [], DECALS = [], PREOBJ = [];
const TURBINE_POS = [[28.3, 9.2], [28.6, 12.7], [31.0, 6.0]];
// Painted runway numbers (5x7, two-pixel strokes), upright for a pilot landing on that end.
const RWYFONT = { 1: ['00110', '01110', '00110', '00110', '00110', '00110', '01111'], 3: ['11110', '00011', '00011', '01110', '00011', '00011', '11110'], 6: ['01110', '11000', '11000', '11110', '11011', '11011', '01110'], 8: ['01110', '11011', '11011', '01110', '11011', '11011', '01110'] };
function runwayNumber(s, cx, cy, north) {
  const px = 0.1, w = (s.length * 6 - 1) * px, h = 7 * px;
  for (let i = 0; i < s.length; i++) { const g = RWYFONT[s[i]]; for (let r = 0; r < 7; r++) for (let k = 0; k < 5; k++) {
    if (g[r][k] !== '1') continue; const u = i * 6 + k + 0.5, v = r + 0.5;
    const gx = north ? cx - h / 2 + v * px : cx + h / 2 - v * px, gy = north ? cy + w / 2 - u * px : cy - w / 2 + u * px;
    ground(gx - px / 2, gy - px / 2, gx + px / 2, gy + px / 2, mark('paintW', 1));
  } }
}
const keep = (x0, y0, x1, y1) => NOTREE.push([x0, y0, x1, y1]);
const free = (x, y, m = 0.3) => !NOTREE.some((r) => x > r[0] - m && x < r[2] + m && y > r[1] - m && y < r[3] + m);
const mark = (name, lv) => () => solid(name, lv);

function woodsP(x, y) { // woods seen from above: a field of round tree crowns
  const cx = Math.floor(x / 12), cy = Math.floor(y / 10); let best = 9, tone = 0.5;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const kx = cx + i, ky = cy + j, px = kx * 12 + 3 + hash(kx, ky) * 6, py = ky * 10 + 2.5 + hash(ky + 91, kx) * 5, d = ((x - px) / 7) ** 2 + ((y - py) / 6) ** 2; if (d < best) { best = d; tone = hash(kx + 11, ky + 5); } }
  const m = tone > 0.72 ? M.shrub : M.pine;
  return pix(m + clampLv((best > 0.8 ? 0 : best < 0.36 ? 2 : 1) + (tone > 0.86 ? 1 : 0) + (hash(x, y) > 0.94 ? 1 : 0), 4));
}
function farP(x, y) {
  const a = gxOf(x, y), b = gyOf(x, y), fx = Math.floor(a / 7), fy = Math.floor(b / 7), k = hash(fx * 3 + 1, fy * 5 + 2);
  if (k < 0.16) return fieldP('crop', 'x')(x, y);
  if (k < 0.27) return plowP(x, y);
  if (k < 0.42) return grassP(x, y);
  return woodsP(x, y);
}
const roadX = (yc, w, x0, x1, o = {}) => { const h = w / 2; keep(x0, yc - h - 0.4, x1, yc + h + 0.4);
  WALKS.push(() => { ground(x0, yc - h - 0.4, x1, yc - h, walkP('x')); ground(x0, yc + h, x1, yc + h + 0.4, walkP('x')); });
  ROADS.push(() => { ground(x0, yc - h, x1, yc + h, asphP); if (!o.noLine) for (let x = x0 + 0.2; x < x1; x += 0.7) ground(x, yc - 0.02, x + 0.38, yc + 0.02, mark('paintY', 1)); }); };
const roadY = (xc, w, y0, y1, o = {}) => { const h = w / 2; keep(xc - h - 0.4, y0, xc + h + 0.4, y1);
  WALKS.push(() => { ground(xc - h - 0.4, y0, xc - h, y1, walkP('y')); ground(xc + h, y0, xc + h + 0.4, y1, walkP('y')); });
  ROADS.push(() => { ground(xc - h, y0, xc + h, y1, asphP); if (!o.noLine) for (let y = y0 + 0.2; y < y1; y += 0.7) ground(xc - 0.02, y, xc + 0.02, y + 0.38, mark('paintY', 1)); }); };
function parkingLot(x0, y0, x1, y1, dir = 'y') { keep(x0, y0, x1, y1); DECALS.push(() => { ground(x0, y0, x1, y1, asphP);
  if (dir === 'y') for (let x = x0 + 0.1; x <= x1 - 0.05; x += 0.3) ground(x, y0 + 0.05, x + 0.025, y0 + 0.4, mark('paintW', 0)); else for (let y = y0 + 0.1; y <= y1 - 0.05; y += 0.3) ground(x0 + 0.05, y, x0 + 0.4, y + 0.025, mark('paintW', 0)); }); }

// Seeded tree placement that avoids anything reserved by keep()
function grove(x0, y0, x1, y1, n, seed, pines = 0.35) {
  for (let i = 0; i < n; i++) {
    const x = x0 + hash(i, seed) * (x1 - x0), y = y0 + hash(i, seed + 9) * (y1 - y0); if (!free(x, y)) continue;
    if (hash(i, seed + 3) < pines) { const h = 46 + Math.round(hash(i, seed + 5) * 22); obj(0, keyOf(x, y), () => pineTree(x, y, h)); }
    else { const r = 16 + Math.round(hash(i, seed + 7) * 8), th = 19 + Math.round(hash(i, seed + 8) * 9); obj(0, keyOf(x, y), () => tree(x, y, { r, th })); }
  }
}

function buildWorld() {
  WB.fill(0); HB.fill(0); DB.fill(0); OBJECTS.length = 0; CASTERS.length = 0; LIGHTS.length = 0; CHIMNEYS.length = 0; STACKS.length = 0; NOTREE.length = 0; ROADS.length = 0; WALKS.length = 0; DECALS.length = 0; PREOBJ.length = 0;
  applySeason(seasonNow()); begin(0, 0);
  for (let y = 0; y < WH; y++) for (let x = 0; x < WW; x++) { const a = gxOf(x, y), b = gyOf(x, y); if (a > -0.6 && a < G + 0.6 && b > -0.6 && b < G + 0.6) continue; WB[y * WW + x] = farP(x, y); }
  ground(0, 0, G, G, grassP);

  // ---- roads ----
  roadX(15.7, 0.8, 0, G); roadX(19.85, 0.9, 0, G); roadX(23.55, 0.7, 12.6, 26.6); roadX(29.0, 0.7, 12.6, 26.6);
  roadY(1.4, 0.8, 0, G); roadY(26.5, 0.8, 0, 15.3); roadY(13.1, 0.7, 20.7, G); roadY(30.4, 1.1, 8, G); roadY(26.3, 0.7, 20.7, G);
  keep(0, 0.4, 32, 1.9); keep(26.9, 2, 28.4, 14);                       // rail corridor and a verge
  parkingLot(2.6, 2.7, 7.6, 5.3, 'y'); parkingLot(16.3, 18.9, 20.6, 19.4 - 0.0, 'y'); parkingLot(21.0, 18.65, 26.4, 19.4, 'y');
  WALKS.forEach((f) => f()); ROADS.forEach((f) => f()); DECALS.forEach((f) => f());
  keep(2.6, 5.4, 22.0, 14.6); keep(2.0, 0, 27, 5.3);                      // airfield
  // trail through the park, a rail-trail like the Macomb Orchard Trail
  ground(10.15, 20.3, 10.65, 31.5, walkP('y')); keep(10.0, 20.3, 10.8, 31.6);
  // apron, taxiway, runways
  ground(3.0, 7.4, 22.0, 11.4, concP);
  for (let x = 3.6; x < 22; x += 1.0) ground(x, 7.4, x + 0.025, 11.4, mark('conc', 0)); for (let y = 8.2; y < 11.4; y += 0.8) ground(3.0, y, 22.0, y + 0.025, mark('conc', 0));
  ground(2.4, 11.4, 22.8, 12.1, asphP); ground(2.6, 11.72, 22.6, 11.76, mark('paintY', 1));
  for (const cx of [5.2, 13.6]) ground(cx, 12.1, cx + 0.8, 13.0, asphP);
  ground(2.2, 13.0, 25.2, 14.4, (x, y) => asphP(x, y));
  ground(2.2, 13.04, 25.2, 13.08, mark('paintW', 1)); ground(2.2, 14.3, 25.2, 14.34, mark('paintW', 1));
  for (let x = 4.6; x < 22.7; x += 1.0) ground(x, 13.68, x + 0.5, 13.72, mark('paintW', 1));
  runwayNumber('36', 23.55, 13.7, true); runwayNumber('18', 3.85, 13.7, false);
  for (let k = 0; k < 6; k++) { const y = 13.15 + k * 0.17; ground(2.4, y, 3.1, y + 0.08, mark('paintW', 1)); ground(24.3, y, 25.0, y + 0.08, mark('paintW', 1)); }
  ground(22.6, 2.0, 23.5, 13.0, asphP); for (let y = 2.5; y < 12.6; y += 0.8) ground(23.02, y, 23.06, y + 0.4, mark('paintW', 1));
  ground(22.8, 12.1, 23.3, 13.0, asphP);
  for (let x = 2.2; x <= 25.2; x += 0.75) { const a = P(x, 13.0), b = P(x, 14.4); for (const q of [a, b]) for (let dx = 0; dx < 2; dx++) for (let dy = 0; dy < 2; dy++) put(q[0] + dx, q[1] + dy - 1, pix(M.rwyL)); if ((x * 4) % 3 === 0) light(x, 13.0, 1, 18, [255, 240, 200], 0.55); }
  for (let y = 13.05; y < 14.4; y += 0.2) for (const tx of [2.2, 25.2]) { const a = P(tx, y); put(a[0], a[1], pix(M.thrG)); }
  for (let x = 2.8; x < 22.4; x += 1) { const a = P(x, 11.4), b = P(x, 12.1); put(a[0], a[1], pix(M.twyL)); put(b[0], b[1], pix(M.twyL)); }
  for (let k = 0; k < 5; k++) { const [x, y] = P(NORTHBOUND ? 25.9 + k * 0.6 : 1.5 - k * 0.6, 13.7); put(x, y - 1, pix(M.rabbit + k)); put(x + 1, y - 1, pix(M.rabbit + k)); }
  // rail along the east edge
  ground(-0.5, 0.75, 32.5, 1.65, gravelP); for (let x = 0; x < 32.4; x += 0.24) ground(x, 0.85, x + 0.07, 1.55, mark('trunk', 0));
  ground(0, 1.0, 32, 1.04, mark('steel', 3)); ground(0, 1.34, 32, 1.38, mark('steel', 3));
  // parking stalls in front of the hangars are painted on the apron; fences along Airport Rd and the airfield front
  for (let x = 2.4; x < 25; x += 0.6) obj(0, keyOf(x, 14.62), () => pole(x, 14.62, 0, 9, pix(M.steel + 1, 2), 1));

  // ---- airfield buildings ----
  terminal(1, 2.6, 5.6, 7.6, 7.4); tower(2, 8.0, 6.1);
  hangar(3, 9.8, 5.0, 12.2, 7.2, 44, true); hangar(4, 12.8, 5.0, 15.2, 7.2, 44, false);
  fireStation(5, 16.0, 5.8, 18.0, 7.4);
  house({ id: 6, x: 19.2, y: 2.4, w: 2.6, d: 1.0, f: 1, style: { kind: 'siding', wall: 'sidY', roof: 'shN', door: 'doorB' }, front: 'L', garage: false, chimney: false, seed: 41 });
  house({ id: 6, x: 19.2, y: 3.9, w: 2.6, d: 1.0, f: 1, style: { kind: 'siding', wall: 'sidY', roof: 'shN', door: 'doorB' }, front: 'L', garage: false, chimney: false, seed: 42 });
  radarDome(7, 21.2, 6.6);
  // ---- Main Street ----
  const row = [['Cinema', 16, 2.0, 3.7, 'brickB', 'awnB', 'CINEMA'], ['Comics', 17, 3.7, 5.3, 'brickR', 'awnR', 'COMICS'], ['Sports bar', 18, 5.3, 6.9, 'brickY', 'awnG', 'SPORTS'], ['Bakery', 0, 6.9, 8.4, 'brickR', 'awnG', 'BAKERY'], ['Hardware', 0, 8.4, 10.0, 'brickB', 'awnR', 'HARDWARE'], ['Barber', 0, 10.0, 11.4, 'brickY', 'awnB', '']];
  row.forEach(([, id, x0, x1, brick, awn, name], i) => shop({ id, x0, x1, y0: 16.9, y1: 19.2, floors: i % 3 === 1 ? 3 : 2, brick, awn, name, seed: i * 5 + 2, ntok: [M.neonY, M.neonR, M.neonB][i % 3] + 1 }));
  church(12.2, 16.9);
  diner(8, 16.6, 17.5, 18.8, 18.7); kiosk(9, 19.3, 17.9, 20.2, 18.65);
  ['PIZZA', 'NAILS', 'VAPE', 'LOANS'].forEach((nm, i) => shop({ x0: 21.2 + i * 1.3, x1: 22.5 + i * 1.3, y0: 17.0, y1: 18.5, floors: 1, brick: ['brickY', 'brickR', 'brickB', 'brickY'][i], awn: ['awnR', 'awnB', 'awnG', 'awnR'][i], name: nm, seed: 30 + i, ntok: M.neonB + 1 }));
  // ---- park, trail and the ball field ----
  ballField(14, 2.2, 21.6); keep(1.8, 21.2, 5.0, 24.4); emptyLot(13, 7.0, 21.4); keep(6.8, 21.2, 8.7, 22.8);
  for (const [bx, by] of [[10.9, 22.0], [10.9, 26.0]]) bench(bx, by);
  for (let y = 21; y < 31; y += 2.6) lampPost(10.4, y);
  // ---- orchard and farm stand ----
  for (let r = 0; r < 5; r++) for (let c = 0; c < 8; c++) { const x = 2.3 + c * 0.95 + (r & 1) * 0.35, y = 26.4 + r * 0.9; keep(x - 0.3, y - 0.3, x + 0.3, y + 0.3); obj(11, keyOf(x, y), () => tree(x, y, { r: 11, th: 11, mats: ['leafA', 'leafC'] })); }
  farmStand(11, 5.0, 24.7); keep(4.8, 24.5, 6.4, 25.8);
  // ---- rail-side industry ----
  elevator(12, 13.0, 1.9); keep(12.8, 1.8, 17.2, 3.0);
  factory(26.95, 16.75, 2.25, 2.1); keep(26.7, 16.5, 29.45, 19.0); waterTower(10, 24.7, 3.4); keep(24.2, 2.9, 25.3, 4.0);
  for (const [tx, ty] of TURBINE_POS) { turbine(15, tx, ty); keep(tx - 0.3, ty - 0.3, tx + 0.3, ty + 0.3); }
  // ---- subdivision ----
  const xs = [13.9, 16.3, 18.7, 21.1, 23.5];
  const rows = [{ y: 21.3, front: 'L', st: 23.55 }, { y: 24.4, front: 'R', st: 23.55 }, { y: 27.0, front: 'L', st: 29.0 }, { y: 29.9, front: 'R', st: 29.0 }];
  rows.forEach((rw, ri) => xs.forEach((x, i) => {
    const seed = ri * 11 + i * 3 + 5, f = hash(seed, 1) < 0.4 ? 2 : 1, w = 2.1, d = 1.35, y = rw.y;
    keep(x, y, x + w, y + d + 0.4);
    house({ x, y, w, d, f, seed, front: rw.front, garage: hash(seed, 2) < 0.8 });
    if (rw.front === 'L') { PREOBJ.push(() => { ground(x + w - 0.95, y + d, x + w - 0.1, rw.st - 0.4, concP); ground(x + 0.15, y + d, x + 0.45, rw.st - 0.4, walkP('y')); }); obj(0, keyOf(x + 0.9, rw.st - 0.52), () => mailbox(x + 0.9, rw.st - 0.52)); }
    if (hash(seed, 6) < 0.6) obj(0, keyOf(x + 0.5, y + d + 0.55), () => tree(x + 0.5, y + d + 0.55, { r: 15, th: 16 }));
    if (hash(seed, 8) < 0.7) obj(0, keyOf(x + 0.15, y + d + 0.1), () => shrub(x + 0.15, y + d + 0.1, 7));
  }));
  for (let x = 3; x < 31; x += 3.6) lampPost(x, 19.25); for (let x = 2.5; x < 30; x += 4.5) lampPost(x, 16.3); for (let x = 14.5; x < 26; x += 3.4) { lampPost(x, 23.05); lampPost(x, 28.55); }
  // ---- power line along Airport Rd ----
  const tops = []; for (let x = 1.2; x < 31; x += 3.4) { const tp = [x, 16.45]; obj(0, keyOf(x, 16.45), () => utilityPole(x, 16.45)); tops.push(tp); }
  obj(0, 9999, () => { begin(0, 0); for (let i = 1; i < tops.length; i++) { const a = P(tops[i - 1][0], 16.45, 66), b = P(tops[i][0], 16.45, 66); wire(a, b, 4); } });
  // ---- trees around the edges and between blocks ----
  grove(0, 1.9, 32, 5, 40, 1, 0.5); grove(0, 15.7, 32, 16.5, 12, 2, 0.2); grove(0, 20.5, 11, 32, 60, 3, 0.3); grove(2.0, 5.4, 22, 5.0, 0, 4); grove(26.8, 5, 30, 14.6, 16, 5, 0.6); grove(0, 0, 4, 32, 40, 6, 0.5); grove(26.5, 20, 32, 32, 40, 7, 0.45); grove(11, 29.5, 26, 32, 18, 8, 0.3); grove(0, 30, 32, 32, 20, 9, 0.5);
  PREOBJ.forEach((f) => f());
  OBJECTS.sort((a, b) => a.key - b.key);
  for (const o of OBJECTS) { begin(o.id, o.key); o.draw(); }
  begin(0, 0);
}
