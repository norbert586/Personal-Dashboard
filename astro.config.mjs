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
    },
  },

  fonts: [
    {
      provider: local,
      name: 'Michroma',
      cssVariable: '--font-display',
      fallbacks: ['sans-serif'],
      options: { variants: [face('michroma', 'michroma-latin-400-normal.woff2', 400)] },
    },
    {
      provider: local,
      name: 'B612',
      cssVariable: '--font-body',
      fallbacks: ['sans-serif'],
      options: {
        variants: [
          face('b612', 'b612-latin-400-normal.woff2', 400),
          face('b612', 'b612-latin-700-normal.woff2', 700),
        ],
      },
    },
    {
      provider: local,
      name: 'B612 Mono',
      cssVariable: '--font-mono',
      fallbacks: ['monospace'],
      options: {
        variants: [
          face('b612-mono', 'b612-mono-latin-400-normal.woff2', 400),
          face('b612-mono', 'b612-mono-latin-700-normal.woff2', 700),
        ],
      },
    },
    {
      provider: local,
      name: 'DSEG7 Classic',
      cssVariable: '--font-segment',
      fallbacks: ['monospace'],
      options: {
        variants: [face('dseg7-classic', 'dseg7-classic-latin-700-normal.woff2', 700)],
      },
    },
  ],
});
