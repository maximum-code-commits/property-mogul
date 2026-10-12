'use strict';
// ───────────────────────── life: age, heritage, prestige, holiday lets, family, clubs ─────────────────────────

// ── building age, build quality and heritage ──
function curYear() { return START_YEAR + Math.floor(G.month / 12); }
function builtYear(L, st = G.lots[L.id]) { return st && st.o && st.yb ? st.yb : L.built || 2000; }
function ageOf(L, st = G.lots[L.id]) { return Math.max(0, curYear() - builtYear(L, st)); }
function qualityOf(L, st = G.lots[L.id]) { return st && st.o && st.bq != null ? st.bq : (L.q ?? 0.6); }
function qualityLabel(q) { return q >= 0.85 ? 'Exceptional' : q >= 0.68 ? 'Solid' : q >= 0.5 ? 'Average' : 'Shoddy'; }
function staticHistoric(L) { return isBuilding(L.kind) && START_YEAR + Math.floor((G ? G.month : 0) / 12) - (L.built || 2000) >= 75 && (L.q ?? 0) >= 0.68; }
function isHistoric(L, st = G.lots[L.id]) { return st && st.o ? !!st.historic : staticHistoric(L); }
// older buildings wear faster; well-built ones resist it, and heritage-listed ones are cared for
function decayMult(L, st) {
  const age = ageOf(L, st), q = qualityOf(L, st);
  let m = (1 + Math.min(age, st.historic ? 60 : 200) / 55) * (1.25 - q * 0.5) / 1.6;
  if (st.historic) m *= 0.6;
  return m;
}
function checkHeritage(L, st, notes) {
  if (st.historic || st.build || !isBuilding(kindOf(L))) return;
  if (ageOf(L, st) >= 75 && qualityOf(L, st) >= 0.68 && st.cond >= 0.55) {
    st.historic = true; bump(st);
    notes.push({ kind: 'ach', title: 'Heritage listed!', text: `${L.addr}, built in ${builtYear(L, st)}, is now a protected historic building.`, lot: L.id, good: true });
  }
}

// ── prestige ──
function prestigeOf(L, st = G.lots[L.id]) {
  const E = eff(L), K = KINDS[E.kind];
  if (!K.yield) return 0;
  const own = !!(st && st.o);
  let p = luxOf(E, st) * 9 + (DISTRICT_BY_ID[L.dist].mult - 0.6) * 14 + (L.water ? 8 : 0) + (isHistoric(L, st) ? 15 : 0) + (K.pool ? 4 : 0);
  p += ((own ? st.cond : 0.85) - 0.6) * 15;
  if (own) for (const k in st.ups) if (st.ups[k] && UPGRADES[k]) p += UPGRADES[k].pres || 0;
  return Math.max(0, Math.round(p));
}
function prestigeTier(p) { let t = PRESTIGE[0]; for (const x of PRESTIGE) if (p >= x.min) t = x; return t; }
function nextTier(p) { return PRESTIGE.find((x) => x.min > p) || null; }

// ── rare upgrades rotate every three months, two per region style ──
function rareStock(style) {
  const ids = Object.keys(UPGRADES).filter((k) => UPGRADES[k].rare && UPGRADES[k].style === style);
  const slot = Math.floor(G.month / 3);
  const si = Object.keys(RARE_STYLE).indexOf(style);
  ids.sort((a, b) => hash2(slot, si * 31 + a.length * 7 + a.charCodeAt(0), G.seed) - hash2(slot, si * 31 + b.length * 7 + b.charCodeAt(0), G.seed));
  return { ids: ids.slice(0, 2), leaves: 3 - (G.month % 3) };
}

