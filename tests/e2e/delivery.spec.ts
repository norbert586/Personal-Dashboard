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
  await expect(world).toHaveAttribute('data-gear', /^[1-4]$/);
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

test('stopped beside a house, the dashboard names its address; driving on, it stops', async ({
  page,
}) => {
  // On Hessel Avenue, in front of a house with its mailbox at the curb.
  await clockIn(page, '?at=-99,-90&heading=178&traffic=0');
  const world = page.locator('#world');
  await expect(world).toHaveAttribute('data-address', /^\d{5} Hessel Avenue$/);
  const address = (await world.getAttribute('data-address'))!;
  await expect(page.locator('#place')).toHaveText(address);
  await page.keyboard.down('KeyW');
  await expect.poll(mph(page), { timeout: 30_000 }).toBeGreaterThan(5);
  // The line goes back to the place nearby, or hides when there's none.
  await expect
    .poll(
      async () =>
        (await page.locator('#place-box').isHidden()) ||
        (await page.locator('#place').textContent()) !== address,
    )
    .toBe(true);
  await page.keyboard.up('KeyW');
});

test('a tree stops the car at its trunk', async ({ page }) => {
  // South of Auburn Road, pointing north across it at a tree the map has at (-40.1, 3.1).
  await clockIn(page, '?at=-40.1,-22&heading=0&traffic=0');
  const world = page.locator('#world');
  const north = async () => Number((await world.getAttribute('data-at'))!.split(',')[1]);
  await page.keyboard.down('KeyW');
  await expect.poll(mph(page), { timeout: 30_000 }).toBeGreaterThan(8);
  // Foot still down, it stops with its nose on the trunk, and stays there.
  await expect.poll(mph(page), { timeout: 30_000 }).toBe(0);
  await page.waitForTimeout(800);
  await page.keyboard.up('KeyW');
  const y = await north();
  expect(y).toBeGreaterThan(-1);
  expect(y).toBeLessThan(1.6);
});

test('the signal ahead at Auburn and Dequindre shows a light, and it changes', async ({ page }) => {
  test.slow();
  // In the eastbound lane on Auburn Road, a short block from the signal.
  await clockIn(page, '?at=-55,-15.3&heading=77&traffic=0');
  const world = page.locator('#world');
  await expect(world).toHaveAttribute('data-signal', /^(green|yellow|red)$/);
  const first = await world.getAttribute('data-signal');
  // A turn is 24 seconds at most, on the game's clock.
  await expect.poll(() => world.getAttribute('data-signal'), { timeout: 120_000 }).not.toBe(first);
  await expect(world).toHaveAttribute('data-signal', /^(green|yellow|red)$/);
});

test('away from any signal, the drive reports none', async ({ page }) => {
  await clockIn(page, '?at=-99,-90&heading=178&traffic=0');
  await expect(page.locator('#world')).toHaveAttribute('data-signal', '');
});

/** Building 5000 is a house on Mayapple Drive, about three miles south of the store. */
const TO_MAYAPPLE = '?to=5000&traffic=0';

test("the GPS names the order's address with the miles and minutes to it, and G turns it off and on", async ({
  page,
}) => {
  await clockIn(page, TO_MAYAPPLE);
  const world = page.locator('#world');
  await expect(world).toHaveAttribute('data-gps', /^40775 Mayapple Drive, 3\.\d mi, [5-8] min$/);
  await expect(page.locator('#gps-to')).toHaveText('40775 Mayapple Drive');
  await expect(page.locator('#gps-left')).toHaveText(/^· 3\.\d mi · [5-8] min$/);
  const button = page.getByRole('button', { name: 'GPS: on' });
  await expect(button).toHaveAttribute('aria-pressed', 'true');

  await page.keyboard.press('KeyG');
  await expect(world).toHaveAttribute('data-gps', '');
  await expect(page.locator('#gps-box')).toBeHidden();
  await expect(page.getByRole('button', { name: 'GPS: off' })).toHaveAttribute(
    'aria-pressed',
    'false',
  );

  // On again, it's the same order's door: the GPS no longer picks an address of its own.
  await page.keyboard.press('KeyG');
  await expect(world).toHaveAttribute('data-gps', /^40775 Mayapple Drive, 3\.\d mi, [5-8] min$/);
  expect(Number(await world.getAttribute('data-gps-metres'))).toBeGreaterThan(4000);
});

