'use strict';
// ───────────────────────── interface: property screen ─────────────────────────

// ── floorplans (SVG) ──
const ROOMC = { bed: '#e6dcf5', bath: '#d6eef8', living: '#fff0c8', kitchen: '#dcf2d6', garage: '#e4e4e4', suite: '#fde2d2', hall: '#f6f1e7', office: '#e9f0f8', meet: '#fde2d2', shop: '#fff0c8', core: '#cfd3da', room: '#e6dcf5', lobby: '#fff0c8', hallI: '#ece6da', field: '#e8d58a' };
function roomSVG(x, y, w, h, kind, label, furn) {
  let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${ROOMC[kind] || '#fff'}" stroke="#3b2412" stroke-width="2"/>`;
  const cx = x + w / 2, cy = y + h / 2;
  if (furn === 'bed') s += `<rect x="${cx - 13}" y="${cy - 8}" width="26" height="22" rx="3" fill="#fff" stroke="#8d7bb8" stroke-width="1.5"/><rect x="${cx - 11}" y="${cy - 6}" width="22" height="6" rx="2" fill="#c9b8ef"/>`;
  if (furn === 'sofa') s += `<rect x="${cx - 18}" y="${cy + 2}" width="36" height="10" rx="4" fill="#e0a43a"/><circle cx="${cx}" cy="${cy - 10}" r="6" fill="#c98a4b"/>`;
  if (furn === 'kitchen') s += `<path d="M${x + 6} ${y + 6}h${w - 12}v8h-${w - 20}v${h - 20}h-8z" fill="#fff" stroke="#6aa84f" stroke-width="1.4"/>`;
  if (furn === 'bath') s += `<rect x="${cx - 9}" y="${cy - 5}" width="18" height="12" rx="5" fill="#fff" stroke="#5aa9d8" stroke-width="1.4"/>`;
  if (furn === 'car') s += `<rect x="${cx - 9}" y="${cy - 15}" width="18" height="30" rx="5" fill="#d64b3c"/><rect x="${cx - 7}" y="${cy - 8}" width="14" height="8" fill="#bfe2f2"/>`;
  if (furn === 'desks') for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) s += `<rect x="${x + 8 + i * (w - 16) / 3}" y="${y + 8 + j * (h - 16) / 2}" width="${(w - 16) / 3 - 6}" height="${(h - 16) / 2 - 8}" rx="2" fill="#fff" stroke="#8aa6c9" stroke-width="1.2"/>`;
  if (label) s += `<text x="${cx}" y="${y + h - 6}" text-anchor="middle" class="fp-l">${esc(label)}</text>`;
  return s;
}
function floorplanSVG(L, st) {
  const E = eff(L), K = KINDS[E.kind];
  const ups = (st && st.o && st.ups) || {};
  const W = 320, H = 210;
  let s = '';
  const frame = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="none" stroke="#3b2412" stroke-width="5"/>`;
  if (K.cat === 'land' || E.kind === 'site') {
    s += `<rect x="20" y="20" width="280" height="170" fill="#e8f0d2" stroke="#e07a3a" stroke-width="3" stroke-dasharray="8 6"/><text x="160" y="104" text-anchor="middle" class="fp-big">${E.kind === 'site' ? 'Under construction' : 'Vacant site'}</text><text x="160" y="126" text-anchor="middle" class="fp-l">${(L.w * L.d * 400).toLocaleString()} m² · zoned ${zoneOf(L)}</text>`;
    return `<svg viewBox="0 0 ${W} ${H}" class="floorplan" role="img" aria-label="Site plan">${s}</svg>`;
  }
  if (K.cat === 'res' && unitCount(E, null) <= 2) {
    const beds = bedsOf(E, st), baths = K.baths + (ups.extension ? 1 : 0), garage = ups.garage || ['house', 'mansion', 'lakehouse'].includes(E.kind);
    const x0 = 20, y0 = 14, x1 = garage ? 250 : 300, y1 = 156;
    const topRooms = [];
    for (let i = 0; i < beds; i++) topRooms.push(['bed', i === 0 ? 'Main bed' : 'Bed ' + (i + 1), 'bed', i === 0 ? 1.3 : 1]);
    if (baths > 1) topRooms.push(['bath', 'Ensuite', 'bath', 0.6]);
    const botRooms = [['living', 'Living', 'sofa', 2], ['kitchen', 'Kitchen', 'kitchen', 1.3], ['bath', 'Bath', 'bath', 0.7]];
    if (baths > 2) botRooms.push(['bath', 'Bath 3', 'bath', 0.6]);
    if (luxOf(E, st) >= 3) botRooms.splice(1, 0, ['living', 'Dining', null, 1]);
    const row = (rooms, y, h) => { const tw = rooms.reduce((a, r) => a + r[3], 0); let x = x0; for (const r of rooms) { const w = (x1 - x0) * r[3] / tw; s += roomSVG(x, y, w, h, r[0], r[1], r[2]); s += `<line x1="${x + w / 2 - 8}" y1="${y + (y === y0 ? h : 0)}" x2="${x + w / 2 + 8}" y2="${y + (y === y0 ? h : 0)}" stroke="#fff" stroke-width="4"/>`; x += w; } };
    const hy = y0 + (y1 - y0) * 0.46;
    row(topRooms, y0, hy - y0 - 7);
    s += `<rect x="${x0}" y="${hy - 7}" width="${x1 - x0}" height="14" fill="${ROOMC.hall}" stroke="#3b2412" stroke-width="1"/>`;
    row(botRooms, hy + 7, y1 - hy - 7);
    if (garage) s += roomSVG(x1, y0, 300 - x1, y1 - y0, 'garage', 'Garage', 'car');
    s += frame(x0, y0, 300 - x0, y1 - y0);
    // yard
    s += `<rect x="${x0}" y="164" width="${280}" height="40" fill="#cfe8b0" rx="4"/>`;
    if (ups.pool || K.pool) s += `<rect x="${x0 + 10}" y="170" width="90" height="28" rx="8" fill="#7fd0e8" stroke="#fff" stroke-width="3"/><text x="${x0 + 55}" y="189" text-anchor="middle" class="fp-l">Pool</text>`;
    if (ups.suite) s += `<rect x="190" y="168" width="96" height="32" fill="${ROOMC.suite}" stroke="#3b2412" stroke-width="2"/><text x="238" y="189" text-anchor="middle" class="fp-l">Granny flat</text>`;
    if (ups.hottub) s += `<circle cx="150" cy="184" r="12" fill="#7fd0e8" stroke="#8a5a34" stroke-width="3"/>`;
    if (unitCount(E, null) === 2 && !ups.suite) s += `<line x1="160" y1="${y0}" x2="160" y2="${y1}" stroke="#3b2412" stroke-width="5"/><text x="160" y="${y0 - 3}" text-anchor="middle" class="fp-l">2 homes</text>`;
  } else if (K.cat === 'res') {
    const per = E.kind === 'townhouse' ? unitCount(E, null) : Math.max(2, Math.min(8, Math.round(unitCount(E, null) / Math.max(1, E.floors || 1))));
    const top = Math.ceil(per / 2), bot = per - top;
    const x0 = 20, x1 = 300, y0 = 20, y1 = 180, cy = 100;
    const unit = (n, i, y, h) => { const w = (x1 - x0) / n; s += roomSVG(x0 + i * w, y, w, h, i % 2 ? 'bed' : 'living', `${K.beds} bed · ${K.sqm}m²`, null); s += `<text x="${x0 + i * w + w / 2}" y="${y + 18}" text-anchor="middle" class="fp-b">Unit ${i + 1}</text>`; };
    for (let i = 0; i < top; i++) unit(top, i, y0, cy - 12 - y0);
    s += `<rect x="${x0}" y="${cy - 12}" width="${x1 - x0}" height="24" fill="${ROOMC.hall}" stroke="#3b2412" stroke-width="1"/>`;
    s += `<rect x="150" y="${cy - 12}" width="20" height="24" fill="${ROOMC.core}"/><text x="160" y="${cy + 4}" text-anchor="middle" class="fp-l">Lift</text>`;
    for (let i = 0; i < bot; i++) unit(bot, i, cy + 12, y1 - cy - 12);
    s += frame(x0, y0, x1 - x0, y1 - y0);
    s += `<text x="160" y="200" text-anchor="middle" class="fp-b">Typical floor · ${E.floors || 1} floor${(E.floors || 1) > 1 ? 's' : ''} · ${unitCount(E, st)} homes</text>`;
  } else if (K.cat === 'com' && (E.kind === 'office' || E.kind === 'officetower')) {
    s += roomSVG(20, 20, 190, 160, 'office', 'Open-plan office', 'desks');
    s += roomSVG(210, 20, 90, 70, 'meet', 'Meeting', null);
    s += roomSVG(210, 90, 50, 90, 'core', 'Core', null);
    s += roomSVG(260, 90, 40, 90, 'bath', 'WC', 'bath');
    s += frame(20, 20, 280, 160);
    s += `<text x="160" y="200" text-anchor="middle" class="fp-b">One tenancy per floor · ${E.floors} floors · ${K.sqm}m² each</text>`;
  } else if (K.cat === 'com') {
    const n = Math.max(1, unitCount(E, null) > 8 ? 8 : unitCount(E, null));
    const units = (st && st.o && st.units) || [];
    for (let i = 0; i < n; i++) { const w = 280 / n; const u = units[i]; s += roomSVG(20 + i * w, 20, w, 130, 'shop', u && u.r ? u.n : n > 1 ? 'Shop ' + (i + 1) : K.name, null); }
    s += `<rect x="20" y="150" width="280" height="30" fill="#6c717a"/><text x="160" y="170" text-anchor="middle" fill="#fff" class="fp-l">Street frontage${E.kind === 'retail' || E.kind === 'mall' ? ' · parking' : ''}</text>`;
    s += frame(20, 20, 280, 130);
    if (unitCount(E, null) > 8) s += `<text x="160" y="200" text-anchor="middle" class="fp-b">${unitCount(E, null)} shops over two levels</text>`;
  } else if (K.cat === 'hosp') {
    s += roomSVG(20, 20, 90, 160, 'lobby', 'Lobby & bar', 'sofa');
    for (let i = 0; i < 6; i++) { s += roomSVG(110 + i * 31.6, 20, 31.6, 60, 'room', '', 'bed'); s += roomSVG(110 + i * 31.6, 120, 31.6, 60, 'room', '', 'bed'); }
    s += `<rect x="110" y="80" width="190" height="40" fill="${ROOMC.hall}" stroke="#3b2412" stroke-width="1"/><text x="205" y="104" text-anchor="middle" class="fp-l">Corridor</text>`;
    s += frame(20, 20, 280, 160);
    s += `<text x="160" y="200" text-anchor="middle" class="fp-b">About ${Math.round(K.sqm * sizeScale(E) / 45)} guest rooms · leased to one operator</text>`;
  } else if (K.cat === 'ind') {
    s += roomSVG(20, 20, 220, 160, 'hallI', 'Warehouse floor', null);
    for (let i = 0; i < 5; i++) s += `<rect x="${36 + i * 40}" y="34" width="10" height="110" fill="#c9a26a"/>`;
    s += roomSVG(240, 20, 60, 70, 'office', 'Office', null);
    for (let i = 0; i < 3; i++) s += `<rect x="${250}" y="${100 + i * 26}" width="50" height="18" fill="#6c717a"/><text x="275" y="${113 + i * 26}" text-anchor="middle" fill="#fff" class="fp-l">Dock</text>`;
    s += frame(20, 20, 280, 160);
  } else if (K.cat === 'agri') {
    for (let i = 0; i < 9; i++) s += `<rect x="20" y="${20 + i * 18}" width="200" height="12" fill="${E.kind === 'vineyard' ? '#9ccf5a' : E.kind === 'orchard' ? '#8cc35a' : '#e8d58a'}"/>`;
    s += roomSVG(230, 20, 70, 70, 'living', 'Farmhouse', null);
    s += roomSVG(230, 100, 70, 80, 'garage', E.kind === 'vineyard' ? 'Winery' : 'Barn', null);
    s += `<text x="120" y="200" text-anchor="middle" class="fp-b">${Math.round(L.w * L.d * 2.5)} hectares</text>`;
  }
  return `<svg viewBox="0 0 ${W} ${H}" class="floorplan" role="img" aria-label="Floorplan of the ${esc(K.name)}">${s}</svg>`;
}

// ── the property screen ──
const PV = {
  L: null, mode: 'buy', step: 'look', tab: 'overview', N: null, pay: null, msg: '', sale: null, design: null, rz: null, demo: false, showPlan: false,
  open(id, opts = {}) {
    const L = CITY.lots[id];
    const st = lotState(id);
    Object.assign(this, { L, mode: !isProperty(L.kind) ? 'civic' : st && st.o ? 'own' : 'buy', step: 'look', tab: opts.tab || 'overview', N: null, pay: null, msg: '', sale: null, design: null, rz: null, demo: false, showPlan: false });
    View.sel = id;
    Sound.play('click');
    Modal.show('m-prop', this);
  },
  who() { return this.mode === 'buy' && this.step === 'nego' ? 'agent' : 'agent'; },
  facts() {
    const L = this.L, E = eff(L), K = KINDS[E.kind], st = lotState(L.id), d = DISTRICT_BY_ID[L.dist];
    const rows = [];
    rows.push(['Type', (E.kind === 'site' ? 'Construction site' : K.name) + (SEGMENTS[segOf(E.kind)] && K.cat !== 'civic' && K.cat !== 'land' ? ' · ' + SEGMENTS[segOf(E.kind)].toLowerCase() : '')]);
    rows.push(['Suburb', d.name]);
    if (isProperty(L.kind)) {
      rows.push(['Zoning', `${zoneOf(L)} · ${ZONES[zoneOf(L)].name}`]);
      rows.push(['Market value', fmt$(lotValue(L, st))]);
      if (K.yield) {
        const n = unitCount(E, st);
        rows.push(['Size', `${sqmOf(E, st).toLocaleString()} m²${K.beds && n <= 2 ? ` · ${bedsOf(E, st)} bed` : ''}${n > 1 ? ` · ${n} units` : ''}`]);
        rows.push(['Fittings', LUX[luxOf(E, st)]]);
        rows.push(['Market rent', fmt$(marketRent(L, st && st.o ? st : null)) + '/mo' + (n > 1 ? ' total' : '')]);
        rows.push(['Gross yield', fmtPct(K.yield * 1.08, 1)]);
      }
      if (perk('analyst') || hasStaff('analyst')) {
        const tr = districtTrend(L.dist);
        rows.push(['12-month outlook', `<span class="${tr >= 0 ? 'up' : 'down'}">${tr >= 0 ? '▲' : '▼'} ${signPct(tr, 1)}</span>`]);
      }
    }
    return rows.map(([k, v]) => `<div><dt>${k}</dt><dd>${v}</dd></div>`).join('');
  },
  render() {
    const L = this.L, E = eff(L), K = KINDS[E.kind], ag = AGENT_BY_ID[G.agentId], st = lotState(L.id);
    let head = '', body = '', acts = '';
    const btn = (act, label, o = {}) => `<button class="btn ${o.cls || ''}" data-act="${act}" ${o.v != null ? `data-v="${o.v}"` : ''} ${o.dis ? 'disabled' : ''}>${label}</button>`;
    if (this.mode === 'civic') {
      head = K.name;
      body = `<p>${L.kind === 'trees' ? 'A little patch of bushland. The council protects it, so it’s not for sale.' : L.kind === 'mountain' ? 'Mount Frost. You can’t buy a mountain. Yet.' : 'This is public land, run by the council. It’s not for sale, but it makes the homes around it more desirable.'}</p>`;
      acts = btn('close', 'Back');
    } else if (this.mode === 'own') ({ head, body, acts } = this.ownView(L, st, btn));
    else ({ head, body, acts } = this.buyView(L, btn));
    if (this.msg) body += `<p class="warn">${esc(this.msg)}</p>`;
    const tags = isProperty(L.kind) && K.yield ? tagsOf(L, st && st.o ? st : null) : [];
    const mood = this.mode === 'buy' && this.N && this.N.done && !this.N.price ? 'sad' : this.step === 'done' || (this.sale && this.sale.step === 'sold') ? 'wow' : 'happy';
    Modal.sheet.innerHTML = `
      <div class="pv">
        <div class="pv-top"><div class="banner">${esc(DISTRICT_BY_ID[L.dist].name)}</div><div class="pv-cash">${icon('coin')} <span>${fmt$(G.cash)}</span></div></div>
        <div class="pv-agent">${charSVG(ag.look, 'full', mood)}<div class="nametag"><b>${esc(ag.name)}</b><span>${esc(ag.title)}</span></div></div>
        <div class="pv-main">
          <div class="bubble">
            <div class="bubble-face">${charSVG(ag.look, 'face', mood)}</div>
            <h2 class="bubble-head">${head}</h2>
            <div class="bubble-body">${body}</div>
          </div>
          <div class="pv-actions">${acts}</div>
        </div>
        <div class="pv-lot">
          <canvas class="diorama" aria-label="${esc(K.name)} at ${esc(L.addr)}"></canvas>
          <div class="lot-title"><b>${esc(L.addr)}</b></div>
          ${tags.length ? `<div class="chips">${tags.map((t) => tagChip(L, t)).join('')}</div>` : ''}
          <dl class="facts">${this.facts()}</dl>
        </div>
        <button class="btn btn-back" data-act="close">Back to Game</button>
      </div>`;
    requestAnimationFrame(() => {
      const cv = Modal.sheet.querySelector('.diorama');
      if (!cv) return;
      const r = cv.getBoundingClientRect();
      if (r.width > 10) drawDiorama(cv, this.design && this.mode === 'own' && this.tab === 'develop' && kindOf(L) === 'land' ? this.designPreview() : E, 0.35, r.width, r.height);
    });
    this.bind();
  },

  // ── buying ──
  buyView(L, btn) {
    const lst = listing(L.id), K = KINDS[L.kind];
    const kindWord = SEGMENTS[segOf(L.kind)] ? SEGMENTS[segOf(L.kind)].toLowerCase() : 'property';
    let head = '', body = '', acts = '';
    if (!this.N) this.N = startNego(L);
    const N = this.N;
    if (this.step === 'look') {
      const cool = offerCooling(L);
      const mot = N.mot >= 0 && N.known ? MOTIVES[N.mot].k : null;
      if (lst) {
        head = `So you’re interested in buying this ${kindWord} property.`;
        body = `<p>The asking price is <b>${fmt$(N.list)}</b> + <b>${fmt$(N.list * SALES_TAX)}</b> property sales tax.</p>
          <p>You have <b>${fmt$(G.cash)}</b> to spend, which is <b>${Math.max(0, Math.round(G.cash / N.list * 100))}%</b> of the ask price.</p>
          ${mot ? `<p class="hint">${icon('key', 'inl')} I did some digging: the seller is <b>${mot.toLowerCase()}</b>.</p>` : ''}`;
      } else {
        head = `This ${K.name.toLowerCase()} isn’t on the market.`;
        body = `<p>The owners aren’t advertising, but everyone has a price. I’d value it at around <b>${fmt$(lotValue(L))}</b>. Expect to pay a premium.</p>`;
      }
      body += N.inspected ? `<p class="hint">${icon('check', 'inl')} Inspected: condition ${Math.round(N.cond * 100)}%${N.issue ? `, ${fmt$(N.issue)} of repairs needed` : ', no surprises'}.</p>` : `<p class="hint">Not inspected yet. Hidden problems are common.</p>`;
      if (this.showPlan) body += floorplanSVG(L, null);
      if (cool) body += '<p class="muted">The seller turned down your last offer. Try again next month.</p>';
      acts = (cool ? '' : btn('nego', lst ? 'Make an Offer' : 'Approach the Owner', { cls: 'btn-go' })) +
        (lst ? btn('payask', `Pay Asking Price <small>${fmtShort(N.list)}</small>`) : '') +
        (!N.inspected ? btn('inspect', `Inspect <small>${fmtShort(Math.max(1500, N.list * 0.0025))}</small>`) : '') +
        btn('plan', this.showPlan ? 'Hide Floorplan' : 'Floorplan') + btn('close', 'Back');
    } else if (this.step === 'nego') {
      head = N.done ? (N.price ? 'Deal agreed!' : 'They walked away.') : 'Let’s negotiate.';
      const hearts = Array.from({ length: Math.max(0, N.pat) }, () => icon('heart', 'heart')).join('');
      body = `<div class="nego-top"><div><small>Asking</small><b>${fmt$(N.ask)}</b></div><div><small>Seller patience</small><span class="hearts">${hearts || '<i class="muted">none</i>'}</span></div>${N.known && N.mot >= 0 ? `<div><small>Why they’re selling</small><b class="sm">${MOTIVES[N.mot].k}</b></div>` : ''}</div>
        <div class="chat">${N.log.slice(-6).map((m) => `<p class="${m.me ? 'me' : 'them'}">${esc(m.t)}</p>`).join('') || '<p class="them">The seller’s agent is waiting for your offer.</p>'}</div>`;
      if (!N.done) {
        const base = N.list;
        const lo = lst ? 70 : 90, hi = lst ? 105 : 140;
        const val = clamp(Math.round((N.offer || N.ask * 0.9) / base * 100), lo, hi);
        body += `<div class="field"><label for="offR">Your offer <b id="offAmt"></b> <span id="offPct" class="muted"></span></label><input type="range" id="offR" min="${lo}" max="${hi}" step="1" value="${val}"></div>
          <div class="sweet">${!N.used.quick ? btn('sweet', '+ Quick settlement', { v: 'quick', cls: 'btn-sm' }) : ''}${!N.used.uncond ? btn('sweet', '+ Unconditional offer', { v: 'uncond', cls: 'btn-sm' }) : ''}${N.issue && !N.used.discount ? btn('discount', 'Ask for repair discount', { cls: 'btn-sm' }) : ''}</div>`;
        acts = btn('offer', 'Make Offer', { cls: 'btn-go' }) + btn('takeask', `Accept ${fmtShort(N.ask)}`) + btn('walk', 'Walk Away');
      } else if (N.price) acts = btn('topay', 'Arrange Payment', { cls: 'btn-go' }) + btn('close', 'Back');
      else acts = btn('close', 'Back');
    } else if (this.step === 'pay') ({ head, body, acts } = this.payView(L, btn));
    else if (this.step === 'done') {
      head = 'Congratulations!';
      body = `<p><b>${esc(L.addr)}</b> is now part of your portfolio.</p><p>I’ll start finding tenants straight away. Set the rent from the property screen.</p>`;
      acts = btn('manage', 'Manage Property', { cls: 'btn-go' }) + btn('close', 'Back to Game');
    }
    return { head, body, acts };
  },
  payView(L, btn) {
    const N = this.N, P_ = this.pay;
    const price = N.price, tax = price * SALES_TAX, total = price + tax, seg = segOf(L.kind);
    const invs = INVESTORS.filter((x) => G.inv[x.id].met).map((x) => [x, coInvestMax(x.id, seg, total)]);
    if (P_.partner && !invs.some(([x, m]) => x.id === P_.partner && m > 0)) P_.partner = null;
    const pmax = P_.partner ? coInvestMax(P_.partner, seg, total) : 0;
    P_.share = clamp(P_.share, 0.05, Math.max(0.05, pmax));
    const partnerCash = P_.partner ? Math.round(total * P_.share) : 0;
    let q = null, cashNeed, ok, reason = '';
    if (P_.method === 'loan') {
      if (!P_.lender) P_.lender = LENDERS.find((l) => G.rep >= l.minRep) || LENDERS[2];
      P_.dep = clamp(P_.dep, lenderMinDep(P_.lender), 0.9);
      q = quoteLoan(L, price, P_.lender, P_.dep, P_.years, partnerCash);
      cashNeed = q.cashNeed; ok = q.ok; reason = q.reasons[0] || '';
    } else { cashNeed = total - partnerCash; ok = cashNeed <= G.cash; if (!ok) reason = `You need ${fmt$(cashNeed)} in cash.`; }
    const head = `How will you pay ${fmtShort(price)}?`;
    let body = `<div class="seg wide">${[['cash', 'Cash'], ['loan', 'Mortgage']].map(([k, l]) => `<button class="${P_.method === k ? 'on' : ''}" data-act="method" data-v="${k}">${l}</button>`).join('')}</div>`;
    if (P_.method === 'loan') {
      body += `<div class="lenders">${LENDERS.map((l) => {
        const locked = G.rep < l.minRep;
        return `<label class="lender ${l === P_.lender ? 'on' : ''} ${locked ? 'locked' : ''}" style="--lc:${l.color}"><input type="radio" name="lender" value="${l.id}" ${l === P_.lender ? 'checked' : ''}><span class="lname">${esc(l.name)}</span><span class="lmeta">${fmtPct(lenderRate(l), 2)} · min ${fmtPct(lenderMinDep(l), 0)} deposit</span><span class="lblurb">${locked ? `${icon('lock')} Needs reputation ${l.minRep}` : esc(l.blurb)}</span></label>`;
      }).join('')}</div>
      <div class="field"><label for="depR">Deposit <b>${fmtPct(P_.dep, 0)}</b> <span class="muted">${fmt$(price * P_.dep)}</span></label><input type="range" id="depR" min="${Math.round(lenderMinDep(P_.lender) * 100)}" max="90" value="${Math.round(P_.dep * 100)}"></div>
      <div class="seg">${[25, 30].map((y) => `<button class="${y === P_.years ? 'on' : ''}" data-act="years" data-v="${y}">${y} years</button>`).join('')}</div>`;
    }
    body += `<div class="partner"><b>Bring in an investor</b> <span class="muted">They fund part of the deal and take the same share of rent and sale profit.</span>
      <div class="inv-pick">${invs.length ? invs.map(([x, m]) => `<button class="inv-chip ${P_.partner === x.id ? 'on' : ''}" data-act="partner" data-v="${x.id}" ${m <= 0 ? 'disabled' : ''}><i>${charSVG(x.look, 'face')}</i><span>${esc(x.name.split(' ')[0])}<small>${m > 0 ? 'up to ' + Math.round(m * 100) + '%' : !x.likes.includes(seg) ? 'not interested' : 'needs more trust'}</small></span></button>`).join('') : '<span class="muted">You don’t know any investors yet.</span>'}</div>
      ${P_.partner ? `<div class="field"><label for="shareR">${esc(INVESTOR_BY_ID[P_.partner].name)} takes <b>${Math.round(P_.share * 100)}%</b> <span class="muted">and puts in ${fmt$(partnerCash)}</span></label><input type="range" id="shareR" min="5" max="${Math.round(pmax * 100)}" value="${Math.round(P_.share * 100)}"></div>` : ''}
    </div>`;
    body += `<dl class="quote">
      <div><dt>Price + sales tax</dt><dd>${fmt$(total)}</dd></div>
      ${P_.partner ? `<div><dt>Investor puts in</dt><dd class="up">−${fmt$(partnerCash)}</dd></div>` : ''}
      ${q ? `<div><dt>Loan</dt><dd>${fmt$(q.principal)} at ${fmtPct(q.rate, 2)}</dd></div><div><dt>Repayments</dt><dd>${fmt$(q.pay)}/mo</dd></div><div><dt>Expected rent</dt><dd>${fmt$(q.rent)}/mo</dd></div><div><dt>Monthly cash flow</dt><dd class="${q.flow >= 0 ? 'up' : 'down'}">${q.flow >= 0 ? '+' : ''}${fmt$(q.flow * (1 - (P_.partner ? P_.share : 0)))}</dd></div>` : ''}
      <div><dt>Your cash needed today</dt><dd>${fmt$(cashNeed)}</dd></div></dl>`;
    if (!ok) body += `<p class="warn">${esc(reason)}</p>`;
    const acts = btn('buy', 'Buy It', { cls: 'btn-go', dis: !ok }) + btn('close', 'Not Now');
    return { head, body, acts };
  },

  // ── owning ──
  ownView(L, st, btn) {
    const E = eff(L), K = KINDS[E.kind];
    const tabs = [['overview', 'Overview'], ['units', st.units.length > 1 ? `Units` : 'Tenant', st.offers && st.offers.length ? st.offers.length : 0], ['upgrades', 'Upgrades'], ['plan', 'Plan'], ['develop', 'Develop'], ['partners', 'Partners']];
    const head = E.kind === 'site' ? `Construction site · ${esc(L.addr)}` : `${K.name} · ${esc(L.addr)}`;
    let body = tabsHTML(K.yield || E.kind === 'site' || K.cat === 'land' ? tabs.filter(([k]) => K.yield || ['overview', 'develop', 'plan'].includes(k)) : tabs, this.tab);
    let acts = '';
    if (this.sale) return this.saleView(L, st, btn);
    const t = this.tab;
    if (t === 'overview') ({ b: body, a: acts } = this.ownOverview(L, st, btn, body));
    else if (t === 'units') body += this.ownUnits(L, st, btn);
    else if (t === 'upgrades') body += this.ownUpgrades(L, st);
    else if (t === 'plan') body += this.ownPlan(L, st);
    else if (t === 'develop') ({ b: body, a: acts } = this.ownDevelop(L, st, btn, body));
    else if (t === 'partners') body += this.ownPartners(L, st);
    if (!acts) acts = btn('close', 'Back');
    return { head, body, acts };
  },
  ownOverview(L, st, btn, body) {
    const E = eff(L), K = KINDS[E.kind];
    const v = lotValue(L, st);
    const gain = st.pp ? v / st.pp - 1 : 0;
    const n = st.units.length, occ = st.units.filter((u) => u && u.r).length, home = G.home === L.id;
    body += `<p>It’s worth <b>${fmt$(v)}</b> today, <span class="${gain >= 0 ? 'up' : 'down'}">${gain >= 0 ? 'up' : 'down'} ${fmtPct(Math.abs(gain), 1)}</span> on the ${fmt$(st.pp)} you paid.</p>`;
    if (st.build) {
      const b = st.build;
      body += `<p>Your ${KINDS[b.kind].name.toLowerCase()} is <b>${Math.round((1 - b.left / b.total) * 100)}%</b> built. ${b.left} month${b.left === 1 ? '' : 's'} to go.</p><div class="meter big"><i style="width:${Math.round((1 - b.left / b.total) * 100)}%;background:var(--gold)"></i></div>`;
      return { b: body, a: btn('close', 'Back') };
    }
    if (K.cat === 'land') {
      body += '<p>Empty land earns nothing. Head to <b>Develop</b> to design a building, or sell it.</p>';
      return { b: body, a: btn('tab', 'Design a Building', { v: 'develop', cls: 'btn-go' }) + btn('sell', 'Sell Land', { cls: 'btn-warn' }) };
    }
    if (home) body += `<p class="hint">${icon('heart', 'inl')} You live here${n > 1 ? `, and rent out ${n - 1} more unit${n > 2 ? 's' : ''}` : ''}.</p>`;
    else body += `<p>${n > 1 ? `<b>${occ} of ${n}</b> units let.` : occ ? `Tenanted by <b>${esc(st.units[0].n)}</b> at <b>${fmt$(st.units[0].r)}/mo</b>, ${st.units[0].l} months left.` : `<span class="down">Vacant</span> for ${st.units[0]?.v || 0} month${st.units[0]?.v === 1 ? '' : 's'}.`}</p>`;
    if (!(home && n === 1)) {
      const o = rentOutlook(L, st, st.rm);
      const best = bestRent(L, st);
      body += `<div class="rentbox">
        <div class="rb-head"><span>${n > 1 ? 'Rent per unit' : 'Rent'}</span><b id="rRent">${fmt$(o.rent)}/mo</b><span id="rPct" class="muted">${Math.round(st.rm * 100)}% of market</span></div>
        <input type="range" id="rentR" min="70" max="150" step="1" value="${Math.round(st.rm * 100)}" aria-label="Rent level">
        <div class="odds">
          <div><b id="oFill">${Math.round(o.p * 100)}%</b><span>chance an empty unit lets each month</span></div>
          <div><b id="oWait">${o.wait.toFixed(1)} mo</b><span>average wait for a tenant</span></div>
          <div><b id="oRenew">${Math.round(o.renew * 100)}%</b><span>chance a tenant renews</span></div>
          <div><b id="oYear">${fmtShort(o.yearly)}</b><span>expected rent a year (<i id="oOcc">${Math.round(o.occ * 100)}%</i> occupied)</span></div>
        </div>
        <svg id="rentCurve" viewBox="0 0 300 70" class="curve" aria-hidden="true"></svg>
        <div class="rb-foot"><button class="linkbtn" data-act="best">Use ${esc(AGENT_BY_ID[G.agentId].name.split(' ')[0])}’s pick: ${Math.round(best * 100)}%</button><span class="hint">Applies to new leases and renewals.</span></div>
      </div>`;
    }
    const costs = holdCosts(L, st);
    const rent = st.units.reduce((s, u) => s + (u && u.r ? u.r : 0), 0);
    const flow = (rent - (st.loan ? st.loan.pay : 0) - costs.ins - costs.maint) * (1 - partnerShare(st));
    body += `<div class="ctl"><span class="ctl-l">Condition</span><div class="meter"><i style="width:${Math.round(st.cond * 100)}%;background:${st.cond > 0.6 ? 'var(--green)' : st.cond > 0.35 ? 'var(--gold)' : 'var(--red)'}"></i></div><span class="ctl-v">${Math.round(st.cond * 100)}%</span></div>
      ${K.strata ? `<div class="ctl"><span class="ctl-l">Strata</span><span class="ctl-v">${fmt$(costs.ins)}/mo, building insured</span></div>`
        : `<div class="ctl"><span class="ctl-l">Insurance</span><button class="toggle ${st.ins ? 'on' : ''}" data-act="ins" aria-pressed="${st.ins}" aria-label="Insurance"><i></i></button><span class="ctl-v">${st.ins ? fmt$(costs.ins) + '/mo' : 'Not insured'}</span></div>`}
      <dl class="quote small">
        ${st.loan ? `<div><dt>${esc(LENDER_BY_ID[st.loan.lender].name)}</dt><dd>${fmt$(st.loan.bal)} at ${fmtPct(st.loan.rate, 2)}</dd></div><div><dt>Repayments</dt><dd>${fmt$(st.loan.pay)}/mo</dd></div>` : '<div><dt>Loan</dt><dd>None, owned outright</dd></div>'}
        <div><dt>Rates & upkeep</dt><dd>${fmt$(costs.maint)}/mo</dd></div>
        ${partnerShare(st) ? `<div><dt>Investor share</dt><dd>${Math.round(partnerShare(st) * 100)}%</dd></div>` : ''}
        <div><dt>Your monthly cash flow</dt><dd class="${flow >= 0 ? 'up' : 'down'}">${flow >= 0 ? '+' : ''}${fmt$(flow)}</dd></div>
      </dl>`;
    const rc = renovateCost(L, st);
    let acts = btn('renovate', `Renovate <small>${fmtShort(rc)}</small>`, { dis: st.cond > 0.95 || rc > G.cash });
    if (canLiveIn(L) && !home) acts += btn('movein', `Make This My Home${moveInCost(L) ? ` <small>${fmtShort(moveInCost(L))} to break lease</small>` : ''}`);
    if (home) acts += btn('moveout', 'Move Out');
    if (st.loan) acts += btn('payoff', `Pay Off Loan <small>${fmtShort(st.loan.bal)}</small>`, { dis: st.loan.bal > G.cash });
    if (hasSkill('fin3')) acts += btn('refi', 'Refinance (release equity)');
    acts += btn('sell', 'Sell Property', { cls: 'btn-warn' });
    return { b: body, a: acts };
  },
  ownUnits(L, st, btn) {
    const isCom = segOf(kindOf(L)) !== 'res';
    let h = '';
    if (isCom) {
      h += `<div class="ctl"><span class="ctl-l">Auto-lease</span><button class="toggle ${st.auto ? 'on' : ''}" data-act="auto" aria-pressed="${st.auto}" aria-label="Auto-lease"><i></i></button><span class="ctl-v">${st.auto ? 'Your agent signs the best offer' : 'You choose every lease'}</span></div>`;
      if (st.offers && st.offers.length) {
        h += `<h3 class="sub">Lease offers</h3><div class="offers">${st.offers.map((o, i) => `<div class="offer"><div><b>${esc(o.n)}</b> <span class="cr cr${o.cr}">${o.cr}</span></div>
          <div class="o-terms">${fmt$(o.r)}/mo · ${o.y} yrs · +${fmtPct(o.e, 1)}/yr · ${o.f ? o.f + ' mo rent-free' : 'no incentive'} · ${o.net ? 'net lease' : 'gross lease'}</div>
          <button class="btn btn-sm btn-go" data-act="accept" data-v="${i}" ${st.units.some((u) => u && !u.r && !u.home) ? '' : 'disabled'}>Accept</button></div>`).join('')}</div>
          <p class="hint">Credit A = blue-chip, C = risky. Net leases mean the tenant pays most upkeep.</p>`;
      }
    }
    const rows = st.units.slice(0, 60).map((u, i) => {
      if (!u) return '';
      if (u.home) return `<tr><td>${i + 1}</td><td colspan="${isCom ? 6 : 3}">${icon('heart', 'inl')} You live here</td></tr>`;
      if (!u.r) return `<tr class="vac"><td>${i + 1}</td><td>Vacant ${u.v ? `· ${u.v} mo` : ''}</td><td>—</td><td>—</td>${isCom ? '<td></td><td></td><td></td>' : ''}</tr>`;
      return `<tr><td>${i + 1}</td><td>${esc(u.n)}</td><td>${fmt$(u.r)}${u.f ? ` <small>(${u.f} free)</small>` : ''}</td><td>${u.l} mo</td>${isCom ? `<td><span class="cr cr${u.cr || 'B'}">${u.cr || '—'}</span></td><td>${u.e ? '+' + fmtPct(u.e, 1) : '—'}</td><td>${u.net ? 'Net' : 'Gross'}</td>` : ''}</tr>`;
    }).join('');
    h += `<div class="tablewrap light"><table class="mini"><thead><tr><th>#</th><th>${isCom ? 'Business' : 'Tenant'}</th><th>Rent</th><th>Lease left</th>${isCom ? '<th>Credit</th><th>Rises</th><th>Type</th>' : ''}</tr></thead><tbody>${rows}</tbody></table></div>`;
    if (st.units.length > 60) h += `<p class="hint">Showing 60 of ${st.units.length} units.</p>`;
    return h;
  },
  ownUpgrades(L, st) {
    const E = eff(L), K = KINDS[E.kind];
    const ids = Object.keys(UPGRADES).filter((id) => upgradeAllowed(L, st, id) || st.ups[id]);
    if (!ids.length) return '<p>No upgrades available for this property.</p>';
    const gainOf = (id) => {
      const before = lotValue(L, st), rb = marketRent(L, st);
      if (id === 'fittings') { st.lux = luxOf(E, st) + 1; } else st.ups[id] = 1;
      const after = lotValue(L, st), ra = marketRent(L, st);
      if (id === 'fittings') st.lux--; else delete st.ups[id];
      return [after - before, ra - rb];
    };
    return `<p class="hint">Fittings: <b>${LUX[luxOf(E, st)]}</b> — ${LUX_FIT[luxOf(E, st)]}.</p><div class="upgrades">${ids.map((id) => {
      const U = UPGRADES[id], have = !!st.ups[id];
      if (have) return `<div class="upg have"><b>${icon('check', 'inl')} ${U.name}</b><span>${U.desc}</span>${U.tag ? chip(U.tag) : ''}</div>`;
      const c = upgradeCost(L, st, id), [dv, dr] = gainOf(id);
      return `<div class="upg"><b>${U.name}${id === 'fittings' ? ` → ${LUX[luxOf(E, st) + 1]}` : ''}</b><span>${U.desc}</span>
        <div class="upg-fx"><span class="${dv >= c ? 'up' : ''}">+${fmtShort(dv)} value</span>${dr > 1 ? `<span class="up">+${fmtShort(dr)}/mo rent</span>` : ''}${U.tag ? tagChip(L, U.tag) : ''}${U.vis ? '<span class="muted">Visible on the map</span>' : ''}</div>
        <button class="btn btn-sm" data-act="upgrade" data-v="${id}" ${c > G.cash ? 'disabled' : ''}>Add <small>${fmtShort(c)}</small></button></div>`;
    }).join('')}</div>`;
  },
  ownPlan(L, st) {
    const E = eff(L), K = KINDS[E.kind];
    const n = unitCount(E, st);
    return floorplanSVG(L, st) + `<dl class="quote small">
      <div><dt>Floor area</dt><dd>${sqmOf(E, st).toLocaleString()} m²</dd></div>
      ${K.beds && n <= 2 ? `<div><dt>Bedrooms / bathrooms</dt><dd>${bedsOf(E, st)} / ${K.baths + (st.ups && st.ups.extension ? 1 : 0)}</dd></div>` : ''}
      ${n > 1 ? `<div><dt>Units</dt><dd>${n}</dd></div>` : ''}
      ${E.floors > 1 ? `<div><dt>Floors</dt><dd>${E.floors}</dd></div>` : ''}
      <div><dt>Fittings</dt><dd>${LUX[luxOf(E, st)]}</dd></div>
      <div><dt>Style</dt><dd>${K.style || '—'}</dd></div>
    </dl><p class="hint">${LUX_FIT[luxOf(E, st)]}.</p>`;
  },
  ownPartners(L, st) {
    if (!st.partners || !st.partners.length) return '<p>You own 100% of this property. You can bring in investors when you buy.</p>';
    const eq = Math.max(0, lotValue(L, st) - (st.loan ? st.loan.bal : 0));
    return `<div class="partners">${st.partners.map((p, i) => { const X = INVESTOR_BY_ID[p.id]; return `<div class="partner-row"><i>${charSVG(X.look, 'face')}</i><div><b>${esc(X.name)}</b><span>${Math.round(p.share * 100)}% share · put in ${fmt$(p.put || 0)} · worth ${fmt$(eq * p.share)} today</span></div><button class="btn btn-sm" data-act="buyout" data-v="${i}">Buy out <small>${fmtShort(eq * p.share * 1.03)}</small></button></div>`; }).join('')}</div>`;
  },
  saleView(L, st, btn) {
    const q = sellQuote(L);
    let head, body, acts;
    if (this.sale.step === 'sold') {
      head = 'Sold!'; body = `<p>The sale went through and <b>${fmt$(this.sale.net)}</b> landed in your account.</p>`;
      acts = btn('close', 'Back to Game', { cls: 'btn-go' });
      return { head, body, acts };
    }
    const ask = this.sale.ask || q.price;
    head = 'A buyer has made an offer.';
    body = `<p>They’ll pay <b>${fmt$(q.price)}</b>. After commission (${fmt$(q.comm)})${q.debt ? `, clearing your loan (${fmt$(q.debt)})` : ''}${q.share ? ` and paying your investors their ${Math.round(q.share * 100)}%` : ''}, you’d get <b>${fmt$(q.net)}</b>.</p>
      <p>That’s a ${q.gain >= 0 ? 'profit' : 'loss'} of <b class="${q.gain >= 0 ? 'up' : 'down'}">${fmt$(Math.abs(q.gain))}</b> on what you’ve put in.</p>`;
    if (!st.q.tried) body += `<div class="field"><label for="ctrR">Counter at <b id="ctrAmt">${fmt$(ask)}</b> <span id="ctrChance" class="muted"></span></label><input type="range" id="ctrR" min="100" max="115" value="${Math.round(ask / q.price * 100)}"></div>`;
    else body += '<p class="muted">They won’t budge again this month.</p>';
    acts = btn('confirmSell', `Accept ${fmtShort(q.price)}`, { cls: 'btn-go', dis: q.net < 0 && G.cash + q.net < 0 }) + (!st.q.tried ? btn('counter', 'Counter-Offer') : '') + btn('nosell', 'Keep It');
    return { head, body, acts };
  },
  ownDevelop(L, st, btn, body) {
    const E = eff(L);
    const zone = zoneOf(L), Z = ZONES[zone];
    const opts = buildOptions(L);
    body += `<div class="zone"><span class="zbadge" style="--zc:${Z.color}">${zone}</span><div><b>${Z.name}</b><span>Allowed here: ${opts.map((k) => KINDS[k].name).join(', ') || 'nothing that fits this lot'}</span></div></div>`;
    let acts = '';
    if (st.build) {
      const b = st.build;
      body += `<p>Building a <b>${KINDS[b.kind].name}</b>${b.floors > 1 ? ` (${b.floors} floors)` : ''}. ${b.left} of ${b.total} months to go. Paid so far: ${fmt$(b.paid)} of ${fmt$(b.cost)}.</p><div class="meter big"><i style="width:${Math.round((1 - b.left / b.total) * 100)}%;background:var(--gold)"></i></div>`;
      return { b: body, a: btn('close', 'Back') };
    }
    // council
    const pend = G.council.find((c) => c.lot === L.id);
    if (pend) body += `<div class="council"><i>${charSVG(MAYOR.look, 'face')}</i><p>Your application to rezone as <b>${pend.zone}</b> is with the council. Decision in <b>${pend.left} month${pend.left === 1 ? '' : 's'}</b> (about ${Math.round(pend.chance * 100)}% likely).</p></div>`;
    else if ((G.coolZ[L.id] || 0) > G.month) body += `<p class="muted">The council won’t hear a new application for this lot until ${MONTHS[G.coolZ[L.id] % 12]} ${dateLabel(G.coolZ[L.id]).year}.</p>`;
    else {
      if (!this.rz) this.rz = { zone: Object.keys(ZONES).find((z) => z !== zone && ZONE_KINDS[z].some((k) => KINDS[k].build && KINDS[k].lots.some((s) => s[0] === L.w && s[1] === L.d))) || 'R2', donation: 0, afford: false, lobby: false, consult: false };
      const R = this.rz;
      const zs = Object.keys(ZONES).filter((z) => z !== zone && ZONE_KINDS[z].some((k) => KINDS[k].build && KINDS[k].lots.some((s) => s[0] === L.w && s[1] === L.d)));
      const ch = councilChance(L, R.zone, R);
      const fee = 15000 + (R.lobby ? 40000 : 0) + R.donation;
      const maxDon = Math.round(Math.max(200000, lotValue(L)) * 0.08 / 1000) * 1000;
      body += `<details class="council-form" ${this.rzOpen ? 'open' : ''}><summary data-act="rzopen">${icon('doc', 'inl')} Ask the council to rezone</summary>
        <div class="council"><i>${charSVG(MAYOR.look, 'face')}</i><p>${esc(MAYOR.name)}: “${DISTRICT_BY_ID[L.dist].zones.includes(R.zone) ? 'That fits our plans for the area.' : 'That’s a big ask for this neighbourhood.'} Convince me.”</p></div>
        <div class="zchips">${zs.map((z) => `<button class="zchip ${R.zone === z ? 'on' : ''}" data-act="rzzone" data-v="${z}" style="--zc:${ZONES[z].color}"><b>${z}</b><span>${ZONES[z].name}</span></button>`).join('')}</div>
        <div class="field"><label for="donR">Community contribution <b id="donAmt">${fmt$(R.donation)}</b></label><input type="range" id="donR" min="0" max="${maxDon}" step="${Math.max(1000, Math.round(maxDon / 40 / 1000) * 1000)}" value="${R.donation}"></div>
        ${ZONES[R.zone].seg === 'res' ? `<div class="ctl"><span class="ctl-l">Affordable homes pledge</span><button class="toggle ${R.afford ? 'on' : ''}" data-act="rztog" data-v="afford" aria-pressed="${R.afford}" aria-label="Affordable pledge"><i></i></button><span class="ctl-v">+12% chance, building worth 8% less</span></div>` : ''}
        <div class="ctl"><span class="ctl-l">Hire a lobbyist</span><button class="toggle ${R.lobby ? 'on' : ''}" data-act="rztog" data-v="lobby" aria-pressed="${R.lobby}" aria-label="Lobbyist"><i></i></button><span class="ctl-v">$40,000, +10% chance</span></div>
        <div class="ctl"><span class="ctl-l">Public consultation</span><button class="toggle ${R.consult ? 'on' : ''}" data-act="rztog" data-v="consult" aria-pressed="${R.consult}" aria-label="Public consultation"><i></i></button><span class="ctl-v">+2 months, helps if locals like you (goodwill ${Math.round(G.dist[L.dist].sent)})</span></div>
        <div class="chance-big"><span>Approval chance</span><b class="${ch > 0.6 ? 'up' : ch < 0.35 ? 'down' : ''}">${Math.round(ch * 100)}%</b><small>Fee ${fmt$(fee)} · decision in ${3 + (R.consult ? 2 : 0)} months</small></div>
        <button class="btn btn-go" data-act="rzsubmit" ${fee > G.cash ? 'disabled' : ''}>Submit Application</button>
      </details>`;
    }
    // demolish or build
    if (kindOf(L) !== 'land') {
      const dc = demolishCost(L);
      if (this.demo) {
        body += `<div class="confirm light"><p>Knock down the ${KINDS[kindOf(L)].name.toLowerCase()}? Demolition costs ${fmt$(dc.demo)}${dc.tenants ? ` and ${dc.tenants} tenant${dc.tenants > 1 ? 's' : ''} get ${fmt$(dc.comp)} in compensation` : ''}. Neighbours won’t love it.</p></div>`;
        acts = btn('demolish', `Demolish <small>${fmtShort(dc.demo + dc.comp)}</small>`, { cls: 'btn-warn', dis: dc.demo + dc.comp > G.cash }) + btn('nodemo', 'Cancel');
      } else {
        const best = opts.map((k) => buildQuote(L, k, KINDS[k].f0 ? KINDS[k].bf[1] : 1, KINDS[k].lux, 0)).sort((a, b) => (b.value - b.cost) - (a.value - a.cost))[0];
        if (best) body += `<p class="hint">${icon('crane', 'inl')} Under ${zone} zoning you could build a ${KINDS[best.kind].name.toLowerCase()}${best.floors > 1 ? ` of ${best.floors} floors` : ''} worth about <b>${fmtShort(best.value)}</b> for ${fmtShort(best.cost)}.</p>`;
        acts = btn('askdemo', 'Demolish to Rebuild', { cls: 'btn-warn' }) + btn('close', 'Back');
      }
      return { b: body, a: acts };
    }
    if (!opts.length) { body += '<p>Nothing in this zone fits this lot. Try rezoning it.</p>'; return { b: body, a: btn('close', 'Back') }; }
    if (!this.design || !opts.includes(this.design.kind)) { const k = opts[0]; this.design = { kind: k, floors: KINDS[k].f0 || 1, lux: KINDS[k].lux, look: 0, loan: false }; }
    const D = this.design, K = KINDS[D.kind];
    const q = buildQuote(L, D.kind, D.floors, D.lux, D.look);
    const land = landValue(L);
    const profit = q.value - q.cost - land;
    body += `<h3 class="sub">Design a building</h3>
      <div class="kchips">${opts.map((k) => `<button class="kchip ${D.kind === k ? 'on' : ''}" data-act="dkind" data-v="${k}"><img src="${thumbURL(Object.assign({}, L, { kind: k, floors: KINDS[k].f0 || 1, lux: KINDS[k].lux, look: 0, ups: {} }), 72, 54)}" alt="" width="72" height="54"><span>${KINDS[k].name}</span></button>`).join('')}</div>
      ${K.bf ? `<div class="field"><label for="flR">Size <b>${D.floors} floors</b> <span class="muted">${q.units} units</span></label><input type="range" id="flR" min="${K.bf[0]}" max="${K.bf[1]}" value="${D.floors}"></div>` : ''}
      <div class="field"><label for="luxR">Luxury <b>${LUX[D.lux]}</b> <span class="muted">${LUX_FIT[D.lux]}</span></label><input type="range" id="luxR" min="0" max="3" value="${D.lux}"></div>
      <div class="looks"><span class="ctl-l">Look</span>${[0, 1, 2, 3].map((i) => `<button class="look ${D.look === i ? 'on' : ''}" data-act="dlook" data-v="${i}" aria-label="Appearance ${i + 1}"><img src="${thumbURL(Object.assign({}, L, { kind: D.kind, floors: D.floors, lux: D.lux, look: i, ups: {} }), 64, 64)}" alt="" width="64" height="64"></button>`).join('')}</div>
      <dl class="quote small">
        <div><dt>Floor area</dt><dd>${q.sqm.toLocaleString()} m²${q.units > 1 ? ` · ${q.units} units` : ''}</dd></div>
        <div><dt>Construction cost</dt><dd>${fmt$(q.cost)}</dd></div>
        <div><dt>Build time</dt><dd>${q.months} months</dd></div>
        <div><dt>Value when finished</dt><dd>${fmt$(q.value)}</dd></div>
        <div><dt>Expected rent</dt><dd>${fmt$(q.rent * 1.08)}/mo</dd></div>
        <div><dt>Profit vs land + build cost</dt><dd class="${profit >= 0 ? 'up' : 'down'}">${profit >= 0 ? '+' : ''}${fmt$(profit)}</dd></div>
      </dl>
      <div class="ctl"><span class="ctl-l">Construction loan</span><button class="toggle ${D.loan ? 'on' : ''}" data-act="dloan" aria-pressed="${D.loan}" aria-label="Construction loan"><i></i></button><span class="ctl-v">${D.loan ? 'Bank funds 60% as you build' : 'Pay from cash month by month'}</span></div>
      <details><summary>${icon('plan', 'inl')} Floorplan preview</summary>${floorplanSVG(this.designPreview(), null)}</details>`;
    acts = btn('build', `Start Construction <small>${fmtShort(D.loan ? q.cost * 0.1 : q.cost / q.months * 2)} to start</small>`, { cls: 'btn-go' }) + btn('close', 'Back');
    return { b: body, a: acts };
  },
  designPreview() {
    const D = this.design, L = this.L;
    return Object.assign({}, L, { kind: D.kind, floors: KINDS[D.kind].f0 ? D.floors : 1, lux: D.lux, look: D.look, ups: {} });
  },

  // ── wiring ──
  bind() {
    const s = Modal.sheet, L = this.L, st = lotState(L.id);
    const rr = $('#rentR', s);
    if (rr) {
      const drawCurve = (m) => {
        const svg = $('#rentCurve', s); if (!svg) return;
        const pts = [];
        let max = 1;
        for (let x = 0.7; x <= 1.5001; x += 0.04) { const o = rentOutlook(L, st, x); pts.push([x, o.yearly]); max = Math.max(max, o.yearly); }
        const X = (x) => (x - 0.7) / 0.8 * 290 + 5, Y = (y) => 64 - y / max * 56;
        const best = bestRent(L, st);
        svg.innerHTML = `<polyline points="${pts.map(([x, y]) => X(x).toFixed(1) + ',' + Y(y).toFixed(1)).join(' ')}" fill="none" stroke="#f08a24" stroke-width="2.5"/>
          <line x1="${X(m)}" y1="4" x2="${X(m)}" y2="66" stroke="#3b2412" stroke-width="1.5" stroke-dasharray="3 3"/>
          <circle cx="${X(best)}" cy="${Y(rentOutlook(L, st, best).yearly)}" r="4" fill="#3e9b4f"/>
          <text x="5" y="68" class="cv-l">70%</text><text x="295" y="68" text-anchor="end" class="cv-l">150%</text><text x="${X(best)}" y="${Math.max(10, Y(rentOutlook(L, st, best).yearly) - 6)}" text-anchor="middle" class="cv-l">best</text>`;
      };
      const upd = () => {
        const m = rr.value / 100;
        const o = rentOutlook(L, st, m);
        $('#rRent', s).textContent = fmt$(o.rent) + '/mo';
        $('#rPct', s).textContent = Math.round(m * 100) + '% of market';
        $('#oFill', s).textContent = Math.round(o.p * 100) + '%';
        $('#oWait', s).textContent = o.wait.toFixed(1) + ' mo';
        $('#oRenew', s).textContent = Math.round(o.renew * 100) + '%';
        $('#oYear', s).textContent = fmtShort(o.yearly);
        $('#oOcc', s).textContent = Math.round(o.occ * 100) + '%';
        $('#oFill', s).className = o.p > 0.5 ? 'up' : o.p < 0.2 ? 'down' : '';
        drawCurve(m);
      };
      rr.addEventListener('input', upd);
      rr.addEventListener('change', () => { st.rm = rr.value / 100; Game.saveSoon(); });
      upd();
    }
    const offR = $('#offR', s);
    if (offR) {
      const N = this.N, lst = listing(L.id);
      const upd = () => {
        const amt = Math.round(N.list * offR.value / 100 / 1000) * 1000;
        N.offer = amt;
        $('#offAmt', s).textContent = fmt$(amt);
        $('#offPct', s).textContent = lst ? `(${offR.value}% of asking)` : `(${Math.round(amt / lotValue(L) * 100)}% of value)`;
      };
      offR.addEventListener('input', upd); upd();
    }
    const ctr = $('#ctrR', s);
    if (ctr) {
      const upd = () => { const q = st.q.p; const a = Math.round(q * ctr.value / 100 / 1000) * 1000; this.sale.ask = a; $('#ctrAmt', s).textContent = fmt$(a); $('#ctrChance', s).textContent = `(${Math.round(counterChance(L, a) * 100)}% they agree)`; };
      ctr.addEventListener('input', upd); upd();
    }
    const live = (id, fn) => { const el = $(id, s); if (el) el.addEventListener('change', () => { fn(+el.value); this.render(); }); };
    live('#depR', (v) => { this.pay.dep = v / 100; });
    live('#shareR', (v) => { this.pay.share = v / 100; });
    live('#flR', (v) => { this.design.floors = v; });
    live('#luxR', (v) => { this.design.lux = v; });
    const don = $('#donR', s);
    if (don) {
      don.addEventListener('input', () => { $('#donAmt', s).textContent = fmt$(+don.value); });
      don.addEventListener('change', () => { this.rz.donation = +don.value; this.rzOpen = true; this.render(); });
    }
    $$('input[name="lender"]', s).forEach((r) => r.addEventListener('change', (e) => {
      const l = LENDER_BY_ID[e.target.value];
      if (G.rep < l.minRep) { Sound.play('error'); this.render(); return; }
      this.pay.lender = l; Sound.play('tab'); this.render();
    }));
    const det = $('.council-form', s);
    if (det) det.addEventListener('toggle', () => { this.rzOpen = det.open; });
  },
  act(a, el) {
    const L = this.L, st = lotState(L.id), v = el && el.dataset.v;
    this.msg = '';
    const fail = (r) => { this.msg = r.reason || 'That didn’t work.'; Sound.play('error'); };
    switch (a) {
      case 'close': Sound.play('click'); Modal.close(); return;
      case 'plan': this.showPlan = !this.showPlan; break;
      case 'nego': this.step = 'nego'; Sound.play('tab'); break;
      case 'inspect': { const r = negoInspect(this.N); if (!r.ok) fail(r); else Sound.play('coin'); break; }
      case 'payask': this.N.price = this.N.list; this.N.done = true; this.toPay(); break;
      case 'offer': { const r = negoOffer(this.N, this.N.offer || this.N.ask); Sound.play(r === 'accept' ? 'coin' : r === 'walk' ? 'bad' : 'news'); break; }
      case 'takeask': negoAcceptAsk(this.N); Sound.play('coin'); break;
      case 'walk': this.N.done = true; G.cool[L.id] = G.month; this.N.log.push({ me: true, t: 'We’ll pass for now.' }); break;
      case 'sweet': negoSweetener(this.N, v); Sound.play('tab'); break;
      case 'discount': negoDiscount(this.N); Sound.play('coin'); break;
      case 'topay': this.toPay(); break;
      case 'method': this.pay.method = v; Sound.play('tab'); break;
      case 'years': this.pay.years = +v; Sound.play('tab'); break;
      case 'partner': this.pay.partner = this.pay.partner === v ? null : v; this.pay.share = 0.25; Sound.play('tab'); break;
      case 'buy': {
        const P_ = this.pay;
        const r = buy(L, { price: this.N.price, loan: P_.method === 'loan' ? { lender: P_.lender, dep: P_.dep, years: P_.years } : null, partner: P_.partner ? { id: P_.partner, share: P_.share } : null, inspected: this.N.inspected });
        if (!r.ok) { fail(r); break; }
        Sound.play('buy'); this.step = 'done'; UI.afterChange(); break;
      }
      case 'manage': this.mode = 'own'; this.tab = 'overview'; break;
      case 'tab': this.tab = v; this.sale = null; this.demo = false; Sound.play('tab'); break;
      case 'best': st.rm = bestRent(L, st); Sound.play('tab'); Game.saveSoon(); break;
      case 'ins': st.ins = !st.ins; Sound.play('tab'); break;
      case 'auto': st.auto = !st.auto; Sound.play('tab'); break;
      case 'accept': if (acceptOffer(L, +v)) { Sound.play('coin'); UI.afterChange(); } break;
      case 'renovate': { const r = renovate(L); if (!r.ok) fail(r); else { Sound.play('coin'); UI.afterChange(); } break; }
      case 'upgrade': { const r = upgrade(L, v); if (!r.ok) fail(r); else { Sound.play('buy'); floatText(L, UPGRADES[v].name + '!', '#bff0c8'); UI.afterChange(); } break; }
      case 'payoff': { const r = payOff(L); if (!r.ok) fail(r); else { Sound.play('coin'); UI.afterChange(); } break; }
      case 'refi': { const r = refinance(L); if (!r.ok) fail(r); else { this.msg = ''; Sound.play('coin'); UI.toast({ kind: 'loan', title: 'Equity released', text: `${fmt$(r.draw)} added to your cash.`, good: true }); UI.afterChange(); } break; }
      case 'movein': { const r = moveIn(L); if (!r.ok) fail(r); else { Sound.play('buy'); floatText(L, 'Home sweet home!', '#ffd0e0'); UI.afterChange(); } break; }
      case 'moveout': moveOut(); Sound.play('tab'); UI.afterChange(); break;
      case 'sell': this.sale = { step: 'offer' }; sellQuote(L); Sound.play('tab'); break;
      case 'nosell': this.sale = null; break;
      case 'counter': { const ok = counterSale(L, this.sale.ask); Sound.play(ok ? 'coin' : 'bad'); if (!ok) this.msg = 'The buyer said no to your counter. Their original offer still stands.'; break; }
      case 'confirmSell': { const r = sell(L); if (!r.ok) { fail(r); this.sale = null; break; } this.sale = { step: 'sold', net: r.net }; Sound.play('sell'); UI.afterChange(); break; }
      case 'buyout': { const r = buyOutPartner(L, +v); if (!r.ok) fail(r); else { Sound.play('coin'); UI.afterChange(); } break; }
      case 'rzopen': this.rzOpen = !this.rzOpen; return;
      case 'rzzone': this.rz.zone = v; this.rzOpen = true; Sound.play('tab'); break;
      case 'rztog': this.rz[v] = !this.rz[v]; this.rzOpen = true; Sound.play('tab'); break;
      case 'rzsubmit': { const r = applyRezone(L, this.rz.zone, this.rz); if (!r.ok) fail(r); else { Sound.play('news'); this.rz = null; UI.afterChange(); } break; }
      case 'askdemo': this.demo = true; break;
      case 'nodemo': this.demo = false; break;
      case 'demolish': { const r = demolish(L); this.demo = false; if (!r.ok) fail(r); else { Sound.play('bad'); floatText(L, 'Kaboom!', '#ffd0a0'); UI.afterChange(); } break; }
      case 'dkind': { const K = KINDS[v]; this.design = { kind: v, floors: K.f0 || 1, lux: K.lux, look: this.design ? this.design.look : 0, loan: this.design ? this.design.loan : false }; Sound.play('tab'); break; }
      case 'dlook': this.design.look = +v; Sound.play('tab'); break;
      case 'dloan': this.design.loan = !this.design.loan; Sound.play('tab'); break;
      case 'build': {
        const D = this.design, q = buildQuote(L, D.kind, D.floors, D.lux, D.look);
        const r = startBuild(L, q, D.loan);
        if (!r.ok) fail(r); else { Sound.play('buy'); floatText(L, 'Groundbreaking!', '#ffe48a'); this.tab = 'overview'; UI.afterChange(); }
        break;
      }
    }
    this.render();
  },
  toPay() { this.step = 'pay'; this.pay = { method: G.cash > this.N.price * 1.06 ? 'cash' : 'loan', lender: null, dep: 0.2, years: 30, partner: null, share: 0.25 }; Sound.play('tab'); },
};
function offerCooling(L) { return G.cool[L.id] === G.month; }
