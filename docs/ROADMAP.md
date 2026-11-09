# Roadmap

What's next, in order. Tick boxes as work lands, and keep each milestone shippable.
The git log is the history; this file is only the plan.

Each MVP step is one reviewable slice: built, tested, screenshotted, and small enough for Norbert to
check in one sitting.

## M0: Foundation ✅

- [x] Lean doc system, Astro 7 + TypeScript, CSP, fail-closed gate, `npm run verify`
- [x] The cassette console on sample data (superseded by ADR-009; the tooling carries over)

## Prototypes ✅

- [x] v1–v3: the 2D isometric town (boot screen, pause menu, building windows, DOS mode, sample
      morning update, real sun, people and traffic)
- [x] 3D feel test: the same town in three.js with walking, running, biking, free rotation, door
      prompts and night lighting
- [x] Direction locked: SPEC, DESIGN, DECISIONS (ADR-009 to 013) and this roadmap rewritten

## M1: MVP, running locally ← you are here

Feeds come first: they're useful on their own, and the town reads them later.

1. [x] **Feeds, server side.** One source per feed in `src/lib/sources/`, each a `Reading<T>` with a
       parser unit test on a saved sample and an offline state. Weather, scores, comics, movies,
       news (local, tech, national, world), area traffic, flights overhead and GitHub activity, from
       the sources in ADR-015 and ADR-017. Free keys (Comic Vine, TMDB, TomTom) live in `.env`. One
       cached JSON endpoint serves them all (`/api/feeds.json`, ADR-021).
   - [ ] Check comics against the live Comic Vine API once a session has the key: its sample is
         built from the docs, and the batched volume lookup isn't documented (ADR-025).
2. [x] **Today panel.** The morning update as an HTML page on real data, good on a phone. It's the
       home page until the town lands (ADR-022).
3. [ ] **Town island in Astro.** Port the 3D engine from `prototype/3d/` to TypeScript in
       `src/game/`, including what the prototype learned: street-aligned keys, click-to-walk with A*,
       going inside, flyovers. An e2e smoke test: the canvas boots with no console errors.
4. [ ] **The town shows the feeds.** Marquee, comic shop window, sports bar sign, real aircraft from
       ADS-B, the forecast's weather and seasons.
5. [ ] **Town Hall.** To-dos and calendar stored locally (SQLite), editable from this machine.
6. [ ] **Projects.** Building windows and real pages at `/projects/<slug>`, screenshots and demo
       links for the star projects. GitHub pushes drive fireworks; new repos drive the crane.
7. [ ] **The big world** (ADR-016, ADR-019). OpenStreetMap data to typed world data through one
       fixed projection. Roads become a named, routable graph. Every building gets a stable address,
       lot and door. Seeded houses go along the real streets and landmarks are placed by hand.
       Sections stream by the square mile, then tune tiles per mile. The generator handles more than one area, so the delivery zone (ADR-020) drops in later.
8. [ ] **Music and sound.** On by default after the first key press; tracks by place and time.
9. [ ] **DOS mode, passport stamps and a handful of secrets.**
10. [ ] **Polish.** Performance (draw calls, phones), accessibility, saved position.
11. [ ] **Going public.** Hosting (new ADR), the `public` gate mode, `PRIVATE_FEEDS`, passkey
        sign-in for the Town Hall (ADR-014), TMDB's logo beside its notice, deploy, and a check
        from a phone off Wi-Fi.

## M2: After launch

- [ ] The car: start-up sequence, radio, gears
- [ ] The plane and the landing challenge
- [ ] Recurring characters who talk
- [ ] Guestbook: visitors leave a plane or a name (needs moderation)
- [ ] Past the grid's edges: north toward Romeo, a cider mill, a drive-in, a high-school field, a
      mall, a base
- [ ] Helicopter, train rides, skateboard, sled and snowmobile
- [ ] Interiors for the hero buildings
- [ ] More secrets
- [ ] Much later: a pizza delivery sim based on where Norbert works. Orders are addresses, routes
      come from the road graph, and you drive the car, in the delivery zone around Auburn and Dequindre (ADR-020)

## Ideas (not planned)

- A radar scope on live ADS-B traffic, and tower radio read from real METAR weather
- A failing build closes the runway with a notice to airmen; a deploy is a takeoff
- Flight strips in the tower for each project
- Night-vision and thermal views (the materials are palette-based, so it's cheap)
- Selfridge watch: real military traffic crosses the sky; a countdown to the F-15EX
- ISS passes and aurora on nights NOAA forecasts it
- Peach Festival weekend, Lions Thanksgiving, game nights at the ball field
- Michigan lefts, orange-barrel season, plows after real snowfall
- A photo mode that saves a postcard of the view
