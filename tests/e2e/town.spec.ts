import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Console errors include CSP violations, so an empty list means the policy holds. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

test('the town boots with no console errors or CSP violations', async ({ page }) => {
  const errors = collectErrors(page);
  await page.goto('/town');
  await expect(page.locator('html')).toHaveAttribute('data-town', 'ready', { timeout: 20_000 });
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ratiu Twp');
  await expect(page.locator('#loading')).toBeHidden();

  // The low-res framebuffer is scaled up by a whole number of device pixels and covers the window.
  const fit = await page.locator('#world').evaluate((canvas: HTMLCanvasElement) => {
    const box = canvas.getBoundingClientRect();
    return {
      scale: Number(canvas.dataset.scale),
      dpr: devicePixelRatio,
      device: (box.width * devicePixelRatio) / canvas.width,
      covers: box.width >= innerWidth && box.height >= innerHeight,
    };
  });
  expect(Number.isInteger(fit.scale)).toBe(true);
  expect(fit.device).toBeCloseTo(fit.scale, 2); // layout rounds CSS sizes to 1/64 px
  expect(fit.covers).toBe(true);

  // Let a few frames render before checking the log.
  await page.waitForTimeout(500);
  expect(errors, 'console errors, including CSP violations').toEqual([]);
});

test('without WebGL, the page says so and links the plain pages', async ({ page }) => {
  await page.addInitScript(() => {
    type GetContext = (this: HTMLCanvasElement, kind: string, ...rest: unknown[]) => unknown;
    const proto = HTMLCanvasElement.prototype as unknown as { getContext: GetContext };
    const getContext = proto.getContext;
    proto.getContext = function (kind, ...rest) {
      return kind.startsWith('webgl') ? null : getContext.call(this, kind, ...rest);
    };
  });
  await page.goto('/town');
  await expect(page.locator('html')).toHaveAttribute('data-town', 'no-webgl');
  const notice = page.getByRole('region', { name: 'The town needs WebGL' });
  await expect(notice).toBeVisible();
  await expect(notice.getByRole('link', { name: 'Read Today instead' })).toHaveAttribute(
    'href',
    '/',
  );
});

test('the town page passes axe', async ({ page }) => {
  await page.goto('/town');
  await expect(page.locator('html')).toHaveAttribute('data-town', 'ready', { timeout: 20_000 });
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('N and the time button step through real time, midday, dusk and night', async ({ page }) => {
  await page.goto('/town');
  await expect(page.locator('html')).toHaveAttribute('data-town', 'ready', { timeout: 20_000 });
  const button = page.getByRole('button', { name: 'Real time' });
  await button.click();
  await expect(page.getByRole('button', { name: 'Midday' })).toBeVisible();
  await page.locator('#world').focus();
  await page.keyboard.press('n');
  await expect(page.locator('html')).toHaveAttribute('data-time', 'dusk');
  await page.keyboard.press('n');
  await expect(page.getByRole('button', { name: 'Night' })).toBeVisible();
});
