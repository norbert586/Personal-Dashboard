
// ============ You: walking, running, biking; camera; doors; the loop ============
const ME = { x: 14.6, y: 19.22, fx: -0.7, fy: 0.7, speed: 0, mode: 'walk', phase: 0, lean: 0, target: null };
const meFig = makeFigure({ skin: [238, 200, 166], hair: [96, 64, 40], jacket: [46, 62, 98], pants: [58, 78, 116], shoes: [238, 238, 238] });
const meBike = makeBike([176, 42, 38]); meBike.g.visible = false;
const SIL = new THREE.MeshBasicMaterial({ color: 0xf2c14e, transparent: true, opacity: 0.6, depthFunc: THREE.GreaterDepth, depthWrite: false, fog: false });
function xray(root) { const list = []; root.traverse((o) => { if (o.isMesh) list.push(o); }); for (const o of list) { const s = new THREE.Mesh(o.geometry, SIL); s.position.copy(o.position); s.rotation.copy(o.rotation); s.scale.copy(o.scale); s.renderOrder = 10; o.parent.add(s); o.material = o.material.clone(); o.material.transparent = true; o.renderOrder = 11; } } // the silhouette draws first, so your own limbs never count as walls
xray(meFig.g); xray(meBike.g);
const head = new THREE.SpotLight(0xfff1cc, 0, 7, 0.5, 0.45, 1); scene.add(head, head.target);
const KEYS = new Set(), touch = matchMedia('(hover: none)').matches, $3 = (s) => document.querySelector(s);
const EL = Math.PI / 6, CAMD = 90, camT = new THREE.Vector3(ME.x, 0, ME.y);
let YAW = Math.PI / 4, YAW_T = YAW, ZOOMD3 = 0, SC3 = 1, SCd3 = 1, LW = 0, LH = 0, NEAR = null;

function resize3() {
  const dpr = window.devicePixelRatio || 1, target = Math.max(300, Math.min(560, innerWidth * 0.34));
  SCd3 = ZOOMD3 || Math.max(1, Math.round((innerWidth * dpr) / target)); SC3 = SCd3 / dpr;
  LW = Math.ceil(innerWidth / SC3); LH = Math.ceil(innerHeight / SC3);
  renderer.setSize(LW, LH, false); cv3.style.width = LW * SC3 + 'px'; cv3.style.height = LH * SC3 + 'px';
  Object.assign(camera, { left: -LW / 2 / PXU, right: LW / 2 / PXU, top: LH / 2 / PXU, bottom: -LH / 2 / PXU }); camera.updateProjectionMatrix();
}
function zoom3(dir) { const dpr = window.devicePixelRatio || 1, n = Math.max(1, Math.min(Math.round(7 * dpr), SCd3 + dir)); if (n !== SCd3) { ZOOMD3 = n; resize3(); } }

