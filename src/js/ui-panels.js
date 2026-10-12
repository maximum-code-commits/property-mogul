'use strict';
// ───────────────────────── interface: hub panels ─────────────────────────
const closeAct = (a) => { if (a === 'close') { Sound.play('click'); Modal.close(); return true; } return false; };
const meter = (v, col) => `<div class="meter"><i style="width:${Math.round(clamp(v, 0, 1) * 100)}%;background:${col || 'var(--gold)'}"></i></div>`;
const sentFace = (s) => (s >= 70 ? '😀' : s >= 45 ? '🙂' : s >= 25 ? '😐' : '😠');

// ── line chart on a canvas ──
function lineChart(cv, series, opt = {}) {
  if (!cv) return;
  const r = cv.getBoundingClientRect(), dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.width = r.width * dpr; cv.height = r.height * dpr;
  const g = cv.getContext('2d'); g.scale(dpr, dpr);
  const W = r.width, H = r.height, padL = 10, padR = 12, padT = 16, padB = 22;
  const all = series.flatMap((s) => s.data);
  if (Math.max(...series.map((s) => s.data.length)) < 2) { g.fillStyle = opt.ink || '#fff8ea'; g.font = '600 13px "Baloo 2", system-ui'; g.fillText('Let a few months pass to see a trend.', 12, H / 2); return; }
  let lo = opt.zero ? Math.min(0, ...all) : Math.min(...all), hi = Math.max(...all);
  if (hi === lo) hi = lo + 1;
  const pad = (hi - lo) * 0.08; if (!opt.zero) lo -= pad; hi += pad;
  const n = Math.max(...series.map((s) => s.data.length));
  const X = (i) => padL + (n < 2 ? 0 : (i / (n - 1)) * (W - padL - padR));
  const Y = (v) => H - padB - ((v - lo) / (hi - lo)) * (H - padT - padB);
  g.font = '600 11px "Baloo 2", system-ui, sans-serif'; g.textAlign = 'right';
  for (let k = 0; k <= 3; k++) {
    const v = lo + (hi - lo) * k / 3, y = Y(v);
    g.strokeStyle = opt.grid || 'rgba(255,248,234,.35)'; g.setLineDash([4, 4]); g.lineWidth = 1;
    g.beginPath(); g.moveTo(padL, y); g.lineTo(W - padR, y); g.stroke(); g.setLineDash([]);
    g.fillStyle = opt.ink || '#fff8ea'; g.fillText(opt.fmt ? opt.fmt(v) : v.toFixed(2), W - padR, y - 3);
  }
  if (opt.years) { g.textAlign = 'center'; const step = Math.max(1, Math.ceil(n / 7 / 12)) * 12; opt.years.forEach((m, i) => { if (m % step === 0 && i > 0) g.fillText(String(START_YEAR + Math.floor(m / 12)), X(i), H - 6); }); }
  for (const s of series) {
    if (s.fill && s.data.length > 1) {
      const grd = g.createLinearGradient(0, padT, 0, H - padB); grd.addColorStop(0, '#ffd34d'); grd.addColorStop(1, 'rgba(240,138,36,.45)');
      g.beginPath(); g.moveTo(X(0), Y(Math.max(lo, 0)));
      s.data.forEach((v, i) => g.lineTo(X(i), Y(v)));
      g.lineTo(X(s.data.length - 1), Y(Math.max(lo, 0))); g.closePath(); g.fillStyle = grd; g.fill();
    }
    g.beginPath(); s.data.forEach((v, i) => g[i ? 'lineTo' : 'moveTo'](X(i), Y(v)));
    g.strokeStyle = s.color; g.lineWidth = s.w || 2.4; g.stroke();
  }
  if (opt.dots && series[0].data.length > 1) {
    const d = series[0].data;
    const dot = (x, y, c) => { g.beginPath(); g.arc(x, y, 6, 0, TAU); g.fillStyle = c; g.fill(); };
    dot(X(0), Y(d[0]), '#e0392b'); dot(X(d.length - 1), Y(d[d.length - 1]), '#3d8fe0');
  }
}

// ───────── portfolio ─────────
const Portfolio = {
  tab: 'summary',
  open(tab) { if (tab) this.tab = tab; Sound.play('click'); Modal.show('m-panel', this); },
  render() {
    const mine = owned().sort((a, b) => lotValue(b) - lotValue(a));
    const t = totals();
    const pie = (c) => { const p = Math.round(c * 50.27); return `<svg viewBox="0 0 24 24" class="pie"><circle cx="12" cy="12" r="10" fill="#fff8ea" stroke="#3b2412" stroke-width="1.6"/><circle cx="12" cy="12" r="5" fill="none" stroke="${c > 0.6 ? '#f2b33d' : c > 0.35 ? '#f08a24' : '#d64b3c'}" stroke-width="10" stroke-dasharray="${p / 1.6} 100" transform="rotate(-90 12 12)"/></svg>`; };
    const yes = '<span class="yes" aria-label="yes">✓</span>', no = '<span class="no" aria-label="no">✗</span>';
    const thumb = (L) => `<img class="thumb" src="${thumbURL(eff(L))}" alt="" width="64" height="48">`;
    const name = (L) => { const E = eff(L); return `<b>${esc(E.kind === 'site' ? 'Construction' : KINDS[E.kind].name)}${G.home === L.id ? ' ♥' : ''}</b><small>${esc(L.addr)} · ${esc(DISTRICT_BY_ID[L.dist].name)}</small>`; };
    let head = '', rows = '', foot = '';
    if (this.tab === 'summary') {
      head = '<th></th><th>Property</th><th>Current Value</th><th>Purchase Price</th><th>Condition</th><th>Insured or Strata</th><th>Units Let</th>';
      rows = mine.map((L) => { const st = lotState(L.id), n = st.units.length, occ = st.units.filter((u) => u && (u.r || u.home)).length; return `<tr data-lot="${L.id}"><td>${thumb(L)}</td><td class="nm">${name(L)}</td><td>${fmt$(lotValue(L, st))}</td><td>${fmt$(st.pp)}</td><td>${pie(st.cond)}</td><td>${KINDS[kindOf(L)].strata || st.ins ? yes : no}</td><td>${n ? `${occ}/${n}` : '—'}</td></tr>`; }).join('');
      foot = `<td></td><td>${t.props} properties</td><td>${fmt$(t.value)}</td><td></td><td></td><td></td><td>${t.tenants}/${t.units}</td>`;
    } else if (this.tab === 'leases') {
      head = '<th></th><th>Property</th><th>Rent / Month</th><th>Occupancy</th><th>Rent Level</th><th>Next Lease Ends</th>';
      rows = mine.map((L) => { const st = lotState(L.id); const let_ = st.units.filter((u) => u && u.r); const rent = let_.reduce((s, u) => s + u.r, 0); const next = let_.length ? Math.min(...let_.map((u) => u.l)) : null; return `<tr data-lot="${L.id}"><td>${thumb(L)}</td><td class="nm">${name(L)}</td><td>${rent ? fmt$(rent) : '—'}</td><td>${st.units.length ? Math.round(let_.length / st.units.length * 100) + '%' : '—'}</td><td>${Math.round(st.rm * 100)}%</td><td>${next != null ? next + ' mo' : st.units.length ? '<span class="down">Vacant</span>' : '—'}</td></tr>`; }).join('');
      foot = `<td></td><td>Total rent</td><td>${fmt$(t.rent)}/mo</td><td>${t.units ? Math.round(t.tenants / t.units * 100) : 0}%</td><td></td><td>${t.vacant} vacant</td>`;
    } else if (this.tab === 'lenders') {
      head = '<th></th><th>Property</th><th>Lender</th><th>Balance</th><th>Rate</th><th>Repayment</th><th>Years Left</th>';
      rows = mine.map((L) => { const st = lotState(L.id), lo = st.loan; return `<tr data-lot="${L.id}"><td>${thumb(L)}</td><td class="nm">${name(L)}</td><td>${lo ? esc(LENDER_BY_ID[lo.lender].name) + (lo.con ? ' (construction)' : '') : 'Owned outright'}</td><td>${lo ? fmt$(lo.bal) : '—'}</td><td>${lo ? fmtPct(lo.rate, 2) : '—'}</td><td>${lo ? fmt$(lo.pay) + '/mo' : '—'}</td><td>${lo ? (lo.term / 12).toFixed(1) : '—'}</td></tr>`; }).join('');
      rows += G.ploans.map((pl, i) => `<tr><td>${charSVG(INVESTOR_BY_ID[pl.inv].look, 'face')}</td><td class="nm"><b>Private loan</b><small>${esc(INVESTOR_BY_ID[pl.inv].name)}</small></td><td>Interest only</td><td>${fmt$(pl.bal)}</td><td>${fmtPct(pl.rate, 2)}</td><td>${fmt$(pl.bal * pl.rate / 12)}/mo</td><td><button class="btn btn-sm" data-act="repay" data-v="${i}" ${pl.bal > G.cash ? 'disabled' : ''}>Repay</button></td></tr>`).join('');
      foot = `<td></td><td>Total debt</td><td></td><td>${fmt$(t.loans + t.pl)}</td><td>Cash rate ${fmtPct(G.market.rate, 2)}</td><td>${fmt$(t.pay)}/mo</td><td></td>`;
    } else {
      head = '<th></th><th>Property</th><th>Rent</th><th>Repayments</th><th>Costs</th><th>Your Net / Month</th><th>Your Equity</th><th>Gain</th>';
      let net = 0, eq = 0;
      rows = mine.map((L) => {
        const st = lotState(L.id), c = holdCosts(L, st), v = lotValue(L, st), sh = 1 - partnerShare(st);
        const rent = st.units.reduce((s, u) => s + (u && u.r ? u.r : 0), 0);
        const n = (rent - (st.loan ? st.loan.pay : 0) - c.ins - c.maint) * sh, e = (v - (st.loan ? st.loan.bal : 0)) * sh, gg = v - st.cost;
        net += n; eq += e;
        return `<tr data-lot="${L.id}"><td>${thumb(L)}</td><td class="nm">${name(L)}</td><td>${fmt$(rent)}</td><td>${fmt$(st.loan ? st.loan.pay : 0)}</td><td>${fmt$(c.ins + c.maint)}</td><td class="${n >= 0 ? 'up' : 'down'}">${fmt$(n)}</td><td>${fmt$(e)}</td><td class="${gg >= 0 ? 'up' : 'down'}">${fmt$(gg)}</td></tr>`;
      }).join('');
      foot = `<td></td><td>Portfolio</td><td>${fmt$(t.rent)}</td><td>${fmt$(t.pay)}</td><td></td><td class="${net >= 0 ? 'up' : 'down'}">${fmt$(net)}</td><td>${fmt$(eq)}</td><td></td>`;
    }
    Modal.sheet.innerHTML = panelHTML('My Portfolio', `${tabsHTML([['summary', 'Summary'], ['leases', 'Leases'], ['lenders', 'Lenders'], ['bottom', 'Bottom Line']], this.tab)}
      <div class="tablewrap"><table class="grid"><thead><tr>${head}</tr></thead><tbody>${rows || `<tr><td colspan="8" class="empty">You don’t own any properties yet. Tap a gold ★ on the map.</td></tr>`}</tbody><tfoot><tr>${foot}</tr></tfoot></table></div>
      <p class="panel-note">Net worth <b>${fmt$(t.net)}</b> · Cash <b>${fmt$(G.cash)}</b> · Property <b>${fmtShort(t.value)}</b> · Debt <b>${fmtShort(t.loans + t.pl)}</b>${t.assets ? ` · Toys <b>${fmtShort(t.assets)}</b>` : ''}${t.stocks ? ` · Shares <b>${fmtShort(t.stocks)}</b>` : ''}. Tap a row to manage it.</p>`);
  },
  act(a, el) {
    if (closeAct(a)) return;
    if (a === 'tab') { this.tab = el.dataset.v; Sound.play('tab'); this.render(); }
    if (a === 'repay') { if (repayPrivate(+el.dataset.v)) { Sound.play('coin'); UI.afterChange(); } this.render(); }
  },
  rowClick(id) { const L = CITY.lots[id]; Modal.close(); lookAtLot(L, Math.max(View.cam.z, 1.05)); setTimeout(() => PV.open(L.id), 300); },
};

