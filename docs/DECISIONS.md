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

**Accepted · 2026-11-09 · the delivery zone's scale is revised by ADR-035**
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

**Accepted · 2026-11-09 · scale and timing revised by ADR-035**
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

## ADR-024: API keys travel in headers wherever the API allows

**Accepted · 2026-11-09**
Context: keys in URLs end up in logs, caches and error messages. Claude's cloud sandboxes also
inject saved keys into request headers, so a header key works there without being stored.
Decision: TMDB's read token goes in `Authorization: Bearer`. Traffic uses TomTom's v2 incident API,
which reads `TomTom-Api-Key`, instead of v5, which takes `?key=`. Comic Vine only reads
`?api_key=`, so its key stays in the URL. Error messages name the upstream and the status, never
the URL.
Consequences: two of the three keys never appear in a URL. In a cloud sandbox, Comic Vine's key
has to be an environment variable rather than an injected secret.

## ADR-025: Comics have no fallback for now

**Accepted · 2026-11-09 · supersedes ADR-015's ComicList fallback**
Context: ADR-015 named ComicList's weekly lists as the fallback for Comic Vine. ComicList now
redirects to a GoCollect blog post: HTML only, with no feed, so reading it means scraping prose.
Decision: no comics fallback. When Comic Vine fails, the last good answer stands in for up to a day
and a half (ADR-021), and after that the card is offline with the reason. If Comic Vine can't tell
publishers apart, every book shows, with a note.
Consequences: a long Comic Vine outage empties the comic shop window. Revisit if Comic Vine proves
unreliable.

## ADR-026: Slow feeds never hold up the page

**Accepted · 2026-11-09**
Context: the live Comic Vine check found it takes about five seconds a page, so refreshing comics
held the whole Today page for 10 to 15 seconds every six hours. It also showed that Comic Vine's
community lists a week's books around release day, so on a Monday it has none.
Decision: an answer past its freshness time but within six of them, the window ADR-021 already
trusts during outages, is served at once while a fresh one loads in the background. Older answers
still make the request wait. Slow upstreams get their own timeout (Comic Vine: 20 seconds), and
answers nobody asks for are kept three days instead of one, so a once-a-day visit finds them.
Comics read two weeks and show last week's books, saying so, until this week's arrive.
Consequences: only the first load after a restart waits for every feed. A reading can be up to six
freshness times old without a note; its time shows its age. Fast-changing feeds have short windows
(live scores 12 minutes, aircraft 3), so after a quiet spell they still wait for fresh data.

## ADR-027: Going inside is a short entrance, not a room

**Accepted · 2026-11-09 · Norbert's call**
Context: in the 3D feel test, entering only hid you and opened the building's window over an
unchanged town, and walking into a door did nothing until you pressed F. Norbert: "nothing happens
when you walk into a building". The options were a short 3D entrance, or that plus a simple room for
each building type (SPEC open question 6).
Decision: the short entrance. Walking into a door, pressing F there, or clicking the building (which
walks you to its door) opens the door; you walk through while the camera eases in and the view dims,
then the window opens as an HTML dialog. Closing it walks you back out. No rooms per building type.
Consequences: about half the work of rooms, and nothing to throw away when M5 builds real interiors
for the hero buildings. The town still never shows the inside of a building until then.

## ADR-028: three.js 0.186, set up to look like the r149 feel test

**Accepted · 2026-11-09**
Context: the feel test was tuned on three r149. Since then three turned on colour management (r152)
and dropped the legacy light scale (r165), so the same scene renders darker and with shifted colours.
The newest release, 0.187, was ten days old when the town was ported.
Decision: pin `three` and `@types/three` to 0.186.x, the last release a few weeks old, and bump
deliberately (ADR-010). Turn colour management off, render in linear space, and multiply light
intensities by π, so the code-painted colours land on screen as they did in the feel test. The
default view, midday and night were checked against the prototype's screenshots.
Consequences: the town doesn't use physically based light units; materials are painted, not lit
realistically, which is the look. A three upgrade must be checked against those screenshots again.

## ADR-029: The town's windows show the Today panel's own cards

