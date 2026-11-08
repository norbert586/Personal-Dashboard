
// ============ Materials ============
// Each material is a short ramp (dark to light) with hue shifting: cool shadows, warm lights.
// A palette entry exists per (material level, face). Faces: 0 top, 1 wall facing +y (west),
// 2 wall facing +x (south), 3-6 roof slopes. Light is applied per face every frame.
const MAT = [], MATIDX = {}, PAL = [], META = [];
const FIDX = new Int32Array(1024 * 8).fill(-1);
function mat(name, hexes, o = {}) { MATIDX[name] = MAT.length; MAT.push({ name, hexes: hexes.slice(), ground: !!o.ground, emit: o.emit || null, cyc: !!o.cyc }); }
const nightK = (LS) => smooth(0.3, 0.85, LS.night);
const glowMat = (dayRGB, nightRGB) => (lv, LS) => mix3(dayRGB[lv], nightRGB[lv], nightK(LS));

// ground
mat('grass', ['#3d5a2b', '#4f7233', '#678a3d', '#86a64c'], { ground: 1 });
mat('turf', ['#2f6a2a', '#3c8234', '#4c9a3f', '#62b04e'], { ground: 1 });
mat('dirt', ['#3a2a21', '#563d2e', '#735440'], { ground: 1 });
mat('gravel', ['#6a6358', '#877f71', '#a39a89', '#bdb4a1'], { ground: 1 });
mat('asph', ['#23262b', '#2e3238', '#3a3f47', '#4a5059'], { ground: 1 });
mat('conc', ['#686a67', '#83847d', '#a0a098', '#bab9af'], { ground: 1 });
mat('walk', ['#8a8b85', '#a6a79f', '#c2c2b8', '#d8d7cb'], { ground: 1 });
mat('paintW', ['#c9cac2', '#ecece2'], { ground: 1 });
mat('paintY', ['#bf8f26', '#e3b738'], { ground: 1 });
mat('mulch', ['#35251b', '#4c3626', '#654833'], { ground: 1 });
mat('crop', ['#a8822e', '#bb9436', '#cfa740', '#e0ba4e', '#cfa740', '#bb9436'], { ground: 1, cyc: 1 });
mat('soy', ['#8a8a30', '#a29a38', '#bba842', '#d0b84e', '#bba842', '#a29a38'], { ground: 1, cyc: 1 });
mat('stub', ['#8a7648', '#a38c58', '#bda26c'], { ground: 1 });
mat('plow', ['#3a2a20', '#523a2c', '#6c4e3a'], { ground: 1 });
// walls
mat('brickR', ['#5d2a24', '#7a3a30', '#97493b', '#b2604d']);
mat('brickY', ['#8f7d4d', '#a99560', '#c4ae74', '#ddc88e']);
mat('brickB', ['#4a3027', '#634238', '#7e5a4b', '#98715f']);
mat('mortar', ['#6f6a62', '#8f897e']);
mat('sidW', ['#8e929a', '#b4b8be', '#d5d8dc', '#ecedf0']);
mat('sidB', ['#4b5d72', '#627890', '#7d94ab', '#9cb2c6']);
mat('sidY', ['#a08a55', '#bfa86c', '#d9c487', '#ecdca3']);
mat('sidG', ['#56675a', '#6f8573', '#8aa28d', '#a8bfaa']);
mat('sidR', ['#5a2420', '#7b3029', '#9b3e33', '#b9503f']);
mat('stucco', ['#8c7f6a', '#a99b84', '#c5b79f', '#ddd0b8']);
mat('cmu', ['#6b6d6a', '#85867f', '#a0a099', '#b8b7ae']);
mat('tin', ['#4d5a68', '#66788a', '#8396a8', '#a4b6c6']);
mat('trim', ['#8d9199', '#b8bcc3', '#e2e4e8']);
mat('steel', ['#3c4450', '#58626f', '#77828f', '#a0abb7']);
mat('dark', ['#14161a', '#1e2127', '#2a2e36']);
mat('red', ['#6e1b1e', '#a62c2a', '#cf3d36']);
mat('orange', ['#a8501c', '#d6742a', '#f09a46']);
mat('wood', ['#4a3322', '#6a4a32', '#8a6444']);
mat('doorR', ['#5a1f20', '#7e2c2c', '#a03a37']);
mat('doorB', ['#233a5a', '#31527c', '#436ca0']);
mat('glass', ['#223245', '#3a5878', '#6c93b8']);
mat('awnR', ['#7a1f24', '#a52a2e', '#d1423f', '#e8e6da']);
mat('awnG', ['#1f4a30', '#2c6a42', '#3d8a58', '#e8e6da']);
mat('awnB', ['#1f3a66', '#2c528f', '#3d6cb5', '#e8e6da']);
// roofs
mat('shG', ['#34373f', '#464a54', '#5a5f6b', '#727888']);
mat('shB', ['#3a2c26', '#4f3c33', '#684f42', '#836656']);
mat('shR', ['#4a2224', '#652d2e', '#823a37', '#a14a42']);
mat('shN', ['#2c3a34', '#3b4f45', '#4f6a5c', '#668574']);
mat('metalR', ['#4a5663', '#627284', '#7e90a3', '#9db0c2']);
mat('flatR', ['#3a3d42', '#4c4f55', '#60646c', '#777c85']);
// foliage
mat('leafA', ['#7e3c1c', '#aa5a26', '#d08433', '#ecb14c']);
mat('leafB', ['#6a2218', '#8f3220', '#b54a2a', '#d46a38']);
mat('leafC', ['#8a7a22', '#b09a30', '#d4bc44', '#efd864']);
mat('shrub', ['#233f20', '#31592a', '#437534', '#5a9142']);
mat('pine', ['#13291d', '#1c3d2b', '#285539', '#386f4c']);
mat('trunk', ['#2b1f17', '#46321f', '#5e452c']);
// emissive and lit-at-night
mat('glassLit', ['#46566a', '#62768c', '#8aa0b6'], { emit: glowMat([[70, 84, 100], [98, 116, 136], [132, 152, 172]], [[205, 140, 70], [255, 196, 108], [255, 232, 168]]) });
mat('neonR', ['#7a2a2a', '#c84a4a'], { emit: glowMat([[120, 60, 60], [170, 84, 84]], [[200, 50, 50], [255, 110, 100]]) });
mat('neonB', ['#2a4a7a', '#4a86c8'], { emit: glowMat([[60, 84, 120], [84, 120, 170]], [[50, 110, 220], [120, 190, 255]]) });
mat('neonY', ['#7a6a2a', '#c8b04a'], { emit: glowMat([[120, 108, 60], [170, 150, 84]], [[220, 170, 40], [255, 224, 110]]) });
mat('lampLit', ['#8a8470', '#c0b890'], { emit: glowMat([[138, 132, 112], [192, 184, 144]], [[255, 170, 70], [255, 226, 150]]) });
mat('rwyL', ['#8a8a80'], { emit: (lv, LS) => mix3([138, 138, 128], [255, 244, 208], nightK(LS)) });
mat('twyL', ['#6a76a0'], { emit: (lv, LS) => mix3([100, 110, 130], [70, 120, 255], nightK(LS)) });
mat('thrG', ['#6a8a6a'], { emit: (lv, LS) => mix3([100, 120, 100], [90, 255, 130], nightK(LS)) });
mat('beacon', ['#3a4a3a', '#4a4a44'], { emit: (lv, LS, t) => { const on = Math.floor(t / 1.2) % 2 === lv; return on && LS.night > 0.3 ? (lv ? [255, 251, 232] : [61, 255, 110]) : [60, 66, 60]; } });
mat('rabbit', ['#55554c', '#55554c', '#55554c', '#55554c', '#55554c'], { emit: (lv, LS, t) => (LS.night > 0.3 && Math.floor(t * 8) % 8 === 4 - lv ? [255, 255, 255] : [66, 66, 60]) });
mat('radarL', ['#5a2020'], { emit: (lv, LS, t) => (LS.night > 0.2 && Math.floor(t) % 2 === 0 ? [255, 58, 42] : [90, 30, 30]) });
const M = {}; MAT.forEach((m, i) => { M[m.name] = i * 8; });