// ───────── company: team, investors, skills, school ─────────
const Company = {
  tab: 'team', loanAmt: {}, loanTerm: 36,
  open(tab) { if (tab) this.tab = tab; Sound.play('click'); Modal.show('m-panel', this); },
  render() {
    const pct = (G.xp - xpForLevel(G.lvl)) / (xpForLevel(G.lvl + 1) - xpForLevel(G.lvl));
    const top = `<div class="lvl-bar"><b>Level ${G.lvl}</b>${meter(pct, 'linear-gradient(90deg,#ffd34d,#f08a24)')}<span>${Math.round(G.xp - xpForLevel(G.lvl))} / ${xpForLevel(G.lvl + 1) - xpForLevel(G.lvl)} XP</span>${G.sp ? `<i class="badge">${G.sp} skill point${G.sp > 1 ? 's' : ''}</i>` : ''}</div>`;
    let inner = '';
    if (this.tab === 'team') inner = this.team();
    else if (this.tab === 'investors') inner = this.investors();
    else if (this.tab === 'skills') inner = this.skills();
    else inner = this.school();
    Modal.sheet.innerHTML = panelHTML(`${esc(G.mogul)} Holdings`, top + tabsHTML([['team', 'Team'], ['investors', 'Investors'], ['skills', 'Skills', G.sp], ['school', 'School']], this.tab) + inner);
  },
  team() {
    return `<div class="cards">${STAFF.map((S) => {
      const s = G.staff[S.id];
      const sal = Math.round(S.salary * (hasDeg('mba') ? 0.85 : 1));
      const val = staffValue12(S.id), months = s ? Math.min(12, s.val.length) : 0;
      const roi = s && months ? val / (sal * months) : 0;
      const valLine = !s ? '' : ['pm', 'handy', 'acct', 'leasing'].includes(S.id)
        ? `<div class="roi ${roi >= 1 ? 'up' : 'down'}"><b>${fmt$(val)}</b> earned or saved in the last ${months || 0} month${months === 1 ? '' : 's'} vs ${fmt$(sal * months)} in salary${months ? ` (${roi >= 1 ? roi.toFixed(1) + '× return' : 'not paying off yet'})` : ''}</div>`
        : `<div class="roi">${{ lawyer: 'Pays off on rezonings, lawsuits and tough negotiations.', architect: 'Pays off on every building you construct.', pr: 'Keeps neighbourhood goodwill up, which helps rezoning and rents.', analyst: 'Pays off by warning you before slumps and showing suburb outlooks.' }[S.id]}</div>`;
      return `<div class="card ${s ? 'hired' : ''}"><div class="card-top"><i class="face">${charSVG(S.look, 'face', s ? 'happy' : 'happy')}</i><div><b>${esc(S.name)}</b><small>${S.role}</small></div><span class="price">${fmt$(sal)}/mo</span></div>
        <p>${S.effect}</p>${s ? `<div class="ctl"><span class="ctl-l">Morale</span>${meter(s.morale / 100, s.morale > 60 ? 'var(--green)' : 'var(--gold)')}</div>${valLine}` : ''}
        <button class="btn btn-sm ${s ? 'btn-warn' : 'btn-go'}" data-act="${s ? 'fire' : 'hire'}" data-v="${S.id}">${s ? 'Let Go' : 'Hire'}</button></div>`;
    }).join('')}</div><p class="panel-note">Salaries are paid monthly and count as business expenses for tax. Parties lift morale, and happier staff work harder.</p>`;
  },
  investors() {
    const met = INVESTORS.filter((x) => G.inv[x.id].met), unmet = INVESTORS.filter((x) => !G.inv[x.id].met);
    const loans = G.ploans.length ? `<h3 class="sub">Private loans</h3>${G.ploans.map((pl, i) => `<div class="partner-row"><i>${charSVG(INVESTOR_BY_ID[pl.inv].look, 'face')}</i><div><b>${fmt$(pl.bal)} from ${esc(INVESTOR_BY_ID[pl.inv].name)}</b><span>${fmtPct(pl.rate, 2)} interest only · due in ${pl.left} months</span></div><button class="btn btn-sm" data-act="repay" data-v="${i}" ${pl.bal > G.cash ? 'disabled' : ''}>Repay</button></div>`).join('')}` : '';
    return loans + `<div class="cards">${met.map((X) => {
      const s = G.inv[X.id], max = privateLoanMax(X.id);
      const amt = clamp(this.loanAmt[X.id] ?? Math.round(max / 2 / 10000) * 10000, 0, max);
      return `<div class="card"><div class="card-top"><i class="face">${charSVG(X.look, 'face')}</i><div><b>${esc(X.name)}</b><small>${esc(X.title)}</small></div><span class="price">${fmtShort(invAvailable(X.id))} free</span></div>
        <p>${esc(X.blurb)}</p>
        <div class="chips">${X.likes.map((l) => chip(l === 'dev' ? 'development' : SEGMENTS[l].toLowerCase())).join('')}<span class="muted">up to ${Math.round(X.share * 100)}% of a deal</span></div>
        <div class="ctl"><span class="ctl-l">Trust</span>${meter(s.trust / 100, s.trust > 60 ? 'var(--green)' : s.trust > 25 ? 'var(--gold)' : 'var(--red)')}<span class="ctl-v">${Math.round(s.trust)}</span></div>
        <p class="hint">${s.deals ? `${s.deals} deal${s.deals > 1 ? 's' : ''} together · ${s.paid >= 0 ? 'earned' : 'chipped in'} ${fmt$(Math.abs(s.paid))}` : 'No deals yet. Invite them into a purchase from the payment screen.'}</p>
        ${max > 0 ? `<div class="field"><label>Private loan <b>${fmt$(amt)}</b> at ${fmtPct(privateLoanRate(X.id), 1)}</label><input type="range" data-inv="${X.id}" class="loanR" min="0" max="${max}" step="10000" value="${amt}"></div>
          <div class="row"><div class="seg">${[24, 36, 60].map((m) => `<button class="${this.loanTerm === m ? 'on' : ''}" data-act="term" data-v="${m}">${m / 12}y</button>`).join('')}</div><button class="btn btn-sm" data-act="ploan" data-v="${X.id}" ${amt <= 0 ? 'disabled' : ''}>Borrow</button></div>`
          : `<p class="muted">${s.trust < 25 ? 'Not ready to lend you money yet.' : 'No spare capital to lend.'}</p>`}
      </div>`;
    }).join('')}${unmet.map((X) => `<div class="card locked"><div class="card-top"><i class="face q">?</i><div><b>Unknown investor</b><small>${esc(X.title)}</small></div></div><p>${G.rep >= X.minRep ? 'Throw a party, attend a gala or level up Networker to meet them.' : `Wants a reputation of ${X.minRep}+ before meeting.`}</p></div>`).join('')}</div>`;
  },
  skills() {
    return `<p class="panel-sub">${G.sp ? `You have <b>${G.sp}</b> skill point${G.sp > 1 ? 's' : ''}. Each branch unlocks in order.` : 'Level up or graduate to earn skill points.'}</p>
      <div class="tree">${SKILL_BRANCHES.map((b) => `<div class="branch" style="--bc:${b.color}"><h3>${icon(b.icon)} ${b.name}</h3>${SKILLS.filter((s) => s.b === b.id).map((s) => {
        const got = !!G.skills[s.id], can = canLearn(s.id);
        return `<button class="node ${got ? 'got' : can ? 'can' : ''}" data-act="learn" data-v="${s.id}" ${got || !can ? 'disabled' : ''}><b>${got ? icon('check', 'inl') + ' ' : ''}${esc(s.name)}</b><span>${esc(s.desc)}</span></button>`;
      }).join('')}</div>`).join('')}</div>`;
  },
  school() {
    const cur = G.school ? DEGREE_BY_ID[G.school.id] : null;
    return `${cur ? `<div class="enrolled"><b>${icon('school', 'inl')} Studying ${esc(cur.name)}</b>${meter(1 - G.school.left / cur.months)}<span>${G.school.left} month${G.school.left > 1 ? 's' : ''} to graduation</span></div>` : '<p class="panel-sub">Study part-time while your empire runs. One course at a time.</p>'}
      <div class="cards">${DEGREES.map((D) => {
        const done = G.degrees[D.id] != null, lock = D.req && G.degrees[D.req] == null;
        return `<div class="card ${done ? 'hired' : ''}"><div class="card-top"><i class="face deg">${icon('school')}</i><div><b>${esc(D.name)}</b><small>${D.months} months · +${D.sp} skill point${D.sp > 1 ? 's' : ''}</small></div><span class="price">${fmtShort(D.cost)}</span></div><p>${D.effect}</p>
          ${done ? `<p class="up"><b>${icon('check', 'inl')} Graduated ${MONTHS[G.degrees[D.id] % 12]} ${dateLabel(G.degrees[D.id]).year}</b></p>` : `<button class="btn btn-sm btn-go" data-act="enroll" data-v="${D.id}" ${G.school || lock || D.cost > G.cash ? 'disabled' : ''}>${lock ? 'Needs ' + DEGREE_BY_ID[D.req].name : 'Enrol'}</button>`}</div>`;
      }).join('')}</div>`;
  },
  input(t) { if (t.classList.contains('loanR')) { this.loanAmt[t.dataset.inv] = +t.value; const lab = t.previousElementSibling.querySelector('b'); if (lab) lab.textContent = fmt$(+t.value); } },
  act(a, el) {
    if (closeAct(a)) return;
    const v = el.dataset.v;
    if (a === 'tab') { this.tab = v; Sound.play('tab'); }
    if (a === 'hire') { hire(v); Sound.play('buy'); }
    if (a === 'fire') { fire(v); Sound.play('bad'); }
    if (a === 'learn') { if (learn(v)) { Sound.play('ach'); UI.hud(); } }
    if (a === 'enroll') { if (enroll(v)) Sound.play('buy'); }
    if (a === 'term') { this.loanTerm = +v; Sound.play('tab'); }
    if (a === 'ploan') { const amt = this.loanAmt[v] ?? Math.round(privateLoanMax(v) / 2 / 10000) * 10000; if (takePrivateLoan(v, amt, this.loanTerm)) { Sound.play('coin'); UI.toast({ kind: 'loan', title: 'Private loan', text: `${fmt$(amt)} from ${INVESTOR_BY_ID[v].name}.`, good: true }); } delete this.loanAmt[v]; }
    if (a === 'repay') { if (repayPrivate(+v)) Sound.play('coin'); }
    UI.afterChange();
    this.render();
  },
};

