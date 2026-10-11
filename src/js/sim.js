'use strict';
// ───────────────────────── simulation core ─────────────────────────
const Bus = {
  h: {},
  on(e, f) { (this.h[e] || (this.h[e] = [])).push(f); },
  emit(e, d) { (this.h[e] || []).forEach((f) => { try { f(d); } catch (err) { console.error(err); } }); },
};

let G = null;     // the saved game state
let CITY = null;  // generated (not saved) city geometry

const rnd = Math.random;
const rgauss = () => gauss(rnd);
const LOAN_FEE = 1500;
const LEASE_MONTHS = { res: [6, 12, 12, 24], com: [24, 36, 60, 84], ind: [36, 60, 84, 120], agri: [12, 24, 36, 60], hosp: [60, 84, 120, 120] };

const perk = (p) => G && AGENT_BY_ID[G.agentId]?.perk === p;
const hasSkill = (id) => !!(G && G.skills && G.skills[id]);
const hasDeg = (id) => !!(G && G.degrees && G.degrees[id] != null);
const hasStaff = (id) => !!(G && G.staff && G.staff[id]);
const staffPower = (id) => (hasStaff(id) ? 0.8 + 0.4 * (G.staff[id].morale / 100) : 0);

// ── effective lot: the static lot plus whatever the player has built or changed ──
const _eff = new Map();
function bump(st) { st.ver = (st.ver || 0) + 1; }
function eff(L) {
  const st = G && G.lots[L.id];
  if (!st || !st.o) return L;
  const c = _eff.get(L.id);
  if (c && c.ver === (st.ver || 0)) return c.E;
  const E = Object.assign({}, L);
  if (st.cfg) { E.kind = st.cfg.kind; if (st.cfg.floors) E.floors = st.cfg.floors; if (st.cfg.look != null) E.look = st.cfg.look; }
  E.lux = st.lux; E.ups = st.ups;
  if (st.build) {
    E.kind = 'site'; E.target = st.build.kind; E.floors = st.build.floors;
    E.stage = clamp(Math.floor((1 - st.build.left / st.build.total) * 4), 0, 3);
    E.ups = null;
  }
  _eff.set(L.id, { ver: st.ver || 0, E });
  return E;
}
function kindOf(L) { return eff(L).kind; }

function sizeScale(E) {
  const K = KINDS[E.kind];
  if (!K.lots) return 1;
  const s0 = K.lots[0];
  let s = Math.pow((E.w * E.d) / (s0[0] * s0[1]), 0.9);
  if (K.f0) s *= (E.floors || K.f0) / K.f0;
  return s;
}
function unitCount(E, st) {
  const K = KINDS[E.kind];
  if (!K || K.cat === 'civic' || K.cat === 'land' || E.kind === 'site') return 0;
  let n;
  switch (E.kind) {
    case 'apartment': n = (E.floors || 5) * E.w * E.d; break;
    case 'condotower': n = (E.floors || 18) * 4; break;
    case 'office': case 'officetower': n = E.floors || K.f0; break;
    case 'townhouse': n = Math.round(Math.max(E.w, E.d) * 1.5); break;
    default: n = K.units || 1;
  }
  if (st && st.ups && st.ups.suite) n += 1;
  return n;
}
function sqmOf(E, st) {
  const K = KINDS[E.kind];
  if (!K.sqm) return E.w * E.d * 400;
  const n = unitCount(E, null);
  let s;
  if (K.cat === 'res') s = K.sqm * (n || 1) * (K.units || ['apartment', 'condotower', 'townhouse'].includes(E.kind) ? 1 : 1);
  else if (E.kind === 'office' || E.kind === 'officetower') s = K.sqm * (E.floors || K.f0);
  else s = K.sqm * sizeScale(E);
  if (st && st.ups && st.ups.extension) s *= 1.22;
  if (st && st.ups && st.ups.suite) s += 55;
  return Math.round(s);
}
function bedsOf(E, st) {
  const K = KINDS[E.kind];
  return (K.beds || 0) + (st && st.ups && st.ups.extension ? 1 : 0);
}
function luxOf(E, st) { return st && st.o && st.lux != null ? st.lux : KINDS[E.kind].lux; }
function tagsOf(L, st) {
  const E = eff(L), K = KINDS[E.kind];
  const t = [];
  if (K.style) t.push(K.style);
  const lux = luxOf(E, st);
  if (K.cat !== 'civic' && K.cat !== 'land') {
    if (lux >= 3) t.push('luxury'); else if (lux <= 0) t.push('budget');
    if (K.cat === 'res') {
      const sq = sqmOf(E, st) / Math.max(1, unitCount(E, null));
      if (sq < 100) t.push('compact'); else if (sq >= 280) t.push('large');
      if (bedsOf(E, st) >= 3 && !['apartment', 'condotower'].includes(E.kind)) t.push('family');
    }
    if ((E.floors || 0) >= 15) t.push('view');
    if (K.pool) t.push('pool');
  }
  if (L.water) t.push('waterfront');
  const u = (st && st.o && st.ups) || {};
  for (const k in u) if (u[k] && UPGRADES[k] && UPGRADES[k].tag && !t.includes(UPGRADES[k].tag)) t.push(UPGRADES[k].tag);
  return t;
}
function tagScore(L, st) {
  const pref = DISTRICT_BY_ID[L.dist].pref;
  let s = 0;
  for (const tag of tagsOf(L, st)) s += pref[tag] || 0;
  return clamp(s, -0.1, 0.45);
}

// ── values & rents ──
function locMult(L) { const ds = G.dist[L.dist]; return DISTRICT_BY_ID[L.dist].mult * ds.idx * G.market.idx * (L.water ? 1.22 : 1); }
function landValue(L) { return LAND_PER_TILE * L.w * L.d * locMult(L); }
function valueOf(L, E, st) {
  const K = KINDS[E.kind];
  if (K.cat === 'civic') return 0;
  const land = landValue(L);
  if (E.kind === 'site') return land + (st && st.build ? st.build.paid * 0.92 : 0);
  if (K.cat === 'land') return land;
  const lux = luxOf(E, st);
  let v = K.base * sizeScale(E) * L.factor * locMult(L) * (LUX_V[lux] / LUX_V[K.lux]);
  v *= Math.pow(G.dist[L.dist].dem[segOf(E.kind)], 0.5);
  v *= 1 + 0.5 * tagScore(L, st);
  const cond = st && st.o ? st.cond : st && st.s ? st.s.cond : 0.85;
  v *= 0.78 + 0.26 * cond;
  const u = (st && st.o && st.ups) || {};
  for (const k in u) if (u[k] && UPGRADES[k] && UPGRADES[k].val) v *= 1 + UPGRADES[k].val;
  if (st && st.built && hasSkill('dev3')) v *= 1.1;
  if (st && st.afford) v *= 0.92;
  return Math.max(v, land * 1.05);
}
function lotValue(L, st = G.lots[L.id]) { return valueOf(L, eff(L), st); }
function marketRent(L, st = G.lots[L.id]) {
  const E = eff(L), K = KINDS[E.kind];
  if (!K.yield) return 0;
  let r = lotValue(L, st) * K.yield * 1.08 / 12;
  r *= Math.pow(G.dist[L.dist].dem[segOf(E.kind)], 0.3);
  const u = (st && st.o && st.ups) || {};
  for (const k in u) if (u[k] && UPGRADES[k] && UPGRADES[k].rent) r *= 1 + UPGRADES[k].rent;
  if (u.suite) r *= 1.32;
  return r;
}
function unitRent(L, st = G.lots[L.id]) { const n = Math.max(1, unitCount(eff(L), st)); return marketRent(L, st) / n; }

