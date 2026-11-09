/**
 * The real sun over Ratiu Twp, and the light it makes (DESIGN: Light, time and weather). Pure, so
 * the town and its tests agree on where the sun is at any moment.
 */
import { site } from '../../site.config.ts';
import { mix3, smooth, type RGB } from './materials.ts';

const DAY_MS = 86_400_000;
const RAD = Math.PI / 180;

/** Solar position (NOAA-style): azimuth clockwise from north and elevation, in degrees. */
export function sunPos(
  d: Date,
  lat = site.place.lat,
  lon = site.place.lon,
): { az: number; el: number } {
  const n = d.getTime() / DAY_MS + 2440587.5 - 2451545.0;
  const L = (280.46 + 0.9856474 * n) % 360;
  const g = ((357.528 + 0.9856003 * n) % 360) * RAD;
  const lam = (L + 1.915 * Math.sin(g) + 0.02 * Math.sin(2 * g)) * RAD;
  const eps = 23.439 * RAD;
  const dec = Math.asin(Math.sin(eps) * Math.sin(lam));
  const ra = Math.atan2(Math.cos(eps) * Math.sin(lam), Math.cos(lam));
  const gmst = (18.697374558 + 24.06570982441908 * n) % 24;
  const lst = ((((gmst + lon / 15) % 24) + 24) % 24) * 15 * RAD;
  const H = lst - ra;
  const la = lat * RAD;
  const el = Math.asin(Math.sin(la) * Math.sin(dec) + Math.cos(la) * Math.cos(dec) * Math.cos(H));
  const azS = Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(la) - Math.tan(dec) * Math.cos(la));
  return { az: (((azS / RAD + 180) % 360) + 360) % 360, el: el / RAD };
}

export type Sky = 'clear' | 'cloud' | 'rain' | 'snow';

export interface Lighting {
  sun: { az: number; el: number };
  /** Direction toward the sun in grid space: [x (south), y (west), up]. */
  d: RGB;
  /** Sun strength. */
  I: number;
  sky: RGB;
  sunCol: RGB;
  /** 0 at night to 1 in full day. */
  day: number;
  night: number;
}

/** The sky's colour and the sun's strength, colour and direction for a moment and a sky. */
export function lighting(date: Date, wx: Sky = 'clear'): Lighting {
  const sun = sunPos(date);
  const el = sun.el;
  const day = smooth(-4, 9, el);
  const up = Math.max(0, Math.sin(el * RAD));
  const low = 1 - smooth(3, 32, el);
  const sunK = { clear: 1, cloud: 0.42, rain: 0.2, snow: 0.26 }[wx];
  const twi = day > 0.02 && day < 0.98 ? Math.max(0, 1 - Math.abs(day * 2 - 1)) : 0;
  let sky = mix3([0.22, 0.29, 0.5], [0.64, 0.7, 0.82], day);
  sky = mix3(sky, [0.66, 0.5, 0.5], twi * 0.5);
  if (wx !== 'clear') {
    const k = 0.3 + 0.7 * day;
    sky = mix3(sky, [0.7 * k, 0.74 * k, 0.8 * k], 0.5);
  }
  const sunCol = mix3([1.35, 0.82, 0.5], [1.08, 1.02, 0.92], 1 - low);
  const I = 0.78 * day * sunK * Math.min(1, up * 1.4 + 0.2);
  const az = sun.az * RAD;
  const cel = Math.cos(el * RAD);
  return {
    sun,
    d: [-Math.cos(az) * cel, -Math.sin(az) * cel, up],
    I,
    sky,
    sunCol,
    day,
    night: 1 - day,
  };
}

/** Today at a given hour in the town's time zone (for the time-of-day presets). */
export function todayAt(hour: number, now = new Date()): Date {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: site.timeZone,
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  }).formatToParts(now);
  const h = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const m = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  return new Date(now.getTime() + (hour - (h + m / 60)) * 3_600_000);
}

/** Time of day: the real clock, or a preset hour today (the feel test's N key). */
export type TimeOfDay = 'auto' | 'day' | 'dusk' | 'night';
export const TIMES: ReadonlyArray<{ id: TimeOfDay; label: string; hour: number }> = [
  { id: 'auto', label: 'Real time', hour: -1 },
  { id: 'day', label: 'Midday', hour: 12.5 },
  { id: 'dusk', label: 'Dusk', hour: 17.0 },
  { id: 'night', label: 'Night', hour: 22.5 },
];

/** The moment the town is lit for. */
export function simDate(time: TimeOfDay, now = new Date()): Date {
  const preset = TIMES.find((t) => t.id === time);
  return !preset || preset.hour < 0 ? now : todayAt(preset.hour, now);
}
