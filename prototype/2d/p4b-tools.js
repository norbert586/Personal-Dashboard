
// ============ Construction tools ============
const OBJECTS = [], CASTERS = [], LIGHTS = [];
const obj = (id, key, draw) => OBJECTS.push({ id, key, draw });
const caster = (x0, y0, x1, y1, h) => CASTERS.push({ pts: [[x0, y0], [x1, y0], [x1, y1], [x0, y1]], h });
const casterTree = (x, y, r, h, ch) => CASTERS.push({ tree: true, x, y, r, h, ch });
const light = (x, y, z, r, c, a = 1) => LIGHTS.push({ x, y, z, r, c, a });
const flat = (t) => () => t;

// Walls: paint(u, v) gets pixels across (u) and up (v) from the wall's bottom-left, returns a token or -1.
function wallLPoly(pts, Y, a, z0, paint, face = 1) {
  const left = P(a, Y, 0)[0];
  scan(pts, (x, y) => {
    const gx = Y + (x + 0.5 - OX) / HW, z = OY + (gx + Y) * HH - (y + 0.5), t = paint(x - left, Math.floor(z - z0)); if (t < 0) return;
    const i = y * WW + x; WB[i] = pix(t, face); HB[i] = curId; DB[i] = Math.round((gx + Y) * 8);   // true depth of this wall pixel
  });
}
function wallRPoly(pts, X, b, z0, paint, face = 2) {
  const left = P(X, b, 0)[0];
  scan(pts, (x, y) => {
    const gy = X - (x + 0.5 - OX) / HW, z = OY + (X + gy) * HH - (y + 0.5), t = paint(x - left, Math.floor(z - z0)); if (t < 0) return;
    const i = y * WW + x; WB[i] = pix(t, face); HB[i] = curId; DB[i] = Math.round((X + gy) * 8);
  });
}
const wallL = (Y, a, b, z0, z1, paint) => wallLPoly([P(a, Y, z0), P(b, Y, z0), P(b, Y, z1), P(a, Y, z1)], Y, a, z0, paint);
const wallR = (X, a, b, z0, z1, paint) => wallRPoly([P(X, a, z0), P(X, b, z0), P(X, b, z1), P(X, a, z1)], X, b, z0, paint);
function box(x0, y0, x1, y1, z0, h, o) {
  if (o.L) wallL(y1, x0, x1, z0, z0 + h, o.L);
  if (o.R) wallR(x1, y0, y1, z0, z0 + h, o.R);
  if (o.top) { const f = o.topFace || 0; poly([P(x0, y0, z0 + h), P(x1, y0, z0 + h), P(x1, y1, z0 + h), P(x0, y1, z0 + h)], (x, y) => { const t = o.top(x, y); return t < 0 ? -1 : pix(t, f); }); }
}

