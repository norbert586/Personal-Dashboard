/** Small geography helpers for feeds: compass points from bearings. */

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
