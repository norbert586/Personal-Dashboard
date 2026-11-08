# Spec: Ratiu Twp

**Status:** v1.1, MVP defined · **Updated:** 2026-11-08

This is the only spec. Change it here, in place; don't fork it.

## What it is

My personal site as a small 3D pixel-art town you can walk, run and bike around. Every building
is one of my projects. The morning update lives in town (the cinema, the comic shop, the sports
bar) and in a Today panel one key away. The town is loosely Romeo and Washington Township,
Michigan: a rust-belt small town with an airfield, a brick Main Street, a subdivision, a tool and
die shop, a grain elevator by the tracks and orchards at the edge. Its streets follow the real
road grid between 23 and 29 Mile and Mound to Romeo Plank, compressed rather than to scale (see
The map).

Prototypes that define the look and feel live in `prototype/` (see ADR-013).

## The map

The street layout is based on the real section-road grid, from OpenStreetMap data (credited in
the site's credits, per its licence). It isn't 1:1; the town keeps the pattern, not the distances.

- **Mile roads** run east-west one mile apart (23 to 29 Mile). **Section roads** run north-south:
  Mound, Van Dyke, Jewell, Schoenherr, Hayes, Garfield and Romeo Plank.
- **M-53** curves north-south through the middle as a freeway, with Van Dyke running beside it as
  the old main road.
- The **Macomb Orchard Trail** crosses diagonally from 26 Mile and Mound toward Romeo. It's the
  town's rail trail.
- Dense, curvy **subdivisions with ponds** fill the southern squares. The north-east is open land
  with a few roads.
- Real anchors to borrow: a township office by Van Dyke north of 26 Mile (the Town Hall), a
  township hall, library and pond-filled park near 24 Mile, a multiplex near 23 Mile and Hayes (the
  cinema), and golf courses.
- **The whole grid is the world** (ADR-016). Each real square mile becomes a section about the
  size of today's prototype town (32 by 32 tiles to start; one constant to tune). That makes the
  world about 30 times today's town: under a minute to bike edge to edge, about three minutes on
  foot.
- Roads, ponds, parks and the trail come from the map data. Houses and shops are placed along the
  real streets by seeded rules. Landmarks and project buildings are placed by hand.

## Why, in order

1. **A fun place to play.** A game first: I want to open it for the fun of it.
2. **My morning dashboard.** Weather, scores, comics, movies, calendar, to-dos, news, traffic and
   flights, read in bed on my phone or at the computer with coffee.
3. **A showcase.** What I build, for friends, family and anyone who finds it.

## Who

Me, friends and family. Desktop first; phones work. People can stay as long as they like, and there
is no "skip the game" button. The Today panel and DOS mode are the quick ways in.

## The feel

- Fun, cozy and nostalgic.
- An isometric look with a close camera that rotates freely.
- 16-bit pixel textures on simple PS1-era 3D shapes. See `DESIGN.md`.
- Real time, the real sun, real seasons and weather for Macomb County.
- The best moment is cruising Main Street at night on the bike.
- Light goals: a passport stamped at each project. Plenty of secrets over time.

## MVP

The MVP is a polished small town with real data. It goes public only when it's polished; there's no
early deploy. Everything in the table ships together.

| Area               | What ships                                                                                                                                           | Done when                                                                             |
| ------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| The town           | The whole real grid, generated from map data and streamed by the square mile, plus a park with a small lake, a library, tennis courts and a dog park | Bike edge to edge in under a minute at 60 fps; the default view matches the feel test |
| Town Hall          | A simple to-do list and calendar. Everyone can read them; only Norbert can edit (ADR-014)                                                            | Add, tick and delete from a phone in a few taps                                       |
| You                | A regular guy: walk (WASD/arrows), run (Shift), bike (B), click or tap to walk                                                                       | Never gets stuck; keyboard alone can reach every building                             |
| Camera             | Isometric angle, free rotation (Q/E, drag), whole-step zoom, follows you; silhouette when hidden                                                     | No shimmer while panning; you're always findable                                      |
| Projects           | Each project is a building. Walk up and press F (or tap) for its window: description, screenshots, tech, demo, GitHub, lessons                       | Every project also has a real page at `/projects/<slug>`                              |
| Star projects      | Overhead, Tetris Plus and Crossbell Vending get screenshots and a demo link                                                                          | Content filled in `src/content/projects/`                                             |
| Coding activity    | Loud: fireworks over a building on days its repo got a push; a crane on the empty lot when a new repo appears                                        | Driven by GitHub, with an offline state                                               |
| Today panel        | One key (T) or button away, readable on a phone                                                                                                      | Every feed shows its provenance (live, sample, offline)                               |
| Feeds              | Weather, scores (live and final), schedules, new comics, movies, news, traffic, flights overhead. No stocks                                          | Each is a `Reading<T>` source with a unit test and an offline state                   |
| Feeds in town      | Cinema marquee, comic shop window, sports bar sign, real aircraft overhead, weather in the sky                                                       | The town and the panel never disagree                                                 |
| Time, sky, seasons | Real sun and shadows; weather from the forecast; seasons by date                                                                                     | Matches the feel test at day, dusk and night                                          |
| Sound              | Music on by default, starting at the first key press or click; tracks change with place and time                                                     | Mute and volume are one key away                                                      |
| DOS mode           | The plain-text version of the whole site                                                                                                             | Works with a screen reader and without WebGL                                          |
| Saving             | Your device remembers where you were and what you've found                                                                                           | Nothing breaks when storage is blocked                                                |

### Feeds and where they come from

| Feed              | Plan                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weather           | National Weather Service API (free, no key) for current conditions and the forecast                                                                                              |
| Scores, schedules | ESPN's public JSON (free, no key, but undocumented) for all seven teams. The NHL and MLB official APIs back up the Red Wings and Tigers                                          |
| Comics            | This week's DC, Image and Marvel releases from Comic Vine (free key). League of Comic Geeks has no public API and blocks bots. ComicList's weekly lists are the fallback         |
| Movies            | What's playing from TMDB (free key), with a link to Emagine Macomb's showtimes. Emagine has no public API, and its site blocks bots; real showtimes need a paid source           |
| Flights overhead  | Public ADS-B feeds (adsb.lol or airplanes.live), not flightpi                                                                                                                    |
| Calendar, to-dos  | Built in: the Town Hall (no outside app)                                                                                                                                         |
| News              | Headlines that link back. Local: ClickOnDetroit, WDET, Bridge Michigan. Tech: Ars Technica, The Verge, Hacker News. National: NPR, PBS NewsHour. World: BBC, NPR World (ADR-017) |
| Traffic           | TomTom traffic (free key, about 2,500 requests a day). Area traffic on the main roads by default; a personal drive only if wanted (open question 3)                              |

## After the MVP

The car (start-up sequence, radio, gears), the plane and the landing challenge, recurring characters
who talk, the guestbook (visitors leave a plane or a name), places past the grid's edges (north toward
Romeo, a cider mill, a drive-in, a high-school field, a mall, a base), the helicopter, train rides, skateboard and winter
vehicles, and interiors. Much later, a pizza delivery sim based on where I work. Order lives in
`ROADMAP.md`.

