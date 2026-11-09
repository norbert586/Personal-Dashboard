/**
 * Aircraft in the sky around town from public ADS-B networks (free, no key): adsb.lol first,
 * airplanes.live when it can't answer. Both speak readsb's JSON, so one parser reads either.
 * airplanes.live refuses datacenter addresses, so it's a fallback that works from home.
 */
import type { Fetcher } from '../fetcher.ts';
import {
  MILES_PER_NAUTICAL_MILE,
  bearing,
  compass,
  distanceMiles,
  type CompassPoint,
  type Point,
} from '../geo.ts';
import { field, list, num, str } from '../json.ts';
import type { Source } from '../readings.ts';
import { site } from '../../site.config.ts';

export interface Aircraft {
  /** The transponder's ICAO address, stable for an airframe: "a6dbf3". */
  hex: string;
  /** The flight or the tail number, as broadcast: "DAL1065". */
  callsign: string | undefined;
  registration: string | undefined;
  /** ICAO type designator: "A21N" (A321neo), "C172". */
  type: string | undefined;
  onGround: boolean;
  /** Barometric altitude in feet; undefined on the ground. */
  altitudeFt: number | undefined;
  speedKt: number | undefined;
  /** Where it's heading, in degrees. */
  track: number | undefined;
  lat: number;
  lon: number;
  /** From the town's point. */
  distanceMi: number;
  bearing: number;
  direction: CompassPoint;
  military: boolean;
  /** In words, when the crew squawks or declares one: "Emergency", "Radio failure". */
  emergency: string | undefined;
}

export interface Flights {
  /** Nearest first. */
  aircraft: Aircraft[];
  radiusMi: number;
  /** Which network answered. */
  via: string;
}

const NETWORKS = [
  { name: 'adsb.lol', base: 'https://api.adsb.lol/v2/point', sample: 'adsblol-point.json' },
  {
    name: 'airplanes.live',
    base: 'https://api.airplanes.live/v2/point',
    sample: 'airplaneslive-point.json',
  },
] as const;

/** Positions older than this are left out: the aircraft has likely moved on or landed. */
const STALE_POSITION_S = 60;
/** readsb's dbFlags: bit 0 marks a military airframe. */
const MILITARY = 1;

const EMERGENCY_SQUAWKS: Record<string, string> = {
  '7500': 'Hijack',
  '7600': 'Radio failure',
  '7700': 'Emergency',
};
const EMERGENCY_STATES: Record<string, string> = {
  general: 'Emergency',
  lifeguard: 'Medical flight',
  minfuel: 'Low fuel',
  nordo: 'Radio failure',
  unlawful: 'Hijack',
  downed: 'Aircraft down',
};

export function flights(center: Point = site.place, radiusNm = 25): Source<Flights> {
  return {
    name: 'ADS-B',
    empty: { aircraft: [], radiusMi: radiusNm * MILES_PER_NAUTICAL_MILE, via: NETWORKS[0].name },
    async load({ fetcher }) {
      const failures: string[] = [];
      for (const network of NETWORKS) {
        try {
          const json = await ask(network, fetcher, center, radiusNm);
          return {
            aircraft: parseAircraft(json, center),
            radiusMi: radiusNm * MILES_PER_NAUTICAL_MILE,
            via: network.name,
          };
        } catch (error) {
          failures.push(error instanceof Error ? error.message : String(error));
        }
      }
      throw new Error(failures.join(' '));
    },
  };
}

function ask(
  network: (typeof NETWORKS)[number],
  fetcher: Fetcher,
  center: Point,
  radiusNm: number,
) {
  return fetcher.json({
    name: network.name,
    url: `${network.base}/${center.lat}/${center.lon}/${radiusNm}`,
    ttl: 30_000,
    sample: network.sample,
  });
}

/** Aircraft with a recent position, nearest to `center` first. */
export function parseAircraft(json: unknown, center: Point): Aircraft[] {
  const aircraft: Aircraft[] = [];
  for (const raw of list(field(json, 'ac'))) {
    const hex = str(field(raw, 'hex'));
    const lat = num(field(raw, 'lat'));
    const lon = num(field(raw, 'lon'));
    if (hex === undefined || lat === undefined || lon === undefined) continue;
    if ((num(field(raw, 'seen_pos')) ?? 0) > STALE_POSITION_S) continue;

    const altitude = field(raw, 'alt_baro');
    const onGround = altitude === 'ground';
    const squawk = str(field(raw, 'squawk'));
    const state = str(field(raw, 'emergency'));
    const position = { lat, lon };
    const heading = bearing(center, position);
    aircraft.push({
      hex: hex.replace(/^~/, ''), // "~" marks a TIS-B address
      callsign: str(field(raw, 'flight')),
      registration: str(field(raw, 'r')),
      type: str(field(raw, 't')),
      onGround,
      altitudeFt: onGround ? undefined : num(altitude),
      speedKt: num(field(raw, 'gs')),
      track: num(field(raw, 'track')),
      lat,
      lon,
      distanceMi: distanceMiles(center, position),
      bearing: heading,
      direction: compass(heading),
      military: ((num(field(raw, 'dbFlags')) ?? 0) & MILITARY) !== 0,
      emergency:
        (state !== undefined ? EMERGENCY_STATES[state] : undefined) ??
        (squawk !== undefined ? EMERGENCY_SQUAWKS[squawk] : undefined),
    });
  }
  return aircraft.sort((a, b) => a.distanceMi - b.distanceMi);
}