test('without the GPS there is no route, and the page with it on passes axe', async ({ page }) => {
  await clockIn(page);
  await expect(page.locator('#world')).toHaveAttribute('data-gps', '');
  await expect(page.locator('#gps-box')).toBeHidden();
  await page.goto(`/delivery${TO_MAYAPPLE}`);
  await expect(page.locator('#gps-box')).toBeVisible();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('the GPS paints the way on the road, and driving it shortens what is left', async ({
  page,
}) => {
  test.slow();
  // Westbound on Auburn Road, the way this route sets off.
  await clockIn(page, `${TO_MAYAPPLE}&at=-60,-13&heading=257`);
  const world = page.locator('#world');
  const left = async () => Number(await world.getAttribute('data-gps-metres'));
  await expect
    .poll(async () => Number(await world.getAttribute('data-gps-marks')))
    .toBeGreaterThan(100);
  const from = await left();
  expect(from).toBeGreaterThan(4000);
  await page.keyboard.down('KeyW');
  await expect.poll(left, { timeout: 40_000 }).toBeLessThan(from - 40);
  await page.keyboard.up('KeyW');
});

const HAND_OVERS = /^(Leave it on the porch|Call first|Text first|Knock|Ring the bell)$/;

test('parked behind the store you hold a ticket: an address, an order, a hand-over and a quote', async ({
  page,
}) => {
  await clockIn(page, '?traffic=0');
  const world = page.locator('#world');
  await expect(world).toHaveAttribute(
    'data-ticket',
    /^\d{5} .+ \| .+ \| \$\d+\.\d\d \| .+ \| \d+ min$/,
  );
  const ticket = page.getByRole('region', { name: 'Your order' });
  await expect(ticket).toBeVisible();
  await expect(page.locator('#ticket-none')).toBeHidden();
  const address = (await page.locator('#ticket-to').textContent()) ?? '';
  expect(address).toMatch(/^\d{5} \S/);
  await expect(page.locator('#ticket-order')).toHaveText(/(large|medium|deep dish) /);
  await expect(page.locator('#ticket-total')).toHaveText(/^\$\d+\.\d\d$/);
  await expect(page.locator('#ticket-note')).toHaveText(/^“.+”$/);
  await expect(page.locator('#ticket-how')).toHaveText(HAND_OVERS);
  // Still in the stall, the clock hasn't started: it's the quote, in whole minutes.
  await expect(page.locator('#ticket-clock')).toHaveText(/^Quoted ([2-9]|1[0-5]) min$/);

  // The GPS is off until you ask, and then it finds this ticket's door.
  await expect(world).toHaveAttribute('data-gps', '');
  await expect(page.locator('#gps-box')).toBeHidden();
  await page.keyboard.press('KeyG');
  await expect(page.locator('#gps-to')).toHaveText(address);
  await expect(world).toHaveAttribute('data-gps', /, \d+\.\d mi, \d+ min$/);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test("the ticket's clock starts as you drive out, and back in the stall you get the next one", async ({
  page,
}) => {
  test.slow();
  await clockIn(page, '?traffic=0');
  const world = page.locator('#world');
  const clock = page.locator('#ticket-clock');
  await expect(clock).toHaveText(/^Quoted \d+ min$/);
  const first = await world.getAttribute('data-ticket');
  // Back out of the stall: S from a stop is reverse.
  await page.keyboard.down('KeyS');
  await expect(world).not.toHaveAttribute('data-street', 'Delivery parking', { timeout: 40_000 });
  await page.keyboard.up('KeyS');
  await expect(clock).toHaveText(/^\d+:\d\d left$/);
  await expect(world).toHaveAttribute('data-ticket', first ?? '');
  const left = async () => {
    const [m, s] = ((await clock.textContent()) ?? '').split(' ')[0]!.split(':').map(Number);
    return m! * 60 + s!;
  };
  const from = await left();
  await expect.poll(left, { timeout: 20_000 }).toBeLessThan(from);

  // R is back in the stall, stopped: that order is swapped for a new one, not yet running.
  await page.keyboard.press('KeyR');
  await expect(clock).toHaveText(/^Quoted \d+ min$/, { timeout: 20_000 });
  await expect(world).not.toHaveAttribute('data-ticket', first ?? '');
});

test('away from the store with no order, the ticket and the GPS say so', async ({ page }) => {
  await clockIn(page, '?at=-60,-13&heading=257&traffic=0');
  const world = page.locator('#world');
  await expect(world).toHaveAttribute('data-ticket', '');
  await expect(page.locator('#ticket-none')).toHaveText(/^No order\. Stop in the delivery parking/);
  await expect(page.locator('#ticket-body')).toBeHidden();
  await page.keyboard.press('KeyG');
  await expect(page.locator('#gps-to')).toHaveText('No order to find');
  await expect(world).toHaveAttribute('data-gps', 'No order to find');
  await expect(world).toHaveAttribute('data-gps-marks', '0');
});

test('a ticket named in the address bar is the same every time, and already on the clock away from the store', async ({
  page,
}) => {
  await clockIn(page, `${TO_MAYAPPLE}&at=-60,-13&heading=257`);
  await expect(page.locator('#world')).toHaveAttribute(
    'data-ticket',
    '40775 Mayapple Drive | large ham and pineapple, 2-litre cola | $18.98 | Call first | 9 min',
  );
  await expect(page.locator('#ticket-note')).toHaveText(
    '“Please call first. Do not wake the baby.”',
  );
  await expect(page.locator('#ticket-clock')).toHaveText(/^8:\d\d left$/);
});

/**
 * Pulled up across Mayapple Drive with the nose toward 40775, holding its ticket: the front door
 * is straight ahead of where you step out, 18 m off.
 */
const AT_MAYAPPLE = `${TO_MAYAPPLE}&at=-1126,-3396.4&heading=270`;
const metres = (page: Page, name: string) => async () =>
  Number(await page.locator('#world').getAttribute(name));

test("stopped, F gets you out; you walk to your order's door, a wall stops you, and the clock runs on", async ({
  page,
  isMobile,
}) => {
  test.setTimeout(180_000);
  await clockIn(page, AT_MAYAPPLE);
  const world = page.locator('#world');
  await expect(world).toHaveAttribute('data-on-foot', 'false');
  await expect(world).toHaveAttribute('data-mph', '0');
  // What F would do is named: on a line with its key, or on the button over the gas on a phone.
  if (isMobile) await expect(page.getByRole('button', { name: 'Get out' })).toBeVisible();
  else await expect(page.locator('#prompt')).toHaveText(/^\s*F\s*Get out\s*$/);
  const clock = page.locator('#ticket-clock');
  const left = async () => {
    const [m, s] = ((await clock.textContent()) ?? '').split(' ')[0]!.split(':').map(Number);
    return m! * 60 + s!;
  };
  const before = await left();

  await page.keyboard.press('KeyF');
  await expect(world).toHaveAttribute('data-on-foot', 'true');
  // The dashboard has no speed to give: it says you're on foot and how far the car is.
  await expect(page.locator('#foot-how')).toHaveText('On foot');
  await expect(page.locator('#foot-car')).toHaveText(/^Car \d+ ft$/);
  await expect(page.locator('#mph')).toBeHidden();
  await expect.poll(metres(page, 'data-door')).toBeGreaterThan(15);
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);

  // Walk, then run, straight to the door.
  await page.keyboard.down('KeyW');
  await expect.poll(metres(page, 'data-car'), { timeout: 30_000 }).toBeGreaterThan(1);
  await expect(page.locator('#foot-how')).toHaveText('On foot');
  await page.keyboard.down('ShiftLeft');
  await expect(page.locator('#foot-how')).toHaveText('Running');
  await expect.poll(metres(page, 'data-door'), { timeout: 90_000 }).toBeLessThan(2);
  await expect(page.locator('#place')).toHaveText('At the door · 40775 Mayapple Drive');
  // Still running at it: the wall holds, a body's width from the door.
  await page.waitForTimeout(2500);
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.up('KeyW');
  const door = await metres(page, 'data-door')();
  expect(door).toBeGreaterThan(0.2);
  expect(door).toBeLessThan(1);
  const [east] = ((await world.getAttribute('data-at')) ?? '').split(',').map(Number);
  expect(east).toBeGreaterThan(-1143.9);
  await expect(page.locator('#place')).toHaveText('At the door · 40775 Mayapple Drive');

  // The order's clock kept running all the way, and the car is where you left it: too far for F.
  expect(await left()).toBeLessThan(before);
  await expect(clock).toHaveText(/^\d+:\d\d left$/);
  await page.keyboard.press('KeyF');
  await expect(page.locator('#foot-car')).toHaveText(/^Car [45]0 ft$/);
  await expect(world).toHaveAttribute('data-on-foot', 'true');
  await expect(page.locator('#prompt')).toBeHidden();
});

test('back beside the car, F gets you in and it drives again', async ({ page, isMobile }) => {
  test.setTimeout(180_000);
  await clockIn(page, AT_MAYAPPLE);
  const world = page.locator('#world');
  await page.keyboard.press('KeyF');
  await expect(world).toHaveAttribute('data-on-foot', 'true');
  await page.keyboard.down('KeyW');
  await expect.poll(metres(page, 'data-car'), { timeout: 60_000 }).toBeGreaterThan(3);
  await page.keyboard.up('KeyW');
  // Out of reach, F does nothing and nothing offers it.
  await page.keyboard.press('KeyF');
  await expect(page.locator('#prompt')).toBeHidden();
  await expect(page.getByRole('button', { name: 'Get in' })).toBeHidden();
  await expect(world).toHaveAttribute('data-on-foot', 'true');
  // Back up to the car.
  await page.keyboard.down('KeyS');
  await expect.poll(metres(page, 'data-car'), { timeout: 60_000 }).toBeLessThan(1.2);
  await page.keyboard.up('KeyS');
  if (isMobile) await expect(page.getByRole('button', { name: 'Get in' })).toBeVisible();
  else await expect(page.locator('#prompt')).toHaveText(/^\s*F\s*Get in\s*$/);
  await page.keyboard.press('KeyF');
  await expect(world).toHaveAttribute('data-on-foot', 'false');
  await expect(world).toHaveAttribute('data-door', '');
  await expect(page.locator('#mph')).toBeVisible();
  await expect(page.locator('#foot-how')).toBeHidden();
  await page.keyboard.down('KeyW');
  await expect.poll(mph(page), { timeout: 30_000 }).toBeGreaterThan(3);
  await page.keyboard.up('KeyW');
});

test('F does nothing while the car is moving', async ({ page }) => {
  await clockIn(page, ON_AUBURN);
  const world = page.locator('#world');
  await page.keyboard.down('KeyW');
  await expect.poll(mph(page), { timeout: 30_000 }).toBeGreaterThan(8);
  await expect(page.locator('#prompt')).toBeHidden();
  await expect(page.locator('#t-door')).toBeHidden();
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(400);
  await expect(world).toHaveAttribute('data-on-foot', 'false');
  expect(await mph(page)()).toBeGreaterThan(8);
  await page.keyboard.up('KeyW');
});

test('on foot in the delivery parking, your ticket stays yours and its clock waits for the car', async ({
  page,
}) => {
  test.setTimeout(120_000);
  await clockIn(page, '?traffic=0');
  const world = page.locator('#world');
  const clock = page.locator('#ticket-clock');
  await expect(clock).toHaveText(/^Quoted \d+ min$/);
  const ticket = (await world.getAttribute('data-ticket')) ?? '';
  expect(ticket).not.toBe('');
  await page.keyboard.press('KeyF');
  await expect(world).toHaveAttribute('data-on-foot', 'true');
  await page.keyboard.down('KeyS');
  await expect.poll(metres(page, 'data-car'), { timeout: 60_000 }).toBeGreaterThan(4);
  await page.keyboard.up('KeyS');
  await expect(world).toHaveAttribute('data-ticket', ticket);
  await expect(clock).toHaveText(/^Quoted \d+ min$/);
  // R puts you back in the car, in the stall.
  await page.keyboard.press('KeyR');
  await expect(world).toHaveAttribute('data-on-foot', 'false');
});

test('on a phone, a button over the gas gets you out and in, and the pedals walk and run', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'the button and the pedals only show on touch screens');
  test.setTimeout(120_000);
  await clockIn(page, AT_MAYAPPLE);
  const world = page.locator('#world');
  await expect(page.getByRole('button', { name: 'Gas' })).toBeVisible();
  await page.getByRole('button', { name: 'Get out' }).click();
  await expect(world).toHaveAttribute('data-on-foot', 'true');
  await expect(page.getByRole('button', { name: 'Gas' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Walk' })).toHaveText('Walk');
  await page.getByRole('button', { name: 'Get in' }).click();
  await expect(world).toHaveAttribute('data-on-foot', 'false');
  await expect(page.getByRole('button', { name: /^Brake/ })).toHaveText('Brake');

  await page.getByRole('button', { name: 'Get out' }).click();
  const run = page.getByRole('button', { name: 'Run' });
  await run.dispatchEvent('pointerdown');
  await expect(page.locator('#foot-how')).toHaveText('Running');
  await expect.poll(metres(page, 'data-car'), { timeout: 60_000 }).toBeGreaterThan(3);
  await run.dispatchEvent('pointerup');
  await expect(page.locator('#foot-how')).toHaveText('On foot');
  await expect(page.getByRole('button', { name: 'Get in' })).toBeHidden();
  const results = await new AxeBuilder({ page }).analyze();
  expect(results.violations).toEqual([]);
});

test('driving on a phone, the screen thins to the street, the order in one line, the map and the speed; at a stop it is all back', async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, 'a desktop has the room');
  test.setTimeout(120_000);
  await clockIn(page, `${TO_MAYAPPLE}&at=-89,-23&heading=77`);
  const note = page.locator('#ticket-note');
  const badge = page.getByRole('heading', { level: 1 });
  await expect(page.locator('html')).toHaveAttribute('data-moving', 'false');
  await expect(note).toBeVisible();
  await expect(badge).toBeVisible();
  await expect(page.getByRole('button', { name: /^GPS/ })).toBeVisible();

  await page.keyboard.down('KeyW');
  await expect.poll(mph(page), { timeout: 30_000 }).toBeGreaterThan(10);
  await expect(page.locator('html')).toHaveAttribute('data-moving', 'true');
  for (const gone of [note, badge, page.locator('#ticket-order'), page.locator('#place-box')])
    await expect(gone).toBeHidden();
  await expect(page.getByRole('button', { name: /^GPS/ })).toBeHidden();
  // What's left: where you are, where you're going and how long you have, the map, the speed.
  await expect(page.locator('#street')).toBeVisible();
  await expect(page.locator('#ticket-to')).toHaveText('40775 Mayapple Drive');
  await expect(page.locator('#ticket-clock')).toHaveText(/^\d+:\d\d left$/);
  await expect(page.locator('#minimap')).toBeVisible();
  await expect(page.locator('#mph')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Menu' })).toBeVisible();
  // The strip ends well above the middle of the screen.
  const strip = await page.getByRole('region', { name: 'Map' }).boundingBox();
  expect(strip!.y + strip!.height).toBeLessThan(page.viewportSize()!.height * 0.32);
  await page.keyboard.up('KeyW');

  await page.keyboard.down('KeyS');
  await expect(page.locator('html')).toHaveAttribute('data-moving', 'false', { timeout: 30_000 });
  await page.keyboard.up('KeyS');
  await expect(note).toBeVisible();
});
