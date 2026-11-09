
// ============ Click to walk (A* around buildings), going inside, and planes overhead ============
// Walkable grid: 4 cells per tile; a cell is blocked where you would bump into something.
const NAV = { x0: -3, y0: -3, n: 4, w: 152, h: 152, block: null };
function buildNav() { NAV.block = new Uint8Array(NAV.w * NAV.h); for (let j = 0; j < NAV.h; j++) for (let i = 0; i < NAV.w; i++) NAV.block[j * NAV.w + i] = blocked(NAV.x0 + (i + 0.5) / NAV.n, NAV.y0 + (j + 0.5) / NAV.n, 0.1) ? 1 : 0; }
const cellOf = (x, y) => [Math.floor((x - NAV.x0) * NAV.n), Math.floor((y - NAV.y0) * NAV.n)];
const cellAt = (i, j) => [NAV.x0 + (i + 0.5) / NAV.n, NAV.y0 + (j + 0.5) / NAV.n];
const navFree = (i, j) => i >= 0 && j >= 0 && i < NAV.w && j < NAV.h && !NAV.block[j * NAV.w + i];
function nearestFree(i, j) { if (navFree(i, j)) return [i, j]; for (let r = 1; r < 30; r++) for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) if (Math.max(Math.abs(di), Math.abs(dj)) === r && navFree(i + di, j + dj)) return [i + di, j + dj]; return null; }
function sight(p, q) { const n = Math.ceil(Math.hypot(q[0] - p[0], q[1] - p[1]) * NAV.n * 2); for (let k = 1; k <= n; k++) { const [i, j] = cellOf(p[0] + ((q[0] - p[0]) * k) / n, p[1] + ((q[1] - p[1]) * k) / n); if (!navFree(i, j)) return false; } return true; }
function findPath(sx, sy, tx, ty) {
  const s = nearestFree(...cellOf(sx, sy)), t = nearestFree(...cellOf(tx, ty)); if (!s || !t) return null;
  const W = NAV.w, N = W * NAV.h, g = new Float32Array(N).fill(Infinity), came = new Int32Array(N).fill(-1), done = new Uint8Array(N), heap = [];
  const push = (f, k) => { heap.push([f, k]); let c = heap.length - 1; while (c > 0) { const p = (c - 1) >> 1; if (heap[p][0] <= heap[c][0]) break; [heap[p], heap[c]] = [heap[c], heap[p]]; c = p; } };
  const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let c = 0; for (;;) { const l = 2 * c + 1, r = l + 1; let m = c; if (l < heap.length && heap[l][0] < heap[m][0]) m = l; if (r < heap.length && heap[r][0] < heap[m][0]) m = r; if (m === c) break; [heap[m], heap[c]] = [heap[c], heap[m]]; c = m; } } return top; };
  const hgt = (i, j) => { const a = Math.abs(i - t[0]), b = Math.abs(j - t[1]); return Math.max(a, b) + 0.414 * Math.min(a, b); };
  const si = s[1] * W + s[0], ti = t[1] * W + t[0]; g[si] = 0; push(hgt(s[0], s[1]), si);
  while (heap.length) {
    const k = pop()[1]; if (done[k]) continue; done[k] = 1; if (k === ti) break;
    const i = k % W, j = (k / W) | 0;
    for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
      if ((!di && !dj) || !navFree(i + di, j + dj) || (di && dj && (!navFree(i + di, j) || !navFree(i, j + dj)))) continue;
      const nk = (j + dj) * W + i + di, ng = g[k] + (di && dj ? 1.414 : 1); if (ng < g[nk]) { g[nk] = ng; came[nk] = k; push(ng + hgt(i + di, j + dj), nk); }
    }
  }
  if (ti !== si && came[ti] < 0) return null;
  const pts = []; for (let k = ti; ; k = came[k]) { pts.push(cellAt(k % W, (k / W) | 0)); if (k === si || came[k] < 0) break; }
  pts.reverse(); if (navFree(...cellOf(tx, ty))) pts[pts.length - 1] = [tx, ty];
  const out = [[sx, sy]]; let a = 0; // string-pull: keep only the corners you can't see past
  while (a < pts.length - 1) { let b = pts.length - 1; while (b > a + 1 && !sight(out[out.length - 1], pts[b])) b--; out.push(pts[b]); a = b; }
  return out.slice(1);
}
const pathLeft = () => { let L = 0, px = ME.x, py = ME.y; for (const [x, y] of ME.path || []) { L += Math.hypot(x - px, y - py); px = x; py = y; } return L; };
// Doors belong to the footprint they sit in front of, so a click on a wall or roof finds its door.
function assignDoorIds() { for (const d of DOORS) { let best = null, bd = 0.7; for (const c of COLLIDE) { const dx = Math.max(c[0] - d.x, 0, d.x - c[2]), dy = Math.max(c[1] - d.y, 0, d.y - c[3]), dd = Math.hypot(dx, dy); if (dd < bd) { bd = dd; best = c; } } if (best && !best[4]) best[4] = d.id; } }
const STATIC_HITS = [];
function pick(cx, cy) {
  const r = cv3.getBoundingClientRect(); ray.setFromCamera({ x: ((cx - r.left) / r.width) * 2 - 1, y: -((cy - r.top) / r.height) * 2 + 1 }, camera);
  const hit = ray.intersectObjects(STATIC_HITS, false)[0];
  if (hit && hit.point.y > 0.03) { // canopies, awnings and signs stick out past the footprint, so take the nearest building within half a tile
    const x = hit.point.x, y = hit.point.z; let best = null, bd = 0.5;
    for (const k of COLLIDE) { const dd = Math.hypot(Math.max(k[0] - x, 0, x - k[2]), Math.max(k[1] - y, 0, y - k[3])); if (dd < bd) { bd = dd; best = k; } }
    return { x, y, id: best ? best[4] || 0 : 0 };
  }
  const g = groundAt(cx, cy); return g ? { x: g[0], y: g[1], id: 0 } : null;
}
function clickAt(cx, cy) {
  const p = pick(cx, cy); if (!p) return;
  const d = p.id && DOORS.filter((k) => k.id === p.id).sort((a, b) => Math.hypot(a.x - ME.x, a.y - ME.y) - Math.hypot(b.x - ME.x, b.y - ME.y))[0];
  if (d && Math.hypot(d.x - ME.x, d.y - ME.y) < d.reach) { enterBuilding(d.id); return; } // already at the door
  const path = findPath(ME.x, ME.y, d ? d.x : p.x, d ? d.y : p.y); if (!path) return;
  ME.path = path; ME.enterId = d ? d.id : 0;
}
// Going inside: you step through the door, the building's window opens, and you come back out when it closes.
let INSIDE = null;
function enterBuilding(id) { INSIDE = id; ME.path = null; ME.speed = 0; meFig.g.visible = false; meBike.g.visible = false; openInfo(id); }
// ---- Path preview like a modern RPG: a dotted line on the ground and a pulsing ring where you'll stop ----
const MARK = new THREE.Mesh(new THREE.RingGeometry(0.1, 0.16, 24), new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.9, depthWrite: false, fog: false }));
MARK.rotation.x = -Math.PI / 2; MARK.visible = false; scene.add(MARK);
const DOTS = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: 0xf2c14e, size: 3, sizeAttenuation: false, transparent: true, opacity: 0.85, depthWrite: false, fog: false }));
DOTS.geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(600 * 3), 3)); DOTS.frustumCulled = false; scene.add(DOTS);
function updatePathMarks(t) {
  const path = ME.path; if (!path || !path.length) { MARK.visible = false; DOTS.geometry.setDrawRange(0, 0); return; }
  const end = path[path.length - 1], s = 1 + Math.sin(t * 5) * 0.12; MARK.visible = true; MARK.position.set(end[0], 0.014, end[1]); MARK.scale.set(s, s, s);
  const arr = DOTS.geometry.attributes.position.array; let n = 0, px = ME.x, py = ME.y, at = 0.16;
  for (const [qx, qy] of path) { const L = Math.hypot(qx - px, qy - py); while (at < L && n < 600) { const f = at / L; arr[n * 3] = px + (qx - px) * f; arr[n * 3 + 1] = 0.014; arr[n * 3 + 2] = py + (qy - py) * f; n++; at += 0.16; } at -= L; px = qx; py = qy; }
  DOTS.geometry.setDrawRange(0, n); DOTS.geometry.attributes.position.needsUpdate = true;
}
// ---- Planes for the eye in the sky: a low one that sweeps right under the camera, and high jets with contrails ----
const FLY = { g: null, t: -1, wait: 9 }, JET = { g: null, t: -1, wait: 4, trail: [], line: null };
function makeSkyTraffic() {
  FLY.g = makePlane([46, 92, 168], false); FLY.g.scale.setScalar(3.2); FLY.g.visible = false;
  JET.g = makePlane([200, 52, 44], true); JET.g.scale.setScalar(1.5); JET.g.visible = false;
  const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(90 * 3), 3));
  JET.line = new THREE.Line(lg, new THREE.LineBasicMaterial({ color: 0xf4f6fa, transparent: true, opacity: 0.6, fog: false })); JET.line.frustumCulled = false; scene.add(JET.line);
}
// A point h above the ground shows up in mid-screen when it sits h·√3 toward the camera from what you're looking at.
function skyPass(o, h, speed, along) {
  const a = Math.random() * Math.PI * 2, cx = camT.x + Math.cos(YAW) * h * 1.732 + (Math.random() - 0.5) * 3, cy = camT.z + Math.sin(YAW) * h * 1.732 + (Math.random() - 0.5) * 3;
  Object.assign(o, { dir: [Math.cos(a), Math.sin(a)], h, speed, along, t: 0 }); o.p0 = [cx - o.dir[0] * along, cy - o.dir[1] * along]; o.g.visible = true; faceTo(o.g, o.dir[0], o.dir[1]);
}
function stepPass(o, dt) { o.t += dt; const d = o.speed * o.t; o.g.position.set(o.p0[0] + o.dir[0] * d, o.h, o.p0[1] + o.dir[1] * d); return d > o.along * 2; }
function updateSky3(dt, night) {
  if (S.detail === 'off') return;
  if (FLY.t < 0) { if ((FLY.wait -= dt) <= 0) skyPass(FLY, 5.2, 6.5, 14); }
  else { FLY.g.rotation.x = Math.sin(FLY.t * 0.9) * 0.14; if (stepPass(FLY, dt)) { FLY.t = -1; FLY.g.visible = false; FLY.wait = 28 + Math.random() * 40; } }
  if (FLY.t >= 0 && night > 0.3) { const p = FLY.g.position, f = FLY.dir; dyn(p.x + f[1] * 1.5, p.z - f[0] * 1.5, p.y * ZPX + 30, [1, 0.2, 0.15]); dyn(p.x - f[1] * 1.5, p.z + f[0] * 1.5, p.y * ZPX + 30, [0.2, 1, 0.4]); }
  if (JET.t < 0) { if ((JET.wait -= dt) <= 0) { skyPass(JET, 12, 2.4, 20); JET.trail.length = 0; } }
  else {
    const done = stepPass(JET, dt), p = JET.g.position, last = JET.trail[JET.trail.length - 1];
    if (!last || Math.hypot(p.x - last[0], p.z - last[1]) > 0.3) { JET.trail.push([p.x - JET.dir[0] * 0.6, p.z - JET.dir[1] * 0.6]); if (JET.trail.length > 90) JET.trail.shift(); }
    const arr = JET.line.geometry.attributes.position.array; JET.trail.forEach((q, i) => { arr[i * 3] = q[0]; arr[i * 3 + 1] = JET.h + 0.12; arr[i * 3 + 2] = q[1]; });
    JET.line.geometry.setDrawRange(0, JET.trail.length); JET.line.geometry.attributes.position.needsUpdate = true;
    if (done) { JET.t = -1; JET.g.visible = false; JET.trail.length = 0; JET.line.geometry.setDrawRange(0, 0); JET.wait = 22 + Math.random() * 30; }
  }
}
// Hovering over a building you can go into shows a hand cursor.
let hoverT = 0;
cv3.addEventListener('pointermove', (e) => { if (drag || e.pointerType === 'touch') return; const now = performance.now(); if (now - hoverT < 120) return; hoverT = now; const p = pick(e.clientX, e.clientY); cv3.style.cursor = p && p.id ? 'pointer' : 'crosshair'; });
