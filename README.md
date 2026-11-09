# Ratiu Twp

My personal site as a small 3D pixel-art town you can walk, run and bike around. Every building
is one of my projects, and the morning update (weather, scores, comics, showtimes and more) lives
in town and in a Today panel. Loosely based on Romeo and Washington Township, Michigan.

**Status:** the Astro app serves the Today panel: the morning feeds on real data, good on a phone.
The town exists as prototypes in `prototype/` until it's ported. The plan is in
[`docs/SPEC.md`](docs/SPEC.md) and [`docs/ROADMAP.md`](docs/ROADMAP.md).

Built with Astro 7, TypeScript and three.js.

## Prototypes

```sh
prototype/build.sh     # writes prototype/dist/town-2d.html and ratiu-twp-3d.html
```

Open either file in a browser. The 3D one loads three.js from a CDN.

## Run the app

```sh
npm install
npm run dev            # http://localhost:4321
```

Production build, gated to loopback, LAN and Tailscale addresses until the `public` mode lands
(ADR-011):

```sh
npm run build
ACCESS_MODE=private-network HOST=0.0.0.0 PORT=4321 node dist/server/entry.mjs
```

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
