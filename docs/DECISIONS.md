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

## ADR-014: The Town Hall keeps its own to-dos and calendar

**Proposed · 2026-11-08 · sign-in method needs Norbert's OK**
Context: Norbert wants a simple to-do list with a calendar in the town's Town Hall, rather than
reading another app. Everything is readable by the public (ADR-011), so changes must be locked
to him.
Decision: the site stores to-dos and calendar entries itself (title, optional date and time, done).
Anyone can read them; only Norbert can add, tick or delete. Proposed sign-in: a passkey, so Face ID
or a fingerprint on his phone, with no password to leak. That needs one small WebAuthn server
library. Storage follows hosting: a SQLite file on a Node host, or the host's own key-value store.
Consequences: the site gains its first write path and its first login, for one person. Hosting now
needs persistent storage. Visitors still never sign in.

## ADR-015: Where the feeds come from

**Accepted · 2026-11-08**
Context: Norbert wants free sources. We checked each one from the build machine on 2026-11-08.
Decision:

- **Scores:** ESPN's public JSON for all seven teams. It's free and needs no key, but it's
  undocumented. The NHL and MLB official APIs back up the Red Wings and Tigers.
- **Comics:** Comic Vine (a free key) for this week's DC, Image and Marvel releases. League of Comic
  Geeks has no public API and refuses automated requests, so it's out. ComicList's weekly lists are
  the fallback.
- **Movies:** TMDB (a free key) for what's playing, with a link to Emagine Macomb's own showtimes
  page. Emagine has no public API and its site blocks bots, so we don't scrape it. Real showtimes
  wait for a paid or official source.
- **Weather:** the National Weather Service API (no key).
- **Street layout:** OpenStreetMap data, credited on the site as its licence (ODbL) requires.
  Consequences: undocumented sources can change without notice. Each one is a `Reading<T>`, so a
  break shows "offline" instead of breaking the town. The two free keys live in `.env`.

## ADR-016: The whole real grid is the world, generated and streamed by the square mile

**Accepted · 2026-11-08**
Context: Norbert asked to expand the overall scale. Instead of one compressed slice, the world
covers everything between 23 and 29 Mile and Mound to Romeo Plank, about 5 by 6 miles.
Decision: each real square mile becomes a section of about 32 by 32 tiles, the size of the whole
prototype town. That makes the world roughly 30 times larger: under a minute by bike edge to edge.

- A build-time script turns OpenStreetMap data into typed world data: roads with their types,
  water, parks and the trail.
- Seeded rules place houses along subdivision streets, shops along the main roads and farms or
  woods on open land. Landmarks and project buildings are placed by hand.
- The client builds only the sections near you and drops far ones; fog hides the edge.
- Houses share a set of textures and are drawn instanced, so memory and draw calls stay flat as the
  world grows.
  Consequences: the MVP grows, and streaming and generation become core engine work. The map data
  shipped to the browser is a derivative of OpenStreetMap: it carries the ODbL credit and is shared
  under the same licence. Tiles per mile is one constant, tuned by feel.

## ADR-017: News and traffic sources

**Accepted · 2026-11-08**
Context: Norbert wants local, tech, national and international news, and asked what the traffic
question meant. Feeds were checked from the build machine on 2026-11-08.
Decision:

- **News:** RSS headlines that link back to the source.
  - Local: ClickOnDetroit (WDIV), WDET and Bridge Michigan. The Free Press and Detroit News block
    outside readers.
  - Tech: Ars Technica and The Verge, plus Hacker News' free API.
  - National: NPR and PBS NewsHour.
  - World: BBC World and NPR World.
- **Traffic:** TomTom's traffic API (a free key, about 2,500 requests a day; refreshing every 15
  minutes uses about 100). MDOT's Mi Drive has no public feed. Default to incidents and slowdowns
  on the area's main roads, which needs no personal information. A personal drive waits for
  Norbert's answer.
  Consequences: a third free key for `.env`. Headlines only, never full articles.

## ADR-018: The MVP runs locally first

**Accepted · 2026-11-09**
Context: Norbert: "MVP is local anyways for now." He wants the feeds working before anything is
deployed.
Decision: build and run the MVP on his computer and home network. The gate's `private-network`
mode already limits a production build to loopback, LAN and Tailscale. No hosting choice, public
deploy or sign-in until the going-public step. While local, the Town Hall can be edited from his
own machine without a login. Free API keys live in a local `.env`.
Consequences: feeds come first in the roadmap. Hosting and passkey sign-in (ADR-014) move to
the going-public step. Every source must work from a home internet connection.

