// Database layer: Neon (or any Postgres) through `pg` when DATABASE_URL is set,
// otherwise an embedded PGlite database on disk for local development.
import { config } from './config.js';

const SCHEMA = `
create table if not exists users (
  id serial primary key,
  provider text not null,
  sub text not null,
  name text not null,
  handle text not null unique,
  agent text not null default 'sunny',
  repaid int not null default 0,
  created_at timestamptz not null default now(),
  seen_at timestamptz not null default now(),
  unique (provider, sub)
);
create table if not exists sessions (
  hash text primary key,
  user_id int not null references users(id) on delete cascade,
  expires_at timestamptz not null
);
create table if not exists saves (
  user_id int primary key references users(id) on delete cascade,
  t double precision not null,
  data text not null,
  updated_at timestamptz not null default now()
);
create table if not exists snapshots (
  user_id int primary key references users(id) on delete cascade,
  data jsonb not null,
  net double precision not null default 0,
  props int not null default 0,
  rep int not null default 0,
  level int not null default 0,
  gen int not null default 1,
  seed int,
  updated_at timestamptz not null default now()
);
create index if not exists snapshots_net on snapshots (net desc);
create table if not exists friends (
  a int not null references users(id) on delete cascade,
  b int not null references users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now(),
  primary key (a, b)
);
create index if not exists friends_b on friends (b);
create table if not exists watch (
  user_id int not null references users(id) on delete cascade,
  seed int not null,
  lot int not null,
  addr text not null default '',
  kind text not null default '',
  dist text not null default '',
  price double precision not null default 0,
  note text not null default '',
  created_at timestamptz not null default now(),
  primary key (user_id, seed, lot)
);
create table if not exists deals (
  id serial primary key,
  lead int not null references users(id) on delete cascade,
  seed int not null,
  lot int not null,
  addr text not null,
  kind text not null,
  dist text not null,
  price double precision not null,
  target double precision not null,
  min_put double precision not null default 0,
  pref double precision not null default 0,
  note text not null default '',
  status text not null default 'open',
  value double precision not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists deals_lead on deals (lead);
create table if not exists deal_shares (
  deal int not null references deals(id) on delete cascade,
  user_id int not null references users(id) on delete cascade,
  amount double precision not null,
  pct double precision not null default 0,
  paid_out double precision not null default 0,
  closed boolean not null default false,
  primary key (deal, user_id)
);
create index if not exists deal_shares_user on deal_shares (user_id);
create table if not exists loans (
  id serial primary key,
  kind text not null,
  lender int references users(id) on delete cascade,
  borrower int references users(id) on delete cascade,
  amount double precision not null,
  apy double precision not null,
  term int not null,
  type text not null default 'amort',
  vis text not null default 'friends',
  note text not null default '',
  status text not null default 'open',
  bal double precision not null default 0,
  left_n int not null default 0,
  paid double precision not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz
);
create index if not exists loans_status on loans (status);
create table if not exists ledger (
  id serial primary key,
  user_id int not null references users(id) on delete cascade,
  amount double precision not null,
  kind text not null,
  memo text not null default '',
  meta jsonb,
  created_at timestamptz not null default now(),
  claimed_at timestamptz
);
create index if not exists ledger_open on ledger (user_id) where claimed_at is null;
create table if not exists ops (
  user_id int not null references users(id) on delete cascade,
  op text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, op)
);
`;

let impl = null;

async function openPg() {
  const { default: pg } = await import('pg');
  const pool = new pg.Pool({
    connectionString: config.DATABASE_URL,
    max: 8,
    idleTimeoutMillis: 20000,
    ssl: /sslmode=disable/.test(config.DATABASE_URL) || /localhost|127\.0\.0\.1/.test(config.DATABASE_URL) ? false : { rejectUnauthorized: true },
  });
  pool.on('error', (e) => console.error('[db] idle client error', e.message));
  return {
    kind: 'postgres',
    async q(text, params) { return (await pool.query(text, params)).rows; },
    async tx(fn) {
      const c = await pool.connect();
      try {
        await c.query('begin');
        const out = await fn({ q: async (t, p) => (await c.query(t, p)).rows });
        await c.query('commit');
        return out;
      } catch (e) {
        await c.query('rollback').catch(() => {});
        throw e;
      } finally { c.release(); }
    },
    async exec(sql) { await pool.query(sql); },
  };
}

async function openPglite() {
  let PGlite;
  try { ({ PGlite } = await import('@electric-sql/pglite')); } catch (e) {
    throw new Error('No DATABASE_URL set and @electric-sql/pglite is not installed. Set DATABASE_URL to your Neon connection string.');
  }
  const { mkdirSync } = await import('node:fs');
  mkdirSync(config.PGLITE_DIR, { recursive: true });
  const db = new PGlite(config.PGLITE_DIR);
  await db.waitReady;
  // PGlite runs one statement at a time; serialise transactions so they never interleave.
  let chain = Promise.resolve();
  const serial = (fn) => { const p = chain.then(fn, fn); chain = p.catch(() => {}); return p; };
  return {
    kind: 'pglite',
    q: (text, params) => serial(async () => (await db.query(text, params)).rows),
    tx: (fn) => serial(() => db.transaction(async (t) => fn({ q: async (tt, p) => (await t.query(tt, p)).rows }))),
    async exec(sql) { await db.exec(sql); },
  };
}

export async function openDb() {
  impl = config.DATABASE_URL ? await openPg() : await openPglite();
  await impl.exec(SCHEMA);
  console.log(`[db] ready (${impl.kind})`);
  return impl;
}

export const db = {
  q: (t, p) => impl.q(t, p),
  tx: (fn) => impl.tx(fn),
  one: async (t, p) => (await impl.q(t, p))[0] || null,
};
