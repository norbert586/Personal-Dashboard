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

## M1: MVP ← you are here

1. [ ] **Town island in Astro.** three.js from npm (pinned), the 3D engine ported from `prototype/`
       to TypeScript in `src/game/`, replacing the console page. An e2e smoke test: the canvas boots
       with no console errors.
2. [ ] **One town definition.** Layout and buildings as typed data. Add the park with a small lake,
       a library, tennis courts and a dog park.
3. [ ] **You.** Walk, run, bike, click or tap to walk, collisions, silhouette, camera rotate and zoom.
       Your device remembers where you were.
4. [ ] **Projects.** Door prompt and window per building, plus a real page at `/projects/<slug>`
       from `src/content/projects/`. Screenshots and demo links for Overhead, Tetris Plus and
       Crossbell Vending.
5. [ ] **Coding activity.** GitHub pushes and new repos drive fireworks and the crane on the empty
       lot.
6. [ ] **Today panel.** One key away, good on a phone, every feed on sample data with provenance.
7. [ ] **Real feeds, one at a time:** weather, scores, comics, showtimes, flights overhead,
       calendar, to-dos, news, traffic. Each gets a parser unit test and an offline state. Answer
       the spec's open questions before the last four.
8. [ ] **The town shows the feeds.** Marquee, comic shop window, sports bar sign, real aircraft in
       the sky, the forecast's weather and seasons.
9. [ ] **Music and sound.** On by default after the first key press; tracks by place and time.
10. [ ] **DOS mode, passport stamps and a handful of secrets.**
11. [ ] **Polish.** Performance (fewer draw calls, phones), an accessibility pass, `public` gate
        mode and `PRIVATE_FEEDS`.
12. [ ] **Launch.** Pick hosting (new ADR), deploy, check it from a phone off Wi-Fi.

## M2: After launch

- [ ] The car: start-up sequence, radio, gears
- [ ] The plane and the landing challenge
- [ ] Recurring characters who talk
- [ ] Guestbook: visitors leave a plane or a name (needs moderation)
- [ ] New districts: cider mill, industrial park, drive-in, high-school field, mall, a base
- [ ] Helicopter, train rides, skateboard, sled and snowmobile
- [ ] Interiors for the hero buildings
- [ ] More secrets

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
