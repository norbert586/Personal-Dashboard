/**
 * A ticket (SPEC: Delivery mode, a delivery; ADR-048): one order for one door. It has an address
 * the router can reach, what was ordered and what it came to, how the customer wants it handed
 * over, in their own words and in plain ones, and the time they were quoted. Pure: the same
 * building, start and seed write the same ticket.
 *
 * The menu and the notes are made up, with no brands and no real people.
 */
import type { Building, Zone } from '../../lib/zone/format.ts';
import { doorAt, doorSpot, quote, route, type Spot } from './route.ts';
import { dice } from './traffic.ts';

export const HAND_OVERS = ['leave', 'call', 'text', 'knock', 'ring'] as const;
export type HandOver = (typeof HAND_OVERS)[number];

/** The hand-over in plain words: what the ticket says under the customer's note. */
export const HAND_OVER: Record<HandOver, string> = {
  leave: 'Leave it on the porch',
  call: 'Call first',
  text: 'Text first',
  knock: 'Knock',
  ring: 'Ring the bell',
};

/** What customers write on an order. A first handful: step 8 grows them. */
export const NOTES: Record<HandOver, readonly string[]> = {
  leave: [
    'Just leave it on the porch, thanks.',
    'Leave it on the porch. The dog thinks you are the mailman.',
    'Porch is fine. I am in my pajamas.',
    'Set it on the chair by the door, please.',
  ],
  call: [
    'Call when you pull up and I will come out.',
    'Call me, the doorbell has been dead since March.',
    'Please call first. Do not wake the baby.',
    'Call when you are here. Grandma answers the door otherwise.',
  ],
  text: [
    'Text me when you are outside.',
    'Text, do not knock. The dog goes nuts.',
    'Text when you get here, I am on a work call.',
    'Text me. It is a surprise for my wife.',
  ],
  knock: [
    'Knock loud, the game is on.',
    'Bell is broken, please knock.',
    'Knock on the side door, we never use the front.',
    'Knock. The bell scares the cat.',
  ],
  ring: [
    'Ring the bell, we are in the basement.',
    'Ring the doorbell, I will not hear a knock.',
    'Ring twice so I know it is the pizza.',
    'Please ring. The kids like to race to the door.',
  ],
};

/** Homes have a porch to leave it on; a shop, a school or an apartment block doesn't. */
const HOMES: ReadonlySet<Building['kind']> = new Set(['house', 'townhouse', 'mobile']);

interface Dish {
  name: string;
  /** In cents. */
  price: number;
}

/** The menu. Every order has pizza; some add a side, some a drink. */
export const MENU = {
  pizzas: [
    { name: 'large pepperoni', price: 1399 },
    { name: 'large cheese', price: 1199 },
    { name: 'large sausage and mushroom', price: 1549 },
    { name: 'large ham and pineapple', price: 1549 },
    { name: 'medium veggie', price: 1249 },
    { name: 'deep dish pepperoni', price: 1699 },
    { name: 'large supreme', price: 1799 },
  ],
  sides: [
    { name: 'breadsticks', price: 599 },
    { name: 'cheese bread', price: 749 },
    { name: 'wings', price: 1099 },
    { name: 'antipasto salad', price: 899 },
    { name: 'cinnamon sticks', price: 649 },
  ],
  drinks: [
    { name: '2-litre cola', price: 349 },
    { name: '2-litre root beer', price: 349 },
    { name: '2-litre lemon-lime', price: 349 },
  ],
} as const satisfies Record<string, readonly Dish[]>;

/** Tickets go at least this far from where they're written, in metres: a drive, not a walk. */
export const NEAREST = 400;

export interface OrderLine {
  count: number;
  name: string;
  /** For the lot of them, in cents. */
  price: number;
}