// ── letting odds (the rent slider uses these) ──
function fillProb(L, st, rm = st.rm) {
  const E = eff(L), seg = segOf(E.kind);
  const base = { res: 0.55, com: 0.32, ind: 0.3, agri: 0.4, hosp: 0.35 }[seg];
  const price = 1.6 / (1 + Math.exp(9 * (rm - 1.02)));
  const cond = 0.45 + st.cond * 0.65;
  const ds = G.dist[L.dist];
  let p = base * price * cond * ds.dem[seg] * (1 + tagScore(L, st)) * (1 + G.rep / 250) * (0.85 + 0.3 * ds.sent / 100);
  if (perk('manager')) p *= 1.4;
  if (hasStaff('pm')) p *= 1 + 0.3 * staffPower('pm');
  if (hasStaff('leasing') && seg !== 'res') p *= 1 + 0.6 * staffPower('leasing');
  if (hasSkill('land1')) p *= 1.15;
  if (st.ups && st.ups.landscaping) p *= 1.12;
  return clamp(p, 0.02, 0.97);
}
function renewProb(L, st, rm = st.rm) {
  let p = 0.72 + (1.02 - rm) * 0.9 + (st.cond > 0.6 ? 0.05 : -0.15);
  if (perk('manager')) p += 0.1;
  if (hasStaff('pm')) p += 0.1 * staffPower('pm');
  if (hasSkill('land3')) p += 0.15;
  return clamp(p, 0.05, 0.97);
}
function avgLease(L) { const a = LEASE_MONTHS[segOf(kindOf(L))]; return a.reduce((s, x) => s + x, 0) / a.length; }
function rentOutlook(L, st, rm) {
  const p = fillProb(L, st, rm), r = renewProb(L, st, rm), Lm = avgLease(L);
  const vacWait = 1 / p;
  const occ = Lm / (Lm + (1 - r) * vacWait);
  const rent = unitRent(L, st) * rm;
  return { p, renew: r, wait: vacWait, occ, rent, yearly: rent * 12 * occ * Math.max(1, unitCount(eff(L), st)) };
}
function bestRent(L, st) {
  let best = 1, bv = 0;
  for (let m = 0.7; m <= 1.5001; m += 0.02) { const o = rentOutlook(L, st, m); if (o.yearly > bv) { bv = o.yearly; best = m; } }
  return Math.round(best * 100) / 100;
}

// ── holding costs ──
function holdCosts(L, st) {
  const v = lotValue(L, st), K = KINDS[kindOf(L)];
  if (!K.yield) return { ins: 0, maint: v * 0.0003 };
  const ins = K.strata ? v * 0.0035 / 12 : (st.ins ? v * 0.002 / 12 : 0);
  let maint = v * 0.0006;
  if (st.ups && st.ups.solar) maint *= 0.85;
  if (hasStaff('handy')) maint *= 1 - 0.25 * staffPower('handy');
  const units = st.units || [];
  if (units.length) { const net = units.filter((u) => u && u.r && u.net).length / units.length; maint *= 1 - 0.7 * net; }
  return { ins, maint };
}
function loanPayment(bal, rate, months) {
  if (bal <= 0 || months <= 0) return 0;
  const r = rate / 12;
  return r === 0 ? bal / months : (bal * r) / (1 - Math.pow(1 + r, -months));
}
function lenderRate(l) {
  let r = G.market.rate + l.margin;
  if (perk('finance')) r -= 0.0035;
  if (hasSkill('fin1')) r -= 0.0025;
  if (hasSkill('fin3')) r -= 0.0025;
  if (hasDeg('finance')) r -= 0.0015;
  return Math.max(0.01, r);
}
function lenderMinDep(l) { return Math.max(0.03, l.minDep - (perk('finance') ? 0.05 : 0) - (hasSkill('fin2') ? 0.05 : 0)); }

// ── portfolio ──
function owned() { return CITY.lots.filter((L) => G.lots[L.id] && G.lots[L.id].o); }
function lotState(id) { return G.lots[id] || null; }
function isOwned(id) { const s = G.lots[id]; return !!(s && s.o); }
function listing(id) { const s = G.lots[id]; return s && s.s ? s.s : null; }
function partnerShare(st) { return (st.partners || []).reduce((s, p) => s + p.share, 0); }
function totals() {
  let value = 0, loans = 0, rent = 0, pay = 0, res = 0, com = 0, vacant = 0, wf = 0, towers = 0, tenants = 0, units = 0, equityOthers = 0;
  const dists = new Set();
  for (const L of CITY.lots) {
    const st = G.lots[L.id];
    if (!st || !st.o) continue;
    const v = lotValue(L, st);
    value += v;
    const debt = st.loan ? st.loan.bal : 0;
    loans += debt;
    equityOthers += partnerShare(st) * Math.max(0, v - debt);
    if (st.loan) pay += st.loan.pay;
    for (const u of st.units || []) { if (!u) continue; units++; if (u.r) { rent += u.r; tenants++; } else vacant++; }
    const k = kindOf(L), cat = KINDS[k].cat;
    if (cat === 'res') res++; else if (cat !== 'land') com++;
    if (L.water) wf++;
    if (['condotower', 'officetower', 'hotel'].includes(k)) towers++;
    dists.add(L.dist);
  }
  const pl = (G.ploans || []).reduce((s, p) => s + p.bal, 0);
  const assets = (G.assets || []).reduce((s, a) => s + a.value, 0);
  const stocks = Object.entries(G.stk || {}).reduce((s, [, x]) => s + x.q * x.p, 0);
  return { value, loans, pl, rent, pay, props: res + com, res, com, vacant, wf, towers, tenants, units, districts: dists.size, assets, stocks,
    net: G.cash + value - loans - equityOthers - pl + assets + stocks };
}

