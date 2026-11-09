import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { context, fixtures, outage, readLive } from './testing.ts';
import { parseIncidents, traffic } from './traffic.ts';
import type { Fetcher, Upstream } from '../fetcher.ts';

const NOW = new Date('2026-11-09T04:30:00Z');

describe('traffic: saved TomTom sample', () => {
  it('keeps closures on main roads, merges both directions, and counts the side streets', async () => {
    const data = await traffic('key').load(context(fixtures, NOW));
    assert.equal(data.sideStreets, 12);
    assert.deepEqual(
      data.incidents.map((incident) => [
        incident.label,
        incident.road,
        incident.from,
        incident.to,
        incident.bothWays,
      ]),
      [
        ['Closed', 'Clinton River Rd', '19 Mile Rd', 'Canal Rd', false],
        ['Closed', '24 Mile Rd', 'Romeo Plank Rd', 'North Ave', true],
        ['Closed', undefined, 'Dequindre Road / 25 Mile Road', 'Washington Road', true],
        ['Closed', undefined, 'Park Road', 'Mound Road', true],
      ],
    );
    const [first] = data.incidents;
    assert.ok(Math.abs((first?.lengthMi ?? 0) - 1.16) < 0.01);
    assert.equal(first?.since?.toISOString().slice(0, 10), '2026-09-22');
    assert.equal(first?.delayMin, undefined); // closures have no delay figure
    assert.deepEqual(first?.start && [first.start.lat.toFixed(3), first.start.lon.toFixed(3)], [
      '42.610',
      '-83.019',
    ]);
  });

  it('sends the key in its header, never in the URL', async () => {
    const asked: Upstream[] = [];
    const recording: Fetcher = {
      json: (upstream) => {
        asked.push(upstream);
        return fixtures.json(upstream);
      },
      text: fixtures.text,
    };
    await traffic('tt-key').load(context(recording, NOW));
    const [upstream] = asked;
    assert.equal(upstream?.headers?.['tomtom-api-key'], 'tt-key');
    assert.equal(upstream?.keyed, true);
    assert.doesNotMatch(upstream?.url ?? '', /tt-key|key=/);
    assert.match(upstream?.url ?? '', /bbox=-83\.12,42\.6,-82\.88,42\.8&/);
  });
});

describe('traffic: incidents', () => {
  const incident = (id: string, properties: Record<string, unknown>, geometry?: unknown) => ({
    type: 'Feature',
    geometry: geometry ?? {
      type: 'LineString',
      coordinates: [
        [-83.03, 42.7],
        [-83.03, 42.71],
      ],
    },
    properties: { id, lengthInMeters: 1609.344, roadNumbers: [], events: [], ...properties },
  });

  it('always shows accidents and slowdowns, worst first, even off the main roads', () => {
    const data = parseIncidents({
      incidents: [
        incident('1', { iconCategory: 'roadClosed', from: 'Mound Road', to: 'Park Road' }),
        incident('2', {
          iconCategory: 'jam',
          from: 'M-53 (Van Dyke Fwy)',
          to: '26 Mile Rd (Van Dyke Fwy)',
          roadNumbers: ['M-53'],
          delayInSeconds: 300,
        }),
        incident('3', { iconCategory: 'accident', from: 'Ross Lane', to: 'Copper Circle' }),
        incident('4', { iconCategory: 'roadWorks', from: 'Ross Lane', to: 'Copper Circle' }),
      ],
    });
    assert.deepEqual(
      data.incidents.map((item) => [item.label, item.road, item.delayMin]),
      [
        ['Accident', undefined, undefined],
        ['Slow traffic', 'M-53', 5],
        ['Closed', undefined, undefined],
      ],
    );
    assert.equal(data.sideStreets, 1); // the road work on Ross Lane
  });

  it('names unknown kinds from their description, and places point incidents', () => {
    const [item] = parseIncidents({
      incidents: [
        incident(
          '5',
          {
            iconCategory: 'somethingNew',
            events: [{ description: 'Animal on road' }],
            from: '24 Mile Rd',
          },
          { type: 'Point', coordinates: [-83.0, 42.69] },
        ),
      ],
    }).incidents;
    assert.equal(item?.label, 'Animal on road');
    assert.equal(item?.kind, 'other');
    assert.deepEqual(item?.start, { lat: 42.69, lon: -83.0 });
    assert.equal(item?.end, undefined);
  });
});

describe('traffic: keys and outages', () => {
  it('asks for the key when there is none, or an empty one', () => {
    assert.match(traffic(undefined).unconfigured ?? '', /Add TOMTOM_API_KEY/);
    assert.match(traffic(' ').unconfigured ?? '', /Add TOMTOM_API_KEY/);
    assert.equal(traffic('key').unconfigured, undefined);
  });

  it('is offline when TomTom refuses the key', async () => {
    const reading = await readLive(
      traffic('wrong'),
      outage('TomTom refused the key (403). Check it in .env.'),
      NOW,
    );
    assert.equal(reading.provenance, 'offline');
    assert.equal(reading.detail, 'TomTom refused the key (403). Check it in .env.');
  });

  it("refuses an answer that isn't a list of incidents", async () => {
    const fetcher: Fetcher = {
      json: async () => ({ detailedError: { code: 'INVALID_REQUEST' } }),
      text: async () => '',
    };
    const reading = await readLive(traffic('key'), fetcher, NOW);
    assert.equal(reading.detail, "TomTom didn't send a list of incidents.");
  });
});
