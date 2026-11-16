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

## Delivery mode ← you are here

The pizza delivery sim, as its own game mode at true scale (SPEC: Delivery mode; ADR-035 to 039).
Norbert moved it ahead of the rest of M1 on 2026-11-15; M1 picks up again at step 5 when he says
so. Each slice ends with something he can play.

**Where it stands (2026-11-15).** `/delivery` loads the whole zone and you can drive it: every
real street, the footprints as textured buildings with landmarks and signs, homes on every
residential street, a lit pizzeria with delivery parking, a few other cars, cyclists and people,
trees, a sky with the real sun, a car with an automatic gearbox, walls that stop you, a camera
behind the car and a dashboard. Nobody has
driven it on a real graphics card yet: the sandbox renders in software, at about 23 frames a
second. Start the next session by having Norbert play it, then work down this list.

1. [ ] **Drive the zone.** Is it fun to drive his streets?
   - [x] Map import: `npm run zone:import` bakes the 2.5 miles around Auburn and Dequindre from
         OpenStreetMap into `public/zone/auburn-dequindre.json` (ADR-037): the road graph,
         sidewalks, footprints, lots, water, parks and trees, with unit tests on a saved sample.
   - [x] The world (`src/game/delivery/world.ts`): built in 256 m squares around you, with pixel
         textures in one texture array (`tiles.ts`), concrete and asphalt streets with lane lines
         that stop at intersections (`roads.ts`), sidewalks and crosswalks, real footprints with
         windows, doors, garages and shop fronts facing the street (`buildings.ts`), trees in fall
         colour (`trees.ts`), and a dithered sky with the real sun, clouds and stars (`sky.ts`).
   - [x] The car, first pass (ADR-036): the model with its automatic gearbox (`car.ts`, every
         tuning value in `CAR`), walls and the zone's edge (`collide.ts`), a boxy body that leans
         (`car-body.ts`), the camera with close, far and hood views (`chase.ts`), and the dashboard:
         speed, gear, revs, the street and its limit, a heading-up map and the clock. Keyboard,
         controller and on-screen pedals.
   - [x] A fuller map, from Norbert's first look (2026-11-15). Landmarks read as what they are
         (`landmarks.ts`): steeples on churches, school entrances and flags, the hospital's towers
         with its H, showrooms with cars for sale, pumps under lit gas canopies, sign bands on
         strip malls. Every named place wears its name (`labels.ts`, ADR-039) on its wall and on
         a sign by the road; the dashboard says what you're beside, and the small map letters the
         landmarks. Streets the map left bare get stand-in homes (`src/lib/zone/fill.ts`, ADR-038),
         houses get driveways, and lots and driveways have parked cars you can't drive through.
   - [x] The pizzeria: a lit shop front with a striped awning and its sign, and marked delivery
         stalls where the drive starts.
   - [x] A little life (`traffic.ts`, `life.ts`): a few cars and cyclists on the real road graph
         and people on the real sidewalks, only around you. Cars keep their lane, stop for bigger
         roads, take turns at signals and wait behind you. `?traffic=0` empties the streets.
   - [ ] Look at the landmarks with Norbert, against his own drive: which are missing or wrong
         (dealerships and schools are the thinnest in OpenStreetMap; add them to
         `delivery.landmarks` in `site.config.ts` and re-run the import), and whether the hospital
         wants its real shape of towers rather than one tall block.
   - [ ] Signal heads you can see, showing the phase the other cars already follow.
   - [x] Norbert's first drive (2026-11-15): the car slid under braking and swung wide. Both
         were faults in the model, now fixed and tested (ADR-040), and the car is his 2006 HHR
         2.4 automatic in size, weight, gearing and looks. The store is on its real shop front,
         with the delivery parking behind it where he parks. Street lamps line the roads.
   - [ ] **Tune the feel with Norbert.** He plays; change `CAR` to match what he says. The values
         that matter most: `grip`, `steerOver` and `steerRate` (how sharp it turns), `inertia` and
         `handbrakeGrip` (how easily it slides and spins: the handbrake held at full lock for a second
         still turns the car right round, which may be too much), `torque` and the shift points, and
         the camera's distance and lag in `chase.ts`.
   - [ ] Frame rate on his laptop and phone. If it's short of 60: shadows are the first cost
         (`?shadows=0` to compare), then the build distance (`BUILD` in `world.ts`) and the
         picture's 360 lines (`driveScale`). A detail setting belongs in the menu.
   - [ ] Engine sound: a synthesised tone that follows `car.rpm`, a thunk on each change of
         `car.shifts`, and tyre squeal from `car.slip`, started by the first key press or tap,
         with a mute key. Without it the gear shifts are only seen, not felt.
   - [ ] Trees stop the car (trunks, kept by chunk), and the headlights' spotlight is checked at
         night: it's set by guess and hasn't been looked at.
   - [ ] Phone steering beyond two buttons (a slider or tilt), and a check with a real controller.
   - [ ] Known rough edges to decide on: M-59 and its crossings are flat and drive through each
         other; storeys, wall materials and which bay is a garage are guesses by building kind;
         unnamed lanes read "Service lane"; other cars don't see parked cars or each other at
         crossings beyond a simple give-way, and nothing happens if you hit a person (they stop
         and wait for you to pass).
