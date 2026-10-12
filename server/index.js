// Property Mogul server: serves the single-file game, the sign-in flows, the
// online-mode JSON API and public portfolio pages.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { openDb } from './db.js';
import { handleAuth, userFromReq } from './auth.js';
import { api, HttpError } from './api.js';
import { sharePage } from './share.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GAME = path.join(ROOT, 'dist', 'property-mogul.html');

let page = null;
function loadPage() {
  const html = fs.readFileSync(GAME);
  page = { html, gz: zlib.gzipSync(html, { level: 9 }), br: zlib.brotliCompressSync(html), etag: `"${Date.now().toString(36)}-${html.length}"` };
}
loadPage();
if (!config.PROD) fs.watchFile(GAME, { interval: 800 }, () => { try { loadPage(); console.log('[server] reloaded game build'); } catch (e) { /* mid-write */ } });

const SECURITY = {
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'X-Frame-Options': 'SAMEORIGIN',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  ...(config.SECURE ? { 'Strict-Transport-Security': 'max-age=31536000' } : {}),
};

// ── small fixed-window rate limiter per client IP ──
const hits = new Map();
function limited(ip, key, max) {
  const now = Date.now(), k = `${key}:${ip}`;
  let h = hits.get(k);
  if (!h || now > h.reset) { h = { n: 0, reset: now + 60000 }; hits.set(k, h); }
  return ++h.n > max;
}
setInterval(() => { const now = Date.now(); for (const [k, h] of hits) if (now > h.reset) hits.delete(k); }, 60000).unref();
const ipOf = (req) => (req.headers['x-forwarded-for'] || '').split(',')[0].trim() || req.socket.remoteAddress || '?';

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > limit) { reject(new HttpError(413, 'Request too large.')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { ...SECURITY, ...headers });
  res.end(body);
}
function json(req, res, status, obj) {
  const body = JSON.stringify(obj);
  const gz = body.length > 1400 && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
  send(res, status, gz ? zlib.gzipSync(body) : body, {
    'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...(gz ? { 'Content-Encoding': 'gzip', Vary: 'Accept-Encoding' } : {}),
  });
}
function serveGame(req, res) {
  if (req.headers['if-none-match'] === page.etag) return send(res, 304, '', { ETag: page.etag });
  const ae = req.headers['accept-encoding'] || '';
  const [body, enc] = /\bbr\b/.test(ae) ? [page.br, 'br'] : /\bgzip\b/.test(ae) ? [page.gz, 'gzip'] : [page.html, null];
  send(res, 200, req.method === 'HEAD' ? '' : body, {
    'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-cache', ETag: page.etag, Vary: 'Accept-Encoding',
    ...(enc ? { 'Content-Encoding': enc } : {}),
  });
}

// Cross-site request protection for state-changing calls: same origin only, plus
// a custom header that a plain HTML form or image tag can never send.
function sameOrigin(req) {
  const o = req.headers.origin;
  if (o) return o === config.ORIGIN || o === `http://${req.headers.host}` || o === `https://${req.headers.host}`;
  return req.headers['x-pm'] === '1';
}

async function handle(req, res) {
  const url = new URL(req.url, config.ORIGIN);
  const p = url.pathname, ip = ipOf(req);

  if (p === '/healthz') return send(res, 200, 'ok', { 'Content-Type': 'text/plain' });
  if ((p === '/' || p === '/index.html') && (req.method === 'GET' || req.method === 'HEAD')) return serveGame(req, res);
  if (p === '/favicon.ico') return send(res, 204, '');
  if (p === '/robots.txt') return send(res, 200, 'User-agent: *\nAllow: /\nDisallow: /api/\n', { 'Content-Type': 'text/plain' });

  if (p.startsWith('/auth/')) {
    if (limited(ip, 'auth', 30)) return send(res, 429, 'Too many sign-in attempts. Try again in a minute.');
    try {
      const handled = await handleAuth(req, res, url, async () => new URLSearchParams(await readBody(req, 16384)));
      if (!handled) send(res, 404, 'Sign-in method not configured.', { 'Content-Type': 'text/plain' });
    } catch (e) {
      console.warn('[auth] failed:', e.message);
      if (!res.headersSent) send(res, 302, '', { Location: '/?signin=failed' });
    }
    return;
  }

  const sh = p.match(/^\/p\/([A-Za-z0-9_]{1,24})\/?$/);
  if (sh && req.method === 'GET') {
    if (limited(ip, 'page', 120)) return send(res, 429, 'Slow down.');
    const html = await sharePage(sh[1].toLowerCase());
    if (!html) return send(res, 404, 'No such player.', { 'Content-Type': 'text/plain' });
    return send(res, 200, html, { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=60' });
  }

  if (p.startsWith('/api/')) {
    const write = req.method !== 'GET';
    if (limited(ip, write ? 'w' : 'r', write ? 150 : 300)) return json(req, res, 429, { error: 'Too many requests. Take a breath.' });
    if (write && (!sameOrigin(req) || req.headers['x-pm'] !== '1')) return json(req, res, 403, { error: 'Cross-site request blocked.' });
    try {
      const me = await userFromReq(req);
      const readJson = async () => {
        const raw = await readBody(req, p === '/api/save' ? 4e6 : 256e3);
        try { return raw ? JSON.parse(raw) : {}; } catch (e) { throw new HttpError(400, 'Bad JSON.'); }
      };
      const out = await api(req, url, me, readJson, res);
      if (out === undefined) return json(req, res, 404, { error: 'Not found.' });
      return json(req, res, 200, out);
    } catch (e) {
      if (e instanceof HttpError) return json(req, res, e.status, { error: e.message });
      console.error('[api]', req.method, p, e);
      return json(req, res, 500, { error: 'Something went wrong on our side.' });
    }
  }

  // single-page app: unknown paths fall back to the game
  if (req.method === 'GET' && !path.extname(p)) return serveGame(req, res);
  send(res, 404, 'Not found', { 'Content-Type': 'text/plain' });
}

await openDb();
http.createServer((req, res) => {
  handle(req, res).catch((e) => {
    console.error('[server]', e);
    if (!res.headersSent) send(res, 500, 'Server error', { 'Content-Type': 'text/plain' });
    else res.end();
  });
}).listen(config.PORT, () => {
  console.log(`[server] Property Mogul on ${config.PUBLIC_URL} (port ${config.PORT})`);
  const pv = [config.GOOGLE_CLIENT_ID && 'google', config.APPLE_CLIENT_ID && 'apple', config.DEV_LOGIN && 'dev'].filter(Boolean);
  console.log(`[server] sign-in: ${pv.length ? pv.join(', ') : 'none configured (offline play only)'}`);
});
