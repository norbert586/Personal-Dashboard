# N-586 personal console

My private command console: today's agenda, open tasks, every project's state, code activity
and device health on one screen. Designed like a piece of cassette-futurist hardware.

Built with Astro 7 + TypeScript. Private by default: a production server refuses every
request until an access mode is configured (see `docs/DECISIONS.md`, ADR-004 and ADR-005).

## Run it

```sh
npm install
npm run dev            # http://localhost:4321
```

Production build, gated to loopback, LAN and Tailscale addresses:

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
