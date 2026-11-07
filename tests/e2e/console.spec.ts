import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const MODULES = ['Agenda', 'Tasks', 'Projects', 'Code activity', 'Devices'];

/** Console errors include CSP violations, so an empty list means the policy holds. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('renders every module and labels where its data comes from', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/');

  await expect(page.getByRole('heading', { level: 1 })).toContainText('Norbert');
  for (const name of MODULES) {
    await expect(page.getByRole('region', { name })).toBeVisible();
  }
  await expect(page.getByRole('region', { name: 'Projects' })).toContainText('Local files');
  await expect(page.getByRole('region', { name: 'Agenda' })).toContainText('Sample data');
  await expect(page.getByRole('region', { name: 'Projects' })).toContainText('Crossbell Vending');

  expect(errors, 'console errors, including CSP violations').toEqual([]);
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
  test(`meets WCAG 2.2 AA per axe (${colorScheme})`, async ({ page }) => {
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

test('theme keys switch the theme and the server remembers it', async ({ page }) => {
  await page.goto('/');
  const html = page.locator('html');

  await page.locator('label.key', { hasText: 'Night' }).click();
  await expect(html).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(html).toHaveAttribute('data-theme', 'dark');
  await expect(page.getByRole('radio', { name: 'Night' })).toBeChecked();

  await page.locator('label.key', { hasText: 'Auto' }).click();
  await expect(html).not.toHaveAttribute('data-theme');
  await page.reload();
  await expect(html).not.toHaveAttribute('data-theme');
});

test.describe('without JavaScript', () => {
  test.use({ javaScriptEnabled: false });

  test('still shows every module', async ({ page }) => {
    await page.goto('/');
    for (const name of MODULES) {
      await expect(page.getByRole('region', { name })).toBeVisible();
    }
  });
});