// ───────── city: suburbs, council, community ─────────
const City = {
  tab: 'suburbs', dist: null, donDist: null,
  open(tab, dist) { if (tab) this.tab = tab; if (dist) this.dist = dist; Sound.play('click'); Modal.show('m-panel', this); },
  render() {
    let inner = '';
    if (this.tab === 'suburbs') inner = this.suburbs();
    else if (this.tab === 'council') inner = this.council();
    else inner = this.community();
    Modal.sheet.innerHTML = panelHTML('City of Centropolis', tabsHTML([['suburbs', 'Suburbs'], ['council', 'Council', G.council.length], ['community', 'Community']], this.tab) + inner);
    if (this.tab === 'suburbs') requestAnimationFrame(() => this.charts());
  },
  suburbs() {
    if (!this.dist) this.dist = centerDistrict().id;
    const d = DISTRICT_BY_ID[this.dist], ds = G.dist[d.id];
    const mine = owned().filter((L) => L.dist === d.id).length;
    const tr = districtTrend(d.id);
    const showTrend = perk('analyst') || hasStaff('analyst');
    const segs = Object.keys(SEGMENTS);
    const segCol = { res: '#f08a24', com: '#3d8fe0', ind: '#9a8f86', agri: '#b8a24a', hosp: '#d0679a' };
    const list = DISTRICTS.map((x) => `<button class="dl ${x.id === d.id ? 'on' : ''}" data-act="dist" data-v="${x.id}"><b>${esc(x.name)}</b><small>${x.mult >= 1.4 ? '$$$' : x.mult >= 1 ? '$$' : '$'} · ${sentFace(G.dist[x.id].sent)}${owned().some((L) => L.dist === x.id) ? ' · ★' : ''}</small></button>`).join('');
    const profile = `<div class="dprof">
      <h3>${esc(d.name)}</h3><p>${esc(d.blurb)}</p>
      <div class="chips">${Object.keys(d.pref).map((t) => chip(t, 'hot')).join('')}<span class="muted">locals pay more for these</span></div>
      <div class="dstats">
        <div><small>Price index</small><b>${(ds.idx * d.mult * G.market.idx).toFixed(2)}</b></div>
        ${showTrend ? `<div><small>12-month outlook</small><b class="${tr >= 0 ? 'up' : 'down'}">${signPct(tr, 1)}</b></div>` : ''}
        <div><small>Goodwill</small><b>${sentFace(ds.sent)} ${Math.round(ds.sent)}</b></div>
        <div><small>You own</small><b>${mine}</b></div>
        <div><small>Zoning allowed</small><b>${d.zones.join(' ')}</b></div>
      </div>
      <h4>Demand today</h4>
      <div class="dembars">${segs.map((s) => `<div><span>${SEGMENTS[s]}</span><div class="bar"><i style="width:${Math.round(clamp(ds.dem[s] / 1.8, 0, 1) * 100)}%;background:${segCol[s]}"></i></div><b>${ds.dem[s].toFixed(2)}</b></div>`).join('')}</div>
      <h4>Demand history</h4><div class="chartbox sm"><canvas id="demChart"></canvas></div>
      <div class="legend">${segs.map((s) => `<span><i style="background:${segCol[s]}"></i>${SEGMENTS[s]}</span>`).join('')}</div>
      <h4>Price history</h4><div class="chartbox sm"><canvas id="idxChart"></canvas></div>
      <h4>Recent news</h4>${ds.ev.length ? `<ul class="evlist">${ds.ev.map((e) => `<li><span class="${e.fx >= 0 ? 'up' : 'down'}">${signPct(e.fx, 0)}</span> ${esc(e.t)} <small>${MONTHS[e.m % 12]} ${dateLabel(e.m).year}</small></li>`).join('')}</ul>` : '<p class="muted">Quiet lately.</p>'}
      <div class="row"><button class="btn btn-go" data-act="go" data-v="${d.id}">Fly There</button><button class="btn" data-act="donate" data-v="${d.id}">Win Over Locals</button></div>
    </div>`;
    return `<div class="dwrap"><div class="dlist2">${list}</div>${profile}</div>`;
  },
  charts() {
    const d = this.dist, dh = G.dh[d];
    const segCol = ['#f08a24', '#3d8fe0', '#9a8f86', '#b8a24a', '#d0679a'];
    lineChart($('#demChart'), [0, 1, 2, 3, 4].map((k) => ({ data: dh.dem.map((a) => a[k]), color: segCol[k], w: 2 })), { fmt: (v) => v.toFixed(2), years: G.hist.m });
    lineChart($('#idxChart'), [{ data: dh.idx, color: '#e8ff7a', fill: true }], { fmt: (v) => v.toFixed(2), years: G.hist.m, dots: true });
  },
  council() {
    const apps = G.council.map((c) => { const L = CITY.lots[c.lot]; return `<div class="partner-row" data-lot="${L.id}"><i>${charSVG(MAYOR.look, 'face')}</i><div><b>${esc(L.addr)} → ${c.zone}</b><span>${ZONES[c.zone].name} · decision in ${c.left} month${c.left === 1 ? '' : 's'} · about ${Math.round(c.chance * 100)}% likely</span></div></div>`; }).join('');
    return `<div class="council big"><i>${charSVG(MAYOR.look, 'face')}</i><p>${esc(MAYOR.name)}: “Want to build bigger? Open one of your properties, go to <b>Develop</b>, and make your case. Goodwill in the neighbourhood, your reputation, and a little community contribution all help.”</p></div>
      ${apps ? `<h3 class="sub">Your applications</h3>${apps}` : '<p class="muted">No applications in front of the council.</p>'}
      <h3 class="sub">Zones</h3><div class="zgrid">${Object.entries(ZONES).map(([z, Z]) => `<div><span class="zbadge" style="--zc:${Z.color}">${z}</span><b>${Z.name}</b><small>${ZONE_KINDS[z].map((k) => KINDS[k].name).join(', ')}</small></div>`).join('')}</div>`;
  },
  community() {
    const d = this.donDist || centerDistrict().id;
    const feed = G.feed.slice(0, 14).map((f) => `<div class="feed ${f.mood > 0 ? 'good' : f.mood < 0 ? 'bad' : ''}"><i>${charSVG(lookFor('neighbour', f.who), 'face', f.mood < 0 ? 'sad' : 'happy')}</i><div><b>${esc(f.name)}</b> <small>${esc(DISTRICT_BY_ID[f.d].name)} · ${MONTHS[f.m % 12]} ${dateLabel(f.m).year}</small><p>${esc(f.t)}</p></div></div>`).join('');
    return `<div class="field"><label for="donD">Give back in</label><select id="donD">${DISTRICTS.map((x) => `<option value="${x.id}" ${x.id === d ? 'selected' : ''}>${esc(x.name)} (goodwill ${Math.round(G.dist[x.id].sent)})</option>`).join('')}</select></div>
      <div class="cards slim">${DONATIONS.map((D) => `<div class="card"><b>${esc(D.name)}</b><p>+${D.sent} goodwill · +${D.rep} reputation</p><button class="btn btn-sm btn-go" data-act="give" data-v="${D.id}" ${D.cost > G.cash ? 'disabled' : ''}>Donate ${fmtShort(D.cost)}</button></div>`).join('')}</div>
      <h3 class="sub">What the neighbours are saying</h3>${feed || '<p class="muted">Nobody has noticed you yet.</p>'}`;
  },
  change(t) { if (t.id === 'donD') { this.donDist = t.value; } },
  act(a, el) {
    if (closeAct(a)) return;
    const v = el.dataset.v;
    if (a === 'tab') { this.tab = v; Sound.play('tab'); }
    if (a === 'dist') { this.dist = v; Sound.play('tab'); }
    if (a === 'go') { const d = DISTRICT_BY_ID[v]; Modal.close(); flyToGrid(d.seed[0], d.seed[1], Math.max(View.cam.z, 0.7)); return; }
    if (a === 'donate') { this.tab = 'community'; this.donDist = v; }
    if (a === 'give') { const r = donate(this.donDist || centerDistrict().id, v); if (r.ok) { Sound.play('ach'); UI.afterChange(); } else Sound.play('error'); }
    this.render();
  },
  rowClick(id) { Modal.close(); setTimeout(() => PV.open(id, { tab: 'develop' }), 200); },
};

