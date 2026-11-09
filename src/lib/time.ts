/**
 * Time helpers that respect the site's time zone (site.config.ts), whatever zone the server runs
 * in. Built on Intl, with no date library.
 */
import { site } from '../site.config.ts';

export interface ZonedParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  second: number;
}

const DAY_MS = 86_400_000;
const partsFormatters = new Map<string, Intl.DateTimeFormat>();

function partsFormatter(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hourCycle: 'h23',
    });
    partsFormatters.set(timeZone, formatter);
  }
  return formatter;
}

/** Wall-clock parts of an instant in a time zone. */
export function zonedParts(date: Date, timeZone: string = site.timeZone): ZonedParts {
  const map: Partial<Record<Intl.DateTimeFormatPartTypes, string>> = {};
  for (const part of partsFormatter(timeZone).formatToParts(date)) map[part.type] = part.value;
  return {
    year: Number(map.year),
    month: Number(map.month),
    day: Number(map.day),
    hour: Number(map.hour) % 24,
    minute: Number(map.minute),
    second: Number(map.second),
  };
}

/** Calendar date in the zone as YYYY-MM-DD. */
export function isoDate(date: Date, timeZone: string = site.timeZone): string {
  const p = zonedParts(date, timeZone);
  return `${p.year}-${String(p.month).padStart(2, '0')}-${String(p.day).padStart(2, '0')}`;
}

/** Whole calendar days from `earlier` to `later`, counted in the zone. */
export function calendarDaysBetween(earlier: Date, later: Date): number {
  const a = zonedParts(earlier);
  const b = zonedParts(later);
  return Math.round(
    (Date.UTC(b.year, b.month - 1, b.day) - Date.UTC(a.year, a.month - 1, a.day)) / DAY_MS,
  );
}

export function formatTime(date: Date): string {
  return new Intl.DateTimeFormat(site.locale, {
    timeZone: site.timeZone,
    hour: site.hourCycle === 'h23' ? '2-digit' : 'numeric',
    minute: '2-digit',
    hourCycle: site.hourCycle,
  }).format(date);
}

export function formatLongDate(date: Date): string {
  return new Intl.DateTimeFormat(site.locale, {
    timeZone: site.timeZone,
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
}

/** "Mon" (or "Monday"), in the zone. */
export function formatWeekday(date: Date, width: 'short' | 'long' = 'short'): string {
  return new Intl.DateTimeFormat(site.locale, { timeZone: site.timeZone, weekday: width }).format(
    date,
  );
}

/** "Nov 21" */
export function formatMonthDay(date: Date): string {
  return new Intl.DateTimeFormat(site.locale, {
    timeZone: site.timeZone,
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** "Today", "Tomorrow", "Yesterday", a weekday within the week either side, or "Nov 21". */
export function formatDay(date: Date, now: Date): string {
  const days = calendarDaysBetween(now, date);
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (Math.abs(days) < 7) return formatWeekday(date);
  return formatMonthDay(date);
}

/** "just now", "5 minutes ago", "2 hours ago", "yesterday", "3 days ago". */
export function formatRelative(then: Date, now: Date): string {
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const rtf = new Intl.RelativeTimeFormat(site.locale, { numeric: 'auto' });
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return rtf.format(-minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (hours < 24) return rtf.format(-hours, 'hour');
  return rtf.format(-calendarDaysBetween(then, now), 'day');
}
