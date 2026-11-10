import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/** Open the town and skip the intro. `query` can start you somewhere else: "?at=3.6,19.75". */
async function enterTown(page: Page, query = ''): Promise<void> {
  await page.goto(`/town${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-town', 'ready', { timeout: 20_000 });
  await page.getByRole('button', { name: 'Skip intro' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-shell', 'play');
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

test('the town boots with no console errors or CSP violations', async ({ page }) => {
  const errors = collectErrors(page);
  await enterTown(page);
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
  await enterTown(page);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('N and the time button step through real time, midday, dusk and night', async ({ page }) => {
  await enterTown(page);
  const button = page.getByRole('button', { name: 'Real time' });
  await button.click();
  await expect(page.getByRole('button', { name: 'Midday' })).toBeVisible();
  await page.locator('#world').focus();
  await page.keyboard.press('n');
  await expect(page.locator('html')).toHaveAttribute('data-time', 'dusk');
  await page.keyboard.press('n');
  await expect(page.getByRole('button', { name: 'Night' })).toBeVisible();
});

test('keys walk you along the street, and B gets on the bike', async ({ page }) => {
  await enterTown(page);
  const world = page.locator('#world');
  await world.focus();
  const start = (await world.getAttribute('data-at')) ?? '';
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(700);
  await page.keyboard.up('KeyW');
  const [x0, y0] = start.split(',').map(Number);
  const [x1, y1] = ((await world.getAttribute('data-at')) ?? '').split(',').map(Number);
  // Up walks north (-x) along Main Street's sidewalk, and stays on it.
  expect(x1!).toBeLessThan(x0! - 0.3);
  expect(y1).toBe(y0);

  await page.keyboard.press('b');
  await expect(page.getByRole('button', { name: 'Bike' })).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('html')).toHaveAttribute('data-mode', 'bike');
});

test('phones get touch help instead of keyboard help', async ({ page, isMobile }) => {
  await enterTown(page);
  const hint = page.locator('#hint-text');
  if (isMobile) await expect(hint).toContainText('Drag to turn the camera');
  else await expect(hint).toContainText('WASD');
});

test('keyboard alone: walk to a door, go in, read its window, and come back out', async ({
  page,
}) => {
  await enterTown(page);
  await page.locator('#world').focus();
  // From the start, S walks south along Main Street to the Coney diner's door.
  await page.keyboard.down('KeyS');
  const prompt = page.getByRole('button', { name: /Coney diner: Food Orders/ });
  await expect(prompt).toBeVisible({ timeout: 5000 });
  await page.keyboard.up('KeyS');

  await page.keyboard.press('f');
  const window = page.getByRole('dialog', { name: 'Food Orders' });
  await expect(window).toBeVisible();
  await expect(window).toContainText('Coney diner');
  await expect(window.getByRole('link', { name: 'Open on GitHub' })).toHaveAttribute(
    'href',
    'https://github.com/norbert586/food-orders-app',
  );
  const results = await new AxeBuilder({ page }).include('#window').analyze();
  expect(results.violations).toEqual([]);

  await page.keyboard.press('Escape');
  await expect(window).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-place', 'out');
  await expect(prompt).toBeVisible();

  // Walking straight into the door goes in too (D heads into the shopfront in this view).
  await page.locator('#world').focus();
  await page.keyboard.down('KeyD');
  await expect(window).toBeVisible({ timeout: 5000 });
  await page.keyboard.up('KeyD');
});

test('it boots like an old PC game, and Esc pauses it', async ({ page }) => {
  await page.goto('/town');
  await expect(page.getByText('Loading RATIU TWP')).toBeVisible({ timeout: 20_000 });
  await page.keyboard.press('Enter'); // any key skips ahead to setup
  const setup = page.getByRole('region', { name: 'RATIU TWP SETUP' });
  await expect(setup).toBeVisible();
  await page.keyboard.press('ArrowDown');
  await expect(setup.getByRole('option', { name: 'No sound' })).toHaveAttribute(
    'aria-selected',
    'true',
  );
  await page.keyboard.press('Enter');
  await expect(page.getByRole('region', { name: 'RATIU TWP' })).toBeVisible();
  await page.keyboard.press('x'); // press any key
  await expect(page.locator('html')).toHaveAttribute('data-shell', 'play');
  // No trace of the old names (ADR-012).
  await expect(page.locator('body')).not.toContainText(/586|Norbert Field/i);

  await page.keyboard.press('Escape');
  const menu = page.getByRole('dialog', { name: 'Paused' });
  await expect(menu).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-shell', 'paused');
  await page.keyboard.press('ArrowDown');
  await page.keyboard.press('Enter');
  await expect(menu.getByRole('region', { name: 'Projects' })).toContainText('Tetris Plus');
  const results = await new AxeBuilder({ page }).include('#pause').analyze();
  expect(results.violations).toEqual([]);
  await page.keyboard.press('Escape');
  await expect(menu).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-shell', 'play');
});

test('with reduced motion, the intro is skipped', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/town');
  await expect(page.locator('html')).toHaveAttribute('data-shell', 'play', { timeout: 20_000 });
});

// The e2e server answers every feed from its saved sample (serve.mjs).
const AT_CINEMA = '?at=3.6,19.75';
const FEED_SHOPS = [
  {
    place: 'Cinema',
    at: AT_CINEMA,
    sign: ['data-sign-movies', /^SAMPLE DATA\|WILDWOOD\|PG-13\|THE MONGOOSE\|R\|/],
    card: 'Movies',
    has: 'Wildwood',
  },
  {
    place: 'Comic shop',
    at: '?at=5.0,19.75',
    sign: ['data-sign-comics', /^SAMPLE DATA\|NEW COMICS\|32 THIS WEEK\|/],
    card: 'New comics',
    has: 'Batman #15',
  },
] as const;

for (const shop of FEED_SHOPS)
  test(`the ${shop.place.toLowerCase()}'s board and window show its feed, as Today does`, async ({
    page,
    context,
  }) => {
    await enterTown(page, shop.at);
    await expect(page.locator('html')).toHaveAttribute('data-feeds', 'ready');
    // The board: where the data came from, then what the feed has.
    await expect(page.locator('#world')).toHaveAttribute(shop.sign[0], shop.sign[1]);

    await page.locator('#world').focus();
    await expect(page.getByRole('button', { name: shop.place })).toBeVisible();
    await page.keyboard.press('f');
    const window = page.getByRole('dialog', { name: shop.place });
    await expect(window).toBeVisible();
    const card = window.getByRole('region', { name: shop.card });
    await expect(card).toContainText('Sample data');
    await expect(card).toContainText(shop.has);
    const results = await new AxeBuilder({ page }).include('#window').analyze();
    expect(results.violations).toEqual([]);

    // The window's card is the Today panel's card, word for word.
    const today = await context.newPage();
    await today.goto('/');
    expect(await card.innerText()).toBe(
      await today.getByRole('region', { name: shop.card }).innerText(),
    );
  });

test("the cinema's window links to Emagine Macomb's showtimes", async ({ page }) => {
  await enterTown(page, AT_CINEMA);
  await page.locator('#world').focus();
  await page.keyboard.press('f');
  await expect(
    page
      .getByRole('dialog', { name: 'Cinema' })
      .getByRole('link', { name: 'Showtimes at Emagine Macomb' }),
  ).toHaveAttribute('href', /emagine/);
});

test('when the town cannot reach its feeds, the marquee goes dark and the window says why', async ({
  page,
}) => {
  await page.route('**/api/feeds.json', (route) => route.fulfill({ status: 503, body: 'down' }));
  await enterTown(page, AT_CINEMA);
  await expect(page.locator('html')).toHaveAttribute('data-feeds', 'unreachable');
  await expect(page.locator('#world')).toHaveAttribute(
    'data-sign-movies',
    'OFFLINE|NO SIGNAL|ASK INSIDE',
  );
  await page.locator('#world').focus();
  await page.keyboard.press('f');
  await expect(page.getByRole('dialog', { name: 'Cinema' })).toContainText(
    "The town couldn't reach its feeds: the server answered 503.",
  );
});