## Not planned

Stocks. Accounts or logins for visitors. Multiplayer. A "skip the game" button.

## Data rules

- Every feed shows where its data came from (live, sample or offline), as a label as well as a colour.
- A failing source never breaks the page or the town. Its spot shows offline and says why.
- Secrets (tokens, private calendar addresses) stay on the server and never reach the browser.
- Sample data is always labelled as sample.

## Access

Everything is public, including the calendar and to-dos. That's my call; the risk is recorded in
ADR-011. Two guardrails stay:

- The Town Hall calendar holds titles and times only, with no location field.
- One server setting (`PRIVATE_FEEDS`) hides the calendar, to-dos and traffic without a code change.

Reading is public; changing things isn't. Editing the Town Hall's to-dos and calendar needs my
sign-in (ADR-014).

The access gate (ADR-004) stays in the code and still fails closed when no mode is set. Launch adds a
`public` mode.

## Quality bar

- **Performance:** 60 fps at default detail on a 2020-era laptop, and the first playable frame in
  under 3 s on broadband. Detail drops automatically on slow machines. The 3D library loads only for
  the town; project pages and DOS mode stay light.
- **Accessibility:** project pages, the Today panel and DOS mode meet WCAG 2.2 AA (axe in e2e
  tests). The town works by keyboard alone, says which key does what, and respects reduced motion.
- **Security:** CSP on, secrets server-only, gate fails closed.
- **Phones:** tap to walk, buttons for the bike and the camera, and a Today panel that fits.

## Open questions

1. **Signing in to edit the Town Hall:** a passkey (Face ID or fingerprint) is proposed in ADR-014.
2. **Tiles per mile:** start at 32 and tune it once the big world is drivable.
3. **Traffic:** area traffic on the main roads (no personal information), or your own drive, from
   a start to an end such as home to work? A personal route is public too unless `PRIVATE_FEEDS`
   is on.
4. **Hosting:** Claude proposes it before launch (ADR to come).
