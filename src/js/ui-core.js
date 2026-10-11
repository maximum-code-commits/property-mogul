'use strict';
// ───────────────────────── interface: core ─────────────────────────
const ICON = {
  bank: '<path d="M3 9.5 12 4l9 5.5V11H3zM5 12.5h2.6v6H5zm5.7 0h2.6v6h-2.6zm5.7 0H19v6h-2.6zM3 19.6h18V21H3z"/>',
  coin: '<circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M14.6 8.6c-.6-.8-1.6-1.3-2.7-1.3-1.6 0-2.7.8-2.7 2 0 2.8 5.7 1.6 5.7 4.6 0 1.3-1.2 2.1-2.9 2.1-1.2 0-2.3-.5-2.9-1.3M12 5.6v1.7M12 16.7v1.7" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"/>',
  thumb: '<path d="M2 10h4v11H2zM8 21h9.2a2 2 0 0 0 2-1.6l1.6-7.2A2 2 0 0 0 18.8 10H14l.8-4.2A2.2 2.2 0 0 0 12.6 3L8 10z"/>',
  house: '<path d="M12 3 2 11.5h3V21h5.5v-6h3v6H19v-9.5h3z"/>',
  case: '<path d="M9 4h6a2 2 0 0 1 2 2v1h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h3V6a2 2 0 0 1 2-2zm0 2v1h6V6z"/>',
  medal: '<path d="M6 2h4.5L12 6l1.5-4H18l-3.4 7h-5.2z"/><circle cx="12" cy="15.5" r="6"/>',
  chart: '<path d="M3 20h18v1.8H3zM5 13h3v6H5zm5.5-4h3v10h-3zM16 5h3v14h-3z"/>',
  trophy: '<path d="M7 3h10v2h3v2.5a4 4 0 0 1-4 4h-.4A5 5 0 0 1 13 14v3h3v3H8v-3h3v-3a5 5 0 0 1-2.6-2.5H8a4 4 0 0 1-4-4V5h3zm-1 4v.5c0 1 .7 1.8 1.6 2L7 7zm11 0-.6 2.5c.9-.2 1.6-1 1.6-2V7z"/>',
  gear: '<circle cx="12" cy="12" r="7.6" fill="none" stroke="currentColor" stroke-width="4" stroke-dasharray="3 2.97"/><circle cx="12" cy="12" r="5.3" fill="none" stroke="currentColor" stroke-width="2.6"/>',
  play: '<path d="M7 4.5v15l12-7.5z"/>',
  pause: '<path d="M6 4h4v16H6zm8 0h4v16h-4z"/>',
  ff: '<path d="M3 5v14l9-7zm9 0v14l9-7z"/>',
  fff: '<path d="M1 6v12l7-6zm7.5 0v12l7-6zM16 6v12l7-6z"/>',
  music: '<path d="M9 17.5V6l11-2.5V15" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="6.5" cy="17.5" r="2.8"/><circle cx="17.5" cy="15" r="2.8"/>',
  full: '<path d="M3 9V3h6m6 0h6v6m0 6v6h-6m-6 0H3v-6" fill="none" stroke="currentColor" stroke-width="2.4"/>',
  save: '<path d="M4 3h13l4 4v14H4zm3 0v6h9V3M7 21v-7h10v7" fill="none" stroke="currentColor" stroke-width="2"/>',
  close: '<path d="M5 5l14 14M19 5 5 19" stroke="currentColor" stroke-width="3.2" stroke-linecap="round"/>',
  star: '<path d="m12 2 3 6.6 7.2.8-5.4 4.9 1.5 7.1L12 17.8l-6.3 3.6 1.5-7.1L1.8 9.4 9 8.6z"/>',
  key: '<circle cx="7.5" cy="12" r="4.5" fill="none" stroke="currentColor" stroke-width="2.6"/><path d="M12 12h10v3.5M18.5 12v3" fill="none" stroke="currentColor" stroke-width="2.6"/>',
  bolt: '<path d="M13 2 4 14h6l-1 8 9-12h-6z"/>',
  news: '<path d="M4 4.5h13v14a2 2 0 0 0 2 2H6a2 2 0 0 1-2-2zM17 9h3v9.5a2 2 0 0 1-2 2" fill="none" stroke="currentColor" stroke-width="2"/><path d="M7 7.5h7v3.5H7zm0 5.5h7v1.6H7zm0 3h5v1.6H7z"/>',
  lock: '<path d="M7 10V7a5 5 0 0 1 10 0v3h1.5v11h-13V10zm2.5 0h5V7a2.5 2.5 0 0 0-5 0z"/>',
  people: '<circle cx="8" cy="8" r="3.6"/><circle cx="16.5" cy="9" r="3"/><path d="M1.5 20c0-4 3-6.5 6.5-6.5s6.5 2.5 6.5 6.5zm13.5 0c0-2.4-.6-4.3-1.8-5.6.8-.5 1.9-.8 3.3-.8 3 0 5.5 2 5.5 6.4z"/>',
  city: '<path d="M2 21V10l5-3v14zm6 0V4l7-2v19zm8 0V9l6 2v10zM10 6h3v2h-3zm0 4h3v2h-3zm0 4h3v2h-3zm8-1h2v2h-2zm0 4h2v2h-2z"/>',
  shop: '<path d="M3 4h18l-1.5 6a3 3 0 0 1-5.5 1 3 3 0 0 1-4 0 3 3 0 0 1-5.5-1zm1.5 9H6v6h5v-4h2v4h5v-6h1.5v8h-15z"/>',
  heart: '<path d="M12 21s-8.5-5.4-8.5-11.2A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 8.5 2.8C20.5 15.6 12 21 12 21z"/>',
  crane: '<path d="M5 22V4h2v2h14v2H7v2l3 0v2H7v10zM15 8v6h2V8zM13 14h6v3h-6z"/>',
  party: '<path d="M3 21 8 7l9 9zM14 3l1 3M19 5l-2 2M21 10l-3 .5M11 4c1 1 1 2.5 0 3.5" fill="currentColor" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/>',
  handshake: '<path d="M1 12 6 7l3 1 3-2 3 2 3-1 5 5-4 3-4 4-3 1-3-2-3 1-3-4z"/>',
  school: '<path d="M12 3 1 9l11 6 9-4.9V17h2V9zM5 13.2V17c0 2 3.1 4 7 4s7-2 7-4v-3.8L12 17z"/>',
  stocks: '<path d="M3 19 9 12l4 3 7-9" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/><path d="M15 5h6v6z"/>',
  check: '<path d="M4 12.5 9.5 18 20 6" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"/>',
  plan: '<path d="M3 3h18v18H3zm2 2v6h6V5zm8 0v4h6V5zm0 6v8h6v-8zM5 13v6h6v-6z"/>',
  wrench: '<path d="M21 6.5 17.5 10 14 6.5 17.5 3A5 5 0 0 0 11 9l-8 8a2 2 0 0 0 3 3l8-8a5 5 0 0 0 7-5.5z"/>',
  doc: '<path d="M6 2h9l5 5v15H6zm8 1v5h5M9 12h8M9 15h8M9 18h5" fill="none" stroke="currentColor" stroke-width="2"/>',
};
const icon = (n, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">${ICON[n] || ICON.star}</svg>`;

// ── chibi characters ──
const HAIRS = {
  short: (c) => `<path d="M42 104C38 50 70 34 100 34s64 18 58 70c-8-26-30-40-58-40S52 76 42 104z" fill="${c}"/>`,
  spike: (c) => `<path d="M42 104c-2-38 10-58 22-62l-4-16 20 10 6-18 16 14 12-16 8 18 20-8-4 20c16 10 24 30 20 58-8-24-28-38-58-38-28 0-48 12-58 38z" fill="${c}"/>`,
  bob: (c) => `<path d="M38 120C30 60 62 34 100 34s70 26 62 86c2 16-6 26-14 20 2-40-12-68-48-70-34 2-50 30-48 70-8 6-16-4-14-20z" fill="${c}"/>`,
  long: (c) => `<path d="M36 120C28 58 62 32 100 32s72 26 64 88l4 66c-18 10-22-16-20-36 2-50-12-78-48-80-34 2-48 30-48 80 2 20-2 46-20 36z" fill="${c}"/>`,
  bun: (c) => `<circle cx="100" cy="30" r="18" fill="${c}"/><path d="M44 106C38 58 68 38 100 38s62 20 56 68c-8-26-28-40-56-40s-48 14-56 40z" fill="${c}"/>`,
  swoop: (c) => `<path d="M42 104C36 54 70 34 104 36s62 26 54 68c-8-18-18-28-30-32-18 8-48 14-70 8-6 8-12 16-16 24z" fill="${c}"/>`,
  locs: (c) => `<path d="M44 104C38 56 68 36 100 36s62 20 56 68c-8-24-28-38-56-38s-48 14-56 38z" fill="${c}"/>` + [46, 56, 144, 154].map((x) => `<path d="M${x} 96v${54 + (x % 3) * 6}" stroke="${c}" stroke-width="9" stroke-linecap="round"/>`).join(''),
  slick: (c) => `<path d="M44 100C42 58 70 40 100 40s58 18 56 60c-10-22-30-32-56-32s-46 10-56 32z" fill="${c}"/><path d="M70 50c14-6 40-6 56 2" stroke="rgba(255,255,255,.35)" stroke-width="4" fill="none" stroke-linecap="round"/>`,
  bald: (c) => `<ellipse cx="46" cy="96" rx="6" ry="12" fill="${c}"/><ellipse cx="154" cy="96" rx="6" ry="12" fill="${c}"/><path d="M76 52c10-6 26-8 40-4" stroke="rgba(255,255,255,.4)" stroke-width="5" fill="none" stroke-linecap="round"/>`,
  cap: (c, acc) => `<path d="M44 92C46 52 72 38 100 38s56 16 56 54z" fill="${acc}"/><path d="M100 88c30-2 68 4 76 12-26 4-56 0-76-4z" fill="${shade(acc, -0.2)}"/><circle cx="100" cy="40" r="4" fill="${shade(acc, -0.25)}"/>`,
};
function charSVG(k, mode = 'full', mood = 'happy') {
  const sk = k.skin, skd = shade(sk, -0.12), top = k.top, acc = k.acc || '#ffffff';
  const eyes = mood === 'sad'
    ? `<g fill="#2b1d14"><ellipse cx="78" cy="104" rx="8" ry="8"/><ellipse cx="122" cy="104" rx="8" ry="8"/></g><g fill="#fff"><circle cx="81" cy="101" r="3"/><circle cx="125" cy="101" r="3"/></g>`
    : `<g fill="#2b1d14"><ellipse cx="78" cy="102" rx="9" ry="11"/><ellipse cx="122" cy="102" rx="9" ry="11"/></g><g fill="#fff"><circle cx="81.5" cy="97.5" r="3.8"/><circle cx="125.5" cy="97.5" r="3.8"/><circle cx="75.5" cy="106" r="1.8"/><circle cx="119.5" cy="106" r="1.8"/></g>`;
  const brows = mood === 'sad' ? '<path d="M66 84l18 4M134 84l-18 4" stroke="#3b2412" stroke-width="3.4" stroke-linecap="round"/>'
    : `<path d="M67 84q10-6 20-1M113 83q10-5 20 1" stroke="${shade(k.hair, -0.1)}" stroke-width="3.4" fill="none" stroke-linecap="round"/>`;
  const mouth = mood === 'wow' ? '<ellipse cx="100" cy="130" rx="7" ry="8" fill="#7a2e22"/><ellipse cx="100" cy="134" rx="4" ry="3" fill="#f07a7a"/>'
    : mood === 'sad' ? '<path d="M90 134q10-8 20 0" stroke="#7a2e22" stroke-width="3.4" fill="none" stroke-linecap="round"/>'
      : '<path d="M88 124q12 14 24 0" fill="#7a2e22"/><path d="M93 129q7 5 14 0" fill="#f07a7a"/>';
  const glasses = k.glasses ? '<g fill="rgba(255,255,255,.2)" stroke="#2b2420" stroke-width="3"><circle cx="78" cy="102" r="15"/><circle cx="122" cy="102" r="15"/></g><path d="M93 100h14" stroke="#2b2420" stroke-width="3"/>' : '';
  const beard = k.beard ? `<path d="M56 116c6 30 24 42 44 42s38-12 44-42c-6 10-18 16-26 16-6-6-30-6-36 0-8 0-20-6-26-16z" fill="${k.hair}"/>` : '';
  const ears = k.earrings ? '<circle cx="44" cy="120" r="4" fill="#ffd34d"/><circle cx="156" cy="120" r="4" fill="#ffd34d"/>' : '';
  const hair = (HAIRS[k.hs] || HAIRS.short)(k.hair, acc);
  const behind = k.hs === 'long' || k.hs === 'bob' ? hair : '';
  const head = `
    ${behind}
    <ellipse cx="44" cy="108" rx="9" ry="12" fill="${skd}"/><ellipse cx="156" cy="108" rx="9" ry="12" fill="${skd}"/>
    <ellipse cx="100" cy="102" rx="58" ry="55" fill="${sk}"/>
    <g fill="#f07a7a" opacity=".45"><ellipse cx="64" cy="122" rx="10" ry="6"/><ellipse cx="136" cy="122" rx="10" ry="6"/></g>
    ${eyes}${brows}
    <path d="M98 112q2 4 4 0" stroke="${shade(sk, -0.3)}" stroke-width="2.4" fill="none" stroke-linecap="round"/>
    ${mouth}${beard}${behind ? '' : hair}${glasses}${ears}`;
  if (mode === 'face') return `<svg viewBox="30 22 140 140" class="char-face" aria-hidden="true">${head}</svg>`;
  const wave = mode === 'full';
  const body = `
    <ellipse cx="100" cy="292" rx="48" ry="7" fill="rgba(0,0,0,.2)"/>
    <rect x="78" y="232" width="18" height="50" rx="7" fill="${k.pants || '#2b2d33'}"/><rect x="104" y="232" width="18" height="50" rx="7" fill="${k.pants || '#2b2d33'}"/>
    <ellipse cx="86" cy="286" rx="14" ry="6" fill="#2a1c14"/><ellipse cx="114" cy="286" rx="14" ry="6" fill="#2a1c14"/>
    <path d="M64 176c0-14 16-22 36-22s36 8 36 22l4 64H60z" fill="${top}"/>
    <path d="M86 156l14 22 14-22z" fill="${acc}"/>
    ${k.tie ? `<path d="M96 162h8l4 30-8 10-8-10z" fill="${shade(acc === '#ffffff' ? '#b23a48' : acc, -0.1)}"/>` : ''}
    <path d="M66 180c-10 12-14 30-10 46" stroke="${shade(top, -0.12)}" stroke-width="15" fill="none" stroke-linecap="round"/>
    <circle cx="57" cy="230" r="9" fill="${sk}"/>
    ${wave ? `<path d="M134 178c12-8 22-22 26-40" stroke="${shade(top, -0.12)}" stroke-width="15" fill="none" stroke-linecap="round"/><circle cx="161" cy="132" r="10" fill="${sk}"/>`
      : `<path d="M134 180c10 12 14 30 10 46" stroke="${shade(top, -0.12)}" stroke-width="15" fill="none" stroke-linecap="round"/><circle cx="143" cy="230" r="9" fill="${sk}"/>`}
    <rect x="90" y="146" width="20" height="14" rx="5" fill="${skd}"/>`;
  return `<svg viewBox="0 0 200 300" class="char-full" aria-hidden="true">${body}${head}</svg>`;
}
const MAYOR = { name: 'Mayor Penelope Grant', look: { skin: '#e8b996', hair: '#8a8f99', hs: 'bun', top: '#3f527d', acc: '#d9a21c', glasses: true, earrings: true } };
function lookFor(who, seed = 1) {
  if (who === 'agent') return AGENT_BY_ID[G.agentId].look;
  if (who === 'mayor') return MAYOR.look;
  if (INVESTOR_BY_ID[who]) return INVESTOR_BY_ID[who].look;
  if (who === 'lawyer') return STAFF_BY_ID.lawyer.look;
  const r = mulberry32(seed * 7919 + (who || '').length * 31);
  return {
    skin: pick(r, ['#f0c9a4', '#c68a5b', '#8a5a3c', '#e8b996', '#f3d6bd', '#6e4630']),
    hair: pick(r, ['#2a1d16', '#6b4424', '#e0b03a', '#1b1412', '#a8552f', '#d9d4cc']),
    hs: pick(r, ['short', 'bob', 'long', 'spike', 'bun', 'swoop', 'locs', 'bald', 'cap']),
    top: pick(r, ['#e86a8a', '#3d78c2', '#3e9b4f', '#e0a43a', '#8d5fbf', '#d64b3c', '#2f7d6d']),
    acc: pick(r, ['#ffffff', '#ffd34d', '#3d78c2', '#f6e6ff']),
    glasses: r() < 0.3, beard: r() < 0.2, earrings: r() < 0.2,
  };
}
function nameFor(who) {
  if (who === 'agent') return AGENT_BY_ID[G.agentId].name;
  if (who === 'mayor') return MAYOR.name;
  if (INVESTOR_BY_ID[who]) return INVESTOR_BY_ID[who].name;
  if (who === 'lawyer') return 'Your lawyer';
  return { tenant: 'Your tenant', neighbour: 'A neighbour', friend: 'An old friend', journalist: 'Jo Inkwell, Centropolis Times' }[who] || '';
}

function medalSVG(a, got) {
  const metal = { bronze: ['#f2b98a', '#b8662f'], silver: ['#ffffff', '#9aa4b0'], gold: ['#fff3a8', '#d9a21c'], blue: ['#e6f6ff', '#5aa9d8'], green: ['#e6ffe8', '#3e9b4f'] }[a.medal];
  const id = 'm' + a.id;
  const r = got ? a.ribbon : ['#b9b2a6', '#ddd6ca'], m = got ? metal : ['#eeeae2', '#b9b2a6'];
  return `<svg viewBox="0 0 60 84" class="medal" aria-hidden="true"><defs><radialGradient id="${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${m[0]}"/><stop offset="1" stop-color="${m[1]}"/></radialGradient></defs>
    <path d="M14 0h32v34L30 44 14 34z" fill="${r[0]}"/><path d="M24 0h12v39l-6 3-6-3z" fill="${r[1]}"/>
    <circle cx="30" cy="58" r="20" fill="url(#${id})" stroke="${shade(m[1], -0.25)}" stroke-width="2"/>
    <circle cx="30" cy="58" r="14" fill="none" stroke="rgba(255,255,255,.55)" stroke-width="1.5"/>
    <path d="M30 47 19 57h3.5v10h5v-6h5v6h5V57H41z" fill="${got ? shade(m[1], -0.35) : '#a39a8c'}"/></svg>`;
}
const chip = (t, cls = '') => `<span class="chip ${cls}">${esc(t)}</span>`;
const tagChip = (L, tag) => { const pref = DISTRICT_BY_ID[L.dist].pref[tag] || 0; return chip(tag, pref > 0 ? 'hot' : ''); };
function sparkline(arr, w = 120, h = 32, col = '#f7b23b') {
  if (!arr || arr.length < 2) return `<svg width="${w}" height="${h}" class="spark" aria-hidden="true"></svg>`;
  const lo = Math.min(...arr), hi = Math.max(...arr), span = hi - lo || 1;
  const pts = arr.map((v, i) => `${(i / (arr.length - 1) * (w - 4) + 2).toFixed(1)},${(h - 3 - (v - lo) / span * (h - 6)).toFixed(1)}`).join(' ');
  const up = arr[arr.length - 1] >= arr[0];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" class="spark" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${up ? col : '#e0392b'}" stroke-width="2" stroke-linejoin="round"/><circle cx="${pts.split(' ').pop().split(',')[0]}" cy="${pts.split(' ').pop().split(',')[1]}" r="2.6" fill="${up ? col : '#e0392b'}"/></svg>`;
}
function tabsHTML(list, cur, act = 'tab') {
  return `<div class="tabs" role="tablist">${list.map(([k, l, badge]) => `<button role="tab" aria-selected="${k === cur}" class="${k === cur ? 'on' : ''}" data-act="${act}" data-v="${k}">${l}${badge ? `<i class="badge">${badge}</i>` : ''}</button>`).join('')}</div>`;
}
function panelHTML(title, inner, o = {}) {
  return `<div class="panel ${o.cls || ''}"><header class="panel-head"><h2>${title}</h2><button class="xbtn" data-act="close" aria-label="Close">${icon('close')}</button></header>${inner}</div>`;
}

// ───────── modal ─────────
const Modal = {
  el: null, sheet: null, open: false, view: null,
  show(cls, view) {
    const blur = $('#blur');
    if (!this.open) {
      try {
        const w = Math.max(1, Math.round(View.W / 10)), h = Math.max(1, Math.round(View.H / 10));
        blur.width = w; blur.height = h;
        blur.getContext('2d').drawImage(View.canvas, 0, 0, w, h);
      } catch (e) { /* ignore */ }
    }
    this.sheet.className = 'sheet ' + cls;
    this.view = view;
    this.el.hidden = false;
    this.open = true;
    View.active = false;
    view.render();
    this.sheet.scrollTop = 0;
    UI.syncTime();
  },
  close() {
    if (!this.open) return;
    if (this.view && this.view.onClose) this.view.onClose();
    this.el.hidden = true; this.open = false; this.view = null;
    this.sheet.innerHTML = '';
    View.sel = -1; View.active = true;
    UI.syncTime(); UI.hud();
  },
};

// ───────── HUD, toasts, tips, title ─────────
const UI = {
  settings: { music: true, sfx: true, pins: true, quality: 'auto' },
  speed: 1, prevSpeed: 1, lastSaved: 0,

  init() {
    Modal.el = $('#modal'); Modal.sheet = $('#sheet');
    Modal.sheet.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled && Modal.view) { Modal.view.act(b.dataset.act, b, e); return; }
      const row = e.target.closest('[data-lot]');
      if (row && Modal.view && Modal.view.rowClick) Modal.view.rowClick(+row.dataset.lot);
    });
    Modal.sheet.addEventListener('input', (e) => { if (Modal.view && Modal.view.input) Modal.view.input(e.target, e); });
    Modal.sheet.addEventListener('change', (e) => { if (Modal.view && Modal.view.change) Modal.view.change(e.target, e); });
    $('#modal .backdrop').addEventListener('click', () => { if (Modal.view && Modal.view.sticky) return; Sound.play('click'); Modal.close(); });
    $('#btnPortfolio').onclick = () => Portfolio.open();
    $('#btnCompany').onclick = () => Company.open();
    $('#btnCity').onclick = () => City.open();
    $('#btnMarket').onclick = () => Market.open();
    $('#btnHome').onclick = () => HomeView.open();
    $('#btnStats').onclick = () => Stats.open();
    $('#btnSettings').onclick = () => Settings.open();
    $('#districtBtn').onclick = () => City.open('suburbs');
    $$('#timebar [data-speed]').forEach((b) => (b.onclick = () => { this.setSpeed(+b.dataset.speed); Sound.play('tab'); }));
    $('#btnMusic').onclick = () => { this.settings.music = !this.settings.music; this.applySettings(); };
    $('#btnFull').onclick = () => {
      try { if (document.fullscreenElement) document.exitFullscreen?.(); else document.documentElement.requestFullscreen?.().catch(() => {}); } catch (e) { /* n/a */ }
    };
    $('#btnSave').onclick = () => { Game.save(true); Sound.play('coin'); };
    $('#prevD').onclick = () => this.hopDistrict(-1);
    $('#nextD').onclick = () => this.hopDistrict(1);
    $('#agentBtn').onclick = () => this.tip(true);
    View.onTap = (id) => { if (id >= 0) { lookAtLot(CITY.lots[id]); PV.open(id); } };
    View.onHover = (id, x, y) => this.tooltip(id, x, y);
    document.addEventListener('keydown', (e) => {
      if (e.target.closest && e.target.closest('input, textarea, select')) return;
      if (e.key === 'Escape' && Modal.open) { if (!(Modal.view && Modal.view.sticky)) Modal.close(); return; }
      if (!$('#title').hidden || Modal.open) return;
      const c = View.cam, step = 60 / c.z;
      if (e.key === ' ') { e.preventDefault(); this.setSpeed(this.speed ? 0 : this.prevSpeed || 1); }
      else if (e.key === '1' || e.key === '2' || e.key === '3') this.setSpeed(+e.key);
      else if (e.key === 'ArrowLeft' || e.key === 'a') { c.x -= step; View.fly = null; }
      else if (e.key === 'ArrowRight' || e.key === 'd') { c.x += step; View.fly = null; }
      else if (e.key === 'ArrowUp' || e.key === 'w') { c.y -= step; View.fly = null; }
      else if (e.key === 'ArrowDown' || e.key === 's') { c.y += step; View.fly = null; }
      else if (e.key === '+' || e.key === '=') zoomAt(View.W / 2, View.H / 2, 1.2);
      else if (e.key === '-' || e.key === '_') zoomAt(View.W / 2, View.H / 2, 1 / 1.2);
      clampCam();
    });
    Bus.on('achievement', (a) => { this.toast({ kind: 'ach', title: 'Achievement unlocked!', text: a.name, good: true }); Sound.play('ach'); });
    Bus.on('level', (l) => { this.toast({ kind: 'ach', title: `Level ${l}!`, text: 'You earned a skill point. Spend it in Company → Skills.', good: true }); Sound.play('ach'); this.hud(); });
    Bus.on('owned', (L) => floatText(L, 'SOLD to you!', '#ffe48a'));
    Bus.on('built', (L) => { floatText(L, 'Grand opening!', '#bff0c8'); neighbourSays(L.dist, 'done', L); });
    Bus.on('feed', (f) => { if (!Modal.open) this.toast({ kind: 'feed', title: f.name + ' says', text: '“' + f.t + '”', good: f.mood > 0, bad: f.mood < 0, lot: f.lot, who: f.who, life: 4200 }); });
    Bus.on('autofix', ({ card, out }) => this.toast({ kind: 'lease', title: `${STAFF_BY_ID.pm.name} handled it`, text: `${card.title}: ${out}`, life: 4200 }));
    Bus.on('openLot', (id) => { setTimeout(() => { lookAtLot(CITY.lots[id]); PV.open(id); }, 60); });
    Bus.on('bankrupt', () => setTimeout(() => Bankrupt.open(), 100));
  },
  applySettings(resize) {
    const s = this.settings;
    Store.set('pm-settings', JSON.stringify(s));
    Sound.sfx = s.sfx;
    Sound.setMusic(s.music);
    if (s.music) Sound.unlock();
    View.showPins = s.pins;
    $('#btnMusic').classList.toggle('off', !s.music);
    $('#btnMusic').setAttribute('aria-pressed', String(s.music));
    if (View.quality !== s.quality) { View.quality = s.quality; if (resize) { resizeView(); View.pages.clear(); View.pageOrder = []; } }
  },
  setSpeed(v) { if (v > 0) this.prevSpeed = v; this.speed = v; this.syncTime(); },
  syncTime() {
    $$('#timebar [data-speed]').forEach((b) => { const on = +b.dataset.speed === this.speed; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
  },
  hud() {
    if (!G) return;
    const t = totals();
    const set = (id, v) => { const el = $(id); if (el.textContent !== v) { el.textContent = v; el.parentElement.classList.remove('bump'); void el.offsetWidth; el.parentElement.classList.add('bump'); } };
    const narrow = window.innerWidth < 560;
    set('#vNet', narrow ? fmtShort(t.net) : fmt$(t.net));
    set('#vCash', narrow ? fmtShort(G.cash) : fmt$(G.cash));
    set('#vRep', String(Math.round(G.rep)));
    set('#vProps', String(t.props));
    $('#stCash').classList.toggle('neg', G.cash < 0);
    const d = dateLabel();
    $('#dMon').textContent = d.mon; $('#dYear').textContent = d.year;
    const b = $('#btnCompany .nbadge'); b.textContent = G.sp ? String(G.sp) : ''; b.hidden = !G.sp;
    const lvl = $('#lvlBadge'); lvl.textContent = 'Lv ' + G.lvl;
    const pct = (G.xp - xpForLevel(G.lvl)) / (xpForLevel(G.lvl + 1) - xpForLevel(G.lvl));
    $('#agentBtn').style.setProperty('--xp', Math.round(clamp(pct, 0, 1) * 100) + '%');
  },
  afterChange() { this.hud(); Game.saveSoon(); },
  district(name) { const b = $('#districtBtn span'); if (b.textContent !== name) b.textContent = name; },
  hopDistrict(dir) {
    const cur = centerDistrict();
    const ring = ['alpine', 'rhodes', 'rouse', 'lake', 'iron', 'port', 'kings', 'coral', 'harbour', 'maple', 'farm', 'lychee', 'cbd'];
    let i = ring.indexOf(cur.id);
    i = (i + dir + ring.length) % ring.length;
    const d = DISTRICT_BY_ID[ring[i]];
    flyToGrid(d.seed[0], d.seed[1]);
    Sound.play('tab');
  },
  toast(n) {
    const box = $('#toasts');
    const ic = { rent: 'coin', mort: 'bank', ins: 'house', tax: 'doc', news: 'news', lease: 'key', disaster: 'bolt', ach: 'medal', loan: 'bank', save: 'save', build: 'crane', feed: 'people' }[n.kind] || 'coin';
    const el = document.createElement('div');
    el.className = 'toast ' + (n.kind || '') + (n.good ? ' good' : '') + (n.kind === 'disaster' || n.bad ? ' bad' : '');
    const face = n.who != null ? `<i class="tface">${charSVG(lookFor('neighbour', n.who), 'face')}</i>` : `<i>${icon(ic)}</i>`;
    el.innerHTML = `<div class="tx"><b></b><span></span></div>${face}`;
    el.querySelector('b').textContent = n.title;
    el.querySelector('span').textContent = n.text;
    if (n.lot != null) { el.classList.add('link'); el.onclick = () => { const L = CITY.lots[n.lot]; lookAtLot(L); PV.open(L.id); }; }
    else if (n.dist) { el.classList.add('link'); el.onclick = () => City.open('suburbs', n.dist); }
    box.prepend(el);
    while (box.children.length > 4) box.lastChild.remove();
    const life = n.life || (this.speed === 3 ? 2600 : 4600);
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 400); }, life);
  },
  monthToasts(m) {
    const fast = this.speed === 3;
    if (m.rent > 0) this.toast({ kind: 'rent', title: 'Rent Received', text: `${fmt$(m.rent)} rent received`, good: true });
    if (!fast) {
      if (m.mort > 0) this.toast({ kind: 'mort', title: 'Mortgage Payments', text: `${fmt$(m.mort)} paid to lenders` });
      if (m.ins > 1) this.toast({ kind: 'ins', title: 'Insurance/Strata Payments', text: `${fmt$(m.ins)} paid for the month` });
      if (m.tax > 1) this.toast({ kind: 'tax', title: 'Income Tax', text: `${fmt$(m.tax)} on rental profit` });
      if (m.salaries > 0) this.toast({ kind: 'mort', title: 'Payroll', text: `${fmt$(m.salaries)} paid to your staff` });
    }
    for (const n of m.notes) {
      if (fast && n.kind === 'lease' && n.good) continue;
      this.toast(n);
      if (n.kind === 'news') Sound.play('news');
      if (n.kind === 'disaster') Sound.play('bad');
    }
    if (m.rent > 0) Sound.play('coin');
    let shown = 0;
    for (const [id, amt] of m.pops) {
      if (shown > 14) break;
      const L = CITY.lots[id];
      const [x, y] = lotCenterWorld(L), [sx, sy] = worldToScreen(x, y);
      if (sx < -50 || sy < -50 || sx > View.W + 50 || sy > View.H + 50) continue;
      floatText(L, '+' + fmtShort(amt)); shown++;
    }
  },
  tooltip(id, x, y) {
    const tip = $('#tip');
    if (id < 0 || Modal.open) { tip.hidden = true; return; }
    const L = CITY.lots[id], E = eff(L), K = KINDS[E.kind], st = lotState(L.id);
    let line;
    if (!isProperty(L.kind)) line = 'Not for sale';
    else if (st && st.o) {
      const n = st.units.length, occ = st.units.filter((u) => u && u.r).length;
      line = st.build ? `Under construction · ${st.build.left} months left` : `Yours · ${fmtShort(lotValue(L, st))}${n ? ` · ${occ}/${n} let` : ''}`;
    } else if (st && st.s) line = `For sale · ${fmtShort(st.s.p)}`;
    else line = `Worth ~${fmtShort(lotValue(L))}`;
    tip.innerHTML = '<b></b><span></span>';
    tip.querySelector('b').textContent = `${E.kind === 'site' ? 'Construction site' : K.name}${isProperty(L.kind) ? ' · ' + L.addr : ''}`;
    tip.querySelector('span').textContent = line;
    tip.hidden = false;
    const w = tip.offsetWidth;
    tip.style.transform = `translate(${Math.min(x + 16, View.W - w - 8)}px, ${y + 18}px)`;
  },
  tips: [
    () => `Hi ${G.mogul}! I’m ${AGENT_BY_ID[G.agentId].name}. ${AGENT_BY_ID[G.agentId].hello}`,
    () => 'Gold ★ pins are properties for sale. Tap one and we’ll inspect it, haggle, and line up the money.',
    () => 'Your cottage in Lychee has the orange house pin. Open it to try the rent slider and see the odds of keeping a tenant.',
    () => 'Centropolis is big: there’s a ski town, a lake, farms, docks and an island. Use the arrows or tap the suburb banner to explore.',
    () => 'Press play at the bottom to start the clock. Opening any screen pauses time.',
  ],
  tipIdx: 0,
  tip(click) {
    const box = $('#agentTip');
    let text;
    if (G.tut < this.tips.length) { text = this.tips[G.tut](); G.tut++; }
    else {
      const t = totals();
      const pool = [
        `The cash rate is ${fmtPct(G.market.rate, 2)}. ${G.market.rate > 0.06 ? 'Borrowing is pricey right now.' : 'Money is fairly cheap right now.'}`,
        t.vacant ? `You have ${t.vacant} empty unit${t.vacant === 1 ? '' : 's'}. Drag the rent slider left to fill ${t.vacant === 1 ? 'it' : 'them'} faster.` : 'Every unit you own has a tenant. Nice work!',
        G.sp ? `You have ${G.sp} skill point${G.sp > 1 ? 's' : ''} to spend. Check Company → Skills.` : 'Earn skill points by levelling up or finishing a degree.',
        'Investors can fund part of a purchase. Throw a party to meet more of them.',
        'Vacant land is cheap. Rezone it, then build something tall.',
        'Houses aren’t insured by default. One storm can cost you a fortune.',
        'Neighbours remember everything. Donations and parties win them back.',
        AGENT_BY_ID[G.agentId].perkText,
      ];
      text = pool[this.tipIdx++ % pool.length];
    }
    box.querySelector('p').textContent = text;
    box.hidden = false;
    box.classList.remove('pop'); void box.offsetWidth; box.classList.add('pop');
    clearTimeout(this._tipT);
    this._tipT = setTimeout(() => (box.hidden = true), click ? 7000 : 9000);
    if (click) Sound.play('click');
  },
  savedLabel() {
    if (!this.lastSaved) return 'not yet';
    const s = Math.round((Date.now() - this.lastSaved) / 1000);
    return s < 60 ? 'just now' : Math.round(s / 60) + ' min ago';
  },
  showTitle(mode) {
    $('#hud').hidden = true;
    const t = $('#title');
    t.hidden = false;
    t.classList.toggle('is-new', mode === 'new');
    t.scrollTop = 0;
    this.setSpeed(0);
    const has = !!Game.hasSave();
    $('#tContinue').hidden = !has || mode === 'new';
    $('#tMenu').hidden = mode === 'new';
    $('#tNew').hidden = mode !== 'new';
    if (mode === 'new') this.renderNew();
  },
  renderNew() {
    const wrap = $('#agents');
    if (!wrap.dataset.ready) {
      wrap.innerHTML = AGENTS.map((a, i) => `<label class="agent-card"><input type="radio" name="agent" value="${a.id}" ${i === 0 ? 'checked' : ''}>
        <div class="ac-face">${charSVG(a.look, 'face')}</div><div class="ac-txt"><b>${esc(a.name)}</b><small>${esc(a.title)}</small><span>${esc(a.perkText)}</span></div></label>`).join('');
      wrap.dataset.ready = '1';
    }
    const inp = $('#mogulName');
    if (!inp.value) inp.value = Store.get('pm-name') || '';
    setTimeout(() => inp.focus({ preventScroll: true }), 50);
  },
  hideTitle() { $('#title').hidden = true; $('#hud').hidden = false; },
};

// ───────── settings / help / bankrupt ─────────
const Settings = {
  confirm: false,
  open() { this.confirm = false; Sound.play('click'); Modal.show('m-panel m-narrow', this); },
  render() {
    const s = UI.settings;
    const tog = (k, label) => `<div class="ctl"><span class="ctl-l">${label}</span><button class="toggle ${s[k] ? 'on' : ''}" data-act="tog" data-v="${k}" aria-pressed="${!!s[k]}" aria-label="${label}"><i></i></button></div>`;
    Modal.sheet.innerHTML = panelHTML('Settings', `<div class="settings">
        ${tog('music', 'Music')}${tog('sfx', 'Sound effects')}${tog('pins', 'Map pins')}
        <div class="ctl"><span class="ctl-l">Graphics</span><div class="seg">${['low', 'auto', 'high'].map((q) => `<button class="${s.quality === q ? 'on' : ''}" data-act="quality" data-v="${q}">${q[0].toUpperCase() + q.slice(1)}</button>`).join('')}</div></div>
        <div class="set-btns">
          <button class="btn" data-act="save">${icon('save')} Save Game</button>
          <button class="btn" data-act="help">How to Play</button>
          <button class="btn" data-act="menu">Main Menu</button>
          ${this.confirm ? '<div class="confirm"><p>Start over? Your current city and portfolio will be replaced.</p><button class="btn btn-warn" data-act="reset">Yes, Start Over</button><button class="btn" data-act="noreset">Keep Playing</button></div>' : '<button class="btn btn-warn" data-act="askreset">Start a New Game</button>'}
        </div>
        <p class="panel-note">Mogul: <b class="mog"></b> · ${MONTHS_LONG[G.month % 12]} ${dateLabel().year} · Saved ${UI.savedLabel()}</p>
      </div>`, { cls: '' });
    $('.mog', Modal.sheet).textContent = G.mogul;
  },
  act(a, el) {
    const s = UI.settings;
    switch (a) {
      case 'close': Sound.play('click'); Modal.close(); return;
      case 'tog': s[el.dataset.v] = !s[el.dataset.v]; UI.applySettings(); Sound.play('tab'); break;
      case 'quality': s.quality = el.dataset.v; UI.applySettings(true); Sound.play('tab'); break;
      case 'save': Game.save(true); Sound.play('coin'); break;
      case 'help': Help.open(); return;
      case 'menu': Game.save(); Modal.close(); Game.running = false; UI.showTitle(); return;
      case 'askreset': this.confirm = true; break;
      case 'noreset': this.confirm = false; break;
      case 'reset': Modal.close(); Game.running = false; UI.showTitle('new'); return;
    }
    this.render();
  },
};
const Help = {
  open() { Sound.play('click'); Modal.show('m-panel m-narrow', this); },
  render() {
    Modal.sheet.innerHTML = panelHTML('How to Play', `<div class="help">
        <p>You start in Centropolis with <b>$1,000,000</b> and a small cottage in Lychee. Build the biggest property empire on the island.</p>
        <h3>Buying</h3>
        <p>Gold ${icon('star', 'inl')} pins are for sale. Inspect the place, haggle with the seller, then pay cash, take a mortgage, or bring in an investor. You can also approach owners who aren’t selling.</p>
        <h3>Renting</h3>
        <p>Buildings have units, and each unit has its own tenant. The rent slider shows your odds of letting a unit at each price. Businesses sign longer leases with rent rises, rent-free months and credit ratings.</p>
        <h3>Improving and building</h3>
        <p>Add upgrades like pools, suites and solar. Ask the council to rezone a lot, demolish, and design a new building with your own size, luxury and look. Neighbours will have opinions.</p>
        <h3>Your business</h3>
        <p>Hire staff, earn skill points, study for degrees, meet investors at parties in your own home, buy toys in the marketplace and dabble in stocks.</p>
        <h3>Controls</h3>
        <p>Drag to move, pinch or scroll to zoom. The arrows hop between suburbs. Space pauses; 1, 2 and 3 set the speed.</p>
      </div>`);
  },
  act(a) { if (a === 'close') { Sound.play('click'); Modal.close(); } },
};
const Bankrupt = {
  sticky: true,
  open() { Modal.show('m-panel m-narrow', this); Sound.play('bad'); },
  render() {
    Modal.sheet.innerHTML = panelHTML('Bankrupt!', `<div class="help"><div class="bk-face">${charSVG(AGENT_BY_ID[G.agentId].look, 'face', 'sad')}</div>
      <p>The bank has taken everything. Every mogul has a bad year. Some have a bad decade.</p>
      <p>Peak net worth: <b>${fmt$(Math.max(...G.hist.net))}</b>. Months in business: <b>${G.month}</b>.</p>
      <div class="set-btns"><button class="btn btn-go" data-act="again">Start a New Empire</button></div></div>`);
  },
  act(a) { if (a === 'again') { Store.del(Game.KEY); Modal.close(); Game.running = false; UI.showTitle('new'); } },
};
