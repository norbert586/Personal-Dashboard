import type { APIRoute } from 'astro';
import { getFeeds } from '../../lib/feeds.ts';

/** Every feed as JSON, for the town: the same readings the Today page shows, behind the same gate. */
export const GET: APIRoute = async () => {
  const generatedAt = new Date();
  return Response.json({ generatedAt, feeds: await getFeeds(generatedAt) });
};
