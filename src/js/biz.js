'use strict';
// ───────────────────────── business systems ─────────────────────────

// ── buffs from things you own ──
function buffs() {
  const b = { party: 0, investor: 0, rep: 0, fun: 0 };
  for (const a of G.assets || []) { const A = ASSET_BY_ID[a.id]; for (const k in A.buffs) b[k] += A.buffs[k]; }
  for (const id in G.clubs || {}) { const C = CLUB_BY_ID[id]; for (const k in C.buffs) b[k] += C.buffs[k]; }
  return b;
}

// ── neighbours ──
const NB_SAYS = {
  build: { mood: -1, t: ['Another construction site? The noise starts at 6am!', 'They’re building WHAT on our street?', 'Great, more traffic. Thanks a lot.', 'I liked the view the way it was.'] },
  demolish: { mood: -1, t: ['They knocked down a perfectly good building!', 'The dust is everywhere. Not happy.', 'That place had history. Shame.'] },
  vacant: { mood: -1, t: ['That empty place is becoming an eyesore.', 'Weeds taller than me at the vacant one down the road.'] },
  renovate: { mood: 1, t: ['Love the new paint job down the street!', 'That renovation lifted the whole block.', 'Finally someone fixed that place up.'] },
  party: { mood: 1, t: ['Best party on the street in years!', 'Free canapés AND a band? I’m a fan.', 'What a lovely evening. Thanks for having us!'] },
  noise: { mood: -1, t: ['The music went until 2am. Some of us work!', 'Who parks a jet ski on the lawn?!', 'Loud party again. Calling the council.'] },
  donate: { mood: 1, t: ['The new playground is wonderful. Thank you!', 'Our school library looks amazing now.', 'Maybe these property moguls aren’t so bad.'] },
  ignore: { mood: -1, t: ['The landlord never fixes anything.', 'Tenants next door say the place is falling apart.'] },
  rezone: { mood: -1, t: ['Rezoned? Nobody asked us!', 'High-rises next? Where does it end?'] },
  done: { mood: 1, t: ['The new building actually looks pretty nice.', 'New neighbours moving in! Welcome!', 'OK, I admit it. It’s an improvement.'] },
};
function neighbourSays(distId, why, L) {
  const def = NB_SAYS[why];
  if (!def) return;
  const who = (Math.random() * 1e6) | 0;
  const r = mulberry32(who);
  const name = pick(r, FIRST) + ' ' + pick(r, LAST).slice(0, 1) + '.';
  G.feed.unshift({ m: G.month, d: distId, who, name, t: pick(rnd, def.t), mood: def.mood, lot: L ? L.id : null });
  if (G.feed.length > 40) G.feed.length = 40;
  Bus.emit('feed', G.feed[0]);
}
const DONATIONS = [
  { id: 'fest', name: 'Sponsor a street festival', cost: 25000, sent: 5, rep: 1 },
  { id: 'park', name: 'Upgrade the local park', cost: 60000, sent: 10, rep: 2 },
  { id: 'school', name: 'Fund the school library', cost: 150000, sent: 18, rep: 4 },
  { id: 'clinic', name: 'Build a community clinic', cost: 600000, sent: 35, rep: 10 },
];
function donate(distId, id) {
  const D = DONATIONS.find((d) => d.id === id);
  if (G.cash < D.cost) return { ok: false, reason: 'Not enough cash.' };
  G.cash -= D.cost;
  sentiment(distId, D.sent, 'donate', null);
  G.rep = clamp(G.rep + D.rep * (hasSkill('soc2') ? 1.5 : 1), -100, 100);
  addXP(5 + D.rep * 3);
  return { ok: true };
}

// ── staff ──
function hire(id) { if (G.staff[id]) return; G.staff[id] = { since: G.month, morale: 70, val: [] }; addXP(5); checkAchievements(); }
function fire(id) { delete G.staff[id]; }
function staffValue12(id) { return (G.staff[id]?.val || []).reduce((s, x) => s + x, 0); }

// ── skills & school ──
function canLearn(id) {
  const s = SKILL_BY_ID[id];
  if (G.skills[id] || G.sp < 1) return false;
  return s.t === 1 || G.skills[s.b + (s.t - 1)];
}
function learn(id) { if (!canLearn(id)) return false; G.skills[id] = G.month; G.sp--; return true; }
function enroll(id) {
  const D = DEGREE_BY_ID[id];
  if (G.school || G.degrees[id] != null || G.cash < D.cost || (D.req && G.degrees[D.req] == null)) return false;
  G.cash -= D.cost; G.school = { id, left: Math.ceil(D.months * (headTrait('scholar') ? 0.75 : 1)) };
  return true;
}

