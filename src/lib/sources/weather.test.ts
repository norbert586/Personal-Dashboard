import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { context, fixture, fixtures, outage, readLive } from './testing.ts';
import { parseObservation, parsePeriods, skyFrom, summarizeDays, weather } from './weather.ts';
import type { Fetcher } from '../fetcher.ts';

// The saved samples were captured late on Sunday 8 November 2026, Detroit time.
const NOW = new Date('2026-11-09T04:30:00Z');

describe('weather: saved NWS sample', () => {
  it('reads the latest observation in °F and mph', async () => {
    const now = parseObservation(await fixture('nws-observation.json'));
    assert.ok(now);
    assert.equal(now.tempF, 52); // 11.2 °C
    assert.equal(now.text, 'Mostly Cloudy');
    assert.equal(now.sky, 'cloudy');
    assert.equal(now.windMph, 5); // 7.56 km/h
    assert.deepEqual(now.windFrom, { degrees: 280, point: 'W' });
    assert.equal(now.station, 'Selfridge Air National Guard Base');
    assert.equal(now.observedAt.toISOString(), '2026-11-09T03:56:00.000Z');
  });

  it('reads every forecast period in order', async () => {
    const periods = parsePeriods(await fixture('nws-forecast.json'));
    assert.equal(periods.length, 14);
    assert.deepEqual(
      { ...periods[0], start: periods[0]?.start.toISOString() },
      {
        name: 'Tonight',
        start: '2026-11-09T03:00:00.000Z',
        isDaytime: false,
        tempF: 37,
        text: 'Mostly Cloudy',
        sky: 'cloudy',
        precipChance: 7,
        wind: '9 mph W',
      },
    );
  });

  it('pairs each day with the night after it, naming days by date, not by holiday', async () => {
    const days = summarizeDays(parsePeriods(await fixture('nws-forecast.json')));
    assert.equal(days.length, 8);
    // Late Sunday evening only "Tonight" is left, so Sunday has a low and no high.
    assert.deepEqual(days[0], {
      date: '2026-11-08',
      weekday: 'Sun',
      highF: undefined,
      lowF: 37,
      text: 'Mostly Cloudy',
      sky: 'cloudy',
      precipChance: 7,
    });
    // The NWS calls Wednesday "Veterans Day".
    assert.deepEqual(days[3], {
      date: '2026-11-11',
      weekday: 'Wed',
      highF: 56,
      lowF: 36,
      text: 'Partly Sunny then Slight Chance Light Rain',
      sky: 'rain',
      precipChance: 51,
    });
    assert.equal(days[5]?.sky, 'snow'); // Friday: Chance Rain And Snow
    assert.equal(days[7]?.lowF, undefined); // Sunday night is past the forecast
  });

  it('counts a night that starts after midnight as the evening before', () => {
    const period = (name: string, iso: string, isDaytime: boolean, tempF: number) => ({
      name,
      start: new Date(iso),
      isDaytime,
      tempF,
      text: 'Clear',
      sky: 'clear' as const,
      precipChance: undefined,
      wind: '',
    });
    const days = summarizeDays([
      period('Overnight', '2026-11-10T06:00:00Z', false, 31), // 1 AM Tuesday in Detroit
      period('Tuesday', '2026-11-10T11:00:00Z', true, 50),
      period('Tuesday Night', '2026-11-10T23:00:00Z', false, 33),
    ]);
    assert.deepEqual(
      days.map((day) => [day.date, day.highF, day.lowF]),
      [
        ['2026-11-09', undefined, 31],
        ['2026-11-10', 50, 33],
      ],
    );
  });

  it('loads the whole feed from the saved samples', async () => {
    const ctx = context(fixtures, NOW);
    const data = await weather().load(ctx);
    assert.equal(data.place, 'Washington Twp');
    assert.equal(data.now?.tempF, 52);
    assert.equal(data.days.length, 8);
    assert.deepEqual(ctx.problems, []);
  });
});

describe('weather: sky words', () => {
  const cases: Array<[string, ReturnType<typeof skyFrom>]> = [
    ['Sunny', 'clear'],
    ['Clear', 'clear'],
    ['Fair', 'clear'],
    ['Mostly Sunny', 'partly'],
    ['Partly Cloudy', 'partly'],
    ['A Few Clouds', 'partly'],
    ['Mostly Cloudy', 'cloudy'],
    ['Overcast', 'cloudy'],
    ['Partly Sunny then Slight Chance Light Rain', 'rain'],
    ['Rain Showers Likely', 'rain'],
    ['Chance Rain And Snow', 'snow'],
    ['Snow Showers', 'snow'],
    ['Freezing Rain', 'snow'],
    ['Patchy Freezing Fog', 'fog'],
    ['Haze', 'fog'],
    ['Chance Showers And Thunderstorms', 'storm'],
    ['Windy', 'cloudy'],
  ];
  for (const [text, sky] of cases) {
    it(`"${text}" is ${sky}`, () => assert.equal(skyFrom(text), sky));
  }
});

describe('weather: when things go wrong', () => {
  it('still shows the forecast when the station is down, and says so', async () => {
    const fetcher = outage(
      "The National Weather Service didn't answer within 8 s.",
      (upstream) => upstream.sample === 'nws-observation.json',
    );
    const ctx = context(fetcher, NOW);
    const data = await weather().load(ctx);
    assert.equal(data.now, undefined);
    assert.equal(data.days.length, 8);
    assert.deepEqual(ctx.problems, [
      "No current conditions: The National Weather Service didn't answer within 8 s.",
    ]);
  });

  it('is offline, with the reason, when the NWS is unreachable', async () => {
    const reading = await readLive(
      weather(),
      outage("Couldn't reach the National Weather Service (ENOTFOUND)."),
      NOW,
    );
    assert.equal(reading.provenance, 'offline');
    assert.equal(reading.detail, "Couldn't reach the National Weather Service (ENOTFOUND).");
    assert.deepEqual(reading.data.days, []);
  });

  it("won't follow a forecast link off the NWS API", async () => {
    const fetcher: Fetcher = {
      json: async () => ({ properties: { forecast: 'https://example.com/forecast' } }),
      text: async () => '',
    };
    const reading = await readLive(weather(), fetcher, NOW);
    assert.equal(reading.provenance, 'offline');
    assert.match(reading.detail ?? '', /didn't say where this point's forecast is/);
  });
});
