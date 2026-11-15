# Spec: Ratiu Twp

**Status:** v1.4, MVP defined, delivery mode in progress · **Updated:** 2026-11-15

This is the only spec. Change it here, in place; don't fork it.

## What it is

My personal site as a small 3D pixel-art town you can walk, run and bike around. Every building
is one of my projects. The morning update lives in town (the cinema, the comic shop, the sports
bar) and in a Today panel one key away. The town is loosely Romeo and Washington Township,
Michigan: a rust-belt small town with an airfield, a brick Main Street, a subdivision, a tool and
die shop, a grain elevator by the tracks and orchards at the edge. Its streets follow the real
road grid between 23 and 29 Mile and Mound to Romeo Plank, compressed rather than to scale (see
The map).

Beside the town there's a second game mode, the delivery mode: a pizza delivery sim on the real
streets around the pizzeria where I work, at true scale (see Delivery mode).

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

### World data: built for driving, deliveries and growth

The world is data first and pixels second, so later features (the car, traffic, new areas) plug in
without regenerating it (ADR-019). The delivery mode's zone is built the same way, as its own
world at true scale (ADR-035).

- **One fixed projection** turns real latitude and longitude into world tiles: one origin and one
  tiles-per-mile constant, defined in one place. New areas generated later line up with old ones.
- **Roads are a graph.** Intersections and segments carry the real name, type (freeway, mile road,
  subdivision street), lanes, speed and one-way, from the map data. Walking, traffic, the car, GPS
  routes and deliveries all route on it.
- **Every building has a stable address:** the real street name and a generated house number (even
  on one side, odd on the other, rising along the street), plus its lot, its door and a type (house,
  shop, civic, industrial). The same seed always gives the same address.
- **Sections** (one per real square mile) have stable IDs. Expanding the world adds sections past
  the edge without moving anything that exists.
- **Places of interest** (project buildings, feed buildings, the Town Hall) are placed by hand and
  referenced by ID.

## Delivery mode

A pizza delivery sim, and its own game mode on its own page (`/delivery`): the town squeezes a
mile into a few seconds' walk, and a delivery needs the real distances (ADR-035). I work at the
pizzeria at Auburn and Dequindre and know these streets, so the test is whether it feels like my
drive.

- **The zone** is everything within 2.5 miles of the store, at true scale: one unit is one real
  metre. Every street is real, with its real name, shape, lanes and speed limit, from
  OpenStreetMap: about 245 miles of streets, 150 more of parking lots, apartment lanes and
  driveways, M-59 with its ramps, and about 12,600 real building footprints, with heights and
  styles by type. Ponds, parks and woods come too. A script bakes it into one file in the repo,
  so builds never touch the network (ADR-037).
- **A built-up place.** This is an old, developed suburb, and it has to look like one. Where the
  map has a residential street but no houses along it, the importer puts stand-in homes there
  (about 5,100 of them), so no subdivision is bare grass (ADR-038). Houses have driveways, and
  lots and driveways have parked cars.
- **Landmarks** look like what they are and say so: schools, churches, the hospital (Corewell
  Health Beaumont Troy), car dealerships, gas stations, strip malls and big stores. Each named
  place wears its real name on its wall and on a sign by the road, in the game's own lettering,
  with no logos (ADR-039); the dashboard names the landmark or neighborhood you're in, and the
  small map marks the landmarks.
- **Real time.** A mile takes as long as a mile takes, the clock is the real clock, and the sun,
  seasons and weather are the real ones.
- **Driving** is light and fun, in the spirit of Schedule I and GTA rather than a hard sim. The car
  is mine: a silver 2006 Chevrolet HHR with the 2.4 litre engine and the four-speed automatic, at
  its real size, weight and gearing, with gear shifts you can hear and feel. Steering is all
  yours: nothing steers or brakes for you. It brakes in a straight line, turns in the real car's
  36 feet, pushes wide before it spins, and slides when you pull the handbrake. It's a
  hand-written model with no physics engine (ADR-036, ADR-040).
- **A delivery:** drive there, park, get out and walk to the door, and knock. The customer answers
  in an RPG-style dialogue: a character portrait and text.
- **A shift:** orders arrive by the real clock, each one an address on a ticket. You take singles,
  doubles and triples, a GPS route shows the way, the clock runs, and the shift ends with how it
  went (times, tips), with your best shift saved on the device.
- **Addresses:** every building gets a street address on its real street, with a house number
  from the Census Bureau's public block ranges, so numbers sit in the right block on the right side
  of the street. They are not the real houses' exact numbers, and no order is a real person's.
- **The pizzeria** stands on its real corner under a stand-in name, with no real brand or logo.
  It's the brightest thing on the street: a lit shop front under a striped awning, its name in
  lights. Round the back, off the service lane, are its back door and the marked delivery
  parking where I really park and load, and where every drive starts and ends.
- **Street lamps** stand along every road, placed by rule since the map has almost none. They
  all glow after dark, and the few nearest you throw real light on the road.
- **Life on the streets:** a few other cars and cyclists on the roads and people on the
  sidewalks, enough that the place isn't empty and no more. They're around you only. Cars keep
  to their lane, give way to bigger roads, take turns at signals and wait behind you; you can't
  drive through them. Signal lights you can see, and traffic that matters to a delivery, come
  later.
- **The look** is detailed, with a proper sky, in the 32-bit (PlayStation-era) pixel style. See
  `DESIGN.md`.
- **Where it plays:** desktop first, with a keyboard or a controller; phones get on-screen
  controls. It needs WebGL, like the town.
- **Later:** a pizzeria door in town opens the mode, the radio, real rain and snow that change
  the grip, and M-59's bridges. Order lives in `ROADMAP.md`.

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

