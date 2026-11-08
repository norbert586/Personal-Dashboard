<script>
'use strict';
// ============ Data ============
const TZ = 'America/Detroit';
const DAY_MS = 86400000;
const LAT = 42.8, LON = -83.0; // Macomb County, Michigan

const PROJECTS = [
  { id: 1, title: 'Personal console', place: 'Terminal', status: 'building', stack: ['Astro', 'TypeScript'], last: '2026-11-07', summary: 'This site. You are standing in it.', repo: 'https://github.com/norbert586/Personal-Dashboard' },
  { id: 2, title: 'Overhead', place: 'ATC tower', status: 'building', stack: ['TypeScript', 'JavaScript'], last: '2026-10-17', summary: '', repo: 'https://github.com/norbert586/overhead-web' },
  { id: 3, title: 'Tetris Plus', place: 'Hangar A', status: 'building', stack: ['TypeScript'], last: '2026-10-24', summary: 'Clone of the PS1 game.', repo: 'https://github.com/norbert586/Tetris-Plus' },
  { id: 4, title: 'QA', place: 'Hangar B', status: 'archived', stack: ['TypeScript'], last: '2024-08-01', summary: '', repo: 'https://github.com/norbert586/QA' },
  { id: 5, title: 'Work Hours', place: 'Fire station', status: 'archived', stack: [], last: '2025-06-06', summary: 'Work hours tracker.', repo: 'https://github.com/norbert586/Work-Hours' },
  { id: 6, title: 'Scrum Master', place: 'Barracks', status: 'paused', stack: ['JavaScript'], last: '2026-07-07', summary: '', repo: 'https://github.com/norbert586/scrumMaster' },
  { id: 7, title: 'flightpi', place: 'Radar dome', status: 'paused', stack: ['Python', 'Raspberry Pi'], last: '2026-03-02', summary: 'Raspberry Pi service and its web app.', repo: 'https://github.com/norbert586/flightpi' },
  { id: 8, title: 'Food Orders', place: 'Coney diner', status: 'archived', stack: ['TypeScript'], last: '2025-09-14', summary: '', repo: 'https://github.com/norbert586/food-orders-app' },
  { id: 9, title: 'Crossbell Vending', place: 'Vending kiosk', status: 'building', stack: ['Astro'], last: '2026-11-05', summary: 'Static website for the vending venture.', repo: 'https://github.com/norbert586/crossbell-vending' },
];
const LANDMARKS = [
  { id: 10, title: 'Water tower', note: 'The old water tower. You can see it from the end of every runway.' },
  { id: 11, title: 'Orchard', note: 'Peach and apple rows with a farm stand. Peaches are the local obsession every Labor Day weekend.' },
  { id: 12, title: 'Grain elevator', note: 'The co-op elevator by the tracks. The freight stops here twice a day.' },
  { id: 13, title: 'Empty lot', note: 'Your next project gets built here.' },
  { id: 14, title: 'Ball field', note: 'Friday nights are the second-best thing in town. Scores live in the morning update.' },
  { id: 15, title: 'Wind farm', note: 'Turbines on the section line. Their red lights blink together all night.' },
  { id: 16, feed: 'movies', title: 'Cinema', note: "Today's showtimes." },
  { id: 17, feed: 'comics', title: 'Comic shop', note: 'New books land on Wednesdays.' },
  { id: 18, feed: 'sports', title: 'Sports bar', note: 'Every game on every screen.' },
];
const byId = (id) => PROJECTS.find((p) => p.id === id) || LANDMARKS.find((l) => l.id === id);
const STATUS_WORD = { building: 'Building', live: 'Live', paused: 'Paused', archived: 'Archived' };
const STATUS_PLACE = { building: 'under construction', live: 'open', paused: 'closed for now', archived: 'retired' };
const SLUGS = { 1: 'personal-console', 2: 'overhead', 3: 'tetris-plus', 4: 'qa', 5: 'work-hours', 6: 'scrum-master', 7: 'flightpi', 8: 'food-orders', 9: 'crossbell-vending', 10: 'water-tower', 11: 'orchard', 12: 'grain-elevator', 13: 'empty-lot', 14: 'ball-field', 15: 'wind-farm', 16: 'cinema', 17: 'comic-shop', 18: 'sports-bar' };
for (const p of [...PROJECTS, ...LANDMARKS]) p.slug = SLUGS[p.id];
const bySlug = (s) => [...PROJECTS, ...LANDMARKS].find((p) => p.slug === s);

