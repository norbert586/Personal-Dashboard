# Roadmap

What's next, in order. Tick boxes as work lands, and keep each milestone shippable. The git log is
the history; this file is only the plan.

**Picking up work.** Start at the first unticked box. Each step says what to build, which prototype
files it ports from, and which parts of `SPEC.md` and which decisions govern it. Plan first, then
build one slice at a time: built, tested, screenshotted, and small enough for Norbert to check in
one sitting. When a step needs a choice no doc makes, walk Norbert through it before building; he
asked to work that way. Questions that block a step are listed in `SPEC.md` under Open questions.

## M0: Foundation ✅

- [x] Lean doc system, Astro 7 + TypeScript, CSP, fail-closed gate, `npm run verify`
- [x] The cassette console on sample data (superseded by ADR-009 and retired by ADR-022; the
      tooling carries over)

## Prototypes ✅

The throwaway prototypes in `prototype/` (ADR-013) are what M1 ports from. `prototype/build.sh`
assembles them.

- [x] v1–v3: the 2D isometric town (boot screen, pause menu, building windows, DOS mode, sample
      morning update, real sun, people and traffic)
- [x] 3D feel test: the same town in three.js with walking, running, biking, free rotation, door
      prompts and night lighting
- [x] 3D playtest fixes: keys follow the streets, click to walk on an A* path with a dotted line
      and a ring, clicking a building walks you to its door and inside, low flyovers and contrails
- [x] Direction locked: SPEC, DESIGN, DECISIONS (ADR-009 to 013) and this roadmap rewritten
- [x] Map checks: OpenStreetMap covers the grid and the delivery zone well enough to build from
      (ADR-016, ADR-020)

## M1: MVP, running locally ← you are here

Feeds came first: they're useful on their own, and the town reads them. Everything in the spec's
MVP table ships together, and it goes public only when it's polished (ADR-018).

1. [x] **Feeds, server side.** One source per feed in `src/lib/sources/`, each a `Reading<T>` with a
       parser unit test on a saved sample and an offline state. Weather, scores, comics, movies,
       news (local, tech, national, world), area traffic, flights overhead and GitHub activity, from
       the sources in ADR-015 and ADR-017. Free keys (Comic Vine, TMDB, TomTom) live in `.env`. One
       cached JSON endpoint serves them all (`/api/feeds.json`, ADR-021).
   - [x] Check comics against the live Comic Vine API. The batched volume lookup works; Comic Vine
         lists books around release day, so last week's show until this week's arrive (ADR-026).
2. [x] **Today panel.** The morning update as an HTML page on real data, good on a phone. It's the
       home page until the town lands (ADR-022).
3. [x] **Town island in Astro.** Port the 3D engine from `prototype/3d/` to TypeScript in
       `src/game/`, with three.js from npm, bundled and loaded only on the town's page (ADR-010,
       SPEC: Quality bar). Keep what the prototype learned (DESIGN: Camera and scale, Moving
       around). The town gets its own page; the Today panel stays the home page until step 4.
   - [x] Boot: the canvas island renders at low resolution and scales up by whole device pixels,
         with the input and frame loop from `p3d-6-loop.js`. An e2e smoke test checks that it boots
         with no console errors or CSP violations. Without WebGL, the page says so and links the
         plain pages.
   - [x] The town: the texture atlas, 3D primitives, colliders and doors (`p3d-1-atlas.js`), the
         building and prop builders (`p3d-2-build.js`, `p3d-2b-build.js`), and the town data,
         texture painters and layout they reuse from `prototype/2d/` (the shared parts in
         `build.sh`). The default view matches the feel test.
   - [x] Light and time (`p3d-3-scene.js`, and `applyLight` in `p3d-5-player.js`): the orthographic
         camera, the sky light and the real sun for Macomb County, hard shadows, fog at the edges,
         and the night layer of lit windows, neon, lamps and halos.
   - [x] You (`p3d-4-bodies.js`, `p3d-5-player.js`): walk, run with Shift, and bike with B, with a
         headlight and a bell on Space. Keys follow the streets, you never get stuck, and you show
         as a silhouette behind buildings. The camera turns freely (Q/E, drag), zooms in whole
         steps and follows you. On phones, buttons turn the camera, zoom and switch to the bike.
   - [x] Click to walk and going in (`p3d-7-path.js`): the nav grid, A* with string-pulling, the
         dotted path and ring, and tap to walk on phones. Clicking a building walks you to its door.
         Going in is the short entrance from ADR-027: walking into a door, F or a click opens the
         door, you walk through, the camera eases in, and the window opens; closing it brings you
         back out. The building's window is an accessible HTML dialog. Keyboard alone reaches
         every building.
   - [x] Life: townspeople, cars, the train and smoke (`p3d-4-bodies.js`, moved by the 2D
         simulation in `prototype/2d/p5b-actors.js`), and low flyovers and high jets with contrails
         (`p3d-7-path.js`), on sample data until step 4.
   - [x] The old-PC shell (SPEC: Menus), ported from `prototype/2d/p6-ui.js` and `p7-windows.js`: a
         short DOS boot, the sound-card setup screen (which doubles as the first gesture music
         needs), the title screen, and the pause menu on Esc with Map, Projects, Inventory, Today,
         Jukebox, Options and Quit to DOS. Later steps fill the panes. The 2D shell still says
         Norbert Field, and 586 survives on the Coney's sign and in the DOS screens; all of it goes
         (ADR-012).
