
// ============ 3D scene: renderer, light, ground, trees, glows ============
const cv3 = document.getElementById('world3d');
const renderer = new THREE.WebGLRenderer({ canvas: cv3, antialias: false, powerPreference: 'high-performance' });
renderer.setPixelRatio(1); renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.BasicShadowMap;
const scene = new THREE.Scene();
const camera = new THREE.OrthographicCamera(-8, 8, 5, -5, 0.1, 400);
const hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1); scene.add(hemi);
const sun = new THREE.DirectionalLight(0xffffff, 1); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 16, bottom: -16, near: 1, far: 260 }); sun.shadow.bias = -0.0006; sun.shadow.normalBias = 0.02;
scene.add(sun, sun.target); scene.fog = new THREE.Fog(0x8899aa, 70, 120); scene.background = new THREE.Color(0x8899aa);
const STATIC_MATS = [], GLOW_MATS = [], GLOW_OBJS = [];
const rgbN = (c) => new THREE.Color(c[0] / 255, c[1] / 255, c[2] / 255);
function dataTex(arr, w, h) { const t = new THREE.DataTexture(arr, w, h, THREE.RGBAFormat); t.magFilter = t.minFilter = THREE.NearestFilter; t.generateMipmaps = false; t.flipY = false; t.needsUpdate = true; return t; }
function meshFrom(pos, nor, uv, mat, cast = true) {
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const m = new THREE.Mesh(g, mat); m.castShadow = cast; m.receiveShadow = true; scene.add(m); return m;
}
function buildStatic() {
  for (const p of PAGES) { const m = new THREE.MeshLambertMaterial({ map: dataTex(p.col, ATLAS, ATLAS), emissive: 0xffffff, emissiveMap: dataTex(p.emi, ATLAS, ATLAS), emissiveIntensity: 0 }); meshFrom(p.pos, p.nor, p.uv, m); STATIC_MATS.push(m); }
}
// Ground: re-sample the 2D ground pass (roads, paint, fields) onto the grid plane, 32 texels per tile.
function groundQuad(x0, n, y, tex, cast) {
  const x1 = x0 + n; return meshFrom([x0, y, x1, x1, y, x1, x1, y, x0, x0, y, x1, x1, y, x0, x0, y, x0], [0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], [0, 1, 1, 1, 1, 0, 0, 1, 1, 0, 0, 0], new THREE.MeshLambertMaterial({ map: tex }), cast);
}
function sampleGround(x0, n, per, fromWB) {
  const s = n * per, arr = new Uint8ClampedArray(s * s * 4);
  for (let j = 0; j < s; j++) for (let i = 0; i < s; i++) {
    const gx = x0 + (i + 0.5) / per, gy = x0 + (j + 0.5) / per, sx = Math.round(OX + (gx - gy) * HW), sy = Math.round(OY + (gx + gy) * HH);
    const idx = fromWB && sx >= 0 && sy >= 0 && sx < WW && sy < WH ? WB[sy * WW + sx] : farP(sx, sy), c = TOKRGB[tokOf(idx)] || [40, 60, 40], k = (j * s + i) * 4;
    arr[k] = c[0]; arr[k + 1] = c[1]; arr[k + 2] = c[2]; arr[k + 3] = 255;
  }
  return dataTex(arr, s, s);
}
function buildGround() { groundQuad(-40, 112, -0.01, sampleGround(-40, 112, 6, false), false); groundQuad(-4, 40, 0, sampleGround(-4, 40, 32, true), false); }

