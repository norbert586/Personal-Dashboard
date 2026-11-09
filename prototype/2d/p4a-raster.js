
// ============ Raster core: 64x32 isometric tiles, drawn once into indexed buffers ============
// Axes: +x runs south (down-right on screen), +y runs west (down-left). North is up-left.
const HW = 32, HH = 16, G = 32;
const WW = 2200, WH = 1330, OX = 1100, OY = 205;
const WB = new Uint16Array(WW * WH);   // palette entry per pixel
const HB = new Uint8Array(WW * WH);    // clickable object id per pixel
const DB = new Uint16Array(WW * WH);   // depth key per pixel, so moving sprites can pass behind things
const SH = new Uint8Array(WW * WH);    // cast sun shadows (rebuilt when the sun moves)
let curId = 0, curKey = 0;
const P = (gx, gy, gz = 0) => [OX + (gx - gy) * HW, OY + (gx + gy) * HH - gz];
const keyOf = (x, y) => Math.round((x + y) * 8);
const begin = (id, key) => { curId = id; curKey = key; };
const gxOf = (x, y) => ((x - OX) / HW + (y - OY) / HH) / 2;
const gyOf = (x, y) => ((y - OY) / HH - (x - OX) / HW) / 2;
function put(x, y, c) { if (x < 0 || y < 0 || x >= WW || y >= WH) return; const i = y * WW + x; WB[i] = c; HB[i] = curId; DB[i] = curKey; }

