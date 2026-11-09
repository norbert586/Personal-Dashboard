/**
 * Coding activity from GitHub's public events (free, no token; 60 requests an hour, and this asks
 * six). The town needs two things from it: which repos got a push on which days (fireworks) and
 * which repos are new (the crane). Since October 2025 push events no longer carry commit counts,
 * so activity is counted in pushes.
 *
 * Cloud sandboxes can't reach GitHub's user endpoints, so the saved sample is built from GitHub's
 * documented event format and this repository's real commits rather than captured.
 */
import { date, field, str } from '../json.ts';
import type { Source } from '../readings.ts';
import { isoDate, zonedParts } from '../time.ts';
import { site } from '../../site.config.ts';

export interface RepoActivity {
  /** "norbert586/Personal-Dashboard" */
  repo: string;
  /** The project's title from src/content/projects, or the repo's own name. */
  name: string;
  url: string;
  /** Pushes in the window. */
  pushes: number;
  lastPush: Date;
  /** Days (YYYY-MM-DD, in the town's zone) with at least one push, newest first. */
  days: string[];
}

export interface NewRepo {
  repo: string;
  name: string;
  url: string;
  created: Date;
  description: string | undefined;
}

export interface Activity {
  /** Repos pushed to in the window, most recent first. */
  repos: RepoActivity[];
  /** Repos created in the last NEW_REPO_DAYS, newest first. */
  newRepos: NewRepo[];
  /** Pushes per day across the window, oldest first, ending today. */
  days: Array<{ date: string; pushes: number }>;
}

/** Days of pushes to keep, today included. */
export const WINDOW_DAYS = 14;
const NEW_REPO_DAYS = 30;
const DAY_MS = 86_400_000;

export function activity(
  user: string = site.github.user,
  titles: ReadonlyMap<string, string> = new Map(),
): Source<Activity> {
  return {
    name: 'GitHub',
    empty: { repos: [], newRepos: [], days: [] },
    async load({ fetcher, now }) {
      const events = await fetcher.json({
        name: 'GitHub',
        url: `https://api.github.com/users/${encodeURIComponent(user)}/events/public?per_page=100`,
        ttl: 10 * 60_000,
        sample: 'github-events.json',
        headers: { accept: 'application/vnd.github+json', 'x-github-api-version': '2022-11-28' },
      });
      if (!Array.isArray(events)) throw new Error("GitHub didn't send a list of events.");
      return parseEvents(events, now, titles);
    },
  };
}

/** "https://github.com/norbert586/Personal-Dashboard" → "norbert586/personal-dashboard". */
export function repoKey(url: string): string | undefined {
  const match = /github\.com\/([^/]+\/[^/#?]+)/i.exec(url);
  return match?.[1]?.replace(/\.git$/, '').toLowerCase();
}

/** The calendar days of the window, oldest first, ending with today in the town's zone. */
function windowDays(now: Date): string[] {
  const today = zonedParts(now);
  return Array.from({ length: WINDOW_DAYS }, (_, i) =>
    new Date(Date.UTC(today.year, today.month - 1, today.day - (WINDOW_DAYS - 1 - i)))
      .toISOString()
      .slice(0, 10),
  );
}

export function parseEvents(
  events: readonly unknown[],
  now: Date,
  titles: ReadonlyMap<string, string> = new Map(),
): Activity {
  const days = windowDays(now);
  const firstDay = days[0]!;
  const pushesByDay = new Map(days.map((day) => [day, 0]));
  const repos = new Map<string, RepoActivity>();
  const newRepos: NewRepo[] = [];
  const nameOf = (repo: string) => titles.get(repo.toLowerCase()) ?? repo.split('/')[1] ?? repo;
  const seen = new Set<string>();

  for (const event of events) {
    const id = str(field(event, 'id'));
    const type = str(field(event, 'type'));
    const at = date(field(event, 'created_at'));
    const repo = str(field(event, 'repo', 'name'));
    if (type === undefined || at === undefined || repo === undefined || at > now) continue;
    if (id !== undefined) {
      if (seen.has(id)) continue;
      seen.add(id);
    }
    const url = `https://github.com/${repo}`;

    if (type === 'PushEvent') {
      const day = isoDate(at);
      if (day < firstDay) continue;
      pushesByDay.set(day, (pushesByDay.get(day) ?? 0) + 1);
      const entry = repos.get(repo) ?? {
        repo,
        name: nameOf(repo),
        url,
        pushes: 0,
        lastPush: at,
        days: [],
      };
      entry.pushes += 1;
      if (at > entry.lastPush) entry.lastPush = at;
      if (!entry.days.includes(day)) entry.days.push(day);
      repos.set(repo, entry);
    } else if (
      type === 'CreateEvent' &&
      str(field(event, 'payload', 'ref_type')) === 'repository' &&
      now.getTime() - at.getTime() < NEW_REPO_DAYS * DAY_MS
    ) {
      newRepos.push({
        repo,
        name: nameOf(repo),
        url,
        created: at,
        description: str(field(event, 'payload', 'description')),
      });
    }
  }

  for (const entry of repos.values()) entry.days.sort().reverse();
  return {
    repos: [...repos.values()].sort((a, b) => b.lastPush.getTime() - a.lastPush.getTime()),
    newRepos: newRepos.sort((a, b) => b.created.getTime() - a.created.getTime()),
    days: days.map((day) => ({ date: day, pushes: pushesByDay.get(day) ?? 0 })),
  };
}

/** Titles of the projects in src/content/projects, keyed by repo, for naming activity. */
export function titlesByRepo(
  projects: ReadonlyArray<{ title: string; repo?: string | undefined }>,
): Map<string, string> {
  const titles = new Map<string, string>();
  for (const project of projects) {
    const key = project.repo ? repoKey(project.repo) : undefined;
    if (key) titles.set(key, project.title);
  }
  return titles;
}
