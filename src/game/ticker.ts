/**
 * The town's heads-up line: one feed at a time in plain words, from the same answers the Today
 * panel shows. It's where feeds without a building yet (traffic, until M-53 brings the freeway
 * sign) show up in town, and where an offline feed says so and why (SPEC: Data rules). Pure.
 */
import type { TownFeeds, WireReading } from './feeds.ts';

const feet = new Intl.NumberFormat('en-US');

/** A line for one feed: its words, marked when they're a saved sample; or why it's offline. */
function line<T>(
  name: string,
  reading: WireReading<T>,
  words: (data: typeof reading.data) => string,
) {
  if (reading.provenance === 'offline') return `${name} is offline. ${reading.detail ?? ''}`.trim();
  return `${words(reading.data)}${reading.provenance === 'sample' ? ' (sample data)' : ''}`;
}

/**
 * The lines to cycle through. With no feeds at all, the one line says why (`problem`); a weather
 * preview is named as one, so it never passes for the forecast.
 */
export function tickerLines(
  feeds: TownFeeds | null,
  problem: string | null,
  preview: string | null = null,
): string[] {
  if (!feeds) return [problem ?? 'Reading the morning update…'];
  const lines: string[] = [];
  if (preview) lines.push(`Weather preview: ${preview}. The real forecast is on Today.`);
  lines.push(
    line('Weather', feeds.weather, ({ now, periods }) => {
      const first = periods[0];
      if (!now) return first ? `${first.name}: ${first.text}` : 'No forecast right now';
      const wind =
        now.windMph === undefined
          ? ''
          : now.windMph === 0
            ? ', calm'
            : `, wind ${now.windFrom ? `${now.windFrom.point} ` : ''}${now.windMph} mph`;
      return `${now.tempF ?? '–'}°F, ${now.text.toLowerCase()}${wind}`;
    }),
    line('Traffic', feeds.traffic, ({ incidents }) => {
      const worst = incidents[0];
      if (!worst) return 'Traffic: nothing reported on the main roads';
      const more = incidents.length > 1 ? `, and ${incidents.length - 1} more` : '';
      return `Traffic: ${worst.label.toLowerCase()}${worst.road ? ` on ${worst.road}` : ''}${more}`;
    }),
    line('Scores', feeds.scores, (teams) => {
      const live = teams.find((team) => team.live);
      if (live?.live?.score) {
        const g = live.live;
        return `Live: ${live.name} ${g.score!.us}–${g.score!.them} ${g.home || g.neutral ? 'vs' : 'at'} ${g.opponent.abbreviation}`;
      }
      const latest = teams
        .filter((team) => team.last?.score && team.last.result)
        .sort((a, b) => Date.parse(b.last!.start) - Date.parse(a.last!.start))[0];
      if (!latest?.last) return 'Scores: no games lately';
      const g = latest.last;
      const verb = g.result === 'W' ? 'won' : g.result === 'L' ? 'lost' : 'tied';
      return `${latest.name} ${verb} ${g.score!.us}–${g.score!.them} ${g.home || g.neutral ? 'vs' : 'at'} ${g.opponent.abbreviation}`;
    }),
    line('Local news', feeds.news.local, (headlines) =>
      headlines[0] ? `Local: ${headlines[0].title}` : 'Local news: no headlines right now',
    ),
    line('Movies', feeds.movies, ({ movies }) =>
      movies.length
        ? `Now playing: ${movies
            .slice(0, 3)
            .map((movie) => movie.title)
            .join(', ')}`
        : 'Movies: nothing listed',
    ),
    line('New comics', feeds.comics, ({ groups, current }) => {
      const total = groups.reduce((sum, group) => sum + group.comics.length, 0);
      return `${total} new ${total === 1 ? 'comic' : 'comics'} ${current ? 'this week' : 'last week'}`;
    }),
    line('Flights', feeds.flights, ({ aircraft, radiusMi }) => {
      const nearest = aircraft[0];
      if (!nearest) return `Nothing in the air within ${Math.round(radiusMi)} miles`;
      const who = nearest.callsign ?? nearest.registration ?? nearest.hex.toUpperCase();
      const height =
        nearest.altitudeFt === undefined ? '' : ` at ${feet.format(nearest.altitudeFt)} ft`;
      return `${aircraft.length} aircraft within ${Math.round(radiusMi)} miles. Nearest: ${who}, ${Math.round(nearest.distanceMi)} mi ${nearest.direction}${height}`;
    }),
  );
  return lines;
}