// Palette entries are allocated lazily per (token, face), so only used combinations exist.
function pix(t, f = 0) {
  const top = MAT[t >> 3].hexes.length - 1; if ((t & 7) > top) t = (t & ~7) | top;
  const k = t * 8 + f; let i = FIDX[k]; if (i >= 0) return i;
  i = PAL.length; PAL.push(0); META.push({ m: t >> 3, lv: t & 7, f }); FIDX[k] = i; return i;
}

// ============ Seasons ============
const SEASONS = {
  spring: { grass: ['#3b6a2c', '#4e8636', '#66a041', '#88bf56'], turf: ['#33702e', '#418a38', '#52a244', '#6ab855'], leafA: ['#4a7a35', '#5f9644', '#7cb257', '#a2cd72'], leafB: ['#5a8a3a', '#74a84c', '#92c464', '#b4dc82'], leafC: ['#6a9a3a', '#88b84a', '#a8d460', '#c8ec84'], shrub: ['#2c4e24', '#3d6a30', '#548a3e', '#74aa52'], pine: ['#13291d', '#1c3d2b', '#285539', '#386f4c'], crop: ['#3e5f28', '#4b7230', '#5a8838', '#6c9f43', '#5a8838', '#4b7230'], soy: ['#4a5a2c', '#5a6e34', '#6c8440', '#80984c', '#6c8440', '#5a6e34'], stub: ['#7a6a44', '#94845a', '#ac9c70'], plow: ['#4a3426', '#654736', '#815c47'], walk: ['#8a8b85', '#a6a79f', '#c2c2b8', '#d8d7cb'] },
  summer: { grass: ['#34602a', '#447a33', '#5a9440', '#78b04f'], turf: ['#2f6a2a', '#3c8234', '#4c9a3f', '#62b04e'], leafA: ['#2f5429', '#3f6e33', '#548a3f', '#72a653'], leafB: ['#2a4a2a', '#386234', '#4a7e40', '#659a52'], leafC: ['#335a2a', '#457534', '#5d9040', '#7bac50'], shrub: ['#233f20', '#31592a', '#437534', '#5a9142'], pine: ['#13291d', '#1c3d2b', '#285539', '#386f4c'], crop: ['#4a7a2c', '#5b9234', '#6fab3e', '#84c24a', '#6fab3e', '#5b9234'], soy: ['#3f6a2a', '#4f8232', '#629a3c', '#78b24a', '#629a3c', '#4f8232'], stub: ['#8aa23a', '#a0b84a', '#b8cf5e'], plow: ['#3a2a20', '#523a2c', '#6c4e3a'], walk: ['#8a8b85', '#a6a79f', '#c2c2b8', '#d8d7cb'] },
  fall: { grass: ['#4b5f2b', '#62762f', '#7b8c3a', '#97a548'], turf: ['#3a6a2c', '#49803a', '#5a9647', '#70ac58'], leafA: ['#7e3c1c', '#aa5a26', '#d08433', '#ecb14c'], leafB: ['#6a2218', '#8f3220', '#b54a2a', '#d46a38'], leafC: ['#8a7a22', '#b09a30', '#d4bc44', '#efd864'], shrub: ['#3a3f20', '#505a2a', '#68733a', '#828f4a'], pine: ['#13291d', '#1c3d2b', '#285539', '#386f4c'], crop: ['#a8822e', '#bb9436', '#cfa740', '#e0ba4e', '#cfa740', '#bb9436'], soy: ['#8a8a30', '#a29a38', '#bba842', '#d0b84e', '#bba842', '#a29a38'], stub: ['#8a7648', '#a38c58', '#bda26c'], plow: ['#3a2a20', '#523a2c', '#6c4e3a'], walk: ['#8a8b85', '#a6a79f', '#c2c2b8', '#d8d7cb'] },
  latefall: { grass: ['#4a4f2e', '#5e6334', '#767a3e', '#8e9048'], turf: ['#456a38', '#548240', '#659a4c', '#7aae5d'], leafA: ['#5a3a24', '#7a4a2a', '#9c6232', '#c08a40'], leafB: ['#4e2a22', '#693a2c', '#874d36', '#a5663f'], leafC: ['#6a5a2a', '#867236', '#a28b44', '#bda556'], shrub: ['#35341f', '#4a4a2a', '#5e5e36', '#757442'], pine: ['#13291d', '#1c3d2b', '#285539', '#386f4c'], crop: ['#6e5a34', '#7d6a3c', '#8f7b46', '#a28d52', '#8f7b46', '#7d6a3c'], soy: ['#665c36', '#766a3e', '#887b48', '#9a8c54', '#887b48', '#766a3e'], stub: ['#6b5e44', '#84735a', '#9c8a6c'], plow: ['#3a2a20', '#523a2c', '#6c4e3a'], walk: ['#8a8b85', '#a6a79f', '#c2c2b8', '#d8d7cb'] },
  winter: { grass: ['#9eadbb', '#bccad6', '#d9e3ec', '#f2f7fb'], turf: ['#9eadbb', '#bccad6', '#d9e3ec', '#f2f7fb'], leafA: ['#3a312c', '#4f443e', '#6f635b', '#aab7c2'], leafB: ['#3a312c', '#4f443e', '#6f635b', '#aab7c2'], leafC: ['#3a312c', '#4f443e', '#6f635b', '#aab7c2'], shrub: ['#4a4338', '#645a4e', '#82776a', '#b8c3cc'], pine: ['#17302a', '#264a40', '#43695c', '#c5d3dc'], crop: ['#c9d4de', '#dce5ec', '#eef3f7', '#f8fbfd', '#eef3f7', '#dce5ec'], soy: ['#c3cdd6', '#d8e1e8', '#eaf0f4', '#f6f9fb', '#eaf0f4', '#d8e1e8'], stub: ['#bfcad4', '#d8e1e8', '#edf2f6'], plow: ['#7c8892', '#aab4be', '#d8e0e7'], walk: ['#a8b3bd', '#c6d0d8', '#dfe6ec', '#eef3f6'] },
};
function applySeason(season) {
  for (const [name, hexes] of Object.entries(SEASONS[season])) MAT[MATIDX[name]].hexes = hexes.slice();
  for (const m of MAT) m.rgb = m.hexes.map(hex);
}