## ADR-019: World data built for driving, deliveries and growth

**Accepted · 2026-11-09**
Context: Norbert wants the map ready for a pizza delivery sim and for future expansion. Both need
more than a pretty town: deliveries need addresses and routes, and expansion needs new areas to line
up with old ones.
Decision: the world generator outputs data before pixels.

- One fixed projection from latitude and longitude to tiles.
- Roads as a graph with real names, types, lanes, speeds and one-way flags.
- Every building with a stable address (real street name, generated number), a lot, a door and a
  type.
- Sections with stable IDs.
- Hand-placed places of interest, referenced by ID.
  Walking already routes with A* on a grid; driving and deliveries will route on the road graph.
  Consequences: the big-world step does more up front, but the car, traffic and the pizza sim plug in
  later without regenerating the world or breaking saved progress.

## ADR-020: The delivery zone is built from real footprints

**Accepted · 2026-11-09**
Context: Norbert works at the pizzeria at Auburn and Dequindre and wants the delivery sim to mimic
a 2.5-mile radius around it as closely as possible. OpenStreetMap covers it well: about 11,650
building footprints, 1,951 streets, M-59, 155 ponds and 18 parks, checked 2026-11-09.
Decision: the delivery zone uses real footprints, extruded with heights and styles by building
type, rather than the seeded houses of the main grid. Footprints are grouped by block for
streaming and draw calls. Roads, water and parks come from the same data, through the same
projection and road graph as the town (ADR-019). The pizzeria's sign uses a stand-in name, with no
real brand or logo.
Consequences: the zone is far denser than the main grid, so block grouping and instancing matter
from the start. Once the site is public, it shows where Norbert works; that's his call. The
pizzeria's location lives in the place data, so moving or renaming it is one edit.

## ADR-021: Feeds share one in-process cache and can answer from saved samples

**Accepted · 2026-11-09**
Context: the Today panel and the town both read the feeds. The free APIs have quotas (TomTom allows
about 2,500 requests a day), some answers are large (an ESPN schedule is up to 1.3 MB per team), and
tests mustn't depend on the network.
Decision: every request goes through one cache in the server process, keyed by URL, with a
freshness time per upstream, from 30 seconds for aircraft to a day for the weather grid lookup.
Requests that arrive together share one fetch, a failure is remembered for a minute, and a failed
refresh falls back to the last good answer for up to six freshness times, with the reason shown.
`FEEDS=sample` answers every feed from saved samples, real responses captured on 2026-11-09, which
the parser tests use too. A feed whose free key is missing shows its saved sample, labelled as
sample, and says which key to add.
Consequences: no database and no background jobs; a restart empties the cache. Each reading says
when its data was fetched. The saved samples ship inside the server build.

## ADR-022: The Today panel replaces the console, in the game's one dark look

**Accepted · 2026-11-09 · Norbert chose one dark look**
Context: the roadmap makes the Today panel the home page until the town lands, which retires the
M0 console (ADR-009). DESIGN.md gives the game one dark look; the console had Day and Night keys.
Decision: `/` is the Today panel, one card per feed, each saying where its data came from. It
wears the game's interface (bevelled navy panels, maize, Jersey 10 and Pixelify Sans) in one dark
look whatever the device setting, so it looks the same when the town opens it with T. The
console's layout, components, Day and Night keys and fonts (Michroma, B612, B612 Mono, DSEG7) are
deleted. Jersey 10 and Pixelify Sans are self-hosted through Fontsource, as the old fonts were
(ADR-003). Tokens stay in `tokens.css`, without `light-dark()`.
Consequences: no light theme; adding one later means a second set of token values. The console's
agenda, tasks and devices modules are gone; the Town Hall (roadmap step 5) brings the to-dos and
calendar back.

## ADR-023: Coding activity counts pushes from GitHub's public events, without a token

**Accepted · 2026-11-09**
Context: the town needs to know which repos got a push on which days (fireworks) and which repos
are new (the crane). GitHub's public events API needs no token and allows 60 requests an hour.
Since October 2025 its push events no longer carry commit counts; those would need a token and
the GraphQL contributions API.
Decision: count pushes, not commits, from the public events API, every 10 minutes (six requests an
hour), with no token. Project titles come from `src/content/projects`, matched by repo.
Consequences: private repos don't show. The API keeps 90 days of events, plenty for two weeks.
Claude's cloud sandboxes can't reach GitHub's user endpoints, so the saved sample is built from
GitHub's documented format and this repo's real commits; Norbert's machine reads it live.
