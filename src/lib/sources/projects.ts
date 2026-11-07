import { getCollection, type CollectionEntry } from 'astro:content';
import type { Reading } from '../readings.ts';

export type Project = CollectionEntry<'projects'>['data'] & { id: string };
export type ProjectStatus = Project['status'];

const STATUS_ORDER: Record<ProjectStatus, number> = {
  building: 0,
  live: 1,
  paused: 2,
  archived: 3,
};

export async function getProjects(now: Date): Promise<Reading<Project[]>> {
  const entries = await getCollection('projects');
  const data = entries
    .map((entry) => ({ id: entry.id, ...entry.data }))
    .sort(
      (a, b) =>
        STATUS_ORDER[a.status] - STATUS_ORDER[b.status] ||
        b.lastActivity.getTime() - a.lastActivity.getTime(),
    );
  return { source: 'Project files', provenance: 'local', fetchedAt: now, data };
}
