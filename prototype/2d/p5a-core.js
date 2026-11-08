
// ============ Screen, camera, shadows and the frame loop ============
const cv = document.getElementById('world'), sctx = cv.getContext('2d');
const low = document.createElement('canvas'), lctx = low.getContext('2d');
let VW = 0, VH = 0, SC = 1, SCd = 1, DPR = 1, ZOOMD = 0, img = null, out32 = null, camX = 0, camY = 0, panX = 32, panY = 40;
let simT = 0, last = performance.now(), paused = false, dirty = true, shadowKey = '', marker = null, slow = 0;
const FAR = new Uint16Array(64 * 64);
function initFar() { for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) { const h = hash(x, y); FAR[y * 64 + x] = pix(M.pine + clampLv((h < 0.45 ? 0 : 1) + (bay(x, y) < 0.3 ? 1 : 0) + (h > 0.93 ? 1 : 0), 4)); } }

// Scale is chosen in whole device pixels so every art pixel is the same size on screen.
function pickScale() { const target = Math.max(520, Math.min(1150, innerWidth * 0.78)); return Math.max(1, Math.round((innerWidth * DPR) / target)); }
function resize() {
  DPR = window.devicePixelRatio || 1; SCd = ZOOMD || pickScale(); SC = SCd / DPR;
  VW = Math.ceil(innerWidth / SC); VH = Math.ceil(innerHeight / SC);
  low.width = VW; low.height = VH; img = lctx.createImageData(VW, VH); out32 = new Uint32Array(img.data.buffer);
  cv.width = VW * SCd; cv.height = VH * SCd; cv.style.width = VW * SC + 'px'; cv.style.height = VH * SC + 'px';
  compose(); dirty = true;
}
function compose() {
  const extra = innerWidth <= 760 ? 0.3 : 0.08, mx = Math.max(0, (WW - VW) / 2 - 20) + VW * extra, my = Math.max(0, (WH - VH) / 2 - 20) + VH * extra;
  panX = Math.max(-mx, Math.min(mx, panX)); panY = Math.max(-my, Math.min(my, panY));
  camX = Math.floor((VW - WW) / 2 + panX); camY = Math.floor((VH - WH) / 2 + panY + 8);
}
function zoomAt(dir, cx = innerWidth / 2, cy = innerHeight / 2) {
  const next = Math.max(1, Math.min(Math.round(6 * DPR), SCd + dir)); if (next === SCd) return false;
  const wx = cx / SC - camX, wy = cy / SC - camY;
  ZOOMD = next; SCd = next; SC = SCd / DPR; VW = Math.ceil(innerWidth / SC); VH = Math.ceil(innerHeight / SC);
  panX = Math.round(cx / SC - wx - (VW - WW) / 2); panY = Math.round(cy / SC - wy - (VH - WH) / 2 - 8);
  resize(); return true;
}
const S2 = (gx, gy, gz = 0) => { const p = P(gx, gy, gz); return [Math.round(p[0] + camX), Math.round(p[1] + camY)]; };
function hitAt(cx, cy) { const x = Math.floor(cx / SC) - camX, y = Math.floor(cy / SC) - camY; return x >= 0 && y >= 0 && x < WW && y < WH ? HB[y * WW + x] : 0; }

// ---- Sun shadows: rebuilt whenever the sun has moved ----
function rebuildShadows() {
  SH.fill(0); const el = LS.s.el; if (el < 1.2) return;
  const az = (LS.s.az * Math.PI) / 180, tanEl = Math.tan((Math.max(el, 4) * Math.PI) / 180), sx = Math.cos(az), sy = Math.sin(az), mark = (x, y) => { SH[y * WW + x] = 1; };
  for (const c of CASTERS) {
    if (c.tree) {
      const len = Math.min(5, c.ch / 36 / tanEl), cx = c.x + sx * len, cy = c.y + sy * len, oct = [P(c.x, c.y)];
      for (let k = 0; k < 10; k++) { const a = (k / 10) * Math.PI * 2; oct.push(P(cx + Math.cos(a) * c.r, cy + Math.sin(a) * c.r)); }
      scan(hull(oct), mark);
    } else {
      const len = Math.min(6, c.h / 36 / tanEl), dx = sx * len, dy = sy * len;
      scan(hull(c.pts.map(([x, y]) => P(x, y)).concat(c.pts.map(([x, y]) => P(x + dx, y + dy)))), mark);
    }
  }
}

