/**
 * The world's one projection (ADR-019): real latitude and longitude to tiles. One origin and one
 * tiles-per-mile constant, here and nowhere else, so everything placed from real coordinates (the
 * aircraft overhead now, the map and the delivery zone later) lines up.
 *
 * Tiles run the way the town's grid does: +x is south and +y is west. The town keeps the pattern
 * of the real place, not its distances (SPEC: The map): a real mile is one section of tiles.
 */
import { site } from '../../site.config.ts';

/** One real mile, and one section of the world, in tiles. */
export const TILES_PER_MILE = 32;

/**
 * The real point at tile (0, 0). It puts the town's point (site.place, about 26 Mile and Van
 * Dyke) in the middle of the first section, at tile (16, 16), where today's town stands.
 */
export const ORIGIN = { lat: 42.727244, lon: -83.020176 } as const;

/** Miles in one degree at the town's latitude (WGS 84); the world is small enough to be flat. */
const MILES_PER_DEGREE = { lat: 69.026, lon: 50.897 } as const;

/** Where a real point is in the world, in tiles. */
export function toTile(lat: number, lon: number): [number, number] {
  return [
    (ORIGIN.lat - lat) * MILES_PER_DEGREE.lat * TILES_PER_MILE,
    (ORIGIN.lon - lon) * MILES_PER_DEGREE.lon * TILES_PER_MILE,
  ];
}

/** The real point under a tile position. */
export function toLatLon(x: number, y: number): { lat: number; lon: number } {
  return {
    lat: ORIGIN.lat - x / TILES_PER_MILE / MILES_PER_DEGREE.lat,
    lon: ORIGIN.lon - y / TILES_PER_MILE / MILES_PER_DEGREE.lon,
  };
}

/** A compass heading in degrees (0 = north, clockwise) as a unit vector on the grid. */
export function headingVector(degrees: number): [number, number] {
  const a = (degrees * Math.PI) / 180;
  return [-Math.cos(a), -Math.sin(a)];
}

/** The town's point, in tiles. */
export const TOWN_POINT = toTile(site.place.lat, site.place.lon);