// ── holiday lets ──
function seasonOf(L) {
  const s = DISTRICT_BY_ID[L.dist].style, c = Math.cos(((G.month % 12) / 12) * TAU);
  return s === 'snow' ? 1 - 0.38 * c : s === 'beach' ? 1 + 0.3 * c : s === 'lake' ? 1 + 0.2 * c : 1 + 0.06 * c;
}
function canStay(L, st) {
  const E = eff(L);
  return KINDS[E.kind].cat === 'res' && unitCount(E, null) <= 2 && !st.build && G.home !== L.id && !!prestigeTier(prestigeOf(L, st)).str;
}
function stayQuote(L, st) {
  const tier = prestigeTier(prestigeOf(L, st));
  const T = STR_TIER[tier.name] || STR_TIER.Desirable;
  const st2 = Object.assign({}, st, { mode: 'lease' });
  const nightly = marketRent(L, st2) / 30 * T.rate;
  const rating = st.stay ? st.stay.rating : 4.5;
  const occ = clamp(T.occ * Math.pow(G.dist[L.dist].dem.hosp, 0.6) * seasonOf(L) * (rating / 4.6), 0.05, 0.97);
  const gross = nightly * 7 * 4.3 * occ;
  return { tier, nightly, occ, weeks: 4.3 * occ, gross, net: gross * 0.8 };
}
function setStay(L, on) {
  const st = lotState(L.id);
  if (on) {
    if (!canStay(L, st)) return { ok: false, reason: 'Holiday lets need Desirable prestige or better, on a house you don’t live in.' };
    const comp = st.units.filter((u) => u && u.r && !u.stay).reduce((s, u) => s + u.r * 2, 0);
    if (comp > G.cash) return { ok: false, reason: `Ending the current lease early costs ${fmt$(comp)}.` };
    G.cash -= comp;
    st.mode = 'stay';
    st.stay = st.stay || { rating: 4.5, reviews: 0, last: null };
    st.units = st.units.map(() => ({ stay: 1 }));
  } else {
    st.mode = 'lease';
    st.units = st.units.map(() => ({ v: 0 }));
  }
  bump(st);
  checkAchievements();
  return { ok: true };
}
function tickStay(L, st) {
  const q = stayQuote(L, st);
  const weeks = clamp(Math.round(q.weeks + (rnd() - 0.5) * 1.6), 0, 4);
  const guests = Array.from({ length: weeks }, () => pick(rnd, FIRST) + ' ' + pick(rnd, LAST));
  const gross = q.nightly * 7 * weeks, net = gross * 0.8;
  const ti = PRESTIGE.indexOf(q.tier);
  const target = 3.1 + st.cond * 1.3 + ti * 0.12;
  st.stay.rating = clamp(st.stay.rating + (target - st.stay.rating) * 0.25 + rgauss() * 0.08, 1, 5);
  st.stay.reviews += weeks;
  st.stay.last = { weeks, gross, net, guests, nightly: q.nightly };
  st.units = st.units.map(() => ({ stay: 1, r: Math.round(net / st.units.length) }));
  return net;
}

// ── auto-renovation ──
function autoRenovate(notes) {
  const cfg = G.autoReno;
  let n = 0, spent = 0;
  for (const L of owned()) {
    const st = lotState(L.id);
    const on = st.autoReno != null ? st.autoReno : cfg.on;
    if (!on || st.build || !KINDS[kindOf(L)].yield || st.cond >= cfg.at) continue;
    const c = renovateCost(L, st);
    if (G.cash - c < cfg.buffer) continue;
    if (renovate(L).ok) { n++; spent += c; }
  }
  if (n) notes.push({ kind: 'lease', title: 'Auto-renovation', text: `Renovated ${n} propert${n > 1 ? 'ies' : 'y'} for ${fmt$(spent)}.`, good: true });
}