// ── investors ──
function invCommitted(id) {
  let c = 0;
  for (const L of owned()) for (const p of lotState(L.id).partners || []) if (p.id === id) c += p.put || 0;
  for (const pl of G.ploans) if (pl.inv === id) c += pl.bal;
  return c;
}
function invAvailable(id) { return Math.max(0, INVESTOR_BY_ID[id].cap - invCommitted(id)); }
function coInvestMax(id, seg, total) {
  const X = INVESTOR_BY_ID[id], s = G.inv[id];
  if (!s.met || s.trust < 15 || !X.likes.includes(seg) || G.rep < X.minRep) return 0;
  let m = X.share * (s.trust >= 60 ? 1 : 0.7) * (hasSkill('inv2') ? 1.15 : 1);
  m = Math.min(m, 0.75, invAvailable(id) / total);
  return Math.floor(m * 20) / 20;
}
function privateLoanMax(id) {
  const s = G.inv[id];
  if (!s.met || s.trust < 25) return 0;
  return Math.floor(Math.min(invAvailable(id) * 0.5 * s.trust / 100, INVESTOR_BY_ID[id].cap * 0.3) / 10000) * 10000;
}
function privateLoanRate(id) { return Math.max(0.03, INVESTOR_BY_ID[id].rate - (hasSkill('inv3') ? 0.02 : 0) - (G.inv[id].trust > 70 ? 0.01 : 0)); }
function takePrivateLoan(id, amount, months) {
  if (amount > privateLoanMax(id) || amount <= 0) return false;
  G.ploans.push({ inv: id, bal: amount, rate: privateLoanRate(id), left: months, orig: amount });
  G.cash += amount;
  G.inv[id].deals++;
  return true;
}
function repayPrivate(i) {
  const pl = G.ploans[i];
  if (!pl || G.cash < pl.bal) return false;
  G.cash -= pl.bal;
  G.inv[pl.inv].trust = clamp(G.inv[pl.inv].trust + 5, 0, 100);
  G.ploans.splice(i, 1);
  return true;
}
function buyOutPartner(L, i) {
  const st = lotState(L.id), p = st.partners[i];
  const eq = Math.max(0, lotValue(L, st) - (st.loan ? st.loan.bal : 0));
  const price = Math.round(eq * p.share * 1.03);
  if (G.cash < price) return { ok: false, reason: 'Not enough cash for the buyout.' };
  G.cash -= price;
  if (p.fid) G.outbox.push({ k: 'deal', deal: p.deal, user: p.fid, amount: price, kind: 'buyout', lot: L.id });
  else {
    G.inv[p.id].paid += price - (p.put || 0);
    G.inv[p.id].trust = clamp(G.inv[p.id].trust + 6, 0, 100);
  }
  st.partners.splice(i, 1);
  return { ok: true, price };
}
function meetInvestor(why) {
  const pool = INVESTORS.filter((x) => !G.inv[x.id].met && G.rep >= x.minRep - 15);
  if (!pool.length) return null;
  pool.sort((a, b) => a.cap - b.cap);
  const X = pool[Math.floor(rnd() * Math.min(3, pool.length))];
  G.inv[X.id].met = true; G.inv[X.id].trust = 25 + (why === 'party' ? 10 : 0);
  return X;
}

// ── home & parties ──
function canLiveIn(L) { const k = KINDS[kindOf(L)]; return k.cat === 'res' && unitCount(eff(L), null) <= 2 && !lotState(L.id).build; }
function moveInCost(L) {
  const st = lotState(L.id);
  const u = st.units[0];
  return u && u.r ? u.r * 2 : 0;
}
function moveIn(L) {
  const st = lotState(L.id);
  const c = moveInCost(L);
  if (G.cash < c) return { ok: false, reason: 'Not enough cash to buy out the tenant’s lease.' };
  if (G.home != null) moveOut();
  G.cash -= c;
  st.units[0] = { home: 1 };
  G.home = L.id;
  addXP(10);
  checkAchievements();
  return { ok: true };
}
function moveOut() {
  const L = CITY.lots[G.home];
  const st = L && lotState(L.id);
  if (st && st.units[0] && st.units[0].home) st.units[0] = { v: 0 };
  G.home = null;
}
const PARTIES = [
  { id: 'bbq', name: 'Backyard BBQ', cost: 6000, base: 10, desc: 'Sausages, lawn games and a cooler of drinks.' },
  { id: 'cocktail', name: 'Cocktail Soirée', cost: 45000, base: 26, desc: 'Jazz trio, canapés and a signature cocktail.' },
  { id: 'gala', name: 'Black-Tie Gala', cost: 260000, base: 62, desc: 'Chandeliers, a string quartet and fireworks.' },
  { id: 'yacht', name: 'Yacht Party', cost: 80000, base: 55, req: 'yacht', desc: 'Sunset cruise around the harbour on your superyacht.' },
];
function venueScore() {
  if (G.home == null) return { score: 0.6, text: 'a hired function room' };
  const L = CITY.lots[G.home], st = lotState(L.id);
  const tags = tagsOf(L, st);
  let s = clamp(Math.pow(lotValue(L, st) / 400000, 0.3), 0.8, 2.2);
  if (tags.includes('pool')) s *= 1.15;
  if (L.water) s *= 1.15;
  s *= 1 + 0.08 * luxOf(eff(L), st);
  return { score: s, text: `your ${KINDS[kindOf(L)].name.toLowerCase()} at ${L.addr}` };
}
function partyReady() { return G.month - G.lastParty >= 2; }
function throwParty(pid, guests) {
  const P_ = PARTIES.find((p) => p.id === pid);
  const venue = venueScore();
  const cost = Math.round(P_.cost * (G.home == null ? 1.2 : 1));
  if (G.cash < cost) return { ok: false, reason: 'Not enough cash for this party.' };
  if (P_.req && !G.assets.some((a) => a.id === P_.req)) return { ok: false, reason: 'You need a superyacht for that.' };
  G.cash -= cost; G.lastParty = G.month; G.stats.parties++;
  const b = buffs();
  let score = P_.base * venue.score * (1 + b.party / 50) * (hasSkill('soc1') ? 1.25 : 1) * (headTrait('host') ? 1.2 : 1) * (0.8 + rnd() * 0.4);
  score = Math.round(score);
  const out = { score, lines: [], met: null, venue: venue.text, cost };
  const rep = Math.round(score / 12 * 10) / 10;
  G.rep = clamp(G.rep + rep, -100, 100);
  out.lines.push(`Reputation +${rep}`);
  if (guests.investors) {
    let n = 0;
    for (const x of INVESTORS) if (G.inv[x.id].met) { G.inv[x.id].trust = clamp(G.inv[x.id].trust + score / 5 * (1 + b.investor / 100), 0, 100); n++; }
    if (n) out.lines.push(`${n} investor${n > 1 ? 's' : ''} trust you more (+${Math.round(score / 5)})`);
    if (rnd() < Math.min(0.85, score / 80 + b.investor / 100)) { const X = meetInvestor('party'); if (X) { out.met = X; out.lines.push(`You met ${X.name}, ${X.title.toLowerCase()}!`); } }
  }
  if (guests.staff) {
    for (const id in G.staff) G.staff[id].morale = clamp(G.staff[id].morale + score / 2, 0, 100);
    if (Object.keys(G.staff).length) out.lines.push('Your staff are energised (morale up)');
  }
  const dist = G.home != null ? CITY.lots[G.home].dist : 'cbd';
  if (guests.neighbours) { sentiment(dist, score / 6, 'party', null); out.lines.push(`Neighbours in ${DISTRICT_BY_ID[dist].name} love you (+${Math.round(score / 6)} goodwill)`); }
  else if (G.home != null && score > 20) { sentiment(dist, -3, 'noise', null); out.lines.push('Uninvited neighbours complained about the noise'); }
  addXP(10 + score / 4);
  checkAchievements();
  out.ok = true;
  return out;
}

