// Tiny zero-dependency static server for Railway (or any Node host).
// Serves the bundled single-file game, gzipped and cached.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { gzipSync } from 'node:zlib';

const html = readFileSync(new URL('./dist/property-mogul.html', import.meta.url));
const gz = gzipSync(html, { level: 9 });
const port = process.env.PORT || 3000;

createServer((req, res) => {
  const path = (req.url || '/').split('?')[0];
  if (path === '/healthz') { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end('ok'); }
  if (path !== '/' && path !== '/index.html') { res.writeHead(302, { location: '/' }); return res.end(); }
  const headers = {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'public, max-age=300',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'strict-origin-when-cross-origin',
  };
  if (/\bgzip\b/.test(req.headers['accept-encoding'] || '')) {
    res.writeHead(200, { ...headers, 'content-encoding': 'gzip', vary: 'Accept-Encoding' });
    res.end(req.method === 'HEAD' ? undefined : gz);
  } else {
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : html);
  }
}).listen(port, () => console.log(`Property Mogul on :${port}`));
