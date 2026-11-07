/**
 * Non-secret settings for the console. Secrets never go here: they belong in `.env`
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
}

export const site: SiteConfig = {
  owner: 'Norbert',
  device: {
    model: 'N-586',
    name: 'Personal console',
    revision: '0.1',
  },
  // Defaulted from your commit timestamps (UTC−5). Change if you're elsewhere.
  timeZone: 'America/New_York',
  hourCycle: 'h23',
  locale: 'en-US',
  github: { user: 'norbert586' },
};
