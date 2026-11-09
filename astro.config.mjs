// @ts-check
import { defineConfig, envField, fontProviders } from 'astro/config';
import node from '@astrojs/node';

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
  // Private, data-driven pages are rendered per request on our own server (ADR-002).
  output: 'server',
  adapter: node({ mode: 'standalone' }),

  // Content Security Policy: Astro hashes every script/style it emits (ADR-004).
  // Consequence: no inline style="" attributes or define:vars anywhere.
  security: { csp: true },
  // Shiki's inline styles are incompatible with the CSP, and we don't render code blocks.
  markdown: { syntaxHighlight: false },

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
      // Where feeds come from (src/lib/feeds.ts): `live` asks the real APIs; `sample` answers
      // from the saved samples in src/lib/sources/fixtures/ with no network (tests, demos).
      FEEDS: envField.enum({
        context: 'server',
        access: 'secret',
        values: ['live', 'sample'],
        default: 'live',
      }),
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
