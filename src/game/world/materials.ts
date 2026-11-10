/**
 * Materials: each is a short colour ramp, dark to light, with cool shadows and warm highlights
 * (DESIGN: Principles). A token is `M[name] + level`, so painters return plain numbers and one
 * texture atlas can hold every surface. Seasons swap the ramps of the ground and the foliage.
 */

export type RGB = readonly [number, number, number];
/** Emissive colour at a level, for a night strength (0 day to 1 night) and a time in seconds. */
export type Emit = (lv: number, night: number, t: number) => RGB;

export const hex = (h: string): RGB => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
export const smooth = (a: number, b: number, x: number): number => {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};
export const mix3 = (a: RGB, b: RGB, t: number): RGB => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
  a[2] + (b[2] - a[2]) * t,
];
/** How far the night layer has faded in, from the sky's darkness (0 to 1). */
export const nightK = (night: number): number => smooth(0.3, 0.85, night);

const glow =
  (day: RGB[], night: RGB[]): Emit =>
  (lv, n) =>
    mix3(day[lv] ?? day[0]!, night[lv] ?? night[0]!, nightK(n));

interface MatDef {
  hexes: string[];
  ground?: boolean;
  emit?: Emit;
}

const DEFS = {
  // ground
  grass: { hexes: ['#3d5a2b', '#4f7233', '#678a3d', '#86a64c'], ground: true },
  turf: { hexes: ['#2f6a2a', '#3c8234', '#4c9a3f', '#62b04e'], ground: true },
  dirt: { hexes: ['#3a2a21', '#563d2e', '#735440'], ground: true },
  gravel: { hexes: ['#6a6358', '#877f71', '#a39a89', '#bdb4a1'], ground: true },
  asph: { hexes: ['#23262b', '#2e3238', '#3a3f47', '#4a5059'], ground: true },
  conc: { hexes: ['#686a67', '#83847d', '#a0a098', '#bab9af'], ground: true },
  walk: { hexes: ['#8a8b85', '#a6a79f', '#c2c2b8', '#d8d7cb'], ground: true },
  paintW: { hexes: ['#c9cac2', '#ecece2'], ground: true },
  paintY: { hexes: ['#bf8f26', '#e3b738'], ground: true },
  mulch: { hexes: ['#35251b', '#4c3626', '#654833'], ground: true },
  crop: { hexes: ['#a8822e', '#bb9436', '#cfa740', '#e0ba4e', '#cfa740', '#bb9436'], ground: true },
  soy: { hexes: ['#8a8a30', '#a29a38', '#bba842', '#d0b84e', '#bba842', '#a29a38'], ground: true },
  stub: { hexes: ['#8a7648', '#a38c58', '#bda26c'], ground: true },
  plow: { hexes: ['#3a2a20', '#523a2c', '#6c4e3a'], ground: true },
  // walls
  brickR: { hexes: ['#5d2a24', '#7a3a30', '#97493b', '#b2604d'] },
  brickY: { hexes: ['#8f7d4d', '#a99560', '#c4ae74', '#ddc88e'] },
  brickB: { hexes: ['#4a3027', '#634238', '#7e5a4b', '#98715f'] },
  mortar: { hexes: ['#6f6a62', '#8f897e'] },
  sidW: { hexes: ['#8e929a', '#b4b8be', '#d5d8dc', '#ecedf0'] },
  sidB: { hexes: ['#4b5d72', '#627890', '#7d94ab', '#9cb2c6'] },
  sidY: { hexes: ['#a08a55', '#bfa86c', '#d9c487', '#ecdca3'] },
  sidG: { hexes: ['#56675a', '#6f8573', '#8aa28d', '#a8bfaa'] },
  sidR: { hexes: ['#5a2420', '#7b3029', '#9b3e33', '#b9503f'] },
  stucco: { hexes: ['#8c7f6a', '#a99b84', '#c5b79f', '#ddd0b8'] },
  cmu: { hexes: ['#6b6d6a', '#85867f', '#a0a099', '#b8b7ae'] },
  tin: { hexes: ['#4d5a68', '#66788a', '#8396a8', '#a4b6c6'] },
  trim: { hexes: ['#8d9199', '#b8bcc3', '#e2e4e8'] },
  steel: { hexes: ['#3c4450', '#58626f', '#77828f', '#a0abb7'] },
  dark: { hexes: ['#14161a', '#1e2127', '#2a2e36'] },
  red: { hexes: ['#6e1b1e', '#a62c2a', '#cf3d36'] },
  orange: { hexes: ['#a8501c', '#d6742a', '#f09a46'] },
  wood: { hexes: ['#4a3322', '#6a4a32', '#8a6444'] },
  doorR: { hexes: ['#5a1f20', '#7e2c2c', '#a03a37'] },
  doorB: { hexes: ['#233a5a', '#31527c', '#436ca0'] },
  glass: { hexes: ['#223245', '#3a5878', '#6c93b8'] },
  awnR: { hexes: ['#7a1f24', '#a52a2e', '#d1423f', '#e8e6da'] },
  awnG: { hexes: ['#1f4a30', '#2c6a42', '#3d8a58', '#e8e6da'] },
  awnB: { hexes: ['#1f3a66', '#2c528f', '#3d6cb5', '#e8e6da'] },
  // roofs
  shG: { hexes: ['#34373f', '#464a54', '#5a5f6b', '#727888'] },
  shB: { hexes: ['#3a2c26', '#4f3c33', '#684f42', '#836656'] },
  shR: { hexes: ['#4a2224', '#652d2e', '#823a37', '#a14a42'] },
  shN: { hexes: ['#2c3a34', '#3b4f45', '#4f6a5c', '#668574'] },
  metalR: { hexes: ['#4a5663', '#627284', '#7e90a3', '#9db0c2'] },
  flatR: { hexes: ['#3a3d42', '#4c4f55', '#60646c', '#777c85'] },
  // foliage
  leafA: { hexes: ['#7e3c1c', '#aa5a26', '#d08433', '#ecb14c'] },
  leafB: { hexes: ['#6a2218', '#8f3220', '#b54a2a', '#d46a38'] },
  leafC: { hexes: ['#8a7a22', '#b09a30', '#d4bc44', '#efd864'] },
  shrub: { hexes: ['#233f20', '#31592a', '#437534', '#5a9142'] },
  pine: { hexes: ['#13291d', '#1c3d2b', '#285539', '#386f4c'] },
  trunk: { hexes: ['#2b1f17', '#46321f', '#5e452c'] },
  // orchard blossom, for spring
  blossom: { hexes: ['#b0668a', '#d48cae', '#eeb4cd', '#fbdfe9'] },
  blossomW: { hexes: ['#c4b2bb', '#e3d3da', '#f5ebef', '#ffffff'] },
  // emissive: lit at night
  glassLit: {
    hexes: ['#46566a', '#62768c', '#8aa0b6'],
    emit: glow(
      [
        [70, 84, 100],
        [98, 116, 136],
        [132, 152, 172],
      ],
      [
        [205, 140, 70],
        [255, 196, 108],
        [255, 232, 168],
      ],
    ),
  },
  neonR: {
    hexes: ['#7a2a2a', '#c84a4a'],
    emit: glow(
      [
        [120, 60, 60],
        [170, 84, 84],
      ],
      [
        [200, 50, 50],
        [255, 110, 100],
      ],
    ),
  },
  neonB: {
    hexes: ['#2a4a7a', '#4a86c8'],
    emit: glow(
      [
        [60, 84, 120],
        [84, 120, 170],
      ],
      [
        [50, 110, 220],
        [120, 190, 255],
      ],
    ),
  },
  neonY: {
    hexes: ['#7a6a2a', '#c8b04a'],
    emit: glow(
      [
        [120, 108, 60],
        [170, 150, 84],
      ],
      [
        [220, 170, 40],
        [255, 224, 110],
      ],
    ),
  },
  lampLit: {
    hexes: ['#8a8470', '#c0b890'],
    emit: glow(
      [
        [138, 132, 112],
        [192, 184, 144],
      ],
      [
        [255, 170, 70],
        [255, 226, 150],
      ],
    ),
  },
  // a backlit letter board: cream by day, warm white at night
  boardLit: {
    hexes: ['#b9b6a8', '#e8e6da'],
    emit: glow(
      [
        [185, 182, 168],
        [232, 230, 218],
      ],
      [
        [226, 196, 140],
        [255, 242, 208],
      ],
    ),
  },
  ledG: {
    hexes: ['#2f5a3a', '#58b070'],
    emit: glow(
      [
        [60, 110, 72],
        [96, 176, 116],
      ],
      [
        [50, 190, 90],
        [120, 255, 150],
      ],
    ),
  },
  rwyL: { hexes: ['#8a8a80'], emit: (_lv, n) => mix3([138, 138, 128], [255, 244, 208], nightK(n)) },
  twyL: { hexes: ['#6a76a0'], emit: (_lv, n) => mix3([100, 110, 130], [70, 120, 255], nightK(n)) },
  thrG: { hexes: ['#6a8a6a'], emit: (_lv, n) => mix3([100, 120, 100], [90, 255, 130], nightK(n)) },
  beacon: {
    hexes: ['#3a4a3a', '#4a4a44'],
    emit: (lv, n, t) =>
      Math.floor(t / 1.2) % 2 === lv && n > 0.3
        ? lv
          ? [255, 251, 232]
          : [61, 255, 110]
        : [60, 66, 60],
  },
  radarL: {
    hexes: ['#5a2020'],
    emit: (_lv, n, t) => (n > 0.2 && Math.floor(t) % 2 === 0 ? [255, 58, 42] : [90, 30, 30]),
  },
} satisfies Record<string, MatDef>;