// ───────── game lifecycle ─────────
function newDistState() {
  const o = {};
  for (const d of DISTRICTS) o[d.id] = { idx: 1, trend: 0, sent: 60, dem: Object.assign({}, d.dem), dt: { res: 0, com: 0, ind: 0, agri: 0, hosp: 0 }, ev: [] };
  return o;
}
function newGame(mogul, agentId, seed = (Math.random() * 1e9) | 0) {
  CITY = generateCity(seed);
  _eff.clear();
  G = {
    v: 3, seed, mogul, agentId, month: 0, cash: START_CASH, rep: 0, neg: 0,
    market: { idx: 1, rate: 0.045, phase: rnd() * TAU, g: 0.05 },
    dist: newDistState(),
    lots: {}, zones: {}, coolZ: {},
    hist: { m: [], cash: [], net: [], loans: [], props: [], rep: [] },
    dh: {},
    ach: {},
    stats: { boughtRes: 0, boughtCom: 0, loansTaken: 0, renovations: 0, profitSales: 0, sold: 0, rent: 0, upgrades: 0, built: 0, rezoned: 0, coinvests: 0, parties: 0, stockGain: 0 },
    rivals: RIVALS.map((r) => ({ id: r.id, worth: 1e6 * (0.95 + rnd() * 0.3) })),
    cool: {}, news: [], tut: 0,
    xp: 0, lvl: 1, sp: 0, skills: {}, degrees: {}, school: null,
    staff: {}, inv: {}, ploans: [], assets: [], stk: {}, mkt: {},
    council: [], feed: [], queue: [], home: null, lastParty: -99, homeDist: null,
  };
  for (const d of DISTRICTS) G.dh[d.id] = { idx: [], dem: [], sent: [] };
  for (const x of INVESTORS) G.inv[x.id] = { met: !!x.met, trust: x.met ? 35 : 0, paid: 0, deals: 0 };
  for (const s of STOCKS) G.stk[s.id] = { p: s.p, h: [s.p], q: 0, cost: 0 };
  for (const a of ASSETS) G.mkt[a.id] = 1;
  const L = CITY.lots[CITY.startLot];
  const st = G.lots[L.id] = makeOwnedState(L, 0, 0.82);
  st.pp = Math.round(lotValue(L, st)); st.cost = st.pp;
  st.units = [makeTenant(L, st, 7)];
  refreshListings(true);
  record();
  return G;
}
function loadGame(data) {
  G = data;
  CITY = generateCity(G.seed);
  _eff.clear();
  return G;
}
function makeOwnedState(L, price, cond) {
  const st = { o: 1, pp: price, pm: G.month, cond, ins: false, rm: 1, lux: KINDS[L.kind].lux, ups: {}, units: [], loan: null, cost: price, partners: [], offers: [], auto: true, ver: 0 };
  st.units = Array.from({ length: unitCount(L, st) }, () => ({ v: 0 }));
  return st;
}
function tenantName(seg) {
  if (seg === 'res') return pick(rnd, FIRST) + ' ' + pick(rnd, LAST);
  return pick(rnd, BIZ_A) + ' ' + pick(rnd, BIZ_B);
}
function makeTenant(L, st, months) {
  const seg = segOf(kindOf(L));
  return { n: tenantName(seg), r: Math.round(unitRent(L, st) * st.rm), l: months || pick(rnd, LEASE_MONTHS[seg]), s: G.month };
}

// ───────── listings & sellers ─────────
const MOTIVES = [
  { k: 'Relocating for work', r: [0.88, 0.94], pat: 3 },
  { k: 'Divorce settlement', r: [0.85, 0.92], pat: 2 },
  { k: 'Estate sale', r: [0.86, 0.95], pat: 3 },
  { k: 'Investor cashing out', r: [0.92, 0.98], pat: 4 },
  { k: 'Testing the market', r: [0.97, 1.02], pat: 2 },
  { k: 'Downsizing', r: [0.9, 0.96], pat: 3 },
  { k: 'Behind on the mortgage', r: [0.82, 0.9], pat: 2 },
];
function makeSeller(L, price, offMarket) {
  const m = offMarket ? -1 : Math.floor(rnd() * MOTIVES.length);
  const M = m >= 0 ? MOTIVES[m] : { r: [1.08, 1.25], pat: 2 };
  return {
    p: price, left: 4 + Math.floor(rnd() * 9), mot: m,
    res: lerp(M.r[0], M.r[1], rnd()), pat: M.pat + (hasSkill('dealer2') ? 1 : 0),
    cond: clamp(0.55 + rnd() * 0.42, 0.3, 0.97),
    hid: rnd() < 0.25 ? 0.02 + rnd() * 0.06 : 0,
  };
}
function refreshListings(initial = false) {
  const target = 26;
  let count = 0;
  for (const id in G.lots) {
    const s = G.lots[id].s;
    if (!s) continue;
    if (!initial) s.left--;
    if (s.left <= 0) delete G.lots[id]; else count++;
  }
  let guard = 0;
  while (count < target && guard++ < 800) {
    const L = CITY.lots[Math.floor(rnd() * CITY.lots.length)];
    if (!isProperty(L.kind) || G.lots[L.id]) continue;
    const v = lotValue(L);
    if (v > 15e6 && rnd() < 0.6) continue;
    const price = Math.round(v * (0.96 + rnd() * 0.12) * (perk('negotiate') ? 0.98 : 1) * (hasSkill('dealer2') ? 0.98 : 1) / 1000) * 1000;
    G.lots[L.id] = { s: makeSeller(L, price, false) };
    count++;
  }
}
function askPrice(L) { const s = listing(L.id); return s ? s.p : Math.round(lotValue(L) / 1000) * 1000; }

