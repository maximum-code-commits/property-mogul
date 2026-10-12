'use strict';
// ───────────────────────── online hub: leaderboard, friends, co-op deals, lending, profile ─────────────────────────
const LOAN_TERMS = [6, 12, 24, 36, 60];
function p2pPay(amount, apyPct, term, type) {
  const r = apyPct / 100 / 12;
  if (type === 'io') return amount * r;
  return r ? amount * r / (1 - Math.pow(1 + r, -term)) : amount / term;
}
function playerFace(p) {
  const A = p && AGENT_BY_ID[p.agent];
  return charSVG(A ? A.look : lookFor('friend', (p && p.handle || '').length * 13 + 7), 'face');
}
const ago = (t) => {
  if (!t) return '';
  const s = (Date.now() - t) / 1000;
  return s < 90 ? 'just now' : s < 3600 ? `${Math.round(s / 60)} min ago` : s < 86400 ? `${Math.round(s / 3600)} h ago` : `${Math.round(s / 86400)} d ago`;
};
const credit = (n) => (n ? `<span class="credit" title="Loans repaid on time">${icon('check', 'inl')} ${n} repaid</span>` : '<span class="credit new">New borrower</span>');

const Social = {
  tab: 'board', sub: null, msg: '', busy: false,
  board: null, scope: 'global', sort: 'net',
  fr: null, q: '', results: null,
  deals: null, draft: null, pledge: {},
  loans: null, lf: { kind: 'offer', amount: 100000, apy: 7, term: 24, type: 'amort', vis: 'friends', note: '' },
  prof: null, editing: false, confirmDel: false,

  open(tab, o = {}) {
    if (tab) this.tab = tab;
    this.sub = o.handle || null; this.msg = ''; this.confirmDel = false; this.editing = false;
    if (o.draft) { this.draft = o.draft; this.tab = 'deals'; }
    Sound.play('click');
    Modal.show('m-panel m-social', this);
    this.load();
  },
  async load() {
    if (!Net.on) return;
    const t = this.tab, sub = this.sub;
    try {
      if (sub) this.prof = await Net.get(`/api/players/${encodeURIComponent(sub)}`);
      else if (t === 'board') this.board = await Net.get(`/api/leaderboard?scope=${this.scope}&sort=${this.sort}`);
      else if (t === 'friends') this.fr = await Net.get('/api/friends');
      else if (t === 'deals') { Net.sync(true); this.deals = await Net.get('/api/deals'); }
      else if (t === 'loans') { this.loans = await Net.get('/api/loans'); }
      else if (t === 'me') await Net.loadWatch();
    } catch (e) { this.msg = e.message; }
    if (Modal.view === this) this.render();
  },
  refreshSoft() {
    const a = document.activeElement;
    if (a && Modal.sheet.contains(a) && /INPUT|SELECT|TEXTAREA/.test(a.tagName)) return;
    if (this.tab === 'loans' || this.tab === 'deals') this.load();
  },

  render() {
    let inner;
    if (!Net.avail) inner = '<div class="empty-state"><p>Online play needs the game’s server. Open the game from its website to sign in with Apple or Google.</p></div>';
    else if (!Net.on) inner = this.signInHTML();
    else if (this.sub) inner = this.profileHTML();
    else {
      const c = Net.counts;
      inner = tabsHTML([['board', 'Leaderboard'], ['friends', 'Friends', c.requests], ['deals', 'Co-op Deals', c.deals], ['loans', 'Lending', c.loans], ['me', 'My Profile']], this.tab);
      inner += this.tab === 'board' ? this.boardHTML() : this.tab === 'friends' ? this.friendsHTML() : this.tab === 'deals' ? this.dealsHTML() : this.tab === 'loans' ? this.loansHTML() : this.meHTML();
    }
    if (this.msg) inner += `<p class="warn sticky-msg">${esc(this.msg)}</p>`;
    Modal.sheet.innerHTML = panelHTML(this.sub ? `<button class="backbtn" data-act="back" aria-label="Back">‹</button> Player` : 'Online', inner, { cls: 'social' });
    this.bind();
  },
  signInHTML() {
    const p = Net.providers;
    return `<div class="signin">
      <div class="signin-art">${['margot', 'sunny', 'theo'].map((id) => `<i>${charSVG(AGENT_BY_ID[id].look, 'face', 'happy')}</i>`).join('')}</div>
      <h3>Play with friends</h3>
      <p>Sign in to save your empire online, climb the live leaderboard, team up on property deals, lend each other money at your own rates, and share your portfolio.</p>
      ${signInButtons(p)}
      <p class="muted small">We only keep a private account id and your first name. No emails, no passwords.</p></div>`;
  },

  // ── leaderboard ──
  boardHTML() {
    const B = this.board;
    const sorts = [['net', 'Net worth'], ['props', 'Properties'], ['rep', 'Reputation'], ['level', 'Level'], ['gen', 'Generation']];
    let h = `<div class="board-ctl"><div class="seg">${[['global', 'Everyone'], ['friends', 'Friends']].map(([k, l]) => `<button class="${this.scope === k ? 'on' : ''}" data-act="scope" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="chips-row">${sorts.map(([k, l]) => `<button class="pchip ${this.sort === k ? 'on' : ''}" data-act="sort" data-v="${k}">${l}</button>`).join('')}</div></div>`;
    if (!B) return h + '<p class="muted loading">Loading the leaderboard…</p>';
    if (!B.rows.length) return h + `<div class="empty-state"><p>${this.scope === 'friends' ? 'Add friends to race them here.' : 'No one has posted a score yet. Be the first!'}</p></div>`;
    const val = (r) => this.sort === 'net' ? fmtShort(r.net) : this.sort === 'props' ? `${r.props} props` : this.sort === 'rep' ? `${r.rep} rep` : this.sort === 'level' ? `Lv ${r.level}` : `Gen ${r.gen}`;
    h += `<ol class="board online">${B.rows.map((r, i) => `<li class="${r.me ? 'you' : r.friend ? 'friend' : ''}" data-act="player" data-v="${esc(r.handle)}" tabindex="0">
        <span class="rank">${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</span><i class="pface">${playerFace(r)}</i>
        <span class="who"><b>${esc(r.name)}${r.fam ? ' ' + esc(r.fam) : ''}</b><small>@${esc(r.handle)} · ${r.props} properties${r.gen > 1 ? ` · gen ${r.gen}` : ''}${r.friend ? ' · friend' : ''}${G && r.seed === G.seed && !r.me ? ' · your city' : ''}</small></span>
        <span class="spark-cell">${sparkline(r.spark, 64, 22)}</span><span class="worth">${val(r)}</span></li>`).join('')}</ol>`;
    if (B.myRank) h += `<p class="panel-note">You’re #${B.myRank} ${this.scope === 'friends' ? 'among friends' : 'worldwide'}. Tap anyone to see their portfolio.</p>`;
    return h;
  },

  // ── friends ──
  friendsHTML() {
    const F = this.fr;
    let h = `<form class="searchbar" data-form="search"><input id="fq" placeholder="Find players by name or @handle" value="${esc(this.q)}" maxlength="24" autocomplete="off" enterkeyhint="search"><button class="btn btn-sm btn-go" type="submit">Search</button></form>`;
    if (this.results) {
      h += this.results.length ? `<div class="plist">${this.results.map((r) => this.personRow(r, `<button class="btn btn-sm" data-act="addfriend" data-v="${esc(r.handle)}">Add friend</button>`)).join('')}</div>` : '<p class="muted">No players found.</p>';
    }
    if (!F) return h + '<p class="muted loading">Loading friends…</p>';
    if (F.incoming.length) h += `<h3 class="sec">Friend requests</h3><div class="plist">${F.incoming.map((r) => this.personRow(r, `<button class="btn btn-sm btn-go" data-act="accept" data-v="${esc(r.handle)}">Accept</button><button class="btn btn-sm" data-act="decline" data-v="${esc(r.handle)}">Decline</button>`)).join('')}</div>`;
    h += `<h3 class="sec">Friends <small>${F.friends.length}</small></h3>`;
    h += F.friends.length ? `<div class="plist">${F.friends.map((r) => this.personRow(r, `<span class="worth">${fmtShort(r.net)}</span>`, true)).join('')}</div>`
      : `<div class="empty-state"><p>No friends yet. Search above, or send your profile link so they can add you.</p><button class="btn btn-go" data-act="share">Share my profile link</button></div>`;
    if (F.outgoing.length) h += `<h3 class="sec">Waiting for a reply</h3><div class="plist">${F.outgoing.map((r) => this.personRow(r, `<button class="btn btn-sm" data-act="unfriend" data-v="${esc(r.handle)}">Cancel</button>`)).join('')}</div>`;
    return h;
  },
  personRow(r, right, clickable = true) {
    const same = G && r.seed === G.seed;
    return `<div class="prow"><button class="prow-main" data-act="player" data-v="${esc(r.handle)}" ${clickable ? '' : 'disabled'}><i class="pface">${playerFace(r)}</i><span><b>${esc(r.name)}</b><small>@${esc(r.handle)}${r.props != null ? ` · ${r.props} properties` : ''}${same ? ' · <em>your city</em>' : ''}${r.t ? ` · ${ago(r.t)}` : ''}</small></span></button><div class="prow-act">${right}</div></div>`;
  },

  // ── co-op deals ──
  dealsHTML() {
    const D = this.deals;
    let h = '';
    if (this.draft) h += this.draftHTML();
    else h += `<p class="hint">${icon('handshake', 'inl')} Open any property in your city and tap <b>Go In With Friends</b> to raise money for it. Friends chip in, you buy and manage it, and their share of the rent and sale is paid to them automatically.</p>`;
    if (!D) return h + '<p class="muted loading">Loading deals…</p>';
    if (D.lead.length) h += `<h3 class="sec">Deals you lead</h3><div class="cards codeals">${D.lead.map((d) => this.leadCard(d)).join('')}</div>`;
    h += `<h3 class="sec">Friends’ deals open to you</h3>`;
    h += D.open.length ? `<div class="cards codeals">${D.open.map((d) => this.openCard(d)).join('')}</div>` : '<p class="muted">Nothing open right now. When a friend raises money for a property it shows up here.</p>';
    const mine = D.joined.filter((d) => d.status !== 'closed' || d.shares.some((s) => s.handle === Net.me.handle && s.paid > 0));
    if (mine.length) h += `<h3 class="sec">Your stakes</h3><div class="cards codeals">${mine.map((d) => this.stakeCard(d)).join('')}</div>`;
    return h;
  },
  draftHTML() {
    const d = this.draft, pct = d.target / d.price;
    return `<div class="card draft"><div class="card-top"><img src="${thumbURL(eff(d.L), 72, 54)}" alt="" width="72" height="54"><div><b>Raise money for ${esc(d.L.addr)}</b><small>${esc(KINDS[kindOf(d.L)].name)} · ${esc(DISTRICT_BY_ID[d.L.dist].name)} · about ${fmtShort(d.price)}</small></div></div>
      <div class="field"><label for="dT">Raise from friends <b id="dTv">${fmt$(d.target)}</b> <span class="muted" id="dTp">${Math.round(pct * 100)}% of the price</span></label><input type="range" id="dT" min="10" max="70" value="${Math.round(pct * 100)}"></div>
      <div class="field"><label>Smallest stake</label><div class="seg">${[0, 10000, 25000, 50000, 100000].map((v) => `<button class="${d.minPut === v ? 'on' : ''}" data-act="dmin" data-v="${v}">${v ? fmtShort(v) : 'Any'}</button>`).join('')}</div></div>
      <div class="field"><label for="dN">Pitch to your friends</label><input id="dN" maxlength="200" value="${esc(d.note)}" placeholder="e.g. Beachfront, great holiday-let potential"></div>
      <p class="hint">Friends’ money arrives when you close funding. Their share of the property is what their money pays for, and you keep managing it.</p>
      <div class="row"><button class="btn btn-go" data-act="dcreate" ${this.busy ? 'disabled' : ''}>Invite Friends to Chip In</button><button class="btn" data-act="dcancel">Not Now</button></div></div>`;
  },
  progress(raised, target) {
    const p = clamp(raised / Math.max(1, target), 0, 1);
    return `<div class="raise"><div class="bar"><i style="width:${(p * 100).toFixed(1)}%"></i></div><small>${fmtShort(raised)} of ${fmtShort(target)} raised</small></div>`;
  },
  dealHead(d, who) {
    return `<div class="card-top"><i class="pface">${playerFace(d.lead || Net.me)}</i><div><b>${esc(d.addr)}</b><small>${esc(d.kind)} · ${esc(d.dist)}${who ? ` · led by ${esc(who)}` : ''}</small></div><span class="price">${fmtShort(d.price)}</span></div>`;
  },
  leadCard(d) {
    const st = { open: 'Taking money', funded: 'Funded, ready to buy', active: 'Owned together' }[d.status];
    const same = G && d.seed === G.seed;
    let acts = '';
    if (d.status === 'open') acts = `<button class="btn btn-sm btn-go" data-act="dclose" data-v="${d.id}" ${d.raised > 0 ? '' : 'disabled'}>Close Funding &amp; Collect ${fmtShort(d.raised)}</button><button class="btn btn-sm btn-warn" data-act="dkill" data-v="${d.id}">Cancel</button>`;
    if (d.status === 'funded') acts = `${same ? `<button class="btn btn-sm btn-go" data-act="dgo" data-v="${d.lot}">Go Buy It</button>` : ''}<button class="btn btn-sm btn-warn" data-act="dkill" data-v="${d.id}">Cancel &amp; Return ${fmtShort(d.raised)}</button>`;
    if (d.status === 'active' && same) acts = `<button class="btn btn-sm" data-act="dgo" data-v="${d.lot}">Open Property</button>`;
    return `<div class="card codeal ${d.status}">${this.dealHead(d)}<p class="dstatus">${st}${d.status === 'active' ? ` · your partners’ equity ${fmtShort(d.value * d.shares.reduce((s, x) => s + x.pct, 0))}` : ''}</p>
      ${d.status === 'open' ? this.progress(d.raised, d.target) : ''}
      <div class="backers">${d.shares.length ? d.shares.map((s) => `<span class="pchip"><i>${playerFace(s)}</i>${esc(s.name)} ${fmtShort(s.amount)}${s.pct ? ` · ${Math.round(s.pct * 100)}%` : ''}</span>`).join('') : '<span class="muted">No backers yet. Tell your friends!</span>'}</div>
      ${!same ? '<p class="muted small">This deal is in a different city from the one you’re playing.</p>' : ''}
      <div class="row">${acts}</div></div>`;
  },
  openCard(d) {
    const room = Math.max(0, d.target - d.raised), lo = Math.max(1000, d.minPut), hi = Math.min(room, Math.max(0, G.cash));
    const v = clamp(this.pledge[d.id] || Math.min(hi, Math.max(lo, Math.round(room / 2 / 1000) * 1000)), lo, Math.max(lo, hi));
    this.pledge[d.id] = v;
    return `<div class="card codeal">${this.dealHead(d, d.lead && d.lead.name)}${d.note ? `<p class="pitch">“${esc(d.note)}”</p>` : ''}
      ${this.progress(d.raised, d.target)}
      <p class="muted small">${d.backers} backer${d.backers === 1 ? '' : 's'}${d.minPut ? ` · minimum ${fmtShort(d.minPut)}` : ''}</p>
      ${hi >= lo ? `<div class="field"><label for="pl${d.id}">Chip in <b id="plv${d.id}">${fmt$(v)}</b> <span class="muted" id="plp${d.id}">≈ ${(v / d.price * 100).toFixed(1)}% of the property</span></label><input type="range" class="plr" data-deal="${d.id}" data-price="${d.price}" id="pl${d.id}" min="${lo}" max="${hi}" step="1000" value="${v}"></div>
        <button class="btn btn-sm btn-go" data-act="pledge" data-v="${d.id}">Chip In</button>` : `<p class="muted">${room < lo ? 'This deal is fully funded.' : `You need at least ${fmtShort(lo)} in cash to join.`}</p>`}</div>`;
  },
  stakeCard(d) {
    const me = d.shares.find((s) => s.handle === Net.me.handle) || { amount: 0, pct: 0, paid: 0 };
    const st = { open: 'Raising money', funded: 'Funded, waiting for the purchase', active: 'Earning rent', closed: 'Sold', cancelled: 'Cancelled' }[d.status];
    return `<div class="card codeal ${d.status}">${this.dealHead(d, d.lead && d.lead.name)}
      <dl class="quote"><div><dt>Status</dt><dd>${st}</dd></div><div><dt>You put in</dt><dd>${fmt$(me.amount)}</dd></div>
      ${me.pct ? `<div><dt>Your share</dt><dd>${(me.pct * 100).toFixed(1)}%</dd></div><div><dt>Worth today</dt><dd>${fmt$(d.value * me.pct)}</dd></div>` : ''}
      <div><dt>Paid to you so far</dt><dd class="up">${fmt$(me.paid)}</dd></div></dl>
      ${d.status === 'open' ? `<div class="row"><button class="btn btn-sm" data-act="unpledge" data-v="${d.id}">Pull My Money Out</button></div>` : ''}</div>`;
  },

  // ── lending ──
  loansHTML() {
    const f = this.lf, L = this.loans;
    const max = f.kind === 'offer' ? Math.max(10000, Math.min(5e6, Math.floor(G.cash / 1000) * 1000)) : 5e6;
    f.amount = clamp(f.amount, 10000, max);
    const pay = p2pPay(f.amount, f.apy, f.term, f.type), total = f.type === 'io' ? pay * f.term + f.amount : pay * f.term;
    const bank = typeof lenderRate === 'function' ? lenderRate(LENDERS[0]) * 100 : 6;
    let h = `<div class="card lendform"><div class="seg wide">${[['offer', 'Lend money'], ['request', 'Borrow money']].map(([k, l]) => `<button class="${f.kind === k ? 'on' : ''}" data-act="lkind" data-v="${k}">${l}</button>`).join('')}</div>
      <div class="field"><label for="lA">Amount <b id="lAv">${fmt$(f.amount)}</b></label><input type="range" id="lA" min="10000" max="${max}" step="5000" value="${f.amount}" ${f.kind === 'offer' && G.cash < 10000 ? 'disabled' : ''}></div>
      <div class="field"><label for="lR">Interest <b id="lRv">${f.apy.toFixed(2)}% APY</b> <span class="muted">bank mortgages ≈ ${bank.toFixed(2)}%</span></label><input type="range" id="lR" min="0" max="25" step="0.25" value="${f.apy}"></div>
      <div class="field"><label>Term</label><div class="seg">${LOAN_TERMS.map((t) => `<button class="${f.term === t ? 'on' : ''}" data-act="lterm" data-v="${t}">${t < 12 ? t + ' mo' : t / 12 + ' yr'}</button>`).join('')}</div></div>
      <div class="field"><label>Repayment</label><div class="seg wide">${[['amort', 'Monthly, paid down'], ['io', 'Interest only + balloon']].map(([k, l]) => `<button class="${f.type === k ? 'on' : ''}" data-act="ltype" data-v="${k}">${l}</button>`).join('')}</div></div>
      <div class="field"><label>Who can see it</label><div class="seg wide">${[['friends', 'Friends'], ['public', 'Everyone']].map(([k, l]) => `<button class="${f.vis === k ? 'on' : ''}" data-act="lvis" data-v="${k}">${l}</button>`).join('')}</div></div>
      <div class="field"><label for="lN">Note</label><input id="lN" maxlength="160" value="${esc(f.note)}" placeholder="${f.kind === 'offer' ? 'e.g. For first-home buyers' : 'e.g. Bridging a beach-house purchase'}"></div>
      <dl class="quote" id="lQ">${this.loanQuote(f.amount, pay, total, f)}</dl>
      <button class="btn btn-go" data-act="lpost" ${this.busy || (f.kind === 'offer' && G.cash < f.amount) ? 'disabled' : ''}>${f.kind === 'offer' ? `Offer ${fmtShort(f.amount)} at ${f.apy}%` : `Ask for ${fmtShort(f.amount)} at ${f.apy}%`}</button>
      <p class="muted small">${f.kind === 'offer' ? 'The money is set aside from your cash until someone takes the loan or you withdraw it.' : 'A friend who funds your request sends the money straight to your cash.'} Repayments come out monthly on the borrower’s game clock.</p></div>`;
    if (!L) return h + '<p class="muted loading">Loading the loan market…</p>';
    const offers = L.market.filter((l) => l.kind === 'offer'), reqs = L.market.filter((l) => l.kind === 'request');
    h += `<h3 class="sec">Loans you can take</h3>${offers.length ? `<div class="plist">${offers.map((l) => this.loanRow(l, 'take')).join('')}</div>` : '<p class="muted">No loan offers right now.</p>'}`;
    h += `<h3 class="sec">Players asking to borrow</h3>${reqs.length ? `<div class="plist">${reqs.map((l) => this.loanRow(l, 'fund')).join('')}</div>` : '<p class="muted">No requests right now.</p>'}`;
    const mine = L.mine;
    if (mine.length) h += `<h3 class="sec">Your loans</h3><div class="plist">${mine.map((l) => this.myLoanRow(l)).join('')}</div>`;
    return h;
  },
  loanQuote(amount, pay, total, f) {
    return `<div><dt>${f.type === 'io' ? 'Monthly interest' : 'Monthly payment'}</dt><dd>${fmt$(pay)}</dd></div>
      ${f.type === 'io' ? `<div><dt>Balloon at the end</dt><dd>${fmt$(amount)}</dd></div>` : ''}
      <div><dt>Total interest</dt><dd class="${f.kind === 'offer' ? 'up' : 'down'}">${fmt$(total - amount)}</dd></div>
      <div><dt>${f.kind === 'offer' ? 'You get back' : 'You pay back'}</dt><dd>${fmt$(total)}</dd></div>`;
  },
  loanRow(l, act) {
    const p = act === 'take' ? l.lender : l.borrower;
    const pay = p2pPay(l.amount, l.apy, l.term, l.type);
    const can = act === 'take' || G.cash >= l.amount;
    return `<div class="prow loan"><button class="prow-main" data-act="player" data-v="${esc(p.handle)}"><i class="pface">${playerFace(p)}</i><span><b>${fmtShort(l.amount)} at ${l.apy}% · ${l.term} mo</b><small>${esc(p.name)} · ${l.type === 'io' ? 'interest only' : 'amortizing'} · ${fmt$(pay)}/mo${act === 'fund' ? ' · ' : ''}${act === 'fund' ? credit(p.repaid) : ''}${l.note ? ` · “${esc(l.note)}”` : ''}</small></span></button>
      <div class="prow-act"><button class="btn btn-sm ${act === 'take' ? 'btn-go' : ''}" data-act="${act}" data-v="${l.id}" ${can ? '' : 'disabled'}>${act === 'take' ? 'Take Loan' : 'Fund It'}</button></div></div>`;
  },
  myLoanRow(l) {
    const iLend = l.lender && l.lender.handle === Net.me.handle;
    const other = iLend ? l.borrower : l.lender;
    let right = '', sub;
    if (l.status === 'open') { sub = `Open ${l.kind} · ${l.vis === 'public' ? 'everyone' : 'friends'}`; right = `<button class="btn btn-sm" data-act="lcancel" data-v="${l.id}">Withdraw</button>`; }
    else if (l.status === 'active') {
      sub = `${iLend ? 'Lent to' : 'Borrowed from'} ${esc(other ? other.name : '?')} · ${fmt$(l.bal)} left · ${l.left} payments to go · ${fmt$(l.paid)} paid`;
      const mine = !iLend && G.p2p.find((x) => x.role === 'b' && x.id === l.id);
      if (mine) right = `<button class="btn btn-sm" data-act="repay" data-v="${l.id}" ${G.cash >= mine.bal ? '' : 'disabled'}>Repay ${fmtShort(mine.bal)}</button>`;
    } else sub = l.status === 'repaid' ? 'Repaid in full' : 'Withdrawn';
    return `<div class="prow loan ${l.status}"><div class="prow-main"><i class="pface">${iLend ? icon('bank') : icon('coin')}</i><span><b>${iLend ? 'Lending' : 'Borrowing'} ${fmtShort(l.amount)} at ${l.apy}%</b><small>${sub}</small></span></div><div class="prow-act">${right}</div></div>`;
  },

  // ── my profile ──
  meHTML() {
    const me = Net.me, t = totals();
    const watch = [...Net.watch.values()].sort((a, b) => (b.created_at || 0) - (a.created_at || 0));
    let h = `<div class="me-card"><i class="pface big">${playerFace(me)}</i><div><b>${esc(me.name)}</b><small>@${esc(me.handle)} · ${credit(me.repaid)}</small></div><button class="btn btn-sm" data-act="edit">${this.editing ? 'Close' : 'Edit'}</button></div>`;
    if (this.editing) {
      h += `<form class="card editme" data-form="profile"><div class="field"><label for="pN">Display name</label><input id="pN" maxlength="20" value="${esc(me.name)}"></div>
        <div class="field"><label for="pH">Handle</label><input id="pH" maxlength="20" value="${esc(me.handle)}" pattern="[a-z0-9_]{3,20}" autocapitalize="none"></div>
        <div class="field"><label>Avatar</label><div class="seg">${AGENTS.map((A) => `<button type="button" class="${me.agent === A.id ? 'on' : ''}" data-act="pagent" data-v="${A.id}"><i class="pface">${charSVG(A.look, 'face')}</i></button>`).join('')}</div></div>
        <button class="btn btn-go" type="submit">Save Profile</button></form>`;
    }
    h += `<div class="sharebox"><div><b>Share your portfolio</b><small>${esc(Net.shareURL())}</small></div><button class="btn btn-sm btn-go" data-act="share">Share Link</button><a class="btn btn-sm" href="${esc(Net.shareURL())}" target="_blank" rel="noopener">Preview</a></div>
      <dl class="quote"><div><dt>Net worth</dt><dd>${fmt$(t.net)}</dd></div><div><dt>Co-op stakes</dt><dd>${fmt$(t.stakes)}</dd></div><div><dt>Money lent out</dt><dd>${fmt$(t.p2pLent)}</dd></div><div><dt>Owed to players</dt><dd>${fmt$(t.p2pOwe)}</dd></div></dl>`;
    h += `<h3 class="sec">Properties of interest <small>${watch.length}</small></h3>`;
    h += watch.length ? `<div class="plist">${watch.map((w) => {
      const here = G && w.seed === G.seed && CITY.lots[w.lot];
      return `<div class="prow"><div class="prow-main">${here ? `<img src="${thumbURL(eff(CITY.lots[w.lot]), 56, 42)}" alt="" width="56" height="42">` : `<i class="pface">${icon('star')}</i>`}<span><b>${esc(w.addr)}</b><small>${esc(w.kind)} · ${esc(w.dist)}${w.price ? ` · ${fmtShort(w.price)} when added` : ''}${here ? ` · now ${fmtShort(lotValue(CITY.lots[w.lot]))}` : ' · another city'}</small></span></div>
        <div class="prow-act">${here ? `<button class="btn btn-sm" data-act="dgo" data-v="${w.lot}">Show</button>` : ''}<button class="btn btn-sm" data-act="unwatch" data-v="${w.seed}:${w.lot}">Remove</button></div></div>`;
    }).join('')}</div>` : '<p class="muted">Tap <b>Watch</b> on any property to keep an eye on it. Your friends can see your watchlist and it shows on your public page.</p>';
    h += `<div class="row account"><button class="btn btn-sm" data-act="signout">Sign Out</button>${this.confirmDel ? `<button class="btn btn-sm btn-warn" data-act="delacct">Yes, delete my online account</button><button class="btn btn-sm" data-act="nodel">Keep it</button>` : '<button class="btn btn-sm btn-ghost" data-act="askdel">Delete online account</button>'}</div>
      ${this.confirmDel ? '<p class="warn">This deletes your online save, friends, listings and public page. Your game in this browser stays.</p>' : ''}`;
    return h;
  },

  // ── another player's profile ──
  profileHTML() {
    const P = this.prof;
    if (!P || P.user.handle !== this.sub) return '<p class="muted loading">Loading…</p>';
    const s = P.snapshot || {}, t = totals();
    const same = G && s.seed === G.seed;
    const cmp = (label, a, b, f) => {
      const mx = Math.max(Math.abs(a), Math.abs(b), 1);
      return `<div class="cmp"><span>${label}</span><div><i class="them" style="width:${(Math.max(0, a) / mx * 100).toFixed(1)}%"></i><b>${f(a)}</b></div><div><i class="you" style="width:${(Math.max(0, b) / mx * 100).toFixed(1)}%"></i><b>${f(b)}</b></div></div>`;
    };
    const fbtn = { none: `<button class="btn btn-sm btn-go" data-act="addfriend" data-v="${esc(P.user.handle)}">Add Friend</button>`, sent: '<span class="muted">Request sent</span>', received: `<button class="btn btn-sm btn-go" data-act="accept" data-v="${esc(P.user.handle)}">Accept Friend</button>`, friends: `<button class="btn btn-sm btn-ghost" data-act="unfriend" data-v="${esc(P.user.handle)}">Unfriend</button>` }[P.friend] || '';
    let h = `<div class="me-card"><i class="pface big">${playerFace(P.user)}</i><div><b>${esc(s.name || P.user.name)}${s.fam ? ' ' + esc(s.fam) : ''}</b><small>@${esc(P.user.handle)}${s.year ? ` · year ${s.year}` : ''}${s.gen > 1 ? ` · generation ${s.gen}` : ''} · ${credit(P.user.repaid)}${same && !P.me ? ' · <em>plays your city</em>' : ''}</small></div>${P.me ? '' : fbtn}</div>`;
    h += `<div class="pstats"><div><b>${fmtShort(s.net || 0)}</b><span>Net worth</span></div><div><b>${s.props || 0}</b><span>Properties</span></div><div><b>${fmtShort(s.rentMo || 0)}</b><span>Rent / mo</span></div><div><b>${s.rep ?? 0}</b><span>Reputation</span></div><div><b>${s.historic || 0}</b><span>Historic</span></div><div><b>${s.ach || 0}/${s.achTotal || 0}</b><span>Awards</span></div></div>`;
    if (s.hist && s.hist.length > 1) h += `<div class="pspark">${sparkline(s.hist, 320, 54)}</div>`;
    if (!P.me && G) h += `<div class="cmpbox"><p class="legend"><i class="them"></i>${esc(s.name || P.user.name)} <i class="you"></i>You</p>${cmp('Net worth', s.net || 0, t.net, fmtShort)}${cmp('Properties', s.props || 0, t.props, (v) => String(v))}${cmp('Reputation', s.rep || 0, G.rep, (v) => String(Math.round(v)))}</div>`;
    if (s.top && s.top.length) {
      h += `<h3 class="sec">Portfolio</h3><div class="plist">${s.top.map((p) => {
        const L = same && CITY.lots[p.lot];
        return `<div class="prow"><div class="prow-main">${L ? `<img src="${thumbURL(eff(L), 56, 42)}" alt="" width="56" height="42">` : `<i class="pface">${icon('house')}</i>`}<span><b>${esc(p.addr)}</b><small>${esc(p.kn || p.kind)} · ${esc(p.dist)}${p.tier && p.tier !== 'Ordinary' ? ` · ${esc(p.tier)}` : ''}${p.historic ? ' · Historic' : ''}${p.str ? ' · Holiday let' : ''}${p.upg ? ` · ${p.upg} upgrades` : ''}</small></span></div>
          <div class="prow-act"><span class="worth">${fmtShort(p.value)}</span>${L ? `<button class="btn btn-sm" data-act="dgo" data-v="${p.lot}">Show</button>` : ''}</div></div>`;
      }).join('')}</div>`;
    }
    if (P.watch && P.watch.length) {
      h += `<h3 class="sec">Properties they’re watching</h3><div class="plist">${P.watch.map((w) => {
        const here = G && w.seed === G.seed && CITY.lots[w.lot];
        return `<div class="prow"><div class="prow-main"><i class="pface">${icon('star')}</i><span><b>${esc(w.addr)}</b><small>${esc(w.kind)} · ${esc(w.dist)}${w.note ? ` · “${esc(w.note)}”` : ''}</small></span></div><div class="prow-act">${here ? `<button class="btn btn-sm" data-act="dgo" data-v="${w.lot}">Show</button>` : ''}</div></div>`;
      }).join('')}</div>`;
    }
    if (P.deals && P.deals.length && !P.me) h += `<h3 class="sec">Their co-op deals</h3><div class="plist">${P.deals.map((d) => `<div class="prow"><div class="prow-main"><i class="pface">${icon('handshake')}</i><span><b>${esc(d.addr)}</b><small>${esc(d.kind)} · ${fmtShort(d.price)} · ${d.status === 'open' ? 'raising money' : d.status}</small></span></div><div class="prow-act">${d.status === 'open' ? '<button class="btn btn-sm btn-go" data-act="tab" data-v="deals">Chip In</button>' : ''}</div></div>`).join('')}</div>`;
    if (P.loans && P.loans.length && !P.me) h += `<h3 class="sec">Their loan listings</h3><div class="plist">${P.loans.map((l) => this.loanRow(l, l.kind === 'offer' ? 'take' : 'fund')).join('')}</div>`;
    h += `<div class="row"><button class="btn btn-sm" data-act="share" data-v="${esc(P.user.handle)}">Copy Their Link</button></div>`;
    return h;
  },

  // ── wiring for sliders and forms ──
  bind() {
    const S = Modal.sheet;
    const dT = $('#dT', S);
    if (dT) dT.oninput = () => { const d = this.draft; d.target = Math.round(d.price * dT.value / 100 / 1000) * 1000; $('#dTv', S).textContent = fmt$(d.target); $('#dTp', S).textContent = `${dT.value}% of the price`; };
    const dN = $('#dN', S);
    if (dN) dN.oninput = () => { this.draft.note = dN.value; };
    $$('.plr', S).forEach((r) => {
      r.oninput = () => { const v = +r.value; this.pledge[r.dataset.deal] = v; $(`#plv${r.dataset.deal}`, S).textContent = fmt$(v); $(`#plp${r.dataset.deal}`, S).textContent = `≈ ${(v / +r.dataset.price * 100).toFixed(1)}% of the property`; };
    });
    const lA = $('#lA', S), lR = $('#lR', S), lN = $('#lN', S);
    const upd = () => {
      const f = this.lf, pay = p2pPay(f.amount, f.apy, f.term, f.type), total = f.type === 'io' ? pay * f.term + f.amount : pay * f.term;
      $('#lAv', S).textContent = fmt$(f.amount); $('#lRv', S).textContent = `${f.apy.toFixed(2)}% APY`;
      $('#lQ', S).innerHTML = this.loanQuote(f.amount, pay, total, f);
      const b = $('[data-act="lpost"]', S);
      b.textContent = `${f.kind === 'offer' ? 'Offer' : 'Ask for'} ${fmtShort(f.amount)} at ${f.apy}%`;
      b.disabled = f.kind === 'offer' && G.cash < f.amount;
    };
    if (lA) lA.oninput = () => { this.lf.amount = +lA.value; upd(); };
    if (lR) lR.oninput = () => { this.lf.apy = +lR.value; upd(); };
    if (lN) lN.oninput = () => { this.lf.note = lN.value; };
    $$('form[data-form]', S).forEach((f) => f.addEventListener('submit', (e) => { e.preventDefault(); this.act(f.dataset.form === 'search' ? 'search' : 'saveprof'); }));
  },

  async run(fn, okMsg) {
    if (this.busy) return;
    this.busy = true; this.msg = '';
    try {
      const r = await fn();
      if (okMsg) UI.toast({ kind: 'ach', title: typeof okMsg === 'function' ? okMsg(r) : okMsg, good: true, life: 2600 });
      Sound.play('coin');
    } catch (e) { this.msg = e.message; Sound.play('error'); }
    this.busy = false;
    UI.hud();
    if (Modal.view === this) { this.render(); this.load(); }
  },

  act(a, el) {
    if (closeAct(a)) return;
    const v = el && el.dataset.v;
    switch (a) {
      case 'signin': Net.signIn(v, ($('#devName') || {}).value); return;
      case 'back': this.sub = null; this.prof = null; this.msg = ''; break;
      case 'tab': this.tab = v; this.sub = null; this.msg = ''; this.results = null; Sound.play('tab'); this.load(); break;
      case 'scope': this.scope = v; this.board = null; Sound.play('tab'); this.load(); break;
      case 'sort': this.sort = v; this.board = null; Sound.play('tab'); this.load(); break;
      case 'player': this.sub = v; this.prof = null; this.msg = ''; Sound.play('click'); this.load(); break;
      case 'search': {
        this.q = ($('#fq') || {}).value || '';
        Net.get(`/api/search?q=${encodeURIComponent(this.q)}`).then((r) => { this.results = r.rows; this.render(); }).catch((e) => { this.msg = e.message; this.render(); });
        return;
      }
      case 'addfriend': return this.run(() => Net.post('/api/friends/request', { handle: v }), (r) => r.status === 'friends' ? 'You’re now friends!' : 'Friend request sent');
      case 'accept': return this.run(() => Net.post('/api/friends/respond', { handle: v, accept: true }), 'New friend added');
      case 'decline': return this.run(() => Net.post('/api/friends/respond', { handle: v, accept: false }));
      case 'unfriend': return this.run(() => Net.post('/api/friends/remove', { handle: v }));
      case 'share': Net.share(v).then((r) => UI.toast({ kind: 'ach', title: r === 'copied' ? 'Link copied' : r === 'shared' ? 'Shared!' : 'Your link', text: r === 'copied' || r === 'shared' ? '' : r, life: 3000 })); return;
      // deals
      case 'dmin': this.draft.minPut = +v; Sound.play('tab'); break;
      case 'dcancel': this.draft = null; break;
      case 'dcreate': {
        const d = this.draft;
        return this.run(async () => {
          await Net.post('/api/deals', { seed: G.seed, lot: d.L.id, addr: d.L.addr, kind: KINDS[kindOf(d.L)].name, dist: DISTRICT_BY_ID[d.L.dist].name, price: d.price, target: d.target, minPut: d.minPut, note: d.note });
          this.draft = null;
        }, 'Deal posted! Your friends can chip in now.');
      }
      case 'pledge': {
        const id = +v, amt = this.pledge[id];
        if (!(amt > 0) || amt > G.cash) { this.msg = 'You don’t have that much cash.'; break; }
        return this.run(async () => { await Net.post(`/api/deals/${id}/pledge`, { amount: amt }); G.cash -= amt; Game.save(); }, `You chipped in ${fmtShort(amt)}`);
      }
      case 'unpledge': return this.run(async () => { await Net.post(`/api/deals/${v}/unpledge`); await Net.sync(true); }, 'Your stake is on its way back');
      case 'dclose': return this.run(async () => { const r = await Net.post(`/api/deals/${v}/close`); await Net.sync(true); return r; }, (r) => `${fmtShort(r.total)} from friends added to your cash`);
      case 'dkill': {
        const d = this.deals && this.deals.lead.find((x) => x.id === +v);
        if (d && d.status === 'funded' && G.cash < d.raised) { this.msg = `You need ${fmt$(d.raised)} in cash to hand your friends’ money back.`; break; }
        return this.run(async () => {
          const r = await Net.post(`/api/deals/${v}/cancel`);
          if (r.deduct) G.cash -= r.deduct;
          if (d) delete G.coop[d.lot];
          Game.save();
        }, 'Deal cancelled and friends refunded');
      }
      case 'dgo': {
        const L = CITY.lots[+v];
        if (!L) return;
        Modal.close(); lookAtLot(L, Math.max(View.cam.z, 1)); setTimeout(() => PV.open(L.id), 450);
        return;
      }
      // loans
      case 'lkind': this.lf.kind = v; Sound.play('tab'); break;
      case 'lterm': this.lf.term = +v; Sound.play('tab'); break;
      case 'ltype': this.lf.type = v; Sound.play('tab'); break;
      case 'lvis': this.lf.vis = v; Sound.play('tab'); break;
      case 'lpost': {
        const f = this.lf;
        if (f.kind === 'offer' && G.cash < f.amount) { this.msg = 'You don’t have that much cash.'; break; }
        return this.run(async () => {
          await Net.post('/api/loans', { kind: f.kind, amount: f.amount, apy: f.apy, term: f.term, type: f.type, vis: f.vis, note: f.note });
          if (f.kind === 'offer') { G.cash -= f.amount; Game.save(); }
          f.note = '';
          await Net.sync(true);
        }, f.kind === 'offer' ? 'Loan offer posted' : 'Loan request posted');
      }
      case 'take': return this.run(async () => { await Net.post(`/api/loans/${v}/take`); await Net.sync(true); }, 'Loan taken. The money is in your cash.');
      case 'fund': return this.run(async () => {
        const r = await Net.post(`/api/loans/${v}/take`);
        if (r.deduct) { G.cash -= r.deduct; Game.save(); }
        await Net.sync(true);
      }, 'Loan funded. Repayments will roll in monthly.');
      case 'lcancel': return this.run(async () => { await Net.post(`/api/loans/${v}/cancel`); await Net.sync(true); }, 'Listing withdrawn');
      case 'repay': {
        const r = repayP2PEarly(+v);
        if (!r.ok) { this.msg = r.reason; break; }
        Game.save();
        return this.run(() => Net.sync(true), `Repaid ${fmtShort(r.amt)}`);
      }
      // profile
      case 'edit': this.editing = !this.editing; break;
      case 'pagent': Net.me.agent = v; $$('[data-act="pagent"]', Modal.sheet).forEach((b) => b.classList.toggle('on', b.dataset.v === v)); return;
      case 'saveprof': {
        const name = ($('#pN') || {}).value, handle = (($('#pH') || {}).value || '').toLowerCase();
        return this.run(async () => { const r = await Net.post('/api/profile', { name, handle, agent: Net.me.agent }); Net.me = r.me; this.editing = false; }, 'Profile saved');
      }
      case 'unwatch': {
        const [seed, lot] = v.split(':').map(Number);
        return this.run(async () => { await Net.post('/api/watch/remove', { seed, lot }); Net.watch.delete(v); });
      }
      case 'signout': Net.signOut().then(() => { this.render(); UI.hud(); }); return;
      case 'askdel': this.confirmDel = true; break;
      case 'nodel': this.confirmDel = false; break;
      case 'delacct': return this.run(async () => { await Net.post('/api/account/delete'); await Net.signOut(); }, 'Online account deleted');
    }
    this.render();
  },
};