export type MatName = keyof typeof DEFS;
export const MAT_NAMES = Object.keys(DEFS) as MatName[];

/** Token base per material: a token is `M[name] + level`, with up to 8 levels. */
export const M = Object.fromEntries(MAT_NAMES.map((name, i) => [name, i * 8])) as Record<
  MatName,
  number
>;

export type Season = 'spring' | 'summer' | 'fall' | 'latefall' | 'winter';
type Ramps = Partial<Record<MatName, string[]>>;
const PINE = ['#13291d', '#1c3d2b', '#285539', '#386f4c'];
const WALK = ['#8a8b85', '#a6a79f', '#c2c2b8', '#d8d7cb'];
const PLOW = ['#3a2a20', '#523a2c', '#6c4e3a'];
const SEASONS: Record<Season, Ramps> = {
  spring: {
    grass: ['#3b6a2c', '#4e8636', '#66a041', '#88bf56'],
    turf: ['#33702e', '#418a38', '#52a244', '#6ab855'],
    leafA: ['#4a7a35', '#5f9644', '#7cb257', '#a2cd72'],
    leafB: ['#5a8a3a', '#74a84c', '#92c464', '#b4dc82'],
    leafC: ['#6a9a3a', '#88b84a', '#a8d460', '#c8ec84'],
    shrub: ['#2c4e24', '#3d6a30', '#548a3e', '#74aa52'],
    pine: PINE,
    crop: ['#3e5f28', '#4b7230', '#5a8838', '#6c9f43', '#5a8838', '#4b7230'],
    soy: ['#4a5a2c', '#5a6e34', '#6c8440', '#80984c', '#6c8440', '#5a6e34'],
    stub: ['#7a6a44', '#94845a', '#ac9c70'],
    plow: ['#4a3426', '#654736', '#815c47'],
    walk: WALK,
  },
  summer: {
    grass: ['#34602a', '#447a33', '#5a9440', '#78b04f'],
    turf: ['#2f6a2a', '#3c8234', '#4c9a3f', '#62b04e'],
    leafA: ['#2f5429', '#3f6e33', '#548a3f', '#72a653'],
    leafB: ['#2a4a2a', '#386234', '#4a7e40', '#659a52'],
    leafC: ['#335a2a', '#457534', '#5d9040', '#7bac50'],
    shrub: ['#233f20', '#31592a', '#437534', '#5a9142'],
    pine: PINE,
    crop: ['#4a7a2c', '#5b9234', '#6fab3e', '#84c24a', '#6fab3e', '#5b9234'],
    soy: ['#3f6a2a', '#4f8232', '#629a3c', '#78b24a', '#629a3c', '#4f8232'],
    stub: ['#8aa23a', '#a0b84a', '#b8cf5e'],
    plow: PLOW,
    walk: WALK,
  },
  fall: {
    grass: ['#4b5f2b', '#62762f', '#7b8c3a', '#97a548'],
    turf: ['#3a6a2c', '#49803a', '#5a9647', '#70ac58'],
    leafA: ['#7e3c1c', '#aa5a26', '#d08433', '#ecb14c'],
    leafB: ['#6a2218', '#8f3220', '#b54a2a', '#d46a38'],
    leafC: ['#8a7a22', '#b09a30', '#d4bc44', '#efd864'],
    shrub: ['#3a3f20', '#505a2a', '#68733a', '#828f4a'],
    pine: PINE,
    crop: ['#a8822e', '#bb9436', '#cfa740', '#e0ba4e', '#cfa740', '#bb9436'],
    soy: ['#8a8a30', '#a29a38', '#bba842', '#d0b84e', '#bba842', '#a29a38'],
    stub: ['#8a7648', '#a38c58', '#bda26c'],
    plow: PLOW,
    walk: WALK,
  },
  latefall: {
    grass: ['#4a4f2e', '#5e6334', '#767a3e', '#8e9048'],
    turf: ['#456a38', '#548240', '#659a4c', '#7aae5d'],
    leafA: ['#5a3a24', '#7a4a2a', '#9c6232', '#c08a40'],
    leafB: ['#4e2a22', '#693a2c', '#874d36', '#a5663f'],
    leafC: ['#6a5a2a', '#867236', '#a28b44', '#bda556'],
    shrub: ['#35341f', '#4a4a2a', '#5e5e36', '#757442'],
    pine: PINE,
    crop: ['#6e5a34', '#7d6a3c', '#8f7b46', '#a28d52', '#8f7b46', '#7d6a3c'],
    soy: ['#665c36', '#766a3e', '#887b48', '#9a8c54', '#887b48', '#766a3e'],
    stub: ['#6b5e44', '#84735a', '#9c8a6c'],
    plow: PLOW,
    walk: WALK,
  },
  // Winter without snow: dormant grass and bare branches. Snow comes from the forecast (SNOW).
  winter: {
    grass: ['#55553a', '#6a6844', '#807c50', '#96915c'],
    turf: ['#4f6040', '#5f7349', '#718754', '#859b62'],
    leafA: ['#3a312c', '#4f443e', '#655950', '#7b6f64'],
    leafB: ['#3a312c', '#4f443e', '#655950', '#7b6f64'],
    leafC: ['#3a312c', '#4f443e', '#655950', '#7b6f64'],
    shrub: ['#3f3a2c', '#554e3a', '#6b6348', '#827a58'],
    pine: PINE,
    crop: ['#6e5f3c', '#7d6e46', '#8d7e52', '#9d8e5e', '#8d7e52', '#7d6e46'],
    soy: ['#665c3c', '#756a45', '#857a50', '#958a5c', '#857a50', '#756a45'],
    stub: ['#6b5e44', '#84735a', '#9c8a6c'],
    plow: PLOW,
    walk: WALK,
  },
};

