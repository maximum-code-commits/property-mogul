'use strict';
// ───────────────────────── online mode ─────────────────────────
// Talks to our own server (same origin). When the game is opened as a plain file
// or inside a viewer without the server, `Net.avail` stays false and everything
// online simply hides itself.
const Net = {
  avail: false, me: null, providers: {}, on: false,
  venue: {}, friendsWatch: new Map(), watch: new Map(), counts: { requests: 0, deals: 0, loans: 0 }, lead: [],
  lastSync: 0, syncing: false, lastSave: 0, saveBusy: false, _iv: 0, err: null,

  async req(method, path, body) {
    const opt = { method, credentials: 'same-origin', headers: { 'x-pm': '1' } };
    if (body !== undefined) { opt.headers['Content-Type'] = 'application/json'; opt.body = JSON.stringify(body); }
    let r;
    try { r = await fetch(path, opt); } catch (e) { throw new Error('You seem to be offline.'); }
    let data = null;
    try { data = await r.json(); } catch (e) { /* not json */ }
    if (!r.ok) {
      if (r.status === 401 && this.me) { this.me = null; this.on = false; UI.hud(); }
      throw new Error((data && data.error) || `Server error (${r.status}).`);
    }
    return data;
  },
  get: (p) => Net.req('GET', p),
  post: (p, b = {}) => Net.req('POST', p, b),

  async init() {
    if (!/^https?:$/.test(location.protocol)) return;
    try {
      const c = await this.get('/api/config');
      this.avail = true; this.providers = c.providers || {}; this.me = c.me; this.on = !!c.me;
    } catch (e) { this.avail = false; return; }
    const qs = new URLSearchParams(location.search);
    const signin = qs.get('signin');
    if (signin) {
      history.replaceState(null, '', location.pathname);
      if (signin === 'ok' && this.me) UI.toast({ kind: 'ach', title: `Signed in as ${this.me.name}`, text: 'Your game now saves online, and friends can find you.', good: true, life: 4200 });
      if (signin === 'failed') UI.toast({ kind: 'bad', title: 'Sign-in didn’t work', text: 'Please try again.', life: 4200 });
    }
    if (this.on) {
      this.loadWatch();
      clearInterval(this._iv);
      this._iv = setInterval(() => this.sync(), 20000);
    }
  },
  signIn(provider, name) {
    if (Game.running) Game.save();
    location.href = provider === 'dev' ? `/auth/dev?name=${encodeURIComponent(name || 'Tester')}` : `/auth/${provider}`;
  },
  async signOut() {
    if (Game.running) Game.save();
    try { await this.post('/api/logout'); } catch (e) { /* already signed out */ }
    this.me = null; this.on = false; clearInterval(this._iv);
    this.venue = {}; this.friendsWatch.clear(); this.watch.clear();
  },

  // ── cloud save ──
  async loadSave() {
    if (!this.on) return null;
    try { const s = await this.get('/api/save'); return s && s.json ? { t: +s.t || 0, json: s.json } : null; } catch (e) { return null; }
  },
  pushSave(t, json, force) {
    if (!this.on || this.saveBusy || (!force && t - this.lastSave < 40000)) return;
    this.saveBusy = true; this.lastSave = t;
    this.req('PUT', '/api/save', { t, json }).catch(() => { this.lastSave = 0; }).finally(() => { this.saveBusy = false; });
  },

  // ── what friends and the leaderboard see ──
  snapshot() {
    const t = totals();
    const top = owned().map((L) => ({ L, st: G.lots[L.id], v: lotValue(L) })).sort((a, b) => b.v - a.v).slice(0, 10).map(({ L, st, v }) => {
      const k = kindOf(L), pr = prestigeOf(L, st);
      return {
        lot: L.id, addr: L.addr, kind: k, kn: KINDS[k].name, dist: DISTRICT_BY_ID[L.dist].name, value: Math.round(v),
        rent: Math.round((st.units || []).reduce((s, u) => s + (u && u.r ? u.r : 0), 0)), lux: luxOf(eff(L), st), prestige: Math.round(pr),
        tier: prestigeTier(pr).name, historic: !!st.historic, str: st.mode === 'stay', built: builtYear(L, st), upg: Object.keys(st.up || {}).length,
      };
    });
    const clubs = {};
    for (const id in G.clubs) {
      clubs[id] = G.clubs[id].placed.map((u) => G.assets.find((a) => a.uid === u)).filter(Boolean).map((a) => ({ id: a.id, color: ASSET_BY_ID[a.id].color || '#d64b3c' }));
    }
    const coop = [];
    for (const L of owned()) {
      const st = G.lots[L.id];
      for (const p of st.partners || []) if (p.fid) { coop.push({ deal: p.deal, value: Math.max(0, lotValue(L, st) - (st.loan ? st.loan.bal : 0)) }); break; }
    }
    const h = G.hist.net, step = Math.max(1, Math.ceil(h.length / 60));
    const home = G.home != null ? CITY.lots[G.home] : null;
    return {
      name: famHead() ? famHead().first : G.mogul, fam: G.fam ? G.fam.name : '', net: Math.round(t.net), cash: Math.round(G.cash), props: t.props,
      rep: Math.round(G.rep), level: G.lvl, gen: G.fam ? G.fam.gen : 1, year: dateLabel().year, seed: G.seed,
      ach: Object.keys(G.ach).length, achTotal: ACHIEVEMENTS.length, rentMo: Math.round(t.rent), debt: Math.round(t.loans + t.pl + t.p2pOwe),
      home: home ? home.addr : '', str: owned().filter((L) => G.lots[L.id].mode === 'stay').length, historic: owned().filter((L) => G.lots[L.id].historic).length,
      top, clubs, coop, hist: h.filter((_, i) => i % step === 0 || i === h.length - 1).map(Math.round),
    };
  },

  // ── the sync heartbeat: outbox out, ledger and friend data in ──
  async sync(force) {
    if (!this.on || this.syncing || !Game.running || !G) return;
    if (!force && Date.now() - this.lastSync < 8000) return;
    this.syncing = true;
    try {
      for (const o of G.outbox) if (!o.op) o.op = `${G.seed.toString(36)}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
      const ops = G.outbox.slice(0, 150);
      const r = await this.post('/api/sync', { ops, snapshot: this.snapshot() });
      const done = new Set(r.applied || []);
      G.outbox = G.outbox.filter((o) => !done.has(o.op));
      this.me = r.me || this.me;
      this.apply(r);
      this.err = null;
    } catch (e) { this.err = e.message; }
    this.syncing = false;
    this.lastSync = Date.now();
  },
  apply(r) {
    const seen = new Set(G.ledgerSeen || []), got = [];
    let cash = 0;
    for (const e of r.ledger || []) {
      if (seen.has(e.id)) { got.push(e.id); continue; }
      G.cash += e.amount; cash += e.amount;
      const m = e.meta || {};
      if (e.kind === 'loan') {
        G.p2p.push({ id: m.loan, role: 'b', who: m.who, apy: m.apy / 100, bal: e.amount, pay: m.pay, left: m.term, term: m.term, type: m.type });
      } else if (e.kind === 'dealfunds' && m.seed === G.seed) {
        G.coop[m.lot] = { deal: m.deal, funded: true, shares: (m.shares || []).map((s) => ({ user: s.user, name: s.name, amount: s.amount })) };
      }
      UI.toast({ kind: e.kind === 'refund' ? 'news' : 'coin', title: e.kind === 'loan' ? 'Loan received' : e.kind === 'dealfunds' ? 'Partner money arrived' : e.kind === 'loanpay' ? 'Loan repayment' : e.kind === 'deal' ? 'Co-op payout' : 'Money returned', text: `${e.memo} · ${fmt$(e.amount)}`, good: true });
      seen.add(e.id); got.push(e.id);
    }
    if (got.length) {
      G.ledgerSeen = [...seen].slice(-400);
      Game.save(); // the money is in the save before we tell the server we have it
      this.post('/api/ledger/ack', { ids: got }).catch(() => {});
      if (cash) { Sound.play('coin'); UI.hud(); }
    }
    G.stakes = (r.stakes || []).map((s) => ({ ...s }));
    G.p2p = G.p2p.filter((l) => l.role === 'b').concat((r.lent || []).map((l) => ({ ...l, role: 'l' })));
    this.lead = r.lead || [];
    this.venue = r.venue || {};
    this.friendsWatch = new Map();
    for (const w of r.friendsWatch || []) { const a = this.friendsWatch.get(w.lot) || []; a.push(w); this.friendsWatch.set(w.lot, a); }
    this.counts = r.counts || this.counts;
    UI.socialBadge();
    if (Modal.open && Modal.view === Social) Social.refreshSoft();
  },

  // ── properties of interest ──
  async loadWatch() {
    try {
      const r = await this.get('/api/watch');
      this.watch = new Map(r.rows.map((w) => [`${w.seed}:${w.lot}`, w]));
    } catch (e) { /* later */ }
  },
  watching(lot) { return !!G && this.watch.has(`${G.seed}:${lot}`); },
  async toggleWatch(L, note = '') {
    const key = `${G.seed}:${L.id}`;
    if (this.watch.has(key)) {
      await this.post('/api/watch/remove', { seed: G.seed, lot: L.id });
      this.watch.delete(key);
      return false;
    }
    const w = { seed: G.seed, lot: L.id, addr: L.addr, kind: KINDS[kindOf(L)].name, dist: DISTRICT_BY_ID[L.dist].name, price: Math.round(lotValue(L)), note };
    await this.post('/api/watch', w);
    this.watch.set(key, w);
    return true;
  },
  shareURL(handle) { return `${location.origin}/p/${encodeURIComponent(handle || (this.me && this.me.handle) || '')}`; },
  async share(handle) {
    const url = this.shareURL(handle);
    const t = totals();
    const text = `My Property Mogul empire: ${fmtShort(t.net)} across ${t.props} properties.`;
    try { if (navigator.share && !handle) { await navigator.share({ title: 'Property Mogul', text, url }); return 'shared'; } } catch (e) { /* cancelled */ }
    try { await navigator.clipboard.writeText(url); return 'copied'; } catch (e) { return url; }
  },
};
