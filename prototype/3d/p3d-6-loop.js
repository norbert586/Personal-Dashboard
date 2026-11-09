
// ---- Input ----
const TIMES = [['auto', 'Real time'], ['day', 'Midday'], ['dusk', 'Dusk'], ['night', 'Night']];
function cycleTime() { const i = (TIMES.findIndex(([k]) => k === S.time) + 1) % TIMES.length; S.time = TIMES[i][0]; $3('#b-time').textContent = TIMES[i][1]; }
let bellCtx = null;
function bell() { try { bellCtx = bellCtx || new AudioContext(); const t = bellCtx.currentTime; for (const [f, d] of [[1760, 0], [2217, 0.12]]) { const o = bellCtx.createOscillator(), g = bellCtx.createGain(); o.frequency.value = f; g.gain.setValueAtTime(0.0001, t + d); g.gain.exponentialRampToValueAtTime(0.18, t + d + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.6); o.connect(g).connect(bellCtx.destination); o.start(t + d); o.stop(t + d + 0.65); } } catch { /* sound unavailable */ } }
addEventListener('keydown', (e) => {
  if (!$3('#info').hidden) { if (e.key === 'Escape') closeInfo(); return; }
  if (e.target.closest && e.target.closest('button, a')) { if (e.key === 'Enter' || e.key === ' ') return; }
  const k = e.code;
  if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(k)) e.preventDefault();
  if (e.repeat) { KEYS.add(k); return; }
  KEYS.add(k);
  if (k === 'KeyB') setBike(ME.mode !== 'bike');
  else if (k === 'KeyF' || k === 'Enter') { if (NEAR) enterBuilding(NEAR.id); }
  else if (k === 'KeyN') cycleTime();
  else if (k === 'Space' && ME.mode === 'bike') bell();
  else if (e.key === '+' || e.key === '=') zoom3(1); else if (e.key === '-') zoom3(-1);
});
addEventListener('keyup', (e) => KEYS.delete(e.code));
addEventListener('blur', () => KEYS.clear());
let drag = null;
cv3.addEventListener('pointerdown', (e) => { drag = { x: e.clientX, y: e.clientY, moved: false, yaw: YAW_T }; cv3.setPointerCapture(e.pointerId); });
cv3.addEventListener('pointermove', (e) => { if (!drag) return; const dx = e.clientX - drag.x; if (Math.abs(dx) + Math.abs(e.clientY - drag.y) > 8) drag.moved = true; if (drag.moved) YAW_T = drag.yaw + dx * 0.008; });
cv3.addEventListener('pointerup', (e) => { if (drag && !drag.moved) clickAt(e.clientX, e.clientY); drag = null; });
cv3.addEventListener('wheel', (e) => { e.preventDefault(); zoom3(e.deltaY < 0 ? 1 : -1); }, { passive: false });
$3('#b-left').addEventListener('click', () => (YAW_T -= Math.PI / 4)); $3('#b-right').addEventListener('click', () => (YAW_T += Math.PI / 4));
$3('#b-in').addEventListener('click', () => zoom3(1)); $3('#b-out').addEventListener('click', () => zoom3(-1));
$3('#b-bike').addEventListener('click', () => setBike(ME.mode !== 'bike')); $3('#b-time').addEventListener('click', cycleTime);
$3('#prompt').addEventListener('click', () => NEAR && enterBuilding(NEAR.id)); $3('#info-close').addEventListener('click', closeInfo);
addEventListener('resize', resize3);
if (touch) { $3('#hint').textContent = 'Tap anywhere to walk there, or tap a building to go in. Drag to turn the camera.'; $3('#prompt .k').textContent = 'Tap'; }

// ---- Loop ----
let last3 = performance.now();
function frame3(now) {
  const dt = Math.min(0.05, (now - last3) / 1000); last3 = now;
  if (!document.hidden) {
    LS = lighting(simDate(), weatherNow());
    if (S.detail !== 'off') updateActors(dt);
    if ($3('#info').hidden) updatePlayer(dt);
    updateCamera(dt); syncMe(); syncPeople(now / 1000); syncVehicles(now / 1000); updateSky3(dt, nightK(LS)); updatePathMarks(now / 1000); applyLight();
    dynGeo.setDrawRange(0, dynN); dynGeo.attributes.position.needsUpdate = true; dynGeo.attributes.color.needsUpdate = true;
    updatePrompt(); renderer.render(scene, camera);
  }
  requestAnimationFrame(frame3);
}
function start3() {
  S.weather = 'clear';
  applySeason(seasonNow()); cacheTokens();
  buildWorld();
  buildStatic(); buildGround(); buildTrees(); buildGlows(); buildWires();
  setupActors(); makePeople(); makeVehicles(); makeSkyTraffic(); buildNav(); assignDoorIds();
  scene.fog.near = CAMD + 14; scene.fog.far = CAMD + 62;
  LS = lighting(simDate(), weatherNow()); resize3();
  $3('#loading').hidden = true; cv3.focus();
  requestAnimationFrame(frame3);
}
setTimeout(() => { try { start3(); } catch (err) { $3('#loading').textContent = 'This needs WebGL, which this browser could not start. ' + err.message; throw err; } }, 40);
</script>
