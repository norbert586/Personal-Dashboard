/**
 * Real aircraft over the town (SPEC: Feeds in town): each one from the ADS-B feed, put where it
 * really is through the world's projection, heading where it's really heading, and flown on by
 * dead reckoning between answers. Pure; life-bodies.ts gives them bodies.
 *
 * Heights are squeezed, like the map's distances: real altitudes keep their order but fit between
 * the rooftops and the camera, so a jet at 35,000 ft still crosses the view.
 */
import type { Aircraft } from '../lib/sources/flights.ts';
import type { Wire } from './feeds.ts';
import { TILES_PER_MILE, headingVector, toTile } from './world/projection.ts';

const MILES_PER_NAUTICAL_MILE = 1.150779;
/** Above this, an aircraft is drawn as high as they go. */
const CEILING_FT = 45_000;
/** Jets this high leave a contrail. */
const CONTRAIL_FT = 24_000;

export interface Plane {
  hex: string;
  /** The flight or the tail number, for the heads-up line. */
  label: string;
  /** Where it was when the feed saw it, in tiles. */
  x: number;
  y: number;
  /** Tiles per second over the ground. */
  vx: number;
  vy: number;
  /** Its heading, a unit vector on the grid. */
  fx: number;
  fy: number;
  /** Height above the town in tiles (squeezed), and how large to draw it: lower looks nearer. */
  h: number;
  scale: number;
  kind: 'jet' | 'prop';
  contrail: boolean;
  altitudeFt: number;
}

/** A real altitude as a height in tiles: 1,000 ft is about 4.6, 35,000 ft about 11.4. */
export function heightTiles(altitudeFt: number): number {
  const k = Math.sqrt(Math.max(0, Math.min(altitudeFt, CEILING_FT)) / CEILING_FT);
  return 3.2 + 9.3 * k;
}

// ICAO type designators that are jets: airliners, regional and business jets.
const JET =
  /^(A[123]\d|B7\d|B3\d|BCS|CRJ|E1[79]|E[234]\d|E75|E5[05]|MD\d|C(25|5\d|6\d|7\d)|GL|G\d\d|LJ|F[A29]|H25|PC24|CL\d)/;

/** Aircraft in the air, as the town draws them. Ones on the ground, or with no height, stay out. */
export function plotAircraft(aircraft: ReadonlyArray<Wire<Aircraft>>): Plane[] {
  const planes: Plane[] = [];
  for (const a of aircraft) {
    if (a.onGround || a.altitudeFt === undefined) continue;
    const [x, y] = toTile(a.lat, a.lon);
    const [fx, fy] = headingVector(a.track ?? 0);
    const speed = (((a.speedKt ?? 0) * MILES_PER_NAUTICAL_MILE) / 3600) * TILES_PER_MILE;
    const k = Math.sqrt(Math.max(0, Math.min(a.altitudeFt, CEILING_FT)) / CEILING_FT);
    // By type when it's a known jet; otherwise anything fast or high is drawn as one.
    const jet =
      (a.type !== undefined && JET.test(a.type)) || (a.speedKt ?? 0) > 250 || a.altitudeFt > 18_000;
    planes.push({
      hex: a.hex,
      label: a.callsign ?? a.registration ?? a.hex.toUpperCase(),
      x,
      y,
      vx: fx * speed,
      vy: fy * speed,
      fx,
      fy,
      h: heightTiles(a.altitudeFt),
      scale: 3.2 - 1.8 * k,
      kind: jet ? 'jet' : 'prop',
      contrail: jet && a.altitudeFt >= CONTRAIL_FT,
      altitudeFt: a.altitudeFt,
    });
  }
  return planes;
}

/** Where a plane is `seconds` after the feed saw it, holding its course and speed. */
export function planeAt(plane: Plane, seconds: number): [number, number] {
  return [plane.x + plane.vx * seconds, plane.y + plane.vy * seconds];
}
