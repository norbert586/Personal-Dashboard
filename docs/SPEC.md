# Spec: personal console

**Status:** draft v0.1, awaiting Norbert's review · **Updated:** 2026-11-07

This is the only spec. Change it here, in place; don't fork it.

## Why

School, side projects (Crossbell Vending, Overhead, flightpi, Tetris Plus, …) and devices
each keep their state in a different tab. I want one private screen that tells me where
everything stands and what's next, and that I actually enjoy opening.

## Who

Just me, for now. Desktop first, phone second. No other users, no sharing.

## Goals for v1

1. **Five-second check-in.** What's next today, what's open, what needs attention.
2. **Every project in one place,** with its current state.
3. **Live signals from my own stuff:** GitHub activity, Raspberry Pi health.
4. **Feels like hardware I designed:** cassette futurism, utilitarian (see `DESIGN.md`).

## Not in v1

- A public portfolio. Possibly later as a public subset; see open questions.
- Editing data from the console. v1 reads; writing (tick a task, add a note) comes after.
- Multiple users, accounts, sharing, comments.
- Offline/PWA mode, native apps.

## The screen

v1 is a single screen, the console, made of modules:

| Module        | Shows                                                       | Source in v1                                  | Today  |
| ------------- | ----------------------------------------------------------- | --------------------------------------------- | ------ |
| Status screen | Greeting, date, next event, task summary, data health       | Derived from the other modules                | Built  |
| Clock         | Local time as a segment display                             | Browser clock                                 | Built  |
| Agenda        | Today's events and a "now" marker                           | Google Calendar secret iCal address           | Sample |
| Tasks         | Open tasks, what's due                                      | To decide (ADR-006)                           | Sample |
| Projects      | Every project as a cassette spine with status and last work | `src/content/projects/*.md` + GitHub pushes   | Local  |
| Code activity | 12-week activity matrix, commits, active days, streak       | GitHub GraphQL API (personal token)           | Sample |
| Devices       | flightpi: online, temperature, load, disk, uptime           | Small HTTP endpoint on the Pi, over Tailscale | Sample |

Project status uses tape-transport words: **Building** (●, actively working), **Live**
(▶, shipped and running), **Paused** (❚❚), **Archived** (■).

## Data rules

- Every module shows its provenance (Live, Local files, Sample data or Offline) as an
  indicator with a text label.
- A failing source never breaks the page. The module shows Offline and says why.
- Secrets (tokens, private calendar URLs) stay on the server and never reach the browser.
- Sample data looks plausible but is always labelled as sample.

## Access: why a private console needs a gate

A deployed site is reachable by anyone who has, guesses or scans its address. Once the
console shows real data (calendar, tasks, device addresses) or holds tokens for my accounts,
something must check that the visitor is me. That check can live in three places:

1. **The network:** run it only on my machines or tailnet (Tailscale). Nobody else can
   route to it, so no login screen is needed.
2. **An access proxy:** host it publicly but put Cloudflare Access (or similar) in front.
   The proxy handles login (email code, GitHub); the app has no auth code.
3. **The app itself:** our own login (sessions, passwords/passkeys). Most code, most risk.
   Only worth it once part of the site is public and part is private.

v1 is built for option 1 or 2 (decision pending: ADR-005). The app also **fails closed**:
a production server refuses every request until an access mode is configured, so a
misconfigured deploy shows nothing private.

## Quality bar

- **Accessibility:** WCAG 2.2 AA, checked automatically with axe in e2e tests, plus
  keyboard-only and 200% zoom checks by hand.
- **Performance (on home network):** server response < 200 ms, LCP < 1.5 s, CLS < 0.05,
  < 20 KB of JavaScript. The page works without JavaScript; JS only animates the clock and
  remembers the theme.
- **Security:** fail-closed access gate, Content Security Policy on, secrets server-only.
- **Responsive:** 320 px and up; the console reflows to a single column on phones.

## Open questions

1. **Hosting + gate (ADR-005):** run on the Pi behind Tailscale, or Cloudflare + Access?
2. **Tasks backend (ADR-006):** GitHub Issues, a Markdown file in a private repo, Todoist,
   or a small SQLite table on the Pi?
3. **Public showcase later?** Which modules, if any, become public, and at what address?
4. **Clock format:** 24-hour (current default, fits the aesthetic) or 12-hour?
5. **Device name:** the design calls the console "N-586" (from your handle). Keep or rename?
