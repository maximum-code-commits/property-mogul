// JSON API for the online mode. Each player's city runs in their own browser on
// their own clock, so money that crosses between players goes through a ledger:
// the sender's game deducts it locally and reports it, the server books a ledger
// credit, and the receiver's game claims that credit on its next sync.
import { db } from './db.js';
import { cleanName, endSession, providers } from './auth.js';

export class HttpError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const bad = (m) => { throw new HttpError(400, m); };
const num = (v, min, max, what) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) bad(`${what} must be between ${min} and ${max}.`);
  return n;
};
const int = (v, min, max, what) => Math.round(num(v, min, max, what));
const str = (v, max) => String(v ?? '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max);
const money = (n) => Math.round(n * 100) / 100;
const HANDLE = /^[a-z0-9_]{3,20}$/;
const AGENTS = new Set(['sunny', 'margot', 'theo', 'rosa']);

const publicUser = (u) => u && ({ handle: u.handle, name: u.name, agent: u.agent, repaid: u.repaid || 0 });
const ms = (d) => (d ? new Date(d).getTime() : null);

export function amortPay(amount, apyPct, term, type) {
  const r = apyPct / 100 / 12;
  if (type === 'io') return money(amount * r);
  return money(r ? amount * r / (1 - Math.pow(1 + r, -term)) : amount / term);
}

async function friendIds(q, uid) {
  const rows = await q(
    `select case when a = $1 then b else a end as id from friends where (a = $1 or b = $1) and status = 'accepted'`, [uid]);
  return rows.map((r) => r.id);
}
async function isFriend(q, a, b) {
  return !!(await q(`select 1 from friends where ((a = $1 and b = $2) or (a = $2 and b = $1)) and status = 'accepted'`, [a, b]))[0];
}
async function cashOf(q, uid) {
  const r = (await q('select data from snapshots where user_id = $1', [uid]))[0];
  return r && r.data && Number.isFinite(+r.data.cash) ? +r.data.cash : null;
}
async function credit(q, uid, amount, kind, memo, meta = null) {
  if (!(amount > 0)) return;
  await q('insert into ledger (user_id, amount, kind, memo, meta) values ($1, $2, $3, $4, $5)', [uid, money(amount), kind, str(memo, 140), meta]);
}

// ───────── snapshot / leaderboard / profiles ─────────
function cleanSnapshot(d) {
  if (!d || typeof d !== 'object') bad('Missing snapshot.');
  const n = (v, lo, hi) => Math.max(lo, Math.min(hi, Number(v) || 0));
  const top = Array.isArray(d.top) ? d.top.slice(0, 12).map((p) => ({
    lot: n(p.lot, 0, 1e6) | 0, addr: str(p.addr, 60), kind: str(p.kind, 20), kn: str(p.kn, 24), dist: str(p.dist, 20),
    value: n(p.value, 0, 1e12), rent: n(p.rent, -1e9, 1e9), lux: n(p.lux, 0, 3) | 0, prestige: n(p.prestige, 0, 200) | 0,
    tier: str(p.tier, 20), historic: !!p.historic, str: !!p.str, built: n(p.built, 1700, 3000) | 0, upg: n(p.upg, 0, 99) | 0,
  })) : [];
  const clubs = {};
  if (d.clubs && typeof d.clubs === 'object') {
    for (const k of ['yacht', 'car', 'ski', 'golf']) {
      if (!Array.isArray(d.clubs[k])) continue;
      clubs[k] = d.clubs[k].slice(0, 4).map((v) => ({ id: str(v.id, 16), color: /^#[0-9a-f]{3,8}$/i.test(v.color) ? v.color : '#d64b3c' }));
    }
  }
  return {
    name: cleanName(d.name), fam: str(d.fam, 20), net: n(d.net, -1e12, 1e13), cash: n(d.cash, -1e12, 1e13),
    props: n(d.props, 0, 1e5) | 0, rep: n(d.rep, -100, 100) | 0, level: n(d.level, 0, 999) | 0, gen: n(d.gen, 1, 999) | 0,
    year: n(d.year, 0, 9999) | 0, seed: n(d.seed, 0, 2147483647) | 0, ach: n(d.ach, 0, 999) | 0, achTotal: n(d.achTotal, 0, 999) | 0,
    rentMo: n(d.rentMo, -1e10, 1e10), debt: n(d.debt, 0, 1e13), home: str(d.home, 60), str: n(d.str, 0, 999) | 0,
    historic: n(d.historic, 0, 999) | 0, top, clubs,
    hist: Array.isArray(d.hist) ? d.hist.slice(-60).map((v) => n(v, -1e12, 1e13)) : [],
  };
}
async function saveSnapshot(q, uid, raw) {
  const s = cleanSnapshot(raw);
  await q(
    `insert into snapshots (user_id, data, net, props, rep, level, gen, seed, updated_at) values ($1, $2, $3, $4, $5, $6, $7, $8, now())
     on conflict (user_id) do update set data = excluded.data, net = excluded.net, props = excluded.props, rep = excluded.rep,
       level = excluded.level, gen = excluded.gen, seed = excluded.seed, updated_at = now()`,
    [uid, s, s.net, s.props, s.rep, s.level, s.gen, s.seed],
  );
  // co-op lots this player leads: refresh the equity value partners see
  if (Array.isArray(raw.coop)) {
    for (const c of raw.coop.slice(0, 40)) {
      const v = Number(c.value);
      if (Number.isFinite(v) && v >= 0) await q(`update deals set value = $1, updated_at = now() where id = $2 and lead = $3 and status = 'active'`, [money(v), c.deal | 0, uid]);
    }
  }
}

const SORTS = { net: 's.net', props: 's.props', rep: 's.rep', level: 's.level', gen: 's.gen' };
async function leaderboard(me, url) {
  const sort = SORTS[url.searchParams.get('sort')] || 's.net';
  const scope = url.searchParams.get('scope') === 'friends' && me ? 'friends' : 'global';
  const params = [];
  let where = `where s.updated_at > now() - interval '120 days'`;
  if (scope === 'friends') {
    const ids = [me.id, ...(await friendIds(db.q, me.id))];
    params.push(ids);
    where = `where s.user_id = any($1)`;
  }
  const rows = await db.q(
    `select u.id, u.handle, u.name, u.agent, s.net, s.props, s.rep, s.level, s.gen, s.seed, s.updated_at,
            s.data->>'fam' as fam, s.data->'hist' as hist
       from snapshots s join users u on u.id = s.user_id ${where} order by ${sort} desc, s.updated_at asc limit 100`, params);
  const fr = me ? new Set(await friendIds(db.q, me.id)) : new Set();
  let myRank = null;
  if (me) {
    const mine = await db.one(`select ${sort.replace('s.', '')} as v from snapshots where user_id = $1`, [me.id]);
    if (mine) myRank = +(await db.one(`select count(*)::int as n from snapshots s where ${sort} > $1 and s.updated_at > now() - interval '120 days'`, [mine.v])).n + 1;
  }
  return {
    scope, myRank,
    rows: rows.map((r) => ({
      handle: r.handle, name: r.name, agent: r.agent, fam: r.fam || '', net: r.net, props: r.props, rep: r.rep, level: r.level, gen: r.gen,
      seed: r.seed, t: ms(r.updated_at), me: !!me && r.id === me.id, friend: fr.has(r.id),
      spark: Array.isArray(r.hist) ? r.hist.filter((_, i, a) => i % Math.max(1, Math.floor(a.length / 20)) === 0).slice(-20) : [],
    })),
  };
}

export async function profile(handle, me) {
  const u = await db.one('select * from users where handle = $1', [String(handle).toLowerCase()]);
  if (!u) return null;
  const snap = await db.one('select data, updated_at from snapshots where user_id = $1', [u.id]);
  const watch = await db.q('select seed, lot, addr, kind, dist, price, note, created_at from watch where user_id = $1 order by created_at desc limit 30', [u.id]);
  const out = { user: publicUser(u), snapshot: snap ? { ...snap.data, t: ms(snap.updated_at) } : null, watch: watch.map((w) => ({ ...w, created_at: ms(w.created_at) })) };
  if (me) {
    out.me = me.id === u.id;
    const f = await db.one('select a, status from friends where (a = $1 and b = $2) or (a = $2 and b = $1)', [me.id, u.id]);
    out.friend = !f ? 'none' : f.status === 'accepted' ? 'friends' : f.a === me.id ? 'sent' : 'received';
    if (out.friend === 'friends' || out.me) {
      out.deals = (await db.q(`select * from deals where lead = $1 and status in ('open', 'funded', 'active') order by created_at desc limit 20`, [u.id])).map(dealRow);
    }
    out.loans = (await db.q(
      `select l.*, ul.handle as lender_handle, ul.name as lender_name, ub.handle as borrower_handle, ub.name as borrower_name
         from loans l left join users ul on ul.id = l.lender left join users ub on ub.id = l.borrower
        where l.status = 'open' and (l.lender = $1 or l.borrower = $1) and (l.vis = 'public' or $2) order by l.created_at desc limit 20`,
      [u.id, out.friend === 'friends' || out.me])).map(loanRow);
  }
  return out;
}

// ───────── friends ─────────
async function friends(me) {
  const rows = await db.q(
    `select f.a, f.b, f.status, u.id, u.handle, u.name, u.agent, u.repaid, s.net, s.props, s.seed, s.updated_at, s.data->'clubs' as clubs
       from friends f join users u on u.id = case when f.a = $1 then f.b else f.a end
       left join snapshots s on s.user_id = u.id
      where f.a = $1 or f.b = $1 order by s.net desc nulls last`, [me.id]);
  const out = { friends: [], incoming: [], outgoing: [] };
  for (const r of rows) {
    const item = { ...publicUser(r), net: r.net || 0, props: r.props || 0, seed: r.seed, t: ms(r.updated_at) };
    if (r.status === 'accepted') out.friends.push(item);
    else if (r.b === me.id) out.incoming.push(item);
    else out.outgoing.push(item);
  }
  return out;
}
async function friendAction(me, body, action) {
  const other = await db.one('select * from users where handle = $1', [str(body.handle, 24).toLowerCase()]);
  if (!other) throw new HttpError(404, 'No player with that handle.');
  if (other.id === me.id) bad('That’s you!');
  if (action === 'request') {
    const back = await db.one('select status from friends where a = $1 and b = $2', [other.id, me.id]);
    if (back) { await db.q(`update friends set status = 'accepted' where a = $1 and b = $2`, [other.id, me.id]); return { status: 'friends' }; }
    await db.q('insert into friends (a, b) values ($1, $2) on conflict do nothing', [me.id, other.id]);
    return { status: 'sent' };
  }
  if (action === 'respond') {
    if (body.accept) { await db.q(`update friends set status = 'accepted' where a = $1 and b = $2`, [other.id, me.id]); return { status: 'friends' }; }
    await db.q('delete from friends where a = $1 and b = $2', [other.id, me.id]);
    return { status: 'none' };
  }
  await db.q('delete from friends where (a = $1 and b = $2) or (a = $2 and b = $1)', [me.id, other.id]);
  return { status: 'none' };
}

// ───────── watchlist ─────────
async function watchAdd(me, b) {
  const seed = int(b.seed, 0, 2147483647, 'seed'), lot = int(b.lot, 0, 1e6, 'lot');
  const n = +(await db.one('select count(*)::int as n from watch where user_id = $1', [me.id])).n;
  if (n >= 60) bad('Your watchlist is full (60). Remove a few first.');
  await db.q(
    `insert into watch (user_id, seed, lot, addr, kind, dist, price, note) values ($1, $2, $3, $4, $5, $6, $7, $8)
     on conflict (user_id, seed, lot) do update set note = excluded.note, price = excluded.price`,
    [me.id, seed, lot, str(b.addr, 60), str(b.kind, 20), str(b.dist, 20), num(b.price || 0, 0, 1e12, 'price'), str(b.note, 120)]);
  return { ok: true };
}

// ───────── co-op deals ─────────
function dealRow(d) {
  return {
    id: d.id, lead: d.lead_handle ? { handle: d.lead_handle, name: d.lead_name, agent: d.lead_agent } : undefined,
    seed: d.seed, lot: d.lot, addr: d.addr, kind: d.kind, dist: d.dist, price: d.price, target: d.target, minPut: d.min_put,
    pref: d.pref, note: d.note, status: d.status, value: d.value, raised: d.raised != null ? +d.raised : undefined,
    backers: d.backers != null ? +d.backers : undefined, t: ms(d.created_at),
  };
}
const DEAL_SELECT = `select d.*, u.handle as lead_handle, u.name as lead_name, u.agent as lead_agent,
    (select coalesce(sum(amount), 0) from deal_shares s where s.deal = d.id) as raised,
    (select count(*) from deal_shares s where s.deal = d.id) as backers
  from deals d join users u on u.id = d.lead`;
async function dealShares(q, id) {
  return (await q(
    `select s.*, u.handle, u.name, u.agent from deal_shares s join users u on u.id = s.user_id where s.deal = $1 order by s.amount desc`, [id]))
    .map((s) => ({ handle: s.handle, name: s.name, agent: s.agent, amount: s.amount, pct: s.pct, paid: s.paid_out, closed: s.closed }));
}
async function deals(me) {
  const fr = await friendIds(db.q, me.id);
  const lead = await db.q(`${DEAL_SELECT} where d.lead = $1 and d.status in ('open', 'funded', 'active') order by d.created_at desc`, [me.id]);
  const joined = await db.q(
    `${DEAL_SELECT} join deal_shares my on my.deal = d.id and my.user_id = $1 where d.status in ('open', 'funded', 'active', 'closed') order by d.updated_at desc limit 40`, [me.id]);
  const open = fr.length ? await db.q(
    `${DEAL_SELECT} where d.lead = any($1) and d.status = 'open'
       and not exists (select 1 from deal_shares s where s.deal = d.id and s.user_id = $2) order by d.created_at desc limit 40`, [fr, me.id]) : [];
  const withShares = async (list) => Promise.all(list.map(async (d) => ({ ...dealRow(d), shares: await dealShares(db.q, d.id) })));
  return { lead: await withShares(lead), joined: await withShares(joined), open: open.map(dealRow) };
}
async function dealCreate(me, b) {
  const price = num(b.price, 10000, 1e10, 'Price');
  const target = num(b.target, 1000, price * 0.8, 'Raise target');
  const minPut = num(b.minPut || 0, 0, target, 'Minimum stake');
  const pref = num(b.pref || 0, 0, 15, 'Preferred return');
  const seed = int(b.seed, 0, 2147483647, 'seed'), lot = int(b.lot, 0, 1e6, 'lot');
  const live = await db.one(`select id from deals where lead = $1 and seed = $2 and lot = $3 and status in ('open', 'funded')`, [me.id, seed, lot]);
  if (live) bad('You already have an open deal on this property.');
  const n = +(await db.one(`select count(*)::int as n from deals where lead = $1 and status in ('open', 'funded')`, [me.id])).n;
  if (n >= 8) bad('You can run up to 8 open deals at once.');
  const d = await db.one(
    `insert into deals (lead, seed, lot, addr, kind, dist, price, target, min_put, pref, note) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning *`,
    [me.id, seed, lot, str(b.addr, 60), str(b.kind, 20), str(b.dist, 20), money(price), money(target), money(minPut), pref, str(b.note, 200)]);
  return { deal: dealRow(d) };
}
async function dealPledge(me, id, b) {
  const amount = money(num(b.amount, 1000, 1e10, 'Amount'));
  return db.tx(async ({ q }) => {
    const d = (await q('select * from deals where id = $1 for update', [id]))[0];
    if (!d || d.status !== 'open') bad('This deal is no longer taking money.');
    if (d.lead === me.id) bad('You lead this deal.');
    if (!(await isFriend(q, me.id, d.lead))) throw new HttpError(403, 'Only friends of the lead can join.');
    const mine = (await q('select amount from deal_shares where deal = $1 and user_id = $2', [id, me.id]))[0];
    if (amount + (mine ? mine.amount : 0) < d.min_put) bad(`The minimum stake is $${Math.round(d.min_put).toLocaleString('en-US')}.`);
    const raised = +(await q('select coalesce(sum(amount), 0) as s from deal_shares where deal = $1', [id]))[0].s;
    if (raised + amount > d.target + 0.5) bad(`Only $${Math.round(d.target - raised).toLocaleString('en-US')} of room left.`);
    const cash = await cashOf(q, me.id);
    if (cash != null && amount > cash + 1) bad('You don’t have that much cash.');
    await q(`insert into deal_shares (deal, user_id, amount) values ($1, $2, $3)
             on conflict (deal, user_id) do update set amount = deal_shares.amount + excluded.amount`, [id, me.id, amount]);
    await q('update deals set updated_at = now() where id = $1', [id]);
    return { ok: true, amount };
  });
}
async function dealUnpledge(me, id) {
  return db.tx(async ({ q }) => {
    const d = (await q('select * from deals where id = $1 for update', [id]))[0];
    if (!d || d.status !== 'open') bad('The lead has already closed funding.');
    const s = (await q('delete from deal_shares where deal = $1 and user_id = $2 returning amount', [id, me.id]))[0];
    if (!s) bad('You have no stake in this deal.');
    await credit(q, me.id, s.amount, 'refund', `Stake returned · ${d.addr}`, { deal: id });
    return { ok: true };
  });
}
async function dealClose(me, id) {
  return db.tx(async ({ q }) => {
    const d = (await q('select * from deals where id = $1 for update', [id]))[0];
    if (!d || d.lead !== me.id) throw new HttpError(404, 'Deal not found.');
    if (d.status !== 'open') bad('Funding is already closed.');
    const shares = await dealShares(q, id);
    if (!shares.length) bad('Nobody has chipped in yet.');
    const users = await q('select s.user_id, s.amount, u.name from deal_shares s join users u on u.id = s.user_id where s.deal = $1', [id]);
    const total = users.reduce((s, x) => s + x.amount, 0);
    await q(`update deals set status = 'funded', updated_at = now() where id = $1`, [id]);
    await credit(q, me.id, total, 'dealfunds', `Partner money for ${d.addr}`, {
      deal: id, lot: d.lot, seed: d.seed, pref: d.pref, shares: users.map((x) => ({ user: x.user_id, name: x.name, amount: x.amount })),
    });
    return { ok: true, total };
  });
}
async function dealCancel(me, id) {
  return db.tx(async ({ q }) => {
    const d = (await q('select * from deals where id = $1 for update', [id]))[0];
    if (!d || d.lead !== me.id) throw new HttpError(404, 'Deal not found.');
    if (d.status !== 'open' && d.status !== 'funded') bad('This deal has already bought its property.');
    let deduct = 0;
    if (d.status === 'funded') {
      // if the partner money hasn't reached the lead's game yet, void it; otherwise the lead hands it back
      const pending = (await q(`update ledger set claimed_at = now(), memo = memo || ' (cancelled)' where user_id = $1 and kind = 'dealfunds'
                                and claimed_at is null and (meta->>'deal')::int = $2 returning amount`, [me.id, id]))[0];
      if (!pending) deduct = +(await q('select coalesce(sum(amount), 0) as s from deal_shares where deal = $1', [id]))[0].s;
    }
    for (const s of await q('select user_id, amount from deal_shares where deal = $1', [id])) {
      await credit(q, s.user_id, s.amount, 'refund', `Deal cancelled · ${d.addr}`, { deal: id });
    }
    await q(`update deals set status = 'cancelled', updated_at = now() where id = $1`, [id]);
    await q('update deal_shares set closed = true where deal = $1', [id]);
    return { ok: true, deduct };
  });
}

// ───────── player loans ─────────
function loanRow(l) {
  return {
    id: l.id, kind: l.kind, amount: l.amount, apy: l.apy, term: l.term, type: l.type, vis: l.vis, note: l.note, status: l.status,
    bal: l.bal, left: l.left_n, paid: l.paid, pay: amortPay(l.amount, l.apy, l.term, l.type), t: ms(l.created_at),
    lender: l.lender_handle ? { handle: l.lender_handle, name: l.lender_name, agent: l.lender_agent, repaid: l.lender_repaid } : null,
    borrower: l.borrower_handle ? { handle: l.borrower_handle, name: l.borrower_name, agent: l.borrower_agent, repaid: l.borrower_repaid } : null,
  };
}
const LOAN_SELECT = `select l.*, ul.handle as lender_handle, ul.name as lender_name, ul.agent as lender_agent, ul.repaid as lender_repaid,
    ub.handle as borrower_handle, ub.name as borrower_name, ub.agent as borrower_agent, ub.repaid as borrower_repaid
  from loans l left join users ul on ul.id = l.lender left join users ub on ub.id = l.borrower`;
async function loans(me) {
  const fr = await friendIds(db.q, me.id);
  const market = await db.q(
    `${LOAN_SELECT} where l.status = 'open' and coalesce(l.lender, l.borrower) <> $1
       and (l.vis = 'public' or coalesce(l.lender, l.borrower) = any($2)) order by l.created_at desc limit 60`, [me.id, fr]);
  const mine = await db.q(
    `${LOAN_SELECT} where (l.lender = $1 or l.borrower = $1) and (l.status in ('open', 'active') or l.started_at > now() - interval '30 days')
      order by l.created_at desc limit 60`, [me.id]);
  return { market: market.map(loanRow), mine: mine.map(loanRow) };
}
async function loanCreate(me, b) {
  const kind = b.kind === 'request' ? 'request' : 'offer';
  const amount = money(num(b.amount, 1000, 5e8, 'Amount'));
  const apy = Math.round(num(b.apy, 0, 40, 'APY') * 100) / 100;
  const term = int(b.term, 3, 120, 'Term');
  const type = b.type === 'io' ? 'io' : 'amort';
  const vis = b.vis === 'public' ? 'public' : 'friends';
  const open = +(await db.one(`select count(*)::int as n from loans where status = 'open' and coalesce(lender, borrower) = $1`, [me.id])).n;
  if (open >= 10) bad('You can have up to 10 open listings.');
  if (kind === 'offer') {
    const cash = await cashOf(db.q, me.id);
    if (cash != null && amount > cash + 1) bad('You don’t have that much cash to lend.');
  }
  const l = await db.one(
    `insert into loans (kind, lender, borrower, amount, apy, term, type, vis, note) values ($1, $2, $3, $4, $5, $6, $7, $8, $9) returning *`,
    [kind, kind === 'offer' ? me.id : null, kind === 'request' ? me.id : null, amount, apy, term, type, vis, str(b.note, 160)]);
  return { loan: loanRow(l) };
}
async function loanStart(q, l, lender, borrower) {
  const lu = (await q('select name from users where id = $1', [lender]))[0];
  await q(`update loans set lender = $2, borrower = $3, status = 'active', bal = amount, left_n = term, started_at = now() where id = $1`, [l.id, lender, borrower]);
  await credit(q, borrower, l.amount, 'loan', `Loan from ${lu ? lu.name : 'a friend'}`, {
    loan: l.id, apy: l.apy, term: l.term, type: l.type, who: lu ? lu.name : 'Friend', amount: l.amount, pay: amortPay(l.amount, l.apy, l.term, l.type),
  });
}
async function loanTake(me, id) {
  return db.tx(async ({ q }) => {
    const l = (await q('select * from loans where id = $1 for update', [id]))[0];
    if (!l || l.status !== 'open') bad('That listing is gone.');
    const owner = l.lender || l.borrower;
    if (owner === me.id) bad('That’s your own listing.');
    if (l.vis !== 'public' && !(await isFriend(q, me.id, owner))) throw new HttpError(403, 'Friends only.');
    if (l.kind === 'offer') {
      const active = +(await q(`select count(*)::int as n from loans where borrower = $1 and status = 'active'`, [me.id]))[0].n;
      if (active >= 6) bad('You already carry 6 player loans.');
      await loanStart(q, l, l.lender, me.id);
      return { ok: true, role: 'borrower' };
    }
    const cash = await cashOf(q, me.id);
    if (cash != null && l.amount > cash + 1) bad('You don’t have that much cash to lend.');
    await loanStart(q, l, me.id, l.borrower);
    return { ok: true, role: 'lender', deduct: l.amount };
  });
}
async function loanCancel(me, id) {
  return db.tx(async ({ q }) => {
    const l = (await q('select * from loans where id = $1 for update', [id]))[0];
    if (!l || l.status !== 'open' || (l.lender || l.borrower) !== me.id) bad('That listing can’t be cancelled.');
    await q(`update loans set status = 'cancelled' where id = $1`, [id]);
    if (l.kind === 'offer') await credit(q, me.id, l.amount, 'refund', 'Loan offer withdrawn', { loan: id });
    return { ok: true };
  });
}

// ───────── sync: outbox ops in, everything the game needs out ─────────
async function applyOp(q, me, o) {
  if (!o || typeof o.op !== 'string' || o.op.length > 40) return;
  const fresh = (await q('insert into ops (user_id, op) values ($1, $2) on conflict do nothing returning op', [me.id, o.op]))[0];
  if (!fresh) return; // already applied
  if (o.k === 'deal') {
    const d = (await q('select * from deals where id = $1 for update', [o.deal | 0]))[0];
    if (!d || d.lead !== me.id) return;
    const s = (await q('select * from deal_shares where deal = $1 and user_id = $2', [d.id, o.user | 0]))[0];
    if (!s || s.closed) return;
    const amount = money(Math.max(0, Math.min(Number(o.amount) || 0, d.price * 3)));
    const kind = ['rent', 'exit', 'buyout'].includes(o.kind) ? o.kind : 'rent';
    if (amount > 0) {
      await credit(q, s.user_id, amount, 'deal', `${kind === 'rent' ? 'Rent share' : kind === 'exit' ? 'Sale proceeds' : 'Buyout'} · ${d.addr}`, { deal: d.id, kind });
      await q('update deal_shares set paid_out = paid_out + $3 where deal = $1 and user_id = $2', [d.id, s.user_id, amount]);
    }
    if (kind !== 'rent') {
      await q('update deal_shares set closed = true where deal = $1 and user_id = $2', [d.id, s.user_id]);
      const left = +(await q('select count(*)::int as n from deal_shares where deal = $1 and not closed', [d.id]))[0].n;
      if (!left) await q(`update deals set status = 'closed', updated_at = now() where id = $1`, [d.id]);
    }
  } else if (o.k === 'loanpay') {
    const l = (await q('select * from loans where id = $1 for update', [o.loan | 0]))[0];
    if (!l || l.borrower !== me.id || l.status !== 'active') return;
    const interest = l.bal * l.apy / 100 / 12;
    const amount = money(Math.max(0, Math.min(Number(o.amount) || 0, l.bal + interest + 1)));
    const bal = Math.max(0, l.bal + interest - amount);
    const done = bal < 1;
    await q(`update loans set bal = $2, paid = paid + $3, left_n = greatest(0, left_n - 1), status = $4 where id = $1`,
      [l.id, money(done ? 0 : bal), amount, done ? 'repaid' : 'active']);
    if (done) await q('update users set repaid = repaid + 1 where id = $1', [me.id]);
    await credit(q, l.lender, amount, 'loanpay', `${done ? 'Final repayment' : 'Repayment'} from ${me.name}`, { loan: l.id, done });
  } else if (o.k === 'bought') {
    const d = (await q('select * from deals where id = $1 for update', [o.deal | 0]))[0];
    if (!d || d.lead !== me.id || d.status !== 'funded') return;
    const price = Math.max(0, Number(o.price) || d.price);
    await q(`update deals set status = 'active', price = $2, value = $2, updated_at = now() where id = $1`, [d.id, money(price)]);
    let total = 0;
    for (const sh of Array.isArray(o.shares) ? o.shares : []) {
      const pct = Math.max(0, Math.min(0.95 - total, Number(sh.pct) || 0));
      total += pct;
      await q('update deal_shares set pct = $3 where deal = $1 and user_id = $2', [d.id, sh.user | 0, pct]);
    }
  }
}

async function syncState(me, seed) {
  const fr = await friendIds(db.q, me.id);
  const ledger = await db.q('select id, amount, kind, memo, meta, created_at from ledger where user_id = $1 and claimed_at is null order by id limit 60', [me.id]);
  const stakes = await db.q(
    `select d.id as deal, d.lot, d.seed, d.addr, d.kind, d.dist, d.status, d.value, d.price, s.amount, s.pct, s.paid_out, s.closed,
            u.name as lead_name, u.handle as lead_handle
       from deal_shares s join deals d on d.id = s.deal join users u on u.id = d.lead
      where s.user_id = $1 and not s.closed and d.status in ('open', 'funded', 'active')`, [me.id]);
  const lent = await db.q(
    `select l.*, ub.name as borrower_name from loans l left join users ub on ub.id = l.borrower
      where l.lender = $1 and l.status in ('open', 'active')`, [me.id]);
  const lead = await db.q(`select id, lot, seed, status from deals where lead = $1 and status in ('open', 'funded', 'active')`, [me.id]);
  const venue = {}, friendsWatch = [];
  if (fr.length) {
    const snaps = await db.q(`select u.name, s.data->'clubs' as clubs from snapshots s join users u on u.id = s.user_id
                               where s.user_id = any($1) and s.updated_at > now() - interval '30 days' order by s.updated_at desc limit 40`, [fr]);
    for (const s of snaps) {
      for (const k in s.clubs || {}) {
        venue[k] = venue[k] || [];
        const list = s.clubs[k].length ? s.clubs[k] : [{ id: 'person' }];
        for (const v of list.slice(0, 2)) if (venue[k].length < 6) venue[k].push({ id: v.id, color: v.color, label: s.name });
      }
    }
    if (seed != null) {
      for (const w of await db.q(`select w.lot, w.note, u.name from watch w join users u on u.id = w.user_id where w.user_id = any($1) and w.seed = $2 limit 200`, [fr, seed])) {
        friendsWatch.push({ lot: w.lot, name: w.name, note: w.note });
      }
    }
  }
  const counts = {
    requests: +(await db.one(`select count(*)::int as n from friends where b = $1 and status = 'pending'`, [me.id])).n,
    deals: fr.length ? +(await db.one(`select count(*)::int as n from deals d where d.lead = any($1) and d.status = 'open'
                                        and not exists (select 1 from deal_shares s where s.deal = d.id and s.user_id = $2)`, [fr, me.id])).n : 0,
    loans: +(await db.one(`select count(*)::int as n from loans where status = 'open' and coalesce(lender, borrower) <> $1
                            and (vis = 'public' or coalesce(lender, borrower) = any($2))`, [me.id, fr])).n,
  };
  return {
    me: publicUser(me),
    ledger: ledger.map((l) => ({ id: l.id, amount: l.amount, kind: l.kind, memo: l.memo, meta: l.meta, t: ms(l.created_at) })),
    stakes: stakes.map((s) => ({
      deal: s.deal, lot: s.lot, seed: s.seed, addr: s.addr, kind: s.kind, dist: s.dist, status: s.status, put: s.amount, pct: s.pct,
      got: s.paid_out, lead: s.lead_name, leadHandle: s.lead_handle,
      value: s.status === 'active' ? money(s.value * s.pct) : s.amount,
    })),
    lent: lent.map((l) => ({ id: l.id, status: l.status, who: l.borrower_name || 'Open offer', apy: l.apy / 100, bal: l.status === 'open' ? l.amount : l.bal, left: l.left_n, term: l.term, type: l.type })),
    lead: lead.map((d) => ({ deal: d.id, lot: d.lot, seed: d.seed, status: d.status })),
    venue, friendsWatch, counts,
  };
}

// ───────── router ─────────
// returns undefined when no route matched
export async function api(req, url, me, readJson, res) {
  const p = url.pathname, m = req.method;
  const need = () => { if (!me) throw new HttpError(401, 'Please sign in.'); };
  let r;
  if (p === '/api/config' && m === 'GET') {
    return { providers: providers(), me: publicUser(me) };
  }
  if (p === '/api/leaderboard' && m === 'GET') return leaderboard(me, url);
  if ((r = p.match(/^\/api\/players\/([a-z0-9_]{1,24})$/)) && m === 'GET') {
    const out = await profile(r[1], me);
    if (!out) throw new HttpError(404, 'No such player.');
    return out;
  }
  need();
  if (p === '/api/logout' && m === 'POST') { await endSession(req, res); return { ok: true }; }
  if (p === '/api/account/delete' && m === 'POST') {
    await db.tx(async ({ q }) => {
      for (const d of await q(`select id, addr from deals where lead = $1 and status = 'open'`, [me.id])) {
        for (const s of await q('select user_id, amount from deal_shares where deal = $1', [d.id])) await credit(q, s.user_id, s.amount, 'refund', `Deal cancelled · ${d.addr}`, { deal: d.id });
      }
      await q('delete from users where id = $1', [me.id]);
    });
    await endSession(req, res);
    return { ok: true };
  }
  if (p === '/api/profile' && m === 'POST') {
    const b = await readJson();
    const name = b.name != null ? cleanName(b.name) : me.name;
    const handle = b.handle != null ? str(b.handle, 20).toLowerCase() : me.handle;
    if (!HANDLE.test(handle)) bad('Handles are 3–20 letters, numbers or underscores.');
    const agent = AGENTS.has(b.agent) ? b.agent : me.agent;
    const taken = await db.one('select id from users where handle = $1 and id <> $2', [handle, me.id]);
    if (taken) bad('That handle is taken.');
    const u = await db.one('update users set name = $2, handle = $3, agent = $4 where id = $1 returning *', [me.id, name, handle, agent]);
    return { me: publicUser(u) };
  }
  if (p === '/api/save' && m === 'GET') {
    const s = await db.one('select t, data from saves where user_id = $1', [me.id]);
    return s ? { t: s.t, json: s.data } : { t: 0, json: null };
  }
  if (p === '/api/save' && m === 'PUT') {
    const b = await readJson();
    const t = num(b.t, 0, 1e14, 't');
    if (typeof b.json !== 'string' || b.json.length > 3.5e6) bad('Save is missing or too large.');
    const row = await db.one(
      `insert into saves (user_id, t, data) values ($1, $2, $3)
       on conflict (user_id) do update set t = excluded.t, data = excluded.data, updated_at = now() where saves.t <= excluded.t returning t`,
      [me.id, t, b.json]);
    return { ok: !!row };
  }
  if (p === '/api/sync' && m === 'POST') {
    const b = await readJson();
    const ops = Array.isArray(b.ops) ? b.ops.slice(0, 200) : [];
    if (ops.length) await db.tx(async ({ q }) => { for (const o of ops) await applyOp(q, me, o); });
    if (b.snapshot) await saveSnapshot(db.q, me.id, b.snapshot);
    db.q('update users set seen_at = now() where id = $1', [me.id]).catch(() => {});
    return { applied: ops.map((o) => o && o.op), ...(await syncState(me, b.snapshot ? b.snapshot.seed | 0 : null)) };
  }
  if (p === '/api/ledger/ack' && m === 'POST') {
    const b = await readJson();
    const ids = (Array.isArray(b.ids) ? b.ids : []).map((x) => x | 0).filter((x) => x > 0).slice(0, 200);
    if (ids.length) await db.q('update ledger set claimed_at = now() where user_id = $1 and id = any($2) and claimed_at is null', [me.id, ids]);
    return { ok: true };
  }
  if (p === '/api/search' && m === 'GET') {
    const s = str(url.searchParams.get('q'), 24).toLowerCase().replace(/[%_\\]/g, '');
    if (s.length < 2) return { rows: [] };
    const rows = await db.q(
      `select u.handle, u.name, u.agent, u.repaid, s.net, s.props from users u left join snapshots s on s.user_id = u.id
        where (u.handle like $1 or lower(u.name) like $1) and u.id <> $2 order by s.net desc nulls last limit 12`, [`${s}%`, me.id]);
    return { rows };
  }
  if (p === '/api/friends' && m === 'GET') return friends(me);
  if ((r = p.match(/^\/api\/friends\/(request|respond|remove)$/)) && m === 'POST') return friendAction(me, await readJson(), r[1]);
  if (p === '/api/watch' && m === 'GET') {
    return { rows: (await db.q('select seed, lot, addr, kind, dist, price, note, created_at from watch where user_id = $1 order by created_at desc', [me.id])).map((w) => ({ ...w, created_at: ms(w.created_at) })) };
  }
  if (p === '/api/watch' && m === 'POST') return watchAdd(me, await readJson());
  if (p === '/api/watch/remove' && m === 'POST') {
    const b = await readJson();
    await db.q('delete from watch where user_id = $1 and seed = $2 and lot = $3', [me.id, b.seed | 0, b.lot | 0]);
    return { ok: true };
  }
  if (p === '/api/deals' && m === 'GET') return deals(me);
  if (p === '/api/deals' && m === 'POST') return dealCreate(me, await readJson());
  if ((r = p.match(/^\/api\/deals\/(\d+)\/(pledge|unpledge|close|cancel)$/)) && m === 'POST') {
    const id = +r[1];
    if (r[2] === 'pledge') return dealPledge(me, id, await readJson());
    if (r[2] === 'unpledge') return dealUnpledge(me, id);
    if (r[2] === 'close') return dealClose(me, id);
    return dealCancel(me, id);
  }
  if ((r = p.match(/^\/api\/deals\/(\d+)$/)) && m === 'GET') {
    const d = await db.one(`${DEAL_SELECT} where d.id = $1`, [+r[1]]);
    if (!d) throw new HttpError(404, 'Deal not found.');
    if (d.lead !== me.id && !(await isFriend(db.q, me.id, d.lead))) throw new HttpError(403, 'Friends only.');
    return { deal: { ...dealRow(d), shares: await dealShares(db.q, d.id) } };
  }
  if (p === '/api/loans' && m === 'GET') return loans(me);
  if (p === '/api/loans' && m === 'POST') return loanCreate(me, await readJson());
  if ((r = p.match(/^\/api\/loans\/(\d+)\/(take|cancel)$/)) && m === 'POST') return r[2] === 'take' ? loanTake(me, +r[1]) : loanCancel(me, +r[1]);
  return undefined;
}