/** Snow on the ground and the roofs, over any season's ramps; roads and walks are cleared. */
const ROOF_SNOW = ['#a9b6c2', '#c5d0d9', '#dee6ec', '#f0f5f8'];
const SNOW: Ramps = {
  grass: ['#9eadbb', '#bccad6', '#d9e3ec', '#f2f7fb'],
  turf: ['#9eadbb', '#bccad6', '#d9e3ec', '#f2f7fb'],
  dirt: ['#8f9aa4', '#b4bfc8', '#d6dee5'],
  mulch: ['#8f9aa4', '#b4bfc8', '#d6dee5'],
  shrub: ['#4a4338', '#645a4e', '#82776a', '#b8c3cc'],
  pine: ['#17302a', '#264a40', '#43695c', '#c5d3dc'],
  crop: ['#c9d4de', '#dce5ec', '#eef3f7', '#f8fbfd', '#eef3f7', '#dce5ec'],
  soy: ['#c3cdd6', '#d8e1e8', '#eaf0f4', '#f6f9fb', '#eaf0f4', '#d8e1e8'],
  stub: ['#bfcad4', '#d8e1e8', '#edf2f6'],
  plow: ['#7c8892', '#aab4be', '#d8e0e7'],
  walk: ['#a8b3bd', '#c6d0d8', '#dfe6ec', '#eef3f6'],
  shG: ROOF_SNOW,
  shB: ROOF_SNOW,
  shR: ROOF_SNOW,
  shN: ROOF_SNOW,
  flatR: ROOF_SNOW,
};
/** Bare branches carry a little snow. */
const SNOW_TWIGS: Ramps = {
  leafA: ['#3a312c', '#4f443e', '#6f635b', '#aab7c2'],
  leafB: ['#3a312c', '#4f443e', '#6f635b', '#aab7c2'],
  leafC: ['#3a312c', '#4f443e', '#6f635b', '#aab7c2'],
};

