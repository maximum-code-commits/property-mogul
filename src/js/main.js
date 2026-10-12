'use strict';
// ───────────────────────── boot, loop, saving ─────────────────────────
const MONTH_MS = [0, 9000, 3800, 1300];

// Optional cloud features when the game runs as a claude.ai artifact:
// a private per-player save and a shared leaderboard. Everything works without them.
const Cloud = {
  db: null, uid: null, ready: false, chain: Promise.resolve(),
  async init() {
    const C = window.claude;
    if (!C || typeof C.use !== 'function') return;
    try {
      const [db, user] = await Promise.all([C.use('db'), C.use('user')]);
      if (!db || !user) return;
      const uid = await user.id();
      if (!uid) return;
      this.db = db; this.uid = uid; this.ready = true;
      this.db.collection('leaderboard').orderBy('net', 'desc').limit(50).onSnapshot((snap) => {
        Stats.players = snap.docs.filter((d) => d.exists).map((d) => {
          const v = d.data() || {};
          return { id: d.id, name: String(v.name || 'Mogul').slice(0, 24), net: +v.net || 0, props: +v.props || 0, year: +v.year || null };
        });
        if (Modal.view === Stats && Stats.tab === 'board') Stats.render();
      }, () => {});
    } catch (e) { this.ready = false; }
  },
  async loadSave() {
    if (!this.ready) return null;
    try {
      const s = await this.db.doc(`data/users/${this.uid}/save3`).get();
      if (s.exists) { const d = s.data(); if (d && typeof d.json === 'string') return { t: +d.t || 0, json: d.json }; }
    } catch (e) { /* offline or not allowed */ }
    return null;
  },
  write(path, data) {
    if (!this.ready) return;
    this.chain = this.chain.then(() => this.db.doc(path).set(data)).catch(() => {});
  },
};

const Game = {
  KEY: 'pm-save-v3',
  running: false, cloudSave: null, netSave: null, lastCloud: 0, lastPost: 0, acc: 0, tipT: 0, _t: 0,
  local() {
    try { const raw = Store.get(this.KEY); return raw ? JSON.parse(raw) : null; } catch (e) { return null; }
  },
  hasSave() { return this.local() || this.cloudSave || this.netSave; },
  best() {
    return [this.local(), this.cloudSave, this.netSave].filter(Boolean).sort((a, b) => (b.t || 0) - (a.t || 0))[0] || null;
  },
  save(manual) {
    if (!G || !this.running) return;
    const json = JSON.stringify(G), t = Date.now();
    const okLocal = Store.set(this.KEY, JSON.stringify({ t, json }));
    UI.lastSaved = t;
    Net.pushSave(t, json, manual);
    if (Cloud.ready && (manual || t - this.lastCloud > 45000)) {
      Cloud.write(`data/users/${Cloud.uid}/save3`, { t, json });
      this.lastCloud = t;
    }
    if (Cloud.ready && (manual || t - this.lastPost > 30000)) {
      const tt = totals();
      Cloud.write('leaderboard/' + Cloud.uid, { name: String(G.mogul).slice(0, 24), net: Math.round(tt.net), props: tt.props, year: dateLabel().year, t });
      this.lastPost = t;
    }
    if (manual) UI.toast({ kind: 'save', title: 'Game saved', text: Cloud.ready || Net.on ? 'Saved to your account and this browser.' : okLocal ? 'Saved in this browser.' : 'This browser blocked saving.', life: 2400 });
  },
  saveSoon() { clearTimeout(this._t); this._t = setTimeout(() => this.save(), 1200); },
  enterCity(isNew) {
    resetWorldCaches();
    this.running = true;
    this.acc = 0;
    UI.hideTitle();
    const L = CITY.lots[CITY.startLot];
    const mine = owned();
    lookAtLot(mine[0] || L, window.innerWidth < 640 ? 0.8 : 1.05, true);
    View.cam.z *= 0.6; // swoop in
    lookAtLot(mine[0] || L, window.innerWidth < 640 ? 0.8 : 1.05);
    $('#agentFace').innerHTML = charSVG(AGENT_BY_ID[G.agentId].look, 'face');
    syncMyBoats();
    UI.hud();
    UI.setSpeed(isNew ? 0 : 1);
    this.tipT = isNew ? 1.2 : 0;
    if (isNew) { G.tut = 0; } else G.tut = Math.max(G.tut || 0, UI.tips.length);
    G.bankrupt = false;
    Sound.unlock();
    this.save();
    setTimeout(() => Net.sync(true), 1500);
  },
  startNew(name, agentId, seed) {
    if (seed != null) newGame(name, agentId, seed); else newGame(name, agentId);
    Store.set('pm-name', name);
    this.enterCity(true);
  },
  resume(save) {
    try { const d = JSON.parse(save.json); if (d.v !== 3 && d.v !== 4) throw new Error('old save'); loadGame(d); } catch (e) { UI.showTitle('new'); return; }
    this.enterCity(false);
  },
};