// ───────── market: shop, my stuff, stocks ─────────
function assetArt(A) {
  const c = A.color;
  const arts = {
    car: `<rect x="14" y="30" width="68" height="18" rx="7" fill="${c}"/><path d="M28 30l8-12h22l10 12z" fill="${shade(c, 0.2)}"/><path d="M38 21h8v9h-12zM50 21h7l6 9H50z" fill="#bfe2f2"/><circle cx="30" cy="50" r="7" fill="#2b2420"/><circle cx="66" cy="50" r="7" fill="#2b2420"/>`,
    classic: `<path d="M10 44q2-12 18-14l10-10h24l12 10q14 2 14 14z" fill="${c}"/><path d="M42 22h18l8 8H36z" fill="#bfe2f2"/><rect x="8" y="42" width="80" height="5" rx="2" fill="#d9dde3"/><circle cx="28" cy="50" r="7" fill="#2b2420"/><circle cx="70" cy="50" r="7" fill="#2b2420"/>`,
    super: `<path d="M8 46l14-14 30-6 26 8 10 12z" fill="${c}"/><path d="M36 30l14-3 14 6H34z" fill="#2b2d3a"/><circle cx="26" cy="49" r="6" fill="#2b2420"/><circle cx="72" cy="49" r="6" fill="#2b2420"/>`,
    boat: `<path d="M8 40h80l-10 14H18z" fill="#ffffff" stroke="#3b2412" stroke-width="1.5"/><rect x="34" y="28" width="26" height="12" rx="3" fill="${c}"/><path d="M0 58q12-6 24 0t24 0 24 0 24 0" stroke="#7fd0e8" stroke-width="3" fill="none"/>`,
    sail: `<path d="M12 44h72l-10 12H22z" fill="#ffffff" stroke="#3b2412" stroke-width="1.5"/><path d="M48 6v38" stroke="#6b4424" stroke-width="2"/><path d="M50 8l26 32H50z" fill="#fff6e8" stroke="#3b2412" stroke-width="1"/><path d="M46 12L24 40h22z" fill="#e86a8a"/>`,
    yacht: `<path d="M4 42h88l-12 14H14z" fill="#ffffff" stroke="#3b2412" stroke-width="1.5"/><path d="M18 42l6-10h50l8 10z" fill="#f6f1e7" stroke="#3b2412" stroke-width="1"/><path d="M30 32l6-8h28l6 8z" fill="#2b2d3a"/><rect x="26" y="35" width="40" height="3" fill="#7fd0e8"/><path d="M6 48h84" stroke="#d9a21c" stroke-width="2"/>`,
    seaplane: `<path d="M10 30h64l14-8v10l-14 6H10z" fill="${c}"/><rect x="30" y="20" width="10" height="26" fill="${shade(c, -0.2)}"/><path d="M18 50h56M24 44v6M64 44v6" stroke="#3b2412" stroke-width="2"/><rect x="16" y="48" width="64" height="5" rx="2.5" fill="#ffffff" stroke="#3b2412"/>`,
    jet: `<path d="M6 32q30-8 70-4l14 4-14 4q-40 4-70-4z" fill="#f7f4ee" stroke="#3b2412" stroke-width="1.2"/><path d="M40 30l-12-18h8l20 18zM40 34l-12 18h8l20-18z" fill="#d9a21c"/><path d="M8 32l-4-10h6l6 10z" fill="#d9a21c"/><circle cx="74" cy="31" r="2" fill="#7fd0e8"/>`,
    balloon: `<ellipse cx="48" cy="24" rx="20" ry="22" fill="#e86a8a"/><ellipse cx="48" cy="24" rx="12" ry="22" fill="#ffd34d"/><ellipse cx="48" cy="24" rx="4" ry="22" fill="#3d78c2"/><path d="M36 42l6 10M60 42l-6 10" stroke="#6b4424" stroke-width="1.5"/><rect x="40" y="50" width="16" height="10" fill="#8a5a34"/>`,
    painting: `<rect x="18" y="6" width="60" height="50" fill="#d9a21c"/><rect x="24" y="12" width="48" height="38" fill="#3d78c2"/>${[34, 48, 62].map((x, i) => `<path d="M${x} 50v-${14 + i * 4}" stroke="#3e9b4f" stroke-width="2"/><circle cx="${x}" cy="${36 - i * 4}" r="6" fill="#ffd34d"/><circle cx="${x}" cy="${36 - i * 4}" r="2.5" fill="#6b4424"/>`).join('')}`,
    sculpture: `<rect x="34" y="44" width="28" height="14" fill="#e9e6df" stroke="#3b2412"/><ellipse cx="48" cy="32" rx="16" ry="11" fill="#d9a21c"/><circle cx="60" cy="22" r="7" fill="#e7b52c"/><path d="M66 22l6 2-6 2z" fill="#f08a24"/><circle cx="62" cy="21" r="1.4" fill="#2b2420"/>`,
    truck: `<rect x="10" y="16" width="58" height="32" rx="4" fill="${c}"/><rect x="68" y="26" width="18" height="22" rx="3" fill="${shade(c, -0.15)}"/><rect x="18" y="22" width="40" height="12" fill="#fff6e8"/><path d="M14 16h54l-4-8H18z" fill="#d64b3c"/><text x="38" y="31" text-anchor="middle" font-size="8" font-weight="800" fill="#d64b3c">TACOS</text><circle cx="26" cy="50" r="6" fill="#2b2420"/><circle cx="72" cy="50" r="6" fill="#2b2420"/>`,
    horse: `<path d="M24 44l4-16q2-8 12-8h20l8-10 6 2-4 12q0 8-8 10v10" fill="none" stroke="${c}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 44v12M44 46v10M58 46v10M66 44v12" stroke="${c}" stroke-width="5" stroke-linecap="round"/><path d="M64 14q-8-2-10 6" stroke="#2b2420" stroke-width="3" fill="none"/>`,
    plantation: `<circle cx="78" cy="14" r="9" fill="#ffd34d"/>${[0, 1, 2].map((r2) => [0, 1, 2, 3, 4].map((k) => `<circle cx="${14 + k * 17 + r2 * 4}" cy="${30 + r2 * 10}" r="6" fill="${r2 % 2 ? '#3e9b4f' : '#5aa846'}"/>`).join('')).join('')}`,
    skis: `<path d="M14 50 78 14M26 54 90 18" stroke="${c}" stroke-width="6" stroke-linecap="round"/><path d="M40 22v34M50 22v34" stroke="#8a8f99" stroke-width="3"/><circle cx="40" cy="20" r="3" fill="#d64b3c"/><circle cx="50" cy="20" r="3" fill="#d64b3c"/>`,
    island: `<ellipse cx="48" cy="50" rx="44" ry="8" fill="#7fd0e8"/><ellipse cx="48" cy="46" rx="26" ry="7" fill="#f3e2a9"/><path d="M48 44q4-16 0-28" stroke="#8a6a44" stroke-width="3" fill="none"/>${[0, 1, 2, 3, 4].map((k) => `<ellipse cx="${48 + Math.cos(k * 1.3) * 9}" cy="${16 + Math.sin(k * 1.3) * 3}" rx="10" ry="3" transform="rotate(${k * 40 - 60} ${48} ${16})" fill="#3e9b4f"/>`).join('')}`,
  };
  return `<svg viewBox="0 0 96 64" class="asset-art" aria-hidden="true">${arts[A.art] || arts.car}</svg>`;
}
const Market = {
  tab: 'shop', qty: {},
  open(tab) { if (tab) this.tab = tab; Sound.play('click'); Modal.show('m-panel', this); },
  render() {
    let inner = '';
    const b = buffs();
    const buffLine = `<p class="panel-sub">Your perks: ${icon('party', 'inl')} party +${b.party} · ${icon('people', 'inl')} investor appeal +${b.investor} · ${icon('thumb', 'inl')} reputation +${b.rep}/yr · ✨ fun ${b.fun}</p>`;
    if (this.tab === 'shop') {
      const cats = [...new Set(ASSETS.map((a) => a.cat))];
      inner = buffLine + cats.map((c) => `<h3 class="sub">${c}</h3><div class="shop">${ASSETS.filter((a) => a.cat === c).map((A) => {
        const p = assetPrice(A.id), mf = G.mkt[A.id] || 1;
        const deal = mf < 0.95 ? `<span class="deal">${Math.round((1 - mf) * 100)}% off this month</span>` : mf > 1.08 ? '<span class="hotp">Hot demand</span>' : '';
        const n = G.assets.filter((x) => x.id === A.id).length;
        return `<div class="item" style="--rc:${RARITY[A.rarity]}"><span class="rar">${A.rarity}</span>${deal}${assetArt(A)}<b>${esc(A.name)}</b>
          <div class="buffs">${Object.entries(A.buffs).map(([k, v]) => `<span>+${v} ${k}</span>`).join('')}${A.income ? `<span class="up">~${fmtPct(A.income, 0)}/yr income</span>` : ''}<span class="muted">${A.drift >= 0 ? 'appreciates' : 'depreciates'} · upkeep ${fmtPct(A.upkeep, 1)}/yr</span></div>
          <button class="btn btn-sm btn-go" data-act="buyasset" data-v="${A.id}" ${p > G.cash ? 'disabled' : ''}>Buy ${fmtShort(p)}</button>${n ? `<small class="owned">You own ${n}</small>` : ''}</div>`;
      }).join('')}</div>`).join('');
    } else if (this.tab === 'mine') {
      inner = buffLine + (G.assets.length ? `<div class="shop">${G.assets.map((a) => { const A = ASSET_BY_ID[a.id]; const ch = a.value / a.price - 1; return `<div class="item" style="--rc:${RARITY[A.rarity]}">${assetArt(A)}<b>${esc(A.name)}</b><div class="buffs"><span>Worth ${fmt$(a.value)}</span><span class="${ch >= 0 ? 'up' : 'down'}">${signPct(ch, 0)} since you bought it</span></div><button class="btn btn-sm btn-warn" data-act="sellasset" data-v="${a.uid}">Sell ${fmtShort(a.value * 0.9)}</button></div>`; }).join('')}</div>` : '<p class="muted">You haven’t bought any toys yet. Boats show up in the harbour, jets fly overhead.</p>');
    } else {
      const showOut = hasStaff('analyst');
      inner = `<p class="panel-sub">Prices move monthly. Dividends are paid every quarter. $10 brokerage per trade.${showOut ? ` ${esc(STAFF_BY_ID.analyst.name)} adds an outlook.` : ''}</p>
      <div class="tablewrap"><table class="grid stocks"><thead><tr><th>Stock</th><th>Price</th><th>Month</th><th>2 years</th><th>You own</th><th>Profit</th>${showOut ? '<th>Outlook</th>' : ''}<th>Trade</th></tr></thead><tbody>${STOCKS.map((S) => {
        const x = G.stk[S.id], prev = x.h[x.h.length - 2] || x.p, ch = x.p / prev - 1;
        const pl = x.q ? x.q * x.p - x.cost : 0;
        const q = this.qty[S.id] || Math.max(1, Math.floor(10000 / x.p));
        const out = S.drift + (S.link && S.link !== 'rate' ? G.dist[S.link].trend : 0);
        return `<tr><td class="nm"><b>${S.id}</b><small>${esc(S.name)} · ${S.sector}${S.div ? ` · ${fmtPct(S.div, 1)} div` : ''}</small></td><td>$${x.p.toFixed(2)}</td><td class="${ch >= 0 ? 'up' : 'down'}">${signPct(ch, 1)}</td><td>${sparkline(x.h.slice(-24), 96, 28)}</td><td>${x.q ? `${x.q.toLocaleString()} · ${fmtShort(x.q * x.p)}` : '—'}</td><td class="${pl >= 0 ? 'up' : 'down'}">${x.q ? fmtShort(pl) : '—'}</td>${showOut ? `<td class="${out >= 0 ? 'up' : 'down'}">${out >= 0.05 ? '▲ Buy' : out < 0.02 ? '▼ Avoid' : '◆ Hold'}</td>` : ''}<td class="trade"><input type="number" min="1" step="1" value="${q}" data-stock="${S.id}" aria-label="Shares of ${S.id}"><button class="btn btn-sm btn-go" data-act="sbuy" data-v="${S.id}">Buy</button><button class="btn btn-sm" data-act="ssell" data-v="${S.id}" ${x.q ? '' : 'disabled'}>Sell</button></td></tr>`;
      }).join('')}</tbody></table></div><p class="panel-note">Realised stock profit so far: <b>${fmt$(G.stats.stockGain)}</b></p>`;
    }
    Modal.sheet.innerHTML = panelHTML('Marketplace', tabsHTML([['shop', 'Shop'], ['mine', 'My Stuff', G.assets.length], ['stocks', 'Stocks']], this.tab) + inner);
  },
  input(t) { if (t.dataset.stock) this.qty[t.dataset.stock] = Math.max(1, Math.floor(+t.value || 1)); },
  act(a, el) {
    if (closeAct(a)) return;
    const v = el.dataset.v;
    if (a === 'tab') { this.tab = v; Sound.play('tab'); }
    if (a === 'buyasset') { if (buyAsset(v)) { Sound.play('buy'); syncMyBoats(); UI.toast({ kind: 'ach', title: 'New toy!', text: `${ASSET_BY_ID[v].name} is yours.`, good: true }); } }
    if (a === 'sellasset') { const got = sellAsset(v); if (got) { Sound.play('sell'); syncMyBoats(); } }
    if (a === 'sbuy') { const q = this.qty[v] || Math.max(1, Math.floor(10000 / G.stk[v].p)); if (trade(v, q)) Sound.play('coin'); else Sound.play('error'); }
    if (a === 'ssell') { const q = Math.min(this.qty[v] || G.stk[v].q, G.stk[v].q); if (trade(v, -q)) Sound.play('coin'); }
    UI.afterChange();
    this.render();
  },
};

