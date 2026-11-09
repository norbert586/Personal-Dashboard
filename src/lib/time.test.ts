import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  calendarDaysBetween,
  formatCalendarDate,
  formatDay,
  formatRelative,
  isoDate,
} from './time.ts';

// 23:30 on Sunday 8 November 2026 in Detroit (EST, UTC−5).
const NOW = new Date('2026-11-09T04:30:00Z');
const at = (iso: string) => new Date(iso);

describe('time, in the town’s zone', () => {
  it('dates instants by Detroit’s calendar, not UTC', () => {
    assert.equal(isoDate(NOW), '2026-11-08');
    assert.equal(calendarDaysBetween(NOW, at('2026-11-09T05:30:00Z')), 1); // 00:30 Monday
  });

  it('names days near now and dates the rest', () => {
    assert.equal(formatDay(at('2026-11-08T18:00:00Z'), NOW), 'Today');
    assert.equal(formatDay(at('2026-11-10T00:00:00Z'), NOW), 'Tomorrow'); // 19:00 Monday
    assert.equal(formatDay(at('2026-11-08T02:00:00Z'), NOW), 'Yesterday'); // 21:00 Saturday
    assert.equal(formatDay(at('2026-11-12T00:00:00Z'), NOW), 'Wed');
    assert.equal(formatDay(at('2027-02-19T17:00:00Z'), NOW), 'Feb 19');
  });

  it('writes calendar dates without shifting them a day', () => {
    assert.equal(formatCalendarDate('2026-10-23', NOW), 'Oct 23');
    assert.equal(formatCalendarDate('1993-10-29', NOW), 'Oct 29, 1993');
  });

  it('says how long ago, in words', () => {
    assert.equal(formatRelative(at('2026-11-09T04:29:30Z'), NOW), 'just now');
    assert.equal(formatRelative(at('2026-11-09T04:05:00Z'), NOW), '25 minutes ago');
    assert.equal(formatRelative(at('2026-11-09T01:28:43Z'), NOW), '3 hours ago');
    assert.equal(formatRelative(at('2026-11-07T15:00:00Z'), NOW), 'yesterday');
    assert.equal(formatRelative(at('2026-11-05T21:19:11Z'), NOW), '3 days ago');
  });
});
