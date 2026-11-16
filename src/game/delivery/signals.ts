/**
 * The signals' one timer (SPEC: Delivery mode, traffic control). A signal gives each of its two
 * crossing streets a turn: green, yellow, then a moment of red all round before the other goes.
 * The heads you see and the cars that obey them both read it from here, so they can't disagree.
 * Pure.
 */
export type Light = 'green' | 'yellow' | 'red';

/** One street's turn, in seconds. */
export const TURN = { green: 20, yellow: 3, clear: 1 } as const;
const HALF = TURN.green + TURN.yellow + TURN.clear;

/**
 * What a signal shows the street on `axis` (0 or 1: its two crossing streets) at `time` seconds.
 * Signals are out of step with one another by their number, so a road isn't all green at once.
 */
export function lightAt(axis: 0 | 1, signal: number, time: number): Light {
  const loop = HALF * 2;
  const t = (((time + (signal % 5) * 9) % loop) + loop) % loop;
  const mine = t - axis * HALF;
  if (mine < 0 || mine >= HALF) return 'red';
  if (mine < TURN.green) return 'green';
  return mine < TURN.green + TURN.yellow ? 'yellow' : 'red';
}