// ============ Lighting: the real sun, sky and weather become per-face colour ============
const NORM = [[0, 0, 1], [0, 1, 0], [1, 0, 0], [0, 0.87, 0.5], [0.87, 0, 0.5], [0, -0.87, 0.5], [-0.87, 0, 0.5]];
let LS = null;
function lighting(date, wx) {
  const rad = Math.PI / 180, s = sunPos(date), el = s.el;
  const day = smooth(-4, 9, el), up = Math.max(0, Math.sin(el * rad)), low = 1 - smooth(3, 32, el);
  const sunK = { clear: 1, cloud: 0.42, rain: 0.2, snow: 0.26 }[wx] ?? 1;
  const twi = day > 0.02 && day < 0.98 ? Math.max(0, 1 - Math.abs(day * 2 - 1)) : 0;
  let sky = mix3([0.22, 0.29, 0.5], [0.64, 0.7, 0.82], day);
  sky = mix3(sky, [0.66, 0.5, 0.5], twi * 0.5);
  if (wx !== 'clear') sky = mix3(sky, [0.7, 0.74, 0.8].map((v) => v * (0.3 + 0.7 * day)), 0.5);
  const sunCol = mix3([1.35, 0.82, 0.5], [1.08, 1.02, 0.92], 1 - low);
  const I = 0.78 * day * sunK * Math.min(1, up * 1.4 + 0.2);
  const az = s.az * rad, cel = Math.cos(el * rad);
  const d = [-Math.cos(az) * cel, -Math.sin(az) * cel, up];
  const F = NORM.map((n, fi) => {
    let dot = Math.max(0, n[0] * d[0] + n[1] * d[1] + n[2] * d[2]); if (fi === 0) dot = Math.max(dot, 0.5 * Math.min(1, day * 1.3)); const k = 0.76 + 0.24 * n[2];
    return [sky[0] * k + sunCol[0] * I * dot, sky[1] * k + sunCol[1] * I * dot, sky[2] * k + sunCol[2] * I * dot];
  });
  return { s, d, I, sky, sunCol, day, night: 1 - day, F, Fs: sky.map((v) => v * 0.88), desat: wx === 'clear' ? 0 : 0.1, wx };
}
// Light for an arbitrary normal, used by moving sprites so they match the world.
function lightFor(nx, ny, nz) {
  const dot = Math.max(0, nx * LS.d[0] + ny * LS.d[1] + nz * LS.d[2]), k = 0.76 + 0.24 * nz;
  return [LS.sky[0] * k + LS.sunCol[0] * LS.I * dot, LS.sky[1] * k + LS.sunCol[1] * LS.I * dot, LS.sky[2] * k + LS.sunCol[2] * LS.I * dot];
}
const pal32 = new Uint32Array(8192), palSh = new Uint32Array(8192);
function buildPalette(t) {
  const live = S.detail !== 'off', shift = live ? Math.floor(t * 1.6) : 0;
  for (let i = 0; i < META.length; i++) {
    const e = META[i], m = MAT[e.m]; let r, g, b;
    if (m.emit) { [r, g, b] = m.emit(e.lv, LS, live ? t : 0); pal32[i] = palSh[i] = pack(r, g, b); continue; }
    const base = m.rgb[m.cyc ? (e.lv + shift) % m.rgb.length : e.lv], F = LS.F[e.f];
    r = base[0] * F[0]; g = base[1] * F[1]; b = base[2] * F[2];
    if (LS.desat) { const y = 0.3 * r + 0.59 * g + 0.11 * b; r += (y - r) * LS.desat; g += (y - g) * LS.desat; b += (y - b) * LS.desat; }
    pal32[i] = pack(r, g, b);
    if (m.ground) {
      r = base[0] * LS.Fs[0]; g = base[1] * LS.Fs[1]; b = base[2] * LS.Fs[2];
      if (LS.desat) { const y = 0.3 * r + 0.59 * g + 0.11 * b; r += (y - r) * LS.desat; g += (y - g) * LS.desat; b += (y - b) * LS.desat; }
      palSh[i] = pack(r, g, b);
    } else palSh[i] = pal32[i];
  }
}