**Accepted · 2026-11-10**
Context: the town and the Today panel must never disagree, and a spot whose feed is offline has to
say so and why (SPEC: Data rules). A second renderer in the browser, building the same lists from
JSON, would drift from the panel's cards.
Decision: a feed building's window shows the Today panel's card for its feed, rendered by the same
components and fetched as an HTML fragment (`/today/cards`). What the town draws in 3D (boards,
aircraft, the sky) reads `/api/feeds.json`, asked at the same moment. A board has two lines in the
sign font and a status strip that names where its data came from (live with the time, sample or
offline); an offline board goes dark and the window says why. The town boots first and asks for
the feeds after, so a slow feed never holds up the first frame.
Consequences: one more route, and the town's page carries the cards' styles. Boards are 12
characters wide, so a long title carries on to the next page, and a board shows the first few
items; the window always has the whole list. The feed shops are a floor taller than in the feel
test, to carry their boards.

## ADR-030: One projection, anchored on the town's point, and squeezed heights for aircraft

**Accepted · 2026-11-10**
Context: real aircraft need a place in the world, so step 4 adds the projection the map will be
built on (ADR-019). The Today panel measures every aircraft from the town's point (26 Mile and Van
Dyke, `site.place`), where SPEC open question 7 proposes the town's centre.
Decision: `src/game/world/projection.ts` turns latitude and longitude into tiles with one origin
and 32 tiles to the mile. The origin puts the town's point in the middle of today's town, so an
aircraft the panel calls 4 miles west-south-west is 4 sections west-south-west in the game. Real
altitudes are squeezed between the rooftops and the camera (1,000 ft is about 4.6 tiles up, 35,000
ft about 11.4), keeping their order; lower aircraft are drawn larger, as the feel test's low
flyover was. Between answers an aircraft flies on at its real speed and heading. The feel test's
made-up flyovers are gone; Ratiu Field's own plane stays as town life.
Consequences: at 32 tiles to the mile an aircraft is in view only when it really is within about
half a mile, so the sky is often empty until the big world (step 7) gives more sky to watch. A
saved sample has no clock, so it replays from the moment the page opened. If step 7 moves the
town's centre, it moves the hand-placed town on this projection, not the projection.

## ADR-031: Snow cover is the town's guess from the forecast, painted when the town is built

**Accepted · 2026-11-10**
Context: the feel test's winter was white by date. The roadmap wants snow cover from the forecast
and bare trees from the date, but the weather service's forecast doesn't report snow depth.
Decision: winter by date is bare branches and dormant grass. Snow lies when it's snowing at or
near freezing, or when it's well below freezing with snow in the next day's forecast
(`src/game/weather.ts`); roads and walks stay clear. The ground and roofs are painted when the
town is built, so the town asks for its feeds first and waits up to a second and a half for them.
Clouds, rain, snow and fog follow each new answer while you play.
Consequences: snow can linger or melt a little out of step with the real ground. Snow that
starts while you're in town falls at once but only lies after a reload, and a server that answers
slowly builds the town without it. `?sky=` and `?season=` preview any weather or season, and the
canvas says it's a preview.

## ADR-032: Headlines in a newspaper box, traffic on the Today line until M-53

**Accepted · 2026-11-10 · follows the roadmap's proposal; Norbert left the choice open**
Context: headlines and traffic had no place in town. The roadmap proposed a newspaper box on Main
Street and a freeway sign once the big world brings M-53, and asked to confirm with Norbert. He
started the step without picking, so the proposal stands until he says otherwise.
Decision: a newspaper box stands by the walk where you start; its window has the four news cards.
The foot of the screen gets a Today line: one feed at a time in plain words (weather, traffic,
scores, a headline, films, comics, aircraft), from the same answers as the Today panel. It's
where traffic shows in town until the freeway sign exists, where an offline feed says so and why
even without a building, and it opens Today. It waits while you hover or focus it, and while the
town is paused.
Consequences: the freeway sign is now a step 7 box. The Today line is a second place for words
the boards also show, so it reuses the feed's own text and never invents any.

## ADR-033: The town is the home page; Today opens over it, and first on phones

**Accepted · 2026-11-10 · the phone default is open: Norbert hasn't picked**
Context: with the feeds in town, the town takes over the home page (ADR-022). The roadmap asked
whether phones should open straight to the Today panel; Norbert reads his morning update in bed
on his phone, and started this step without answering.
Decision: `/` is the town and `/today` is the Today panel's own page, light and readable with no
3D. In town, T, the Today line or the pause menu opens the panel over the town, with the same
cards (ADR-029); the town holds still behind it, as it does behind the pause menu. On a phone the
town opens with the panel already over it and no intro, so the update is the first thing you
read; closing it puts you in town. That's one setting, `phonesOpenToday` in `site.config.ts`.
Windows keep their own keys now: arrows and Space scroll them instead of walking you.
Consequences: a phone loads the 3D town even when you only wanted the update; `/today` is the
light way in, and worth bookmarking. `/town` is gone. If Norbert prefers the town first on
phones, flip the setting; nothing else changes.