4. [ ] **The town shows the feeds.** The town reads the same `/api/feeds.json` as the Today panel,
       so the two never disagree (SPEC: Feeds in town). A spot whose feed is offline says so and
       why, like the panel's cards (SPEC: Data rules).
   - [x] Cinema marquee: what's playing (TMDB), with Emagine Macomb's showtimes link in its window.
   - [x] Comic shop window: this week's DC, Image and Marvel books (ADR-026).
   - [ ] Sports bar sign: live and final scores and the next games for the seven teams.
   - [ ] Real aircraft from ADS-B fly over at their real positions, heights and headings. This step
         adds the world's one projection (ADR-019), which step 7 builds the map on.
   - [ ] Weather and seasons: the forecast brings cloud, rain, snow and snow cover; the date brings
         blossom in the orchards, fall leaves and bare winter trees (DESIGN: Light, time and
         weather).
   - [ ] Headlines and traffic in town. Proposed: headlines in a newspaper box on Main Street, and
         traffic on a freeway sign once step 7 brings M-53. Confirm with Norbert first.
   - [ ] The town becomes the home page. The Today panel keeps its own page and opens over the town
         with T (ADR-022). Ask Norbert whether phones should open straight to the panel.
5. [ ] **Town Hall.** The to-do list and calendar live in the Town Hall (ADR-014). Add the building
       to the town; step 7 moves it to the real township office's corner (SPEC: The map).
   - [ ] Storage on this machine in SQLite, a new dependency, so it gets a decision entry. An entry
         is a title, an optional date and time, and done. The calendar keeps titles and times only,
         with no location field (SPEC: Access).
   - [ ] Anyone can read: the Town Hall's window and a Today card show the day's agenda and the
         open to-dos.
   - [ ] Editing: add, tick and delete in a few taps. While local, only from this machine
         (ADR-018); passkey sign-in for the phone comes with going public (step 11). The write path
         checks its origin, and e2e tests cover add, tick and delete.
6. [ ] **Projects.** Every project is a building (SPEC: Projects, Star projects, Coding activity).
       Content lives in `src/content/projects/`; which building holds which project comes from
       `prototype/2d/p3a-data.js` (the terminal, tower, hangars, fire station, barracks, radar
       dome, Coney diner and vending kiosk).
   - [ ] Real pages at `/projects/<slug>`: description, screenshots, tech, demo, GitHub link and
         what Norbert learned. Light pages, with no 3D library.
   - [ ] Each building's window shows the same content and links to its page.
   - [ ] Star projects: Overhead, Tetris Plus and Crossbell Vending get screenshots and demo links.
         Norbert supplies them.
   - [ ] Coding activity, loud (ADR-023): fireworks over a building on days its repo got a push,
         and a crane on the empty lot when a new repo appears, with an offline state.
   - [ ] The Projects and Inventory panes: projects with their status, and the tools Norbert builds
         with, each listing the projects that use it (`prototype/2d/p7-windows.js`).