// ── assets ──
function assetPrice(id) { return Math.round(ASSET_BY_ID[id].price * (G.mkt[id] || 1) * Math.sqrt(G.market.idx) / 100) * 100; }
function buyAsset(id) {
  const p = assetPrice(id);
  if (G.cash < p) return false;
  G.cash -= p;
  G.assets.push({ uid: Date.now() + '' + ((Math.random() * 1e4) | 0), id, value: p, price: p, m: G.month });
  addXP(5);
  checkAchievements();
  return true;
}
function sellAsset(uid) {
  const i = G.assets.findIndex((a) => a.uid === uid);
  if (i < 0) return 0;
  const a = G.assets[i], got = Math.round(a.value * 0.9);
  G.cash += got; G.assets.splice(i, 1);
  return got;
}
function tickAssets(notes) {
  let flow = 0;
  for (const id in G.mkt) G.mkt[id] = clamp(G.mkt[id] * Math.exp(rgauss() * 0.03) * (1 + (1 - G.mkt[id]) * 0.1), 0.85, 1.2);
  for (const a of G.assets) {
    const A = ASSET_BY_ID[a.id];
    a.value *= Math.exp(A.drift / 12 + A.vol / Math.sqrt(12) * rgauss());
    flow -= a.value * A.upkeep / 12;
    if (A.income) flow += a.value * A.income / 12 * (0.7 + rnd() * 0.6);
    if (a.id === 'racehorse' && rnd() < 0.06) { const prize = Math.round(a.value * (0.2 + rnd() * 0.6)); flow += prize; notes.push({ kind: 'news', title: 'Lucky Deed wins!', text: `Your racehorse won ${fmt$(prize)} in prize money.`, good: true }); }
  }
  return flow;
}

// ── stocks ──
function tickStocks() {
  const mkt = rgauss();
  let divs = 0;
  for (const s of STOCKS) {
    const x = G.stk[s.id];
    let ret = s.drift / 12 + s.vol / Math.sqrt(12) * (0.5 * mkt + 0.87 * rgauss());
    if (s.link === 'rate') ret -= (G.market.rate - 0.05) * 0.05;
    if (s.link && s.link !== 'rate') ret += G.dist[s.link].trend * 0.08;
    x.p = Math.max(0.5, x.p * Math.exp(ret));
    x.h.push(Math.round(x.p * 100) / 100);
    if (x.h.length > 36) x.h.shift();
    if (G.month % 3 === 0 && x.q) divs += x.q * x.p * s.div / 4;
  }
  return divs;
}
function trade(id, qty) {
  const x = G.stk[id];
  if (qty > 0) {
    const cost = qty * x.p + 10;
    if (G.cash < cost) return false;
    G.cash -= cost; x.cost += qty * x.p; x.q += qty;
  } else {
    qty = Math.min(-qty, x.q);
    if (!qty) return false;
    const avg = x.cost / x.q;
    const got = qty * x.p - 10;
    G.cash += got; G.stats.stockGain += got - avg * qty;
    x.cost -= avg * qty; x.q -= qty;
    checkAchievements();
  }
  return true;
}

// ── council & rezoning ──
function councilChance(L, zone, o = {}) {
  const cur = zoneOf(L), d = DISTRICT_BY_ID[L.dist], ds = G.dist[L.dist];
  const jump = Math.max(0, ZONES[zone].tier - ZONES[cur].tier);
  let c = 0.62 - 0.14 * jump + (d.zones.includes(zone) ? 0.15 : -0.22);
  c += (ds.sent - 50) / 220 + G.rep / 450;
  if (hasSkill('dev1')) c += 0.1;
  if (hasDeg('law')) c += 0.15;
  if (hasDeg('phd')) c += 0.2;
  if (hasStaff('lawyer')) c += 0.12 * staffPower('lawyer');
  const v = Math.max(200000, lotValue(L));
  if (o.donation) c += Math.min(0.25, o.donation / (v * 0.06) * 0.25);
  if (o.afford) c += 0.12;
  if (o.lobby) c += 0.1;
  if (o.consult) c += (ds.sent - 50) / 200 + 0.03;
  return clamp(c, 0.03, 0.95);
}
function applyRezone(L, zone, o) {
  const fee = 15000 + (o.lobby ? 40000 : 0) + (o.donation || 0);
  if (G.cash < fee) return { ok: false, reason: 'Not enough cash for the application.' };
  if (G.council.some((c) => c.lot === L.id)) return { ok: false, reason: 'You already have an application in for this lot.' };
  G.cash -= fee;
  const chance = councilChance(L, zone, o);
  G.council.push({ lot: L.id, zone, left: 3 + (o.consult ? 2 : 0), chance, afford: !!o.afford, donation: o.donation || 0 });
  if (o.consult) sentiment(L.dist, 2, null);
  return { ok: true, chance };
}

