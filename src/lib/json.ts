/**
 * Safe readers for JSON from outside APIs. Each returns undefined (or an empty list) instead of
 * throwing, so a parser can treat every field as optional and decide for itself what's essential.
 */

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Walk into nested objects and arrays: `field(json, 'properties', 'periods', 0)`. */
export function field(value: unknown, ...path: Array<string | number>): unknown {
  let current = value;
  for (const key of path) {
    if (typeof key === 'number') {
      if (!Array.isArray(current)) return undefined;
      current = current[key];
    } else {
      if (!isRecord(current)) return undefined;
      current = current[key];
    }
  }
  return current;
}

/** A non-empty, trimmed string. */
export function str(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}

/** A finite number, also from a numeric string such as ESPN's "24". */
export function num(value: unknown): number | undefined {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

export function list(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

/** A valid date from an ISO 8601 or RFC 822 string, or from epoch milliseconds. */
export function date(value: unknown): Date | undefined {
  const parsed =
    typeof value === 'number' ? new Date(value) : str(value) ? new Date(str(value)!) : undefined;
  return parsed && !Number.isNaN(parsed.getTime()) ? parsed : undefined;
}