function signInButtons(p) {
  return `<div class="signin-btns">
    ${p.apple ? `<button class="btn sso apple" data-act="signin" data-v="apple"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M16.4 12.6c0-2.4 2-3.5 2-3.6-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.2-2.8.8-3.5.8s-1.8-.8-3-.8C6.9 7.3 5.4 8.2 4.6 9.6c-1.7 2.9-.4 7.2 1.2 9.6.8 1.2 1.7 2.4 3 2.4 1.2 0 1.6-.8 3.1-.8s1.8.8 3.1.8 2.1-1.2 2.9-2.3c.9-1.3 1.3-2.6 1.3-2.7 0 0-2.7-1-2.8-4zM14.1 5.6c.6-.8 1.1-1.9 1-3-1 0-2.1.6-2.8 1.4-.6.7-1.1 1.8-1 2.9 1 .1 2.1-.5 2.8-1.3z"/></svg>Sign in with Apple</button>` : ''}
    ${p.google ? `<button class="btn sso google" data-act="signin" data-v="google"><svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M22.5 12.3c0-.8-.1-1.5-.2-2.2H12v4.2h5.9a5 5 0 0 1-2.2 3.3v2.7h3.5c2.1-1.9 3.3-4.7 3.3-8z"/><path fill="#34A853" d="M12 23c3 0 5.5-1 7.3-2.7l-3.5-2.7c-1 .7-2.3 1.1-3.8 1.1-2.9 0-5.4-2-6.3-4.6H2.1v2.8A11 11 0 0 0 12 23z"/><path fill="#FBBC05" d="M5.7 14.1a6.6 6.6 0 0 1 0-4.2V7.1H2.1a11 11 0 0 0 0 9.8z"/><path fill="#EA4335" d="M12 5.4c1.6 0 3.1.6 4.2 1.7l3.1-3.1A11 11 0 0 0 2.1 7.1l3.6 2.8C6.6 7.4 9.1 5.4 12 5.4z"/></svg>Sign in with Google</button>` : ''}
    ${p.dev ? `<div class="devlogin"><input id="devName" placeholder="Dev name" maxlength="20" value="${esc(Store.get('pm-name') || 'Tester')}"><button class="btn" data-act="signin" data-v="dev">Dev sign-in</button></div>` : ''}
    ${!p.apple && !p.google && !p.dev ? '<p class="muted">Online sign-in isn’t set up on this server yet.</p>' : ''}</div>`;
}

// title-screen strip: sign in, or who you're signed in as
const TitleOnline = {
  render() {
    const el = $('#tOnline');
    if (!el) return;
    el.hidden = !Net.avail;
    if (!Net.avail) return;
    el.innerHTML = Net.on
      ? `<div class="t-me"><i class="pface">${playerFace(Net.me)}</i><span>Signed in as <b>${esc(Net.me.name)}</b> <small>@${esc(Net.me.handle)}</small></span><button class="btn btn-sm" data-tact="signout">Sign out</button></div>`
      : `<p class="t-lab">Play online with friends</p>${signInButtons(Net.providers)}`;
    el.onclick = (e) => {
      const b = e.target.closest('[data-act="signin"]');
      if (b) { Sound.unlock(); Net.signIn(b.dataset.v, ($('#devName', el) || {}).value); return; }
      if (e.target.closest('[data-tact="signout"]')) Net.signOut().then(() => this.render());
    };
  },
  // a friend's city for the new-game form, so you can share streets and deals
  async cities() {
    const box = $('#tCity'), sel = $('#citySel');
    if (!box || !Net.on) { if (box) box.hidden = true; return; }
    try {
      const f = await Net.get('/api/friends');
      const seen = new Set(), opts = [];
      for (const r of f.friends) if (r.seed != null && !seen.has(r.seed)) { seen.add(r.seed); opts.push(`<option value="${r.seed}">${esc(r.name)}’s city</option>`); }
      box.hidden = !opts.length;
      sel.innerHTML = '<option value="">A brand-new city</option>' + opts.join('');
    } catch (e) { box.hidden = true; }
  },
};
