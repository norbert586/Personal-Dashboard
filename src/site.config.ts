/**
 * Non-secret settings for the site. Secrets never go here: they belong in `.env`
 * and `astro.config.mjs` → `env.schema`.
 */
export interface SiteConfig {
  owner: string;
  device: { model: string; name: string; revision: string };
  /** IANA zone used for the clock, greeting and agenda. */
  timeZone: string;
  /** 'h23' = 24-hour clock, 'h12' = 12-hour clock. */
  hourCycle: 'h23' | 'h12';
  locale: string;
  github: { user: string };
  /** The real place the town is based on. Weather is forecast for this point. */
  place: { name: string; lat: number; lon: number };
  /** How the server introduces itself to the APIs it asks (some refuse anonymous clients). */
  userAgent: string;
  /** The teams on the scoreboard, in the order shown. */
  teams: Team[];
}

export interface Team {
  /** Stable id for the town and the saved samples: "red-wings". */
  id: string;
  name: string;
  league: string;
  /** Where ESPN keeps the team: sports/{sport}/{league}/teams/{team}. */
  espn: { sport: string; league: string; team: string };
  /** The league's own API, asked when ESPN can't answer. */
  backup?: { api: 'nhl'; team: string } | { api: 'mlb'; team: number };
}

export const site: SiteConfig = {
  owner: 'Norbert',
  device: {
    model: 'N-586',
    name: 'Personal console',
    revision: '0.1',
  },
  // The town's real zone (Macomb County, Michigan).
  timeZone: 'America/Detroit',
  hourCycle: 'h23',
  locale: 'en-US',
  github: { user: 'norbert586' },
  // About 26 Mile and Van Dyke, the middle of the real grid (docs/SPEC.md, The map).
  place: { name: 'Washington Twp', lat: 42.72, lon: -83.03 },
  userAgent: 'RatiuTwp/0.1 (+https://github.com/norbert586/Personal-Dashboard)',
  teams: [
    { id: 'pistons', name: 'Pistons', league: 'NBA', espn: espn('basketball', 'nba', '8') },
    { id: 'lions', name: 'Lions', league: 'NFL', espn: espn('football', 'nfl', '8') },
    {
      id: 'tigers',
      name: 'Tigers',
      league: 'MLB',
      espn: espn('baseball', 'mlb', '6'),
      backup: { api: 'mlb', team: 116 },
    },
    {
      id: 'red-wings',
      name: 'Red Wings',
      league: 'NHL',
      espn: espn('hockey', 'nhl', '5'),
      backup: { api: 'nhl', team: 'DET' },
    },
    {
      id: 'michigan-basketball',
      name: 'Michigan basketball',
      league: 'NCAA',
      espn: espn('basketball', 'mens-college-basketball', '130'),
    },
    {
      id: 'michigan-football',
      name: 'Michigan football',
      league: 'NCAA',
      espn: espn('football', 'college-football', '130'),
    },
    {
      id: 'georgia-tech-football',
      name: 'Georgia Tech football',
      league: 'NCAA',
      espn: espn('football', 'college-football', '59'),
    },
  ],
};

function espn(sport: string, league: string, team: string): Team['espn'] {
  return { sport, league, team };
}
