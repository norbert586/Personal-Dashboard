/**
 * Weather from the National Weather Service (free, no key, ADR-015): the latest observation at the
 * nearest station and the 7-day forecast for the town's point. The point's forecast and station
 * addresses change rarely, so they're looked up once a day.
 */
import type { Fetcher, Upstream } from '../fetcher.ts';
import { compass, type CompassPoint } from '../geo.ts';
import { date, field, list, num, str } from '../json.ts';
import type { Source } from '../readings.ts';
import { formatWeekday, isoDate } from '../time.ts';
import { site } from '../../site.config.ts';

/** The handful of skies the panel draws and the town renders. */
export type Sky = 'clear' | 'partly' | 'cloudy' | 'rain' | 'snow' | 'storm' | 'fog';

export interface Conditions {
  /** Whole °F; missing when the station didn't report it. */
  tempF: number | undefined;
  text: string;
  sky: Sky;
  /** Whole mph; 0 is calm. */
  windMph: number | undefined;
  /** Where the wind blows from. */
  windFrom: { degrees: number; point: CompassPoint } | undefined;
  observedAt: Date;
  station: string;
}

export interface Period {
  /** As the NWS names it: "Tonight", "Monday", "Veterans Day". */
  name: string;
  start: Date;
  isDaytime: boolean;
  tempF: number;
  text: string;
  sky: Sky;
  /** Chance of precipitation, 0–100. */
  precipChance: number | undefined;
  /** "5 to 10 mph WNW" */
  wind: string;
}

export interface Day {
  /** YYYY-MM-DD in the town's time zone. */
  date: string;
  /** "Mon", from the date: period names can be holidays. */
  weekday: string;
  highF: number | undefined;
  lowF: number | undefined;
  text: string;
  sky: Sky;
  precipChance: number | undefined;
}

export interface Weather {
  place: string;
  now: Conditions | undefined;
  periods: Period[];
  days: Day[];
}

const NWS = 'the National Weather Service';
const API = 'https://api.weather.gov/';
const GEOJSON = { accept: 'application/geo+json' };
const MINUTE = 60_000;
const DAY = 24 * 60 * MINUTE;

export function weather(place: SiteConfigPlace = site.place): Source<Weather> {
  return {
    name: 'National Weather Service',
    empty: { place: place.name, now: undefined, periods: [], days: [] },
    async load({ fetcher, problem }) {
      const point = await fetcher.json(
        nws(`${API}points/${place.lat},${place.lon}`, DAY, 'nws-points.json'),
      );
      const forecastUrl = apiUrl(field(point, 'properties', 'forecast'));
      const stationsUrl = apiUrl(field(point, 'properties', 'observationStations'));
      if (forecastUrl === undefined) {
        throw new Error("The National Weather Service didn't say where this point's forecast is.");
      }

      const [forecast, now] = await Promise.all([
        fetcher.json(nws(forecastUrl, 15 * MINUTE, 'nws-forecast.json')),
        latestConditions(fetcher, stationsUrl).catch((error: unknown) => {
          problem(`No current conditions: ${error instanceof Error ? error.message : error}`);
          return undefined;
        }),
      ]);

      const periods = parsePeriods(forecast);
      if (periods.length === 0) {
        throw new Error('The National Weather Service sent a forecast with no periods.');
      }
      return { place: place.name, now, periods, days: summarizeDays(periods) };
    },
  };
}

type SiteConfigPlace = typeof site.place;

function nws(url: string, ttl: number, sample: string): Upstream {
  return { name: NWS, url, ttl, sample, headers: GEOJSON };
}

/** Only follow links that stay on the NWS API. */
function apiUrl(value: unknown): string | undefined {
  const url = str(value);
  return url?.startsWith(API) ? url : undefined;
}

async function latestConditions(
  fetcher: Fetcher,
  stationsUrl: string | undefined,
): Promise<Conditions | undefined> {
  if (stationsUrl === undefined) throw new Error('no stations are listed for this point.');
  const stations = await fetcher.json(nws(`${stationsUrl}?limit=3`, DAY, 'nws-stations.json'));
  const id = str(field(stations, 'features', 0, 'properties', 'stationIdentifier'));
  if (id === undefined || !/^[A-Z0-9]{3,5}$/.test(id)) {
    throw new Error('no station is listed near this point.');
  }
  const observation = await fetcher.json(
    nws(`${API}stations/${id}/observations/latest`, 10 * MINUTE, 'nws-observation.json'),
  );
  const conditions = parseObservation(observation);
  if (conditions === undefined) throw new Error(`station ${id} sent an empty observation.`);
  return conditions;
}