// ───────── buying ─────────
function serviceability(extraPay, extraRent, cashAfter) {
  const t = totals();
  const pay = t.pay + extraPay, income = (t.rent + extraRent) * (hasSkill('fin2') ? 1.25 : 1);
  return pay <= income * 1.1 + Math.max(0, cashAfter) / 36;
}
function quoteLoan(L, price, lender, dep, years, partnerCash = 0) {
  const rate = lenderRate(lender);
  const principal = Math.round(price * (1 - dep));
  const pay = loanPayment(principal, rate, years * 12);
  const totalCash = price * dep + price * SALES_TAX + (principal > 0 ? LOAN_FEE : 0);
  const cashNeed = Math.max(0, totalCash - partnerCash);
  const tmp = { o: 1, cond: 0.85, ins: false, rm: 1, ups: {}, lux: KINDS[L.kind].lux };
  const rent = marketRent(L, tmp) * 0.94;
  const costs = holdCosts(L, tmp);
  const flow = rent - pay - costs.ins - costs.maint;
  const reasons = [];
  if (G.rep < lender.minRep) reasons.push(`${lender.name} needs a reputation of ${lender.minRep} or more.`);
  if (dep < lenderMinDep(lender) - 1e-9) reasons.push(`The minimum deposit is ${fmtPct(lenderMinDep(lender), 0)}.`);
  if (G.cash < 0) reasons.push('Your account is overdrawn. Banks won\u2019t lend until it\u2019s back in the black.');
  else if (cashNeed > G.cash) reasons.push(`You need ${fmt$(cashNeed)} in cash for the deposit, tax and fees.`);
  else if (G.cash - cashNeed < pay * 2) reasons.push('The bank wants at least two months of repayments left in your account.');
  else if (!serviceability(pay, rent, G.cash - cashNeed)) reasons.push('Your rent income can’t cover these repayments yet. Pay down a loan, bring in an investor or raise more cash first.');
  return { rate, principal, pay, cashNeed, totalCash, rent, flow, ok: reasons.length === 0, reasons };
}
// spec: { price, loan: {lender, dep, years} | null, partner: {id, share} | null, inspected }
function buy(L, spec) {
  const price = spec.price, tax = price * SALES_TAX;
  const totalCost = price + tax;
  let partnerCash = 0;
  if (spec.partner) partnerCash = Math.round(totalCost * spec.partner.share);
  let loan = null, cashNeed = totalCost - partnerCash;
  if (spec.loan) {
    const q = quoteLoan(L, price, spec.loan.lender, spec.loan.dep, spec.loan.years, partnerCash);
    if (!q.ok) return { ok: false, reason: q.reasons[0] };
    cashNeed = q.cashNeed;
    loan = q.principal > 0 ? { lender: spec.loan.lender.id, bal: q.principal, rate: q.rate, term: spec.loan.years * 12, pay: q.pay, orig: q.principal } : null;
  }
  if (cashNeed > G.cash) return { ok: false, reason: 'Not enough cash.' };
  const seller = listing(L.id);
  G.cash -= cashNeed;
  const st = makeOwnedState(L, price, seller ? seller.cond : 0.85);
  st.loan = loan;
  st.cost = cashNeed + (loan ? loan.bal : 0) + partnerCash;
  if (spec.partner) {
    st.partners = [{ id: spec.partner.id, share: spec.partner.share, put: partnerCash }];
    G.inv[spec.partner.id].deals++;
    G.stats.coinvests++;
  }
  G.lots[L.id] = st;
  _eff.delete(L.id);
  if (KINDS[L.kind].cat === 'res') G.stats.boughtRes++; else G.stats.boughtCom++;
  if (loan) G.stats.loansTaken++;
  G.rep = clamp(G.rep + 3, -100, 100);
  delete G.cool[L.id];
  addXP(15 + Math.min(80, price / 150000));
  if (seller && seller.hid && !spec.inspected) queueDecision({ type: 'hidden', lot: L.id, cost: Math.round(price * seller.hid) });
  Bus.emit('owned', L);
  checkAchievements();
  return { ok: true };
}