export interface Ticket {
  /** The building it's for, as an index into the zone's buildings. */
  building: number;
  address: string;
  /** Where you pull up for the door, and how far the door is from there, in metres. */
  spot: Spot;
  walk: number;
  lines: OrderLine[];
  /** What the order came to, in cents. */
  total: number;
  handOver: HandOver;
  /** The customer's words for it. */
  note: string;
  /** The router's drive from where the ticket was written, and the time quoted, in seconds. */
  drive: number;
  quote: number;
}

const pick = <T>(from: readonly T[], random: () => number): T =>
  from[Math.floor(random() * from.length)]!;

/** An order: one to three pizzas, the second and third rarer, then maybe a side and a drink. */
export function writeOrder(random: () => number): OrderLine[] {
  const lines: OrderLine[] = [];
  const add = (dish: Dish) => {
    const line = lines.find((l) => l.name === dish.name);
    if (line) {
      line.price += dish.price;
      line.count++;
    } else lines.push({ count: 1, name: dish.name, price: dish.price });
  };
  const roll = random();
  const pizzas = roll < 0.55 ? 1 : roll < 0.88 ? 2 : 3;
  for (let i = 0; i < pizzas; i++) add(pick(MENU.pizzas, random));
  if (random() < 0.5) add(pick(MENU.sides, random));
  if (random() < 0.4) add(pick(MENU.drinks, random));
  return lines;
}

/** "2 large pepperoni, breadsticks, 2-litre cola". */
export function orderText(lines: readonly OrderLine[]): string {
  return lines.map((l) => (l.count > 1 ? `${l.count} × ${l.name}` : l.name)).join(', ');
}

/** Cents as "$31.47". */
export function money(cents: number): string {
  return `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

/**
 * The ticket for one building, written at `from`: null when it has no address, nowhere to pull
 * up, or no drive there and back (ADR-047: orders never go to those doors).
 */
export function writeTicket(zone: Zone, building: number, from: Spot, seed: number): Ticket | null {
  const b = zone.buildings[building];
  if (!b || b.number <= 0 || b.street < 0) return null;
  const spot = doorSpot(zone, b);
  if (!spot) return null;
  const out = route(zone, from, spot);
  if (!out || !route(zone, spot, from)) return null;
  const [dx, dy] = doorAt(zone, b);
  const walk = Math.hypot(dx - spot.x, dy - spot.y);
  const random = dice(seed);
  const lines = writeOrder(random);
  const ways = HOMES.has(b.kind) ? HAND_OVERS : HAND_OVERS.filter((h) => h !== 'leave');
  const handOver = pick(ways, random);
  return {
    building,
    address: `${b.number} ${zone.roads[b.street]!.name}`,
    spot,
    walk,
    lines,
    total: lines.reduce((sum, l) => sum + l.price, 0),
    handOver,
    note: pick(NOTES[handOver], random),
    drive: out.seconds,
    quote: quote(out.seconds, walk),
  };
}

/** A ticket for a door picked at random, at least `NEAREST` from `from`; null if none turns up. */
export function drawTicket(zone: Zone, from: Spot, random: () => number): Ticket | null {
  for (let tries = 0; tries < 400; tries++) {
    const i = Math.floor(random() * zone.buildings.length);
    const seed = Math.floor(random() * 0x100000000);
    const b = zone.buildings[i]!;
    if (Math.hypot(b.pts[0]! - from.x, b.pts[1]! - from.y) < NEAREST) continue;
    const ticket = writeTicket(zone, i, from, seed);
    if (ticket) return ticket;
  }
  return null;
}

const minutes = (seconds: number): string => {
  const whole = Math.floor(seconds);
  return `${Math.floor(whole / 60)}:${String(whole % 60).padStart(2, '0')}`;
};

/**
 * The ticket's clock in words. Before you've left the store it's the quote; after, what's left
 * of it, and then how late you are. `elapsed` is seconds since leaving, or null before.
 */
export function clockText(quoted: number, elapsed: number | null): string {
  if (elapsed === null) return `Quoted ${Math.round(quoted / 60)} min`;
  const left = quoted - elapsed;
  return left >= 0 ? `${minutes(Math.ceil(left))} left` : `Late ${minutes(-left)}`;
}