2. [ ] **The delivery loop.** First walk Norbert through how a shift plays (SPEC open question
       11), a few questions at a time:
       where orders appear at the store and how he takes them; who decides a double or a triple;
       what counts as late, and how many orders an hour a slow night and a Friday rush bring, so
       a shift can be a real evening or a short one; what moves a tip (time, weather, the order,
       the customer); cash, card and change; regulars, apartment buzzers, dogs and dark porches;
       whether speeding, damage or gas should cost anything; and which car he drives, for the
       model and its colour.
   - [ ] The pizzeria on its real corner, under its stand-in name (SPEC open questions 5 and 12).
   - [ ] Addresses: every building gets one on its real street, with a house number from the
         Census Bureau's block ranges (the TIGER address-range files for Oakland and Macomb
         counties are public domain and reachable from the sandbox; they're zipped shapefiles, so
         reading them needs a small parser or a dependency with a decision entry). The door is
         the middle bay of the wall `buildings.ts` already picks as the front.
   - [ ] Orders on tickets, arriving by the real clock; singles, doubles and triples.
   - [ ] A GPS route: A* over the junctions and roads already in the zone file, drawn on the
         map and on the road.
   - [ ] Park, get out and walk to the door (the town's figure from `src/game/bodies.ts`, in
         metres); knock; the customer answers in an RPG-style dialogue: an HTML dialog with a
         portrait painted by code and text.
   - [ ] The clock, tips and how the shift went, with the best shift saved on the device.
3. [ ] **Roads that look right.** Modelled intersections with stop bars and medians, street-name
       signs with the real names (the painters have a pixel font), stop signs where the side
       street yields (the map has only 55), kerbs, and M-59's bridges and ramps.
4. [ ] **Traffic.** Signals that work (44 junctions carry one), then other cars that follow
       lanes, stop and turn. Real traffic from the feed can slow the real roads.
