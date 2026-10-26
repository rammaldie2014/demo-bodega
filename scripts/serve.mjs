import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, extname, sep } from 'node:path';
const root = resolve('dist/bodega/browser');
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.webmanifest': 'application/manifest+json',
  '.png': 'image/png',
};
createServer(async (req, res) => {
  try {
    let path = resolve(
      root,
      '.' + decodeURIComponent(new URL(req.url, 'http://localhost').pathname),
    );
    if (path !== root && !path.startsWith(root + sep)) {
      res.writeHead(403).end();
      return;
    }
    if (!extname(path)) path = resolve(root, 'index.html');
    const body = await readFile(path);
    res
      .writeHead(200, {
        'Content-Type': types[extname(path)] || 'application/octet-stream',
        'Cache-Control': 'no-cache',
      })
      .end(body);
  } catch {
    res.writeHead(404).end('No encontrado');
  }
}).listen(4173, '127.0.0.1', () => console.log('Mi Bodega: http://127.0.0.1:4173'));