// ---- Trees as instanced low-poly blobs (flat shaded, a little colour noise per facet) ----
function facetNoise(geo, seed) { const n = geo.attributes.position.count, c = []; for (let i = 0; i < n; i += 3) { const k = 0.82 + hash(i, seed) * 0.32; for (let j = 0; j < 3; j++) c.push(k, k, k); } geo.setAttribute('color', new THREE.Float32BufferAttribute(c, 3)); return geo; }
function instanced(geo, mat, list, put) {
  if (!list.length) return; const m = new THREE.InstancedMesh(geo, mat, list.length), o = new THREE.Object3D(), col = new THREE.Color();
  list.forEach((it, i) => { put(it, o, col); o.updateMatrix(); m.setMatrixAt(i, o.matrix); m.setColorAt(i, col); });
  m.castShadow = true; m.receiveShadow = true; scene.add(m);
}
function buildTrees() {
  const trunks = [], blobs = [], cones = [], season = seasonNow(), bare = season === 'winter' ? 0.55 : season === 'latefall' ? 0.85 : 1;
  for (const t of TREES3) {
    if (t.kind === 'tree') {
      const sd = hash(Math.round(t.gx * 37), Math.round(t.gy * 41)), mat = t.mats[Math.floor(sd * t.mats.length)], R = (t.r * 0.82) / PXU * bare, base = t.th / ZPX;
      trunks.push({ x: t.gx, y: t.gy, h: base + R * 0.8, w: 0.045 });
      blobs.push({ x: t.gx, y: t.gy, z: base + R * 0.85, r: R, c: MAT[MATIDX[mat]].rgb[2], k: 1 });
      blobs.push({ x: t.gx + R * 0.45, y: t.gy - R * 0.3, z: base + R * 0.55, r: R * 0.72, c: MAT[MATIDX[mat]].rgb[1], k: 0.95 });
      blobs.push({ x: t.gx - R * 0.35, y: t.gy + R * 0.35, z: base + R * 1.25, r: R * 0.68, c: MAT[MATIDX[mat]].rgb[3], k: 1 });
    } else if (t.kind === 'pine') {
      const H = t.h / ZPX; trunks.push({ x: t.gx, y: t.gy, h: H * 0.2, w: 0.04 });
      for (let k = 0; k < 3; k++) cones.push({ x: t.gx, y: t.gy, z: H * (0.18 + k * 0.24), h: H * (0.5 - k * 0.08), r: 0.2 - k * 0.045, c: MAT[MATIDX.pine].rgb[2 - (k === 2 ? 1 : 0)] });
    } else {
      const R = (t.r * 0.9) / PXU; blobs.push({ x: t.gx, y: t.gy, z: R * 0.6, r: R, c: MAT[MATIDX[t.mat]].rgb[2], k: 0.9 });
    }
  }
  instanced(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshLambertMaterial({ color: 0xffffff }), trunks, (it, o, col) => { o.position.set(it.x, it.h / 2, it.y); o.scale.set(it.w, it.h, it.w); col.copy(rgbN(MAT[MATIDX.trunk].rgb[1])); });
  instanced(facetNoise(new THREE.IcosahedronGeometry(1, 1), 7), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), blobs, (it, o, col) => { o.position.set(it.x, it.z, it.y); o.scale.set(it.r, it.r * 0.92, it.r); o.rotation.set(0, hash(it.x * 50, it.y * 50) * 6, 0); col.copy(rgbN(it.c)).multiplyScalar(it.k); });
  instanced(facetNoise(new THREE.ConeGeometry(1, 1, 7), 3), new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }), cones, (it, o, col) => { o.position.set(it.x, it.z + it.h / 2, it.y); o.scale.set(it.r, it.h, it.r); o.rotation.set(0, hash(it.x * 9, it.z * 9) * 6, 0); col.copy(rgbN(it.c)); });
}