// ───────── home & parties ─────────
const HomeView = {
  party: 'bbq', guests: { investors: true, staff: true, neighbours: true }, result: null, tab: 'home',
  open(tab) { this.result = null; if (tab) this.tab = tab; Sound.play('click'); Modal.show('m-panel', this); },
  render() {
    let inner;
    if (this.tab === 'family') return this.renderFamily();
    if (this.tab === 'clubs') return this.renderClubs();
    if (this.result) {
      const r = this.result;
      const faces = [];
      if (this.guests.investors) INVESTORS.filter((x) => G.inv[x.id].met).slice(0, 5).forEach((x) => faces.push(x.look));
      if (this.guests.staff) Object.keys(G.staff).slice(0, 4).forEach((id) => faces.push(STAFF_BY_ID[id].look));
      if (this.guests.neighbours) for (let i = 0; i < 3; i++) faces.push(lookFor('neighbour', G.month * 10 + i));
      inner = `<div class="party-res"><div class="confetti" aria-hidden="true">${Array.from({ length: 24 }, (_, i) => `<i style="--i:${i}"></i>`).join('')}</div>
        <h3>Party score: ${r.score}</h3><p>At ${esc(r.venue)}. It cost ${fmt$(r.cost)}.</p>
        <div class="guests">${faces.map((l) => `<i>${charSVG(l, 'face', 'wow')}</i>`).join('')}</div>
        <ul>${r.lines.map((l) => `<li>${esc(l)}</li>`).join('')}</ul>
        <button class="btn btn-go" data-act="done">Lovely</button></div>`;
    } else if (G.home == null) {
      const homes = owned().filter((L) => canLiveIn(L));
      inner = `<p>You don’t live anywhere fancy yet. Move into one of your homes to throw parties there. Bigger, waterfront, pool and luxury homes make better venues.</p>
        ${homes.length ? `<div class="pick-home">${homes.map((L) => `<button class="row-btn" data-act="pickhome" data-v="${L.id}"><img src="${thumbURL(eff(L), 72, 54)}" alt="" width="72" height="54"><span><b>${esc(KINDS[kindOf(L)].name)}</b><small>${esc(L.addr)} · ${fmtShort(lotValue(L))}${moveInCost(L) ? ` · ${fmtShort(moveInCost(L))} to break the lease` : ''}</small></span></button>`).join('')}</div>` : '<p class="muted">You don’t own a house you could live in yet.</p>'}
        <p class="hint">You can still hire a function room (20% more expensive, less impressive).</p>` + this.planner();
    } else {
      const L = CITY.lots[G.home];
      const vs = venueScore();
      inner = `<div class="home-card"><img src="${thumbURL(eff(L), 120, 90)}" alt="" width="120" height="90"><div><b>${esc(KINDS[kindOf(L)].name)} · ${esc(L.addr)}</b><span>${esc(DISTRICT_BY_ID[L.dist].name)} · venue rating ${vs.score.toFixed(2)}×</span><div class="chips">${tagsOf(L, lotState(L.id)).map((t) => chip(t)).join('')}</div><button class="linkbtn" data-act="gohome">Open property</button></div></div>` + this.planner();
    }
    Modal.sheet.innerHTML = panelHTML('Life', this.tabs() + inner);
  },
  tabs() { return tabsHTML([['home', 'Home & Parties'], ['family', 'Family'], ['clubs', 'Clubs', Object.keys(G.clubs).length]], this.tab); },
  renderFamily() {
    const F = G.fam, h = famHead();
    const person = (m, extra = '') => {
      const lk = lookFor('family', m.seed);
      return `<div class="fm ${m.alive ? '' : 'dead'} ${m.id === F.head ? 'head' : ''}"><i>${charSVG(lk, 'face', m.alive ? 'happy' : 'sad')}</i><b>${esc(m.first)} ${esc(F.name)}</b><small>${m.alive ? `${ageAt(m)} yrs` : `† ${ageAt(m)} yrs`} · ${TRAIT_BY_ID[m.trait].name}${extra}</small></div>`;
    };
    const sp = spouseOf(h);
    const kids = F.members.filter((m) => m.parent === h.id);
    const sibs = F.members.filter((m) => m.role === 'child' && m.parent !== h.id && m.id !== h.id);
    const odds = Math.round(100 * Math.exp(-Array.from({ length: Math.max(0, 80 - ageAt(h)) }, (_, k) => 0.0004 * Math.exp(0.09 * (ageAt(h) + k - 30))).reduce((a, b) => a + b, 0)));
    const inner = `<div class="dyn-head"><h3>The ${esc(F.name)} dynasty</h3><span>Generation ${F.gen}${G.lineage.length ? ` · ${G.lineage.length} past head${G.lineage.length > 1 ? 's' : ''}` : ''}</span></div>
      <div class="famrow">${person(h, ' · head of the family')}${sp ? person(sp, ' · spouse') : '<div class="fm empty"><i>?</i><small>Single. Love might find you.</small></div>'}</div>
      <p class="hint">${TRAIT_BY_ID[h.trait].name}: ${TRAIT_BY_ID[h.trait].desc} · ${odds}% chance of seeing 80, with luck and a fun life.</p>
      <h3 class="sub">Children</h3>${kids.length ? `<div class="famrow">${kids.map((k) => person(k, ageAt(k) < 18 ? ' · too young to inherit' : '')).join('')}</div>` : '<p class="muted">No children yet.</p>'}
      ${sibs.length ? `<h3 class="sub">Brothers & sisters</h3><div class="famrow">${sibs.map((k) => person(k)).join('')}</div>` : ''}
      <h3 class="sub">Family history</h3>${G.lineage.length ? `<ol class="lineage">${G.lineage.map((l) => `<li><b>${esc(l.first)} ${esc(F.name)}</b> ${START_YEAR + Math.floor(l.born / 12)}–${START_YEAR + Math.floor(l.died / 12)} · left an estate of ${fmtShort(l.net)}</li>`).join('')}</ol>` : '<p class="muted">You’re the founder. Make it a good story.</p>'}
      <p class="panel-note">When the head of the family dies, you choose an heir from adult children, a spouse or siblings. The heir keeps the business, the skills and the staff, pays 10% estate tax on cash, and inherits 60% of the reputation.</p>`;
    Modal.sheet.innerHTML = panelHTML('Life', this.tabs() + inner);
  },
  renderClubs() {
    const inner = `<div class="cards">${CLUBS.map((C) => {
      const m = G.clubs[C.id], ok = C.test();
      const vehicles = G.assets.filter((a) => CLUB_VEHICLES[C.id].includes(a.id));
      const next = 3 - (G.month % 3);
      return `<div class="card ${m ? 'hired' : ''}" style="--cc:${C.color}"><div class="card-top"><i class="face club" style="background:${C.color}">${icon({ yacht: 'star', car: 'bolt', ski: 'medal', golf: 'trophy' }[C.id])}</i><div><b>${esc(C.name)}</b><small>${C.event} every 3 months</small></div><span class="price">${fmtShort(C.fee)}</span></div>
        <p>${esc(C.blurb)}</p>
        <div class="buffs">${Object.entries(C.buffs).map(([k, v]) => `<span>+${v} ${k}</span>`).join('')}<span class="muted">${fmt$(C.dues)}/mo dues</span></div>
        ${m ? `<p class="hint">Member since ${MONTHS[m.since % 12]} ${dateLabel(m.since).year} · ${m.wins} podium${m.wins === 1 ? '' : 's'}${m.last ? ` · last ${C.event.toLowerCase()}: place ${m.last.place}` : ''} · next in ${next} month${next === 1 ? '' : 's'}</p>
          ${CLUB_VEHICLES[C.id].length ? `<div class="placed"><small>Show at the club:</small>${vehicles.length ? vehicles.map((a) => `<button class="pchip ${m.placed.includes(a.uid) ? 'on' : ''}" data-act="place" data-club="${C.id}" data-v="${a.uid}">${esc(ASSET_BY_ID[a.id].name)}</button>`).join('') : '<span class="muted">Buy one in the Marketplace.</span>'}</div>` : ''}
          <div class="row"><button class="btn btn-sm" data-act="venue" data-v="${C.id}">Visit the Club</button><button class="btn btn-sm btn-warn" data-act="leave" data-v="${C.id}">Leave</button></div>`
          : `<p class="${ok ? 'up' : 'muted'}">${ok ? 'You qualify.' : 'Members need ' + C.needs + '.'}</p><button class="btn btn-sm btn-go" data-act="join" data-v="${C.id}" ${ok && C.fee <= G.cash ? '' : 'disabled'}>Join ${fmtShort(C.fee)}</button>`}
      </div>`;
    }).join('')}</div><p class="panel-note">Vehicles you show at a club appear at its venue on the map. Friends who play online show up there too.</p>`;
    Modal.sheet.innerHTML = panelHTML('Life', this.tabs() + inner);
  },
  planner() {
    const ready = partyReady();
    const yacht = G.assets.some((a) => a.id === 'yacht');
    return `<h3 class="sub">${icon('party', 'inl')} Throw a party</h3>
      <div class="cards slim">${PARTIES.map((P_) => `<button class="card pcard ${this.party === P_.id ? 'on' : ''}" data-act="ptype" data-v="${P_.id}" ${P_.req && !yacht ? 'disabled' : ''}><b>${P_.name}</b><span>${P_.desc}</span><small>${fmtShort(P_.cost * (G.home == null ? 1.2 : 1))}${P_.req && !yacht ? ' · needs a superyacht' : ''}</small></button>`).join('')}</div>
      <div class="guestsel">${[['investors', 'Investors you know'], ['staff', 'Your staff'], ['neighbours', 'The neighbours']].map(([k, l]) => `<div class="ctl"><span class="ctl-l">${l}</span><button class="toggle ${this.guests[k] ? 'on' : ''}" data-act="guest" data-v="${k}" aria-pressed="${this.guests[k]}" aria-label="Invite ${l}"><i></i></button></div>`).join('')}</div>
      <p class="hint">Invited investors trust you more and might bring friends. Staff morale goes up. Uninvited neighbours complain about the noise.</p>
      <button class="btn btn-go" data-act="throw" ${ready ? '' : 'disabled'}>${ready ? 'Throw the Party' : `Next party in ${2 - (G.month - G.lastParty)} month${2 - (G.month - G.lastParty) === 1 ? '' : 's'}`}</button>`;
  },
  act(a, el) {
    if (closeAct(a)) return;
    const v = el.dataset.v;
    if (a === 'ptype') { this.party = v; Sound.play('tab'); }
    if (a === 'guest') { this.guests[v] = !this.guests[v]; Sound.play('tab'); }
    if (a === 'pickhome') { const r = moveIn(CITY.lots[+v]); if (!r.ok) { UI.toast({ kind: 'disaster', title: 'Can’t move in', text: r.reason }); Sound.play('error'); } else { Sound.play('buy'); UI.afterChange(); } }
    if (a === 'gohome') { const L = CITY.lots[G.home]; Modal.close(); lookAtLot(L); setTimeout(() => PV.open(L.id), 250); return; }
    if (a === 'throw') { const r = throwParty(this.party, this.guests); if (!r.ok) { UI.toast({ kind: 'disaster', title: 'Party cancelled', text: r.reason }); Sound.play('error'); } else { this.result = r; Sound.play('ach'); UI.afterChange(); } }
    if (a === 'done') this.result = null;
    if (a === 'tab') { this.tab = v; this.result = null; Sound.play('tab'); }
    if (a === 'join') { const r = joinClub(v); if (!r.ok) { UI.toast({ kind: 'disaster', title: 'Can’t join yet', text: r.reason || '' }); Sound.play('error'); } else { Sound.play('ach'); UI.afterChange(); } }
    if (a === 'leave') { leaveClub(v); Sound.play('tab'); }
    if (a === 'place') { togglePlaced(el.dataset.club, v); Sound.play('tab'); }
    if (a === 'venue') { const L = View.venues[v]; if (L) { Modal.close(); lookAtLot(L, 1.2); } return; }
    this.render();
  },
};