// ── family and succession ──
function initFamily() {
  const r = mulberry32((G.seed ^ 0x5bd1) >>> 0);
  const parts = String(G.mogul || 'Max').trim().split(/\s+/);
  const first = parts[0] || 'Max', sur = parts.length > 1 ? parts[parts.length - 1] : pick(r, LAST);
  G.fam = { name: sur, gen: 1, head: 1, next: 2, members: [{ id: 1, first, born: G.month - 12 * (27 + Math.floor(r() * 7)), role: 'self', gen: 1, alive: true, trait: pick(r, TRAITS).id, seed: (r() * 1e6) | 0 }] };
  G.lineage = [];
}
const famHead = () => G.fam.members.find((m) => m.id === G.fam.head);
const ageAt = (m) => Math.floor(((m.died ?? G.month) - m.born) / 12);
const headTrait = (id) => !!(G && G.fam && famHead() && famHead().trait === id);
function spouseOf(m) { return G.fam.members.find((x) => x.alive && x.role === 'spouse' && x.of === m.id); }
function heirsOf(m) {
  const sp = spouseOf(m);
  const kids = G.fam.members.filter((x) => x.alive && x.parent === m.id && ageAt(x) >= 18);
  const sibs = G.fam.members.filter((x) => x.alive && x.id !== m.id && x.role === 'child' && x.parent !== m.id && ageAt(x) >= 18);
  return kids.concat(sp ? [sp] : [], sibs);
}
function addMember(o) {
  const r = mulberry32((G.seed + G.fam.next * 977) >>> 0);
  const m = Object.assign({ id: G.fam.next++, first: pick(r, FIRST), alive: true, trait: pick(r, TRAITS).id, seed: (r() * 1e6) | 0 }, o);
  G.fam.members.push(m);
  return m;
}
function tickFamily(notes) {
  const h = famHead();
  const age = ageAt(h), sp = spouseOf(h);
  if (!sp && age >= 23 && age <= 55 && rnd() < 0.14 / 12 && !G.queue.some((d) => d.type === 'romance')) queueDecision({ type: 'romance', name: pick(rnd, FIRST) });
  const kids = G.fam.members.filter((m) => m.parent === h.id);
  if (sp && age <= 48 && kids.length < 4 && rnd() < 0.22 / 12) {
    const k = addMember({ born: G.month, role: 'child', parent: h.id, gen: h.gen + 1 });
    notes.push({ kind: 'ach', title: 'A new arrival!', text: `Welcome to the world, little ${k.first} ${G.fam.name}.`, good: true });
  }
  for (const m of G.fam.members) {
    if (!m.alive) continue;
    if (m.role === 'child' && G.month - m.born === 18 * 12) notes.push({ kind: 'news', title: `${m.first} turns 18`, text: `${m.first} ${G.fam.name} is grown up. Trait: ${TRAIT_BY_ID[m.trait].name}.`, good: true });
    if (m.role === 'child' && ageAt(m) < 30) continue;
    const a = ageAt(m);
    const pYear = 0.0004 * Math.exp(0.09 * (a - 30)) * (1 - Math.min(0.3, buffs().fun * 0.01));
    if (rnd() < pYear / 12) {
      m.alive = false; m.died = G.month;
      if (m.id === h.id) { if (!G.queue.some((d) => d.type === 'succession')) G.queue.unshift({ type: 'succession' }); Bus.emit('death', m); }
      else notes.push({ kind: 'disaster', title: 'A family loss', text: `${m.first} ${G.fam.name} passed away, aged ${a}.` });
    }
  }
}
function inherit(heirId) {
  const old = famHead();
  let heir = G.fam.members.find((m) => m.id === heirId && m.alive);
  if (!heir) heir = addMember({ born: G.month - 12 * (25 + Math.floor(rnd() * 15)), role: 'child', parent: -1, gen: old.gen, relation: 'nephew' });
  const t = totals();
  G.lineage.push({ first: old.first, born: old.born, died: old.died ?? G.month, net: Math.round(t.net), gen: old.gen, trait: old.trait });
  const tax = t.net > 2e6 && G.cash > 0 ? Math.round(G.cash * 0.1) : 0;
  G.cash -= tax;
  G.rep = Math.round(G.rep * 0.6 * 10) / 10;
  G.degrees = {}; G.school = null;
  heir.role = 'self';
  G.fam.head = heir.id;
  G.fam.gen = Math.max(G.fam.gen, heir.gen);
  G.mogul = `${heir.first} ${G.fam.name}`;
  if (ageAt(old) >= 80) G.stats.goodLife = (G.stats.goodLife || 0) + 1;
  G.queue = G.queue.filter((d) => d.type !== 'succession');
  checkAchievements();
  return { heir, tax };
}

