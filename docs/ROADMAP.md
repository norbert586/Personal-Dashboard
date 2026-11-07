# Roadmap

What's next, in order. Tick boxes as work lands, and keep each milestone shippable.
The git log is the history; this file is only the plan.

## M0: Foundation ✅

- [x] Lean doc system: CLAUDE.md, SPEC, DESIGN, DECISIONS, ROADMAP
- [x] Astro 7 + TypeScript, Node adapter, self-hosted fonts, CSP
- [x] Fail-closed access gate with unit tests
- [x] Design tokens (Day/Night), chassis, rail, status screen, segment clock, theme keys
- [x] Modules on sample data: agenda, tasks, projects (local files), code activity, devices
- [x] `npm run verify`: format, types, unit, build, e2e + axe (both themes) + gate test

## M1: Review and refine (together) ← you are here

- [ ] Norbert reviews `SPEC.md` and answers its open questions
- [ ] Design critique of the screenshots: phosphor colour, density, device name, physical details
- [ ] Write a one-line summary for every project in `src/content/projects/`
- [ ] Decide ADR-005 (hosting + gate) and ADR-006 (tasks backend)

## M2: Real data

- [ ] Agenda: Google Calendar secret iCal address in `.env`, parsed server-side
- [ ] Code activity: GitHub GraphQL contributions via a read-only token
- [ ] Projects: last-activity dates from GitHub instead of hand-edited frontmatter
- [ ] Tasks: the backend chosen in ADR-006
- [ ] Each source: unit test for parsing plus an Offline state when it fails

## M3: Devices and deploy

- [ ] flightpi: a tiny JSON health endpoint on the Pi (temp, load, disk, uptime)
- [ ] Deploy per ADR-005, with the gate configured. Verify that a request from outside
      gets a 403.
- [ ] Uptime checks for deployed sites (crossbell-vending and others)

## M4: Interactions

- [ ] Tick tasks and add quick notes from the console (Astro Actions)
- [ ] Keyboard shortcuts for jumping between modules
- [ ] Optional: a public showcase built from a subset of modules (SPEC, open question 3)