// ───────── stats: chart, achievements, rivals ─────────
const Stats = {
  tab: 'chart', series: 'net', players: [],
  open(tab) { if (tab) this.tab = tab; Sound.play('click'); Modal.show('m-panel', this); },
  render() {
    let inner = '';
    if (this.tab === 'chart') {
      const S = [['cash', 'Balance'], ['net', 'Net Worth'], ['loans', 'Loans Owing'], ['props', 'Portfolio Size'], ['rep', 'Reputation']];
      inner = `<div class="chart-wrap"><div class="chart-btns">${S.map(([k, l]) => `<button class="gearbtn ${k === this.series ? 'on' : ''}" data-act="series" data-v="${k}"><i>${icon('gear')}</i><span>${l}</span></button>`).join('')}</div><div class="chart-box"><canvas id="chart" aria-label="Chart over time"></canvas></div></div>`;
    } else if (this.tab === 'ach') {
      const got = ACHIEVEMENTS.filter((a) => G.ach[a.id] != null).length;
      inner = `<p class="panel-sub">${got} of ${ACHIEVEMENTS.length} unlocked</p><div class="awards">${ACHIEVEMENTS.map((a) => { const m = G.ach[a.id], on = m != null; return `<div class="award ${on ? '' : 'off'}">${medalSVG(a, on)}<div><b>${esc(a.name)}</b><span>${esc(a.desc)}</span>${on ? `<small>${MONTHS[m % 12]} ${START_YEAR + Math.floor(m / 12)}</small>` : ''}</div></div>`; }).join('')}</div>`;
    } else {
      const t = totals();
      const rows = [{ name: G.mogul, worth: t.net, props: t.props, who: 'you' }];
      for (const r of G.rivals) rows.push({ name: RIVALS.find((x) => x.id === r.id).name, worth: r.worth, who: 'ai' });
      for (const p of this.players) if (p.id !== Cloud.uid) rows.push({ name: p.name, worth: p.net, props: p.props, who: 'player', year: p.year });
      rows.sort((a, b) => b.worth - a.worth);
      inner = `<ol class="board">${rows.map((r, i) => `<li class="${r.who}"><span class="rank">${i + 1}</span><span class="who"><b></b><small>${r.who === 'you' ? 'You' : r.who === 'ai' ? 'Rival mogul' : 'Player' + (r.year ? ' · ' + r.year : '')}${r.props != null ? ' · ' + r.props + ' properties' : ''}</small></span><span class="worth">${fmtShort(r.worth)}</span></li>`).join('')}</ol>
        <p class="panel-note">${Net.avail ? 'Rival moguls are computer players. For real players, friends and co-op deals, open the online leaderboard.' : Cloud.ready ? 'Players who open this game appear here as they play.' : 'Rival moguls are computer players. Real players show up when the game is opened from its shared link while signed in.'}</p>
        ${Net.avail ? '<p class="panel-note"><button class="btn btn-go" data-act="online">Online Leaderboard</button></p>' : ''}`;
      this._rows = rows;
    }
    Modal.sheet.innerHTML = panelHTML('Stats', tabsHTML([['chart', 'Net Worth'], ['ach', 'Achievements'], ['board', 'Top Moguls']], this.tab) + inner);
    if (this.tab === 'board') $$('.board li', Modal.sheet).forEach((li, i) => { li.querySelector('b').textContent = this._rows[i].name; });
    if (this.tab === 'chart') requestAnimationFrame(() => lineChart($('#chart'), [{ data: G.hist[this.series], color: '#e8ff7a', fill: true }], { zero: this.series !== 'rep', fmt: (v) => (this.series === 'props' ? Math.round(v) : this.series === 'rep' ? v.toFixed(0) : fmtShort(v)), years: G.hist.m, dots: true }));
  },
  act(a, el) {
    if (closeAct(a)) return;
    if (a === 'online') { Social.open('board'); return; }
    if (a === 'tab') { this.tab = el.dataset.v; Sound.play('tab'); }
    if (a === 'series') { this.series = el.dataset.v; Sound.play('tab'); }
    this.render();
  },
};

