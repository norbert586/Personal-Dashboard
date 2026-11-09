import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

// The e2e server runs with FEEDS=sample (serve.mjs): every card shows its saved sample.
const CARDS = [
  'Weather',
  'Traffic',
  'Scores',
  'Local news',
  'Tech news',
  'National news',
  'World news',
  'New comics',
  'Movies',
  'Flights overhead',
  'Coding activity',
];

/** Console errors include CSP violations, so an empty list means the policy holds. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('shows every feed, each labelled with where its data came from', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Today');
  await expect(page.getByRole('banner')).toContainText('Ratiu Twp');
  for (const name of CARDS) {
    const card = page.getByRole('region', { name });
    await expect(card).toBeVisible();
    await expect(card).toContainText('Sample data');
  }
  await expect(page.getByRole('banner')).toContainText(`${CARDS.length} sample data`);

  expect(errors, 'console errors, including CSP violations').toEqual([]);
});

test('reads the saved samples as they were when captured', async ({ page }) => {
  await page.goto('/');
  const weather = page.getByRole('region', { name: 'Weather' });
  await expect(weather).toContainText('52');
  await expect(weather).toContainText('Mostly Cloudy');
  await expect(weather.getByRole('list', { name: 'This week' }).getByRole('listitem')).toHaveCount(
    7,
  );

  const lions = page
    .getByRole('region', { name: 'Scores' })
    .getByRole('listitem')
    .filter({ hasText: 'Lions' });
  await expect(lions).toContainText('19–9 at MIA');
  await expect(lions).toContainText('Won'); // the W, in words for screen readers

  const local = page.getByRole('region', { name: 'Local news' });
  await expect(local.getByRole('link').first()).toHaveAttribute(
    'href',
    /^https:\/\/www\.clickondetroit\.com\//,
  );
  await expect(local).toContainText('hours ago');

  const traffic = page.getByRole('region', { name: 'Traffic' });
  await expect(traffic.getByRole('listitem').first()).toContainText('Clinton River Rd');
  await expect(traffic).toContainText('24 Mile Rd');
  await expect(traffic).toContainText('Romeo Plank Rd to North Ave, both ways');
  await expect(traffic).toContainText('12 closures on side streets not shown.');

  const comics = page.getByRole('region', { name: 'New comics' });
  await expect(comics).toContainText('Week of Nov 2: 32 books');
  await expect(comics.getByRole('heading', { name: /^DC/ })).toBeVisible();
  await expect(comics).toContainText('Batman #15');

  const movies = page.getByRole('region', { name: 'Movies' });
  await expect(movies.getByRole('listitem').first()).toContainText('Wildwood');
  await expect(movies.getByRole('listitem').first()).toContainText('PG-13');
  await expect(movies.getByRole('link', { name: 'Showtimes at Emagine Macomb' })).toBeVisible();

  await expect(page.getByRole('region', { name: 'Flights overhead' })).toContainText('N831VP');
  const activity = page.getByRole('region', { name: 'Coding activity' });
  await expect(activity).toContainText('8 pushes to 2 projects in the last two weeks, 6 today.');
  await expect(activity.getByRole('link', { name: 'Ratiu Twp' })).toHaveAttribute(
    'href',
    'https://github.com/norbert586/Personal-Dashboard',
  );
  await expect(page.getByRole('contentinfo')).toContainText('National Weather Service');
});

test('responds with private-by-default headers', async ({ request }) => {
  const response = await request.get('/');
  expect(response.status()).toBe(200);
  const headers = response.headers();
  expect(headers['cache-control']).toBe('private, no-store');
  expect(headers['x-robots-tag']).toContain('noindex');
  expect(headers['referrer-policy']).toBe('no-referrer');
  expect(headers['content-security-policy']).toContain("script-src 'self'");
});

for (const colorScheme of ['light', 'dark'] as const) {
  test(`meets WCAG 2.2 AA per axe (${colorScheme} device setting)`, async ({ page }) => {
    await page.emulateMedia({ colorScheme, reducedMotion: 'reduce' });
    await page.goto('/');
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
      .analyze();
    const violations = results.violations.map(
      (violation) =>
        `${violation.id}: ${violation.help} → ${violation.nodes.map((node) => node.target.join(' ')).join(', ')}`,
    );
    expect(violations).toEqual([]);
  });
}

test('fits the screen without scrolling sideways', async ({ page }) => {
  await page.goto('/');
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBe(0);
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('still shows every feed', async ({ page }) => {
    await page.goto('/');
    for (const name of CARDS) {
      await expect(page.getByRole('region', { name })).toBeVisible();
    }
  });
});