// ── issues & situations (decisions) ──
function queueDecision(d) { if (G.queue.length < 6) G.queue.push(d); }
function maybeIssue(L, st) {
  let p = 0.012 * (1.6 - st.cond) * Math.min(3, 0.7 + st.units.length / 6);
  if (hasSkill('land3')) p *= 0.7;
  if (headTrait('lucky')) p *= 0.7;
  if (rnd() >= p) return;
  const k = kindOf(L), K = KINDS[k], style = DISTRICT_BY_ID[L.dist].style;
  const occ = st.units.some((u) => u && u.r);
  const opts = [['pipe', 3], ['roof', 2], ['storm', 1.2]];
  if (K.cat === 'res') opts.push(['mould', 2], ['dispute', occ ? 1.5 : 0], ['late', occ ? 2 : 0]);
  if (['house', 'cottage', 'cabin', 'chalet', 'duplex', 'townhouse'].includes(k)) opts.push(['termites', 1.2]);
  if ((eff(L).floors || 1) >= 4) opts.push(['lift', 2.5]);
  if (K.cat === 'ind') opts.push(['machinery', 2.5]);
  if (K.cat === 'agri') opts.push(['blight', 3]);
  if (style === 'snow') opts.push(['snow', 3]);
  if (!occ) opts.push(['squat', 1]);
  const type = weighted(rnd, opts.filter((o) => o[1] > 0));
  const v = lotValue(L, st);
  const d = { type, lot: L.id, cost: Math.round((v * { pipe: 0.006, roof: 0.014, storm: 0.04, mould: 0.007, termites: 0.012, lift: 0.006, machinery: 0.01, blight: 0.02, snow: 0.01, dispute: 0, late: 0, squat: 0 }[type] + 2000) / 100) * 100 };
  const minor = ['pipe', 'mould', 'dispute', 'squat'].includes(type);
  if (minor && hasStaff('pm')) { resolveDecision(d, 0, true); return; }
  queueDecision(d);
}
function vacateOne(st) { const i = st.units.findIndex((u) => u && u.r); if (i >= 0) { const n = st.units[i].n; st.units[i] = { v: 0 }; return n; } return null; }
const SITUATIONS = [
  { type: 'film', w: 1, ok: () => owned().length > 0 },
  { type: 'celebrity', w: 0.7, ok: () => owned().some((L) => KINDS[kindOf(L)].cat === 'res' && lotState(L.id).units.some((u) => u && !u.r && !u.home)) },
  { type: 'grant', w: 0.8, ok: () => owned().some((L) => upgradeAllowed(L, lotState(L.id), 'solar')) },
  { type: 'offmarket', w: 0.6, ok: () => true },
  { type: 'gala', w: 0.8, ok: () => G.month > 6 },
  { type: 'journalist', w: 0.7, ok: () => G.month > 4 },
  { type: 'tip', w: 0.8, ok: () => G.cash > 30000 },
  { type: 'tenantbuy', w: 0.6, ok: () => owned().some((L) => KINDS[kindOf(L)].cat === 'res' && unitCount(eff(L), null) === 1 && lotState(L.id).units[0]?.r && G.home !== L.id) },
  { type: 'exit', w: 0.5, ok: () => owned().some((L) => (lotState(L.id).partners || []).length) },
  { type: 'petition', w: 0.6, ok: () => owned().some((L) => lotState(L.id).build) },
  { type: 'intro', w: 0.6, ok: () => INVESTORS.some((x) => !G.inv[x.id].met && G.rep >= x.minRep - 15) },
  { type: 'school', w: 0.5, ok: () => G.month > 3 },
];
function rollSituation() {
  const pool = SITUATIONS.filter((s) => s.ok()).map((s) => [s, s.w * (s.type === 'offmarket' && hasSkill('dealer3') ? 3 : 1)]);
  if (!pool.length) return;
  const S = weighted(rnd, pool);
  const d = { type: S.type };
  const mine = owned();
  if (S.type === 'film') { const L = pick(rnd, mine); d.lot = L.id; d.cost = Math.round(Math.max(15000, lotValue(L) * 0.02) / 1000) * 1000; }
  if (S.type === 'celebrity') { const L = pick(rnd, mine.filter((L) => KINDS[kindOf(L)].cat === 'res' && lotState(L.id).units.some((u) => u && !u.r && !u.home))); d.lot = L.id; d.cost = Math.round(unitRent(L) * 1.8); }
  if (S.type === 'grant') { const L = pick(rnd, mine.filter((L) => upgradeAllowed(L, lotState(L.id), 'solar'))); d.lot = L.id; d.cost = Math.round(upgradeCost(L, lotState(L.id), 'solar') * 0.3); }
  if (S.type === 'offmarket') {
    const cand = CITY.lots.filter((L) => isBuilding(L.kind) && !G.lots[L.id] && lotValue(L) < Math.max(2e6, totals().net * 1.5));
    if (!cand.length) return;
    const L = pick(rnd, cand); d.lot = L.id; d.cost = Math.round(lotValue(L) * (0.85 + rnd() * 0.05) / 1000) * 1000;
  }
  if (S.type === 'tip') { d.stock = pick(rnd, STOCKS.filter((s) => s.id !== 'CTX')).id; d.good = rnd() < 0.55; }
  if (S.type === 'tenantbuy') { const L = pick(rnd, mine.filter((L) => KINDS[kindOf(L)].cat === 'res' && unitCount(eff(L), null) === 1 && lotState(L.id).units[0]?.r && G.home !== L.id)); d.lot = L.id; d.cost = Math.round(lotValue(L) * (1.04 + rnd() * 0.06) / 1000) * 1000; }
  if (S.type === 'exit') { const L = pick(rnd, mine.filter((L) => (lotState(L.id).partners || []).length)); d.lot = L.id; d.inv = lotState(L.id).partners[0].id; }
  if (S.type === 'petition') { const L = pick(rnd, mine.filter((L) => lotState(L.id).build)); d.lot = L.id; }
  if (S.type === 'intro') { const X = pick(rnd, INVESTORS.filter((x) => !G.inv[x.id].met && G.rep >= x.minRep - 15)); d.inv = X.id; }
  queueDecision(d);
}

