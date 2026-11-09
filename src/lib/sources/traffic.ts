/**
 * Area traffic from TomTom's incident details (a free key, about 2,500 requests a day; every 15
 * minutes uses 96; ADR-017). Accidents, slowdowns and hazards always count. Closures and road
 * work are many and mostly on side streets, so they count only on the main roads in
 * site.config.ts. No personal route: a drive from home to work waits for Norbert's answer.
 *
 * The key goes in the TomTom-Api-Key header (TomTom's v2 API reads it there), never in the URL.
 */
import { date, field, list, num, str } from '../json.ts';
import type { Source } from '../readings.ts';
import { site } from '../../site.config.ts';

export type IncidentKind =
  'accident' | 'slow' | 'closed' | 'lane-closed' | 'road-work' | 'hazard' | 'weather' | 'other';

export interface Incident {
  id: string;
  kind: IncidentKind;
  /** In words: "Closed", "Slow traffic", "Accident". */
  label: string;
  /** The road it's on, when TomTom says: "24 Mile Rd", "M-53". */
  road: string | undefined;
  from: string | undefined;
  to: string | undefined;
  /** TomTom reports each direction of a closure separately; they're merged into one. */
  bothWays: boolean;
  /** Extra minutes over free-flowing traffic, when known. */
  delayMin: number | undefined;
  lengthMi: number;
  since: Date | undefined;
  until: Date | undefined;
  start: { lat: number; lon: number } | undefined;
  end: { lat: number; lon: number } | undefined;
}

export interface Traffic {
  /** Worst first. */
  incidents: Incident[];
  /** Closures and road work left out because they're on side streets. */
  sideStreets: number;
}

type Box = (typeof site.traffic)['box'];

const KINDS: Record<string, { kind: IncidentKind; label: string }> = {
  accident: { kind: 'accident', label: 'Accident' },
  jam: { kind: 'slow', label: 'Slow traffic' },
  roadClosed: { kind: 'closed', label: 'Closed' },
  laneClosed: { kind: 'lane-closed', label: 'Lane closed' },
  roadWorks: { kind: 'road-work', label: 'Road work' },
  dangerousConditions: { kind: 'hazard', label: 'Hazard' },
  brokenDownVehicle: { kind: 'hazard', label: 'Broken-down vehicle' },
  fog: { kind: 'weather', label: 'Fog' },
  rain: { kind: 'weather', label: 'Rain' },
  ice: { kind: 'weather', label: 'Ice' },
  wind: { kind: 'weather', label: 'Wind' },
  flooding: { kind: 'weather', label: 'Flooding' },
};
/** Worst first. */
const ORDER: IncidentKind[] = [
  'accident',
  'slow',
  'closed',
  'lane-closed',
  'hazard',
  'weather',
  'road-work',
  'other',
];
/** Planned and numerous: shown only on main roads. */
const PLANNED = new Set<IncidentKind>(['closed', 'lane-closed', 'road-work']);

const FIELDS =
  'incidents(type,geometry(type,coordinates),properties(id,iconCategory,magnitudeOfDelay,' +
  'events(description,code,iconCategory),startTime,endTime,from,to,lengthInMeters,' +
  'delayInSeconds,roadNumbers,timeValidity,probabilityOfOccurrence,lastReportTime))';

export function traffic(
  key: string | undefined,
  box: Box = site.traffic.box,
  mainRoads: readonly string[] = site.traffic.mainRoads,
): Source<Traffic> {
  return {
    name: 'TomTom',
    empty: { incidents: [], sideStreets: 0 },
    unconfigured: !key?.trim() ? 'Add TOMTOM_API_KEY to .env to show area traffic.' : undefined,
    async load({ fetcher }) {
      const json = await fetcher.json({
        name: 'TomTom',
        url:
          'https://api.tomtom.com/maps/orbis/traffic/incidents/details?apiVersion=2' +
          `&bbox=${box.west},${box.south},${box.east},${box.north}&timeValidity=present`,
        ttl: 15 * 60_000,
        sample: 'tomtom-incidents.json',
        headers: {
          'tomtom-api-key': key ?? '',
          'tomtom-api-version': '2',
          attributes: FIELDS,
          'accept-language': 'en-US',
        },
        keyed: true,
      });
      if (!Array.isArray(field(json, 'incidents'))) {
        throw new Error("TomTom didn't send a list of incidents.");
      }
      return parseIncidents(json, mainRoads);
    },
  };
}

