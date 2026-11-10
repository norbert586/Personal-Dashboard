import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

/**
 * Open the town and get to playing: skip the intro, or on a phone close the Today panel it opens
 * with. `query` can start you somewhere else: "?at=3.6,19.75".
 */
async function enterTown(page: Page, query = ''): Promise<void> {
  await page.goto(`/${query}`);
  await expect(page.locator('html')).toHaveAttribute('data-town', 'ready', { timeout: 20_000 });
  const skip = page.getByRole('button', { name: 'Skip intro' });
  const today = page.getByRole('dialog', { name: 'Today' });
  await expect(skip.or(today)).toBeVisible();
  if (await today.isVisible()) await today.getByRole('button', { name: 'Close' }).click();
  else await skip.click();
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
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-town', 'no-webgl');
  const notice = page.getByRole('region', { name: 'The town needs WebGL' });
  await expect(notice).toBeVisible();
  await expect(notice.getByRole('link', { name: 'Read Today instead' })).toHaveAttribute(
    'href',
    '/today',
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

test('it boots like an old PC game, and Esc pauses it', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones open straight to the Today panel instead of the intro');
  await page.goto('/');
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

test('with reduced motion, the intro is skipped', async ({ page, isMobile }) => {
  test.skip(isMobile, 'phones never see the intro');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-shell', 'play', { timeout: 20_000 });
});

test('T opens Today over the town, with the same cards as the Today page', async ({
  page,
  context,
  isMobile,
}) => {
  await enterTown(page);
  const today = page.getByRole('dialog', { name: 'Today' });
  // T on a keyboard; on a phone, the Today line at the foot of the screen.
  if (isMobile) await page.getByRole('link', { name: /^Today/ }).click();
  else {
    await page.locator('#world').focus();
    await page.keyboard.press('t');
  }
  await expect(today).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-shell', 'paused'); // the town holds still
  await expect(today.getByRole('region')).toHaveCount(11);
  const results = await new AxeBuilder({ page }).include('#today').analyze();
  expect(results.violations).toEqual([]);

  // Card for card, it's the Today page.
  const other = await context.newPage();
  await other.goto('/today');
  for (const name of ['Weather', 'Traffic', 'Scores', 'World news', 'Flights overhead'])
    expect(await today.getByRole('region', { name }).innerText(), name).toBe(
      await other.getByRole('region', { name }).innerText(),
    );
  await other.close();
  await expect(today.getByRole('link', { name: 'Open it as a page' })).toHaveAttribute(
    'href',
    '/today',
  );

  if (isMobile) await today.getByRole('button', { name: 'Close' }).click();
  else await page.keyboard.press('t'); // T closes it again
  await expect(today).toBeHidden();
  await expect(page.locator('html')).toHaveAttribute('data-shell', 'play');
});

test('phones open straight to the Today panel, with the town behind it', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'desktops open with the intro');
  await page.goto('/');
  const today = page.getByRole('dialog', { name: 'Today' });
  await expect(today).toBeVisible({ timeout: 20_000 });
  await expect(today.getByRole('region', { name: 'Weather' })).toContainText('Mostly Cloudy');
  await expect(page.getByRole('button', { name: 'Skip intro' })).toBeHidden();
  await today.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-shell', 'play');
  await expect(page.locator('#hint-text')).toContainText('Tap anywhere to walk');
});

test('the pause menu opens Today too', async ({ page }) => {
  await enterTown(page);
  await page.getByRole('button', { name: 'Menu' }).click();
  const menu = page.getByRole('dialog', { name: 'Paused' });
  await menu.getByRole('button', { name: 'Today', exact: true }).click();
  await menu.getByRole('button', { name: 'Open Today' }).click();
  await expect(menu).toBeHidden();
  const today = page.getByRole('dialog', { name: 'Today' });
  await expect(today.getByRole('region', { name: 'Movies' })).toContainText('Wildwood');
  await today.getByRole('button', { name: 'Close' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-shell', 'play');
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
  {
    place: 'Sports bar',
    at: '?at=6.6,19.75',
    // Samples read as they did when saved: the Lions won at Miami that Sunday.
    sign: ['data-sign-scores', /^SAMPLE DATA\|.*\|LIONS @MIA\|W 19-9 TODAY\|/],
    card: 'Scores',
    has: '19–9 at MIA',
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
    await today.goto('/today');
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

test('the Today line starts with the weather, and says a sample is a sample', async ({ page }) => {
  // It only moves on while you're playing, so read it behind the intro (or a phone's Today panel).
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-feeds', 'ready', { timeout: 20_000 });
  await expect(page.locator('#ticker-text')).toHaveText(
    '52°F, mostly cloudy, wind W 5 mph (sample data)',
  );
});

test('the newspaper box where you start has the headlines', async ({ page }) => {
  await enterTown(page);
  await expect(page.getByRole('link', { name: /^Today/ })).toBeVisible();

  await page.locator('#world').focus();
  await expect(page.getByRole('button', { name: 'Newspaper box' })).toBeVisible();
  await page.keyboard.press('f');
  const window = page.getByRole('dialog', { name: 'Newspaper box' });
  await expect(window).toBeVisible();
  for (const section of ['Local news', 'Tech news', 'National news', 'World news'])
    await expect(window.getByRole('region', { name: section })).toContainText('Sample data');
  await expect(
    window.getByRole('region', { name: 'Local news' }).getByRole('link').first(),
  ).toHaveAttribute('href', /^https:\/\/www\.clickondetroit\.com\//);
  const results = await new AxeBuilder({ page }).include('#window').analyze();
  expect(results.violations).toEqual([]);
});

test('when the town cannot reach its feeds, the marquee goes dark and the window says why', async ({
  page,
}) => {
  await page.route('**/api/feeds.json', (route) => route.fulfill({ status: 503, body: 'down' }));
  await enterTown(page, AT_CINEMA);
  await expect(page.locator('html')).toHaveAttribute('data-feeds', 'unreachable');
  await expect(page.locator('#ticker-text')).toHaveText(
    "The town couldn't reach its feeds: the server answered 503.",
  );
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

test('real aircraft fly where the feed says they are', async ({ page }) => {
  await enterTown(page);
  const world = page.locator('#world');
  // The saved sample has 11 aircraft in the air, the nearest 13 miles off: none over the town.
  await expect(world).toHaveAttribute('data-aircraft', '11');
  await expect(world).toHaveAttribute('data-overhead', '0');
});

test('an aircraft over the real town is over the town', async ({ page }) => {
  // Move one of the sample's aircraft to the town's own point (site.config.ts) and hold it there.
  await page.route('**/api/feeds.json', async (route) => {
    const response = await route.fetch();
    const json = await response.json();
    const airborne = json.feeds.flights.data.aircraft.find(
      (aircraft: { onGround: boolean }) => !aircraft.onGround,
    );
    Object.assign(airborne, { lat: 42.72, lon: -83.03, speedKt: 0 });
    await route.fulfill({ response, json });
  });
  await enterTown(page);
  await expect(page.locator('#world')).toHaveAttribute('data-overhead', '1');
  // The Today line tells you to look up, and who it is.
  await expect(page.locator('#ticker-text')).toHaveText(
    'Look up: N831VP, 2,650 ft, heading W (sample data)',
  );
});

test('the sky follows the forecast, and a preview says it is one', async ({ page }) => {
  const errors = collectErrors(page);
  await enterTown(page);
  // The saved sample: 52°F and mostly cloudy.
  await expect(page.locator('#world')).toHaveAttribute('data-weather', 'cloudy');

  await enterTown(page, '?sky=snow&season=winter');
  await expect(page.locator('#world')).toHaveAttribute(
    'data-weather',
    'snow, preview, snow on the ground',
  );
  await page.waitForTimeout(500);
  expect(errors, 'console errors, including CSP violations').toEqual([]);
});
