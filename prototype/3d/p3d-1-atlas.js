
// ============ 3D: texture atlas and static geometry ============
// World units are tiles. three.js axes: X = grid x (south), Z = grid y (west), Y = up.
// Heights keep the 2D art's pixels and convert with ZPX, so one set of numbers draws both versions.
// With a 30 degree orthographic camera and PXU pixels per tile, one texel lands on one screen pixel.
const ZPX = 39.19, PXU = 45.25, T3 = 32, ATLAS = 1024;
const V = (gx, gy, gz = 0) => [gx, gz / ZPX, gy];
const DOORS = [], COLLIDE = [], ROUND = [], POLES3 = [], TREES3 = [];
let TOKRGB = [], TOKEMI = [], FALLBACK = 0;
const tokOf = (idx) => { const e = META[idx]; return e ? e.m * 8 + e.lv : 0; };
function cacheTokens() {
  TOKRGB = []; TOKEMI = []; FALLBACK = M.cmu + 1;
  MAT.forEach((m, mi) => { for (let lv = 0; lv < 8; lv++) { const l = Math.min(lv, m.rgb.length - 1); TOKRGB[mi * 8 + lv] = m.rgb[l]; TOKEMI[mi * 8 + lv] = m.emit ? m.emit(l, { night: 1 }, 0) : null; } });
}

// ---- Shelf-packed atlas pages, one texel of border per rect so nearest sampling never bleeds ----
const PAGES = []; let PAGE = null;
function newPage() { PAGE = { col: new Uint8ClampedArray(ATLAS * ATLAS * 4), emi: new Uint8ClampedArray(ATLAS * ATLAS * 4), x: 0, y: 0, rowH: 0, pos: [], nor: [], uv: [] }; PAGES.push(PAGE); return PAGE; }
function alloc(w, h) {
  w = Math.min(w, ATLAS - 2); h = Math.min(h, ATLAS - 2);
  if (!PAGE) newPage();
  if (PAGE.x + w + 2 > ATLAS) { PAGE.x = 0; PAGE.y += PAGE.rowH; PAGE.rowH = 0; }
  if (PAGE.y + h + 2 > ATLAS) newPage();
  const r = { p: PAGE, x: PAGE.x + 1, y: PAGE.y + 1, w, h };
  PAGE.x += w + 2; PAGE.rowH = Math.max(PAGE.rowH, h + 2); return r;
}
// fn(u, v) returns a material token; v = 0 is the bottom row.
function paint(r, fn) {
  const { p, x, y, w, h } = r, C = p.col, E = p.emi;
  for (let row = -1; row <= h; row++) for (let col = -1; col <= w; col++) {
    const u = col < 0 ? 0 : col >= w ? w - 1 : col, v = h - 1 - (row < 0 ? 0 : row >= h ? h - 1 : row);
    let t = fn(u, v); if (!(t >= 0) || !TOKRGB[t]) t = FALLBACK;
    const i = ((y + row) * ATLAS + x + col) * 4, c = TOKRGB[t], e = TOKEMI[t];
    C[i] = c[0]; C[i + 1] = c[1]; C[i + 2] = c[2]; C[i + 3] = 255;
    if (e) { E[i] = e[0]; E[i + 1] = e[1]; E[i + 2] = e[2]; } E[i + 3] = 255;
  }
}
const SOLID = new Map();
function solid3(t) { let r = SOLID.get(t); if (!r) { r = alloc(2, 2); paint(r, () => t); SOLID.set(t, r); } return r; }

// ---- Geometry emitters (flat normals, counter-clockwise seen from outside) ----
function tri3(r, a, b, c, ta, tb, tc) {
  const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
  let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz); if (l < 1e-9) return;
  nx /= l; ny /= l; nz /= l; const p = r.p;
  for (const [q, s] of [[a, ta], [b, tb], [c, tc]]) { p.pos.push(q[0], q[1], q[2]); p.nor.push(nx, ny, nz); p.uv.push((r.x + s[0] * r.w) / ATLAS, (r.y + (1 - s[1]) * r.h) / ATLAS); }
}
// a, b: bottom edge left to right; c, d: top edge right to left (as seen from outside)
function quad3(r, a, b, c, d) { tri3(r, a, b, c, [0, 0], [1, 0], [1, 1]); tri3(r, a, c, d, [0, 0], [1, 1], [0, 1]); }

