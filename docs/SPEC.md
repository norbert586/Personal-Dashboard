# Spec: Ratiu Twp

**Status:** v1.0, MVP defined · **Updated:** 2026-11-08

This is the only spec. Change it here, in place; don't fork it.

## What it is

My personal site as a small 3D pixel-art town you can walk, run and bike around. Every building
is one of my projects. The morning update lives in town (the cinema, the comic shop, the sports
bar) and in a Today panel one key away. The town is loosely Romeo and Washington Township,
Michigan: a rust-belt small town with an airfield, a brick Main Street, a subdivision, a tool and
die shop, a grain elevator by the tracks and orchards at the edge.

Prototypes that define the look and feel live in `prototype/` (see ADR-013).

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

| Area               | What ships                                                                                                                       | Done when                                                              |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| The town           | Today's prototype town in 3D, plus a park with a small lake, a library, tennis courts and a dog park                             | One typed definition drives it; the default view matches the feel test |
| You                | A regular guy: walk (WASD/arrows), run (Shift), bike (B), click or tap to walk                                                   | Never gets stuck; keyboard alone can reach every building              |
| Camera             | Isometric angle, free rotation (Q/E, drag), whole-step zoom, follows you; silhouette when hidden                                 | No shimmer while panning; you're always findable                       |
| Projects           | Each project is a building. Walk up and press F (or tap) for its window: description, screenshots, tech, demo, GitHub, lessons   | Every project also has a real page at `/projects/<slug>`               |
| Star projects      | Overhead, Tetris Plus and Crossbell Vending get screenshots and a demo link                                                      | Content filled in `src/content/projects/`                              |
| Coding activity    | Loud: fireworks over a building on days its repo got a push; a crane on the empty lot when a new repo appears                    | Driven by GitHub, with an offline state                                |
| Today panel        | One key (T) or button away, readable on a phone                                                                                  | Every feed shows its provenance (live, sample, offline)                |
| Feeds              | Weather, scores (live and final), schedules, new comics, showtimes, calendar, to-dos, news, traffic, flights overhead. No stocks | Each is a `Reading<T>` source with a unit test and an offline state    |
| Feeds in town      | Cinema marquee, comic shop window, sports bar sign, real aircraft overhead, weather in the sky                                   | The town and the panel never disagree                                  |
| Time, sky, seasons | Real sun and shadows; weather from the forecast; seasons by date                                                                 | Matches the feel test at day, dusk and night                           |
| Sound              | Music on by default, starting at the first key press or click; tracks change with place and time                                 | Mute and volume are one key away                                       |
| DOS mode           | The plain-text version of the whole site                                                                                         | Works with a screen reader and without WebGL                           |
| Saving             | Your device remembers where you were and what you've found                                                                       | Nothing breaks when storage is blocked                                 |

### Feeds and where they come from

| Feed              | Plan                                                                                                                                                        |
| ----------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Weather           | National Weather Service API (free, no key) for current conditions and the forecast                                                                         |
| Scores, schedules | Pistons, Lions, Tigers, Red Wings, Michigan basketball and football, Georgia Tech football. Free sources are mostly unofficial, so pick one with a fallback |
| Comics            | This week's new releases from DC, Image and Marvel. No good official API; research in the feeds step                                                        |
| Movies            | Showtimes for Emagine Macomb. No public API; research in the feeds step                                                                                     |
| Flights overhead  | Public ADS-B feeds (adsb.lol or airplanes.live), not flightpi                                                                                               |
| Calendar          | Open question 1                                                                                                                                             |
| To-dos            | Open question 2                                                                                                                                             |
| News              | Open question 3                                                                                                                                             |
| Traffic           | Open question 4                                                                                                                                             |

## After the MVP

The car (start-up sequence, radio, gears), the plane and the landing challenge, recurring characters
who talk, the guestbook (visitors leave a plane or a name), new districts (cider mill, industrial
park, drive-in, high-school field, mall, a base), the helicopter, train rides, skateboard and winter
vehicles, and interiors. Order lives in `ROADMAP.md`.

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

- The calendar shows titles and times only, with no locations and no guest names.
- One server setting (`PRIVATE_FEEDS`) hides the calendar, to-dos and traffic without a code change.

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

1. **Calendar:** Google, Apple (iCloud), Outlook, or none? Google and iCloud both offer a private
   address the server can read.
2. **To-dos:** where do they live today? Google Tasks, Apple Reminders, Todoist, Notes, or nowhere?
   With nothing in place, a simple list built into the site works.
3. **News:** what kind? Local Detroit news, tech, world, or a few specific sites?
4. **Traffic:** which drive matters in the morning, e.g. home to work? The general area is enough.
5. **Hosting:** Claude proposes it before launch (ADR to come).