// Decision cards: title, text, who is talking, and the choices.
// Each choice: { label, sub, fx: () => outcome text }
function decisionCard(d) {
  const L = d.lot != null ? CITY.lots[d.lot] : null, st = L ? lotState(L.id) : null;
  const free = ['offmarket', 'gala', 'journalist', 'tip', 'intro', 'school', 'romance'];
  if (d.type === 'succession') return null;
  if (!free.includes(d.type) && (!st || !st.o || st.build && d.type !== 'petition')) return null;
  if (d.type === 'offmarket' && st) return null;
  if (d.type === 'exit' && !(st.partners || []).some((p) => p.id === d.inv)) return null;
  if (d.type === 'celebrity' && !st.units.some((u) => u && !u.r && !u.home)) return null;
  if (d.type === 'tenantbuy' && !(st.units[0] && st.units[0].r)) return null;
  const addr = L ? L.addr : '';
  const c = d.cost || 0;
  const pay = (x) => { G.cash -= x; };
  const lawyer = hasStaff('lawyer') ? 0.4 : 1, lawDeg = hasDeg('law') ? 0.5 : 1;
  const cards = {
    hidden: () => ({ who: 'agent', title: 'Surprise in the walls', text: `You skipped the inspection at ${addr}, and the builder just found ${pick(rnd, ['termite damage', 'faulty wiring', 'a cracked slab', 'asbestos in the ceiling'])}. Fixing it will cost ${fmt$(c)}.`,
      choices: [{ label: `Fix it (${fmtShort(c)})`, fx: () => { pay(c); st.cond = Math.min(1, st.cond + 0.05); return 'Fixed. Lesson learned: always inspect.'; } },
        { label: 'Leave it for now', sub: 'Condition drops sharply', fx: () => { st.cond = Math.max(0.1, st.cond - 0.25); return 'The problem is still there, and the place feels it.'; } }] }),
    pipe: () => ({ who: 'tenant', title: 'Burst pipe!', text: `Water is pouring through the ceiling at ${addr}.`,
      choices: [{ label: `Call a plumber (${fmtShort(c)})`, fx: () => { pay(c); st.cond = Math.min(1, st.cond + 0.03); return 'Fixed properly. Tenants are relieved.'; } },
        { label: `Patch it (${fmtShort(c / 3)})`, sub: 'Might burst again', fx: () => { pay(c / 3); if (rnd() < 0.4) queueDecision({ type: 'pipe', lot: d.lot, cost: Math.round(c * 1.5) }); return 'Patched with tape and hope.'; } },
        { label: 'Ignore it', sub: 'Condition and reputation suffer', fx: () => { st.cond = Math.max(0.1, st.cond - 0.1); G.rep -= 2; const n = rnd() < 0.5 ? vacateOne(st) : null; sentiment(L.dist, -1, 'ignore', L); return n ? `${n} moved out in disgust.` : 'The tenants are not impressed.'; } }] }),
    roof: () => ({ who: 'tenant', title: 'The roof is leaking', text: `Buckets are catching rain inside ${addr}.`,
      choices: [{ label: `Replace the roof (${fmtShort(c)})`, fx: () => { pay(c); st.cond = Math.min(1, st.cond + 0.1); return 'Brand new roof. Value up, tenants happy.'; } },
        { label: `Patch it (${fmtShort(c * 0.3)})`, fx: () => { pay(c * 0.3); st.cond = Math.max(0.1, st.cond - 0.03); return 'It’ll hold. Probably.'; } },
        { label: 'Ignore it', sub: 'Condition −12%', fx: () => { st.cond = Math.max(0.1, st.cond - 0.12); G.rep -= 1; return 'The damp is spreading.'; } }] }),
    storm: () => {
      const covered = KINDS[kindOf(L)].strata || st.ins;
      return { who: 'agent', title: 'Storm damage', text: `A wild storm tore through ${DISTRICT_BY_ID[L.dist].name} and damaged ${addr}. Repairs: ${fmt$(c)}.${covered ? ' Good news: you’re insured.' : ' You’re not insured.'}`,
        choices: covered ? [{ label: 'Claim on insurance ($5,000 excess)', fx: () => { pay(5000); return 'The insurer paid for everything else.'; } }]
          : [{ label: `Pay for repairs (${fmtShort(c)})`, fx: () => { pay(c); return 'Repaired. Maybe get insurance?'; } },
            { label: 'Leave it damaged', sub: 'Condition −25%', fx: () => { st.cond = Math.max(0.1, st.cond - 0.25); G.rep -= 2; return 'The building looks battered.'; } }] };
    },
    mould: () => ({ who: 'tenant', title: 'Mould in the bathroom', text: `A tenant at ${addr} sent photos. It’s… fuzzy.`,
      choices: [{ label: `Professional removal (${fmtShort(c)})`, fx: () => { pay(c); G.rep += 1; return 'Spotless. The tenant sent a thank-you card.'; } },
        { label: `Bleach and a fan (${fmtShort(c / 5)})`, fx: () => { pay(c / 5); if (rnd() < 0.5) G.rep -= 1; return 'Good enough for now.'; } },
        { label: 'Ignore it', sub: 'Could end in a lawsuit', fx: () => { G.rep -= 3; if (rnd() < 0.3) queueDecision({ type: 'lawsuit', lot: d.lot, cost: Math.round(Math.max(20000, c * 6)) }); return 'The tenant is talking to a lawyer.'; } }] }),
    termites: () => ({ who: 'agent', title: 'Termites!', text: `An inspector found termites chewing through ${addr}.`,
      choices: [{ label: `Fumigate (${fmtShort(c)})`, fx: () => { pay(c); return 'Bugs gone.'; } },
        { label: 'Ignore it', sub: 'Condition −25%', fx: () => { st.cond = Math.max(0.1, st.cond - 0.25); return 'Munch, munch, munch.'; } }] }),
    lift: () => ({ who: 'tenant', title: 'The lift is broken', text: `Tenants on the top floors of ${addr} are taking the stairs and they’re furious.`,
      choices: [{ label: `Repair it now (${fmtShort(c)})`, fx: () => { pay(c); return 'Back in service. Elevator music restored.'; } },
        { label: 'Wait for parts', sub: 'Some tenants may leave', fx: () => { G.rep -= 3; const a = vacateOne(st), b = vacateOne(st); return `${[a, b].filter(Boolean).length} tenants moved out.`; } }] }),
    machinery: () => ({ who: 'tenant', title: 'Machinery breakdown', text: `The loading crane at ${addr} broke down. Your tenant wants it fixed.`,
      choices: [{ label: `Fix it (${fmtShort(c)})`, fx: () => { pay(c); return 'Running again.'; } },
        { label: 'Tell them to fix it', sub: 'They might leave', fx: () => { if (rnd() < 0.4) { vacateOne(st); return 'They packed up and left.'; } return 'They grumbled and paid for it.'; } }] }),
    blight: () => ({ who: 'tenant', title: 'Crop blight', text: `A fungus is spreading through the crops at ${addr}.`,
      choices: [{ label: `Spray and treat (${fmtShort(c)})`, fx: () => { pay(c); return 'Crops saved.'; } },
        { label: 'Let nature run its course', sub: 'Your farmer may walk', fx: () => { st.cond = Math.max(0.1, st.cond - 0.15); if (rnd() < 0.5) vacateOne(st); return 'A rough season.'; } }] }),
    snow: () => ({ who: 'agent', title: 'Heavy snow load', text: `A metre of snow is sitting on the roof at ${addr}.`,
      choices: [{ label: `Clear it (${fmtShort(c)})`, fx: () => { pay(c); return 'Shovelled and safe.'; } },
        { label: 'Hope it melts', sub: 'Condition −20%', fx: () => { st.cond = Math.max(0.1, st.cond - 0.2); return 'Creak… crack.'; } }] }),
    dispute: () => ({ who: 'tenant', title: 'Tenant feud', text: `Two tenants at ${addr} are fighting about noise. One left a passive-aggressive note.`,
      choices: [{ label: 'Mediate ($2,000)', fx: () => { pay(2000); G.rep += 1; return 'Hugs all round. Mostly.'; } },
        { label: 'Evict the troublemaker', fx: () => { const n = vacateOne(st); G.rep -= 1; return n ? `${n} has been asked to leave.` : 'Peace restored.'; } },
        { label: 'Stay out of it', fx: () => { G.rep -= 2; if (rnd() < 0.3) { vacateOne(st); vacateOne(st); return 'Both of them moved out.'; } return 'The notes are getting longer.'; } }] }),
    late: () => {
      const u = st.units.find((x) => x && x.r);
      const r = u ? u.r : 0;
      return { who: 'tenant', title: 'Rent is late', text: `${u ? u.n : 'A tenant'} at ${addr} lost their job and can’t pay this month.`,
        choices: [{ label: 'Offer a payment plan', sub: `Lose about ${fmtShort(r)}`, fx: () => { G.cash -= r; G.rep += 2; return 'They’re grateful and staying.'; } },
          { label: 'Waive one month', fx: () => { G.cash -= r; G.rep += 3; sentiment(L.dist, 1, null); return 'Word gets around that you’re a decent landlord.'; } },
          { label: 'Evict them ($3,000 legal)', fx: () => { pay(3000); vacateOne(st); G.rep -= 2; return 'The unit is empty again.'; } }] };
    },
    squat: () => ({ who: 'agent', title: 'Squatters', text: `Someone has moved into the empty ${addr} without asking.`,
      choices: [{ label: 'Call the police ($1,000)', fx: () => { pay(1000); return 'They’ve gone.'; } },
        { label: 'Ignore it', sub: 'Condition −15%', fx: () => { st.cond = Math.max(0.1, st.cond - 0.15); sentiment(L.dist, -2, 'vacant', L); return 'The neighbours are not amused.'; } }] }),
    lawsuit: () => ({ who: 'lawyer', title: 'You’re being sued', text: `A tenant from ${addr} is suing for ${fmt$(c)}.`,
      choices: [{ label: `Settle (${fmtShort(c * 0.6 * lawyer)})`, fx: () => { pay(c * 0.6 * lawyer); return 'Settled out of court.'; } },
        { label: 'Fight it in court', sub: `${hasStaff('lawyer') ? '70' : '45'}% chance to win`, fx: () => { const win = rnd() < (hasStaff('lawyer') ? 0.7 : 0.45); if (win) { pay(5000 * lawDeg); G.rep += 1; return 'You won! Legal fees were small.'; } pay(c * 1.3 * lawDeg); G.rep -= 3; return 'You lost, and paid damages and costs.'; } }] }),
    film: () => ({ who: 'agent', title: 'Lights, camera, action!', text: `A film studio wants to shoot a movie at ${addr} for two weeks and will pay ${fmt$(c)}.`,
      choices: [{ label: `Accept (${fmtShort(c)})`, sub: 'Tenants may be annoyed', fx: () => { G.cash += c; G.rep += 1; if (rnd() < 0.15) vacateOne(st); return 'It’s a wrap! Your building is famous now.'; } },
        { label: 'Decline', fx: () => 'Maybe next time, Hollywood.' }] }),
    celebrity: () => ({ who: 'agent', title: 'A celebrity wants to rent', text: `A famous pop star wants to rent a place at ${addr} for a year at ${fmt$(c)}/month. Fans will follow.`,
      choices: [{ label: 'Sign them up', sub: 'Reputation up, neighbours down', fx: () => { const i = st.units.findIndex((u) => u && !u.r && !u.home); if (i >= 0) st.units[i] = { n: 'A Very Famous Person', r: c, l: 12, s: G.month }; G.rep += 3; sentiment(L.dist, -2, 'noise', L); return 'Paparazzi are camped outside. Worth it.'; } },
        { label: 'Decline', fx: () => 'You kept things quiet.' }] }),
    grant: () => ({ who: 'mayor', title: 'Green building grant', text: `The city will pay 70% of solar panels for ${addr}. Your share: ${fmt$(c)}.`,
      choices: [{ label: `Accept (${fmtShort(c)})`, fx: () => { pay(c); st.ups.solar = 1; bump(st); G.stats.upgrades++; sentiment(L.dist, 2, null); return 'Panels installed. Upkeep down 15%.'; } },
        { label: 'No thanks', fx: () => 'The mayor shrugs.' }] }),
    offmarket: () => {
      const v = lotValue(L);
      return { who: 'agent', title: 'Off-market tip', text: `The owner of the ${KINDS[L.kind].name.toLowerCase()} at ${addr} needs a fast sale and will take ${fmt$(c)}. It’s worth about ${fmt$(v)}.`,
        choices: [{ label: 'Let’s look at it', fx: () => { G.lots[L.id] = { s: Object.assign(makeSeller(L, c, false), { res: 1, left: 2 }) }; Bus.emit('openLot', L.id); return null; } },
          { label: 'Pass', fx: () => 'Someone else snapped it up.' }] };
    },
    gala: () => ({ who: 'mayor', title: 'Charity gala invitation', text: 'The mayor’s charity gala is next week. Big donors get their name on a plaque.',
      choices: [{ label: 'Donate $50,000', sub: 'Reputation +4, goodwill everywhere', fx: () => { pay(50000); G.rep += 4; for (const d2 of DISTRICTS) sentiment(d2.id, 2, null); if (rnd() < 0.4) { const X = meetInvestor('gala'); if (X) return `You met ${X.name} at the dessert table!`; } return 'Your name is on the plaque.'; } },
        { label: 'Just attend ($5,000)', fx: () => { pay(5000); G.rep += 1; return 'Nice canapés.'; } },
        { label: 'Skip it', fx: () => 'You stayed home and watched TV.' }] }),
    journalist: () => ({ who: 'journalist', title: 'Interview request', text: 'The Centropolis Times wants a profile on "the city’s hottest property mogul".',
      choices: [{ label: 'Do the interview', sub: hasStaff('pr') ? 'Your PR manager will prep you' : 'Could go either way', fx: () => { const good = rnd() < (hasStaff('pr') ? 0.85 : 0.6); G.rep += good ? 4 : -3; return good ? 'Glowing article! Front page.' : 'They quoted you out of context. Ouch.'; } },
        { label: 'No comment', fx: () => 'Mysterious. Very mogul of you.' }] }),
    tip: () => {
      const S = STOCK_BY_ID[d.stock];
      return { who: 'friend', title: 'Hot stock tip', text: `A friend swears ${S.name} (${S.id}) is about to move. "Trust me," they say.`,
        choices: [{ label: 'Buy $20,000 worth', fx: () => { const x = G.stk[S.id]; const q = Math.floor(20000 / x.p); trade(S.id, q); x.p *= d.good ? 1.25 + rnd() * 0.2 : 0.75 - rnd() * 0.1; x.h[x.h.length - 1] = Math.round(x.p * 100) / 100; return d.good ? `${S.id} jumped! Check your stocks.` : `${S.id} tanked. So much for "trust me".`; } },
          { label: 'Ignore it', fx: () => 'Probably wise.' }] };
    },
    tenantbuy: () => ({ who: 'tenant', title: 'Your tenant wants to buy', text: `The tenants at ${addr} love it so much they want to buy it for ${fmt$(c)}.`,
      choices: [{ label: `Sell for ${fmtShort(c)}`, fx: () => { st.q = { m: G.month, p: c }; const r = sell(L); return r.ok ? `Sold! ${fmt$(r.net)} is yours.` : r.reason; } },
        { label: 'Keep it', fx: () => 'They’re disappointed but staying.' }] }),
    exit: () => {
      const X = INVESTOR_BY_ID[d.inv], i = st.partners.findIndex((p) => p.id === d.inv);
      const eq = Math.max(0, lotValue(L, st) - (st.loan ? st.loan.bal : 0)), price = i >= 0 ? Math.round(eq * st.partners[i].share * 1.03) : 0;
      return { who: d.inv, title: `${X.name} wants out`, text: `${X.name} needs cash and wants to sell their share of ${addr} back to you for ${fmt$(price)}.`,
        choices: [{ label: `Buy them out (${fmtShort(price)})`, fx: () => { const r = buyOutPartner(L, i); return r.ok ? 'You own more of it now.' : r.reason; } },
          { label: 'Refuse', sub: 'Trust −20', fx: () => { G.inv[d.inv].trust = clamp(G.inv[d.inv].trust - 20, 0, 100); return `${X.name} is unhappy.`; } }] };
    },
    petition: () => ({ who: 'neighbour', title: 'Neighbours’ petition', text: `Residents near ${addr} signed a petition against your construction.`,
      choices: [{ label: 'Host a community BBQ ($15,000)', fx: () => { pay(15000); sentiment(L.dist, 6, 'party', L); return 'Sausages solve everything.'; } },
        { label: 'Donate to the park ($60,000)', fx: () => { pay(60000); sentiment(L.dist, 12, 'donate', L); return 'The protest fizzled out.'; } },
        { label: 'Ignore them', sub: 'Goodwill −8', fx: () => { sentiment(L.dist, -8, 'build', L); return 'The petition is now 400 signatures long.'; } }] }),
    intro: () => {
      const X = INVESTOR_BY_ID[d.inv];
      return { who: d.inv, title: 'An investor wants to meet', text: `${X.name} (${X.title.toLowerCase()}) heard about you and suggests lunch. ${X.blurb}`,
        choices: [{ label: 'Lunch is on me ($500)', fx: () => { pay(500); G.inv[X.id].met = true; G.inv[X.id].trust = 30; return `${X.name} is now in your investor network.`; } },
          { label: 'Not now', fx: () => 'Maybe another time.' }] };
    },
    romance: () => ({ who: 'neighbour', title: 'Love is in the air', text: `You keep bumping into ${d.name} at the farmers’ market. Sparks are flying.`,
      choices: [{ label: 'Propose (wedding $40,000)', fx: () => { pay(40000); addMember({ first: d.name, born: famHead().born + Math.round((rnd() - 0.5) * 72), role: 'spouse', of: famHead().id, gen: famHead().gen }); G.rep += 2; return `You married ${d.name}! The whole street came to the party.`; } },
        { label: 'Stay focused on business', fx: () => 'Your portfolio is your one true love.' }] }),
    school: () => ({ who: 'neighbour', title: 'School fundraiser', text: 'The local primary school is raising money for a new playground.',
      choices: [{ label: 'Sponsor it ($25,000)', fx: () => { pay(25000); G.rep += 2; sentiment(pick(rnd, DISTRICTS).id, 5, 'donate', null); return 'The kids made you a giant thank-you card.'; } },
        { label: 'Buy a raffle ticket ($20)', fx: () => { pay(20); if (rnd() < 0.1) { G.cash += 5000; return 'You won the meat tray AND $5,000!'; } return 'You didn’t win the meat tray.'; } }] }),
  };
  const fn = cards[d.type];
  return fn ? fn() : null;
}
function resolveDecision(d, i, auto) {
  const card = decisionCard(d);
  if (!card) return '';
  const ch = card.choices[Math.min(i, card.choices.length - 1)];
  const out = ch.fx();
  G.rep = clamp(G.rep, -100, 100);
  if (auto) Bus.emit('autofix', { d, card, out });
  return out;
}

