
// ============ UI ============
const $ = (s) => document.querySelector(s);
const hud = $('#hud'), statusbar = $('#statusbar'), statusLabel = $('#status-label'), pauseEl = $('#pause'), pane = $('#pane');
const bootDos = $('#boot-dos'), bootText = $('#boot-text'), bootSetup = $('#boot-setup'), bootTitle = $('#boot-title'), skipBtn = $('#btn-skip'), dosq = $('#dosq');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const count = (st) => PROJECTS.filter((p) => p.status === st).length;
const shippedPct = () => Math.round((PROJECTS.filter((p) => p.status === 'live' || p.status === 'archived').length / PROJECTS.length) * 100);

// ---- Sound: synthesised, and only after the player picks a sound card ----
let AC = null, master = null;
function audioInit() { if (AC) return; try { AC = new (window.AudioContext || window.webkitAudioContext)(); master = AC.createGain(); master.connect(AC.destination); setVolume(); } catch { AC = null; } }
function setVolume() { if (master) master.gain.value = (S.volume / 10) * 0.22; }
function tone(f, d = 0.06, type = 'square', g = 0.25, when = 0) {
  if (!S.sound || !AC) return;
  const t0 = AC.currentTime + Math.max(0, when), o = AC.createOscillator(), v = AC.createGain();
  o.type = type; o.frequency.setValueAtTime(f, t0); v.gain.setValueAtTime(g, t0); v.gain.exponentialRampToValueAtTime(0.001, t0 + d);
  o.connect(v).connect(master); o.start(t0); o.stop(t0 + d + 0.02);
}
const sfx = {
  move: () => tone(660, 0.04), select: () => { tone(880, 0.05); tone(1320, 0.07, 'square', 0.2, 0.05); },
  pause: () => { tone(784, 0.07); tone(523, 0.1, 'square', 0.25, 0.07); }, resume: () => { tone(523, 0.07); tone(784, 0.1, 'square', 0.25, 0.07); },
  boot: () => [262, 330, 392, 523].forEach((f, i) => tone(f, 0.2, 'square', 0.16, i * 0.09)),
};
const BASS = [45, 45, 52, 45, 48, 48, 55, 48, 43, 43, 50, 43, 47, 47, 52, 52], LEAD = [69, 72, 76, 72, 67, 72, 76, 79, 67, 71, 74, 71, 64, 68, 71, 76];
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
let seqTimer = null, seqStep = 0, nextNote = 0;
function musicStart() {
  if (!S.sound) return false; audioInit(); if (!AC) return false; if (seqTimer) return true; AC.resume?.();
  nextNote = AC.currentTime + 0.05; seqStep = 0;
  seqTimer = setInterval(() => { while (nextNote < AC.currentTime + 0.12) { const s = seqStep % 16, at = nextNote - AC.currentTime; tone(mtof(BASS[s]), 0.22, 'triangle', 0.5, at); if (s % 2 === 0) tone(mtof(LEAD[s]), 0.13, 'square', 0.1, at); nextNote += 60 / 112 / 2; seqStep++; } }, 25);
  return true;
}
function musicStop() { clearInterval(seqTimer); seqTimer = null; }

// ---- HUD clock and status line ----
function tickHud() {
  const p = nowParts(), wx = weatherNow(), w = MORNING.weather;
  $('#hud-date').textContent = p.date; $('#hud-time').textContent = p.time;
  $('#hud-wx').innerHTML = `<em>Wx</em> ${wx === 'snow' ? 'Flurries' : wx === 'rain' ? 'Rain' : wx === 'cloud' ? 'Cloudy' : 'Clear'} ${w.now}°F`;
  $('#pause-meta').textContent = `${p.date} ${p.time} Detroit`;
}
const TICKER = [...MORNING.ticker, ...PROJECTS.filter((p) => p.status === 'building').map((p) => `${p.place}: ${p.title} is ${STATUS_PLACE[p.status]}`)];
let hoverId = 0, tickerI = 0;
function describe(id) { const p = byId(id); if (!p) return ''; return p.place ? `${p.place}: ${p.title} (${STATUS_PLACE[p.status]}). Click to open.` : `${p.title}: ${p.note}`; }
setInterval(() => { if (!hoverId && !statusbar.hidden) { statusLabel.textContent = TICKER[tickerI++ % TICKER.length]; } tickHud(); }, 5000);