// ── clubs ──
const CLUB_VEHICLES = { yacht: ['runabout', 'sail', 'yacht'], car: ['hatch', 'convert', 'classic', 'super'], ski: ['skis', 'balloon'], golf: [] };
function joinClub(id) {
  const C = CLUB_BY_ID[id];
  if (G.clubs[id]) return { ok: false };
  if (!C.test()) return { ok: false, reason: `Members need ${C.needs}.` };
  if (G.cash < C.fee) return { ok: false, reason: 'Not enough cash for the joining fee.' };
  G.cash -= C.fee;
  G.clubs[id] = { since: G.month, placed: G.assets.filter((a) => CLUB_VEHICLES[id].includes(a.id)).slice(0, 2).map((a) => a.uid), wins: 0, best: null, last: null };
  addXP(15);
  checkAchievements();
  return { ok: true };
}
function leaveClub(id) { delete G.clubs[id]; }
function togglePlaced(id, uid) {
  const c = G.clubs[id];
  if (!c) return;
  const i = c.placed.indexOf(uid);
  if (i >= 0) c.placed.splice(i, 1); else if (c.placed.length < 4) c.placed.push(uid);
}
function tickClubs(notes) {
  let dues = 0;
  for (const id in G.clubs) {
    const C = CLUB_BY_ID[id], c = G.clubs[id];
    c.placed = c.placed.filter((u) => G.assets.some((a) => a.uid === u));
    dues += C.dues;
    if (G.month % 3 !== 0 || G.month === c.since) continue;
    let score = 30 + rnd() * 45;
    for (const u of c.placed) { const a = G.assets.find((x) => x.uid === u); if (a) score += Math.log10(Math.max(1000, a.value)) * 4; }
    if (id === 'golf') score += G.rep / 4;
    if (id === 'ski') score += owned().filter((L) => L.dist === 'alpine').length * 4;
    const place = clamp(Math.round(9 - score / 12 + rnd() * 2), 1, 8);
    const prize = place === 1 ? C.fee * 0.8 : place === 2 ? C.fee * 0.4 : place === 3 ? C.fee * 0.2 : 0;
    G.cash += prize;
    if (place <= 3) { G.rep = clamp(G.rep + (4 - place), -100, 100); c.wins++; }
    c.best = c.best ? Math.min(c.best, place) : place;
    c.last = { m: G.month, place, prize };
    let met = null;
    if (place <= 3 && (id === 'yacht' || id === 'golf') && rnd() < 0.35) met = meetInvestor('club');
    notes.push({ kind: place <= 3 ? 'ach' : 'news', title: `${C.event}: ${['', '1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'][place]} place`, text: `${C.name}${prize ? ` · prize ${fmt$(prize)}` : ''}${met ? ` · you met ${met.name}` : ''}.`, good: place <= 3 });
  }
  return dues;
}

// ── co-op deals & player loans (money moves through the online ledger) ──
function friendPartnerPay(L, p, amt, kind) {
  if (!(amt > 0)) return;
  G.cash -= amt;
  G.outbox.push({ k: 'deal', deal: p.deal, user: p.fid, amount: Math.round(amt * 100) / 100, kind, lot: L.id });
}
function tickP2P(notes) {
  let paid = 0;
  for (const l of G.p2p) {
    if (l.role !== 'b' || l.bal <= 0) continue;
    const interest = l.bal * l.apy / 12;
    // interest-only loans pay the balance as a balloon in the final month
    const pay = l.left <= 1 ? l.bal + interest : l.type === 'io' ? interest : Math.min(l.pay, l.bal + interest);
    l.bal = Math.max(0, l.bal + interest - pay);
    l.left = Math.max(0, l.left - 1);
    G.cash -= pay; paid += pay;
    G.outbox.push({ k: 'loanpay', loan: l.id, amount: Math.round(pay * 100) / 100 });
    if (l.bal < 1) { l.bal = 0; notes.push({ kind: 'loan', title: 'Loan repaid', text: `You paid off your loan from ${l.who}.`, good: true }); }
  }
  G.p2p = G.p2p.filter((l) => !(l.role === 'b' && l.bal <= 0));
  return paid;
}
function repayP2PEarly(id) {
  const l = G.p2p.find((x) => x.role === 'b' && x.id === id);
  if (!l) return { ok: false, reason: 'Loan not found.' };
  const amt = Math.round(l.bal * (1 + l.apy / 12) * 100) / 100;
  if (G.cash < amt) return { ok: false, reason: `You need ${fmt$(amt)} in cash.` };
  G.cash -= amt;
  G.outbox.push({ k: 'loanpay', loan: l.id, amount: amt });
  G.p2p = G.p2p.filter((x) => x !== l);
  return { ok: true, amt };
}

// ── save migration ──
function migrate(g) {
  if (!g.fam) initFamily();
  g.autoReno = g.autoReno || { on: false, at: 0.5, buffer: 50000 };
  g.clubs = g.clubs || {};
  g.outbox = g.outbox || [];
  g.p2p = g.p2p || [];
  g.coop = g.coop || {};
  g.stakes = g.stakes || [];
  g.lineage = g.lineage || [];
  for (const k of ['coop', 'lent', 'goodLife']) g.stats[k] = g.stats[k] || 0;
  for (const id in g.lots) {
    const st = g.lots[id], L = CITY.lots[id];
    if (!L) { delete g.lots[id]; continue; }
    if (!st.o) { if (!isProperty(L.kind)) delete g.lots[id]; continue; }
    if (!isProperty(L.kind) && !st.cfg) {
      // the lot became a club venue in a newer city layout: the council bought it back
      g.cash += st.pp || 0;
      delete g.lots[id];
      continue;
    }
    if (st.mode == null) st.mode = 'lease';
    if (st.historic == null) st.historic = staticHistoric(L);
  }
  g.v = 4;
  return g;
}
