import { defineConfig, devices } from '@playwright/test';

/** Gated with ACCESS_MODE=private-network; the tests connect from loopback, so they're let in. */
export const OPEN_PORT = 4329;
/** No ACCESS_MODE at all: must refuse every request (fail closed). */
export const CLOSED_PORT = 4330;

// e2e runs against the real production build (`npm run build` first), because the CSP and
// the access gate only exist there, never in `astro dev`.
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: {
    baseURL: `http://127.0.0.1:${OPEN_PORT}`,
    trace: 'off',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],
  webServer: [
    {
      command: 'node tests/e2e/serve.mjs private-network',
      env: { HOST: '127.0.0.1', PORT: String(OPEN_PORT) },
      url: `http://127.0.0.1:${OPEN_PORT}/`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: 'node tests/e2e/serve.mjs none',
      env: { HOST: '127.0.0.1', PORT: String(CLOSED_PORT) },
      url: `http://127.0.0.1:${CLOSED_PORT}/`,
      reuseExistingServer: !process.env.CI,
    },
  ],
});
