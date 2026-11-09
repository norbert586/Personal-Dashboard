
// ---- Inventory: the kit Norbert carries between projects ----
const TOOLS = {
  TypeScript: { kind: 'Language', abbr: 'TS', color: '#3178c6' },
  JavaScript: { kind: 'Language', abbr: 'JS', color: '#c9a227' },
  Python: { kind: 'Language', abbr: 'PY', color: '#3b77a8' },
  Astro: { kind: 'Framework', abbr: 'AS', color: '#c8466a' },
  'Raspberry Pi': { kind: 'Hardware', abbr: 'Pi', color: '#c51a4a' },
};
const toolUses = (name) => PROJECTS.filter((p) => p.stack.includes(name));
function itemIcon(name) {
  const t = TOOLS[name] || { kind: 'Tool', abbr: name.slice(0, 2), color: '#7a8592' };
  if (t.kind === 'Hardware') return `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><rect x="1" y="3" width="14" height="10" fill="#1f6b3a"/><rect x="1" y="3" width="14" height="1" fill="#2f8a4a"/><rect x="3" y="5" width="4" height="4" fill="#15181c"/><rect x="9" y="5" width="4" height="2" fill="#7a8592"/><rect x="9" y="8" width="2" height="3" fill="#e2b23a"/><rect x="2" y="11" width="12" height="1" fill="#e2b23a"/><rect x="12" y="9" width="2" height="2" fill="${t.color}"/></svg>`;
  return `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" aria-hidden="true"><rect x="1" y="1" width="14" height="14" fill="#2b2e31"/><rect x="2" y="2" width="12" height="12" fill="#363a3e"/><rect x="4" y="1" width="7" height="5" fill="#b9bec4"/><rect x="8" y="2" width="2" height="3" fill="#2b2e31"/><rect x="3" y="8" width="10" height="6" fill="${t.color}"/><rect x="3" y="8" width="10" height="1" fill="#ffffff" fill-opacity=".35"/><text x="8" y="13.3" font-size="4.6" font-family="VT323, monospace" text-anchor="middle" fill="#ffffff">${t.abbr}</text></svg>`;
}
let toolSel = 'TypeScript';
function paneInventory() {
  const names = [...new Set(PROJECTS.flatMap((p) => p.stack))].sort((a, b) => toolUses(b).length - toolUses(a).length || a.localeCompare(b));
  if (!names.includes(toolSel)) toolSel = names[0];
  const uses = toolUses(toolSel), t = TOOLS[toolSel] || { kind: 'Tool' };
  pane.innerHTML = `<h3>Inventory</h3><p class="lede">What Norbert carries from project to project: languages, frameworks and hardware. The count is how many projects used it.</p>
  <div class="inv"><div class="slots">${names.map((n) => `<button class="slot item" type="button" data-tool="${n}" aria-pressed="${n === toolSel}">${itemIcon(n)}<span>${n}</span><span class="st qty">×${toolUses(n).length}</span></button>`).join('')}</div>
  <article class="spec bevel item">${itemIcon(toolSel)}<h4>${toolSel} <span class="qty">×${uses.length}</span></h4><p class="dim">${t.kind}</p><p>Used in</p>
  <div class="uses">${uses.map((p) => `<button class="key" type="button" data-open="${p.id}">${p.title}</button>`).join('')}</div></article></div>`;
  pane.querySelectorAll('[data-tool]').forEach((b) => b.addEventListener('click', () => { toolSel = b.dataset.tool; sfx.select(); paneInventory(); pane.querySelector(`[data-tool="${toolSel}"]`)?.focus(); }));
  pane.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { closePause(true); openBuilding(Number(b.dataset.open)); }));
}

