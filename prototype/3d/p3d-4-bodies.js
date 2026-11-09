
// ============ Bodies for everything that moves (the simulation itself is the 2D version's) ============
const BOXG = new THREE.BoxGeometry(1, 1, 1), MATS = new Map(), PX = 1 / ZPX;
const lam = (c) => { const k = c.join(); if (!MATS.has(k)) MATS.set(k, new THREE.MeshLambertMaterial({ color: rgbN(c) })); return MATS.get(k); };
function part(parent, w, h, d, c, x, y, z) { const m = new THREE.Mesh(BOXG, lam(c)); m.scale.set(w, h, d); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; parent.add(m); return m; }
// Local +X is forward; rotation.y = atan2(-fy, fx) turns it to face (fx, fy) on the grid.
const faceTo = (o, fx, fy) => { o.rotation.y = Math.atan2(-fy, fx); };
function makeFigure(c) {
  const g = new THREE.Group(), legs = [], arms = [];
  for (const s of [-1, 1]) { const hip = new THREE.Group(); hip.position.set(0, 4.6 * PX, s * 0.017); part(hip, 0.026, 4.6 * PX, 0.024, c.pants, 0, -2.3 * PX, 0); part(hip, 0.042, 0.8 * PX, 0.026, c.shoes, 0.008, -4.4 * PX, 0); g.add(hip); legs.push(hip); }
  const body = new THREE.Group(); body.position.set(0, 4.6 * PX, 0); g.add(body);
  part(body, 0.042, 4.2 * PX, 0.07, c.jacket, 0, 2.1 * PX, 0);
  for (const s of [-1, 1]) { const sh = new THREE.Group(); sh.position.set(0, 3.9 * PX, s * 0.045); part(sh, 0.02, 3.6 * PX, 0.02, c.jacket, 0, -1.8 * PX, 0); part(sh, 0.02, 0.8 * PX, 0.02, c.skin, 0, -3.9 * PX, 0); body.add(sh); arms.push(sh); }
  part(body, 0.046, 2.4 * PX, 0.046, c.skin, 0, 5.4 * PX, 0); part(body, 0.05, 0.9 * PX, 0.05, c.hair, -0.002, 6.9 * PX, 0); part(body, 0.012, 1.8 * PX, 0.05, c.hair, -0.022, 5.8 * PX, 0);
  scene.add(g); return { g, legs, arms, body };
}
function poseWalk(F, phase, amp, lean = 0) { const s = Math.sin(phase) * amp; F.legs[0].rotation.z = s; F.legs[1].rotation.z = -s; F.arms[0].rotation.z = -s * 0.8; F.arms[1].rotation.z = s * 0.8; F.body.rotation.z = -lean; F.body.position.y = 4.6 * PX + Math.abs(Math.cos(phase)) * amp * 0.4 * PX; }
function poseRide(F, phase) { F.legs[0].rotation.z = 0.9 + Math.sin(phase) * 0.5; F.legs[1].rotation.z = 0.9 - Math.sin(phase) * 0.5; F.arms[0].rotation.z = F.arms[1].rotation.z = 1.05; F.body.rotation.z = -0.38; F.body.position.y = 4.6 * PX; }
function makeBike(frame) {
  const g = new THREE.Group(), tire = lam([26, 26, 30]), wheels = [];
  for (const x of [-0.078, 0.078]) { const w = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.009, 4, 10), tire); w.position.set(x, 0.055, 0); w.castShadow = true; g.add(w); wheels.push(w); }
  part(g, 0.15, 0.012, 0.012, frame, 0, 0.1, 0); part(g, 0.012, 0.06, 0.012, frame, -0.035, 0.078, 0); part(g, 0.012, 0.075, 0.012, frame, 0.062, 0.085, 0);
  part(g, 0.04, 0.009, 0.022, [22, 22, 26], -0.04, 0.115, 0); part(g, 0.01, 0.01, 0.085, [44, 44, 48], 0.066, 0.126, 0);
  scene.add(g); return { g, wheels };
}
// ---- Townspeople ----
const NPC = [];
function makePeople() {
  for (const p of PEOPLE) {
    const F = makeFigure({ skin: p.skin, hair: p.hair, jacket: p.jacket, pants: p.pants, shoes: [210, 210, 214] }), B = p.kind === 'bike' ? makeBike([40 + hash(p.ph, 3) * 180, 60, 70 + hash(p.ph, 4) * 150]) : null;
    let dog = null; if (p.dog) { dog = new THREE.Group(); part(dog, 0.07, 1.6 * PX, 0.028, p.dog, 0, 1.8 * PX, 0); part(dog, 0.03, 1.4 * PX, 0.026, p.dog, 0.045, 2.8 * PX, 0); for (const [dx, dz] of [[-0.025, -0.01], [-0.025, 0.01], [0.025, -0.01], [0.025, 0.01]]) part(dog, 0.008, 1 * PX, 0.008, p.dog, dx, 0.5 * PX, dz); scene.add(dog); }
    NPC.push({ p, F, B, dog });
  }
}
function syncPeople(t) {
  for (const n of NPC) {
    const { p, F, B, dog } = n, moving = p.wait <= 0;
    F.g.position.set(p.x, 0, p.y); faceTo(F.g, p.fx, p.fy);
    if (B) { B.g.position.set(p.x, 0, p.y); faceTo(B.g, p.fx, p.fy); poseRide(F, t * 9 + p.ph); B.wheels.forEach((w) => (w.rotation.z -= 0.2)); }
    else poseWalk(F, t * (p.kind === 'run' ? 11 : 7) + p.ph, moving ? (p.kind === 'run' ? 0.85 : 0.5) : 0, p.kind === 'run' ? 0.25 : 0);
    if (dog) { dog.position.set(p.x - p.fx * 0.16 + p.fy * 0.06, 0, p.y - p.fy * 0.16 - p.fx * 0.06); faceTo(dog, p.fx, p.fy); }
  }
}
// ---- Cars, planes, the freight train, turbine rotors ----
const CAR3 = [], PARK3 = [], DYN = [];
function makeCar(col, big) { const g = new THREE.Group(), body = []; for (const [u, v, z, l, w, h, c] of carParts(col, big)) { const m = part(g, l, h * PX, w, c, u, (z + h / 2) * PX, v); if (c === col) body.push(m); } scene.add(g); return { g, body, big, len: big ? 0.8 : 0.6 }; }
function makePlane(acc, jet) { const g = new THREE.Group(); for (const [u, v, z, l, w, h, c] of planeParts(acc, jet)) part(g, l, h * PX, w, c, u, (z + h / 2) * PX, v); scene.add(g); return g; }
let PLANE3 = null, TRAIN3 = [], ROTORS = [];
function makeVehicles() {
  for (const c of CARS) CAR3.push({ c, b: makeCar(CARCOL[0], c.big), n: -1 });
  for (const [x, y, f, ci] of PARKED) { const b = makeCar(CARCOL[ci], 0); b.g.position.set(x, 0, y); faceTo(b.g, f[0], f[1]); PARK3.push(b); }
  PLANE3 = makePlane(plane.acc, false);
  for (const [x, y, f, acc] of STANDS) { const g = makePlane(acc, false); g.position.set(x, 0, y); faceTo(g, f[0], f[1]); }
  for (let i = 0; i < 14; i++) { const g = new THREE.Group(), col = i === 0 ? [40, 90, 70] : [[120, 70, 50], [110, 112, 118], [150, 60, 40], [40, 42, 48]][i % 4]; part(g, 0.56, (i === 0 ? 11 : 9) * PX, 0.26, col, 0, ((i === 0 ? 11 : 9) / 2 + 1) * PX, 0); for (const dx of [-0.2, 0.2]) part(g, 0.08, 1.4 * PX, 0.22, [30, 30, 34], dx, 0.7 * PX, 0); scene.add(g); TRAIN3.push(g); }
  for (const [gx, gy, h] of TURB3) { const hub = new THREE.Group(); hub.position.set(gx + 0.1, h / ZPX + 0.06, gy); for (let k = 0; k < 3; k++) { const arm = new THREE.Group(); arm.rotation.x = (k * Math.PI * 2) / 3; part(arm, 0.012, 0.5, 0.035, [236, 238, 240], 0, 0.25, 0); hub.add(arm); } scene.add(hub); ROTORS.push(hub); }
}
// Moving lights (headlights, nav lights, turbine tips) share one point cloud that is refilled every frame.
const DYN_MAX = 160, dynPos = new Float32Array(DYN_MAX * 3), dynCol = new Float32Array(DYN_MAX * 3);
const dynGeo = new THREE.BufferGeometry(); dynGeo.setAttribute('position', new THREE.BufferAttribute(dynPos, 3)); dynGeo.setAttribute('color', new THREE.BufferAttribute(dynCol, 3));
const dynMat = new THREE.PointsMaterial({ size: 18, map: GLOWTEX, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, sizeAttenuation: false, fog: false });
const dynPts = new THREE.Points(dynGeo, dynMat); dynPts.frustumCulled = false; scene.add(dynPts); GLOW_MATS.push(dynMat); GLOW_OBJS.push(dynPts);
let dynN = 0; const dyn = (x, y, z, c) => { if (dynN >= DYN_MAX) return; const i = dynN * 3, p = V(x, y, z); dynPos[i] = p[0]; dynPos[i + 1] = p[1]; dynPos[i + 2] = p[2]; dynCol[i] = c[0]; dynCol[i + 1] = c[1]; dynCol[i + 2] = c[2]; dynN++; };
const SMOKE_MAX = 400, smPos = new Float32Array(SMOKE_MAX * 3), smGeo = new THREE.BufferGeometry(); smGeo.setAttribute('position', new THREE.BufferAttribute(smPos, 3));
const smPts = new THREE.Points(smGeo, new THREE.PointsMaterial({ size: 7, map: GLOWTEX, color: 0xd8dde4, transparent: true, opacity: 0.55, depthWrite: false, sizeAttenuation: false })); smPts.frustumCulled = false; scene.add(smPts);
function syncVehicles(t) {
  dynN = 0;
  for (const v of CAR3) {
    const { c } = v, x = c.a[0] + (c.b[0] - c.a[0]) * c.t, y = c.a[1] + (c.b[1] - c.a[1]) * c.t, l = Math.hypot(c.b[0] - c.a[0], c.b[1] - c.a[1]), fx = (c.b[0] - c.a[0]) / l, fy = (c.b[1] - c.a[1]) / l;
    if (v.n !== c.n) { v.n = c.n; const col = c.col || CARCOL[Math.floor(hash(c.n, c.a[0] * 7 + c.b[1]) * 8)]; for (const m of v.b.body) m.material = lam(col); }
    v.b.g.position.set(x, 0, y); faceTo(v.b.g, fx, fy);
    const h = v.b.len / 2; for (const s of [-1, 1]) { dyn(x + fx * h - fy * 0.09 * s, y + fy * h + fx * 0.09 * s, 4, [1, 0.92, 0.7]); dyn(x - fx * h - fy * 0.09 * s, y - fy * h + fx * 0.09 * s, 4, [0.6, 0.06, 0.04]); }
  }
  PLANE3.position.set(plane.x, plane.z / ZPX, plane.y); faceTo(PLANE3, plane.f[0], plane.f[1]);
  if (Math.floor(t * 1.4) % 2 === 0) dyn(plane.x - plane.f[0] * 0.3, plane.y - plane.f[1] * 0.3, plane.z + 17, [1, 1, 1]);
  dyn(plane.x + plane.f[1] * 0.48, plane.y - plane.f[0] * 0.48, plane.z + 9, [1, 0.2, 0.15]); dyn(plane.x - plane.f[1] * 0.48, plane.y + plane.f[0] * 0.48, plane.z + 9, [0.2, 1, 0.4]);
  TRAIN3.forEach((g, i) => { g.visible = TRAIN.wait <= 0; g.position.set(TRAIN.x - i * 0.62, 0, 1.19); });
  if (TRAIN.wait <= 0) dyn(TRAIN.x + 0.3, 1.19, 6, [1, 0.95, 0.75]);
  for (const r of ROTORS) { r.rotation.x = (S.detail === 'off' ? 0.4 : t * 1.3) + r.position.x; if (Math.floor(t) % 2 === 0) dyn(r.position.x - 0.1, r.position.z, (r.position.y + 0.08) * ZPX, [1, 0.15, 0.1]); }
  let k = 0; for (const s of SMOKE) { if (k >= SMOKE_MAX) break; const p = V(s.x, s.y, s.z); smPos[k * 3] = p[0]; smPos[k * 3 + 1] = p[1]; smPos[k * 3 + 2] = p[2]; k++; }
  smGeo.setDrawRange(0, k); smGeo.attributes.position.needsUpdate = true;
}
