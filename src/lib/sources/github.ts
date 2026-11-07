import type { ActivityDay } from '../activity.ts';
import type { Reading } from '../readings.ts';
import { isoDate, weekdayIndex } from '../time.ts';

export interface CodeActivity {
  /** Oldest first: from the Monday 11 weeks before this week, through today. */
  days: ActivityDay[];
  /** Total for the 12 weeks before that, for the delta. */
  previousTotal: number;
}

const WEEKS = 12;
const DAY_MS = 86_400_000;

/** Small seeded PRNG so sample data is stable within a day (and in screenshots). */
function mulberry32(seed: number): () => number {
  let state = seed | 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function seedFrom(text: string): number {
  let hash = 2166136261;
  for (const char of text) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash;
}

function sampleCount(random: () => number, weekday: boolean, intensity: number): number {
  const activeChance = (weekday ? 0.74 : 0.42) * intensity;
  if (random() > activeChance) return 0;
  return 1 + Math.floor(random() ** 1.7 * (weekday ? 12 : 6));
}

// Sample data until a GitHub token is configured (roadmap M2).
export async function getCodeActivity(now: Date): Promise<Reading<CodeActivity>> {
  const random = mulberry32(seedFrom(isoDate(now)));
  const dayCount = (WEEKS - 1) * 7 + weekdayIndex(now) + 1;

  const days: ActivityDay[] = [];
  for (let i = dayCount - 1; i >= 0; i--) {
    const date = new Date(now.getTime() - i * DAY_MS);
    const recent = i < 21 ? 1.15 : 0.95;
    days.push({ date: isoDate(date), count: sampleCount(random, weekdayIndex(date) < 5, recent) });
  }

  let previousTotal = 0;
  for (let i = 0; i < WEEKS * 7; i++) previousTotal += sampleCount(random, i % 7 < 5, 0.85);

  return {
    source: 'GitHub',
    provenance: 'sample',
    fetchedAt: now,
    data: { days, previousTotal },
    detail: 'Add a read-only GitHub token to show your real activity.',
  };
}
