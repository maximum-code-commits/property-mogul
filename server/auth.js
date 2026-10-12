// Sign in with Google (OAuth code + PKCE) or Apple (form_post id_token), then a
// cookie session. We only keep the provider's opaque user id and a display name:
// no emails, no provider tokens.
import crypto from 'node:crypto';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import { config } from './config.js';
import { db } from './db.js';

const GOOGLE_JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));
const APPLE_JWKS = createRemoteJWKSet(new URL('https://appleid.apple.com/auth/keys'));
const SESSION_DAYS = 60;
const SID = 'pm_sid', OA = 'pm_oa';

const b64u = (buf) => Buffer.from(buf).toString('base64url');
const rand = (n = 32) => b64u(crypto.randomBytes(n));
const sha = (s) => crypto.createHash('sha256').update(s).digest();
const hmac = (s) => crypto.createHmac('sha256', config.SESSION_SECRET).update(s).digest('base64url');

export function parseCookies(req) {
  const out = {};
  for (const part of (req.headers.cookie || '').split(';')) {
    const i = part.indexOf('=');
    if (i > 0) out[part.slice(0, i).trim()] = decodeURIComponent(part.slice(i + 1).trim());
  }
  return out;
}
function cookie(name, value, { maxAge, sameSite = 'Lax', path = '/' } = {}) {
  let c = `${name}=${encodeURIComponent(value)}; Path=${path}; HttpOnly; SameSite=${sameSite}`;
  if (config.SECURE || sameSite === 'None') c += '; Secure';
  if (maxAge != null) c += `; Max-Age=${maxAge}`;
  return c;
}
function addCookie(res, c) {
  const prev = res.getHeader('Set-Cookie');
  res.setHeader('Set-Cookie', prev ? [].concat(prev, c) : c);
}

// short-lived signed cookie carrying state/nonce/verifier across the redirect
function setFlow(res, data, sameSite) {
  const body = b64u(JSON.stringify({ ...data, exp: Date.now() + 10 * 60 * 1000 }));
  addCookie(res, cookie(OA, `${body}.${hmac(body)}`, { maxAge: 600, sameSite }));
}
function takeFlow(req, res) {
  const raw = parseCookies(req)[OA];
  addCookie(res, cookie(OA, '', { maxAge: 0, sameSite: 'None' }));
  addCookie(res, cookie(OA, '', { maxAge: 0 }));
  if (!raw) return null;
  const [body, sig] = raw.split('.');
  if (!body || !sig) return null;
  const want = hmac(body);
  if (sig.length !== want.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want))) return null;
  try {
    const d = JSON.parse(Buffer.from(body, 'base64url').toString());
    return d.exp > Date.now() ? d : null;
  } catch (e) { return null; }
}

// ── sessions ──
export async function userFromReq(req) {
  const sid = parseCookies(req)[SID];
  if (!sid || sid.length > 100) return null;
  const row = await db.one(
    `select u.* from sessions s join users u on u.id = s.user_id where s.hash = $1 and s.expires_at > now()`,
    [b64u(sha(sid))],
  );
  return row;
}
async function startSession(res, userId) {
  const sid = rand(32);
  await db.q(`insert into sessions (hash, user_id, expires_at) values ($1, $2, now() + interval '${SESSION_DAYS} days')`, [b64u(sha(sid)), userId]);
  addCookie(res, cookie(SID, sid, { maxAge: SESSION_DAYS * 86400 }));
  // tidy up expired rows now and then
  if (Math.random() < 0.05) db.q('delete from sessions where expires_at < now()').catch(() => {});
}
export async function endSession(req, res) {
  const sid = parseCookies(req)[SID];
  if (sid) await db.q('delete from sessions where hash = $1', [b64u(sha(sid))]);
  addCookie(res, cookie(SID, '', { maxAge: 0 }));
}