// ── monthly business tick ──
function tickBusiness(notes) {
  if (G.school) {
    G.school.left--;
    if (G.school.left <= 0) {
      const D = DEGREE_BY_ID[G.school.id];
      G.degrees[D.id] = G.month; G.sp += D.sp; G.school = null; addXP(50);
      notes.push({ kind: 'ach', title: 'You graduated!', text: `${D.name} complete. +${D.sp} skill point${D.sp > 1 ? 's' : ''}.`, good: true });
    }
  }
  for (const c of G.council) {
    c.left--;
    if (c.left > 0) continue;
    const L = CITY.lots[c.lot];
    if (rnd() < c.chance) {
      G.zones[c.lot] = c.zone; G.stats.rezoned++;
      const st = lotState(c.lot); if (st && c.afford) st.afford = true;
      sentiment(L.dist, -3 * (hasDeg('phd') ? 0.5 : 1), 'rezone', L);
      addXP(40);
      notes.push({ kind: 'ach', title: 'Rezoning approved!', text: `${L.addr} is now zoned ${c.zone}: ${ZONES[c.zone].name.toLowerCase()}.`, lot: c.lot, good: true });
    } else {
      G.coolZ[c.lot] = G.month + 6;
      if (c.donation) G.cash += c.donation * 0.5;
      notes.push({ kind: 'disaster', title: 'Rezoning rejected', text: `The council said no to rezoning ${L.addr}.${c.donation ? ' Half your community contribution was refunded.' : ''}`, lot: c.lot });
    }
  }
  G.council = G.council.filter((c) => c.left > 0);
  if (hasSkill('inv1') && G.month % 12 === 6) { const X = meetInvestor('net'); if (X) notes.push({ kind: 'news', title: 'New contact', text: `You met ${X.name} through your network.`, good: true }); }
  if (hasSkill('inv3') && rnd() < 0.05) {
    const happy = INVESTORS.filter((x) => G.inv[x.id].met && G.inv[x.id].trust > 70);
    if (happy.length) { const X = meetInvestor('rain'); if (X) notes.push({ kind: 'news', title: 'Introduction', text: `${pick(rnd, happy).name} introduced you to ${X.name}.`, good: true }); }
  }
  if (rnd() < 0.15) rollSituation();
}