// ---- Wall textures ----
function texFn(kind, mat, seed = 0) {
  const m = M[mat];
  if (kind === 'brick') return (u, v) => {
    const row = Math.floor(v / 4), r = v - row * 4, uu = u + (row & 1) * 4, col = Math.floor(uu / 8), c = uu - col * 8;
    if (r === 0 || c === 0) return M.mortar + (hash(u, v) < 0.3 ? 1 : 0);
    const h = hash(col + seed, row); let lv = h < 0.12 ? 0 : h < 0.5 ? 1 : h < 0.88 ? 2 : 3;
    return m + clampLv(lv + (r === 1 ? 1 : r === 3 ? -1 : 0), 4);
  };
  if (kind === 'siding') return (u, v) => { const r = v & 3; return m + (r === 0 ? 0 : r === 1 ? 3 : hash(u, v) < 0.08 ? 1 : 2); };
  if (kind === 'stucco') return (u, v) => { const h = hash(u + seed, v), n = nz(u * 0.2, v * 0.25); return m + clampLv((n < 0.45 ? 1 : 2) + (h < 0.1 ? -1 : h > 0.92 ? 1 : 0), 4); };
  if (kind === 'cmu') return (u, v) => { const row = Math.floor(v / 8), r = v - row * 8, uu = u + (row & 1) * 8, c = uu % 16; if (r === 0 || c === 0) return m; return m + clampLv(1 + (hash(Math.floor(uu / 16) + seed, row) < 0.5 ? 0 : 1) + (r === 1 ? 1 : 0), 4); };
  if (kind === 'tin') return (u, v) => m + [3, 2, 1, 0][u & 3];
  return () => m + 2;
}
function winTok(du, dv, w) {
  const W = w.w, H = w.h;
  if (w.k === 'garage') { if (du === 0 || du === W - 1 || dv === H - 1) return M.trim + 1; if (dv % 6 === 0) return M.trim + 0; if (dv > H - 8 && dv < H - 2 && du % 8 > 1 && du % 8 < 7) return M.glass + 1; return M.trim + 2 - (du < W / 2 ? 0 : 1); }
  if (w.k === 'store') { // shop window: dark kick panel, big glass, thin mullions
    if (dv < 3) return M.brickB + 1; if (du === 0 || du === W - 1 || dv === H - 1) return M.trim + 1;
    if (du % 14 === 0) return M.trim + 0; if (w.lit) return M.glassLit + (dv > H * 0.55 ? 2 : 1);
    return M.glass + (((du + dv) % 11) < 2 ? 2 : dv > H * 0.5 ? 1 : 0);
  }
  if (du === 0 || du === W - 1 || dv === H - 1 || dv === 0) return M.trim + (dv === 0 ? 2 : 1);
  if (w.k === 'arch') { const r = W / 2, cx = (W - 1) / 2, top = H - 1 - r; if (dv > top && (du - cx) ** 2 + (dv - top) ** 2 > r * r) return -2; }
  if (du === (W >> 1) || (w.k !== 'fix' && dv === (H >> 1))) return M.trim + 1;
  if (w.lit) return M.glassLit + (dv > H * 0.6 ? 2 : dv > H * 0.3 ? 1 : 0);
  return M.glass + (((du + dv) % 9) < 2 ? 2 : dv > H * 0.55 ? 1 : 0);
}
function doorTok(du, dv, d) {
  const W = d.w, H = d.h;
  if (du === 0 || du === W - 1 || dv === H - 1) return M.trim + 1;
  if (d.glass && dv > H * 0.42 && du > 1 && du < W - 2) return d.lit ? M.glassLit + 1 : M.glass + 1;
  if (du === W >> 1 && dv > 1) return M[d.mat || 'doorR'] + 0;
  if (dv === Math.floor(H * 0.45) && du === W - 3) return M.trim + 2;
  return M[d.mat || 'doorR'] + (du < W / 2 ? 2 : 1);
}
// Build a facade painter from a spec: base wall + windows + doors + bands.
function facade(o) {
  const tex = texFn(o.kind || 'siding', o.mat, o.seed || 0), wins = o.wins || [], doors = o.doors || [], bands = o.bands || [];
  return (u, v) => {
    for (const d of doors) if (u >= d.u && u < d.u + d.w && v < d.h) return doorTok(u - d.u, v, d);
    for (const w of wins) if (u >= w.u && u < w.u + w.w && v >= w.v && v < w.v + w.h) { const t = winTok(u - w.u, v - w.v, w); if (t !== -2) return t; }
    for (const b of bands) if (v >= b.v0 && v < b.v1) { const t = b.fn ? b.fn(u, v) : M[b.mat] + (b.lv ?? 1); if (t >= 0) return t; }
    return tex(u, v);
  };
}
// Evenly spaced windows: cols across a wall of `len` px, rows of floors.
function winGrid(len, cols, w, h, v0, o = {}) {
  const out = [], gap = (len - cols * w) / (cols + 1), seed = o.seed || 0;
  for (let r = 0; r < (o.rows || 1); r++) for (let c = 0; c < cols; c++) {
    if (o.skip && o.skip.includes(c + r * 100)) continue;
    out.push({ u: Math.round(gap + c * (w + gap)), v: v0 + r * (o.pitch || 24), w, h, k: o.k || 'sash', lit: hash(c * 13 + r * 7 + seed, 5) < (o.lit ?? 0.55) });
  }
  return out;
}