// Scanline polygon fill with float vertices and centre sampling (no gaps between neighbours).
function scan(pts, cb, W = WW, H = WH) {
  let minY = Infinity, maxY = -Infinity;
  for (const p of pts) { if (p[1] < minY) minY = p[1]; if (p[1] > maxY) maxY = p[1]; }
  const y0 = Math.max(0, Math.ceil(minY - 0.5)), y1 = Math.min(H - 1, Math.floor(maxY - 0.5)), xs = [];
  for (let y = y0; y <= y1; y++) {
    const sy = y + 0.5; xs.length = 0;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const yi = pts[i][1], yj = pts[j][1];
      if ((yi > sy) !== (yj > sy)) xs.push(pts[i][0] + ((sy - yi) * (pts[j][0] - pts[i][0])) / (yj - yi));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.ceil(xs[k] - 0.5)), xb = Math.min(W - 1, Math.floor(xs[k + 1] - 0.5));
      for (let x = xa; x <= xb; x++) cb(x, y);
    }
  }
}
function poly(pts, fill) {
  if (typeof fill === 'number') scan(pts, (x, y) => put(x, y, fill));
  else scan(pts, (x, y) => { const c = fill(x, y); if (c >= 0) put(x, y, c); });
}
function hull(pts) {
  const p = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const q of p) { while (lo.length > 1 && cr(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop(); lo.push(q); }
  for (let i = p.length - 1; i >= 0; i--) { const q = p[i]; while (up.length > 1 && cr(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop(); up.push(q); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}

// ---- Noise and dithering ----
const hash = (x, y) => { let h = (Math.imul(x | 0, 374761393) + Math.imul(y | 0, 668265263)) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; };
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x, y) => BAYER[((y & 3) << 2) | (x & 3)] / 16;
const NZT = new Float32Array(64 * 64); for (let i = 0; i < NZT.length; i++) NZT[i] = hash(i & 63, i >> 6);
function nz(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi, u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  const a = NZT[((yi & 63) << 6) | (xi & 63)], b = NZT[((yi & 63) << 6) | ((xi + 1) & 63)], c = NZT[(((yi + 1) & 63) << 6) | (xi & 63)], d = NZT[(((yi + 1) & 63) << 6) | ((xi + 1) & 63)];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

// ---- Ground textures: each returns a palette entry for the pixel ----
const clampLv = (lv, n) => (lv < 0 ? 0 : lv > n - 1 ? n - 1 : lv);
function grassP(x, y) {
  const n = nz(x * 0.04, y * 0.065) + (bay(x, y) - 0.5) * 0.16, h = hash(x, y);
  let lv = n < 0.42 ? 1 : n < 0.7 ? 2 : 3;
  if (h < 0.05) lv--; else if (h > 0.955) lv++;
  return pix(M.grass + clampLv(lv, 4));
}
function turfP(x, y) { // mown stripes along x
  const stripe = Math.floor(gxOf(x, y) * 2) & 1, h = hash(x, y);
  return pix(M.turf + clampLv(1 + stripe + (h < 0.05 ? -1 : h > 0.96 ? 1 : 0), 4));
}
function dirtP(x, y) { const n = nz(x * 0.08, y * 0.1), h = hash(x, y); return pix(M.dirt + clampLv((n < 0.45 ? 0 : n < 0.7 ? 1 : 2) + (h > 0.94 ? 1 : h < 0.04 ? -1 : 0), 3)); }
function gravelP(x, y) { const h = hash(x, y), n = nz(x * 0.05, y * 0.08); return pix(M.gravel + clampLv((n < 0.5 ? 1 : 2) + (h < 0.18 ? -1 : h > 0.86 ? 1 : 0), 4)); }
function mulchP(x, y) { return pix(M.mulch + clampLv(Math.floor(hash(x, y) * 3), 3)); }
function asphP(x, y) {
  const h = hash(x, y), blk = hash(x >> 5, (y >> 4) + 777); let lv = 1;
  if (blk > 0.985) lv = 2; else if (blk < 0.012) lv = 0;
  if (h < 0.05) lv++; else if (h > 0.97) lv--;
  return pix(M.asph + clampLv(lv, 4));
}
function concP(x, y) { const h = hash(x, y); return pix(M.conc + clampLv(2 + (h < 0.07 ? -1 : h > 0.95 ? 1 : 0) - (nz(x * 0.02, y * 0.03) < 0.3 && bay(x, y) < 0.3 ? 1 : 0), 4)); }
const walkP = (axis) => (x, y) => { // sidewalk slabs: seams every 0.2 tile across the path
  const s = axis === 'x' ? gxOf(x, y) : gyOf(x, y), h = hash(x, y), seam = (((s * 5) % 1) + 1) % 1 < 0.05;
  return pix(M.walk + (seam ? 0 : clampLv(2 + (h < 0.07 ? -1 : h > 0.94 ? 1 : 0), 4)));
};
const fieldP = (name, dir) => (x, y) => { // rows of crops; phase is a diagonal wave so colour cycling ripples across the field
  const row = dir === 'x' ? Math.floor(gyOf(x, y) * 7) : Math.floor(gxOf(x, y) * 7), wave = Math.floor((gxOf(x, y) + gyOf(x, y)) * 0.8);
  return pix(M[name] + (((row & 1) * 1 + wave) % 6 + 6) % 6);
};
const stubP = (x, y) => { const row = Math.floor(gyOf(x, y) * 9), h = hash(x, y); return pix(M.stub + clampLv((row & 1) + (h < 0.12 ? -1 : h > 0.9 ? 1 : 0), 3)); };
const plowP = (x, y) => { const row = Math.floor((gxOf(x, y) + gyOf(x, y)) * 6); return pix(M.plow + clampLv((((row % 3) + 3) % 3) - (hash(x, y) < 0.08 ? 1 : 0), 3)); };
const solid = (name, lv = 0, f = 0) => pix(M[name] + lv, f);

// ground quads in grid coordinates
const ground = (x0, y0, x1, y1, paint) => poly([P(x0, y0), P(x1, y0), P(x1, y1), P(x0, y1)], paint);
function groundDisc(cx, cy, rx, ry, paint, n = 16) { const pts = []; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; pts.push(P(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry)); } poly(pts, paint); }
const darkOf = (idx) => { const e = META[idx]; if (!e || !MAT[e.m].ground || e.lv === 0) return idx; return pix(e.m * 8 + e.lv - 1, e.f); };
// contact shadow: darken the ground strip hugging a wall base
function aoStrip(pts) { poly(pts, (x, y) => darkOf(WB[y * WW + x])); }

// ---- 3x5 pixel font for signs ----
const FONT = { A: '010101111101101', B: '110101110101110', C: '011100100100011', D: '110101101101110', E: '111100110100111', F: '111100110100100', G: '011100101101011', H: '101101111101101', I: '111010010010111', J: '001001001101010', K: '101101110101101', L: '100100100100111', M: '101111111101101', N: '110101101101101', O: '010101101101010', P: '110101110100100', Q: '010101101111011', R: '110101110101101', S: '011100010001110', T: '111010010010010', U: '101101101101111', V: '101101101101010', W: '101101111111101', X: '101101010101101', Y: '101101010010010', Z: '111001010100111', 0: '111101101101111', 1: '010110010010111', 2: '110001010100111', 3: '110001010001110', 4: '101101111001001', 5: '111100110001110', 6: '011100111101111', 7: '111001010100100', 8: '111101111101111', 9: '111101111001110', '(': '001010010010001', ')': '100010010010100', '-': '000000111000000', '&': '010101010101011', ' ': '000000000000000' };
const textW = (s, sc = 1) => s.length * 4 * sc - sc;
function ptext(s, x, y, c, sc = 1) {
  for (const ch of s) {
    const g = FONT[ch] || FONT[' '];
    for (let r = 0; r < 5; r++) for (let k = 0; k < 3; k++) if (g[r * 3 + k] === '1') for (let a = 0; a < sc; a++) for (let b = 0; b < sc; b++) put(x + k * sc + a, y + r * sc + b, c);
    x += 4 * sc;
  }
}