// ───────── owning ─────────
function sellQuote(L) {
  const st = lotState(L.id);
  if (!st.q || st.q.m !== G.month) {
    const v = lotValue(L, st);
    const dem = G.dist[L.dist].dem[segOf(kindOf(L))];
    st.q = { m: G.month, p: Math.round(v * (0.94 + rnd() * 0.08 + (perk('negotiate') ? 0.02 : 0)) * Math.pow(dem, 0.15) / 1000) * 1000, tried: false };
  }
  const price = st.q.p, comm = price * (hasDeg('license') ? 0.015 : SELL_COMMISSION), debt = st.loan ? st.loan.bal : 0;
  const share = partnerShare(st);
  const net = (price - comm - debt) * (1 - share);
  return { price, comm, debt, share, net, gain: net - st.cost * (1 - share) };
}
function counterChance(L, ask) { const st = lotState(L.id); return clamp(1 - (ask / st.q.p - 1) / 0.12, 0, 1) * 0.9; }
function counterSale(L, ask) {
  const st = lotState(L.id);
  st.q.tried = true;
  if (rnd() < counterChance(L, ask)) { st.q.p = ask; return true; }
  return false;
}
function sell(L, forced = false) {
  const st = lotState(L.id);
  const q = sellQuote(L);
  const price = forced ? lotValue(L, st) * 0.9 : q.price;
  const comm = price * (hasDeg('license') ? 0.015 : SELL_COMMISSION), debt = st.loan ? st.loan.bal : 0;
  const gross = price - comm - debt;
  const share = partnerShare(st);
  const net = gross * (1 - share);
  if (!forced && gross < 0 && G.cash + gross < 0) return { ok: false, reason: 'The sale won’t cover your loan and you don’t have the cash to make up the difference.' };
  G.cash += gross < 0 ? gross : net;
  for (const p of st.partners || []) {
    const inv = G.inv[p.id]; const got = Math.max(0, gross) * p.share;
    inv.paid += got - (p.put || 0);
    inv.trust = clamp(inv.trust + (got > (p.put || 0) ? 10 : -12) * (hasSkill('inv2') ? 1.5 : 1), 0, 100);
  }
  if (net > st.cost * (1 - share)) { G.stats.profitSales++; addXP(Math.min(150, (net - st.cost * (1 - share)) / 40000)); }
  G.stats.sold++;
  if (G.home === L.id) G.home = null;
  delete G.lots[L.id];
  _eff.delete(L.id);
  Bus.emit('sold', L);
  checkAchievements();
  return { ok: true, net, price };
}
function renovateCost(L, st) { return Math.round((lotValue(L, st) * (1 - st.cond) * 0.12 + 2500) * (hasStaff('handy') ? 0.85 : 1) / 100) * 100; }
function renovate(L) {
  const st = lotState(L.id), c = renovateCost(L, st);
  if (c > G.cash) return { ok: false, reason: 'Not enough cash for the renovation.' };
  G.cash -= c; st.cond = 1; st.cost += c * 0.5;
  G.stats.renovations++;
  G.rep = clamp(G.rep + 2, -100, 100);
  sentiment(L.dist, 1, null);
  addXP(8);
  checkAchievements();
  return { ok: true, cost: c };
}
function upgradeAllowed(L, st, id) {
  const U = UPGRADES[id], E = eff(L), K = KINDS[E.kind];
  if (!K.yield || st.build) return false;
  if (U.water && !L.water) return false;
  if (id === 'fittings') return (st.lux ?? K.lux) < 3 && (K.cat === 'res' || K.cat === 'com' || K.cat === 'hosp');
  if (st.ups[id]) return false;
  if (K.pool && id === 'pool') return false;
  if (U.kinds === 'building') return true;
  if (U.kinds === 'resSingle') return K.cat === 'res' && unitCount(E, null) <= 2;
  if (U.kinds === 'resCom') return K.cat === 'res' || K.cat === 'com';
  return U.kinds.includes(E.kind);
}
function upgradeCost(L, st, id) { return Math.round(lotValue(L, st) * UPGRADES[id].cost / 100) * 100; }
function upgrade(L, id) {
  const st = lotState(L.id);
  if (!upgradeAllowed(L, st, id)) return { ok: false, reason: 'That upgrade isn’t possible here.' };
  const c = upgradeCost(L, st, id);
  if (c > G.cash) return { ok: false, reason: 'Not enough cash for the upgrade.' };
  const before = lotValue(L, st);
  G.cash -= c; st.cost += c;
  if (id === 'fittings') st.lux = (st.lux ?? KINDS[kindOf(L)].lux) + 1;
  else st.ups[id] = 1;
  if (id === 'suite') st.units.push({ v: 0 });
  bump(st);
  G.stats.upgrades++;
  addXP(6);
  checkAchievements();
  return { ok: true, cost: c, gain: lotValue(L, st) - before };
}
function payOff(L) {
  const st = lotState(L.id);
  if (!st.loan) return { ok: false };
  if (st.loan.bal > G.cash) return { ok: false, reason: 'Not enough cash to clear this loan.' };
  G.cash -= st.loan.bal; st.loan = null;
  checkAchievements();
  return { ok: true };
}
function refinance(L) {
  const st = lotState(L.id);
  const v = lotValue(L, st), max = v * 0.7, bal = st.loan ? st.loan.bal : 0;
  const draw = Math.max(0, max - bal);
  if (draw < 10000) return { ok: false, reason: 'There isn’t enough equity to release.' };
  const lender = st.loan ? LENDER_BY_ID[st.loan.lender] : LENDERS[0];
  const rate = lenderRate(lender);
  st.loan = { lender: lender.id, bal: max, rate, term: 360, pay: loanPayment(max, rate, 360), orig: max };
  G.cash += draw - LOAN_FEE;
  return { ok: true, draw };
}
function acceptOffer(L, idx) {
  const st = lotState(L.id), o = st.offers[idx];
  const unit = st.units.findIndex((u) => u && !u.r && !u.home);
  if (!o || unit < 0) return false;
  st.units[unit] = { n: o.n, r: o.r, l: o.y * 12, s: G.month, cr: o.cr, e: o.e, f: o.f, net: o.net, y: o.y };
  st.offers.splice(idx, 1);
  return true;
}
function makeOffer(L, st) {
  const seg = segOf(kindOf(L));
  const lp = hasStaff('leasing') ? 1.05 : 1;
  const y = pick(rnd, seg === 'hosp' ? [5, 7, 10] : seg === 'ind' ? [3, 5, 7, 10] : seg === 'agri' ? [1, 2, 3, 5] : [2, 3, 5, 7, 10]);
  const cr = weighted(rnd, [['A', 0.3], ['B', 0.45], ['C', 0.25]]);
  const base = unitRent(L, st) * st.rm;
  return {
    n: tenantName('com'), cr, y,
    r: Math.round(base * (cr === 'A' ? 0.92 : cr === 'B' ? 0.98 : 1.06) * (0.96 + rnd() * 0.1) * lp),
    e: Math.round((0.02 + rnd() * 0.02) * 1000) / 1000,
    f: Math.floor(rnd() * (y >= 5 ? 6 : 3)),
    net: rnd() < 0.55,
    exp: G.month + 3,
  };
}
function offerScore(o) {
  const risk = { A: 1, B: 0.95, C: 0.84 }[o.cr];
  return o.r * (1 + o.e * o.y / 2) * (1 - o.f / (o.y * 12)) * risk * (o.net ? 1.06 : 1) * (1 + Math.min(o.y, 7) * 0.01);
}

// ───────── development ─────────
function zoneOf(L) {
  if (G.zones[L.id]) return G.zones[L.id];
  const k = kindOf(L);
  return KINDS[k].zone || DISTRICT_BY_ID[L.dist].zones[0];
}
function buildOptions(L) {
  const z = zoneOf(L);
  const style = DISTRICT_BY_ID[L.dist].style;
  return (ZONE_KINDS[z] || []).filter((k) => KINDS[k].build && (!KINDS[k].only || KINDS[k].only === style) && KINDS[k].lots.some((s) => s[0] === L.w && s[1] === L.d));
}
function buildQuote(L, kind, floors, lux, look) {
  const K = KINDS[kind];
  const E = Object.assign({}, L, { kind, floors: K.f0 ? floors : 1, lux, look, ups: {} });
  let cost = K.base * sizeScale(E) * (LUX_C[lux] / LUX_C[K.lux]) * 0.66 * Math.sqrt(G.market.idx);
  if (hasStaff('architect')) cost *= 1 - 0.12 * staffPower('architect');
  if (hasSkill('dev2')) cost *= 0.9;
  if (hasDeg('arch')) cost *= 0.9;
  let months = K.f0 ? 4 + floors * 0.55 : (L.w * L.d > 4 ? 9 : 5);
  if (hasStaff('architect')) months *= 0.75;
  months = Math.round(clamp(months, 3, 30));
  const st = { o: 1, cond: 1, ups: {}, lux, built: true, rm: 1 };
  const value = valueOf(L, E, st);
  const units = unitCount(E, null);
  const rent = value * (K.yield || 0) / 12 * Math.pow(G.dist[L.dist].dem[segOf(kind)], 0.3);
  return { kind, floors: E.floors, lux, look, cost: Math.round(cost), months, value, units, rent, sqm: sqmOf(E, null), E };
}
function demolishCost(L) {
  const st = lotState(L.id);
  const tenants = (st.units || []).filter((u) => u && u.r);
  const comp = tenants.reduce((s, u) => s + u.r * 3, 0);
  const isLand = kindOf(L) === 'land';
  return { demo: isLand ? 0 : Math.round(lotValue(L, st) * 0.02 + 15000), comp, tenants: tenants.length };
}
function demolish(L) {
  const st = lotState(L.id);
  const c = demolishCost(L);
  const total = c.demo + c.comp;
  if (total > G.cash) return { ok: false, reason: 'Not enough cash to demolish.' };
  if (G.home === L.id) return { ok: false, reason: 'You live here! Move out first.' };
  G.cash -= total;
  if (!G.zones[L.id]) G.zones[L.id] = zoneOf(L);
  st.cfg = { kind: 'land' }; st.units = []; st.ups = {}; st.lux = 0; st.offers = [];
  bump(st);
  sentiment(L.dist, -4, 'demolish', L);
  return { ok: true, cost: total };
}
function startBuild(L, q, useLoan) {
  const st = lotState(L.id);
  if (kindOf(L) !== 'land') return { ok: false, reason: 'Demolish the old building first.' };
  const deposit = useLoan ? q.cost * 0.4 : q.cost;
  if (G.cash < deposit / q.months * 2 && !useLoan) return { ok: false, reason: 'You need cash for at least the first two months of building.' };
  if (useLoan && G.cash < q.cost * 0.1) return { ok: false, reason: 'A construction loan still needs 10% of the cost in cash up front.' };
  st.build = { kind: q.kind, floors: q.floors, lux: q.lux, look: q.look, left: q.months, total: q.months, cost: q.cost, paid: 0, loan: !!useLoan };
  if (useLoan) {
    const lender = LENDERS[0];
    st.loan = { lender: lender.id, bal: (st.loan ? st.loan.bal : 0), rate: lenderRate(lender) + 0.01, term: 360, pay: 0, orig: 0, con: true };
  }
  bump(st);
  const dens = q.units > 6 ? 3 : q.units > 1 ? 1.5 : 0.5;
  sentiment(L.dist, -dens * (hasDeg('phd') ? 0.6 : 1), 'build', L);
  return { ok: true };
}
function progressBuild(L, st, notes) {
  const b = st.build;
  const inst = b.cost / b.total;
  if (b.loan) { const fromLoan = inst * 0.6; st.loan.bal += fromLoan; G.cash -= inst - fromLoan; }
  else G.cash -= inst;
  b.paid += inst;
  b.left--;
  bump(st);
  if (b.left <= 0) {
    st.cfg = { kind: b.kind, floors: b.floors, look: b.look };
    st.lux = b.lux; st.ups = {}; st.cond = 1; st.built = true; st.cost += b.cost;
    st.build = null;
    if (st.loan && st.loan.con) { st.loan.con = false; st.loan.pay = loanPayment(st.loan.bal, st.loan.rate, 360); st.loan.orig = st.loan.bal; if (st.loan.bal < 1) st.loan = null; }
    bump(st);
    st.units = Array.from({ length: unitCount(eff(L), st) }, () => ({ v: 0 }));
    G.stats.built++;
    addXP(80);
    notes.push({ kind: 'build', title: 'Construction complete!', text: `${KINDS[b.kind].name} at ${L.addr} is finished and ready for tenants.`, lot: L.id, good: true });
    Bus.emit('built', L);
  }
}