// ---- Pause menu ----
let currentPane = 'overview', invFilter = 'all', invSel = 1, unlocked = false, vizRaf = 0;
function openPause(name = 'overview') {
  if (!paused) sfx.pause();
  paused = true; dirty = true; pauseEl.hidden = false; hud.inert = true; statusbar.inert = true; showPane(name);
  const first = pauseEl.querySelector(`.menu-item[data-pane="${name}"]`) || pauseEl.querySelector('.menu-item');
  first.focus();
}
function closePause(resume = true) {
  pauseEl.hidden = true; hud.inert = false; statusbar.inert = false; cancelAnimationFrame(vizRaf);
  if (resume) { paused = false; sfx.resume(); $('#btn-pause').focus(); }
}
function showPane(name) {
  currentPane = name;
  for (const b of pauseEl.querySelectorAll('.menu-item')) b.setAttribute('aria-current', String(b.dataset.pane === name));
  cancelAnimationFrame(vizRaf);
  ({ overview: paneOverview, map: paneMap, projects: paneProjects, inventory: paneInventory, status: paneStatus, jukebox: paneJukebox, options: paneOptions })[name]?.();
  pane.scrollTop = 0;
}
function paneOverview() {
  const p = nowParts(), pct = shippedPct();
  pane.innerHTML = `<div class="overview"><h3>Norbert Field</h3><p class="lede">${p.date}, ${p.time} in Detroit. The field is frozen while you look around.</p>
  <div class="cards"><section class="card bevel"><h4>The field</h4><p>${PROJECTS.length} buildings: ${count('building')} under construction, ${count('paused')} closed for now, ${count('archived')} retired. One empty lot is waiting for the next project.</p>
  <div class="meter" role="img" aria-label="Explored ${pct} percent"><i data-pct="${pct}"></i></div><p class="dim">Explored ${pct}%: the share of projects that shipped.</p></section>
  <section class="card bevel"><h4>Controls</h4><ul class="list"><li><span>Esc</span><span class="dim">Pause and resume</span></li><li><span>Arrow keys</span><span class="dim">Pan the field, move in menus</span></li><li><span>Click a building</span><span class="dim">Open its page</span></li><li><span>Scroll or + and −</span><span class="dim">Zoom</span></li><li><span>I and M</span><span class="dim">Inventory and Map</span></li></ul></section></div></div>`;
  pane.querySelectorAll('.meter i').forEach((el) => { el.style.width = el.dataset.pct + '%'; });
}
function paintIcons(root = pane) {
  for (const c of root.querySelectorAll('canvas[data-icon]')) {
    const src = ICONS[c.dataset.icon]; if (!src) continue; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.clearRect(0, 0, c.width, c.height);
    const s = Math.min(c.width / src.width, c.height / src.height), k = s >= 1 ? Math.floor(s) : s, w = src.width * k, h = src.height * k;
    g.drawImage(src, Math.round((c.width - w) / 2), Math.round((c.height - h) / 2), w, h);
  }
}
function specCard(p) {
  return `<article class="spec bevel"><canvas width="96" height="96" data-icon="${p.id}"></canvas><h4>${p.title}</h4><p class="lede">${p.summary || 'No summary yet.'}</p>
  <dl><dt>Status</dt><dd><i class="lamp ${p.status}"></i>${STATUS_WORD[p.status]}, ${STATUS_PLACE[p.status]}</dd><dt>Building</dt><dd>${p.place}</dd><dt>Stack</dt><dd>${p.stack.join(', ') || 'Not listed'}</dd><dt>Last activity</dt><dd>${ago(p.last)}</dd></dl>
  <div class="row"><a class="key" href="${p.repo}" target="_blank" rel="noopener">Open on GitHub</a><button class="key" type="button" data-open="${p.id}">Open its page</button><button class="key" type="button" data-show="${p.id}">Show on the field</button></div></article>`;
}
function paneProjects() {
  const counts = { all: PROJECTS.length }; for (const p of PROJECTS) counts[p.status] = (counts[p.status] || 0) + 1;
  const list = PROJECTS.filter((p) => invFilter === 'all' || p.status === invFilter);
  const sel = list.find((p) => p.id === invSel) || list[0];
  pane.innerHTML = `<h3>Projects</h3><p class="lede">Everything Norbert has built, and the building it lives in. Pick one for its spec sheet.</p>
  <div class="chips" role="group" aria-label="Filter by status">${['all', 'building', 'live', 'paused', 'archived'].filter((k) => counts[k]).map((k) => `<button class="key" type="button" data-filter="${k}" aria-pressed="${invFilter === k}">${k === 'all' ? 'All' : STATUS_WORD[k]} <span class="dim">${counts[k]}</span></button>`).join('')}</div>
  <div class="inv"><div class="slots">${list.map((p) => `<button class="slot" type="button" data-id="${p.id}" aria-pressed="${sel && sel.id === p.id}"><canvas width="72" height="72" data-icon="${p.id}"></canvas><span>${p.title}</span><span class="st"><i class="lamp ${p.status}"></i>${STATUS_WORD[p.status]}</span></button>`).join('')}
  <div class="slot"><canvas width="72" height="72" data-icon="13"></canvas><span>Empty lot</span><span class="st">Next project</span></div></div>${sel ? specCard(sel) : ''}</div>`;
  paintIcons();
  pane.querySelectorAll('[data-filter]').forEach((b) => b.addEventListener('click', () => { invFilter = b.dataset.filter; sfx.select(); paneProjects(); }));
  pane.querySelectorAll('.slot[data-id]').forEach((b) => b.addEventListener('click', () => { invSel = Number(b.dataset.id); sfx.select(); paneProjects(); pane.querySelector(`.slot[data-id="${invSel}"]`)?.focus(); }));
  wireShow();
  pane.querySelectorAll('[data-open]').forEach((b) => b.addEventListener('click', () => { closePause(true); openBuilding(Number(b.dataset.open)); }));
}
function wireShow() { pane.querySelectorAll('[data-show]').forEach((b) => b.addEventListener('click', () => showOnField(Number(b.dataset.show)))); }
function showOnField(id) {
  const b = BOX[id]; if (!b) return;
  panX = Math.round(VW / 2 - (b.x0 + b.x1) / 2 - (VW - WW) / 2); panY = Math.round(VH / 2 - (b.y0 + b.y1) / 2 - (VH - WH) / 2 - 8);
  compose(); dirty = true; marker = { id, until: performance.now() + 6000 }; closePause(true); hoverId = id; statusLabel.textContent = describe(id);
}
function paneMap() {
  const pct = shippedPct(), W = MINI.width, H = MINI.height;
  const pins = [...PROJECTS, ...LANDMARKS].filter((p) => BOX[p.id]).map((p) => { const b = BOX[p.id]; return `<button class="pin ${p.place ? 'proj' : ''}" type="button" data-show="${p.id}" aria-label="${p.place ? p.place + ': ' : ''}${p.title}" data-x="${((((b.x0 + b.x1) / 2 - MINI.x0) / MINI.s / W) * 100).toFixed(2)}" data-y="${((((b.y0 + b.y1) / 2 - MINI.y0) / MINI.s / H) * 100).toFixed(2)}"></button>`; }).join('');
  pane.innerHTML = `<h3>Map</h3><p class="lede">The whole town. Explored ${pct}%: the share of projects that shipped. Yellow pins are projects.</p>
  <div class="mapwrap"><div class="minimap"><canvas id="minimap" width="${W}" height="${H}" role="img" aria-label="Overview of the airfield and town"></canvas>${pins}</div>
  <ol class="legend">${[...PROJECTS, ...LANDMARKS].map((p) => `<li><button type="button" data-show="${p.id}"><i class="lamp ${p.status || 'archived'}"></i>${p.place ? `${p.place}: ${p.title}` : p.title}</button></li>`).join('')}</ol></div>`;
  $('#minimap').getContext('2d').drawImage(MINI, 0, 0);
  pane.querySelectorAll('.pin').forEach((el) => { el.style.left = el.dataset.x + '%'; el.style.top = el.dataset.y + '%'; });
  wireShow();
}
const PIX = {
  sun: '<rect x="2" y="2" width="4" height="4" fill="#f2c14e"/><rect x="3" y="0" width="2" height="1" fill="#f2c14e"/><rect x="3" y="7" width="2" height="1" fill="#f2c14e"/><rect x="0" y="3" width="1" height="2" fill="#f2c14e"/><rect x="7" y="3" width="1" height="2" fill="#f2c14e"/>',
  cloud: '<rect x="1" y="3" width="6" height="3" fill="#c7cbcf"/><rect x="2" y="2" width="3" height="1" fill="#c7cbcf"/>',
  snow: '<rect x="1" y="1" width="6" height="3" fill="#c7cbcf"/><rect x="2" y="0" width="3" height="1" fill="#c7cbcf"/><rect x="2" y="5" width="1" height="1" fill="#ffffff"/><rect x="5" y="6" width="1" height="1" fill="#ffffff"/><rect x="3" y="7" width="1" height="1" fill="#ffffff"/>',
  rain: '<rect x="1" y="1" width="6" height="3" fill="#c7cbcf"/><rect x="2" y="0" width="3" height="1" fill="#c7cbcf"/><rect x="2" y="5" width="1" height="2" fill="#5b8cff"/><rect x="5" y="5" width="1" height="2" fill="#5b8cff"/>',
};
const pixIcon = (k) => `<svg viewBox="0 0 8 8" shape-rendering="crispEdges" aria-hidden="true">${PIX[k]}</svg>`;
function paneStatus() {
  const w = MORNING.weather;
  pane.innerHTML = `<div class="row"><h3>Morning update</h3><span class="stamp">SAMPLE DATA</span></div><p class="lede">Public, and refreshed every morning. Every score, title and showtime below is made up for now, to show the layout before real feeds are connected.</p>
  <div class="cards">
  <section class="card bevel"><h4>Weather</h4><div class="temp">${pixIcon(w.sky)}<b>${w.now}°</b><div>${w.text}<br><span class="dim">High ${w.hi}°, low ${w.lo}°. Wind ${w.wind}</span></div></div>
  <div class="forecast">${w.days.map(([d, k, hi, lo]) => `<div>${d}${pixIcon(k)}${hi}° <span class="dim">${lo}°</span></div>`).join('')}</div></section>
  <section class="card bevel wide"><h4>Scores</h4><table class="board"><thead><tr><th scope="col">Team</th><th scope="col">Last game</th><th scope="col">Next</th></tr></thead><tbody>
  ${MORNING.sports.map(([team, last, next]) => `<tr><th scope="row">${team}</th><td>${last ? `<span class="res ${last[0].toLowerCase()}">${last[0]}</span> ${last[1]} ${last[2]}` : '<span class="dim">No games</span>'}</td><td class="dim">${next}</td></tr>`).join('')}</tbody></table></section>
  <section class="card bevel"><h4>New comics Wednesday</h4><ul class="list">${MORNING.comics.map(([t, pub]) => `<li><span>${t}</span><span class="dim">${pub}</span></li>`).join('')}</ul></section>
  <section class="card bevel"><h4>Emagine showtimes</h4><ul class="list">${MORNING.movies.map(([t, r, times]) => `<li><span>${t} <span class="dim">${r}</span></span><span class="times">${times.map((x) => `<span>${x}</span>`).join('')}</span></li>`).join('')}</ul></section></div>`;
}
function paneJukebox() {
  pane.innerHTML = `<h3>Jukebox</h3><p class="lede">Tower radio. It plays only if you chose the Sound Blaster at setup, or turned sound on in Options.</p>
  <div class="player bevel"><div class="pbar"><span>JUKEBOX.EXE</span><span>tower_radio.mod</span></div><canvas id="viz" width="160" height="40"></canvas>
  <div class="info"><b>Runway Lights</b><span class="dim">Norbert Sound Dept. Chiptune, 1995</span></div>
  <div class="controls"><button class="key" type="button" id="jb-play">Play</button><button class="key" type="button" id="jb-stop">Stop</button><span class="dim" id="jb-state" aria-live="polite">${seqTimer ? 'Playing' : 'Stopped'}</span></div></div>`;
  $('#jb-play').addEventListener('click', () => { $('#jb-state').textContent = musicStart() ? 'Playing' : 'Sound is off. Turn it on in Options.'; });
  $('#jb-stop').addEventListener('click', () => { musicStop(); $('#jb-state').textContent = 'Stopped'; });
  const vz = $('#viz').getContext('2d');
  const draw = (t) => { vz.fillStyle = '#050912'; vz.fillRect(0, 0, 160, 40); for (let i = 0; i < 20; i++) { const h = seqTimer ? 4 + Math.round(Math.abs(Math.sin(t / 180 + i * 1.7 + seqStep * 0.6)) * 30) : 2; vz.fillStyle = i % 5 === 4 ? '#ef6a55' : '#f2c14e'; for (let y = 0; y < h; y += 3) vz.fillRect(i * 8 + 1, 38 - y, 6, 2); } vizRaf = requestAnimationFrame(draw); };
  vizRaf = requestAnimationFrame(draw);
}
function paneOptions() {
  const sel = (id, opts, val) => `<select id="${id}">${opts.map(([v, t]) => `<option value="${v}"${v === val ? ' selected' : ''}>${t}</option>`).join('')}</select>`;
  pane.innerHTML = `<h3>Options</h3><p class="lede">The control panel. Detail and speed double as your motion settings.</p><div class="opts">
  <label for="o-speed">Game speed</label><input type="range" id="o-speed" min="0.5" max="4" step="0.5" value="${S.speed}">
  <label for="o-detail">Detail</label>${sel('o-detail', [['full', 'Full'], ['low', 'Low'], ['off', 'Off, no motion']], S.detail)}
  <label for="o-sound">Sound</label>${sel('o-sound', [['on', 'Sound Blaster 16'], ['off', 'No sound']], S.sound ? 'on' : 'off')}
  <label for="o-volume">Volume</label><input type="range" id="o-volume" min="0" max="10" step="1" value="${S.volume}">
  <label for="o-time">Time of day</label>${sel('o-time', [['auto', 'Real time in Detroit'], ['dawn', 'Dawn'], ['day', 'Midday'], ['dusk', 'Dusk'], ['night', 'Night'], ['custom', 'Pick an hour']], S.time)}
  <label for="o-hour">Hour</label><input type="range" id="o-hour" min="0" max="23.9" step="0.1" value="${S.hour}"${S.time === 'custom' ? '' : ' disabled'}>
  <label for="o-weather">Weather</label>${sel('o-weather', [['auto', 'Live (sample: flurries)'], ['clear', 'Clear'], ['cloud', 'Cloudy'], ['rain', 'Rain'], ['snow', 'Snow']], S.weather)}
  <label for="o-season">Season</label>${sel('o-season', [['auto', 'Real season'], ['spring', 'Spring'], ['summer', 'Summer'], ['fall', 'Fall'], ['latefall', 'Late fall'], ['winter', 'Winter']], S.season)}
  <label for="o-dof">Depth blur</label>${sel('o-dof', [['on', 'On'], ['off', 'Off']], S.dof ? 'on' : 'off')}
  </div><p class="row"><button class="key" type="button" id="o-replay">Replay the intro</button></p>`;
  const on = (id, fn) => $(id).addEventListener('input', (e) => { fn(e.target.value); dirty = true; sfx.move(); });
  on('#o-speed', (v) => { S.speed = Number(v); }); on('#o-detail', (v) => { S.detail = v; });
  on('#o-sound', (v) => { S.sound = v === 'on'; if (S.sound) audioInit(); else musicStop(); }); on('#o-volume', (v) => { S.volume = Number(v); setVolume(); });
  on('#o-time', (v) => { S.time = v; $('#o-hour').disabled = v !== 'custom'; }); on('#o-hour', (v) => { S.hour = Number(v); }); on('#o-dof', (v) => { S.dof = v === 'on'; }); on('#o-weather', (v) => { S.weather = v; setupSky(); tickHud(); });
  on('#o-season', (v) => { S.season = v; rebuildWorld(); });
  $('#o-replay').addEventListener('click', () => { closePause(false); paused = false; hud.hidden = statusbar.hidden = true; boot(); });
}