7. [ ] **The big world** (ADR-016, ADR-019, SPEC: The map, World data). The whole real grid,
       generated from OpenStreetMap and streamed by the square mile.
   - [ ] Map import: a build-time script turns OpenStreetMap data for 23 to 29 Mile, Mound to Romeo
         Plank, into typed world data saved in the repo, so builds never touch the network: roads,
         water, parks, golf courses and the Macomb Orchard Trail. The data carries the ODbL credit
         (add it to the site's credits) and is shared under the same licence.
   - [ ] One projection from latitude and longitude to tiles (from step 4): one origin and one
         tiles-per-mile constant in one place, unit-tested on real corners.
   - [ ] The road graph: intersections and segments with real names, types, lanes, speeds and
         one-way flags, with routing tested between real corners.
   - [ ] Addresses: every building gets a stable address (the real street name and a generated
         number, even on one side and odd on the other), a lot, a door and a type. The same seed
         always gives the same address.
   - [ ] Seeded fill: houses along subdivision streets, shops on the main roads, and farms, woods
         and orchards on open land. Houses share textures and are drawn instanced.
   - [ ] Places by hand, by ID: the prototype's town (Main Street with the cinema, comic shop and
         sports bar, Ratiu Field, the project buildings, the Coney, the strip mall, the tool and die
         shop, the grain elevator by the tracks, the water tower and the ball field), the Town Hall
         on the township office's corner, and a park with a small lake, a library, tennis courts
         and a dog park. Where the prototype's town sits is SPEC open question 7.
   - [ ] Sections and streaming: one section per square mile, each with a stable ID. Near sections
         build, far ones drop, and fog hides the edge. Meet the town's done-when in the spec, then
         tune tiles per mile (SPEC open question 2).
   - [ ] Life on the network: chill traffic drives the road graph, and people walk the sidewalks
         and the trail.
   - [ ] The Map pane shows the real grid and where you are (`paneMap` in `prototype/2d/p6-ui.js`).
   - [ ] More than one area: the generator takes an area, so the delivery zone (M6) drops in later
         without touching the town.
