/** Pure helpers for LED bar meters. */

export type Severity = 'normal' | 'high' | 'critical';

export interface Metric {
  label: string;
  value: number;
  max: number;
  /** Human-readable value, e.g. "52 °C" or "1.6 of 4 cores". */
  display: string;
  /** Value at which the meter turns orange. */
  high: number;
  /** Value at which the meter turns red. */
  critical: number;
}

export const severityLabel: Record<Severity, string> = {
  normal: 'Normal',
  high: 'High',
  critical: 'Critical',
};

export function severity(metric: Pick<Metric, 'value' | 'high' | 'critical'>): Severity {
  if (metric.value >= metric.critical) return 'critical';
  if (metric.value >= metric.high) return 'high';
  return 'normal';
}

/** How many of `segments` LEDs are lit. Any value above zero lights at least one. */
export function litSegments(value: number, max: number, segments = 10): number {
  if (!(max > 0) || !(value > 0)) return 0;
  return Math.min(segments, Math.max(1, Math.round((value / max) * segments)));
}