5. [ ] **Depth.** The radio, real rain and snow that change the grip (`Surface` in `car.ts`),
       seasons and snow cover from the forecast as in town, a start-up sequence, a detail
       setting, and a pizzeria door in town that opens the mode (today it's in the pause menu).

## M1: MVP, running locally (paused at step 5)

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
4. [x] **The town shows the feeds.** The town reads the same `/api/feeds.json` as the Today panel,
       so the two never disagree (SPEC: Feeds in town). A spot whose feed is offline says so and
       why, like the panel's cards (SPEC: Data rules).
   - [x] Cinema marquee: what's playing (TMDB), with Emagine Macomb's showtimes link in its window.
   - [x] Comic shop window: this week's DC, Image and Marvel books (ADR-026).
   - [x] Sports bar sign: live and final scores and the next games for the seven teams.
   - [x] Real aircraft from ADS-B fly over at their real positions, heights and headings. This step
         adds the world's one projection (ADR-019), which step 7 builds the map on.
   - [x] Weather and seasons: the forecast brings cloud, rain, snow and snow cover; the date brings
         blossom in the orchards, fall leaves and bare winter trees (DESIGN: Light, time and
         weather).
   - [x] Headlines and traffic in town: the headlines are in a newspaper box on Main Street, where
         you start. Traffic gets its freeway sign when step 7 brings M-53; until then it's on the
         Today line at the foot of the screen, with every other feed (ADR-032). This follows the
         proposal, because Norbert left the choice open: he can still ask for something else.
   - [x] The town becomes the home page. The Today panel keeps its own page (`/today`) and opens
         over the town with T (ADR-022, ADR-033). Phones open straight to the panel, over the
         town: Norbert left that choice open, so it's one setting (SPEC open question 8).
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
   - [ ] Map import: the delivery mode's importer (`src/lib/zone/`, ADR-037) takes a centre and a
         radius; point it at 23 to 29 Mile, Mound to Romeo Plank, for typed world data saved in
         the repo, so builds never touch the network: roads, water, parks, golf courses and the
         Macomb Orchard Trail. The data carries the ODbL credit and is shared under the same
         licence.
   - [ ] One projection from latitude and longitude to tiles (`src/game/world/projection.ts`, from
         step 4, ADR-030): one origin and one tiles-per-mile constant in one place. Unit-test it on
         real corners here.
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
   - [ ] The freeway sign over M-53 shows the worst of the area's traffic (TomTom), with the
         Traffic card in its window, like the boards on Main Street (ADR-029, ADR-032).
   - [ ] The Map pane shows the real grid and where you are (`paneMap` in `prototype/2d/p6-ui.js`).
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
    - [x] A public copy on GitHub Pages for playtesting on the go, rebuilt on a timer (ADR-034).
          Norbert turns it on once: Pages source set to GitHub Actions, and the three feed keys
          as Actions secrets.
    - [ ] Hosting: Claude proposes it, with storage that lasts for the Town Hall (SPEC open
          question 4, ADR-014). Norbert reaches it from home, at work and on the go, behind a
          login. A new decision entry.
    - [ ] The `public` gate mode, and `PRIVATE_FEEDS` to hide the calendar, to-dos and traffic
          without a code change (SPEC: Access).
    - [ ] Passkey sign-in for editing the Town Hall (ADR-014, SPEC open question 1).
    - [ ] Credits: TMDB's logo beside its notice. (The OpenStreetMap credit came with the delivery
          mode's map.)
    - [ ] Deploy, then check from a phone off Wi-Fi.

## After launch

In this order. The spec's After the MVP section says what's in scope; each milestone gets its
details in the spec and a plan before work starts.

### M2: On the road

- [ ] The car in town: the delivery mode's car (ADR-036), brought to the town's roads and scale.
      Park it anywhere and walk.
- [ ] Routes: pick a place or an address, and the road graph draws the way there with the dotted
      path, reusing the delivery mode's GPS.
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

**From wiring the feeds into town (step 4)**

- An orange-barrel message board: a trailer sign by the road that flashes the worst traffic
  incident, until M-53 has its freeway sign (and afterwards for road work)
- Tap an aircraft overhead for its window: the flight, the type, how high, and a link to its track
- Game nights: a score change flashes on the sports bar's board, the bar fills up while a team is
  live, and a win lights the water tower
- Opening night: a film that opens today gets searchlights over the cinema, and posters by the
  door from TMDB's art, pixelled down
- Wet streets that mirror the neon in rain, snow that builds up and gets ploughed, and footprints
- Lightning in a storm; the real wind bends the smoke, spins the turbines and fills a windsock at
  Ratiu Field
- Repaint the town in place, so snow can settle and melt while you're there (today it's painted
  when the town is built, ADR-031)
- The Today line as a car-radio voice once there's sound

**A living town**

- Peach Festival weekend (a parade and car show on Main Street), Lions Thanksgiving, and game
  nights when the ball field lights up
- Michigan lefts where cars really U-turn, orange-barrel season, potholes, and plows after real
  snowfall
- A car-radio news break that reads the real headlines, weather and traffic
- Friends and family pick their own look
- A photo mode that saves a postcard of the view, and a time-lapse of the day
