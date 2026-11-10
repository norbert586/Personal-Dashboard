// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import node from '@astrojs/node';
import { loadEnv } from 'vite';

// Two builds from one codebase (ADR-034). The default is the Node server for home, behind the
// access gate. DEPLOY_TARGET=pages writes plain files for GitHub Pages instead: every page and
// the feeds are rendered once at build time, and a scheduled workflow rebuilds them.
const { DEPLOY_TARGET } = loadEnv(process.env.NODE_ENV ?? 'production', process.cwd(), '');
const pages = DEPLOY_TARGET === 'pages';
/** GitHub serves a project's pages under its repository's name. */
const PAGES_BASE = '/Personal-Dashboard';

// Fonts are self-hosted from installed @fontsource packages (latin subset), with no
// third-party CDN at build or run time. We use the `local` provider with explicit files
// because `npm({ remote: false })` emits file:// URLs that Astro 7.4's font-metrics step
// can't read yet.
const local = fontProviders.local();
/** @param {string} pkg @param {string} file @param {number} weight */
const face = (pkg, file, weight) => ({
  src: /** @type {[string]} */ ([`@fontsource/${pkg}/files/${file}`]),
  weight,
  style: /** @type {const} */ ('normal'),
});

export default defineConfig({
  // Private, data-driven pages are rendered per request on our own server (ADR-002); the
  // GitHub Pages build renders them once, into its own folder so both builds can sit side by side.
  ...(pages
    ? { output: 'static', base: PAGES_BASE, outDir: './dist-pages' }
    : { output: 'server', adapter: node({ mode: 'standalone' }) }),

  // Content Security Policy: Astro hashes every script/style it emits (ADR-004).
  // Consequence: no inline style="" attributes or define:vars anywhere.
  security: { csp: true },
  // Shiki's inline styles are incompatible with the CSP, and we don't render code blocks.
  markdown: { syntaxHighlight: false },
  // The town's bundle is mostly three.js, about 150 KB gzipped (ADR-010), and loads on the home
  // page only.
  vite: { build: { chunkSizeWarningLimit: 700 } },

  env: {
    schema: {
      // How the access gate decides who may see the console (src/lib/access.ts).
      // Unset in production = deny everyone. `access: 'secret'` makes it a runtime
      // value (read when the server starts), not something baked in at build time.
      ACCESS_MODE: envField.enum({
        context: 'server',
        access: 'secret',
        values: ['private-network'],
        optional: true,
      }),
      // Which build this is (see the top of this file). Known at build time, so it's `public`.
      DEPLOY_TARGET: envField.enum({
        context: 'server',
        access: 'public',
        values: ['server', 'pages'],
        default: 'server',
      }),
      // Where feeds come from (src/lib/feeds.ts): `live` asks the real APIs; `sample` answers
      // from the saved samples in src/lib/sources/fixtures/ with no network (tests, demos).
      FEEDS: envField.enum({
        context: 'server',
        access: 'secret',
        values: ['live', 'sample'],
        default: 'live',
      }),
      // Free API keys for the feeds. A missing one shows that feed's saved sample.
      TMDB_READ_TOKEN: envField.string({ context: 'server', access: 'secret', optional: true }),
      TOMTOM_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
      COMIC_VINE_API_KEY: envField.string({ context: 'server', access: 'secret', optional: true }),
    },
  },

  // The game's type (docs/DESIGN.md): Jersey 10 for names and titles, Pixelify Sans for the
  // interface.
  fonts: [
    {
      provider: local,
      name: 'Jersey 10',
      cssVariable: '--font-display',
      fallbacks: ['monospace'],
      options: { variants: [face('jersey-10', 'jersey-10-latin-400-normal.woff2', 400)] },
    },
    {
      provider: local,
      name: 'Pixelify Sans',
      cssVariable: '--font-ui',
      fallbacks: ['monospace'],
      options: {
        variants: [
          face('pixelify-sans', 'pixelify-sans-latin-400-normal.woff2', 400),
          face('pixelify-sans', 'pixelify-sans-latin-600-normal.woff2', 600),
        ],
      },
    },
  ],
});
