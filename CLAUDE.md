# Ratiu Twp

Norbert's personal site as a small 3D pixel-art town you can walk, run and bike around. Every
building is a project; the morning update lives in town and in a Today panel. Public, for
Norbert, friends and family. Astro 7 + TypeScript, server-rendered (Node adapter); the town is a
three.js island; plain CSS with design tokens for the HTML parts.

## Read before you work

| When                                | Read                                                          |
| ----------------------------------- | ------------------------------------------------------------- |
| Any feature work                    | `docs/SPEC.md`: what we're building and why (the only spec)   |
| Any UI work                         | `docs/DESIGN.md`: the design language and its rules           |
| Before undoing or changing a choice | `docs/DECISIONS.md`: why things are the way they are          |
| Start and end of every session      | `docs/ROADMAP.md`: what's next; tick boxes as you finish them |

## Commands

```sh
npm run dev          # dev server on :4321 (no CSP, no access gate)
npm run check        # astro check (types + .astro diagnostics)
npm run test:unit    # node:test, no framework (src/**/*.test.ts)
npm run build        # production build into dist/
npm run test:e2e     # Playwright + axe against the built server (run build first)
npm run verify       # all of the above + prettier --check. The definition of done.
npm run format       # prettier --write .
```

## Definition of done

1. `npm run verify` passes.
2. UI changes: screenshot light + dark, desktop + 390px mobile, and look at them.
3. Tick the box in `docs/ROADMAP.md`. If you made a choice someone could reasonably
   question, add an entry to `docs/DECISIONS.md`.
4. Small commit whose message says why, not just what.

## How we work

- Spec first. If a request isn't covered by `docs/SPEC.md`, update the spec (or ask)
  before building. Changing the spec is cheap; rewriting code is not.
- Plan before multi-file changes (plan mode), then build one vertical slice at a time:
  source adapter → module → test → screenshot.
- Prefer deleting to adding. No new dependency without a `docs/DECISIONS.md` entry.
- Subagents are for isolated jobs (wide searches, research, parallel reads) that return a
  short answer. Never role-play personas ("UX agent", "senior engineer").

## Doc hygiene (keep the repo from turning into the meme)

- One source of truth per concern. Never create a second spec, plan or design doc; edit the
  existing one. If a doc is superseded, delete it; git history is the archive.
- Values live in code (`src/styles/tokens.css`, `src/site.config.ts`). Docs describe intent
  and point at code; don't copy hex values or version numbers into docs.
- No secrets in the repo, docs or prompts. They go in `.env` (gitignored), declared in
  `astro.config.mjs` → `env.schema`, and are read server-side via `astro:env/server`.
- No journals, transcripts or "notes to self" files in the repo.

## Code conventions

- TypeScript strict. Server-only logic in `src/lib/`. UI in `src/components/*.astro`. The town
  (client-side, three.js) goes in `src/game/`.
- Every data source returns a `Reading<T>` (`src/lib/readings.ts`) carrying provenance:
  `live | local | sample | offline`. Sources never throw into a page: on failure, return
  `offline` with a human-readable `detail`.
- Feeds: one source per feed in `src/lib/sources/`, fetching only through the `Fetcher` it's
  given (`src/lib/fetcher.ts`), with pure parsers tested on real responses saved in
  `src/lib/sources/fixtures/`. Register it in `src/lib/feeds.ts` (ADR-021).
- CSS: tokens in `src/styles/tokens.css`, one dark look (ADR-022); component styles scoped in
  `.astro` files. **No inline `style=""` attributes, no `define:vars`, no `<script is:inline>`**:
  the CSP blocks all three. Put dynamic geometry in SVG attributes, use classes for discrete
  states, use bundled `<script>` tags, and prefer server rendering.
- Accessibility floor is WCAG 2.2 AA: semantic HTML, visible focus, `prefers-reduced-motion`
  respected, colour is never the only signal (pair it with a label or shape).
- Security: the access gate (`src/middleware.ts` → `src/lib/access.ts`) fails closed in
  production. Don't weaken it without a decision entry.

## Gotchas

- `@playwright/test` and the `playwright-core` override in `package.json` are pinned to
  `1.63.0` to match the browser preinstalled in Claude cloud sandboxes (one Playwright core,
  shared with axe). Bump both together. Locally, run `npx playwright install chromium` once.
- `@astrojs/check` supports TypeScript ≤ 6, so we stay on TS 6 until it supports TS 7.
- The CSP only applies to `build` + `preview`/server, never `dev`. e2e tests run against the
  built server, so they catch CSP violations.
- e2e tests run the server with `FEEDS=sample`, so they never touch the network.
- In Claude cloud sandboxes, start a live server with `NODE_USE_ENV_PROXY=1`: Node's `fetch`
  otherwise skips the sandbox proxy, and its direct route answers some feeds with "Blocked by
  egress policy". The GitHub user API (coding activity) and airplanes.live are unreachable
  there either way; both work from home.
- `prototype/` holds the throwaway 2D and 3D prototypes the MVP ports from (ADR-013).
  `prototype/build.sh` assembles them into `prototype/dist/`. They're excluded from formatting
  and type checks. Port from them; don't add features there.
