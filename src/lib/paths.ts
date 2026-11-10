/**
 * Paths inside the site. The home server lives at the root; the GitHub Pages build lives under
 * the repository's name (ADR-034), so every internal link and request goes through here.
 */
// `import.meta.env` is Vite's; plain Node (the unit tests) doesn't have it.
const env = (import.meta as { env?: { BASE_URL?: string } }).env;

/** Join a base ("/" or "/Personal-Dashboard/") and a site path ("/today"). */
export function withBase(base: string, to: string): string {
  return `${base.replace(/\/+$/, '')}/${to.replace(/^\/+/, '')}`;
}

/** A site path as the browser must ask for it: path('/today'). */
export const path = (to: string): string => withBase(env?.BASE_URL ?? '/', to);
