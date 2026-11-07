import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { percentChange, quantize, summarize } from './activity.ts';
import { litSegments, severity } from './meter.ts';

const day = (date: string, count: number) => ({ date, count });

describe('summarize', () => {
  it('counts totals, active days, the longest streak and the busiest day', () => {
    const stats = summarize([
      day('2026-11-01', 2),
      day('2026-11-02', 0),
      day('2026-11-03', 1),
      day('2026-11-04', 7),
      day('2026-11-05', 3),
      day('2026-11-06', 0),
    ]);
    assert.equal(stats.total, 13);
    assert.equal(stats.activeDays, 4);
    assert.equal(stats.longestStreak, 3);
    assert.deepEqual(stats.busiest, day('2026-11-04', 7));
  });

  it('handles an empty period', () => {
    assert.deepEqual(summarize([]), {
      total: 0,
      activeDays: 0,
      longestStreak: 0,
      busiest: undefined,
    });
  });
});

describe('quantize', () => {
  it('keeps zero at level 0 and buckets the rest by quartile', () => {
    // Non-zero counts [1, 2, 3, 4, 8] have quartile cut points 2, 3 and 4.
    assert.deepEqual(quantize([0, 1, 2, 3, 4, 8, 0]), [0, 1, 1, 2, 3, 4, 0]);
  });

  it('never decreases as counts rise, and the busiest day reaches level 4', () => {
    const counts = [0, 5, 1, 9, 3, 3, 12, 0, 7, 2];
    const levels = quantize(counts);
    const byCount = counts
      .map((count, i) => [count, levels[i]!] as const)
      .sort((a, b) => a[0] - b[0]);
    for (let i = 1; i < byCount.length; i++) assert.ok(byCount[i]![1] >= byCount[i - 1]![1]);
    assert.equal(levels[counts.indexOf(12)], 4);
  });

  it('returns all zeros when nothing happened', () => {
    assert.deepEqual(quantize([0, 0, 0]), [0, 0, 0]);
  });
});

describe('percentChange', () => {
  it('rounds to whole percent', () => assert.equal(percentChange(118, 100), 18));
  it('is negative when activity dropped', () => assert.equal(percentChange(50, 80), -38));
  it('is null without a baseline', () => assert.equal(percentChange(5, 0), null));
});

describe('meter', () => {
  it('classifies severity at the thresholds', () => {
    assert.equal(severity({ value: 64, high: 65, critical: 75 }), 'normal');
    assert.equal(severity({ value: 65, high: 65, critical: 75 }), 'high');
    assert.equal(severity({ value: 80, high: 65, critical: 75 }), 'critical');
  });

  it('lights at least one segment for any positive value and never overflows', () => {
    assert.equal(litSegments(0, 100), 0);
    assert.equal(litSegments(1, 100), 1);
    assert.equal(litSegments(52, 85), 6);
    assert.equal(litSegments(140, 100), 10);
    assert.equal(litSegments(5, 0), 0);
  });
});
