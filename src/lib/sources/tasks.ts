import type { Reading } from '../readings.ts';
import { wallClock } from '../time.ts';

export interface Task {
  title: string;
  due?: Date;
}

// Sample tasks: the console's own next steps (docs/ROADMAP.md, M1), until a tasks
// backend is chosen (ADR-006).
export async function getTasks(now: Date): Promise<Reading<Task[]>> {
  return {
    source: 'Tasks',
    provenance: 'sample',
    fetchedAt: now,
    data: [
      { title: 'Review the console spec', due: wallClock(now, '23:59') },
      { title: 'Choose hosting and the access gate', due: wallClock(now, '23:59', 3) },
      { title: 'Write a one-line summary for each project' },
      { title: 'Create a read-only GitHub token for code activity' },
    ],
    detail: 'Choose a tasks backend (ADR-006) to show real tasks.',
  };
}