/** Is this on (or at) one of the main roads? Mile roads always are. */
function onMainRoad(text: string, mainRoads: readonly string[]): boolean {
  if (/\b\d+ Mile (Rd|Road)\b/i.test(text)) return true;
  const lower = text.toLowerCase();
  return mainRoads.some((road) => lower.includes(road.toLowerCase()));
}

/** "Romeo Plank Rd (24 Mile Rd)" → place "Romeo Plank Rd" on road "24 Mile Rd". */
function splitPlace(text: string | undefined): {
  place: string | undefined;
  road: string | undefined;
} {
  if (text === undefined) return { place: undefined, road: undefined };
  const match = /^(.*?)\s*\(([^)]+)\)\s*$/.exec(text);
  return match
    ? { place: match[1] || undefined, road: match[2] }
    : { place: text, road: undefined };
}

function point(coordinate: unknown): { lat: number; lon: number } | undefined {
  const lon = num(field(coordinate, 0));
  const lat = num(field(coordinate, 1));
  return lat === undefined || lon === undefined ? undefined : { lat, lon };
}

export function parseIncidents(
  json: unknown,
  mainRoads: readonly string[] = site.traffic.mainRoads,
): Traffic {
  const incidents = new Map<string, Incident>();
  let sideStreets = 0;

  for (const raw of list(field(json, 'incidents'))) {
    const p = field(raw, 'properties');
    const id = str(field(p, 'id'));
    if (id === undefined) continue;
    const { kind, label } = KINDS[str(field(p, 'iconCategory')) ?? ''] ?? {
      kind: 'other',
      label: 'Incident',
    };

    const from = splitPlace(str(field(p, 'from')));
    const to = splitPlace(str(field(p, 'to')));
    const numbers = list(field(p, 'roadNumbers'))
      .map((number) => str(number))
      .filter((number) => number !== undefined);
    const road =
      numbers.length > 0
        ? numbers.join(', ')
        : from.road !== undefined && (to.road === undefined || to.road === from.road)
          ? from.road
          : to.road;

    const text = [road, str(field(p, 'from')), str(field(p, 'to'))].filter(Boolean).join(' ');
    if (PLANNED.has(kind) && !onMainRoad(text, mainRoads)) {
      sideStreets += 1;
      continue;
    }

    const coordinates = list(field(raw, 'geometry', 'coordinates'));
    const isLine = str(field(raw, 'geometry', 'type')) === 'LineString';
    const delay = num(field(p, 'delayInSeconds'));
    const incident: Incident = {
      id,
      kind,
      label: kind === 'other' ? (str(field(p, 'events', 0, 'description')) ?? label) : label,
      road,
      from: from.place,
      to: to.place,
      bothWays: false,
      delayMin: delay !== undefined && delay >= 60 ? Math.round(delay / 60) : undefined,
      lengthMi: (num(field(p, 'lengthInMeters')) ?? 0) / 1609.344,
      since: date(field(p, 'startTime')),
      until: date(field(p, 'endTime')),
      start: isLine ? point(coordinates[0]) : point(coordinates),
      end: isLine ? point(coordinates.at(-1)) : undefined,
    };

    // The same closure in the other direction: from and to swapped.
    const key = `${kind}|${road ?? ''}|${[incident.from, incident.to].sort().join('|')}`;
    const twin = incidents.get(key);
    if (twin) twin.bothWays = true;
    else incidents.set(key, incident);
  }

  const rank = (incident: Incident) => ORDER.indexOf(incident.kind);
  return {
    incidents: [...incidents.values()].sort(
      (a, b) =>
        rank(a) - rank(b) || (b.delayMin ?? 0) - (a.delayMin ?? 0) || b.lengthMi - a.lengthMi,
    ),
    sideStreets,
  };
}