// ---- Building windows: every building has its own page ----
const bwin = $('#bwin'), bwinBody = $('#bwin-body');
let winId = 0;
const clampN = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const permalink = (p) => `<p class="permalink">Its own page: <code>#${p.slug}</code> in this prototype, <code>/${p.place ? 'projects' : 'field'}/${p.slug}</code> on the real site.</p>`;
function feedHtml(p) {
  const m = MORNING, row = (a, b) => `<li><span>${a}</span><span class="dim">${b}</span></li>`;
  if (p.feed === 'movies') return `<h3>Showtimes today</h3><ul class="list">${m.movies.map(([t, r, times]) => `<li><span>${t} <span class="dim">${r}</span></span><span class="times">${times.map((x) => `<span>${x}</span>`).join('')}</span></li>`).join('')}</ul>`;
  if (p.feed === 'comics') return `<h3>New this Wednesday</h3><ul class="list">${m.comics.map(([t, pub]) => row(t, pub)).join('')}</ul>`;
  return `<h3>Scores</h3><table class="board"><thead><tr><th scope="col">Team</th><th scope="col">Last game</th><th scope="col">Next</th></tr></thead><tbody>${m.sports.map(([team, last, next]) => `<tr><th scope="row">${team}</th><td>${last ? `<span class="res ${last[0].toLowerCase()}">${last[0]}</span> ${last[1]}` : '<span class="dim">No games</span>'}</td><td class="dim">${next}</td></tr>`).join('')}</tbody></table>`;
}
function pageHtml(p) {
  const head = `<div class="hero"><canvas width="128" height="128" data-icon="${p.id}"></canvas><div><b>${p.title}</b><p class="dim">${p.place ? `${p.place}, ${STATUS_PLACE[p.status]}` : p.feed ? 'Main Street' : 'Landmark'}</p><p>${p.place ? p.summary || 'No summary yet.' : p.note}</p></div></div>`;
  if (p.feed) return head + feedHtml(p) + '<p class="dim">Sample data until the real feeds are connected.</p>' + permalink(p);
  if (!p.place) return head + permalink(p);
  return `${head}<div class="spec"><dl><dt>Status</dt><dd><i class="lamp ${p.status}"></i>${STATUS_WORD[p.status]}</dd><dt>Stack</dt><dd>${p.stack.join(', ') || 'Not listed'}</dd><dt>Last activity</dt><dd>${ago(p.last)}</dd></dl></div>
  <h3>Screenshots</h3><div class="shots"><div>No screenshots yet</div><div></div><div></div></div>
  <h3>Devlog</h3><p class="dim">No notes yet. Short build notes will show up here as the project moves.</p>
  <div class="row"><a class="key" href="${p.repo}" target="_blank" rel="noopener">Open on GitHub</a></div>${permalink(p)}`;
}
function openBuilding(id) {
  const p = byId(id); if (!p) return;
  winId = id; $('#bwin-title').textContent = p.place || p.title;
  bwinBody.innerHTML = pageHtml(p); paintIcons(bwinBody); bwin.hidden = false; bwinBody.scrollTop = 0;
  if (innerWidth > 760) {
    const b = BOX[id], w = bwin.offsetWidth, h = bwin.offsetHeight; let x = (innerWidth - w) / 2, y = 72;
    if (b) { const bx = ((b.x0 + b.x1) / 2 + camX) * SC, by = (b.y0 + camY) * SC; x = bx + 48 + w < innerWidth - 16 ? bx + 48 : bx - 48 - w; y = by - 24; }
    bwin.style.left = clampN(x, 16, innerWidth - w - 16) + 'px'; bwin.style.top = clampN(y, 64, Math.max(64, innerHeight - h - 48)) + 'px';
  } else if (BOX[id]) { // phone: the sheet covers the bottom, so bring the building into the strip above it
    const b = BOX[id], top = document.getElementById('hud').getBoundingClientRect().bottom, cy = (top + bwin.getBoundingClientRect().top) / 2;
    panX = Math.round(innerWidth / 2 / SC - (b.x0 + b.x1) / 2 - (VW - WW) / 2); panY = Math.round(cy / SC - (b.y0 + b.y1) / 2 - (VH - WH) / 2 - 8); compose(); dirty = true;
  }
  if (location.hash.slice(1) !== p.slug) { try { location.hash = p.slug; } catch { /* hash routing unavailable */ } }
  marker = { id, until: performance.now() + 3000 }; sfx.select(); $('#bwin-close').focus();
}
function closeBuilding() {
  bwin.hidden = true; winId = 0;
  try { history.replaceState(null, '', location.pathname + location.search); } catch { /* keep the hash */ }
}
$('#bwin-close').addEventListener('click', closeBuilding);
let winDrag = null;
$('#bwin-bar').addEventListener('pointerdown', (e) => { if (innerWidth <= 760 || e.target.closest('button')) return; const r = bwin.getBoundingClientRect(); winDrag = { dx: e.clientX - r.left, dy: e.clientY - r.top }; e.currentTarget.setPointerCapture(e.pointerId); });
$('#bwin-bar').addEventListener('pointermove', (e) => { if (!winDrag) return; bwin.style.left = clampN(e.clientX - winDrag.dx, 0, innerWidth - 80) + 'px'; bwin.style.top = clampN(e.clientY - winDrag.dy, 0, innerHeight - 40) + 'px'; });
$('#bwin-bar').addEventListener('pointerup', () => { winDrag = null; });
addEventListener('hashchange', () => {
  const p = bySlug(location.hash.slice(1));
  if (p && p.id !== winId) { if (bootStage) startGame(); if (!pauseEl.hidden) closePause(true); openBuilding(p.id); }
  else if (!p && !bwin.hidden) bwin.hidden = true;
});