// A wall from (ax, ay) to (bx, by), left to right seen from outside, z0..z1 in 2D pixels.
// The painter sees the same u (pixels along) and v (pixels up from vBase) as the 2D version.
function wall3(ax, ay, bx, by, z0, z1, fn, vBase = z0) {
  const len = Math.hypot(bx - ax, by - ay), w = Math.max(1, Math.round(len * T3)), h = Math.max(1, Math.round(z1 - z0)), off = Math.round(z0 - vBase), r = alloc(w, h);
  paint(r, (u, v) => fn(u, v + off));
  quad3(r, V(ax, ay, z0), V(bx, by, z0), V(bx, by, z1), V(ax, ay, z1));
}
// Convex polygon on a wall plane. pts are [s tiles along A to B, z pixels], counter-clockwise.
function wallPoly3(ax, ay, bx, by, pts, fn, vBase = 0) {
  const len = Math.hypot(bx - ax, by - ay) || 1, dx = (bx - ax) / len, dy = (by - ay) / len;
  const ss = pts.map((q) => q[0]), zs = pts.map((q) => q[1]), s0 = Math.min(...ss), s1 = Math.max(...ss), z0 = Math.min(...zs), z1 = Math.max(...zs);
  const w = Math.max(1, Math.round((s1 - s0) * T3)), h = Math.max(1, Math.round(z1 - z0)), r = alloc(w, h), u0 = Math.round(s0 * T3), off = Math.round(z0 - vBase);
  paint(r, (u, v) => fn(u + u0, v + off));
  const at = ([s, z]) => V(ax + dx * s, ay + dy * s, z), st = ([s, z]) => [(s - s0) / (s1 - s0 || 1), (z - z0) / (z1 - z0 || 1)];
  for (let i = 1; i + 1 < pts.length; i++) tri3(r, at(pts[0]), at(pts[i]), at(pts[i + 1]), st(pts[0]), st(pts[i]), st(pts[i + 1]));
}
function top3(x0, y0, x1, y1, z, fn) { const r = alloc(Math.max(1, Math.round((x1 - x0) * T3)), Math.max(1, Math.round((y1 - y0) * T3))); paint(r, fn); quad3(r, V(x0, y1, z), V(x1, y1, z), V(x1, y0, z), V(x0, y0, z)); }
// Box with painters per face: f front (+y), r right (+x), b back (-y), l left (-x), t top.
function box3(x0, y0, x1, y1, z0, h, o) {
  const z1 = z0 + h, fr = o.f, rt = o.r || fr, bk = o.b || fr, lf = o.l || rt;
  wall3(x0, y1, x1, y1, z0, z1, fr); wall3(x1, y1, x1, y0, z0, z1, rt); wall3(x1, y0, x0, y0, z0, z1, bk); wall3(x0, y0, x0, y1, z0, z1, lf);
  if (o.t !== false) top3(x0, y0, x1, y1, z1, o.t || (() => FALLBACK));
}
function sbox3(x0, y0, x1, y1, z0, h, t) {
  const r = solid3(t), z1 = z0 + h, q = (a, b, c, d) => quad3(r, a, b, c, d);
  q(V(x0, y1, z0), V(x1, y1, z0), V(x1, y1, z1), V(x0, y1, z1)); q(V(x1, y1, z0), V(x1, y0, z0), V(x1, y0, z1), V(x1, y1, z1));
  q(V(x1, y0, z0), V(x0, y0, z0), V(x0, y0, z1), V(x1, y0, z1)); q(V(x0, y0, z0), V(x0, y1, z0), V(x0, y1, z1), V(x0, y0, z1));
  q(V(x0, y1, z1), V(x1, y1, z1), V(x1, y0, z1), V(x0, y0, z1));
}
const post3 = (gx, gy, half, z0, h, t) => sbox3(gx - half, gy - half, gx + half, gy + half, z0, h, t);
// Planar quad (roof slope); sizes in tiles set the texel density.
function slope3(a, b, c, d, fn, wT, hT) { const r = alloc(Math.max(1, Math.round(wT * T3)), Math.max(1, Math.round(hT * T3))); paint(r, fn); quad3(r, a, b, c, d); }
function gable3(x0, y0, x1, y1, z, rh, dir, roof, end, oh = 0) {
  const zr = z + rh;
  if (dir === 'x') {
    const ym = (y0 + y1) / 2, run = (y1 - y0) / 2, ez = z - rh * (oh / run), sl = Math.hypot(run + oh, (zr - ez) / ZPX), L = x1 - x0 + 2 * oh;
    slope3(V(x1 + oh, y0 - oh, ez), V(x0 - oh, y0 - oh, ez), V(x0 - oh, ym, zr), V(x1 + oh, ym, zr), roof, L, sl);
    slope3(V(x0 - oh, y1 + oh, ez), V(x1 + oh, y1 + oh, ez), V(x1 + oh, ym, zr), V(x0 - oh, ym, zr), roof, L, sl);
    if (end) { const pts = [[0, z], [y1 - y0, z], [run, zr]]; wallPoly3(x0, y0, x0, y1, pts, end, z); wallPoly3(x1, y1, x1, y0, pts, end, z); }
  } else {
    const xm = (x0 + x1) / 2, run = (x1 - x0) / 2, ez = z - rh * (oh / run), sl = Math.hypot(run + oh, (zr - ez) / ZPX), L = y1 - y0 + 2 * oh;
    slope3(V(x1 + oh, y1 + oh, ez), V(x1 + oh, y0 - oh, ez), V(xm, y0 - oh, zr), V(xm, y1 + oh, zr), roof, L, sl);
    slope3(V(x0 - oh, y0 - oh, ez), V(x0 - oh, y1 + oh, ez), V(xm, y1 + oh, zr), V(xm, y0 - oh, zr), roof, L, sl);
    if (end) { const pts = [[0, z], [x1 - x0, z], [run, zr]]; wallPoly3(x0, y1, x1, y1, pts, end, z); wallPoly3(x1, y0, x0, y0, pts, end, z); }
  }
}
// Roof painters in roof space: u runs along the ridge, v up the slope from the eave.
const shingle3 = (mat) => { const m = M[mat]; return (u, v) => { const row = Math.floor(v / 4), r = v - row * 4, tj = u + (row & 1) * 6, jr = ((tj % 12) + 12) % 12, h = hash(Math.floor(tj / 12), row + 50); return m + clampLv(2 + (r === 3 ? -1 : 0) + (jr < 1 ? -1 : 0) + (h < 0.14 ? -1 : h > 0.9 ? 1 : 0), 4); }; };
const seam3 = (mat) => { const m = M[mat]; return (u) => { const k = ((u % 7) + 7) % 7; return m + (k === 0 ? 3 : k === 1 ? 0 : k < 4 ? 2 : 1); }; };
const gravel3 = (mat) => { const m = M[mat]; return (u, v) => { const h = hash(u + 900, v); return m + clampLv(2 + (h < 0.1 ? -1 : h > 0.93 ? 1 : 0), 4); }; };
const corr3 = (u) => M.tin + [3, 2, 1, 0][u & 3];
function flatRoof3(x0, y0, x1, y1, z, mat, par, trim) {
  top3(x0, y0, x1, y1, z, gravel3(mat));
  const t = 0.06, w = facade({ kind: 'cmu', mat: trim || 'cmu' }), cap = () => M[trim || 'cmu'] + 3, pb = (a, b, c, d) => box3(a, b, c, d, z, par, { f: w, t: cap });
  pb(x0, y0, x1, y0 + t); pb(x0, y0, x0 + t, y1); pb(x0, y1 - t, x1, y1); pb(x1 - t, y0, x1, y1);
}
// Cylinder side (+ optional cap). fn(u, v) wraps around; the 2D painters ignore the u part.
function cyl3(cx, cy, r, z0, z1, fn, segs = 12, capTok = -1) {
  const w = Math.max(2, Math.round(2 * Math.PI * r * T3)), h = Math.max(1, Math.round(z1 - z0)), rr = alloc(w, h); paint(rr, fn);
  const pt = (i, z) => { const a = (i / segs) * Math.PI * 2; return V(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z); };
  for (let i = 0; i < segs; i++) { const s0 = (segs - i - 1) / segs, s1 = (segs - i) / segs; tri3(rr, pt(i + 1, z0), pt(i, z0), pt(i, z1), [s0, 0], [s1, 0], [s1, 1]); tri3(rr, pt(i + 1, z0), pt(i, z1), pt(i + 1, z1), [s0, 0], [s1, 1], [s0, 1]); }
  if (capTok >= 0) { const c = solid3(capTok), ctr = V(cx, cy, z1); for (let i = 0; i < segs; i++) tri3(c, ctr, pt(i + 1, z1), pt(i, z1), [0.5, 0.5], [0, 0], [1, 0]); }
}
function cone3(cx, cy, r, z0, z1, fn, segs = 12, rot = 0) {
  const w = Math.max(2, Math.round(2 * Math.PI * r * T3)), h = Math.max(1, Math.round(z1 - z0)), rr = alloc(w, h); paint(rr, fn);
  const pt = (i) => { const a = rot + (i / segs) * Math.PI * 2; return V(cx + Math.cos(a) * r, cy + Math.sin(a) * r, z0); }, apex = V(cx, cy, z1);
  for (let i = 0; i < segs; i++) tri3(rr, pt(i + 1), pt(i), apex, [(segs - i - 1) / segs, 0], [(segs - i) / segs, 0], [(segs - i - 0.5) / segs, 1]);
}
function sphere3(cx, cy, cz, r, t, segs = 12, rings = 8) {
  const c = solid3(t), at = (i, j) => { const a = (i / segs) * Math.PI * 2, b = -Math.PI / 2 + (j / rings) * Math.PI; return [cx + Math.cos(a) * Math.cos(b) * r, cz / ZPX + Math.sin(b) * r, cy + Math.sin(a) * Math.cos(b) * r]; };
  for (let j = 0; j < rings; j++) for (let i = 0; i < segs; i++) quad3(c, at(i + 1, j), at(i, j), at(i, j + 1), at(i + 1, j + 1));
}
const collide = (x0, y0, x1, y1) => COLLIDE.push([x0, y0, x1, y1]);
const roundCollide = (x, y, r) => ROUND.push([x, y, r]);
const door = (id, x, y, reach = 0.9) => { if (id) DOORS.push({ id, x, y, reach }); };