## ADR-034: A public copy on GitHub Pages, rebuilt on a timer

**Accepted · 2026-11-10**
Context: Norbert wants to play the town on his phone, away from home, so he can give better
feedback, and to host it on his GitHub page the way Tetris Plus is. GitHub Pages serves files
only: no server, no gate, no login, no storage. ADR-018 kept everything local until it was
polished; he chose to go early.
Decision: one codebase, two builds. `npm run build` is still the Node server for home, behind
the gate (ADR-002, ADR-004). `npm run build:pages` (`DEPLOY_TARGET=pages`) renders every page and
`/api/feeds.json` once into `dist-pages/`, under the repository's name, and
`.github/workflows/pages.yml` publishes it on every push to `main` and about every half hour.
The feed keys are Actions secrets, read at build time, so they never reach the browser. Internal
links go through `src/lib/paths.ts`. The gate lets build-time pages through, because a file can't
be gated; the server build has none, so it still fails closed. The public copy leaves aircraft
out and says why: a position that's minutes old is wrong.
Consequences: the town is public before it's finished, and its pages still ask search engines
not to index it. Feeds there are as old as the last build, and a feed that refuses GitHub's
build machines shows offline. Editing the Town Hall (ADR-014) can't live on Pages; it needs the
home server or a real host, which is still the roadmap's going-public step. Supersedes the
"local only" part of ADR-018.

## ADR-035: The delivery sim is its own game mode at true scale, built now

**Accepted · 2026-11-15 · Norbert's call**
Context: Norbert has wanted a pizza delivery sim for years and asked to build it now, as a
separate game mode with a 1-to-1 street match of his delivery zone. ADR-019 and ADR-020 put the
zone on the town's projection, where a real mile is 32 tiles of about 6 m: real footprints at
that scale would be an eighth of life size, and a real drive would be over in seconds. We
measured the zone from OpenStreetMap on 2026-11-15: 235 miles of streets, 740 street names, 145
more miles of lots, lanes and driveways, 11,570 footprints, and a median delivery of 2.5 miles.
Decision: the delivery mode is its own page (`/delivery`) and its own world, where one unit is
one real metre, measured east and north of the store. It keeps what ADR-019 and ADR-020 were
for: data before pixels, roads as a graph, real footprints with heights and styles by type, a
stand-in name on the pizzeria. It's built in slices, ahead of the rest of the MVP: drive the
zone, the delivery loop, roads that look right, traffic, depth. Drives take real time; the
pressure comes from the order clock, not from a fast car. The town and the zone share code (the
loop, the painters and materials, the sun), not a map.
Consequences: the town's MVP waits at its Town Hall step. The zone and the town can't be joined
by road, since their scales differ; a pizzeria door in town opens the mode instead. The spec's
"no minigames" rule stands for the town, and this mode is named as the exception. The site now
shows where Norbert works in far more detail, which stays his call (ADR-020).

## ADR-036: A hand-written car model, with no physics engine

**Accepted · 2026-11-15**
Context: Norbert wants driving that's light and fun, like Schedule I or GTA: an automatic with
gear shifts you can feel, and steering that's all his. The zone is close to flat (about 45 m of
rise across 5 miles) and the only things to hit are walls and, later, other cars. A physics
engine would be a large new dependency (a WebAssembly one also needs a wider CSP), and its
vehicle models are harder to tune for feel than to write.
Decision: the car is our own pure model in `src/game/delivery/car.ts`, stepped at a fixed rate:
an engine torque curve, an automatic gearbox that cuts power for a moment on each shift, and a
two-axle tyre model that grips, slides and recovers. Nothing assists the steering. Collisions
are the car's outline against wall segments in a grid. Every tuning value sits in one object.
Consequences: no dependency, and unit tests can drive the car (0 to 60, shifts, braking
distance). Feel is ours to get right, by playing it with Norbert. Hills, jumps and rollovers
would need this revisited.

## ADR-037: The zone is one file, baked from OpenStreetMap by a script