// ---- Quit to DOS: the plain, fast version of the site ----
function projectsTxt() {
  const rows = PROJECTS.map((p) => `${p.title.padEnd(20)}${STATUS_WORD[p.status].padEnd(11)}${(p.stack.join(', ') || '-').padEnd(23)}${ago(p.last)}`);
  return `NORBERT builds software and hardware: web apps, games, a Raspberry Pi\nflight tracker and a vending business.\n\n${'PROJECT'.padEnd(20)}${'STATUS'.padEnd(11)}${'STACK'.padEnd(23)}LAST ACTIVITY\n${rows.join('\n')}\n\nSource for each project: github.com/norbert586\n`;
}
const DOS_CMDS = {
  HELP: () => 'DIR         List files\nTYPE <file> Show a file\nCLS         Clear the screen\nVER         Show the version\nNORBERT     Start the game again\n',
  DIR: () => ' Volume in drive C is NORBERT\n Directory of C:\\GAMES\\NORBERT\n\nNORBERT  EXE    586,586  11-08-95\nPROJECTS TXT      4,096  11-08-95\nREADME   TXT      1,024  11-08-95\n',
  'TYPE PROJECTS.TXT': projectsTxt,
  'TYPE README.TXT': () => 'This is the plain version of the site, for when you just want the facts.\nEverything important is in PROJECTS.TXT.\n',
  VER: () => 'N-DOS Version 5.86\n',
};
function dosPrint(s) { const out = $('#dosq-out'); out.textContent += s; out.scrollTop = out.scrollHeight; }
function quitToDos() {
  closePause(false); musicStop(); hud.hidden = statusbar.hidden = true; dosq.hidden = false;
  $('#dosq-out').textContent = ''; dosPrint(`Thank you for playing NORBERT FIELD.\n\nC:\\GAMES\\NORBERT>TYPE PROJECTS.TXT\n\n${projectsTxt()}\nType HELP for commands, or NORBERT to play again.\n\n`);
  $('#dosq-in').focus();
}
function leaveDos() { dosq.hidden = true; hud.hidden = statusbar.hidden = false; paused = false; dirty = true; sfx.resume(); $('#btn-pause').focus(); }
$('#dosq-form').addEventListener('submit', (e) => {
  e.preventDefault(); const input = $('#dosq-in'), cmd = input.value.trim().toUpperCase(); input.value = '';
  dosPrint(`C:\\GAMES\\NORBERT>${cmd}\n`);
  if (!cmd) return; if (cmd === 'CLS') { $('#dosq-out').textContent = ''; return; }
  if (['NORBERT', 'NORBERT.EXE', 'EXIT', 'WIN'].includes(cmd)) { leaveDos(); return; }
  dosPrint((DOS_CMDS[cmd] ? DOS_CMDS[cmd]() : 'Bad command or file name\n') + '\n');
});
$('#btn-back').addEventListener('click', leaveDos);

