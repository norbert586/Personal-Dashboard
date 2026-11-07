/** Pure helpers for the code-activity module. */

export interface ActivityDay {
  /** YYYY-MM-DD */
  date: string;
  count: number;
}

export interface ActivityStats {
  total: number;
  activeDays: number;
  longestStreak: number;
  busiest: ActivityDay | undefined;
}

export function summarize(days: readonly ActivityDay[]): ActivityStats {
  let total = 0;
  let activeDays = 0;
  let streak = 0;
  let longestStreak = 0;
  let busiest: ActivityDay | undefined;

  for (const day of days) {
    total += day.count;
    if (day.count > 0) {
      activeDays += 1;
      streak += 1;
      longestStreak = Math.max(longestStreak, streak);
      if (!busiest || day.count > busiest.count) busiest = day;
    } else {
      streak = 0;
    }
  }

  return { total, activeDays, longestStreak, busiest };
}

/**
 * Map counts to five levels (0 = none, 1–4 = quartiles of the non-zero counts), so the
 * ramp adapts to however busy the period was.
 */
export function quantize(counts: readonly number[]): number[] {
  const nonZero = counts.filter((count) => count > 0).sort((a, b) => a - b);
  if (nonZero.length === 0) return counts.map(() => 0);
  const at = (p: number) => nonZero[Math.min(nonZero.length - 1, Math.floor(p * nonZero.length))]!;
  const [q1, q2, q3] = [at(0.25), at(0.5), at(0.75)];
  return counts.map((count) => {
    if (count <= 0) return 0;
    if (count <= q1) return 1;
    if (count <= q2) return 2;
    if (count <= q3) return 3;
    return 4;
  });
}

/** Percent change from previous to current, or null when there's no baseline. */
export function percentChange(current: number, previous: number): number | null {
  if (previous <= 0) return null;
  const change = ((current - previous) / previous) * 100;
  // Round half away from zero (Math.round alone would turn -37.5 into -37).
  return Math.sign(change) * Math.round(Math.abs(change));
}
