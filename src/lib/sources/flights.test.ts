import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { context, fixture, fixtures, readLive } from './testing.ts';
import { flights, parseAircraft } from './flights.ts';
import type { Fetcher } from '../fetcher.ts';
import { site } from '../../site.config.ts';

const NOW = new Date('2026-11-09T04:30:00Z');

describe('flights: saved adsb.lol sample', () => {
  it('lists every aircraft with a position, nearest first', async () => {
    const data = await flights().load(context(fixtures, NOW));
    assert.equal(data.via, 'adsb.lol');
    assert.equal(data.aircraft.length, 15);
    const distances = data.aircraft.map((aircraft) => aircraft.distanceMi);
    assert.deepEqual(
      distances,
      [...distances].sort((a, b) => a - b),
    );

    const [nearest] = data.aircraft;
    assert.equal(nearest?.callsign, 'N831VP'); // the broadcast pads callsigns with spaces
    assert.equal(nearest?.type, 'C650');
    assert.equal(nearest?.altitudeFt, 2650);
    assert.equal(nearest?.speedKt, 167.1);
    assert.equal(nearest?.direction, 'WSW');
    assert.equal(nearest?.onGround, false);
  });

  it("agrees with adsb.lol's own distance and bearing from the town", async () => {
    const json = (await fixture('adsblol-point.json')) as {
      ac: Array<{ hex: string; dst: number; dir: number }>;
    };
    const parsed = parseAircraft(json, site.place);
    for (const raw of json.ac) {
      const aircraft = parsed.find((entry) => entry.hex === raw.hex)!;
      assert.ok(Math.abs(aircraft.distanceMi - raw.dst * 1.150779) < 0.1, raw.hex);
      assert.ok(Math.abs(aircraft.bearing - raw.dir) < 1, raw.hex);
    }
  });

  it('knows aircraft on the ground at Detroit Metro, and ones that send no type', async () => {
    const data = await flights().load(context(fixtures, NOW));
    const taxiing = data.aircraft.find((aircraft) => aircraft.callsign === 'AAL1287');
    assert.equal(taxiing?.onGround, true);
    assert.equal(taxiing?.altitudeFt, undefined);
    assert.equal(
      data.aircraft.find((aircraft) => aircraft.callsign === 'DAL2255')?.type,
      undefined,
    );
  });
});

describe('flights: flags and filters', () => {
  const plane = (extra: Record<string, unknown>) => ({
    hex: 'ae1234',
    lat: 42.73,
    lon: -83.0,
    alt_baro: 9000,
    seen_pos: 1,
    ...extra,
  });

  it('flags military airframes and emergencies in words', () => {
    const [aircraft] = parseAircraft(
      { ac: [plane({ dbFlags: 1, squawk: '7700', emergency: 'none' })] },
      site.place,
    );
    assert.equal(aircraft?.military, true);
    assert.equal(aircraft?.emergency, 'Emergency');
    const [quiet] = parseAircraft({ ac: [plane({ emergency: 'nordo' })] }, site.place);
    assert.equal(quiet?.emergency, 'Radio failure');
    assert.equal(quiet?.military, false);
  });

  it('leaves out stale positions and aircraft with no position', () => {
    const parsed = parseAircraft(
      {
        ac: [
          plane({ hex: 'stale', seen_pos: 120 }),
          { hex: 'nowhere', alt_baro: 30000 },
          plane({ hex: '~tisb01' }),
        ],
      },
      site.place,
    );
    assert.deepEqual(
      parsed.map((aircraft) => aircraft.hex),
      ['tisb01'],
    );
  });
});

describe('flights: when a network is down', () => {
  it('asks airplanes.live when adsb.lol is down', async () => {
    const sample = await fixture('adsblol-point.json');
    const fetcher: Fetcher = {
      json: async (upstream) => {
        if (upstream.name === 'adsb.lol') throw new Error('adsb.lol answered 502.');
        assert.match(
          upstream.url,
          /^https:\/\/api\.airplanes\.live\/v2\/point\/42\.72\/-83\.03\/25$/,
        );
        return sample;
      },
      text: async () => '',
    };
    const data = await flights().load(context(fetcher, NOW));
    assert.equal(data.via, 'airplanes.live');
    assert.equal(data.aircraft.length, 15);
  });

  it('is offline, naming both networks, when neither answers', async () => {
    const fetcher: Fetcher = {
      json: async (upstream) => {
        throw new Error(`${upstream.name} answered 503.`);
      },
      text: async () => '',
    };
    const reading = await readLive(flights(), fetcher, NOW);
    assert.equal(reading.provenance, 'offline');
    assert.equal(reading.detail, 'adsb.lol answered 503. airplanes.live answered 503.');
    assert.deepEqual(reading.data.aircraft, []);
  });

  it('reads an empty sky as live, with no aircraft', async () => {
    const fetcher: Fetcher = {
      json: async () => ({ ac: [], msg: 'No error' }),
      text: async () => '',
    };
    const reading = await readLive(flights(), fetcher, NOW);
    assert.equal(reading.provenance, 'live');
    assert.deepEqual(reading.data.aircraft, []);
  });
});
