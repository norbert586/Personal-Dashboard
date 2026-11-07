import type { Reading } from '../readings.ts';
import { wallClock } from '../time.ts';

export interface AgendaEvent {
  start: Date;
  end: Date;
  title: string;
}

// Sample day until the Google Calendar feed is connected (roadmap M2).
const SAMPLE_DAY: Array<[start: string, end: string, title: string]> = [
  ['09:00', '10:30', 'Deep work block'],
  ['12:00', '12:45', 'Lunch'],
  ['15:00', '16:30', 'Lab session'],
  ['18:30', '19:30', 'Gym'],
  ['21:30', '21:45', 'Plan tomorrow'],
];

export async function getAgenda(now: Date): Promise<Reading<AgendaEvent[]>> {
  return {
    source: 'Google Calendar',
    provenance: 'sample',
    fetchedAt: now,
    data: SAMPLE_DAY.map(([start, end, title]) => ({
      start: wallClock(now, start),
      end: wallClock(now, end),
      title,
    })),
    detail: "Add your calendar's secret iCal address to show real events.",
  };
}
