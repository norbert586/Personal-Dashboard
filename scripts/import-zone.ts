/**
 * Bake the delivery zone from OpenStreetMap (ADR-037): `npm run zone:import`.
 *
 * It downloads the zone in small tiles, keeps them in .cache/ (delete the folder to download
 * again), and writes public/zone/{zone}.json, which the delivery mode loads. Builds never run
 * this, so they never touch the network. `--sample` instead saves the few blocks around the store
 * that the unit tests read.
 *
 * From a Claude cloud sandbox, run it with NODE_USE_ENV_PROXY=1.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { MARGIN, buildZone, type OsmElement } from '../src/lib/zone/build.ts';
import { encodeZone, zoneStats, type ZoneFile } from '../src/lib/zone/format.ts';
import { site } from '../src/site.config.ts';

const METRES_PER_MILE = 1609.344;
/** Tiles a side: each must stay under the OSM API's 50,000 nodes a request. */
const TILES = 6;
const PAUSE_MS = 1000;

interface Box {
  south: number;
  west: number;
  north: number;
  east: number;
}

interface Source {
  name: string;
  ask(box: Box): Promise<Response>;
}

const headers = { 'User-Agent': site.userAgent, Accept: 'application/json' };

// The main Overpass server refuses cloud sandboxes; this mirror answers when it's up (CLAUDE.md).
// The OSM API is the fallback: it's meant for editors, so the tiles are small and cached.
const SOURCES: Source[] = [
  {
    name: 'the Overpass mirror',
    ask: ({ south, west, north, east }) => {
      const box = `${south},${west},${north},${east}`;
      const query = `[out:json][timeout:25];(node(${box});way(${box}););(._;>;);out body;rel(${box})[type=multipolygon];out body;`;
      return fetch('https://maps.mail.ru/osm/tools/overpass/api/interpreter', {
        method: 'POST',
        headers,
        body: new URLSearchParams({ data: query }),
        signal: AbortSignal.timeout(30_000),
      });
    },
  },
  {
    name: 'the OpenStreetMap API',
    ask: ({ south, west, north, east }) =>
      fetch(
        `https://api.openstreetmap.org/api/0.6/map.json?bbox=${west},${south},${east},${north}`,
        {
          headers,
          signal: AbortSignal.timeout(90_000),
        },
      ),
  },
];

/** Only what the importer reads: no mapper names, versions or timestamps. */
function strip(raw: unknown): OsmElement[] {
  const elements = (raw as { elements?: unknown }).elements;
  if (!Array.isArray(elements)) throw new Error('the answer has no elements');
  const out: OsmElement[] = [];
  for (const el of elements as Array<Record<string, unknown>>) {
    const tags = el.tags as Record<string, string> | undefined;
    const id = el.id as number;
    if (el.type === 'node')
      out.push({
        type: 'node',
        id,
        lat: el.lat as number,
        lon: el.lon as number,
        ...(tags ? { tags } : {}),
      });
    else if (el.type === 'way')
      out.push({ type: 'way', id, nodes: el.nodes as number[], ...(tags ? { tags } : {}) });
    else if (el.type === 'relation')
      out.push({
        type: 'relation',
        id,
        members: (el.members as Array<{ type: string; ref: number; role: string }>).map((m) => ({
          type: m.type,
          ref: m.ref,
          role: m.role,
        })),
        ...(tags ? { tags } : {}),
      });
  }
  return out;
}

let source = 0;
async function download(box: Box): Promise<OsmElement[]> {
  for (;;) {
    const from = SOURCES[source]!;
    try {
      const response = await from.ask(box);
      if (!response.ok) throw new Error(`answered ${response.status}`);
      return strip(await response.json());
    } catch (error) {
      const why = error instanceof Error ? error.message : String(error);
      if (source === SOURCES.length - 1) throw new Error(`${from.name} failed: ${why}`);
      console.log(`  ${from.name} failed (${why}); using ${SOURCES[source + 1]!.name} instead`);
      source++;
    }
  }
}

/** One row a line, so a re-import shows up in a diff as the rows that changed. */
function serialise(file: ZoneFile): string {
  const lines = Object.entries(file).map(([key, value]) => {
    const rows = Array.isArray(value) && value.every((row) => Array.isArray(row));
    return rows
      ? `${JSON.stringify(key)}:[\n${(value as unknown[]).map((row) => JSON.stringify(row)).join(',\n')}\n]`
      : `${JSON.stringify(key)}:${JSON.stringify(value)}`;
  });
  return `{\n${lines.join(',\n')}\n}\n`;
}

const { store, radiusMiles, zone: name, storeName, storeFront, landmarks } = site.delivery;
const radius = Math.round(radiusMiles * METRES_PER_MILE);

async function sample(): Promise<void> {
  // About three blocks around the store: Auburn, Dequindre and the side streets off them.
  const box = {
    south: store.lat - 0.0016,
    north: store.lat + 0.0016,
    west: store.lon - 0.0022,
    east: store.lon + 0.0022,
  };
  const elements = await download(box);
  const to = 'src/lib/zone/fixtures/osm-auburn-dequindre.json';
  await writeFile(to, `${JSON.stringify({ elements })}\n`);
  console.log(`Saved ${elements.length} elements to ${to}`);
}

async function bake(): Promise<void> {
  const reach = radius + MARGIN + 50;
  const perLat = 111_086;
  const perLon = 111_320 * Math.cos((store.lat * Math.PI) / 180);
  const south = store.lat - reach / perLat;
  const north = store.lat + reach / perLat;
  const west = store.lon - reach / perLon;
  const east = store.lon + reach / perLon;
  const cache = `.cache/zone/${name}`;
  await mkdir(cache, { recursive: true });

  const elements: OsmElement[] = [];
  let downloaded = 0;
  for (let row = 0; row < TILES; row++)
    for (let col = 0; col < TILES; col++) {
      const file = `${cache}/tile-${row}-${col}.json`;
      let tile: OsmElement[];
      try {
        tile = JSON.parse(await readFile(file, 'utf8')) as OsmElement[];
      } catch {
        if (downloaded++) await new Promise((resolve) => setTimeout(resolve, PAUSE_MS));
        const fixed = (v: number) => Number(v.toFixed(5));
        tile = await download({
          south: fixed(south + ((north - south) * row) / TILES),
          north: fixed(south + ((north - south) * (row + 1)) / TILES),
          west: fixed(west + ((east - west) * col) / TILES),
          east: fixed(west + ((east - west) * (col + 1)) / TILES),
        });
        await writeFile(file, JSON.stringify(tile));
        console.log(`  tile ${row * TILES + col + 1} of ${TILES * TILES}: ${tile.length} elements`);
      }
      elements.push(...tile);
    }
  console.log(
    downloaded
      ? `Downloaded ${downloaded} tiles.`
      : `Read ${TILES * TILES} tiles from ${cache} (delete it to download again).`,
  );

  const zone = buildZone(elements, {
    name,
    store,
    radius,
    imported: new Date().toISOString().slice(0, 10),
    shop: { name: storeName, ...storeFront },
    landmarks,
  });
  const to = `public/zone/${name}.json`;
  const text = serialise(encodeZone(zone));
  await mkdir('public/zone', { recursive: true });
  await writeFile(to, text);
  console.log(`Wrote ${to}: ${Math.round(text.length / 1024)} KB`);
  console.table(zoneStats(zone));
}

await (process.argv.includes('--sample') ? sample() : bake());