/** The latest observation, or undefined when it has no time or description. */
export function parseObservation(json: unknown): Conditions | undefined {
  const p = field(json, 'properties');
  const observedAt = date(field(p, 'timestamp'));
  const text = str(field(p, 'textDescription'));
  if (observedAt === undefined || text === undefined) return undefined;

  const temp = num(field(p, 'temperature', 'value'));
  const tempUnit = str(field(p, 'temperature', 'unitCode')) ?? '';
  const speed = num(field(p, 'windSpeed', 'value'));
  const speedUnit = str(field(p, 'windSpeed', 'unitCode')) ?? '';
  const from = num(field(p, 'windDirection', 'value'));

  const tempF = temp === undefined ? undefined : tempUnit.endsWith('degF') ? temp : temp * 1.8 + 32;
  const mph =
    speed === undefined
      ? undefined
      : speedUnit.endsWith('m_s-1')
        ? speed * 2.236936
        : speed / 1.609344; // wmoUnit:km_h-1, the NWS default
  const windMph = mph === undefined ? undefined : Math.round(mph);

  return {
    tempF: tempF === undefined ? undefined : Math.round(tempF),
    text,
    sky: skyFrom(text),
    windMph,
    windFrom:
      from === undefined || windMph === 0 ? undefined : { degrees: from, point: compass(from) },
    observedAt,
    station: str(field(p, 'stationName')) ?? 'the nearest station',
  };
}

/** Forecast periods, oldest first. Periods missing a name, time, temperature or text are skipped. */
export function parsePeriods(json: unknown): Period[] {
  const periods: Period[] = [];
  for (const raw of list(field(json, 'properties', 'periods'))) {
    const name = str(field(raw, 'name'));
    const start = date(field(raw, 'startTime'));
    const temp = num(field(raw, 'temperature'));
    const text = str(field(raw, 'shortForecast'));
    if (name === undefined || start === undefined || temp === undefined || text === undefined) {
      continue;
    }
    const celsius = str(field(raw, 'temperatureUnit')) === 'C';
    const precip = num(field(raw, 'probabilityOfPrecipitation', 'value'));
    periods.push({
      name,
      start,
      isDaytime: field(raw, 'isDaytime') === true,
      tempF: Math.round(celsius ? temp * 1.8 + 32 : temp),
      text,
      sky: skyFrom(text),
      precipChance: precip === undefined ? undefined : Math.round(precip),
      wind: [str(field(raw, 'windSpeed')), str(field(raw, 'windDirection'))]
        .filter((part) => part !== undefined)
        .join(' '),
    });
  }
  return periods.sort((a, b) => a.start.getTime() - b.start.getTime());
}

const HOUR = 60 * MINUTE;

/**
 * One entry per day: the daytime period gives the high and the sky, the night after it the low.
 * A night belongs to the evening it starts on, even when it starts after midnight ("Overnight").
 */
export function summarizeDays(periods: readonly Period[]): Day[] {
  const days = new Map<string, { day?: Period; night?: Period }>();
  for (const period of periods) {
    const key = isoDate(
      period.isDaytime ? period.start : new Date(period.start.getTime() - 12 * HOUR),
    );
    const slot = days.get(key) ?? {};
    if (period.isDaytime) slot.day ??= period;
    else slot.night ??= period;
    days.set(key, slot);
  }

  const summary: Day[] = [];
  for (const [key, { day, night }] of days) {
    const lead = day ?? night;
    if (lead === undefined) continue;
    const chances = [day?.precipChance, night?.precipChance].filter(
      (chance) => chance !== undefined,
    );
    summary.push({
      date: key,
      weekday: formatWeekday(lead.start),
      highF: day?.tempF,
      lowF: night?.tempF,
      text: lead.text,
      sky: lead.sky,
      precipChance: chances.length > 0 ? Math.max(...chances) : undefined,
    });
  }
  return summary;
}

/**
 * The sky for a forecast or observation in words ("Chance Rain And Snow", "Mostly Cloudy").
 * The most significant weather wins: storms, then snow and ice, rain, fog, then cloud cover.
 */
export function skyFrom(text: string): Sky {
  const t = text.toLowerCase();
  if (/thunder|t-storm|tstorm/.test(t)) return 'storm';
  if (/snow|flurr|sleet|blizzard|\bice\b|freezing (rain|drizzle)|wintry/.test(t)) return 'snow';
  if (/rain|shower|drizzle|sprinkle/.test(t)) return 'rain';
  if (/fog|haze|smoke|mist|dust/.test(t)) return 'fog';
  if (/partly|mostly sunny|mostly clear|few clouds|scattered clouds|decreasing clouds/.test(t)) {
    return 'partly';
  }
  if (/cloud|overcast/.test(t)) return 'cloudy';
  if (/sunny|clear|fair/.test(t)) return 'clear';
  return 'cloudy';
}
