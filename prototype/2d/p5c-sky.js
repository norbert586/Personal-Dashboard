
// ============ Sky and post effects ============
function lightFrame() { LF = { top: LS.F[0], l: LS.F[1], r: LS.F[2] }; }
let FDT = 0.016;
// ---- Clouds live in the world (not on the screen), so panning carries them with the map ----
const CLOUDS = [], JETS = [], FLAKES = [], BOKEH = []; let jetT = 8;
function cloudSprite(w, h, seed) { // cumulus: puffy top, flat base
  const m = new Uint8Array(w * h), blobs = [], n = 5 + Math.floor(hash(seed, 1) * 3), base = h * 0.82;
  for (let i = 0; i < n; i++) { const t = (i + 0.5 + (hash(seed, i) - 0.5) * 0.5) / n, f = Math.pow(Math.sin(Math.PI * Math.min(0.98, Math.max(0.02, t))), 0.9), r = h * 0.5 * (0.28 + 0.72 * f) * (0.7 + 0.5 * hash(seed, i + 9)); blobs.push([w * (0.08 + 0.84 * t), base - r * 0.75, r * 1.2, r]); }
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let best = 9, top = 0; for (const [cx, cy, rx, ry] of blobs) { const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2; if (d < best) { best = d; top = (y - (cy - ry)) / (2 * ry); } }
    if (y > base || best >= 1 - bay(x, y) * 0.2) continue;
    m[y * w + x] = top < 0.3 && bay(x, y) < 0.85 ? 3 : y > base - h * 0.14 ? 1 : 2;
  }
  return { w, h, m, blobs };
}
function setupSky() {
  CLOUDS.length = 0; const wx = weatherNow(), n = { clear: 3, cloud: 7, rain: 9, snow: 9 }[wx] ?? 3;
  for (let i = 0; i < n; i++) CLOUDS.push({ x: -10 + hash(i, 4) * 50, y: -14 + hash(i, 5) * 50, alt: 360 + hash(i, 6) * 120, v: 0.5 + hash(i, 7) * 0.5, spr: cloudSprite(110 + Math.floor(hash(i, 8) * 70), 56 + Math.floor(hash(i, 9) * 26), i * 5 + 1) });
}
function updateSky(dt) {
  for (const c of CLOUDS) { c.x += 0.11 * c.v * dt; c.y -= 0.085 * c.v * dt; if (c.x > 48) { c.x = -14; c.y = -14 + Math.random() * 50; } }
  jetT -= dt; if (jetT < 0 && JETS.length < 2) { JETS.push({ x: -16, y: 2 + Math.random() * 24, alt: 560 + Math.random() * 100, v: 1.8 + Math.random() * 0.8, trail: [], acc: 0 }); jetT = 28 + Math.random() * 30; }
  for (const j of JETS) { j.x += j.v * dt; j.y -= j.v * 0.5 * dt; j.acc += dt; if (j.acc > 0.18) { j.acc = 0; j.trail.push([j.x, j.y]); if (j.trail.length > 70) j.trail.shift(); } }
  for (let i = JETS.length - 1; i >= 0; i--) if (JETS[i].x > 56) JETS.splice(i, 1);
}
const parX = () => (panX - 32) * 0.1, parY = () => (panY - 40) * 0.1;
function cloudScreen(c, dx = 0, dy = 0, sx = 1, sy = 1) { const [px, py] = P(c.x + dx, c.y + dy, c.alt); return [Math.round(px + camX + parX() - (c.spr.w * sx) / 2), Math.round(py + camY + parY() - (c.spr.h * sy) / 2)]; }
function drawSky(t) {
  const overcast = weatherNow() !== 'clear', up = LS.s.el > 3 && LS.I > 0.02;
  // cloud shadows sweep across the ground
  if (S.detail !== 'off' && up) {
    const az = (LS.s.az * Math.PI) / 180, off = Math.min(6, (300 / 36 / Math.tan((Math.max(LS.s.el, 8) * Math.PI) / 180)) * 0.4);
    for (const c of CLOUDS) {
      const gx = c.x + Math.cos(az) * off, gy = c.y + Math.sin(az) * off, [sx, sy] = P(gx, gy), cx = Math.round(sx + camX), cy = Math.round(sy + camY), w = c.spr.w, h = Math.round(c.spr.h * 0.7);
      if (cx + w < 0 || cx - w > VW || cy + h < 0 || cy - h > VH) continue;
      for (let y = Math.max(0, cy - h); y < Math.min(VH, cy + h); y++) for (let x = Math.max(0, cx - w); x < Math.min(VW, cx + w); x++) {
        let d = 9; for (const [bx, by, rx, ry] of c.spr.blobs) { const e = ((x - cx - (bx - w / 2) * 1.05) / (rx * 1.1)) ** 2 + ((y - cy - (by - c.spr.h / 2) * 0.55) / (ry * 0.55)) ** 2; if (e < d) d = e; }
        if (d < 1 - bay(x, y) * 0.5) { const i = y * VW + x, p = out32[i]; out32[i] = pack((p & 255) * 0.84, ((p >> 8) & 255) * 0.87, ((p >> 16) & 255) * 0.93); }
      }
    }
  }
  // visible clouds
  if (S.detail !== 'off') for (const c of CLOUDS) {
    const [sx, sy] = cloudScreen(c), { w, h, m } = c.spr, F = LS.F[0], k = overcast ? 0.9 : 0.78;
    if (sx + w < 0 || sx > VW || sy + h < 0 || sy > VH) continue;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const lv = m[y * w + x]; if (!lv) continue; const base = lv === 1 ? [176, 190, 212] : lv === 2 ? [232, 238, 246] : [255, 255, 255]; blend(sx + x, sy + y, Math.min(255, base[0] * F[0] * 1.05), Math.min(255, base[1] * F[1] * 1.05), Math.min(255, base[2] * F[2] * 1.05), (lv === 3 ? 0.62 : lv === 2 ? 0.52 : 0.46) * k); }
  }
  // jets and contrails, high above everything
  for (const j of JETS) {
    j.trail.forEach(([x, y], i) => { const [px, py] = P(x, y, j.alt), a = (i / j.trail.length) * 0.5; for (let dy = 0; dy < 2; dy++) blend(Math.round(px + camX + parX()), Math.round(py + camY + parY()) + dy, 238, 242, 248, a); });
    const [px, py] = P(j.x, j.y, j.alt), x = Math.round(px + camX + parX()), y = Math.round(py + camY + parY()), c = pack(...[236, 238, 240].map((v, i) => v * LS.F[0][i]));
    for (let k = -3; k <= 3; k++) spx(x + k, y, c, 9999); spx(x, y - 1, c, 9999); spx(x + 1, y + 1, c, 9999); spx(x - 1, y - 1, c, 9999); if (LS.night > 0.4 && Math.floor(t * 2) % 2) spx(x + 4, y, pack(255, 60, 50), 9999);
  }
  // rain and snow
  const wx = weatherNow(), want = S.detail === 'off' || (wx !== 'rain' && wx !== 'snow') ? 0 : Math.floor((VW * VH) / (S.detail === 'full' ? 2600 : 7000));
  while (FLAKES.length < want) FLAKES.push({ x: Math.random() * VW, y: Math.random() * VH, s: 0.6 + Math.random() * 0.8 }); FLAKES.length = Math.min(FLAKES.length, want);
  if (!paused) for (const f of FLAKES) { if (wx === 'snow') { f.y += 16 * f.s * FDT; f.x += Math.sin((f.y + f.s * 50) / 14) * 7 * FDT + 4 * FDT; } else { f.y += 150 * f.s * FDT; f.x -= 24 * FDT; } if (f.y > VH) { f.y = -4; f.x = Math.random() * VW; } if (f.x < -4) f.x = VW; if (f.x > VW + 4) f.x = 0; }
  for (const f of FLAKES) { const x = Math.round(f.x), y = Math.round(f.y); if (wx === 'snow') { blend(x, y, 248, 250, 255, 0.9); if (f.s > 1.1) { blend(x + 1, y, 248, 250, 255, 0.5); blend(x, y + 1, 248, 250, 255, 0.5); } } else for (let k = 0; k < 3; k++) blend(x - (k >> 1), y + k, 190, 205, 230, 0.7 - k * 0.15); }
}
// ---- Post effects, at screen resolution ----
const GLOWS = {};
function glowSprite(c) { const k = c.join(','); if (GLOWS[k]) return GLOWS[k]; const s = 64, el = document.createElement('canvas'); el.width = el.height = s; const g = el.getContext('2d'), gr = g.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2); gr.addColorStop(0, `rgba(${c[0]},${c[1]},${c[2]},1)`); gr.addColorStop(0.3, `rgba(${c[0]},${c[1]},${c[2]},0.38)`); gr.addColorStop(1, `rgba(${c[0]},${c[1]},${c[2]},0)`); g.fillStyle = gr; g.fillRect(0, 0, s, s); return (GLOWS[k] = el); }
function drawGlows() {
  const k = smooth(0.3, 0.9, LS.night); if (k <= 0.02 || S.detail === 'off') return;
  sctx.globalCompositeOperation = 'lighter';
  const one = (L, dx = 0, dy = 0) => { const [x, y] = S2(L.x + dx, L.y + dy, L.z); if (x < -90 || y < -90 || x > VW + 90 || y > VH + 90) return; const r = L.r * SCd; sctx.globalAlpha = Math.min(1, L.a * k); sctx.drawImage(glowSprite(L.c), x * SCd - r, y * SCd - r * 0.85, r * 2, r * 1.7); };
  for (const L of LIGHTS) one(L); for (const L of DLIGHTS) one(L, L.ox, L.oy);
  sctx.globalAlpha = 1; sctx.globalCompositeOperation = 'source-over';
}
let blurSmall = null, blurFull = null, vig = null, vigKey = '';
function depthBlur() {
  const W = cv.width, H = cv.height, sw = Math.max(64, Math.round(W / 6)), sh = Math.max(36, Math.round(H / 6));
  if (!blurSmall) { blurSmall = document.createElement('canvas'); blurFull = document.createElement('canvas'); }
  if (blurSmall.width !== sw || blurSmall.height !== sh) { blurSmall.width = sw; blurSmall.height = sh; }
  if (blurFull.width !== W || blurFull.height !== H) { blurFull.width = W; blurFull.height = H; }
  const a = blurSmall.getContext('2d'), b = blurFull.getContext('2d'); a.imageSmoothingEnabled = true; a.drawImage(cv, 0, 0, sw, sh);
  b.globalCompositeOperation = 'source-over'; b.clearRect(0, 0, W, H); b.imageSmoothingEnabled = true; b.drawImage(blurSmall, 0, 0, W, H);
  b.globalCompositeOperation = 'destination-in'; const g = b.createLinearGradient(0, 0, 0, H); g.addColorStop(0, 'rgba(0,0,0,0.85)'); g.addColorStop(0.15, 'rgba(0,0,0,0)'); g.addColorStop(0.8, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,0.9)'); b.fillStyle = g; b.fillRect(0, 0, W, H);
  sctx.drawImage(blurFull, 0, 0);
}
function postFX(t) {
  const W = cv.width, H = cv.height; sctx.imageSmoothingEnabled = false; sctx.globalCompositeOperation = 'source-over'; sctx.globalAlpha = 1; sctx.drawImage(low, 0, 0, W, H);
  const full = S.detail === 'full';
  if (full) drawGlows();
  // golden hour grade
  const g = Math.max(0, Math.min(1, (14 - LS.s.el) / 12)) * smooth(-2, 4, LS.s.el) * (LS.wx === 'clear' ? 1 : 0.4);
  if (full && g > 0.04) { sctx.globalCompositeOperation = 'overlay'; sctx.fillStyle = `rgba(255,150,70,${0.26 * g})`; sctx.fillRect(0, 0, W, H); sctx.globalCompositeOperation = 'source-over'; }
  if (full && S.dof) depthBlur();
  if (full) { const key = W + 'x' + H; if (vigKey !== key) { vigKey = key; vig = sctx.createRadialGradient(W / 2, H * 0.5, Math.min(W, H) * 0.35, W / 2, H * 0.5, Math.hypot(W, H) * 0.56); vig.addColorStop(0, 'rgba(6,10,24,0)'); vig.addColorStop(1, 'rgba(6,10,24,0.42)'); } sctx.fillStyle = vig; sctx.fillRect(0, 0, W, H); }
  // hover outline and the selection arrow
  if (!paused && hoverId && OUTL[hoverId] && BOX[hoverId]) { const b = BOX[hoverId]; sctx.drawImage(OUTL[hoverId], (b.x0 + camX) * SCd, (b.y0 + camY) * SCd, OUTL[hoverId].width * SCd, OUTL[hoverId].height * SCd); }
  if (marker && performance.now() < marker.until && BOX[marker.id]) { const b = BOX[marker.id], x = Math.round((b.x0 + b.x1) / 2 + camX), y = Math.round(b.y0 + camY - 12 - Math.abs(Math.sin(t * 5)) * 4); sctx.fillStyle = '#f2c14e'; for (let r = 0; r < 5; r++) sctx.fillRect((x - (4 - r)) * SCd, (y + r) * SCd, (2 * (4 - r) + 1) * SCd, SCd); }
  if (paused) { sctx.fillStyle = 'rgba(3,6,16,0.58)'; sctx.fillRect(0, 0, W, H); }
}