/** Months: Dec–Feb winter, Mar–May spring, Jun–Aug summer, Sep to mid-Nov fall, then late fall. */
export function seasonOf(month: number, day: number): Season {
  if (month === 12 || month <= 2) return 'winter';
  if (month <= 5) return 'spring';
  if (month <= 8) return 'summer';
  return month <= 10 || (month === 11 && day <= 15) ? 'fall' : 'latefall';
}

/** The colour of every token, for one season: rgb[token] and emissive[token] (null when unlit). */
export interface Palette {
  season: Season;
  /** Snow lies on the ground. */
  snow: boolean;
  /** The ramp of each material, dark to light. */
  ramps: Record<MatName, RGB[]>;
  rgb: RGB[];
  /** Emissive colour at full night, baked into the atlas; the scene fades it in. */
  emissive: (RGB | null)[];
}

export function palette(season: Season, snow = false): Palette {
  const ramps = {} as Record<MatName, RGB[]>;
  const rgb: RGB[] = [];
  const emissive: (RGB | null)[] = [];
  const bare = season === 'winter' || season === 'latefall';
  const snowy: Ramps = snow ? { ...SNOW, ...(bare ? SNOW_TWIGS : {}) } : {};
  MAT_NAMES.forEach((name, mi) => {
    const def: MatDef = DEFS[name];
    const ramp = (snowy[name] ?? SEASONS[season][name] ?? def.hexes).map(hex);
    ramps[name] = ramp;
    for (let lv = 0; lv < 8; lv++) {
      const l = Math.min(lv, ramp.length - 1);
      rgb[mi * 8 + lv] = ramp[l]!;
      emissive[mi * 8 + lv] = def.emit ? def.emit(l, 1, 0) : null;
    }
  });
  return { season, snow, ramps, rgb, emissive };
}