// ---- Boot: DOS, sound setup, title ----
let bootStage = null, soundChoice = 'on';
async function typeLine(text) { for (const ch of text) { if (bootStage !== 'dos') return; bootText.textContent += ch; await wait(16); } bootText.textContent += '\n'; }
async function boot() {
  if (reducedMotion) { startGame(true); return; }
  skipBtn.hidden = false; bootStage = 'dos'; bootDos.hidden = false; bootText.textContent = '';
  for (const l of ['Starting N-DOS...', '', 'C:\\>CD GAMES\\NORBERT', 'C:\\GAMES\\NORBERT>NORBERT.EXE', '', 'Loading NORBERT FIELD', 'Checking runway lights... ok', 'Counting corn rows... ok', 'Fueling the 172... ok', '']) {
    if (bootStage !== 'dos') return; await typeLine(l);
  }
  await wait(250); if (bootStage === 'dos') showSetup();
}
function showSetup() { bootDos.hidden = true; bootSetup.hidden = false; bootStage = 'setup'; selectSound(soundChoice); }
function selectSound(v) { soundChoice = v; for (const b of bootSetup.querySelectorAll('[data-sound]')) b.setAttribute('aria-selected', String(b.dataset.sound === v)); bootSetup.querySelector(`[data-sound="${v}"]`).focus(); }
function confirmSound() { S.sound = soundChoice === 'on'; if (S.sound) { audioInit(); sfx.boot(); } bootSetup.hidden = true; bootTitle.hidden = false; bootStage = 'title'; }
bootSetup.querySelectorAll('[data-sound]').forEach((b) => b.addEventListener('click', () => { selectSound(b.dataset.sound); confirmSound(); }));
bootTitle.addEventListener('click', () => startGame());
skipBtn.addEventListener('click', () => startGame());
function startGame(pausedStart = false) {
  bootStage = null; bootDos.hidden = bootSetup.hidden = bootTitle.hidden = skipBtn.hidden = true;
  hud.hidden = statusbar.hidden = false; statusLabel.textContent = TICKER[0]; tickHud();
  if (pausedStart) openPause('overview'); else { paused = false; dirty = true; $('#btn-pause').focus(); }
}