// ---- Compose the world into the low-res frame ----
function paintFrame() {
  const pal = pal32, sh = palSh;
  for (let y = 0; y < VH; y++) {
    const wy = y - camY, o = y * VW;
    if (wy < 0 || wy >= WH) { for (let x = 0; x < VW; x++) out32[o + x] = pal[FAR[((wy & 63) << 6) | ((x - camX) & 63)]]; continue; }
    const wrow = wy * WW;
    for (let x = 0; x < VW; x++) {
      const wx = x - camX;
      if (wx < 0 || wx >= WW) { out32[o + x] = pal[FAR[((wy & 63) << 6) | (wx & 63)]]; continue; }
      const wi = wrow + wx, idx = WB[wi]; out32[o + x] = SH[wi] ? sh[idx] : pal[idx];
    }
  }
}

// ---- Bounding boxes and thumbnails of every clickable building ----
const BOX = {}, ICONS = {}, OUTL = {}, MINI = Object.assign(document.createElement('canvas'), { x0: 60, y0: 120, s: 5 });
function measure() {
  for (const k of Object.keys(BOX)) delete BOX[k];
  for (let i = 0; i < HB.length; i++) { const id = HB[i]; if (!id) continue; const x = i % WW, y = (i / WW) | 0, b = BOX[id] || (BOX[id] = { x0: x, y0: y, x1: x, y1: y }); if (x < b.x0) b.x0 = x; if (x > b.x1) b.x1 = x; if (y < b.y0) b.y0 = y; if (y > b.y1) b.y1 = y; }
  const keep = LS; LS = lighting(new Date(Date.UTC(2026, 5, 21, 17, 0)), 'clear'); buildPalette(0);
  for (const id of Object.keys(BOX)) {
    const b = BOX[id], w = b.x1 - b.x0 + 1, h = b.y1 - b.y0 + 1, c = document.createElement('canvas'); c.width = w; c.height = h;
    const cx = c.getContext('2d'), d = cx.createImageData(w, h), o = new Uint32Array(d.data.buffer);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const i = (b.y0 + y) * WW + (b.x0 + x); if (HB[i] === Number(id)) o[y * w + x] = pal32[WB[i]]; }
    cx.putImageData(d, 0, 0); ICONS[id] = c;
    const oc = document.createElement('canvas'); oc.width = w; oc.height = h; const ox = oc.getContext('2d'), od = ox.createImageData(w, h), oo = new Uint32Array(od.data.buffer), W32 = pack(255, 244, 200);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) { const gi = (b.y0 + y) * WW + (b.x0 + x); if (HB[gi] !== Number(id)) continue; if (HB[gi - 1] !== HB[gi] || HB[gi + 1] !== HB[gi] || HB[gi - WW] !== HB[gi] || HB[gi + WW] !== HB[gi]) oo[y * w + x] = W32; }
    ox.putImageData(od, 0, 0); OUTL[id] = oc;
  }
  const mw = Math.ceil((2140 - MINI.x0) / MINI.s), mh = Math.ceil((1290 - MINI.y0) / MINI.s); MINI.width = mw; MINI.height = mh;
  const mc = MINI.getContext('2d'), md = mc.createImageData(mw, mh), mo = new Uint32Array(md.data.buffer);
  for (let y = 0; y < mh; y++) for (let x = 0; x < mw; x++) mo[y * mw + x] = pal32[WB[(MINI.y0 + y * MINI.s + 2) * WW + MINI.x0 + x * MINI.s + 2]];
  mc.putImageData(md, 0, 0);
  LS = keep; buildPalette(simT);
}
function rebuildWorld() { buildWorld(); shadowKey = ''; LS = lighting(simDate(), weatherNow()); measure(); dirty = true; }

// ---- Frame loop ----
function frame(now) {
  const dt = Math.min(0.1, (now - last) / 1000); const raw = now - last; last = now; FDT = dt;
  if (!paused && !document.hidden) { slow = raw > 36 ? slow + 1 : Math.max(0, slow - 2); if (slow > 100 && S.detail === 'full') { S.detail = 'low'; slow = 0; dirty = true; statusLabel.textContent = 'Detail lowered to keep things smooth. You can change it in Options.'; } }
  if (!document.hidden && (!paused || dirty)) {
    LS = lighting(simDate(), weatherNow());
    if (!paused) { simT += dt * S.speed; if (S.detail !== 'off') { updateActors(dt * S.speed); updateSky(dt * S.speed); } }
    buildPalette(simT);
    const sk = LS.s.el.toFixed(1) + '/' + LS.s.az.toFixed(1) + S.detail; if (sk !== shadowKey) { shadowKey = sk; rebuildShadows(); }
    paintFrame(); drawActors(simT); drawSky(simT); lctx.putImageData(img, 0, 0); postFX(simT);
    dirty = false;
  }
  requestAnimationFrame(frame);
}