// Sample morning update. Every value is invented and labelled as sample in the UI.
const MORNING = {
  weather: { now: 34, sky: 'snow', text: 'Flurries', hi: 38, lo: 29, wind: 'NW 12 mph', windDir: 315,
    days: [['Sun', 'snow', 38, 29], ['Mon', 'cloud', 41, 31], ['Tue', 'sun', 45, 33], ['Wed', 'rain', 47, 39], ['Thu', 'snow', 36, 27]] },
  sports: [
    ['Pistons', ['W', '112–104', 'vs CHI'], 'Mon 7:00 PM at NYK'],
    ['Lions', ['W', '27–20', 'at GB'], 'Sun 1:00 PM vs MIN'],
    ['Tigers', null, 'Offseason. Spring training opens in February.'],
    ['Red Wings', ['L', '2–3 OT', 'vs TOR'], 'Tue 7:00 PM at BOS'],
    ['Michigan basketball', ['W', '81–66', 'vs OAK'], 'Wed 7:30 PM vs WMU'],
    ['Michigan football', ['W', '31–17', 'vs IU'], 'Sat 12:00 PM at MSU'],
    ['Georgia Tech football', ['L', '21–24', 'at UVA'], 'Sat 3:30 PM vs MIA'],
  ],
  comics: [['Ace of Wings #12', 'Northline Comics'], ['Lake Effect #3', 'Copperline'], ['Night Desk #27', 'Halftone Press'], ['Sector Nine #1', 'Copperline'], ['Pine Barrens Annual', 'Halftone Press']],
  movies: [['Crosswind', 'PG-13', ['1:10', '4:20', '7:30', '10:15']], ['The Last Arcade', 'R', ['2:00', '6:45', '9:40']], ['Snowbound Express', 'PG', ['11:30', '2:15', '5:00']]],
  ticker: ['Lions W 27–20 at GB (sample)', 'New comics Wednesday: 5 titles (sample)', 'Flurries, 34°F, wind NW 12 mph (sample)', 'Overhead right now: 2 aircraft (sample)'],
};

// Land and take off into the wind on the single north-south runway, like the real field's 18/36.
const NORTHBOUND = Math.cos((MORNING.weather.windDir * Math.PI) / 180) >= 0;

// ============ Settings ============
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const S = { sound: false, volume: 6, speed: 1, detail: reducedMotion ? 'off' : 'full', time: 'auto', hour: 12, weather: 'auto', season: 'auto', dof: true };

// ============ Time and sun ============
const partsFmt = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'short', day: '2-digit', month: 'short' });
function nowParts(d = new Date()) {
  const o = {};
  for (const p of partsFmt.formatToParts(d)) o[p.type] = p.value;
  const h = Number(o.hour) % 24, m = Number(o.minute);
  return { h, m, hour: h + m / 60, date: `${o.weekday} ${o.day} ${o.month}`, time: `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}` };
}
const monthNow = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, month: 'numeric' }).format(new Date()));
const dayNow = Number(new Intl.DateTimeFormat('en-US', { timeZone: TZ, day: 'numeric' }).format(new Date()));
function ago(iso) {
  const days = Math.round((Date.now() - Date.parse(iso + 'T12:00:00')) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 14) return days + ' days ago';
  if (days < 60) return Math.round(days / 7) + ' weeks ago';
  if (days < 548) return Math.round(days / 30.4) + ' months ago';
  return Math.round(days / 365) + ' years ago';
}
// Months: Dec-Feb winter, Mar-May spring, Jun-Aug summer, Sep-Oct fall, Nov late fall.
const seasonNow = () => {
  if (S.season !== 'auto') return S.season;
  const m = monthNow; return m === 12 || m <= 2 ? 'winter' : m <= 5 ? 'spring' : m <= 8 ? 'summer' : m <= 10 || (m === 11 && dayNow <= 15) ? 'fall' : 'latefall';
};
const weatherNow = () => (S.weather !== 'auto' ? S.weather : MORNING.weather.sky === 'sun' ? 'clear' : MORNING.weather.sky);
// The simulated moment: real time, or a chosen hour of today.
function simDate() {
  if (S.time === 'auto') return new Date();
  const target = S.time === 'custom' ? S.hour : { dawn: 6.7, day: 12.5, dusk: 17.0, night: 22.5 }[S.time];
  return new Date(Date.now() + (target - nowParts().hour) * 3600000);
}
// Solar position (NOAA-style), azimuth clockwise from north, degrees.
function sunPos(d) {
  const rad = Math.PI / 180, n = d.getTime() / DAY_MS + 2440587.5 - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360, g = ((357.528 + 0.9856003 * n) % 360) * rad;
  const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * rad, eps = 23.439 * rad;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam)), ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24, lst = ((((gmst + LON / 15) % 24) + 24) % 24) * 15 * rad;
  const H = lst - ra, lat = LAT * rad;
  const el = Math.asin(Math.sin(lat) * Math.sin(dec) + Math.cos(lat) * Math.cos(dec) * Math.cos(H));
  const azS = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(lat) - Math.tan(dec) * Math.cos(lat));
  return { az: (((azS / rad + 180) % 360) + 360) % 360, el: el / rad };
}
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const clamp8 = (v) => (v < 0 ? 0 : v > 255 ? 255 : v | 0);
const pack = (r, g, b) => (255 << 24) | (clamp8(b) << 16) | (clamp8(g) << 8) | clamp8(r);
const smooth = (a, b, x) => { const t = Math.max(0, Math.min(1, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const mix3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