// ---- Movement: keys are relative to the camera, so "up" always walks into the screen ----
function blocked(x, y, r) {
  if (x < -3 || y < -3 || x > 35 || y > 35) return true;
  for (const c of COLLIDE) if (x > c[0] - r && x < c[2] + r && y > c[1] - r && y < c[3] + r) return true;
  for (const c of ROUND) if ((x - c[0]) ** 2 + (y - c[1]) ** 2 < (c[2] + r) ** 2) return true;
  return false;
}
function move(dx, dy, r, bike) {
  if (blocked(ME.x, ME.y, r)) r = 0.03;
  if (!blocked(ME.x + dx, ME.y + dy, r)) { ME.x += dx; ME.y += dy; return; }
  if (Math.abs(dx) > 1e-6 && !blocked(ME.x + dx, ME.y, r)) { ME.x += dx; if (bike) ME.speed *= 0.96; return; }
  if (Math.abs(dy) > 1e-6 && !blocked(ME.x, ME.y + dy, r)) { ME.y += dy; if (bike) ME.speed *= 0.96; return; }
  if (bike) ME.speed *= 0.3; ME.target = null;
}
function updatePlayer(dt) {
  let ix = 0, iy = 0;
  if (KEYS.has('KeyW') || KEYS.has('ArrowUp')) iy++; if (KEYS.has('KeyS') || KEYS.has('ArrowDown')) iy--;
  if (KEYS.has('KeyD') || KEYS.has('ArrowRight')) ix++; if (KEYS.has('KeyA') || KEYS.has('ArrowLeft')) ix--;
  let dx = Math.sin(YAW) * ix - Math.cos(YAW) * iy, dy = -Math.cos(YAW) * ix - Math.sin(YAW) * iy;
  if (ix || iy) ME.target = null;
  else if (ME.target) { const tx = ME.target[0] - ME.x, ty = ME.target[1] - ME.y, d = Math.hypot(tx, ty); if (d < (ME.mode === 'bike' ? 0.3 : 0.08)) ME.target = null; else { dx = tx / d; dy = ty / d; } }
  const m = Math.hypot(dx, dy); if (m > 0) { dx /= m; dy /= m; }
  if (ME.mode === 'walk') {
    const run = KEYS.has('ShiftLeft') || KEYS.has('ShiftRight'), want = m > 0 ? (run ? 2.3 : 1.15) : 0;
    ME.speed += (want - ME.speed) * Math.min(1, dt * 10); if (m > 0) { ME.fx = dx; ME.fy = dy; }
    move(ME.fx * ME.speed * dt, ME.fy * ME.speed * dt, 0.09);
    ME.phase += dt * (run ? 11 : 7.5) * Math.min(1.2, ME.speed / 1.15);
  } else {
    const hd = Math.atan2(ME.fy, ME.fx);
    if (m > 0) {
      const diff = ((Math.atan2(dy, dx) - hd + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
      if (Math.abs(diff) > 2.5 && ME.speed > 0.3) ME.speed = Math.max(0, ME.speed - 6 * dt);
      else { const turn = Math.sign(diff) * Math.min(Math.abs(diff), dt * (3.4 - (1.7 * ME.speed) / 4.4)), h2 = hd + turn; ME.fx = Math.cos(h2); ME.fy = Math.sin(h2); ME.speed = Math.min(4.4, ME.speed + dt * (Math.abs(diff) > 1.2 ? 0.8 : 2.6)); ME.lean += ((-turn / Math.max(dt, 1e-3)) * 0.09 * (ME.speed / 4.4) - ME.lean) * Math.min(1, dt * 8); }
    } else { ME.speed = Math.max(0, ME.speed - dt * 0.8); ME.lean *= 0.9; }
    move(ME.fx * ME.speed * dt, ME.fy * ME.speed * dt, 0.13, true);
    ME.phase += dt * ME.speed * 5;
  }
}
function setBike(on) { ME.mode = on ? 'bike' : 'walk'; meBike.g.visible = on; ME.speed = 0; $3('#b-bike').setAttribute('aria-pressed', String(on)); $3('#b-bike').textContent = on ? 'Walk' : 'Bike'; }
function syncMe() {
  const g = meFig.g; g.position.set(ME.x, 0, ME.y); faceTo(g, ME.fx, ME.fy);
  if (ME.mode === 'bike') { meBike.g.position.set(ME.x, 0, ME.y); faceTo(meBike.g, ME.fx, ME.fy); meBike.g.rotation.x = ME.lean; g.rotation.x = ME.lean; g.position.x -= ME.fx * 0.03; g.position.z -= ME.fy * 0.03; poseRide(meFig, ME.phase); meBike.wheels.forEach((w) => (w.rotation.z -= ME.speed * 0.25)); }
  else { g.rotation.x = 0; poseWalk(meFig, ME.phase, ME.speed > 0.05 ? (ME.speed > 1.6 ? 0.85 : 0.55) : 0, ME.speed > 1.6 ? 0.22 : 0); }
}
// ---- Camera: free rotation around you, snapped to whole low-res pixels so walls don't shimmer when panning ----
const UP = new THREE.Vector3(0, 1, 0), off = new THREE.Vector3(), fwd = new THREE.Vector3(), rgt = new THREE.Vector3(), upv = new THREE.Vector3(), snap = new THREE.Vector3();
function updateCamera(dt) {
  if (KEYS.has('KeyQ')) YAW_T -= dt * 1.7; if (KEYS.has('KeyE')) YAW_T += dt * 1.7;
  YAW += (YAW_T - YAW) * Math.min(1, dt * 9);
  const tx = ME.x + ME.fx * ME.speed * 0.28, ty = ME.y + ME.fy * ME.speed * 0.28, k = Math.min(1, dt * 5);
  camT.x += (tx - camT.x) * k; camT.z += (ty - camT.z) * k;
  off.set(Math.cos(EL) * Math.cos(YAW), Math.sin(EL), Math.cos(EL) * Math.sin(YAW)); fwd.copy(off).negate();
  rgt.crossVectors(fwd, UP).normalize(); upv.crossVectors(rgt, fwd).normalize();
  const tr = Math.round(camT.dot(rgt) * PXU) / PXU, tu = Math.round(camT.dot(upv) * PXU) / PXU, tf = camT.dot(fwd);
  snap.copy(rgt).multiplyScalar(tr).addScaledVector(upv, tu).addScaledVector(fwd, tf);
  camera.position.copy(snap).addScaledVector(off, CAMD); camera.up.copy(UP); camera.lookAt(snap);
  for (const o of GLOW_OBJS) o.position.copy(off).multiplyScalar(0.8); // lift halos toward the camera so nearby walls don't clip them
  $3('#compass i').style.transform = `rotate(${(-YAW + Math.PI / 4) - Math.PI / 4}rad)`;
}
const ray = new THREE.Raycaster(), plane0 = new THREE.Plane(UP, 0), hitV = new THREE.Vector3();
function groundAt(cx, cy) { const r = cv3.getBoundingClientRect(); ray.setFromCamera({ x: ((cx - r.left) / r.width) * 2 - 1, y: -((cy - r.top) / r.height) * 2 + 1 }, camera); return ray.ray.intersectPlane(plane0, hitV) ? [hitV.x, hitV.z] : null; }

// ---- Light that follows the real sun; windows, signs and lamps take over at night ----
function applyLight() {
  const L = LS, night = nightK(L), up = L.s.el > 0.5;
  hemi.intensity = 0.86; hemi.color.setRGB(L.sky[0], L.sky[1], L.sky[2]); hemi.groundColor.setRGB(L.sky[0] * 0.45, L.sky[1] * 0.45, L.sky[2] * 0.45);
  sun.intensity = up ? L.I * (1 + 0.9 * (1 - Math.max(0, L.d[2]))) : 0; sun.color.setRGB(Math.min(1.4, L.sunCol[0]), Math.min(1.4, L.sunCol[1]), Math.min(1.4, L.sunCol[2]));
  const d = new THREE.Vector3(L.d[0], Math.max(0.05, L.d[2]), L.d[1]).normalize();
  sun.target.position.set(camT.x, 0, camT.z); sun.position.copy(sun.target.position).addScaledVector(d, 120);
  const half = Math.max(12, Math.min(34, (Math.max(LW, LH) / PXU) * 0.8)), sc = sun.shadow.camera; if (sc.right !== half) { Object.assign(sc, { left: -half, right: half, top: half, bottom: -half }); sc.updateProjectionMatrix(); }
  const day = mix3([0.05, 0.07, 0.13], [L.sky[0] * 0.9 + 0.06, L.sky[1] * 0.9 + 0.06, L.sky[2] * 0.9 + 0.06], 1 - night);
  scene.background.setRGB(day[0], day[1], day[2]); scene.fog.color.copy(scene.background);
  for (const m of STATIC_MATS) m.emissiveIntensity = night; for (const m of GLOW_MATS) m.opacity = night;
  if (RWY_DOTS.mat) RWY_DOTS.mat.opacity = 0.25 + 0.75 * night;
  head.intensity = ME.mode === 'bike' ? 3 * night : 0; if (ME.mode === 'bike' && night > 0.2) dyn(ME.x + ME.fx * 0.09, ME.y + ME.fy * 0.09, 5, [1, 0.95, 0.8]); head.position.set(ME.x + ME.fx * 0.12, 0.16, ME.y + ME.fy * 0.12); head.target.position.set(ME.x + ME.fx * 2.4, 0, ME.y + ME.fy * 2.4);
}
// ---- Doors: walk up to a building and press F (or tap the prompt) ----
function nearestDoor() { let best = null, bd = 1e9; for (const d of DOORS) { const dd = Math.hypot(d.x - ME.x, d.y - ME.y); if (dd < d.reach && dd < bd) { bd = dd; best = d; } } return best; }
function updatePrompt() {
  const d = nearestDoor(); if (d === NEAR) return; NEAR = d; const pr = $3('#prompt');
  if (!d) { pr.hidden = true; return; }
  const p = byId(d.id); pr.hidden = false; $3('#prompt-text').textContent = p.place ? `${p.place}: ${p.title}` : p.title;
}
function openInfo(id) {
  const p = byId(id); if (!p) return; const m = MORNING, esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  let body = `<p class="dim">${p.place ? `${esc(p.place)}, ${STATUS_PLACE[p.status]}` : p.feed ? 'Main Street' : 'Landmark'}</p><p>${esc(p.summary || p.note || 'No summary yet.')}</p>`;
  if (p.place) body += `<dl><dt>Status</dt><dd>${STATUS_WORD[p.status]}</dd><dt>Stack</dt><dd>${esc(p.stack.join(', ') || 'Not listed')}</dd><dt>Last activity</dt><dd>${ago(p.last)}</dd></dl><p><a class="key" href="${p.repo}" target="_blank" rel="noopener">Open on GitHub</a></p>`;
  if (p.feed === 'movies') body += `<ul>${m.movies.map(([t, r, x]) => `<li><b>${esc(t)}</b> <span class="dim">${r}</span><br>${x.join('  ')}</li>`).join('')}</ul><p class="dim">Sample showtimes.</p>`;
  if (p.feed === 'comics') body += `<ul>${m.comics.map(([t, pub]) => `<li><b>${esc(t)}</b> <span class="dim">${esc(pub)}</span></li>`).join('')}</ul><p class="dim">Sample releases.</p>`;
  if (p.feed === 'sports') body += `<ul>${m.sports.map(([t, l, n]) => `<li><b>${esc(t)}</b> ${l ? `${l[0]} ${l[1]} ${l[2]}` : ''}<br><span class="dim">${esc(n)}</span></li>`).join('')}</ul><p class="dim">Sample scores.</p>`;
  $3('#info-title').textContent = p.place || p.title; $3('#info-body').innerHTML = body; $3('#info').hidden = false; KEYS.clear(); $3('#info-close').focus();
}
const closeInfo = () => { $3('#info').hidden = true; cv3.focus(); };