The MVP is a polished small town with real data. It runs locally first, on my computer and home
network (ADR-018), and goes public only when it's polished. Everything in the table ships together.

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
| Feeds in town      | Cinema marquee, comic shop window, sports bar sign, a newspaper box, real aircraft overhead, weather in the sky, and a Today line for the rest       | The town and the panel never disagree                                                 |
| Time, sky, seasons | Real sun and shadows; weather from the forecast; seasons by date                                                                                     | Matches the feel test at day, dusk and night                                          |
| Sound              | Music on by default, starting at the first key press or click; tracks change with place and time                                                     | Mute and volume are one key away                                                      |
| Menus              | A DOS boot, a sound-card setup and a title; Esc opens a pause menu: map, projects, tools inventory, Today, jukebox, options, Quit to DOS             | Every menu works by keyboard alone; reduced motion skips the boot                     |
| DOS mode           | The plain-text version of the whole site                                                                                                             | Works with a screen reader and without WebGL                                          |
| Saving             | Your device remembers where you were and what you've found                                                                                           | Nothing breaks when storage is blocked                                                |

### Feeds and where they come from

| Feed              | Plan                                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weather           | National Weather Service API (free, no key) for current conditions and the forecast                                                                                              |
| Scores, schedules | ESPN's public JSON (free, no key, but undocumented) for all seven teams. The NHL and MLB official APIs back up the Red Wings and Tigers                                          |
| Comics            | This week's DC, Image and Marvel releases from Comic Vine (free key). League of Comic Geeks has no public API and blocks bots. No fallback for now (ADR-025)                     |
| Movies            | What's playing from TMDB (free key), with a link to Emagine Macomb's showtimes. Emagine has no public API, and its site blocks bots; real showtimes need a paid source           |
| Flights overhead  | Public ADS-B feeds (adsb.lol or airplanes.live), not flightpi                                                                                                                    |
| Calendar, to-dos  | Built in: the Town Hall (no outside app)                                                                                                                                         |
| News              | Headlines that link back. Local: ClickOnDetroit, WDET, Bridge Michigan. Tech: Ars Technica, The Verge, Hacker News. National: NPR, PBS NewsHour. World: BBC, NPR World (ADR-017) |
| Traffic           | TomTom traffic (free key, about 2,500 requests a day). Area traffic on the main roads by default; a personal drive only if wanted (open question 3)                              |

## After the MVP

The car (start-up sequence, radio, gears), the plane and the landing challenge, tower radio read
from real airport weather, recurring characters
who talk, the guestbook (visitors leave a plane or a name), places past the grid's edges (north toward
Romeo, a cider mill, a drive-in, a high-school field, a mall, a base), the helicopter, train rides, skateboard and winter
vehicles, and interiors. Order lives in `ROADMAP.md`. The delivery mode is being built now, ahead
of the rest of the MVP (ADR-035).

## Not planned

Stocks. Accounts or logins for visitors. Multiplayer. A "skip the game" button. Minigames in town
other than the landing challenge (the delivery mode is its own game mode, not a minigame).

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
sign-in once the site is public (ADR-014). While the MVP runs locally, editing works from my own
machine (ADR-018).

The access gate (ADR-004) stays in the code and still fails closed when no mode is set. Launch adds a
`public` mode.

Until then there's a public copy on GitHub Pages so I can play it on my phone (ADR-034): the same
town as plain files, rebuilt about every half hour, with no aircraft and no editing.

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
4. **Hosting:** a read-only copy is on GitHub Pages for playtesting (ADR-034). For the real
   launch, he wants to reach it from home, at work and on the go, behind a login (a password or
   similar). Claude proposes the setup then (ADR to come).
5. **The pizzeria's sign:** a stand-in name on the real corner, with no real brand or logo in the
   product. It's "Ratiu's Pizza" until Norbert picks one (`delivery.storeName` in
   `site.config.ts`).
6. **Going inside, in 3D:** settled on 2026-11-09 (ADR-027). Norbert chose the short entrance:
   the door opens, you walk through and the camera follows, then the building's window opens.
   Walking into a door goes in too. Rooms per building type are not planned; hero interiors stay
   after launch.
7. **Where the town's centre sits:** Main Street, Ratiu Field and the project buildings are placed
   by hand on the real grid. Proposed: beside the Town Hall, near 26 Mile and Van Dyke. The
   projection already puts today's town there (ADR-030).
8. **Phones:** open straight to the Today panel over the town (how it works now, ADR-033), or
   open the town like a desktop does? It's one setting, `phonesOpenToday` in `site.config.ts`.
9. **Headlines and traffic in town:** built as proposed (a newspaper box now, a freeway sign with
   M-53; ADR-032). Norbert hasn't confirmed either, so say so if something else would be better.
10. **Traffic in the delivery mode:** Norbert asked for a few cars, cyclists and people to fill
    the void (2026-11-15), and that's built. How much traffic a real shift should have, and
    whether it should slow a delivery down, is still open.
11. **How a shift plays:** tips, what counts as late, how orders are paced, and what happens at
    the store between runs. Norbert knows the job; walk him through it before building the
    delivery loop.
12. **The store and the car:** settled on 2026-11-15. The pizzeria is the north end of the strip
    in the plaza south of Auburn Road, facing west, with the drivers' parking behind it
    (`delivery.storeFront` in `site.config.ts`). The car is his silver 2006 HHR (ADR-040).
13. **Real names on signs:** landmarks and shops wear their real names in plain lettering, as a
    map does, with no logos or brand colours (ADR-039). Say so if any should be left off or
    renamed.