// ---- Roofs: shingle rows follow the ridge direction in screen space ----
function shingleP(mat, dir, rowH = 4) {
  const m = M[mat];
  return (x, y) => {
    const s = dir === 'x' ? y - x * 0.5 : y + x * 0.5, t = dir === 'x' ? y + x * 0.5 : y - x * 0.5, row = Math.floor(s / rowH), r = s - row * rowH;
    const tj = t + (row & 1) * 6, jr = ((tj % 12) + 12) % 12, h = hash(Math.floor(tj / 12), row);
    return m + clampLv(2 + (r < 1 ? -1 : 0) + (jr < 1 ? -1 : 0) + (h < 0.14 ? -1 : h > 0.9 ? 1 : 0), 4);
  };
}
function seamP(mat, dir) { const m = M[mat]; return (x, y) => { const t = dir === 'x' ? y + x * 0.5 : y - x * 0.5, k = ((Math.floor(t) % 7) + 7) % 7; return m + (k === 0 ? 3 : k === 1 ? 0 : k < 4 ? 2 : 1); }; }
function gravelRoofP(mat) { const m = M[mat]; return (x, y) => { const h = hash(x, y); return m + clampLv(2 + (h < 0.1 ? -1 : h > 0.93 ? 1 : 0), 4); }; }
const slope = (pts, face, paint) => poly(pts, (x, y) => pix(paint(x, y), face));
// Gable roof. dir 'x': ridge runs along x; dir 'y': ridge along y. `end` paints the gable wall.
function gable(x0, y0, x1, y1, z, rh, dir, paint, end) {
  if (dir === 'x') {
    const ym = (y0 + y1) / 2;
    if (end) wallRPoly([P(x1, y0, z), P(x1, y1, z), P(x1, ym, z + rh)], x1, y1, z, end, 2);
    slope([P(x0, y0, z), P(x1, y0, z), P(x1, ym, z + rh), P(x0, ym, z + rh)], 5, paint);
    slope([P(x0, ym, z + rh), P(x1, ym, z + rh), P(x1, y1, z), P(x0, y1, z)], 3, paint);
  } else {
    const xm = (x0 + x1) / 2;
    if (end) wallLPoly([P(x0, y1, z), P(x1, y1, z), P(xm, y1, z + rh)], y1, x0, z, end, 1);
    slope([P(x0, y0, z), P(x0, y1, z), P(xm, y1, z + rh), P(xm, y0, z + rh)], 6, paint);
    slope([P(xm, y0, z + rh), P(xm, y1, z + rh), P(x1, y1, z), P(x1, y0, z)], 4, paint);
  }
}
// Flat roof with parapet and a couple of rooftop units.
function flatRoof(x0, y0, x1, y1, z, mat, par, trim) {
  poly([P(x0, y0, z), P(x1, y0, z), P(x1, y1, z), P(x0, y1, z)], (x, y) => pix(gravelRoofP(mat)(x, y), 0));
  const t = 0.06, w = facade({ kind: 'cmu', mat: trim || 'cmu' }), top = (x, y) => M[trim || 'cmu'] + 3;
  box(x0, y0, x1, y0 + t, z, par, { L: w, R: w, top }); box(x0, y0, x0 + t, y1, z, par, { L: w, R: w, top });
  box(x0, y1 - t, x1, y1, z, par, { L: w, R: w, top }); box(x1 - t, y0, x1, y1, z, par, { L: w, R: w, top });
}
const rooftopUnit = (x, y, w, d, h = 7) => { const f = facade({ kind: 'tin', mat: 'tin' }); box(x, y, x + w, y + d, 0, h, { L: f, R: f, top: flat(M.steel + 2) }); };

// ---- Cylinders and domes ----
function cylinder(cx, cy, r, z0, z1, painter) {
  const [sx, sy] = P(cx, cy), rx = r * HW * 1.414, ry = r * HH * 1.414;
  for (let x = Math.ceil(sx - rx); x <= Math.floor(sx + rx); x++) {
    const t = (x + 0.5 - sx) / rx, e = ry * Math.sqrt(Math.max(0, 1 - t * t)), face = t < -0.1 ? 1 : t > 0.1 ? 2 : (bay(x, 0) < 0.5 ? 1 : 2);
    for (let y = Math.ceil(sy - z1 + e - 0.5); y <= Math.floor(sy - z0 + e - 0.5); y++) { const c = painter(t, sy + e - y - z0, x, y); if (c >= 0) put(x, y, pix(c, face)); }
  }
  for (let y = Math.ceil(sy - z1 - ry); y <= Math.floor(sy - z1 + ry); y++) {
    const h = rx * Math.sqrt(Math.max(0, 1 - ((y + 0.5 - (sy - z1)) / ry) ** 2));
    for (let x = Math.ceil(sx - h); x <= Math.floor(sx + h); x++) { const c = painter(0, z1 - z0, x, y); if (c >= 0) put(x, y, pix(c, 0)); }
  }
}
function dome(cx, cy, z, rr, mat) {
  const [sx, sy] = P(cx, cy, z), m = M[mat];
  for (let y = -rr; y <= rr; y++) for (let x = -rr; x <= rr; x++) {
    const d = (x * x + y * y) / (rr * rr); if (d > 1) continue;
    const nx = x / rr, ny = y / rr, face = ny < -0.3 ? 0 : nx < 0.1 ? 1 : 2, lv = clampLv(1 + (d < 0.55 ? 1 : 0) + (bay(x + sx, y + sy) < 0.3 ? 1 : 0) - (d > 0.85 ? 1 : 0), 4);
    put(sx + x, sy + y, pix(m + lv, face));
  }
}
function pole(gx, gy, z0, z1, tok, w = 1) { const [x, y] = P(gx, gy); for (let z = z0; z <= z1; z++) for (let k = 0; k < w; k++) put(x + k, y - z, tok); }