export function slug(name) {
  return (String(name || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'mogul');
}
export function cleanName(n) {
  return String(n || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 20) || 'Mogul';
}
async function upsertUser(provider, sub, name) {
  const found = await db.one('select * from users where provider = $1 and sub = $2', [provider, sub]);
  if (found) { await db.q('update users set seen_at = now() where id = $1', [found.id]); return found; }
  const base = slug(name);
  for (let i = 0; i < 12; i++) {
    const handle = i === 0 ? base : `${base}${Math.floor(Math.random() * (i < 4 ? 100 : 100000))}`;
    const row = await db.one(
      `insert into users (provider, sub, name, handle) values ($1, $2, $3, $4)
       on conflict (handle) do nothing returning *`,
      [provider, sub, cleanName(name), handle],
    );
    if (row) return row;
  }
  throw new Error('could not allocate a handle');
}

function redirect(res, to) { res.writeHead(302, { Location: to, 'Cache-Control': 'no-store' }); res.end(); }
function fail(res, why) {
  console.warn('[auth]', why);
  redirect(res, '/?signin=failed');
}

// ── Google ──
async function googleStart(req, res) {
  const state = rand(16), nonce = rand(16), verifier = rand(48);
  setFlow(res, { p: 'google', state, nonce, verifier });
  const u = new URL('https://accounts.google.com/o/oauth2/v2/auth');
  u.search = new URLSearchParams({
    client_id: config.GOOGLE_CLIENT_ID,
    redirect_uri: `${config.PUBLIC_URL}/auth/google/callback`,
    response_type: 'code',
    scope: 'openid profile',
    state, nonce,
    code_challenge: b64u(sha(verifier)),
    code_challenge_method: 'S256',
    prompt: 'select_account',
  }).toString();
  redirect(res, u.toString());
}
async function googleCallback(req, res, url) {
  const flow = takeFlow(req, res);
  const code = url.searchParams.get('code'), state = url.searchParams.get('state');
  if (!flow || flow.p !== 'google' || !code || state !== flow.state) return fail(res, 'google: bad state');
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code, client_id: config.GOOGLE_CLIENT_ID, client_secret: config.GOOGLE_CLIENT_SECRET,
      redirect_uri: `${config.PUBLIC_URL}/auth/google/callback`, grant_type: 'authorization_code', code_verifier: flow.verifier,
    }),
  });
  const tok = await r.json().catch(() => ({}));
  if (!r.ok || !tok.id_token) return fail(res, `google: token exchange ${r.status}`);
  const { payload } = await jwtVerify(tok.id_token, GOOGLE_JWKS, {
    issuer: ['https://accounts.google.com', 'accounts.google.com'], audience: config.GOOGLE_CLIENT_ID,
  });
  if (payload.nonce !== flow.nonce) return fail(res, 'google: nonce mismatch');
  const user = await upsertUser('google', String(payload.sub), payload.given_name || payload.name || 'Mogul');
  await startSession(res, user.id);
  redirect(res, '/?signin=ok');
}

// ── Apple ──
async function appleStart(req, res) {
  const state = rand(16), nonce = rand(16);
  // Apple posts the result back cross-site, so this cookie must be SameSite=None.
  setFlow(res, { p: 'apple', state, nonce }, 'None');
  const u = new URL('https://appleid.apple.com/auth/authorize');
  u.search = new URLSearchParams({
    client_id: config.APPLE_CLIENT_ID,
    redirect_uri: `${config.PUBLIC_URL}/auth/apple/callback`,
    response_type: 'code id_token',
    response_mode: 'form_post',
    scope: 'name',
    state, nonce,
  }).toString();
  redirect(res, u.toString());
}
async function appleCallback(req, res, form) {
  const flow = takeFlow(req, res);
  if (!flow || flow.p !== 'apple' || form.get('state') !== flow.state) return fail(res, 'apple: bad state');
  const idt = form.get('id_token');
  if (!idt) return fail(res, 'apple: no id_token');
  const { payload } = await jwtVerify(idt, APPLE_JWKS, { issuer: 'https://appleid.apple.com', audience: config.APPLE_CLIENT_ID });
  if (payload.nonce !== flow.nonce) return fail(res, 'apple: nonce mismatch');
  let name = 'Mogul';
  try { const u = JSON.parse(form.get('user') || '{}'); name = u.name?.firstName || name; } catch (e) { /* only sent on first sign-in */ }
  const user = await upsertUser('apple', String(payload.sub), name);
  await startSession(res, user.id);
  redirect(res, '/?signin=ok');
}

// ── local dev ──
async function devLogin(req, res, url) {
  const name = cleanName(url.searchParams.get('name') || 'Tester');
  const user = await upsertUser('dev', slug(name), name);
  await startSession(res, user.id);
  redirect(res, '/?signin=ok');
}

export const providers = () => ({
  google: !!(config.GOOGLE_CLIENT_ID && config.GOOGLE_CLIENT_SECRET),
  apple: !!config.APPLE_CLIENT_ID,
  dev: config.DEV_LOGIN,
});

// returns true when the request was an auth route
export async function handleAuth(req, res, url, readForm) {
  const p = url.pathname, pv = providers();
  if (p === '/auth/google' && pv.google) { await googleStart(req, res); return true; }
  if (p === '/auth/google/callback' && pv.google) { await googleCallback(req, res, url); return true; }
  if (p === '/auth/apple' && pv.apple) { await appleStart(req, res); return true; }
  if (p === '/auth/apple/callback' && pv.apple && req.method === 'POST') { await appleCallback(req, res, await readForm()); return true; }
  if (p === '/auth/dev' && pv.dev) { await devLogin(req, res, url); return true; }
  return false;
}
