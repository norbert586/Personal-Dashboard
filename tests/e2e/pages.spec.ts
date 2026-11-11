import { test, expect } from '@playwright/test';
import { PAGES_PORT } from '../../playwright.config.ts';

// The GitHub Pages build (ADR-034): plain files under the repository's name, with the feeds
// rendered at build time. serve-pages.mjs serves it as GitHub does, from saved samples.
const SITE = `http://127.0.0.1:${PAGES_PORT}/Personal-Dashboard`;

test('the town boots under the repository path, with its feeds and no CSP violations', async ({
  page,
}) => {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  const missing: string[] = [];
  page.on('response', (response) => {
    if (response.status() >= 400) missing.push(response.url());
  });

  await page.goto(`${SITE}/`);
  await expect(page.locator('html')).toHaveAttribute('data-town', 'ready', { timeout: 20_000 });
  // The town has read its feeds: the sky shows the saved forecast, and no aircraft are tracked.
  const world = page.locator('#world');
  await expect(world).toHaveAttribute('data-weather', /.+/);
  await expect(world).toHaveAttribute('data-aircraft', 'offline');

  await page.waitForTimeout(500);
  expect(missing, 'requests that failed').toEqual([]);
  expect(errors, 'console errors, including CSP violations').toEqual([]);
});

test('the town and the Today page link to each other under the repository path', async ({
  page,
}) => {
  await page.goto(`${SITE}/today/`);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Today');
  await expect(page.locator('meta[http-equiv="content-security-policy"]')).toHaveCount(1);

  await page.getByRole('link', { name: 'Walk into town' }).click();
  await expect(page).toHaveURL(`${SITE}/`);
  await expect(page.locator('#ticker')).toHaveAttribute('href', '/Personal-Dashboard/today');
});

test('the feeds are files, and the aircraft say why they are missing', async ({ request }) => {
  const response = await request.get(`${SITE}/api/feeds.json`);
  expect(response.status()).toBe(200);
  const { feeds } = await response.json();
  expect(feeds.weather.provenance).toBe('sample');
  expect(feeds.flights.provenance).toBe('offline');
  expect(feeds.flights.detail).toContain('home server');

  const cards = await request.get(`${SITE}/today/cards`);
  expect(cards.status()).toBe(200);
  expect(await cards.text()).toContain('data-card');
});
