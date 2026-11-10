/**
 * The town's weather, from the same forecast the Today panel shows (DESIGN: Light, time and
 * weather): how much cloud, whether rain or snow is falling, whether snow lies on the ground, and
 * which way it all drifts. Pure, so the town and its tests agree on what a forecast looks like.
 */
import type { Sky as FeedSky, Weather } from '../lib/sources/weather.ts';
import type { WireReading } from './feeds.ts';
import { headingVector } from './world/projection.ts';
import type { Sky } from './world/sun.ts';

export const FEED_SKIES: readonly FeedSky[] = [
  'clear',
  'partly',
  'cloudy',
  'rain',
  'snow',
  'storm',
  'fog',
];

export interface TownWeather {
  /** The sky in the feed's words, or null when the town doesn't know (fair weather is drawn). */
  sky: FeedSky | null;
  /** The sky the sun shines through. */
  light: Sky;
  /** Cloud cover, 0 to 1. */
  cover: number;
  falling: 'rain' | 'snow' | null;
  /** A storm: more of it, falling harder. */
  heavy: boolean;
  fog: boolean;
  /** Snow lies on the ground and the roofs. */
  snowCover: boolean;
  /** Which way the weather moves on the grid, in tiles per second. */
  drift: [number, number];
}

const LOOK: Record<FeedSky, Pick<TownWeather, 'light' | 'cover' | 'falling'>> = {
  clear: { light: 'clear', cover: 0.12, falling: null },
  partly: { light: 'clear', cover: 0.4, falling: null },
  cloudy: { light: 'cloud', cover: 0.8, falling: null },
  fog: { light: 'cloud', cover: 0.6, falling: null },
  rain: { light: 'rain', cover: 0.9, falling: 'rain' },
  storm: { light: 'rain', cover: 1, falling: 'rain' },
  snow: { light: 'snow', cover: 0.9, falling: 'snow' },
};

/** Wind from a compass bearing at a speed, as the drift of clouds and rain across the grid. */
function driftOf(fromDegrees: number, mph: number): [number, number] {
  const [fx, fy] = headingVector(fromDegrees + 180);
  const speed = 0.05 + Math.min(mph, 40) * 0.012;
  return [fx * speed, fy * speed];
}

/**
 * What the town draws for a weather reading. Snow lies when it's snowing at or near freezing, or
 * when it's well below freezing with snow in the next day's forecast: the weather service's
 * forecast doesn't say how deep the snow is, so this is the town's honest guess.
 */
export function townWeather(
  reading: WireReading<Weather> | undefined,
  preview?: FeedSky | null,
): TownWeather {
  const data = reading && reading.provenance !== 'offline' ? reading.data : undefined;
  const now = data?.now;
  const sky = preview ?? now?.sky ?? data?.periods[0]?.sky ?? null;
  const look = LOOK[sky ?? 'clear'];
  const tempF = now?.tempF;
  const snowSoon = (data?.periods ?? []).slice(0, 2).some((period) => period.sky === 'snow');
  const snowCover = preview
    ? preview === 'snow'
    : (sky === 'snow' && (tempF ?? 32) <= 35) || (tempF !== undefined && tempF <= 30 && snowSoon);
  return {
    sky,
    ...look,
    heavy: sky === 'storm',
    fog: sky === 'fog',
    snowCover,
    // The prevailing wind here is from the west, when the station doesn't say.
    drift: driftOf(now?.windFrom?.degrees ?? 280, now?.windMph ?? 6),
  };
}