let _last = 0, _distT = 0, _fill = -1;
function loop(now) {
  const real = Math.min(0.25, Math.max(0, (now - (_last || now)) / 1000));
  const dt = Math.min(0.05, real);
  _last = now;
  if (Game.running && G) {
    const ticking = !Modal.open && UI.speed > 0;
    if (ticking) {
      Game.acc += real * 1000;
      if (Game.acc >= MONTH_MS[UI.speed]) {
        Game.acc = 0;
        const m = advanceMonth();
        UI.monthToasts(m);
        UI.hud();
        if (G.month % 3 === 0) Game.save();
      }
    }
    if (!Modal.open && G.queue.length && $('#title').hidden) { if (G.queue[0].type === 'succession') Succession.open(); else Decision.open(); }
    const f = UI.speed ? Math.round(Game.acc / MONTH_MS[UI.speed] * 100) / 100 : _fill;
    if (f !== _fill) { _fill = f; $('#dFill').style.transform = `scaleX(${clamp(f, 0, 1)})`; }
    if (View.active) drawFrame(dt);
    _distT += dt;
    if (_distT > 0.3) { _distT = 0; UI.district(centerDistrict().name); }
    if (Game.tipT > 0 && !Modal.open) {
      Game.tipT -= dt;
      if (Game.tipT <= 0 && G.tut < UI.tips.length) {
        UI.tip(false);
        Game.tipT = G.tut < UI.tips.length ? 8.5 : 0;
        if (G.tut >= UI.tips.length && UI.speed === 0) UI.setSpeed(1);
      }
    }
  }
  requestAnimationFrame(loop);
}

// ── skyline silhouette for the title screen ──
function skylineSVG() {
  const r = mulberry32(21);
  const hill = (x) => 170 - 58 * Math.sin(Math.PI * x / 1200) + 10 * Math.sin(x / 90);
  let s = '<path d="M0 ' + hill(0).toFixed(1);
  for (let x = 20; x <= 1200; x += 20) s += 'L' + x + ' ' + hill(x).toFixed(1);
  s += 'V240H0z"/>';
  for (let x = 10; x < 1200; x += 34 + r() * 40) {
    const y = hill(x) + 6, t = r();
    if (t < 0.32) { // house
      const w = 30 + r() * 26, h = 18 + r() * 14;
      s += `<path d="M${x} ${y}v-${h}l${w / 2} -${h * 0.7}l${w / 2} ${h * 0.7}v${h}z"/>`;
      if (r() < 0.6) s += `<rect x="${x + w * 0.7}" y="${y - h - 16}" width="5" height="12"/>`;
    } else if (t < 0.48) { // steeple
      s += `<path d="M${x} ${y}v-30l9-10 9 10v30z"/><path d="M${x + 4} ${y - 38}l5-34 5 34z"/>`;
    } else if (t < 0.7) { // tree
      const rr = 10 + r() * 10;
      s += `<rect x="${x - 2}" y="${y - rr - 8}" width="4" height="${rr + 8}"/><circle cx="${x}" cy="${y - rr - 12}" r="${rr}"/><circle cx="${x + rr * 0.7}" cy="${y - rr - 5}" r="${rr * 0.7}"/>`;
    } else if (t < 0.84) { // factory
      s += `<path d="M${x} ${y}v-26l14-10v10l14-10v10l14-10v36z"/><rect x="${x + 36}" y="${y - 54}" width="7" height="30"/>`;
    } else { // terrace row
      for (let k = 0; k < 3; k++) s += `<path d="M${x + k * 16} ${y}v-24l8-9 8 9v24z"/>`;
    }
  }
  return `<svg viewBox="0 0 1200 240" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${s}</svg>`;
}

function boot(hot) {
  try { Object.assign(UI.settings, JSON.parse(Store.get('pm-settings') || '{}')); } catch (e) { /* defaults */ }
  View.quality = UI.settings.quality;
  View.showPins = UI.settings.pins;
  Sound.music = UI.settings.music; Sound.sfx = UI.settings.sfx;
  $$('[data-icon]').forEach((el) => el.insertAdjacentHTML('afterbegin', icon(el.dataset.icon)));
  $('#skyline').innerHTML = skylineSVG();
  initView($('#city'));
  UI.init();
  UI.applySettings();

  $('#tContinue').onclick = () => { const s = Game.best(); if (s) { Sound.unlock(); Game.resume(s); } };
  $('#tNewBtn').onclick = () => { Sound.unlock(); UI.showTitle('new'); };
  $('#tHow').onclick = () => { Sound.unlock(); Help.open(); };
  $('#tBack').onclick = () => UI.showTitle();
  $('#tNew').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = ($('#mogulName').value || '').trim().slice(0, 20) || 'Mogul';
    const ag = ($('input[name="agent"]:checked') || {}).value || AGENTS[0].id;
    const cs = $('#tCity').hidden ? '' : $('#citySel').value;
    Sound.unlock(); Sound.play('buy');
    Game.startNew(name, ag, cs ? +cs : null);
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) Game.save(); });
  window.addEventListener('pagehide', () => Game.save());

  try {
    window.claude?.hot?.snapshot?.(() => ({ save: G && Game.running ? JSON.stringify(G) : null, cam: { ...View.cam }, speed: UI.speed }));
  } catch (e) { /* not in a viewer */ }

  if (hot && hot.save) {
    loadGame(JSON.parse(hot.save));
    Game.enterCity(false);
    if (hot.cam) Object.assign(View.cam, hot.cam), View.fly = null;
    UI.setSpeed(hot.speed ?? 1);
  } else {
    UI.showTitle();
  }
  Net.init().then(async () => {
    UI.socialBadge();
    if (!Game.running && !$('#title').hidden) TitleOnline.render();
    const n = await Net.loadSave();
    if (n) { Game.netSave = n; if (!Game.running && !$('#title').hidden && $('#tNew').hidden) $('#tContinue').hidden = false; }
  });
  Cloud.init().then(async () => {
    const c = await Cloud.loadSave();
    if (c) { Game.cloudSave = c; if (!Game.running && !$('#title').hidden && $('#tNew').hidden) $('#tContinue').hidden = false; }
  });
  requestAnimationFrame(loop);
}

(function start() {
  const h = window.claude && window.claude.hot;
  try {
    if (h && typeof h.ready === 'function') { h.ready((d) => boot(d || {})); return; }
  } catch (e) { /* fall through */ }
  boot((h && h.data) || {});
})();

// local development only: lets a console reach into the game's scope
if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) window.__pm = (src) => eval(src);
