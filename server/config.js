// Environment-driven settings. Everything is optional: without OAuth keys the
// sign-in buttons hide themselves, and without DATABASE_URL a local embedded
// Postgres (PGlite) is used so the game runs on a laptop with zero setup.
import crypto from 'node:crypto';

const env = process.env;
const PORT = Number(env.PORT) || 8080;
// Only the origin matters (scheme + host). Anything after it, like a pasted callback path, is ignored.
const PUBLIC_URL = new URL(env.PUBLIC_URL || (env.RAILWAY_PUBLIC_DOMAIN ? `https://${env.RAILWAY_PUBLIC_DOMAIN}` : `http://localhost:${PORT}`)).origin;
const PROD = env.NODE_ENV === 'production' || !!env.RAILWAY_ENVIRONMENT;

let secret = env.SESSION_SECRET;
if (!secret) {
  if (PROD) console.warn('[config] SESSION_SECRET is not set; sessions will reset on every deploy.');
  secret = crypto.randomBytes(32).toString('hex');
}

export const config = {
  PORT,
  PUBLIC_URL,
  ORIGIN: new URL(PUBLIC_URL).origin,
  SECURE: PUBLIC_URL.startsWith('https://'),
  PROD,
  SESSION_SECRET: secret,
  DATABASE_URL: env.DATABASE_URL || '',
  PGLITE_DIR: env.PGLITE_DIR || '.data/pglite',
  GOOGLE_CLIENT_ID: env.GOOGLE_CLIENT_ID || '',
  GOOGLE_CLIENT_SECRET: env.GOOGLE_CLIENT_SECRET || '',
  APPLE_CLIENT_ID: env.APPLE_CLIENT_ID || '',
  // Dev sign-in (pick any name, no password). Never honoured in production.
  DEV_LOGIN: env.DEV_LOGIN === '1' && !PROD,
};