**Accepted · 2026-11-15**
Context: builds must never touch the network (ADR-016), the zone is small enough to ship whole
(under 2 MB, about 700 KB compressed), and the pages build has no server to stream from.
Decision: `npm run zone:import` downloads the zone from OpenStreetMap in small tiles (an
Overpass mirror first, the OSM API as the fallback, both in JSON, so no parser is added), and
`src/lib/zone/` turns it into typed data: the road graph, sidewalks, footprints, lots, water,
parks and trees. It's saved as `public/zone/auburn-dequindre.json`, with coordinates as
delta-encoded decimetres. The browser loads it once and builds what's near you. The same
importer takes any centre and radius, for the town's own map step. The file is a derivative of
OpenStreetMap: it carries the credit, the site's credits name it, and it's shared under the
same licence (ODbL).
Consequences: the map is as old as the last import; re-run the script to refresh it and review
the diff. House numbers aren't in this data (about one building in ten has one), so addresses
come from the Census Bureau's block ranges when the delivery loop is built.

## ADR-038: Stand-in homes where the map has a street but no houses

**Accepted · 2026-11-15**
Context: OpenStreetMap has every street in the zone but only some of the houses. West of
Dequindre most are mapped; east of it, whole subdivisions are streets through bare grass.
Norbert's first look: this is a built-up area and it reads as empty.
Decision: the importer fills in. Along a named residential street, wherever a house-sized lot
is clear of every real footprint, road, lot, park, pond, wood and non-residential land, it
places a stand-in house: a size and setback that's steady for the street, a garage wing on
about half, seeded so the same map gives the same houses (`src/lib/zone/fill.ts`). They're in
the baked file, marked `made`, after the real buildings, so real ones keep their indices. No
other source is added; Microsoft's footprints or county parcels could replace this later.
Consequences: about 5,100 of the zone's 17,700 buildings are stand-ins, not the real houses:
right street, plausible lot, wrong shape. The spec says so. Addresses (later) can treat them
like any building. A street that really is empty (a new road, a road through a field the map
doesn't mark) gets houses it shouldn't; the fix is to map the field or widen the keep-out rules.

## ADR-039: Real place names on signs, in the game's lettering, with no logos

**Accepted · 2026-11-15 · Norbert to confirm (SPEC open question 13)**
Context: Norbert wants landmarks with clear indicators of what they are, and the test for the
mode is "does it feel like my drive". ADR-035 keeps the pizzeria under a stand-in name with no
real brand or logo.
Decision: every named place in OpenStreetMap wears its real name, as a map would print it:
schools, churches, the hospital, parks, and shops, restaurants, gas stations and dealerships
too. Names are plain words in the game's pixel font on panels coloured by the kind of place,
never a logo, a trademarked colour scheme or a building made to imitate a brand's design. The
pizzeria keeps its stand-in name. Landmarks the map misses are added by hand in
`site.config.ts` (`delivery.landmarks`).
Consequences: the streets are recognisable, and the names are only as right as the map (some
are stale). If a name should go, one rule in `world.ts` (which kinds get signs) or one entry
removed from the import is the whole change. Hospitals use a white H on blue, not a red cross,
which is a protected emblem.

## ADR-040: The car is Norbert's HHR, and it's stable under braking by design

**Accepted · 2026-11-15**
Context: on his first drive Norbert found the car drifted when braking and swung wide in turns.
Measuring the model showed two faults. The rear brakes asked for more than the rear tyres could
hold once the weight pitched forward, so full braking with any steering spun the car. And below
a jog the front tyres were treated as scrubbing sideways, so the car wouldn't pull away at full
lock on less than most of the throttle, then ran wide once it did. ADR-036 says nothing
corrects for you, which had been read as leaving these alone. He also named his car: a silver
2006 Chevrolet HHR, 2.4 litre, and asked to keep the pace the game had.
Decision: `CAR` takes the HHR's real weight, wheelbase, tyres, steering lock and the four-speed
automatic's ratios; the engine's pull is set so 0 to 60 stays at about 7.5 seconds (the real
car tested at 8.0). Stability comes from how the car is built, as on a real one, not from an
assist that takes over: the rear brakes are held back like a proportioning valve, hard braking
uses up most of the front tyres' cornering grip, the rear tyres grip a little more than the
front and keep more of it in a slide, and at a crawl the car follows its wheels. The steering
wheel takes the same moment to reach lock at any speed. There is still no ABS, traction control
or steering help, and the handbrake still slides the tail.
Consequences: braking hard while steering slows and turns the car without swinging it round;
full lock from a stop is a 36 foot circle; a slide straightens itself when you let go. Tests
hold each of these. It's harder to drift than before: if that turns out less fun, `slideRear`,
`rearGrip` and `brakeCapRear` are the values to loosen. The final drive (3.91) and the weight
split (60% front) are best estimates; sources disagree on the first and don't give the second.
The store's point in the zone file was moved by hand to match `delivery.storeFront`, which is
what a fresh import produces.

## ADR-041: The delivery mode is a game with modes, on game time

**Accepted · 2026-11-16 · Norbert's call**
Context: the spec had orders arriving by the real clock over a real evening. At true scale a
median run is 2.5 miles each way, so a real shift is hours of play, and the real clock would
close the store when Norbert plays in the morning. He asked for fun time instead.
Decision: every mode plays one delivery loop under its own rules and its own clock. Rush is a
set of 5, 10 or 20 orders, ranked by one combined score (time against the quote, tip, the
pizza's condition, address, hand-over, a small bonus for no GPS). Time trial is a set time to
deliver as many as you can, well. Story mode is a career with upgrades, designed with Norbert
before it's built. Free drive keeps the sandbox. You can play at any hour; the sky, seasons and
weather stay real. Driving stays at real distances and real speed: the pressure comes from the
order clock (ADR-035). GPS is off by default and draws a path on the ground when on. Only
collisions damage the pizza, by how hard the hit is. You walk to every door; it isn't skipped in
any mode.
Consequences: ADR-035's "drives take real time" still holds; "orders arrive by the real clock"
doesn't. A run is short enough to replay, which is what makes a best score worth saving. Story
mode's upgrades change values in `CAR`, so every car value stays in that one object (ADR-036).

## ADR-042: House numbers are generated, not looked up

**Accepted · 2026-11-16 · Norbert's call**
Context: a wrong-address mistake needs numbers you can read on houses. The plan was the Census
Bureau's TIGER address ranges, which are zipped shapefiles and needed a parser or a new
dependency. Norbert: the numbers don't have to be accurate; take the easiest system.
Decision: the importer numbers every building on its real street by how far along the street its
front door is, even on one side and odd on the other, rising away from one end of the street.
Same zone file in, same numbers out. No new data and no dependency.
Consequences: numbers rise in the right direction and sit on the right side, but don't match the
real houses, which also keeps any real home from being named as an order. The same scheme is the
one M1 step 7 planned for the town, so it can be shared.
Built 2026-11-16 (`src/lib/zone/addresses.ts`), with Norbert's picks: one grid across the zone
rather than counting from each street's end, about 2,000 numbers a mile and five digits
everywhere, so nearby streets share their hundreds. A street counts east or north by which way it
mostly runs. The importer now also decides which road each building faces (it was worked out in
the browser), so the number and the front door always agree; a building facing an unnamed lane
takes its address from the nearest named street. The zone file went to version 3.

## ADR-043: The pizzeria gets a room, and dispatch is a game

**Accepted · 2026-11-16 · Norbert's call**
Context: ADR-027 kept the town to short entrances with no rooms, and real interiors waited for
M5. Norbert wants to drive back, walk in the back door and assign himself orders the way he does
at work, choosing singles, doubles and triples, where a bad bundle means a bad time estimate and
angry customers.
Decision: the pizzeria's back room is built in the delivery mode, as its first interior: one room
with the heat rack, the counter and the dispatch screen. Orders arrive in bunches and you pace
them. The routing that draws the GPS path also gives every quote and judges each bundle: drops
that aren't on one run are quoted a time you can't make. ADR-027 still holds for the town.
Consequences: it's built after the rough loop, so delivering is shown to be fun before the room
is made. What the room teaches (walking indoors at true scale, a screen you use in the world) is
reused when M5 builds the town's hero interiors.

## ADR-044: Collisions settle in one pass, inside the car's step, with no bounce

**Accepted · 2026-11-16 · Norbert's call on the feel**
Context: after his drive Norbert said hits bounce him badly off things. Tests showed it: a 40 mph
hit on a wall or a parked car sprang the car back at almost 5 mph, a nose in a corner rattled
round, and a hit came out differently at 10 frames a second than at 120. Each of the car's
circles answered each wall on its own with 12% bounce, walls and parked cars were settled in two
separate calls, the car's own turning into a wall was never stopped, and collisions ran once a
frame after several steps of the car.
Decision: still no physics engine (ADR-036). `collide.ts` takes every solid grid at once and runs
after every fixed step of the car (`driveCar`'s `solid`). It pushes the car out until nothing
overlaps, then takes away all the speed into each wall at the point that touches it, turning
included, in a few rounds so a corner's two walls share the work. Nothing bounces: Norbert chose
a dead stop over a small thud. A knock turns the car as if it were ten times harder to turn
(`KNOCK`), and scraping costs speed in proportion to how hard the wall pushes. The hardest hit of
each frame, in m/s, comes back from `driveCar` for the pizza's damage.
Consequences: hits are the same at any frame rate and the tests in `collide.test.ts` hold them
there. The outline is still three round circles, so clipping a corner with the nose pushes the
car aside rather than stopping it; a boxier outline is the next thing to try if that feels wrong.
People and bikes (`bump` in `traffic.ts`) still bounce a little: hitting people is its own open
question.

## ADR-045: The HHR is livelier than the real one: more pep, tighter and quicker steering

**Accepted · 2026-11-16 · Norbert's call**
Context: after the collision fix (ADR-044) Norbert drove again: still too slow to pull away,
the turning circle too wide, and the steering sluggish. Measured: the wheel took a third of a
second to reach lock and the car most of a second to settle into a turn at town speeds, full
lock from a stop was a 14 m circle (the real car's 36 feet), the tyres gave out at about 0.9 g,
and 0 to 60 took 7 seconds, with 0 to 30 held back by the front tyres' grip.
Decision: this part of ADR-040 gives way to the game. The car keeps its real size, weight and
gearbox, but grip goes up by 15%, the steering turns further (a 31 foot circle), the wheel
reaches lock in about a sixth of a second and comes back faster, the body turns more readily
(`inertia`), and the engine pulls harder, with a little more drag so top speed stays near
133 mph. 0 to 60 is about 6.3 seconds. Everything ADR-040 built for stability stays: the rear
brakes held back, braking using the front's grip, the rear gripping more, and the steering's
reach shrinking with speed so a full-lock swerve at 60 mph slides under 2 degrees.
Consequences: the car tests now hold the new targets (0 to 60, the 31 foot circle, a quick
wheel). Story mode's upgrades (step 9) start from this car, so the real HHR is no longer the
baseline. If it's now too twitchy, `steerRate` and `inertia` are the first values to ease back.

## ADR-046: Signals hang on span wires, on one timer, and only the other cars have to obey

**Accepted · 2026-11-16 · Norbert picked the feature; the look is Claude's proposal**
Context: Norbert wants the map more alive before routing, starting with traffic control he can
see. The other cars already took turns at the 44 signal junctions, on a timer hidden inside
`traffic.ts` that guessed a street's turn from the compass, so two roads meeting at a slant could
both get green, and nothing showed the player whose turn it was.
Decision: one timer, `signals.ts`: each street gets 20 seconds of green, 3 of yellow and a second
of red all round. `control.ts` works out, once per zone, what meets at every intersection, pairs a
signal's streets by the biggest road through it, and makes signals within 40 m of each other keep
time together, since the map draws one big intersection as several. Cars and signal heads both
read these two modules. The heads hang the way they do around here: a wire between two wooden
poles on opposite corners, a yellow head over each lane that drives in (two on roads of four lanes
or more). They're drawn about twice life size, because at this picture's 360 lines a real 12 inch
lens is a pixel a block away. Poles, wires and housings go in the world's own meshes; the lit
lenses are one instanced mesh, the only draw call this adds. Red is always the top lens and green
the bottom, and `data-signal` on the canvas says what the signal ahead shows.
Consequences: signals are for looking at: nothing happens when Norbert runs a red, and the other
cars don't expect him to. Whether it should cost him is SPEC open question 10. There are no turn
arrows and no walk signals. Where the map has a divided road's signals a few metres apart, one
wire serves both, so a head can hang a little off its lane.
Built with it, the same day: stop and yield signs and street names. A stop sign stands wherever
the other cars stop, by the rule they already followed (a smaller road stops for a bigger one, a
road that ends stops for one that runs through), with the map's own 68 stop and 33 yield signs
laid over it; Norbert chose the rule over the map alone, which would have left most corners bare.
That's about 1,230 stop signs that are plausible, not surveyed: a real corner may have none, or
be an all-way stop the map doesn't mark. The yields are the Auburn Road roundabouts', and cars
take a yield as a short stop for now. Street names are green blades on those posts, shortened as
a sign has them ("E Auburn Rd"); 25 of the 795 names are too long for a blade and lose their last
word. Blades and stop signs are drawn larger than life for the same reason as the signal heads.
At the store this adds about 2.6% to the triangles on screen.

## ADR-047: One router: time at the limit plus stops, ending at the nearest pavement

**Accepted · 2026-11-16 · Norbert's picks**
Context: step 4 needs a drive time between any two doors, for the GPS path, the customer's quote
and the bundle check (ADR-043). No doc said what a quote assumes about how he drives (nothing
happens when he runs a red, ADR-046), where a route to a door ends, or what there is to see
before tickets exist.
Decision: `route.ts` searches the zone file's own graph with A\*, over stretches of road rather
than junctions so a turn can cost time. A drive time is each stretch at its speed limit, plus a
stop sign (braking from the limit, a look, pulling away), a yield (about half that), a signal's
average wait (worked out from `signals.ts`' timer) and slowing for a turn by its angle. What each
approach meets comes from `control.ts`, the rule the signs and the other cars read. Norbert chose
this over the limit alone (quotes a third short in subdivisions) and over the car flat out (only
makeable recklessly): a quote is fair for a legal drive, and running reds beats it. A route ends
at the nearest pavement to the door that isn't a private driveway, a ramp or the freeway, on the
part of the map you can drive to and back from; else on the address's street. Every value is in
one object, `PACE`. Until step 5's tickets, G in free drive picks a random address and turns the
GPS on, so the path can be driven and judged.
Consequences: times are plausible, not surveyed: the stop signs are mostly by rule, and the map
has no turn restrictions, so a route may turn left where a real sign forbids it. M-59 is still
flat, but its ramps are the only way on and off in the graph, so routes use them properly. No
U-turns at a junction unless the road ends there, and driveways are never a short cut. How bad a
bundle must be before customers are angry is step 6's choice; `planRun` only gives the numbers.
Built 2026-11-16. Found on the way: 40 lots are only reached through a road the map calls a
driveway, so driveways cost 20 seconds to turn into rather than being barred. 266 of the 15,888
numbered doors are on streets the zone's edge cuts off from the rest; they get no route, and
orders must never go to them (`doorSpot` returns null). A route knows which way the car faces and
charges 12 seconds to set off the other way. The path is blue (`--route`), not maize: maize
chevrons read as more yellow lane paint. On a phone the GPS button sits under the dashboard.

## ADR-048: A ticket: what's on it, what a quote adds, and where you get one

**Accepted · 2026-11-16 · Norbert's picks**
Context: step 5 starts with the ticket alone. No doc said how much a quote adds to the router's
drive time (ADR-047 leaves out parking, the walk and the hand-over), what an order or a hand-over
looks like, or how a ticket reaches you before the store's room exists (ADR-043).
Decision: a quote is the drive with 15% to spare, plus the walk from where you pull up to that
door and back at walking pace, plus 30 seconds to park and hand it over, rounded up to a whole
minute. Norbert chose it over a flat minute (a far door or a long walk is late unless you speed)
and over half as much again (no pressure on a single). The values are in `PACE` with the rest of
what a quote depends on. A typical door, a bit over five minutes away, quotes 8 minutes. An order
is one to three pizzas, sometimes a side and a drink, from a small made-up menu with prices, and
the ticket shows the total: tips can be a share of it when scoring comes. The hand-over is the
customer's note in their own words with the plain instruction under it; there are five (leave it
on the porch, call first, text first, knock, ring the bell), so calling and texting are different
answers, and only homes ask for the porch. You're handed a ticket when you're stopped in the
delivery parking, so every drive starts with one; coming back and stopping there swaps it for the
next. Its clock starts as you drive out and is game time, so it holds behind the menu (ADR-041).
The GPS is off by default again and goes to the ticket's door.
Consequences: the notes are a first handful, written without Norbert; step 8 writes the real ones
with him. Until the hand-over exists nothing ends a ticket or happens when it's late, and the only
way to the next one is back at the store, which the walk-in and the dispatch screen replace
(step 6). A quote is from the delivery parking, wherever the ticket is written, except a ticket
named in the address bar away from the store. The quote adds nothing for other cars or for a red
light beyond the router's average wait. A ticket is a pure function of the building, the start
and a seed (`ticket.ts`), so `?to=` always writes the same one.

## ADR-049: On foot: F when stopped, anywhere; the quote's pace, and Shift to run

**Accepted · 2026-11-16 · Norbert's picks**
Context: step 5's second slice is parking, getting out and walking to the door. No doc said which
key gets you out, when you may, where you have to park, what stops you on foot, how fast you
walk, what the camera does at a wall, or what the dashboard shows when there's no speed or gear.
Decision: F gets you out and back in: it's the town's key for doors. On a phone it's a button
over the gas, shown only when it would work. You get out only at a stop, anywhere, with a ticket
or without; Norbert chose that over having to be near the GPS's spot or on pavement, so a bad
spot costs the walk on the clock and nothing else. You step out on the driver's side, or the
other when that's blocked. Walking is `PACE.walk` itself, so the walk a customer is quoted is the
walk you get; Shift runs, as in town, and is how you win time back. W and S walk and back up, A
and D turn, as they steer the car; on a phone the pedals become Walk and Run. Everything that
stops the car stops you (the same grids), and so do your own car and the zone's edge; other cars
and people don't yet. The camera follows as it does the car and comes in close at a wall; you
show through as the town's maize silhouette. The dashboard says "On foot" or "Running" and how
far the car is, not how far the door is: finding the house stays yours (ADR-042). Within two
metres of the ticket's door it says "At the door". The values are in `FOOT` (`foot.ts`).
Consequences: the clock runs on foot and nothing ends it yet; the hand-over does, next. The car
is where you left it and nothing moves it, so a car left across a lane holds the others up.
Running is free: it doesn't shake the pizza, and whether it should is scoring's question
(step 7). On a phone you can't back up on foot; you turn round. Tickets are handed out and
clocks started by where the car is, not where you stand.
Built 2026-11-17. Found on the way: the door painted on a house isn't at the middle of its front
wall when the wall is two bays wide, so the door you walk to is the painted one
(`paintedDoor` in `buildings.ts`); the quote's walk still measures to the wall's middle, a metre
or two off. Road paint is drawn a touch nearer than it lies, which made silhouettes of your shoes
on every street: the silhouette now needs a part to be well behind something (`xray`'s slack),
and the GPS's paint no longer hides anything. You wear the store's red jacket; nobody chose that.

## ADR-050: A phone's screen thins out while you drive

**Accepted · 2026-11-17 · Norbert's call, Claude's layout**
Context: Norbert drove it on his phone and couldn't see the road: the badge, the street, the
place, the GPS line, the map, the dashboard, the buttons and the whole ticket filled the top half
of the screen.
Decision: on a phone held upright, from 3 mph the screen shows only the street and its limit, the
GPS's line, the order as one line (its address and clock), a smaller map, the speed and the menu
button. At a stop, and on foot, everything comes back: a red light or the curb is where you read
the note. The camera, time and GPS buttons are among what goes, so you change those stopped.
It's one attribute, `data-moving` on the page, and the rest is CSS.
Consequences: you can't turn the GPS on or change the camera while rolling on a phone. With the
GPS on, the address shows twice. Desktops and phones held sideways are unchanged. The layout
stopped is as full as it was; if that's still too much, the ticket is the first thing to fold.

## ADR-051: The hand-over: F at the door, the phone anywhere, and mistakes said aloud

**Accepted · 2026-11-17 · Norbert's picks**
Context: the third slice of step 5 ends a ticket at the door. No doc said how you pick a
hand-over, where the phone's call and text happen, what a mistake does before scoring exists,
what the porch looks like, who answers, what the answer says about time, or what comes next.
Decision: at the ticket's door F opens a short menu (knock, ring, leave it on the porch at homes,
and wait for them once you've called or texted), chosen over a key each or F cycling, so nothing
is chosen by accident. Calling and texting are a phone button and the P key, anywhere, in the car
or on foot, over keeping the phone in the car. A wrong hand-over still delivers, and the
customer's line is about it; at the wrong door a stranger says so and the ticket stays open; both
are priced by scoring (step 7), not refused now. Leaving it on the porch puts a box on the step
and the customer texts back. Customers are generated stand-ins, the same for the same ticket: a
name, a face painted by code and a line for the situation, until step 8. The dialog says the
result in words under the line. After it the ticket reads "Delivered" and the GPS points to the
delivery parking, where the next ticket is handed out, as now.
Consequences: until scoring, playing it wrong costs only a sharp word. The phone is a fourth
button on a phone's screen: it goes with the GPS's under the dashboard and hides while driving
(ADR-050). The note "knock on the side door" still means the front door.