// ───────── decisions ─────────
const Decision = {
  sticky: true, card: null, out: null, d: null,
  open() {
    while (G.queue.length && !decisionCard(G.queue[0])) G.queue.shift();
    if (!G.queue.length) return;
    this.d = G.queue[0]; this.card = decisionCard(this.d); this.out = null;
    Sound.play('news');
    Modal.show('m-panel m-narrow m-decide', this);
  },
  render() {
    const c = this.card, d = this.d;
    const who = c.who || 'agent';
    const look = lookFor(who, (d.lot || 0) + 3);
    const L = d.lot != null ? CITY.lots[d.lot] : null;
    const body = this.out != null
      ? `<p class="outcome">${esc(this.out || 'Done.')}</p><button class="btn btn-go" data-act="next">${G.queue.length > 1 ? 'Next' : 'Continue'}</button>`
      : `<p>${esc(c.text)}</p><div class="choices">${c.choices.map((ch, i) => `<button class="btn ${i === 0 ? 'btn-go' : ''}" data-act="choose" data-v="${i}">${esc(ch.label)}${ch.sub ? `<small>${esc(ch.sub)}</small>` : ''}</button>`).join('')}</div>`;
    Modal.sheet.innerHTML = `<div class="panel decide"><div class="dec-who">${charSVG(look, 'full', this.out == null && /broken|leak|burst|damage|sued|late|termite|mould|squat|blight|snow|feud/i.test(c.title + c.text) ? 'sad' : 'happy')}<span>${esc(nameFor(who))}</span></div>
      <div class="dec-card"><h2>${esc(c.title)}</h2>${L ? `<p class="dec-lot"><img src="${thumbURL(eff(L), 72, 54)}" alt="" width="72" height="54"> ${esc(L.addr)}, ${esc(DISTRICT_BY_ID[L.dist].name)}</p>` : ''}${body}</div></div>`;
  },
  act(a, el) {
    if (a === 'choose') {
      const out = resolveDecision(this.d, +el.dataset.v);
      G.queue.shift();
      this.out = out == null ? null : out;
      Sound.play('click');
      UI.afterChange();
      if (out == null) { Modal.close(); return; }
      this.render();
      return;
    }
    if (a === 'next') {
      if (G.queue.length) { Modal.close(); this.open(); } else Modal.close();
    }
  },
};