8. [ ] **Music and sound** (DESIGN: Sound).
   - [ ] Chiptune that changes with the place and the time of day, on by default from the first key
         press or click.
   - [ ] Sound effects and ambience: footsteps, the bike bell, doors, planes overhead and rain.
   - [ ] The Jukebox pane, with mute and volume one key away.
   - [ ] Where the tracks come from (composed in code like the prototype's, or licensed) is a
         choice to walk Norbert through. Licensed music needs a decision entry.
9. [ ] **DOS mode, passport stamps and a handful of secrets.**
   - [ ] DOS mode: the plain-text version of the whole site on its own page, from the 2D
         prototype's Quit to DOS. HELP, DIR, TYPE, CLS, VER and a command back to the game, with
         the projects, the Today feeds and the Town Hall as files. It works with a screen reader
         and without WebGL, and never loads the 3D library.
   - [ ] Passport: a stamp for each project building, the first time you go in. It lives in the
         pause menu and is saved on the device.
   - [ ] A handful of secrets to start, with more over time (SPEC: The feel). Pick them with
         Norbert, for example from the ideas below.
10. [ ] **Polish** (SPEC: Quality bar).
    - [ ] Performance: meet the spec's frame rate and first-frame times. Cut draw calls with
          instancing and merged sections. Detail drops by itself on slow machines and says so, as
          the 2D prototype did.
    - [ ] Phones: tap to walk, camera and bike buttons, bottom-sheet windows, and a Today panel
          that fits.
    - [ ] Accessibility: the town works by keyboard alone, prompts name their key, focus is
          visible, and reduced motion pauses ambient traffic and animation. Axe passes on every
          HTML page.
    - [ ] Saving: your device remembers where you were and what you've found, and nothing breaks
          when storage is blocked.
    - [ ] The Options pane: sound, volume, detail and motion (`paneOptions` in the 2D prototype).
11. [ ] **Going public.** The game and the real data go live together.
    - [ ] Hosting: Claude proposes it, with storage that lasts for the Town Hall (SPEC open
          question 4, ADR-014). Norbert reaches it from home, at work and on the go, behind a
          login. A new decision entry.
    - [ ] The `public` gate mode, and `PRIVATE_FEEDS` to hide the calendar, to-dos and traffic
          without a code change (SPEC: Access).
    - [ ] Passkey sign-in for editing the Town Hall (ADR-014, SPEC open question 1).
    - [ ] Credits: TMDB's logo beside its notice, and the OpenStreetMap credit.
    - [ ] Deploy, then check from a phone off Wi-Fi.

## After launch

In this order. The spec's After the MVP section says what's in scope; each milestone gets its
details in the spec and a plan before work starts.

### M2: On the road

- [ ] The car: a start-up sequence, gears, a radio and headlights, with the feel of a real car
      rather than an arcade one. It drives the road graph; park it anywhere and walk.
- [ ] Routes: pick a place or an address, and the road graph draws the way there with the dotted
      path. The pizza sim needs this.
- [ ] Train rides on the line past the grain elevator.
- [ ] The skateboard.
- [ ] Winter vehicles after real snow: a sled and a snowmobile.

### M3: In the air

- [ ] Tower radio: an airport weather broadcast, read aloud from real weather reports (METAR,
      free from aviationweather.gov, a new `Reading<T>` source). It plays in the tower and on the
      jukebox.
- [ ] The plane: a start-up checklist in the hangar, then taxi, take off from runway 18/36, fly
      over the whole grid and land back.
- [ ] The landing challenge, the only minigame: your touchdown is scored in the real wind, and
      your best landings are saved on the device.
- [ ] The helicopter.

### M4: People

- [ ] Recurring characters who talk: a few regulars with names, routines through the day, and
      lines that change with the season. Who they are, and whether they mention the real weather
      and scores, is a choice to walk Norbert through (say, the Coney's cook, the hardware store
      owner, a ramp agent at Ratiu Field, the peach stand farmer, a dog walker).
- [ ] The guestbook: a visitor leaves a name or a plane, and their plane parks overnight at Ratiu
      Field with the name on its tail. It needs storage, spam protection and moderation (Norbert
      approves entries from the Town Hall), and a decision entry. Visitors still never sign in.

### M5: A bigger world

- [ ] Past the grid's edges: north toward Romeo, a cider mill, a drive-in whose screen shows
      what's playing, a high-school football field, a mall and a base. Each one adds sections on
      the same projection, so nothing that exists moves (ADR-016, ADR-019).
- [ ] Hero interiors: real rooms you can walk around in for the hero buildings, beyond step 3's
      door-and-camera entrance (ADR-027).
- [ ] More secrets.

### M6: Pizza delivery (much later)

A delivery sim in the real neighbourhood around the pizzeria at Auburn and Dequindre, where Norbert
works, as close to real as the map allows (SPEC: World data; ADR-019, ADR-020). It needs the car
and routes (M2). Norbert knows the job, so walk him through how a shift plays before building it.

- [ ] The delivery zone: a 2.5-mile radius built from OpenStreetMap's real building footprints as
      they are, grouped by block and given heights and styles by type (houses, strip malls,
      industrial, schools, churches). The real roads, M-59 included, and the ponds and parks come
      too, on the town's projection and road graph. It's far denser than the grid, so block
      grouping and instancing come first.
- [ ] Addresses on the zone's real streets, as in the town.
- [ ] The pizzeria on its real corner, with a stand-in name and no real brand or logo (SPEC open
      question 5).
- [ ] Orders: each one is a real address in the zone, on a ticket, arriving by the real clock.
- [ ] Deliveries: the route comes from the road graph, you drive it in the car, and the clock runs.
      Real traffic slows you down.
- [ ] A shift: a run of orders and how it went, with your best shift saved on the device.
- [ ] Join the zone to the town over the real roads between them; it sits just south-west of 23
      Mile and Mound.

## Ideas (not planned)

Floated along the way. Any of them can join the plan once the spec says so.

**Aviation and military tech**

- A radar scope on the live ADS-B traffic, with a sweep, afterglow and labelled tags
- A failing build closes the runway with a notice to airmen; a deploy is a takeoff
- Flight strips in the tower for each project: a quiet repo squawks 7600, a failing build 7700
- Night-vision and thermal views (the materials are palette-based, so it's cheap)
- Selfridge watch: real military traffic crosses the sky, with a countdown to the base's new jets
- The Today panel as a 0700 briefing: weather, then scores as intel, comics as logistics and the
  agenda as ops
- A tactical map, with projects drawn as unit symbols
- A challenge-and-password look for Norbert's sign-in (the security stays the same)

**The sky**

- ISS passes at their real times, aurora on nights NOAA forecasts it, and the real moon phase
- Weather radar on the map

**Work you can see**

- Hangar doors open on days that project got a push
- Squadron patches for milestones, and a rank that climbs as projects ship

**A living town**

- Peach Festival weekend (a parade and car show on Main Street), Lions Thanksgiving, and game
  nights when the ball field lights up
- Michigan lefts where cars really U-turn, orange-barrel season, potholes, and plows after real
  snowfall
- A car-radio news break that reads the real headlines, weather and traffic
- Friends and family pick their own look
- A photo mode that saves a postcard of the view, and a time-lapse of the day
