# Decisions

Append-only log of choices someone could reasonably question. Newest at the bottom.
To reverse a decision, add a new entry that supersedes it; don't rewrite history.
Format: context, decision, consequences. Keep each entry short.

## ADR-001: One lean doc system

**Accepted · 2026-11-07**
Context: multi-file agent setups drift fast. Duplicate specs, persona prompts and stale plans
end up contradicting each other and burn context.
Decision: exactly five docs, one job each: `CLAUDE.md` (how to work here), `docs/SPEC.md`
(what and why), `docs/DESIGN.md` (look and feel), `docs/DECISIONS.md` (this log),
`docs/ROADMAP.md` (what's next). Values stay in code.
Consequences: before adding a doc, ask which of the five it belongs in.

## ADR-002: Astro 7 + TypeScript, server-rendered with the Node adapter

**Accepted · 2026-11-07**
Context: the old placeholder was a client-only React + MUI SPA. The console is
content-shaped, private and data-driven, and mostly needs HTML rendered on the server.
Decision: Astro 7 with `output: 'server'` and `@astrojs/node` (standalone). Data is fetched
server-side, so secrets never reach the browser. Plain `.astro` components; no UI framework
until a module truly needs client state (then React islands, which Astro supports).
Consequences: runs anywhere Node runs (laptop, Pi, VPS, Docker). Moving to Cloudflare later
means swapping the adapter.

## ADR-003: Plain CSS with design tokens, no UI kit

**Accepted · 2026-11-07**
Context: a distinctive look can't come from a component library's defaults.
Decision: CSS custom properties in `src/styles/tokens.css`, `light-dark()` for themes,
cascade layers, scoped component styles. Fonts self-hosted through Astro's Fonts API (npm
provider, so no third-party font CDN), with metric-matched fallbacks to avoid layout shift.
Consequences: we own every pixel. Tailwind could be added later; tokens would map onto it.

## ADR-004: Private by default, with a fail-closed gate

**Accepted · 2026-11-07**
Context: the console will show personal data and hold API tokens.
Decision: `src/middleware.ts` refuses all requests in production unless `ACCESS_MODE` is set.
The only mode so far is `private-network`: allow loopback, LAN, and Tailscale addresses.
Content Security Policy is enabled.
Consequences: a misconfigured deploy shows a 403, not your data. Caveat: a local tunnel or
reverse proxy (Tailscale Funnel, ngrok, cloudflared) makes every visitor look local. Use
`private-network` only behind tunnels that authenticate (Tailscale Serve, Cloudflare Access),
never public ones.

## ADR-005: Hosting and the access gate

**Proposed, needs Norbert's call**
Options:
A. **Raspberry Pi + Tailscale.** The console runs at home next to the devices it reports on.
It's reachable from your phone and laptop over the tailnet, with no login screen and no
cloud bill. Downside: it's down whenever the Pi is.
B. **Cloudflare + Cloudflare Access.** Always up and free at this scale. Access does the
login (email code or GitHub). To reach the Pi it needs a Cloudflare Tunnel, and the app
needs a `cloudflare-access` mode that verifies Access's signed JWT.
C. **Build our own login.** Only worth it once part of the site is public.
Recommendation: **A now, B later if you want access without Tailscale.** The code already
supports A.

## ADR-006: Where tasks live

**Proposed.** Options: GitHub Issues (already where your code lives), a Markdown checklist in a
private repo, Todoist (good apps and API), or SQLite on the Pi. Decide before M2.

## ADR-007: Sources return readings with provenance

**Accepted · 2026-11-07**
Decision: every source returns `Reading<T>` = data + `live | local | sample | offline` +
fetched-at + detail. The UI shows provenance on every module. Sample data ships first so the
design can be judged before integrations exist.
Consequences: a broken integration degrades one module, never the page.

## ADR-008: Testing strategy

**Accepted · 2026-11-07**
Decision: pure logic gets `node:test` unit tests (Node strips TypeScript types natively, so
no test framework is needed). Pages get Playwright e2e tests against the built server, with
axe accessibility scans in both themes and a check that the gate fails closed.
`npm run verify` runs everything.
Consequences: three dev dependencies cover types, unit, e2e and accessibility checks.

## ADR-009: From a private console to Ratiu Twp, a town you can walk

**Accepted · 2026-11-08**
Context: after three prototypes and a questionnaire, Norbert ranked the site's jobs: a fun place
to play first, then his morning dashboard, then a showcase. Its audience is him, friends and family.
Decision: the site becomes Ratiu Twp, a 3D pixel-art town you can walk, run and bike around.
Projects are buildings, and the morning update lives in town and in a Today panel. The
cassette-console screen from M0 is superseded. Its tooling, access gate, readings and tests carry
over. ADR-005 (hosting) and ADR-006 (tasks) become open questions in the spec.
Consequences: SPEC, DESIGN and ROADMAP are rewritten. The console UI is replaced during the MVP.

## ADR-010: 3D with three.js, drawn to look hand-pixelled

**Accepted · 2026-11-08**
Context: Norbert wants an isometric look, free camera rotation and some PS1-era 3D, and later cars
and planes. A pre-drawn 2D image can't rotate freely.
Decision: render the town with three.js. An orthographic camera looks down at 30°. The scene is
drawn at low resolution and scaled up by whole device pixels, with nearest-neighbour textures
painted by code. At the default camera one texel lands on one pixel, so the 3D town matches the 2D
prototype. Buildings stay parametric (boxes, gables, cylinders), generated from one definition.
The prototype loads three r149's single-file build so its 3D builders can replace the 2D ones by
name. The real build installs three from npm, pinned, and imports it as a module.
Consequences: about 150 KB of gzipped JavaScript for three.js, loaded only by the town. The town
needs WebGL; DOS mode and the HTML pages are the fallback. three.js upgrades are deliberate.

## ADR-011: Everything public, including the calendar and to-dos

**Accepted · 2026-11-08 · Norbert's call**
Context: the site is mainly for Norbert, friends and family, and he asked for every feed to be
public. The risk, plainly: with the town named after a real area, a public calendar tells
strangers when he's away, and traffic shows his commute.
Decision: all feeds are public, with two guardrails. The calendar shows titles and times only, with
no locations and no guest names; that also protects the other people on his calendar. One server
setting, `PRIVATE_FEEDS`, hides the calendar, to-dos and traffic without a code change. The gate
(ADR-004) keeps failing closed and gains a `public` mode for launch.
Consequences: going private later takes one setting. Revisit if the audience grows.

## ADR-012: The name is Ratiu Twp, with no 586

**Accepted · 2026-11-08**
Context: "586" (the area code and Norbert's handle) felt slapped on. Norbert named the town after
his last name, written the way Michigan signs write townships.
Decision: the site, the town and the title screen are Ratiu Twp, and the airfield is Ratiu Field.
No 586 anywhere in the product, except the GitHub username inside repository links.
Consequences: the M0 "N-586" naming is retired.

## ADR-013: Keep the prototypes in the repo until they're ported

**Accepted · 2026-11-08**
Context: the prototypes (2D v3 and the 3D feel test) define the look, the town layout and the
simulation. They were built in a scratch folder that disappears with the cloud session.
Decision: keep their sources in `prototype/`, with `prototype/build.sh` to assemble them. They're
throwaway: no tests, and excluded from formatting and type checks. The MVP ports them to
TypeScript in `src/game/`. Delete `prototype/` once nothing references it.
Consequences: one more folder for now, with a clear end date.