// ── buying negotiation ──
function startNego(L) {
  const s = listing(L.id);
  const v = lotValue(L);
  const seller = s || makeSeller(L, Math.round(v / 1000) * 1000, true);
  if (!s) { seller.res = 1.08 + rnd() * 0.17; }
  const list = s ? s.p : Math.round(v * (seller.res + 0.08) / 1000) * 1000;
  return {
    lot: L.id, list, ask: list, res: (s ? seller.res * list : seller.res * v), pat: seller.pat,
    mot: seller.mot, known: hasSkill('dealer1') || perk('negotiate'),
    inspected: false, issue: 0, cond: seller.cond, hid: seller.hid, log: [], done: false, price: null, used: {},
  };
}
function negoInspect(N) {
  const L = CITY.lots[N.lot];
  const cost = Math.max(1500, Math.round(N.list * 0.0025 / 100) * 100);
  if (G.cash < cost) return { ok: false, reason: 'Not enough cash for an inspection.' };
  G.cash -= cost;
  N.inspected = true;
  N.issue = N.hid ? Math.round(N.list * N.hid / 1000) * 1000 : 0;
  N.log.push({ me: false, t: N.issue ? `Inspection found ${pick(rnd, ['termite damage', 'old wiring', 'a leaking roof', 'rising damp'])}: about ${fmt$(N.issue)} to fix.` : `Inspection came back clean. Condition is about ${Math.round(N.cond * 100)}%.` });
  void L;
  return { ok: true, cost };
}
function negoDiscount(N) {
  if (!N.issue || N.used.discount) return;
  N.used.discount = true;
  const cut = Math.round(N.issue * (0.6 + rnd() * 0.4) / 1000) * 1000;
  N.ask -= cut; N.res -= cut;
  N.log.push({ me: true, t: 'Given the inspection report, we’d like a discount.' });
  N.log.push({ me: false, t: `Fair enough. We’ll take ${fmt$(cut)} off: now asking ${fmt$(N.ask)}.` });
}
function negoSweetener(N, kind) {
  if (N.used[kind]) return;
  N.used[kind] = true;
  if (kind === 'quick') { N.res *= 0.985; N.log.push({ me: true, t: 'We can settle in 30 days.' }); N.log.push({ me: false, t: 'A quick settlement would really help them.' }); }
  if (kind === 'uncond') { N.res *= 0.98; N.log.push({ me: true, t: 'Our offer will be unconditional.' }); N.log.push({ me: false, t: 'No finance clause? That’s attractive.' }); }
}
function negoOffer(N, amount) {
  const ratio = amount / N.list;
  N.log.push({ me: true, t: `We offer ${fmt$(amount)}.` });
  const lawyer = hasStaff('lawyer') ? 0.03 : 0;
  if (amount >= N.ask || amount >= N.res * (1 - lawyer)) {
    N.done = true; N.price = amount;
    N.log.push({ me: false, t: pick(rnd, ['Deal! The seller accepts.', 'You’ve got yourself a property!', 'Signed, sealed… accepted!']) });
    return 'accept';
  }
  N.pat -= ratio < 0.78 ? 2 : 1;
  if (N.pat <= 0) {
    N.done = true;
    G.cool[N.lot] = G.month;
    N.log.push({ me: false, t: ratio < 0.78 ? 'Frankly, that’s insulting. The seller has walked away.' : 'The seller is tired of haggling and has walked away for now.' });
    return 'walk';
  }
  let concede = 0.28 + rnd() * 0.15 + (hasSkill('dealer1') ? 0.05 : 0) + (perk('negotiate') ? 0.06 : 0) + (headTrait('shark') ? 0.06 : 0) + lawyer;
  const newAsk = Math.max(N.res * 1.01, N.ask - (N.ask - amount) * concede);
  N.ask = Math.round(newAsk / 1000) * 1000;
  N.log.push({ me: false, t: pick(rnd, [`They’ve come down to ${fmt$(N.ask)}.`, `Best they can do is ${fmt$(N.ask)}.`, `Counter-offer: ${fmt$(N.ask)}. Their patience is wearing thin.`]) });
  return 'counter';
}
function negoAcceptAsk(N) { N.done = true; N.price = N.ask; N.log.push({ me: true, t: `We’ll take it at ${fmt$(N.ask)}.` }); N.log.push({ me: false, t: 'Wonderful. It’s yours!' }); }
