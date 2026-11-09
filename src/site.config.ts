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
};