// ───────── district demand, sentiment, events ─────────
function sentiment(distId, delta, why, L) {
  const ds = G.dist[distId];
  ds.sent = clamp(ds.sent + delta * (delta > 0 && hasSkill('soc2') ? 1.5 : 1), 0, 100);
  if (why) neighbourSays(distId, why, L);
}
function districtEvent(notes) {
  const d = pick(rnd, DISTRICTS);
  const pool = DISTRICT_EVENTS.concat(SPECIAL_EVENTS[d.id] || [], SPECIAL_EVENTS[d.id] || []);
  const ev = pick(rnd, pool);
  const ds = G.dist[d.id];
  ds.idx *= 1 + ev.fx; ds.trend += ev.fx * 0.35;
  ds.dem[ev.seg] = clamp(ds.dem[ev.seg] * (1 + ev.dem), 0.45, 1.8);
  ds.dt[ev.seg] += ev.dem * 0.3;
  const text = ev.text.replace('{d}', d.name);
  ds.ev.unshift({ m: G.month, t: text, fx: ev.fx });
  if (ds.ev.length > 8) ds.ev.length = 8;
  notes.push({ kind: 'news', title: ev.fx > 0 ? 'Market boost' : 'Market slump', text: text + ` (${signPct(ev.fx, 0)}).`, good: ev.fx > 0, dist: d.id });
  for (const s of STOCKS) if (s.link === d.id) G.stk[s.id].p *= 1 + ev.fx * 2.5;
}
function districtTrend(id) {
  const d = DISTRICT_BY_ID[id], ds = G.dist[id];
  return G.market.g + (d.growth - 0.045) + ds.trend;
}

// ───────── XP & levels ─────────
function levelFor(xp) { return Math.floor(Math.sqrt(xp / 60)) + 1; }
function xpForLevel(l) { return 60 * (l - 1) * (l - 1); }
function addXP(n) {
  G.xp += n;
  const l = levelFor(G.xp);
  while (G.lvl < l) { G.lvl++; G.sp++; Bus.emit('level', G.lvl); }
}