// ---- Trees ----
function treeDensity() { const s = seasonNow(); return s === 'winter' ? 0.36 : s === 'latefall' ? 0.74 : 1; }
function tree(gx, gy, o = {}) {
  const [sx, sy] = P(gx, gy), r = o.r || 19, th = o.th || 24, mats = o.mats || ['leafA', 'leafB', 'leafC'], sd = hash(Math.round(gx * 37), Math.round(gy * 41)), m = M[mats[Math.floor(sd * mats.length)]];
  for (let z = 0; z < th + 4; z++) for (let k = -1; k <= 1; k++) put(sx + k, sy - z, pix(M.trunk + (k < 0 ? 2 : k === 0 ? 1 : 0), k < 0 ? 1 : 2));
  const dens = treeDensity(), blobs = [[-0.5, 0.0, 0.78], [0.5, -0.12, 0.74], [0, -0.7, 0.82], [-0.25, -0.35, 0.7], [0.3, -0.5, 0.62]];
  blobs.forEach(([ox, oy, k], bi) => {
    const cx = sx + ox * r, cy = sy - th - r * 0.45 + oy * r, rx = r * k, ry = r * k * 0.9;
    for (let y = Math.ceil(cy - ry); y <= Math.floor(cy + ry); y++) for (let x = Math.ceil(cx - rx); x <= Math.floor(cx + rx); x++) {
      const nx = (x - cx) / rx, ny = (y - cy) / ry, d = nx * nx + ny * ny; if (d > 1) continue;
      if (dens < 1 && hash(x, y + bi * 3) > dens && d < 0.92) continue;
      const face = ny < -0.2 ? 0 : nx < 0.08 ? 1 : 2, clump = hash(Math.floor(x / 3) + bi, Math.floor(y / 3));
      put(x, y, pix(m + clampLv(1 + (clump > 0.55 ? 1 : 0) + (ny < -0.45 ? 1 : 0) - (ny > 0.5 ? 1 : 0) - (d > 0.8 ? 1 : 0), 4), face));
    }
  });
  casterTree(gx, gy, r / 36, th + r * 1.2, th * 0.9 + r * 0.5);
}
function pineTree(gx, gy, h = 56) {
  const [sx, sy] = P(gx, gy); for (let z = 0; z < 6; z++) put(sx, sy - z, pix(M.trunk + 1, 2));
  const tiers = 4;
  for (let k = 0; k < tiers; k++) {
    const apex = sy - h + k * (h * 0.19), base = apex + h * 0.36, w = 6 + k * 2.6;
    for (let y = Math.ceil(apex); y <= base; y++) {
      const half = (w * (y - apex)) / (base - apex);
      for (let x = Math.round(sx - half); x <= Math.round(sx + half); x++) {
        const t = half ? (x - sx) / half : 0, face = t < -0.1 ? 1 : t > 0.1 ? 2 : 0, edge = Math.abs(t) > 0.88 || y > base - 1;
        put(x, y, pix(M.pine + clampLv(1 + (t < 0 ? 1 : 0) + (hash(x, y) > 0.82 ? 1 : 0) - (edge ? 1 : 0) - (y - apex > (base - apex) * 0.75 ? 1 : 0), 4), face));
      }
    }
  }
  casterTree(gx, gy, 0.22, h, h * 0.55);
}
function shrub(gx, gy, r = 8, mat = 'shrub') {
  const [sx, sy] = P(gx, gy); const m = M[mat], cy = sy - r * 0.6, dens = treeDensity() > 0.5 ? 1 : 0.6;
  for (let y = -r; y <= r * 0.7; y++) for (let x = -r; x <= r; x++) {
    const nx = x / r, ny = y / (r * 0.85), d = nx * nx + ny * ny; if (d > 1 || (dens < 1 && hash(x + sx, y + sy) > dens && d < 0.9)) continue;
    put(sx + x, cy + y, pix(m + clampLv(1 + (ny < -0.3 ? 1 : 0) + (hash(sx + x, cy + y) > 0.85 ? 1 : 0) - (d > 0.78 ? 1 : 0), 4), ny < -0.2 ? 0 : nx < 0.05 ? 1 : 2));
  }
}