// ───────── succession ─────────
const Succession = {
  sticky: true, done: null,
  open() { this.done = null; Sound.play('bad'); Modal.show('m-panel m-narrow', this); },
  render() {
    const F = G.fam, h = famHead(), t = totals();
    if (this.done) {
      const { heir, tax } = this.done;
      Modal.sheet.innerHTML = `<div class="panel decide succ"><div class="succ-face">${charSVG(lookFor('family', heir.seed), 'full', 'wow')}</div><div class="dec-card"><h2>Long live ${esc(heir.first)}!</h2>
        <p>${esc(heir.first)} ${esc(F.name)} now runs the family empire${heir.relation ? ' (a nephew from out of town)' : ''}. Trait: <b>${TRAIT_BY_ID[heir.trait].name}</b>, ${TRAIT_BY_ID[heir.trait].desc.toLowerCase()}</p>
        <p>${tax ? `Estate tax took ${fmt$(tax)}. ` : ''}Reputation carried over: ${Math.round(G.rep)}. Degrees don’t pass down, but skills and staff do.</p>
        <button class="btn btn-go" data-act="go">Continue the Story</button></div></div>`;
      return;
    }
    const heirs = heirsOf(h);
    Modal.sheet.innerHTML = `<div class="panel decide succ"><div class="succ-face">${charSVG(lookFor('family', h.seed), 'full', 'sad')}</div><div class="dec-card">
      <h2>Farewell, ${esc(h.first)}</h2>
      <p>${esc(h.first)} ${esc(F.name)} (${START_YEAR + Math.floor(h.born / 12)}–${START_YEAR + Math.floor((h.died ?? G.month) / 12)}) passed away peacefully at ${ageAt(h)}, after a long life in property. The estate is worth <b>${fmt$(t.net)}</b> across <b>${t.props}</b> properties.</p>
      <p>Who takes over the family business?</p>
      <div class="choices">${heirs.length ? heirs.map((m) => `<button class="btn heir" data-act="heir" data-v="${m.id}"><i>${charSVG(lookFor('family', m.seed), 'face')}</i><span>${esc(m.first)} · ${ageAt(m)} · ${m.role === 'spouse' ? 'spouse' : m.parent === h.id ? 'child' : 'sibling'}<small>${TRAIT_BY_ID[m.trait].name}: ${TRAIT_BY_ID[m.trait].desc}</small></span></button>`).join('') : '<button class="btn btn-go" data-act="heir" data-v="-1">Call the long-lost nephew</button>'}</div>
    </div></div>`;
  },
  act(a, el) {
    if (a === 'heir') { this.done = inherit(+el.dataset.v); Sound.play('ach'); UI.afterChange(); $('#agentFace').innerHTML = charSVG(AGENT_BY_ID[G.agentId].look, 'face'); this.render(); }
    if (a === 'go') { Modal.close(); Game.save(); }
  },
};
