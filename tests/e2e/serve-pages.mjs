// Serve the GitHub Pages build (dist-pages/, from `npm run build:pages`) the way GitHub does:
// plain files under the repository's name, a folder answering with its index.html, and a
// redirect to add a folder's trailing slash. Used by playwright.config.ts.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../dist-pages', import.meta.url));
const BASE = '/Personal-Dashboard';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.woff2': 'font/woff2',
};

const isDirectory = (file) =>
  stat(file).then(
    (found) => found.isDirectory(),
    () => false,
  );

createServer(async (request, response) => {
  const { pathname } = new URL(request.url ?? '/', 'http://localhost');
  const inside = pathname.startsWith(`${BASE}/`) ? normalize(pathname.slice(BASE.length)) : null;
  try {
    if (inside === null || inside.includes('..')) throw new Error('outside the site');
    let file = join(ROOT, inside);
    if (await isDirectory(file)) {
      if (!pathname.endsWith('/')) {
        response.writeHead(301, { location: `${pathname}/` }).end();
        return;
      }
      file = join(file, 'index.html');
    }
    const body = await readFile(file);
    response.writeHead(200, { 'content-type': TYPES[extname(file)] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' }).end('Not found');
  }
}).listen(Number(process.env.PORT), process.env.HOST);
