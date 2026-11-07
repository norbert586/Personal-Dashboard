# Design: the N-586 console

The console is designed as a piece of personal hardware imagined around 1982: a putty-coloured
chassis with screwed-in panels, a glowing amber CRT, a segment-display clock and tape-deck keys.
**Cassette futurism** gives the world; **utilitarian design** (Braun, Teenage Engineering,
cockpit instruments) gives the discipline: every mark has a job.

Token values live in `src/styles/tokens.css` (the source of truth). This doc explains intent;
don't copy values here.

## Principles

1. **Casing is printed; screens glow.** Text on the chassis is silkscreen: Michroma for titles,
   B612 for everything else. Monospace (B612 Mono) appears only _on screens_, as emitted light.
   This rule decides every font question.
2. **One loud thing.** The status screen (the CRT) is the only element with scanlines, a
   vignette and a power-on moment. Other screens (clock, activity, devices) emit light but stay
   flat, and the casing stays quiet and printed.
3. **Every indicator means something.** No decorative LEDs. Each indicator reports a real state
   and is always paired with a word, because colour alone isn't enough.
4. **Panels, not cards.** Modules are faceplates in one chassis, separated by 2 px seams. No
   floating cards, no drop shadows, no hover lift. Depth comes from bevels and recessed screens.
5. **Plain words.** Sentence case. Name things by what they do ("Code activity", not "Telemetry").
   Tape-transport glyphs (● ▶ ❚❚ ■) add the flavour; the words beside them carry the meaning.

## Materials and colour

| Material         | Role                                                                                 |
| ---------------- | ------------------------------------------------------------------------------------ |
| Putty / graphite | Chassis plastic. Day theme is putty, night theme is graphite.                        |
| Faceplate        | Module panels, one step lighter than the chassis.                                    |
| Seam             | The dark gaps between panels. They draw the grid, so no borders are needed.          |
| Ink              | Silkscreen text. Muted ink for secondary text (still ≥ 4.5:1).                       |
| Glass            | Screens. Always dark in both themes, like real CRTs on beige machines.               |
| Phosphor amber   | Everything a screen emits. Also the single hue of the activity ramp.                 |
| Signal orange    | International orange, the "REC" colour: now-marker, Building status, focus on glass. |
| Status           | Green = live, red = offline. Reserved for state, never used for decoration.          |

Theming uses `color-scheme` + `light-dark()`, so each token is defined once with both values.
**Auto** follows the OS. The Day/Night keys override it; the choice is saved in a cookie, so
the server renders the right theme on the first byte (no flash, no inline script).

## Type

| Face              | Role                                   | Why                                                               |
| ----------------- | -------------------------------------- | ----------------------------------------------------------------- |
| **Michroma**      | Brand, module titles, cassette labels  | A Microgramma descendant, the typeface of 70s–80s sci-fi hardware |
| **B612**          | All casing text: lists, labels, values | Designed for Airbus cockpit displays; built for legibility        |
| **B612 Mono**     | Screen text only                       | Same skeleton as B612, so screens and casing feel related         |
| **DSEG7 Classic** | The clock only                         | Real seven-segment geometry, with unlit "ghost" segments          |

Scale (classical, after Bringhurst): 12 · 14 · 16 · 18 · 21 · 24 · 36 · 48 px. Body 16/1.5.
Line length ≤ 70ch. Large standalone numbers use proportional figures; `tabular-nums` only in
aligned columns (agenda times, tables).

## Layout

```
┌ chassis ─────────────────────────────────────────────────────────────┐
│ ▤ N-586  Personal console                 [ 14:32 ]  [Auto|Day|Night] │ ← rail
│ ┌──────────────────────────────────────────┬──────────────────────┐   │
│ │ STATUS SCREEN (CRT, the loud thing)      │ Agenda               │   │
│ │ Good afternoon, Norbert.                 │ 12:00 Lunch          │   │
│ │ Next  15:00 Lab session   in 28 min      │ ── now 14:32 ──      │   │
│ │ Tasks 4 open, 1 due today                │ 15:00 Lab session    │   │
│ ├──────────────────────────────────────────┼──────────────────────┤   │
│ │ Projects (cassette spines)               │ Tasks                │   │
│ │ ● Building  Crossbell vending   2 d ago  │ ☐ Review the spec    │   │
│ │ ❚❚ Paused   flightpi            8 mo ago │ ☐ Pick hosting       │   │
│ ├────────────────────────────┬─────────────┴──────────────────────┤   │
│ │ Code activity (LED matrix) │ Devices (LED bar meters)           │   │
│ └────────────────────────────┴────────────────────────────────────┘   │
│ rating plate: model, revision, rendered-at                            │
└───────────────────────────────────────────────────────────────────────┘
```

- 12-column panel grid at ≥ 1100 px, 6 columns at ≥ 720 px, one column below that, with the
  status screen first. Modules use container queries for their own internals.
- Everything is left-aligned. Numbers in columns align right.
- Radii follow hierarchy: chassis 14 px > screens 12 px > keys 4 px. Panels are square;
  the seams do the separating.

## Components

- **Status screen:** CRT with bezel, vignette, scanlines, phosphor glow, blinking cursor.
- **Segment clock:** DSEG7 digits over ghost "88:88"; the colon blinks once per second.
- **Theme keys:** three tape-deck keys (Auto, Day, Night); the pressed key sits lower. They're
  native radio buttons underneath.
- **Module faceplate:** title (Michroma) and provenance indicator (dot + word) on one line.
- **Cassette spine:** one row per project: status band and glyph, title, stack, last activity.
- **LED matrix:** 12 weeks × 7 days of round LEDs on glass, five-step amber ramp, with a table
  view underneath.
- **LED bar meter:** ten segments. Lit segments take the severity colour (amber normal,
  orange warm, red hot), unlit ones stay dim. The value and state are always printed beside it.
- **Rating plate:** footer facts (model, revision, render time), like the label under a device.

## Motion

One orchestrated moment: the status screen powers on at page load (≤ 450 ms). The only
ongoing motion is the clock colon and the cursor blinking. With `prefers-reduced-motion`,
all of it stops. No entrance animations on panels, no hover effects beyond colour.

## Accessibility floor

WCAG 2.2 AA. axe runs in every e2e test, in both themes. Visible focus everywhere (ink outline
on casing, orange on glass). Every chart has a text or table equivalent. Status indicators pair
colour with a shape and a word. Hit targets ≥ 24 px. Works at 200 % zoom and without JS.

## Deliberately avoided

These are the patterns that make a page look generated or templated:

- The SaaS card kit: floating rounded cards with soft grey shadows and gradient washes.
- All-caps tracked-out eyebrow labels above headings; labels in monospace on the casing.
- Meta strings joined with middle dots; "→" glued onto links; hover-lift on everything.
- Off-the-shelf UI kits (MUI, shadcn defaults). Our look comes from our own tokens.

## Open design questions

1. Amber phosphor (current) or green?
2. Physical details: keep it as is, or add more (screw heads, a speaker grille)?
3. Does Day or Night feel like "the" console to you? Both ship; Auto follows your OS.