// ───────── the monthly tick ─────────
function advanceMonth() {
  G.month++;
  const m = G.market;
  const notes = [];
  if (rnd() < 0.11) {
    const dir = (0.05 - m.rate) * 8 + rgauss() * 0.9 > 0 ? 1 : -1;
    m.rate = clamp(Math.round((m.rate + dir * 0.0025) * 10000) / 10000, 0.02, 0.09);
    notes.push({ kind: 'news', title: dir > 0 ? 'Interest rates rise' : 'Interest rates cut', text: `The Centropolis Reserve sets the cash rate to ${fmtPct(m.rate, 2)}.` });
  }
  m.g = 0.045 + 0.045 * Math.sin((G.month / 84) * TAU + m.phase) - (m.rate - 0.05) * 1.3;
  m.idx *= 1 + m.g / 12 + rgauss() * 0.004;
  const seasonal = Math.cos(((G.month % 12) / 12) * TAU); // winter peak (Jun–Aug is winter here) → alpine hospitality
  for (const d of DISTRICTS) {
    const ds = G.dist[d.id];
    ds.trend *= 0.95;
    ds.idx *= 1 + (d.growth - 0.045) / 12 + ds.trend / 12 + rgauss() * d.vol;
    for (const seg in ds.dem) {
      ds.dt[seg] *= 0.9;
      let target = d.dem[seg];
      if (d.id === 'alpine' && seg === 'hosp') target *= 1 - 0.18 * seasonal;
      if (d.id === 'coral' && seg === 'hosp') target *= 1 + 0.15 * seasonal;
      ds.dem[seg] = clamp(ds.dem[seg] + (target - ds.dem[seg]) * 0.06 + ds.dt[seg] * 0.05 + rgauss() * 0.012, 0.45, 1.8);
    }
    ds.sent += (60 - ds.sent) * 0.02 + (hasStaff('pr') ? 0.5 * staffPower('pr') : 0) + (hasSkill('soc3') ? 0.2 : 0);
    ds.sent = clamp(ds.sent, 0, 100);
  }
  if (rnd() < 0.16) districtEvent(notes);
  if (hasStaff('analyst') && rnd() < 0.5) {
    const worst = DISTRICTS.slice().sort((a, b) => districtTrend(a.id) - districtTrend(b.id))[0];
    if (districtTrend(worst.id) < -0.02) notes.push({ kind: 'news', title: 'Analyst warning', text: `${STAFF_BY_ID.analyst.name} expects prices in ${worst.name} to slide (${signPct(districtTrend(worst.id), 1)} a year).` });
  }

  // ── properties ──
  let rent = 0, mort = 0, interestPaid = 0, ins = 0, maint = 0, repD = 0;
  const pops = [];
  const staffVal = {};
  const addVal = (id, v) => { if (hasStaff(id)) staffVal[id] = (staffVal[id] || 0) + v; };
  for (const L of CITY.lots) {
    const st = G.lots[L.id];
    if (!st || !st.o) continue;
    if (st.build) { progressBuild(L, st, notes); continue; }
    const E = eff(L), K = KINDS[E.kind], seg = segOf(E.kind);
    let propRent = 0;
    const isCom = seg !== 'res';
    st.offers = (st.offers || []).filter((o) => o.exp > G.month);
    for (let i = 0; i < st.units.length; i++) {
      const u = st.units[i];
      if (!u || u.home) continue;
      if (u.r) {
        if (u.f > 0) u.f--; else propRent += u.r;
        u.l--;
        if (u.e && (G.month - u.s) % 12 === 0 && G.month > u.s) u.r = Math.round(u.r * (1 + u.e));
        if (u.cr && rnd() < { A: 0.0008, B: 0.003, C: 0.011 }[u.cr]) {
          st.units[i] = { v: 0 };
          notes.push({ kind: 'disaster', title: 'Tenant went bust', text: `${u.n} defaulted on their lease at ${L.addr}.`, lot: L.id });
          repD -= 0.3;
          continue;
        }
        if (u.l <= 0) {
          const pr = renewProb(L, st);
          if (rnd() < pr) {
            const nu = isCom ? Object.assign({}, u, { l: (u.y || 3) * 12, r: Math.round(Math.max(u.r, unitRent(L, st) * st.rm)), s: G.month, f: 0 }) : Object.assign(makeTenant(L, st), { n: u.n });
            st.units[i] = nu;
            addVal('pm', u.r * 2 * (0.1 / Math.max(0.3, pr)));
          } else {
            st.units[i] = { v: 0 };
            if (st.rm > 1.15) repD -= 0.5;
            if (st.units.length <= 4) notes.push({ kind: 'lease', title: 'Tenant moved out', text: `${u.n} left ${L.addr}. Your agent is looking for someone new.`, lot: L.id });
          }
        }
      } else {
        u.v = (u.v || 0) + 1;
        const p = fillProb(L, st);
        if (isCom) {
          if (rnd() < p && st.offers.length < 3) {
            const o = makeOffer(L, st);
            st.offers.push(o);
            if (st.auto) {
              const best = st.offers.map((x, k) => [k, offerScore(x)]).sort((a, b) => b[1] - a[1])[0][0];
              const ob = st.offers[best];
              acceptOffer(L, best);
              notes.push({ kind: 'lease', title: 'Lease signed', text: `${ob.n} signed a ${ob.y}-year lease at ${L.addr} (${fmt$(ob.r)}/mo).`, lot: L.id, good: true });
              addVal('leasing', ob.r * 6 * 0.4);
              addVal('pm', ob.r * 2 * 0.2);
            } else notes.push({ kind: 'lease', title: 'Lease offer', text: `${o.n} wants to lease space at ${L.addr}. Review it in the property.`, lot: L.id, good: true });
          }
        } else if (rnd() < p) {
          st.units[i] = makeTenant(L, st);
          repD += 0.4;
          addVal('pm', st.units[i].r * 2 * 0.23);
          if (st.units.length <= 4) notes.push({ kind: 'lease', title: 'New tenant', text: `${st.units[i].n} moved into ${L.addr} at ${fmt$(st.units[i].r)}/mo.`, lot: L.id, good: true });
        } else if (u.v > 3) repD -= 0.15;
        if (u.v > 6 && i === 0 && G.month % 6 === 0) sentiment(L.dist, -0.5, 'vacant', L);
      }
    }
    if (propRent > 0) pops.push([L.id, propRent]);
    rent += propRent;
    const occupied = st.units.some((u) => u && u.r);
    let decay = occupied ? 0.0075 : 0.004;
    if (hasStaff('handy')) { const s = 0.4 * staffPower('handy'); addVal('handy', decay * s * lotValue(L, st) * 0.26); decay *= 1 - s; }
    if (hasSkill('land2')) decay *= 0.7;
    st.cond = Math.max(0.1, st.cond - decay);
    if (st.cond < 0.4) repD -= 0.4; else if (occupied && st.cond > 0.7 && st.rm <= 1.05) repD += 0.1;
    const c = holdCosts(L, st);
    if (hasStaff('handy')) addVal('handy', c.maint / (1 - 0.25 * staffPower('handy')) * 0.25 * staffPower('handy'));
    ins += c.ins; maint += c.maint;
    if (st.loan) {
      const lo = st.loan, lender = LENDER_BY_ID[lo.lender];
      if (lo.con) { const it = lo.bal * lo.rate / 12; mort += it; interestPaid += it; }
      else {
        const newRate = lenderRate(lender);
        if (Math.abs(newRate - lo.rate) > 1e-6) { lo.rate = newRate; lo.pay = loanPayment(lo.bal, lo.rate, lo.term); }
        const interest = lo.bal * lo.rate / 12;
        const pay = Math.min(lo.pay, lo.bal + interest);
        lo.bal = Math.max(0, lo.bal + interest - pay);
        lo.term--;
        mort += pay; interestPaid += interest;
        if (lo.bal < 1 || lo.term <= 0) { st.loan = null; notes.push({ kind: 'loan', title: 'Loan paid off', text: `${L.addr} is now debt-free.`, good: true }); }
      }
    }
    // partners share the monthly profit (or chip in for losses)
    if (st.partners && st.partners.length) {
      const flow = propRent - c.ins - c.maint - (st.loan && !st.loan.con ? st.loan.pay : 0);
      for (const p of st.partners) {
        const amt = flow * p.share;
        G.cash -= amt;
        const inv = G.inv[p.id];
        inv.paid += amt;
        inv.trust = clamp(inv.trust + (amt > 0 ? 0.25 : -0.3) * (hasSkill('inv2') ? 1.5 : 1) * (1 + buffs().investor / 100), 0, 100);
      }
    }
    maybeIssue(L, st);
  }

  // ── business costs ──
  let salaries = 0;
  for (const id in G.staff) {
    const S = STAFF_BY_ID[id], s = G.staff[id];
    const sal = S.salary * (hasDeg('mba') ? 0.85 : 1);
    salaries += sal;
    s.val = (s.val || []).concat([Math.round(staffVal[id] || 0)]).slice(-12);
    s.morale = clamp(s.morale - 0.8, 10, 100);
  }
  let plInt = 0;
  for (const pl of G.ploans) {
    const it = pl.bal * pl.rate / 12; plInt += it;
    pl.left--;
    if (pl.left <= 0) {
      G.cash -= pl.bal;
      notes.push({ kind: 'loan', title: 'Private loan repaid', text: `You repaid ${fmt$(pl.bal)} to ${INVESTOR_BY_ID[pl.inv].name}.` });
      G.inv[pl.inv].trust = clamp(G.inv[pl.inv].trust + 8, 0, 100);
      pl.bal = 0;
    }
  }
  G.ploans = G.ploans.filter((p) => p.bal > 0);
  const assetFlow = tickAssets(notes);
  const divs = tickStocks();
  const taxable = rent - interestPaid - maint - ins - salaries - plInt;
  const taxRate = hasStaff('acct') ? INCOME_TAX - 0.08 * staffPower('acct') : INCOME_TAX;
  const tax = Math.max(0, taxable) * taxRate;
  if (hasStaff('acct')) addVal('acct', Math.max(0, taxable) * (INCOME_TAX - taxRate));
  for (const id in G.staff) { const s = G.staff[id]; s.val[s.val.length - 1] = Math.round(staffVal[id] || 0); }

  G.cash += rent - mort - ins - maint - salaries - plInt - tax + assetFlow + divs;
  G.stats.rent += rent;
  const interest = G.cash > 0 ? G.cash * 0.015 / 12 : G.cash * 0.12 / 12;
  G.cash += interest;
  if (G.cash < 0) {
    G.neg++; repD -= 2;
    if (G.neg >= 3) { liquidate(notes); G.neg = 0; }
    else notes.push({ kind: 'disaster', title: 'Account overdrawn', text: `You’re ${fmt$(-G.cash)} in the red. After 3 months the bank will start selling your things.` });
  } else G.neg = 0;
  repD += buffs().rep * 0.1 + (hasSkill('soc3') ? 1 : 0);
  G.rep = clamp(Math.round((G.rep * 0.985 + clamp(repD, -6, 3.5)) * 10) / 10, -100, 100);

  tickBusiness(notes);
  refreshListings();
  for (const r of G.rivals) {
    const def = RIVALS.find((x) => x.id === r.id);
    r.worth *= Math.exp(def.drift + m.g / 24 + rgauss() * def.vol);
  }
  addXP(3);
  record();
  checkAchievements();
  const month = { rent, mort, ins, maint, tax, salaries, interest, notes, pops, assetFlow, divs };
  Bus.emit('month', month);
  return month;
}

