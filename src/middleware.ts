import { defineMiddleware } from 'astro:middleware';
import { ACCESS_MODE } from 'astro:env/server';
import { decideAccess } from './lib/access.ts';

const DENIED_PAGE = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="robots" content="noindex, nofollow" />
    <title>Private</title>
  </head>
  <body>
    <h1>This console is private.</h1>
  </body>
</html>`;

/** The access gate (ADR-004). Runs before every server-rendered page. */
export const onRequest = defineMiddleware(async (context, next) => {
  // A page rendered at build time becomes a plain file, which no server-side gate can guard.
  // Only the GitHub Pages build has any, and that build is public on purpose (ADR-034).
  if (context.isPrerendered) return next();

  let clientAddress: string | undefined;
  try {
    clientAddress = context.clientAddress;
  } catch {
    clientAddress = undefined;
  }

  const decision = decideAccess({ mode: ACCESS_MODE, isDev: import.meta.env.DEV, clientAddress });

  if (!decision.allowed) {
    // The reason is for the owner's server log, not for visitors.
    console.warn(`[access] denied ${context.url.pathname}: ${decision.reason}`);
    return new Response(DENIED_PAGE, {
      status: 403,
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }

  const response = await next();
  // Personal data: never store in shared caches, never index, never leak the URL onward.
  response.headers.set('cache-control', 'private, no-store');
  response.headers.set('x-robots-tag', 'noindex, nofollow');
  response.headers.set('referrer-policy', 'no-referrer');
  return response;
});
