/**
 * Time helpers that respect the console's configured time zone (site.config.ts), whatever
 * zone the server runs in. Built on Intl, with no date library.
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

function zoneOffsetMs(date: Date, timeZone: string): number {
  const p = zonedParts(date, timeZone);
  const wallAsUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return wallAsUtc - Math.floor(date.getTime() / 1000) * 1000;
}

/** The instant the zone's wall clock reads `hh:mm`, on the reference's local day (+ dayOffset). */
export function wallClock(
  reference: Date,
  hhmm: string,
  dayOffset = 0,
  timeZone: string = site.timeZone,
): Date {
  const [hours = 0, minutes = 0] = hhmm.split(':').map(Number);
  const p = zonedParts(reference, timeZone);
  const guess = Date.UTC(p.year, p.month - 1, p.day + dayOffset, hours, minutes);
  return new Date(guess - zoneOffsetMs(new Date(guess), timeZone));
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

/** ISO-8601 week number of the zone's current date. */
export function isoWeek(date: Date): number {
  const p = zonedParts(date);
  const day = new Date(Date.UTC(p.year, p.month - 1, p.day));
  const weekday = day.getUTCDay() || 7;
  day.setUTCDate(day.getUTCDate() + 4 - weekday);
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1);
  return Math.ceil(((day.getTime() - yearStart) / DAY_MS + 1) / 7);
}

/** 0 = Monday … 6 = Sunday, in the zone. */
export function weekdayIndex(date: Date): number {
  const p = zonedParts(date);
  return (new Date(Date.UTC(p.year, p.month - 1, p.day)).getUTCDay() + 6) % 7;
}

export function greeting(date: Date): string {
  const { hour } = zonedParts(date);
  if (hour >= 5 && hour < 12) return 'Good morning';
  if (hour >= 12 && hour < 18) return 'Good afternoon';
  return 'Good evening';
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

export function formatShortDate(date: Date): string {
  return new Intl.DateTimeFormat(site.locale, {
    timeZone: site.timeZone,
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  }).format(date);
}

/** "today", "yesterday", "5 days ago", "3 weeks ago", "8 months ago", "2 years ago". */
export function formatAgo(then: Date, now: Date): string {
  const days = calendarDaysBetween(then, now);
  const rtf = new Intl.RelativeTimeFormat(site.locale, { numeric: 'auto' });
  if (days < 14) return rtf.format(-days, 'day');
  if (days < 60) return rtf.format(-Math.round(days / 7), 'week');
  if (days < 548) return rtf.format(-Math.round(days / 30.44), 'month');
  return rtf.format(-Math.round(days / 365.25), 'year');
}

/** "Today", "Tomorrow", a weekday within the next week, otherwise a short date. */
export function formatDue(due: Date, now: Date): string {
  const days = calendarDaysBetween(now, due);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 7) {
    return new Intl.DateTimeFormat(site.locale, {
      timeZone: site.timeZone,
      weekday: 'long',
    }).format(due);
  }
  return new Intl.DateTimeFormat(site.locale, {
    timeZone: site.timeZone,
    month: 'short',
    day: 'numeric',
  }).format(due);
}

/** "in 5 min", "in 2 h 10 min". */
export function formatCountdown(from: Date, to: Date): string {
  const minutes = Math.max(0, Math.round((to.getTime() - from.getTime()) / 60_000));
  if (minutes < 60) return `in ${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `in ${hours} h` : `in ${hours} h ${rest} min`;
}

/** "12 days, 4 hours" style uptime. */
export function formatUptime(seconds: number): string {
  const days = Math.floor(seconds / 86_400);
  const hours = Math.floor((seconds % 86_400) / 3_600);
  if (days > 0) return `${days} ${days === 1 ? 'day' : 'days'}, ${hours} h`;
  const minutes = Math.floor((seconds % 3_600) / 60);
  return `${hours} h ${minutes} min`;
}

export function zoneAbbreviation(date: Date): string {
  const part = new Intl.DateTimeFormat(site.locale, {
    timeZone: site.timeZone,
    timeZoneName: 'short',
  })
    .formatToParts(date)
    .find((p) => p.type === 'timeZoneName');
  return part?.value ?? site.timeZone;
}
