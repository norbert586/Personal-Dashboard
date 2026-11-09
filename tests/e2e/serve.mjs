// Start the built server with an explicit access mode, or with none at all ("none"),
// regardless of what ACCESS_MODE the surrounding shell has. Used by playwright.config.ts.
// Feeds answer from the saved samples, so tests never touch the network and always see the same data.
const mode = process.argv[2];
if (!mode) throw new Error('Usage: node tests/e2e/serve.mjs <private-network|none>');

if (mode === 'none') delete process.env.ACCESS_MODE;
else process.env.ACCESS_MODE = mode;
process.env.FEEDS = 'sample';

await import('../../dist/server/entry.mjs');