// ---- Night glows: lamp halos (points, sized in screen pixels) and light pools on the ground ----
const GLOWTEX = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.22, 'rgba(255,255,255,0.42)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
function glowPoints(list, size) {
  const pos = [], col = []; for (const L of list) { pos.push(...V(L.x, L.y, L.z)); col.push((L.c[0] / 255) * L.a, (L.c[1] / 255) * L.a, (L.c[2] / 255) * L.a); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
  const m = new THREE.PointsMaterial({ size, map: GLOWTEX, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, sizeAttenuation: false, fog: false });
  const p = new THREE.Points(g, m); p.frustumCulled = false; scene.add(p); GLOW_MATS.push(m); GLOW_OBJS.push(p); return p;
}
function buildGlows() {
  const buckets = new Map();
  for (const L of LIGHTS) { const s = Math.max(12, Math.min(108, Math.round((L.r * 1.5) / 12) * 12)); if (!buckets.has(s)) buckets.set(s, []); buckets.get(s).push(L); }
  for (const [s, list] of buckets) glowPoints(list, s);
  const pos = [], col = [], uv = [];
  for (const L of LIGHTS) {
    const R = (L.r * 0.75) / PXU, x = L.x, y = L.y, k = L.a * 0.55, c = [(L.c[0] / 255) * k, (L.c[1] / 255) * k, (L.c[2] / 255) * k];
    const q = [[x - R, y + R, 0, 1], [x + R, y + R, 1, 1], [x + R, y - R, 1, 0], [x - R, y + R, 0, 1], [x + R, y - R, 1, 0], [x - R, y - R, 0, 0]];
    for (const [a, b, u, v] of q) { pos.push(a, 0.004, b); col.push(...c); uv.push(u, v); }
  }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const m = new THREE.MeshBasicMaterial({ map: GLOWTEX, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false });
  scene.add(new THREE.Mesh(g, m)); GLOW_MATS.push(m);
  // runway, taxiway and threshold lights as crisp dots
  const dots = [], dcol = [], add = (x, y, c) => { dots.push(...V(x, y, 1.5)); dcol.push(c[0], c[1], c[2]); };
  for (let x = 2.2; x <= 25.2; x += 0.75) { add(x, 13.0, [1, 0.96, 0.82]); add(x, 14.4, [1, 0.96, 0.82]); }
  for (let x = 2.8; x < 22.4; x += 1) { add(x, 11.4, [0.3, 0.5, 1]); add(x, 12.1, [0.3, 0.5, 1]); }
  for (let y = 13.05; y < 14.4; y += 0.2) { add(2.2, y, [0.35, 1, 0.5]); add(25.2, y, [0.35, 1, 0.5]); }
  const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.Float32BufferAttribute(dots, 3)); dg.setAttribute('color', new THREE.Float32BufferAttribute(dcol, 3));
  const dm = new THREE.PointsMaterial({ size: 2, vertexColors: true, transparent: true, opacity: 0.3, sizeAttenuation: false, fog: false });
  scene.add(new THREE.Points(dg, dm)); RWY_DOTS.mat = dm;
  glowPoints(dots.reduce((a, _, i) => (i % 3 === 0 ? a.concat([{ x: dots[i], y: dots[i + 2], z: dots[i + 1] * ZPX, c: [dcol[i] * 255, dcol[i + 1] * 255, dcol[i + 2] * 255], a: 0.5 }]) : a), []), 14);
}
const RWY_DOTS = { mat: null };
// Power lines between neighbouring poles on the same street
function buildWires() {
  const byRow = new Map(); for (const p of POLES3) { const k = p[1].toFixed(2); if (!byRow.has(k)) byRow.set(k, []); byRow.get(k).push(p); }
  const pts = [];
  for (const row of byRow.values()) { row.sort((a, b) => a[0] - b[0]); for (let i = 1; i < row.length; i++) for (const off of [-0.18, 0.18]) { const a = row[i - 1], b = row[i]; for (let k = 0; k < 12; k++) { const t0 = k / 12, t1 = (k + 1) / 12, s0 = 4 * t0 * (1 - t0), s1 = 4 * t1 * (1 - t1); pts.push(a[0] + (b[0] - a[0]) * t0, (a[2] - 6 * s0) / ZPX, a[1] + off, a[0] + (b[0] - a[0]) * t1, (a[2] - 6 * s1) / ZPX, a[1] + off); } } }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); scene.add(new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0x23262c })));
}