// The bank's order: shares, toys, staff, investment properties, then your home.
function liquidate(notes) {
  const sold = [];
  for (const id in G.stk) if (G.stk[id].q > 0) { trade(id, -G.stk[id].q); if (!sold.includes('your shares')) sold.push('your shares'); }
  while (G.cash < 0 && G.assets.length) { const a = G.assets[0]; sellAsset(a.uid); sold.push(ASSET_BY_ID[a.id].name); }
  if (G.cash < 0 && Object.keys(G.staff).length) { G.staff = {}; sold.push('your staff (let go)'); }
  if (G.cash < 0) {
    const mine = owned().filter((L) => G.home !== L.id && !lotState(L.id).build).sort((a, b) => (lotState(b.id).loan?.bal || 0) - (lotState(a.id).loan?.bal || 0));
    const L = mine[0] || owned().find((x) => G.home === x.id) || owned()[0];
    if (L) { sell(L, true); sold.push(L.addr); }
  }
  if (sold.length) notes.push({ kind: 'disaster', title: 'The bank stepped in', text: `Overdrawn for 3 months, so the bank sold ${sold.slice(0, 3).join(', ')}${sold.length > 3 ? ' and more' : ''}.` });
  if (G.cash < 0 && !owned().length && !G.assets.length) { G.bankrupt = true; Bus.emit('bankrupt'); }
}

function record() {
  const t = totals();
  const h = G.hist;
  h.m.push(G.month); h.cash.push(Math.round(G.cash)); h.net.push(Math.round(t.net)); h.loans.push(Math.round(t.loans + t.pl)); h.props.push(t.props); h.rep.push(G.rep);
  for (const d of DISTRICTS) {
    const ds = G.dist[d.id], dh = G.dh[d.id];
    dh.idx.push(Math.round(ds.idx * d.mult * G.market.idx * 1000) / 1000);
    const dem = ds.dem;
    dh.dem.push([dem.res, dem.com, dem.ind, dem.agri, dem.hosp].map((x) => Math.round(x * 100) / 100));
    dh.sent.push(Math.round(ds.sent));
  }
  if (h.m.length > 240) {
    const keep = (_, i) => i % 2 === 0 || i === h.m.length - 1;
    for (const k in h) h[k] = h[k].filter(keep);
    for (const id in G.dh) for (const k in G.dh[id]) G.dh[id][k] = G.dh[id][k].filter(keep);
  }
}

function statSummary() {
  const t = totals();
  return {
    props: t.props, res: t.res, com: t.com, loans: owned().filter((L) => lotState(L.id).loan).length,
    net: t.net, rep: G.rep, renovations: G.stats.renovations, profitSales: G.stats.profitSales,
    boughtRes: G.stats.boughtRes, boughtCom: G.stats.boughtCom, loansTaken: G.stats.loansTaken,
    waterfront: t.wf, towers: t.towers, vacant: t.vacant, districts: t.districts, months: G.month, tenants: t.tenants,
    upgrades: G.stats.upgrades, built: G.stats.built, rezoned: G.stats.rezoned, coinvests: G.stats.coinvests, parties: G.stats.parties,
    staff: Object.keys(G.staff).length, degrees: Object.keys(G.degrees).length,
    boats: G.assets.filter((a) => ASSET_BY_ID[a.id].cat === 'Boats').length, stockGain: G.stats.stockGain, home: G.home != null,
  };
}
function checkAchievements() {
  const s = statSummary();
  for (const a of ACHIEVEMENTS) {
    if (G.ach[a.id] != null) continue;
    if (a.test(s)) { G.ach[a.id] = G.month; addXP(40); Bus.emit('achievement', a); }
  }
}
function dateLabel(month = G.month) { return { mon: MONTHS[month % 12], year: START_YEAR + Math.floor(month / 12) }; }
