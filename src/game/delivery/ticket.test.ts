import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { decodeZone, type ZoneFile } from '../../lib/zone/format.ts';
import { PACE, doorSpot, quote, route, spotNear } from './route.ts';
import {
  HAND_OVER,
  HAND_OVERS,
  MENU,
  NEAREST,
  NOTES,
  clockText,
  drawTicket,
  money,
  orderText,
  writeOrder,
  writeTicket,
} from './ticket.ts';
import { dice } from './traffic.ts';

const real = decodeZone(
  JSON.parse(
    readFileSync(new URL('../../../public/zone/auburn-dequindre.json', import.meta.url), 'utf8'),
  ) as ZoneFile,
);
const shop = real.places.find((p) => p.kind === 'pizzeria')!;
const store = spotNear(real, shop.x + 20, shop.y, 90)!;

test('a quote is the drive with slack, the walk both ways and the door, up to a whole minute', () => {
  // Six minutes of driving and a 14 m walk: 414 + 20 + 30 seconds, quoted as 8 minutes.
  assert.equal(quote(360, 14), 480);
  // Never less than the drive itself, and always whole minutes.
  for (const [drive, walk] of [
    [0, 0],
    [95, 8],
    [321, 16],
    [496, 136],
  ] as const) {
    const q = quote(drive, walk);
    assert.equal(q % 60, 0);
    assert.ok(q >= drive * PACE.slack + PACE.atDoor);
    assert.ok(q < drive * PACE.slack + (2 * walk) / PACE.walk + PACE.atDoor + 60);
  }
  // A long walk from a lot is quoted its own time.
  assert.ok(quote(300, 136) >= quote(300, 10) + 120);
  // A time that's already whole minutes isn't pushed up to the next.
  assert.equal(quote((120 - PACE.atDoor) / PACE.slack, 0), 120);
});

test('an order is one to three pizzas, sometimes a side and a drink, and adds up', () => {
  const random = dice(7);
  const sizes = new Set<number>();
  const names = new Set<string>();
  const all = [...MENU.pizzas, ...MENU.sides, ...MENU.drinks];
  for (let i = 0; i < 400; i++) {
    const lines = writeOrder(random);
    const pizzas = lines
      .filter((l) => MENU.pizzas.some((p) => p.name === l.name))
      .reduce((n, l) => n + l.count, 0);
    assert.ok(pizzas >= 1 && pizzas <= 3);
    sizes.add(pizzas);
    for (const line of lines) {
      const dish = all.find((d) => d.name === line.name);
      assert.ok(dish, line.name);
      assert.equal(line.price, dish.price * line.count);
      names.add(line.name);
    }
    // No dish is listed twice: two of the same are one line.
    assert.equal(new Set(lines.map((l) => l.name)).size, lines.length);
  }
  assert.deepEqual([...sizes].sort(), [1, 2, 3]);
  assert.equal(names.size, all.length);
});

test('an order and its total read as a ticket does', () => {
  assert.equal(
    orderText([
      { count: 2, name: 'large pepperoni', price: 2798 },
      { count: 1, name: 'breadsticks', price: 599 },
    ]),
    '2 × large pepperoni, breadsticks',
  );
  assert.equal(money(3397), '$33.97');
  assert.equal(money(1205), '$12.05');
});

test('every hand-over has plain words and a few notes of its own', () => {
  for (const how of HAND_OVERS) {
    assert.ok(HAND_OVER[how].length > 3);
    assert.ok(NOTES[how].length >= 3);
    assert.equal(new Set(NOTES[how]).size, NOTES[how].length);
  }
});

test('the ticket for a house on Mayapple Drive: the same seed writes the same ticket', () => {
  const ticket = writeTicket(real, 5000, store, 5000);
  assert.ok(ticket);
  assert.equal(ticket.address, '40775 Mayapple Drive');
  assert.deepEqual(ticket.spot, doorSpot(real, real.buildings[5000]!));
  assert.equal(ticket.drive, route(real, store, ticket.spot)!.seconds);
  assert.equal(ticket.quote, quote(ticket.drive, ticket.walk));
  // About six and a half minutes at the limit, quoted nine.
  assert.equal(ticket.quote, 540);
  assert.equal(
    ticket.total,
    ticket.lines.reduce((sum, l) => sum + l.price, 0),
  );
  assert.ok(NOTES[ticket.handOver].includes(ticket.note));
  assert.deepEqual(writeTicket(real, 5000, store, 5000), ticket);
  assert.notDeepEqual(writeTicket(real, 5000, store, 5001)!.lines, ticket.lines);
});

test('no ticket goes to a door with no number or nowhere to pull up', () => {
  const bare = real.buildings.findIndex((b) => b.number === 0);
  const stranded = real.buildings.findIndex((b) => b.number > 0 && !doorSpot(real, b));
  assert.ok(bare >= 0 && stranded >= 0);
  assert.equal(writeTicket(real, bare, store, 1), null);
  assert.equal(writeTicket(real, stranded, store, 1), null);
  assert.equal(writeTicket(real, -1, store, 1), null);
  assert.equal(writeTicket(real, real.buildings.length, store, 1), null);
});

test('tickets drawn at random can all be driven, are a drive away, and only homes get a porch', () => {
  const random = dice(2026);
  const hows = new Set<string>();
  for (let i = 0; i < 60; i++) {
    const ticket = drawTicket(real, store, random);
    assert.ok(ticket);
    const b = real.buildings[ticket.building]!;
    assert.ok(Math.hypot(b.pts[0]! - store.x, b.pts[1]! - store.y) >= NEAREST);
    assert.ok(route(real, store, ticket.spot) && route(real, ticket.spot, store));
    // The furthest door is under ten minutes at the limit, so no quote is past fifteen.
    assert.ok(ticket.quote >= 120 && ticket.quote <= 900, `${ticket.quote} s`);
    assert.ok(ticket.quote > ticket.drive);
    if (ticket.handOver === 'leave')
      assert.ok(['house', 'townhouse', 'mobile'].includes(b.kind), b.kind);
    hows.add(ticket.handOver);
  }
  assert.equal(hows.size, HAND_OVERS.length);
});

test("the clock is the quote until you leave, then what's left, then how late", () => {
  assert.equal(clockText(540, null), 'Quoted 9 min');
  assert.equal(clockText(540, 0), '9:00 left');
  assert.equal(clockText(540, 139.2), '6:41 left');
  assert.equal(clockText(540, 540), '0:00 left');
  assert.equal(clockText(540, 560.5), 'Late 0:20');
  assert.equal(clockText(540, 1205), 'Late 11:05');
});
