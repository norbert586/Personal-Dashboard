import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Open the delivery mode and wait for the car. `query` can start you elsewhere: "?at=3,-160". */
async function clockIn(page: Page, query = ''): Promise<void> {
  await page.goto(`/delivery${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-delivery', 'ready', { timeout: 60_000 });
}

/** Console errors include CSP violations, so an empty list means the policy holds. */
function collectErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (message) => {
    if (message.type() === 'error') errors.push(message.text());
  });
  page.on('pageerror', (error) => errors.push(error.message));
  return errors;
}

const mph = (page: Page) => async () =>
  Number(await page.locator('#world').getAttribute('data-mph'));

/** On Auburn Road beside the store, heading east in the right-hand lane, with the streets empty. */
const ON_AUBURN = '?at=-89,-23&heading=77&traffic=0';

test('the drive starts in the delivery parking at the store, with no console errors or CSP violations', async ({
  page,
}) => {
  const errors = collectErrors(page);
  await clockIn(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText("Ratiu's Pizza");
  await expect(page.locator('#loading')).toBeHidden();
  const world = page.locator('#world');
  await expect(world).toHaveAttribute('data-street', 'Delivery parking');
  await expect(world).toHaveAttribute('data-gear', 'P');
  await expect(world).toHaveAttribute('data-mph', '0');
  // The dashboard says the same in words, and names the store you're parked at.
  await expect(page.locator('#street')).toHaveText('Delivery parking');
  await expect(page.locator('#place')).toHaveText("The store · Ratiu's Pizza");
  await expect(page.locator('#limit')).toBeHidden();

  // The low-res picture is scaled up by a whole number of device pixels and covers the window.
  const fit = await world.evaluate((canvas: HTMLCanvasElement) => {
    const box = canvas.getBoundingClientRect();
    return {
      scale: Number(canvas.dataset.scale),
      device: (box.width * devicePixelRatio) / canvas.width,
      covers: box.width >= innerWidth && box.height >= innerHeight,
    };
  });
  expect(Number.isInteger(fit.scale)).toBe(true);
  expect(fit.device).toBeCloseTo(fit.scale, 2);
  expect(fit.covers).toBe(true);

  await page.waitForTimeout(500);
  expect(errors, 'console errors, including CSP violations').toEqual([]);
});

test('on a street, the dashboard names it and its limit; beside a landmark, it names that too', async ({
  page,
}) => {
  await clockIn(page, ON_AUBURN);
  const world = page.locator('#world');
  await expect(world).toHaveAttribute('data-street', /Auburn Road/);
  await expect(page.locator('#limit-mph')).toHaveText(/^\d\d$/);
  // Parked in front of the church west of the store.
  await clockIn(page, '?at=-212,-78&heading=89&traffic=0');
  await expect(world).toHaveAttribute('data-place', 'Church · Gethsemane Church');
  await expect(page.locator('#place')).toHaveText('Church · Gethsemane Church');
});

test('other cars, cyclists and people on foot turn up around you, and ?traffic=0 empties the streets', async ({
  page,
}) => {
  await clockIn(page);
  const world = page.locator('#world');
  const count = (what: string) => async () =>
    Number(
      new RegExp(`(\\d+) ${what}`).exec((await world.getAttribute('data-traffic')) ?? '')?.[1],
    );
  await expect.poll(count('cars'), { timeout: 30_000 }).toBeGreaterThan(2);
  await expect.poll(count('on foot'), { timeout: 30_000 }).toBeGreaterThan(2);
  await clockIn(page, ON_AUBURN);
  await page.waitForTimeout(1500);
  await expect(world).toHaveAttribute('data-traffic', '0 cars, 0 bikes, 0 on foot');
});

test('the gas pulls away through the gears, and the brake stops the car', async ({ page }) => {
  await clockIn(page, ON_AUBURN);
  const world = page.locator('#world');
  const from = await world.getAttribute('data-at');
  await page.keyboard.down('KeyW');
  await expect.poll(mph(page), { timeout: 30_000 }).toBeGreaterThan(20);
  await expect(world).toHaveAttribute('data-gear', /^[1-6]$/);
  await page.keyboard.up('KeyW');
  expect(await world.getAttribute('data-at')).not.toBe(from);

  // Holding the brake stops the car and holds it there.
  await page.keyboard.down('KeyS');
  await expect.poll(mph(page), { timeout: 30_000 }).toBe(0);
  await page.waitForTimeout(800);
  await expect(world).toHaveAttribute('data-mph', '0');
  await page.keyboard.up('KeyS');
});

test('the on-screen pedals drive the car on a phone', async ({ page, isMobile }) => {
  test.skip(!isMobile, 'the pedals only show on touch screens');
  await clockIn(page, ON_AUBURN);
  const gas = page.getByRole('button', { name: 'Gas' });
  await expect(gas).toBeVisible();
  await gas.dispatchEvent('pointerdown');
  await expect.poll(mph(page), { timeout: 30_000 }).toBeGreaterThan(10);
  await gas.dispatchEvent('pointerup');
});

test('Escape opens the menu, which holds the drive and links back to town', async ({ page }) => {
  await clockIn(page);
  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: 'Paused' });
  await expect(menu).toBeVisible();
  await expect(menu.getByRole('link', { name: 'Walk into town' })).toHaveAttribute('href', '/');
  await expect(menu.getByRole('link', { name: 'OpenStreetMap' })).toBeVisible();
  // Held behind the menu: the gas does nothing.
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(600);
  await page.keyboard.up('KeyW');
  await menu.getByRole('button', { name: 'Resume' }).click();
  await expect(menu).toBeHidden();
  await expect(page.locator('#world')).toHaveAttribute('data-mph', '0');
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
  await page.goto('/delivery');
  await expect(page.locator('html')).toHaveAttribute('data-delivery', 'no-webgl');
  const notice = page.getByRole('region', { name: 'Delivery needs WebGL' });
  await expect(notice).toBeVisible();
  await expect(notice.getByRole('link', { name: 'Read Today instead' })).toHaveAttribute(
    'href',
    '/today',
  );
});

test('the delivery page passes axe', async ({ page }) => {
  await clockIn(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});