// ---- Input ----
pauseEl.querySelectorAll('.menu-item').forEach((b) => b.addEventListener('click', () => {
  const name = b.dataset.pane; sfx.select();
  if (name === 'resume') closePause(true); else if (name === 'quit') quitToDos(); else showPane(name);
}));
$('#btn-resume').addEventListener('click', () => closePause(true));
$('#btn-pause').addEventListener('click', () => openPause('overview'));
$('#btn-items').addEventListener('click', () => openPause('projects'));
$('#btn-map').addEventListener('click', () => openPause('map'));
addEventListener('keydown', (e) => {
  if (bootStage === 'dos' || bootStage === 'title') { if (['Shift', 'Control', 'Alt', 'Meta', 'Tab'].includes(e.key)) return; e.preventDefault(); if (bootStage === 'dos') showSetup(); else startGame(); return; }
  if (bootStage === 'setup') { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); selectSound(soundChoice === 'on' ? 'off' : 'on'); } else if (e.key === 'Enter') { e.preventDefault(); confirmSound(); } return; }
  if (!dosq.hidden) return;
  if (!pauseEl.hidden) {
    if (e.key === 'Escape') { e.preventDefault(); closePause(true); return; }
    const items = [...pauseEl.querySelectorAll('.menu-item')], i = items.indexOf(document.activeElement);
    if (i >= 0 && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) { e.preventDefault(); items[(i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length].focus(); sfx.move(); }
    return;
  }
  if (e.key === 'Escape' && !bwin.hidden) { e.preventDefault(); closeBuilding(); return; }
  if (e.key === '+' || e.key === '=') { zoomAt(1); return; } if (e.key === '-' || e.key === '_') { zoomAt(-1); return; }
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') { e.preventDefault(); openPause('overview'); }
  else if (e.key === 'i' || e.key === 'I') openPause('inventory');
  else if (e.key === 'm' || e.key === 'M') openPause('map');
  else if (e.key.startsWith('Arrow')) { e.preventDefault(); const d = 14; panX += e.key === 'ArrowLeft' ? d : e.key === 'ArrowRight' ? -d : 0; panY += e.key === 'ArrowUp' ? d : e.key === 'ArrowDown' ? -d : 0; compose(); }
});
let rz = 0; addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(resize, 120); });

