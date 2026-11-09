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
  /** Headlines by section (ADR-017). Each outlet is an RSS or Atom feed, or Hacker News. */
  news: Record<NewsSection, Outlet[]>;
}

export type NewsSection = 'local' | 'tech' | 'national' | 'world';

export interface Outlet {
  /** Stable id, also the saved sample's name: rss-{id}.xml. */
  id: string;
  name: string;
  /** The RSS or Atom feed; Hacker News uses its own API instead. */
  feed: string | 'hacker-news';
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
  news: {
    local: [
      {
        id: 'clickondetroit',
        name: 'ClickOnDetroit',
        feed: 'https://www.clickondetroit.com/arc/outboundfeeds/rss/category/news/local/?outputType=xml',
      },
      { id: 'wdet', name: 'WDET', feed: 'https://wdet.org/feed/' },
      { id: 'bridgemi', name: 'Bridge Michigan', feed: 'https://www.bridgemi.com/rss.xml' },
    ],
    tech: [
      {
        id: 'arstechnica',
        name: 'Ars Technica',
        feed: 'https://feeds.arstechnica.com/arstechnica/index',
      },
      { id: 'theverge', name: 'The Verge', feed: 'https://www.theverge.com/rss/index.xml' },
      { id: 'hacker-news', name: 'Hacker News', feed: 'hacker-news' },
    ],
    national: [
      { id: 'npr-national', name: 'NPR', feed: 'https://feeds.npr.org/1003/rss.xml' },
      {
        id: 'pbs-newshour',
        name: 'PBS News Hour',
        feed: 'https://www.pbs.org/newshour/feeds/rss/headlines',
      },
    ],
    world: [
      { id: 'bbc-world', name: 'BBC World', feed: 'https://feeds.bbci.co.uk/news/world/rss.xml' },
      { id: 'npr-world', name: 'NPR World', feed: 'https://feeds.npr.org/1004/rss.xml' },
    ],
  },
};

function espn(sport: string, league: string, team: string): Team['espn'] {
  return { sport, league, team };
}
