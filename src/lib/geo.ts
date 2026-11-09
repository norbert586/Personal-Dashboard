/** Small geography helpers for feeds: distances, bearings and compass points. */

export interface Point {
  lat: number;
  lon: number;
}

const POINTS = [
  'N',
  'NNE',
  'NE',
  'ENE',
  'E',
  'ESE',
  'SE',
  'SSE',
  'S',
  'SSW',
  'SW',
  'WSW',
  'W',
  'WNW',
  'NW',
  'NNW',
] as const;

export type CompassPoint = (typeof POINTS)[number];

/** The nearest of the 16 compass points to a bearing in degrees (0 = north, clockwise). */
export function compass(degrees: number): CompassPoint {
  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;
  return POINTS[index]!;
}

const EARTH_RADIUS_MI = 3958.8;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in statute miles. */
export function distanceMiles(from: Point, to: Point): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLon = toRadians(to.lon - from.lon);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) * Math.cos(toRadians(to.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_MI * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial bearing from one point to another, in degrees clockwise from north. */
export function bearing(from: Point, to: Point): number {
  const φ1 = toRadians(from.lat);
  const φ2 = toRadians(to.lat);
  const Δλ = toRadians(to.lon - from.lon);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

export const MILES_PER_NAUTICAL_MILE = 1.150779;