// ---- The field: hover, click, drag to pan, pinch or scroll to zoom ----
const pointers = new Map();
let drag = null, pinch = null, wheelAcc = 0;
cv.addEventListener('pointerdown', (e) => {
  if (bootStage) return; cv.setPointerCapture(e.pointerId); pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) }; drag = null; }
  else drag = { x: e.clientX, y: e.clientY, px: panX, py: panY, moved: false };
});
cv.addEventListener('pointermove', (e) => {
  if (pointers.has(e.pointerId)) pointers.set(e.pointerId, [e.clientX, e.clientY]);
  if (pinch && pointers.size === 2) {
    const [a, b] = [...pointers.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]), mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
    if (d / pinch.d > 1.3) { zoomAt(1, mx, my); pinch.d = d; } else if (d / pinch.d < 0.77) { zoomAt(-1, mx, my); pinch.d = d; }
    return;
  }
  if (drag) { const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 6) drag.moved = true; if (drag.moved) { panX = drag.px + dx / SC; panY = drag.py + dy / SC; compose(); dirty = true; return; } }
  if (bootStage || paused) return;
  const id = hitAt(e.clientX, e.clientY);
  if (id !== hoverId) { hoverId = id; cv.style.cursor = id ? 'pointer' : 'grab'; statusLabel.textContent = id ? describe(id) : TICKER[tickerI % TICKER.length]; }
});
function endPointer(e) {
  const wasPinch = !!pinch; pointers.delete(e.pointerId); if (pointers.size < 2) pinch = null;
  const d = drag; drag = null;
  if (wasPinch || !d || d.moved || bootStage || paused || e.type === 'pointercancel') return;
  const id = hitAt(e.clientX, e.clientY); if (id) openBuilding(id);
}
cv.addEventListener('pointerup', endPointer);
cv.addEventListener('pointercancel', endPointer);
cv.addEventListener('wheel', (e) => { e.preventDefault(); wheelAcc += e.deltaY; if (Math.abs(wheelAcc) > 80) { zoomAt(wheelAcc < 0 ? 1 : -1, e.clientX, e.clientY); wheelAcc = 0; } }, { passive: false });
$('#btn-zin').addEventListener('click', () => zoomAt(1));
$('#btn-zout').addEventListener('click', () => zoomAt(-1));
