# Ratiu Twp

My personal site as a small 3D pixel-art town you can walk, run and bike around. Every building
is one of my projects, and the morning update (weather, scores, comics, showtimes and more) lives
in town and in a Today panel. Loosely based on Romeo and Washington Township, Michigan.

**Status:** the home page is the town, showing the morning feeds on real data: the cinema's
marquee, the comic shop, the sports bar's scoreboard, a newspaper box, real aircraft overhead and
the forecast's weather. The Today panel opens over it with T and has its own page at `/today`.
The plan is in [`docs/SPEC.md`](docs/SPEC.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md).

Built with Astro 7, TypeScript and three.js.

## Prototypes

```sh
prototype/build.sh     # writes prototype/dist/town-2d.html and ratiu-twp-3d.html
```

Open either file in a browser. The 3D one loads three.js from a CDN.

## Run the app

```sh
npm install
cp .env.example .env   # then add the free keys for movies, traffic and comics
npm run dev            # http://localhost:4321
```

Without a key, that feed shows its saved sample and says which key to add. `FEEDS=sample npm run
dev` runs every feed from saved samples, with no network.

Production build, gated to loopback, LAN and Tailscale addresses until the `public` mode lands
(ADR-011):

```sh
npm run build
HOST=0.0.0.0 PORT=4321 node --env-file=.env dist/server/entry.mjs
```

`--env-file` loads `ACCESS_MODE` and the feed keys; the built server doesn't read `.env` by
itself.

## Check it

```sh
npx playwright install chromium   # once
npm run verify                    # format, types, unit, build, e2e + accessibility
```

## Docs

| File                                     | Answers                     |
| ---------------------------------------- | --------------------------- |
| [`CLAUDE.md`](CLAUDE.md)                 | How to work in this repo    |
| [`docs/SPEC.md`](docs/SPEC.md)           | What we're building and why |
| [`docs/DESIGN.md`](docs/DESIGN.md)       | How it looks and why        |
| [`docs/DECISIONS.md`](docs/DECISIONS.md) | Why things are this way     |
| [`docs/ROADMAP.md`](docs/ROADMAP.md)     | What's next                 |
