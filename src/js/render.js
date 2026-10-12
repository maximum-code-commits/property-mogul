'use strict';
// ───────────────────────── city renderer ─────────────────────────
// Ground is baked into 512px world "pages"; buildings are cached sprites
// drawn back-to-front with the traffic merged into the same depth order.
const PAGE = 512;
const ZMIN = 0.2, ZMAX = 2.6;

const View = {
  canvas: null, ctx: null, dpr: 1, W: 0, H: 0,
  cam: { x: 0, y: 0, z: 1 }, fly: null, vel: { x: 0, y: 0 },
  pages: new Map(), pageOrder: [],
  spr: new Map(), sprPrev: null, sprB: 1, zoomStill: 0,
  topZ: new Map(), smokeOf: new Map(),
  hover: -1, sel: -1,
  cars: [], peds: [], boats: [], myBoats: [], plane: null, nextPlane: 12, clouds: [], puffs: [], balloon: null,
  parts: [], pins: [],
  waterPat: null,
  active: true, quality: 'auto', showPins: true,
  t: 0,
  onTap: null, onHover: null,
};

function qualityCap() {
  const d = window.devicePixelRatio || 1;
  return View.quality === 'low' ? 1 : View.quality === 'high' ? Math.min(d, 3) : Math.min(d, 2);
}
function bucket(s) { return clamp(Math.pow(2, Math.round(Math.log2(Math.max(s, 0.01)) * 2) / 2), 0.35, 2.83); }

// ── world helpers ──
const wx = (gx, gy) => (gx - gy) * HW;
const wy = (gx, gy) => (gx + gy) * HH;
function worldToGrid(x, y) { return [(x / HW + y / HH) / 2, (y / HH - x / HW) / 2]; }
function screenToWorld(sx, sy) { const c = View.cam; return [(sx - View.W / 2) / c.z + c.x, (sy - View.H / 2) / c.z + c.y]; }
function worldToScreen(x, y) { const c = View.cam; return [(x - c.x) * c.z + View.W / 2, (y - c.y) * c.z + View.H / 2]; }
function lotCenterWorld(L) { return [wx(L.x + L.w / 2, L.y + L.d / 2), wy(L.x + L.w / 2, L.y + L.d / 2)]; }
function visualLot(L) { return G ? eff(L) : L; }
function lotTop(L) { const E = visualLot(L); return View.topZ.get(spriteKey(E)) ?? spriteTop(E) * 0.7; }

// ── setup ──
function initView(canvas) {
  View.canvas = canvas;
  View.ctx = canvas.getContext('2d', { alpha: false });
  resizeView();
  window.addEventListener('resize', resizeView);
  if (window.visualViewport) window.visualViewport.addEventListener('resize', resizeView);
  bindInput(canvas);
  buildWater();
  for (let i = 0; i < 9; i++) View.clouds.push({ x: (rnd() - 0.5) * 6400, y: rnd() * 3200, s: 0.8 + rnd() * 0.9, v: 6 + rnd() * 6 });
}
function resizeView() {
  const c = View.canvas;
  const r = c.getBoundingClientRect();
  View.W = Math.max(1, r.width); View.H = Math.max(1, r.height);
  View.dpr = qualityCap();
  c.width = Math.round(View.W * View.dpr); c.height = Math.round(View.H * View.dpr);
  clampCam();
}
function buildWater() {
  const t = document.createElement('canvas');
  t.width = 256; t.height = 128;
  const g = t.getContext('2d');
  g.fillStyle = '#4c9fc8'; g.fillRect(0, 0, 256, 128);
  const r = mulberry32(7);
  for (let i = 0; i < 26; i++) {
    const x = r() * 256, y = r() * 128, l = 6 + r() * 12;
    g.strokeStyle = r() < 0.5 ? 'rgba(255,255,255,.22)' : 'rgba(30,90,140,.25)';
    g.lineWidth = 1.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(x, y); g.quadraticCurveTo(x + l / 2, y - 2, x + l, y); g.stroke();
    if (x + l > 256) { g.beginPath(); g.moveTo(x - 256, y); g.quadraticCurveTo(x - 256 + l / 2, y - 2, x - 256 + l, y); g.stroke(); }
  }
  View.waterPat = View.ctx.createPattern(t, 'repeat');
}
function resetWorldCaches() {
  View.pages.clear(); View.pageOrder = [];
  View.spr.clear(); View.sprPrev = null; View.topZ.clear(); View.smokeOf.clear();
  View.cars = []; View.peds = []; View.boats = []; View.parts = []; View.puffs = [];
  View.venues = {};
  for (const [club, kind] of [['car', 'racetrack'], ['yacht', 'marina'], ['ski', 'skislope'], ['golf', 'golf']]) View.venues[club] = CITY.lots.find((l) => l.kind === kind) || null;
  spawnTraffic();
}

// ── camera ──
function clampCam() {
  const c = View.cam, N = MAP_N;
  c.z = clamp(c.z, ZMIN, ZMAX);
  c.x = clamp(c.x, -N * HW * 0.95, N * HW * 0.95);
  c.y = clamp(c.y, 0, N * 2 * HH);
}
function lookAtLot(L, z, instant) {
  const [x, y] = lotCenterWorld(L);
  const ty = y - lotTop(L) * 0.35;
  if (instant) { View.cam.x = x; View.cam.y = ty; if (z) View.cam.z = z; clampCam(); }
  else View.fly = { x, y: ty, z: z || View.cam.z, t: 0 };
}
function flyToGrid(gx, gy, z) { View.fly = { x: wx(gx, gy), y: wy(gx, gy), z: z || View.cam.z, t: 0 }; }
function zoomAt(sx, sy, f) {
  const c = View.cam;
  const [ax, ay] = screenToWorld(sx, sy);
  c.z = clamp(c.z * f, ZMIN, ZMAX);
  const [bx, by] = screenToWorld(sx, sy);
  c.x += ax - bx; c.y += ay - by;
  View.fly = null; View.zoomStill = 0;
  clampCam();
}
function centerDistrict() {
  const [x, y] = screenToWorld(View.W / 2, View.H / 2);
  const [gx, gy] = worldToGrid(x, y);
  const ix = clamp(Math.floor(gx), 0, MAP_N - 1), iy = clamp(Math.floor(gy), 0, MAP_N - 1);
  return DISTRICTS[CITY.distGrid[iy * MAP_N + ix]];
}

// ── ground pages ──
function tileAt(x, y) { return x < 0 || y < 0 || x >= MAP_N || y >= MAP_N ? T_WATER : CITY.tiles[y * MAP_N + x]; }
const isRoad = (t) => t === T_ROAD || t === T_BRIDGE;
function styleAt(x, y) { return DISTRICTS[CITY.distGrid[clamp(y, 0, MAP_N - 1) * MAP_N + clamp(x, 0, MAP_N - 1)]].style; }
function groundColor(x, y) {
  const d = DISTRICTS[CITY.distGrid[y * MAP_N + x]];
  const n = fbm(x * 0.22, y * 0.22, 5);
  if (d.style === 'snow') return shade('#eaf1f6', (n - 0.5) * 0.06);
  if (d.style === 'farm') return shade(n > 0.55 ? '#c9cf73' : d.grass, (n - 0.5) * 0.14);
  if (d.style === 'industrial') return shade(mix(d.grass, '#b9b4a6', 0.35), (n - 0.5) * 0.12);
  return shade(d.grass, (n - 0.5) * 0.16);
}
function drawTile(ctx, x, y) {
  const t = tileAt(x, y);
  if (t === T_WATER) return;
  const style = styleAt(x, y);
  const dia = [[x, y, 0], [x + 1, y, 0], [x + 1, y + 1, 0], [x, y + 1, 0]];
  const wS = tileAt(x, y + 1) === T_WATER, wE = tileAt(x + 1, y) === T_WATER;
  const wN = tileAt(x, y - 1) === T_WATER, wW = tileAt(x - 1, y) === T_WATER;
  const bridge = t === T_BRIDGE;
  const cliff = bridge ? 5 : 9;
  const soil = style === 'snow' ? ['#c9d6e0', '#a9b8c6'] : style === 'beach' ? ['#e6cf8f', '#d1b670'] : ['#b08a5a', '#957247'];
  if (wS && !(bridge && isRoad(tileAt(x, y + 1)))) {
    face(ctx, [[x, y + 1, 0], [x + 1, y + 1, 0], [x + 1, y + 1, -cliff], [x, y + 1, -cliff]], bridge ? '#9b958a' : soil[0], false);
    if (!bridge) face(ctx, [[x, y + 1, -cliff * 0.45], [x + 1, y + 1, -cliff * 0.45], [x + 1, y + 1, -cliff], [x, y + 1, -cliff]], shade(soil[0], -0.12), false);
  }
  if (wE && !(bridge && isRoad(tileAt(x + 1, y)))) {
    face(ctx, [[x + 1, y, 0], [x + 1, y + 1, 0], [x + 1, y + 1, -cliff], [x + 1, y, -cliff]], bridge ? '#7f7a70' : soil[1], false);
    if (!bridge) face(ctx, [[x + 1, y, -cliff * 0.45], [x + 1, y + 1, -cliff * 0.45], [x + 1, y + 1, -cliff], [x + 1, y, -cliff]], shade(soil[1], -0.12), false);
  }
  if (bridge && wS) { const [px, py] = P(x + 0.5, y + 1, -5); ctx.fillStyle = '#8a857b'; ctx.fillRect(px - 2, py, 4, 6); }
  let base;
  if (t === T_SAND) base = style === 'snow' ? '#e2ebf1' : '#ecdcab';
  else if (isRoad(t)) base = bridge ? '#c9c2b4' : style === 'snow' ? '#e9eef2' : style === 'farm' ? '#c9b08a' : '#ddd5c4';
  else base = groundColor(x, y);
  path(ctx, dia); ctx.fillStyle = base; ctx.fill(); ctx.strokeStyle = base; ctx.lineWidth = 1.1; ctx.stroke();
  if (t === T_GRASS && hash2(x, y, 3) < 0.12 && style !== 'industrial') {
    const [fx, fy] = P(x + 0.3 + hash2(x, y, 4) * 0.4, y + 0.3 + hash2(x, y, 5) * 0.4, 0);
    circle(ctx, fx, fy, 1.3, style === 'snow' ? '#ffffff' : hash2(x, y, 6) < 0.5 ? '#fff6c8' : '#f6a5b8');
  }
  if (t === T_TRACK) {
    // farm track: dirt path between hedgerows
    const alongX = y % BLOCK === 0;
    ctx.fillStyle = '#b8955f';
    if (alongX) path(ctx, [[x, y + 0.35, 0], [x + 1, y + 0.35, 0], [x + 1, y + 0.65, 0], [x, y + 0.65, 0]]);
    else path(ctx, [[x + 0.35, y, 0], [x + 0.65, y, 0], [x + 0.65, y + 1, 0], [x + 0.35, y + 1, 0]]);
    ctx.fill();
    ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 0.8;
    for (let k = 0; k < 3; k++) {
      const t2 = (k + 0.5) / 3;
      const [a, b] = alongX ? P(x + t2, y + 0.15, 0) : P(x + 0.15, y + t2, 0);
      ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(a, b - 4); ctx.stroke();
    }
  }
  if (isRoad(t)) {
    const n = isRoad(tileAt(x, y - 1)), e = isRoad(tileAt(x + 1, y)), s = isRoad(tileAt(x, y + 1)), w = isRoad(tileAt(x - 1, y));
    const k = bridge ? 0.12 : 0.16;
    const en = n ? 0 : k, ee = e ? 0 : k, es = s ? 0 : k, ew = w ? 0 : k;
    const asphalt = style === 'farm' && !bridge ? '#a88a62' : style === 'snow' ? '#7a828c' : '#62686f';
    face(ctx, [[x + ew, y + en, 0], [x + 1 - ee, y + en, 0], [x + 1 - ee, y + 1 - es, 0], [x + ew, y + 1 - es, 0]], asphalt, false);
    ctx.strokeStyle = asphalt; ctx.lineWidth = 0.8; ctx.stroke();
    const alongX = (e || w) && !(n || s), alongY = (n || s) && !(e || w);
    if (style !== 'farm' || bridge) {
      ctx.strokeStyle = 'rgba(255,248,220,.85)'; ctx.lineWidth = 1.3;
      if (alongX) { path(ctx, [[x + 0.3, y + 0.5, 0], [x + 0.7, y + 0.5, 0]]); ctx.stroke(); }
      if (alongY) { path(ctx, [[x + 0.5, y + 0.3, 0], [x + 0.5, y + 0.7, 0]]); ctx.stroke(); }
      if ((e || w) && (n || s)) {
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        for (let i = 0; i < 4; i++) { const a = 0.22 + i * 0.16; path(ctx, [[x + a, y + 0.06, 0], [x + a + 0.08, y + 0.06, 0], [x + a + 0.08, y + 0.2, 0], [x + a, y + 0.2, 0]]); ctx.fill(); }
      }
    }
    if (style === 'snow' && !bridge) { ctx.fillStyle = 'rgba(255,255,255,.7)'; for (let i = 0; i < 3; i++) { const [a, b] = P(x + hash2(x, y, i) * 0.9 + 0.05, y + hash2(y, x, i) * 0.9 + 0.05, 0); ctx.fillRect(a - 2, b - 0.5, 4, 1); } }
    if (bridge) {
      ctx.strokeStyle = '#f2ede2'; ctx.lineWidth = 1.2;
      const rail = (a, b) => {
        const [x1, y1] = P(a[0], a[1], 4), [x2, y2] = P(b[0], b[1], 4);
        ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke();
        for (let i = 0; i <= 3; i++) { const t2 = i / 3; const [px, py] = P(lerp(a[0], b[0], t2), lerp(a[1], b[1], t2), 0); ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px, py - 4); ctx.stroke(); }
      };
      if (!n) rail([x, y + 0.04], [x + 1, y + 0.04]);
      if (!s) rail([x, y + 0.96], [x + 1, y + 0.96]);
      if (!w) rail([x + 0.04, y], [x + 0.04, y + 1]);
      if (!e) rail([x + 0.96, y], [x + 0.96, y + 1]);
    }
  }
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.6;
  const foam = (a, b, z) => { const [x1, y1] = P(a[0], a[1], z), [x2, y2] = P(b[0], b[1], z); ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.stroke(); };
  if (!bridge) {
    if (wS) foam([x, y + 1], [x + 1, y + 1], -cliff);
    if (wE) foam([x + 1, y], [x + 1, y + 1], -cliff);
    if (wN) foam([x, y], [x + 1, y], 0);
    if (wW) foam([x, y], [x, y + 1], 0);
  }
}
function renderPage(i, j, B) {
  const c = document.createElement('canvas');
  c.width = c.height = Math.ceil(PAGE * B);
  const ctx = c.getContext('2d');
  ctx.setTransform(B, 0, 0, B, -i * PAGE * B, -j * PAGE * B);
  ctx.lineJoin = 'round';
  const x0 = i * PAGE, y0 = j * PAGE, x1 = x0 + PAGE, y1 = y0 + PAGE;
  const N = MAP_N;
  for (let s = 0; s <= 2 * (N - 1); s++) {
    const ty = s * HH;
    if (ty > y1 + 4) break;
    if (ty + 2 * HH + 12 < y0) continue;
    for (let x = Math.max(0, s - N + 1); x <= Math.min(s, N - 1); x++) {
      const y = s - x, tx = (x - y) * HW;
      if (tx + HW + 2 < x0 || tx - HW - 2 > x1) continue;
      drawTile(ctx, x, y);
    }
  }
  return c;
}
function getPage(i, j, B, allowBuild) {
  const k = B + '|' + i + '|' + j;
  let p = View.pages.get(k);
  if (p) return p;
  if (!allowBuild) return null;
  p = renderPage(i, j, B);
  View.pages.set(k, p); View.pageOrder.push(k);
  const limit = View.W * View.H > 1.2e6 ? 70 : 40;
  while (View.pageOrder.length > limit) View.pages.delete(View.pageOrder.shift());
  return p;
}

// ── sprites ──
function getSprite(E, B, budget) {
  const k = spriteKey(E);
  let s = View.spr.get(k);
  if (s) return s;
  if (budget.left > 0 || !View.sprPrev || !View.sprPrev.get(k)) {
    const t0 = performance.now();
    s = makeSprite(E, B);
    View.spr.set(k, s); View.topZ.set(k, s.topZ);
    budget.left -= performance.now() - t0;
    return s;
  }
  budget.missed = true;
  return View.sprPrev.get(k);
}

// ── traffic, people, boats ──
const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
function spawnTraffic() {
  const low = View.quality === 'low';
  const nCars = low ? 40 : 110, nPeds = low ? 30 : 90;
  const roads = CITY.roadTiles;
  const seed = (arr, n, mk) => {
    for (let i = 0; i < n && roads.length; i++) {
      const t = roads[Math.floor(rnd() * roads.length)];
      const x = t % MAP_N, y = Math.floor(t / MAP_N);
      const opts = DIRS.map((d, k) => k).filter((k) => isRoad(tileAt(x + DIRS[k][0], y + DIRS[k][1])));
      if (opts.length) arr.push(mk(x, y, pick(rnd, opts)));
    }
  };
  seed(View.cars, nCars, (x, y, dir) => ({ x, y, dir, p: rnd(), v: 1.1 + rnd() * 0.9, color: pick(rnd, CARS), bus: rnd() < 0.08 }));
  seed(View.peds, nPeds, (x, y, dir) => ({ x, y, dir, p: rnd(), v: 0.18 + rnd() * 0.12, color: pick(rnd, CARS.concat(['#e86a8a', '#ffd34d'])), skin: pick(rnd, ['#f0c9a4', '#c68a5b', '#8a5a3c', '#e8b996']), side: rnd() < 0.5 ? 1 : -1, ph: rnd() * TAU }));
  let tries = 0;
  while (View.boats.length < 12 && tries++ < 3000) {
    const x = rnd() * MAP_N, y = rnd() * MAP_N;
    if (!waterAt(x, y, 1.2)) continue;
    View.boats.push({ x, y, a: rnd() * TAU, v: 0.25 + rnd() * 0.35, sail: rnd() < 0.5, turn: 0 });
  }
}
function waterAt(x, y, r = 0.6) {
  for (const [dx, dy] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) {
    const ix = Math.floor(x + dx), iy = Math.floor(y + dy);
    const inside = ix >= 0 && iy >= 0 && ix < MAP_N && iy < MAP_N;
    if (inside && CITY.tiles[iy * MAP_N + ix] !== T_WATER) return false;
    if (!inside && (ix < -8 || iy < -8 || ix > MAP_N + 8 || iy > MAP_N + 8)) return false;
  }
  return true;
}
function stepWalker(c, dt) {
  c.p += c.v * dt;
  while (c.p >= 1) {
    c.p -= 1;
    c.x += DIRS[c.dir][0]; c.y += DIRS[c.dir][1];
    const back = (c.dir + 2) % 4;
    const opts = [];
    for (let k = 0; k < 4; k++) if (k !== back && isRoad(tileAt(c.x + DIRS[k][0], c.y + DIRS[k][1]))) opts.push(k);
    if (!opts.length) c.dir = back;
    else if (!(opts.includes(c.dir) && rnd() < 0.7)) c.dir = pick(rnd, opts);
  }
}
function syncMyBoats() {
  const want = (G?.assets || []).filter((a) => ['yacht', 'sail', 'runabout'].includes(a.id));
  View.myBoats = View.myBoats.filter((b) => want.some((a) => a.uid === b.uid));
  for (const a of want) {
    if (View.myBoats.some((b) => b.uid === a.uid)) continue;
    let tries = 0, x = 55, y = 85;
    while (tries++ < 2000) { x = 40 + rnd() * 50; y = 60 + rnd() * 38; if (waterAt(x, y, a.id === 'yacht' ? 1.6 : 1)) break; }
    View.myBoats.push({ uid: a.uid, kind: a.id, x, y, a: rnd() * TAU, v: a.id === 'yacht' ? 0.18 : 0.3, turn: 0 });
  }
}
function updateTraffic(dt) {
  for (const c of View.cars) stepWalker(c, dt);
  for (const p of View.peds) stepWalker(p, dt);
  for (const b of View.boats.concat(View.myBoats)) {
    const nx = b.x + Math.cos(b.a) * b.v * dt, ny = b.y + Math.sin(b.a) * b.v * dt;
    if (waterAt(nx, ny, b.kind === 'yacht' ? 1 : 0.6)) { b.x = nx; b.y = ny; b.a += b.turn * dt; if (rnd() < 0.01) b.turn = (rnd() - 0.5) * 0.6; }
    else b.a += Math.PI * (0.5 + rnd() * 0.5);
  }
  for (let i = View.puffs.length - 1; i >= 0; i--) { const p = View.puffs[i]; p.t += dt; p.y -= dt * 10; p.x += dt * 5; if (p.t > 3.5) View.puffs.splice(i, 1); }
}
function carPos(c) {
  const d = DIRS[c.dir];
  const ox = d[1] * 0.2, oy = -d[0] * 0.2;
  return [c.x + 0.5 + d[0] * c.p + ox, c.y + 0.5 + d[1] * c.p + oy];
}
function pedPos(p) {
  const d = DIRS[p.dir];
  const o = 0.42 * p.side;
  return [p.x + 0.5 + d[0] * p.p + d[1] * o, p.y + 0.5 + d[1] * p.p - d[0] * o];
}
const _carSprites = new Map();
function carSprite(color, alongX, bus, B) {
  const k = color + alongX + bus + B;
  let s = _carSprites.get(k);
  if (s) return s;
  const c = document.createElement('canvas');
  const w = 40, h = 34;
  c.width = Math.ceil(w * B); c.height = Math.ceil(h * B);
  const g = c.getContext('2d');
  g.setTransform(B, 0, 0, B, (w / 2) * B, 22 * B);
  g.fillStyle = 'rgba(0,0,0,.18)'; g.beginPath(); g.ellipse(2, 2, 11, 5, 0, 0, TAU); g.fill();
  if (bus) {
    const L = 0.62, W = 0.22;
    const x0 = alongX ? -L / 2 : -W / 2, x1 = -x0, y0 = alongX ? -W / 2 : -L / 2, y1 = -y0;
    box(g, x0, y0, x1, y1, 0.5, 10, '#f0c23a');
    if (alongX) faceL(g, x0, y1, 0.5, () => { g.fillStyle = '#bfe2f2'; g.fillRect(0.04, 5, L - 0.08, 3.4); });
    else faceR(g, x1, y0, 0.5, () => { g.fillStyle = '#bfe2f2'; g.fillRect(0.04, 5, L - 0.08, 3.4); });
  } else car(g, 0, 0, alongX, color);
  s = { c, w, h, ax: w / 2, ay: 22 };
  _carSprites.set(k, s);
  if (_carSprites.size > 200) _carSprites.clear();
  return s;
}

// ── particles / plane ──
function floatText(L, text, color = '#ffe48a') {
  const [x, y] = lotCenterWorld(L);
  View.parts.push({ x, y: y - lotTop(L), text, color, t: 0 });
}
function updateSky(dt) {
  View.nextPlane -= dt;
  const jet = G && G.assets.some((a) => a.id === 'jet' || a.id === 'seaplane');
  if (!View.plane && View.nextPlane <= 0) {
    const dir = rnd() < 0.5 ? 1 : -1;
    const y = 300 + rnd() * 2600;
    View.plane = { x: -dir * 4200, y, vx: dir * 230, vy: -dir * 30 + (rnd() - 0.5) * 40, life: 0, mine: jet && rnd() < 0.6 };
    View.nextPlane = 40 + rnd() * 40;
  }
  if (View.plane) {
    const p = View.plane;
    p.x += p.vx * dt; p.y += p.vy * dt; p.life += dt;
    if (p.life > 40) View.plane = null;
  }
  if (G && G.assets.some((a) => a.id === 'balloon')) {
    if (!View.balloon) View.balloon = { x: (rnd() - 0.5) * 3000, y: 800 + rnd() * 1600 };
    View.balloon.x += dt * 8; View.balloon.y -= dt * 2;
    if (View.balloon.x > 3500) View.balloon.x = -3500;
  } else View.balloon = null;
  for (const c of View.clouds) { c.x += c.v * dt; if (c.x > 3600) { c.x = -3600; c.y = rnd() * 3200; } }
}
function drawPlane(ctx, p, z) {
  const [sx, sy] = worldToScreen(p.x, p.y);
  const alt = 220 * z;
  const ang = Math.atan2(p.vy, p.vx);
  const s = clamp(z, 0.45, 1.4);
  const shape = (g, fill) => {
    g.fillStyle = fill;
    g.beginPath(); g.ellipse(0, 0, 30 * s, 5 * s, 0, 0, TAU); g.fill();
    g.beginPath(); g.moveTo(-4 * s, 0); g.lineTo(-14 * s, -26 * s); g.lineTo(-6 * s, -26 * s); g.lineTo(10 * s, 0); g.lineTo(-6 * s, 26 * s); g.lineTo(-14 * s, 26 * s); g.closePath(); g.fill();
    g.beginPath(); g.moveTo(-22 * s, 0); g.lineTo(-30 * s, -10 * s); g.lineTo(-26 * s, -10 * s); g.lineTo(-18 * s, 0); g.lineTo(-26 * s, 10 * s); g.lineTo(-30 * s, 10 * s); g.closePath(); g.fill();
  };
  ctx.save(); ctx.translate(sx + alt * 0.25, sy); ctx.rotate(ang); ctx.scale(1, 0.55); shape(ctx, 'rgba(20,40,30,.2)'); ctx.restore();
  ctx.save(); ctx.translate(sx, sy - alt); ctx.rotate(ang); ctx.scale(1, 0.62);
  shape(ctx, p.mine ? '#2b2d3a' : '#f7f4ee');
  ctx.fillStyle = p.mine ? '#d9a21c' : '#d64b3c'; ctx.fillRect(-30 * s, -1.2 * s, 46 * s, 2.4 * s);
  ctx.fillStyle = '#6fb3d6'; ctx.beginPath(); ctx.ellipse(24 * s, 0, 4 * s, 2.6 * s, 0, 0, TAU); ctx.fill();
  ctx.restore();
  if (p.mine) { ctx.font = '800 11px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = '#fff3b0'; ctx.strokeStyle = 'rgba(60,30,10,.8)'; ctx.lineWidth = 3; ctx.strokeText('Your jet', sx, sy - alt - 22); ctx.fillText('Your jet', sx, sy - alt - 22); }
}
function drawBalloon(ctx, b, z) {
  const [sx, sy] = worldToScreen(b.x, b.y);
  const alt = 160 * z, s = clamp(z, 0.5, 1.3);
  ctx.fillStyle = 'rgba(20,40,30,.15)'; ctx.beginPath(); ctx.ellipse(sx + 30 * s, sy, 14 * s, 6 * s, 0, 0, TAU); ctx.fill();
  const y = sy - alt;
  const cols = ['#e86a8a', '#ffd34d', '#3d78c2', '#3e9b6a'];
  for (let i = 0; i < 4; i++) { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.ellipse(sx, y, (16 - i * 4) * s, 20 * s, 0, 0, TAU); ctx.fill(); }
  ctx.strokeStyle = '#6a4a32'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(sx - 6 * s, y + 17 * s); ctx.lineTo(sx - 4 * s, y + 28 * s); ctx.moveTo(sx + 6 * s, y + 17 * s); ctx.lineTo(sx + 4 * s, y + 28 * s); ctx.stroke();
  ctx.fillStyle = '#8a5a34'; ctx.fillRect(sx - 5 * s, y + 27 * s, 10 * s, 6 * s);
}
function drawCloud(ctx, c, z, alpha) {
  const [sx, sy] = worldToScreen(c.x, c.y);
  const s = c.s * z * 1.4;
  if (sx < -300 || sx > View.W + 300 || sy < -300 || sy > View.H + 400) return;
  ctx.fillStyle = `rgba(20,40,30,${0.08 * alpha})`;
  ctx.beginPath(); ctx.ellipse(sx + 60 * s, sy + 120 * s, 70 * s, 26 * s, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = `rgba(255,255,255,${0.75 * alpha})`;
  for (const [ox, oy, r] of [[-40, 0, 30], [0, -14, 40], [40, -4, 32], [12, 8, 34], [-18, 10, 26]]) { ctx.beginPath(); ctx.arc(sx + ox * s, sy + oy * s, r * s, 0, TAU); ctx.fill(); }
}
function drawBoat(ctx, b, mine) {
  const x = wx(b.x, b.y), y = wy(b.x, b.y);
  const dx = Math.cos(b.a), dy = Math.sin(b.a);
  const ang = Math.atan2((dx + dy) * HH, (dx - dy) * HW);
  const s = b.kind === 'yacht' ? 2.3 : 1;
  ctx.save(); ctx.translate(x, y); ctx.rotate(ang); ctx.scale(s, s);
  ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.5 / s;
  ctx.beginPath(); ctx.moveTo(-8, -2); ctx.lineTo(-26, -6); ctx.moveTo(-8, 2); ctx.lineTo(-26, 6); ctx.stroke();
  ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.moveTo(10, 0); ctx.quadraticCurveTo(4, -5, -8, -4); ctx.lineTo(-8, 4); ctx.quadraticCurveTo(4, 5, 10, 0); ctx.fill();
  ctx.fillStyle = b.kind === 'yacht' ? '#2b2d3a' : b.sail ? '#3d78c2' : '#d64b3c'; ctx.fillRect(-4, -2, 6, 4);
  if (b.kind === 'yacht') { ctx.fillStyle = '#d9a21c'; ctx.fillRect(-6, -0.4, 14, 0.8); }
  ctx.restore();
  if (b.sail || b.kind === 'sail') {
    ctx.fillStyle = '#fffdf5'; ctx.beginPath(); ctx.moveTo(x, y - 2); ctx.lineTo(x, y - 20); ctx.lineTo(x + 9, y - 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,.2)'; ctx.lineWidth = 0.6; ctx.stroke();
  }
  if (mine) {
    ctx.font = '800 10px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'center';
    ctx.fillStyle = '#fff3b0'; ctx.strokeStyle = 'rgba(60,30,10,.8)'; ctx.lineWidth = 3;
    const label = b.kind === 'yacht' ? 'Moneta' : 'Yours';
    ctx.strokeText(label, x, y - 24 * (b.kind === 'yacht' ? 1.4 : 1)); ctx.fillText(label, x, y - 24 * (b.kind === 'yacht' ? 1.4 : 1));
  }
}

// ── pins ──
const _pinCache = new Map();
function pinSprite(type, dpr) {
  const k = type + dpr;
  let s = _pinCache.get(k);
  if (s) return s;
  const R = 13, W = 34, H = 46;
  const c = document.createElement('canvas');
  c.width = W * dpr; c.height = H * dpr;
  const g = c.getContext('2d');
  g.scale(dpr, dpr);
  const cx = W / 2, cy = 16;
  const ring = type === 'sale' ? ['#fff3b8', '#e7a721', '#a8640e'] : type === 'offer' || type === 'build' ? ['#d9f2ff', '#3d8fc2', '#215a82'] : type === 'home' ? ['#ffe0ea', '#e86a8a', '#a83a5a'] : type === 'stay' ? ['#f1e2ff', '#a35fd6', '#6b3f8f'] : type === 'watch' ? ['#d8fff4', '#2bb39a', '#17695a'] : ['#ffe2c2', '#f08a24', '#a8500e'];
  g.fillStyle = 'rgba(0,0,0,.22)'; g.beginPath(); g.ellipse(cx, H - 3, 6, 2.4, 0, 0, TAU); g.fill();
  g.fillStyle = ring[2]; g.beginPath(); g.moveTo(cx - 6, cy + 9); g.lineTo(cx, H - 6); g.lineTo(cx + 6, cy + 9); g.fill();
  const grd = g.createRadialGradient(cx - 4, cy - 5, 2, cx, cy, R + 2);
  grd.addColorStop(0, ring[0]); grd.addColorStop(0.55, ring[1]); grd.addColorStop(1, ring[2]);
  g.fillStyle = grd; g.beginPath(); g.arc(cx, cy, R + 2, 0, TAU); g.fill();
  g.fillStyle = '#fffdf5'; g.beginPath(); g.arc(cx, cy, R - 3, 0, TAU); g.fill();
  g.fillStyle = ring[2];
  if (type === 'sale') {
    g.beginPath();
    for (let i = 0; i < 10; i++) { const a = -Math.PI / 2 + i * Math.PI / 5, rr = i % 2 ? 3.4 : 7.5; g.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); }
    g.closePath(); g.fillStyle = '#e7a721'; g.fill(); g.strokeStyle = '#a8640e'; g.lineWidth = 1; g.stroke();
  } else if (type === 'build') {
    g.fillRect(cx - 1, cy - 7, 2, 13); g.fillRect(cx - 7, cy - 7, 13, 2); g.fillRect(cx + 4, cy - 5, 1.2, 6); g.fillRect(cx - 4, cy + 4, 8, 2);
  } else if (type === 'stay') {
    g.fillRect(cx - 6, cy - 3, 12, 9); g.fillStyle = '#fffdf5'; g.fillRect(cx - 4.5, cy - 1.5, 9, 6); g.fillStyle = ring[2]; g.fillRect(cx - 3, cy - 6, 6, 3); g.fillStyle = '#fffdf5'; g.fillRect(cx - 1.6, cy - 4.8, 3.2, 1.8);
  } else if (type === 'watch') {
    g.beginPath(); g.moveTo(cx - 8, cy); g.quadraticCurveTo(cx, cy - 8, cx + 8, cy); g.quadraticCurveTo(cx, cy + 8, cx - 8, cy); g.fill();
    g.fillStyle = '#fffdf5'; g.beginPath(); g.arc(cx, cy, 3, 0, TAU); g.fill(); g.fillStyle = ring[2]; g.beginPath(); g.arc(cx, cy, 1.6, 0, TAU); g.fill();
  } else if (type === 'home') {
    g.beginPath(); g.moveTo(cx, cy + 6); g.bezierCurveTo(cx - 9, cy - 1, cx - 5, cy - 8, cx, cy - 3); g.bezierCurveTo(cx + 5, cy - 8, cx + 9, cy - 1, cx, cy + 6); g.fill();
  } else {
    g.beginPath(); g.moveTo(cx - 6.5, cy); g.lineTo(cx, cy - 6.5); g.lineTo(cx + 6.5, cy); g.lineTo(cx + 4.5, cy); g.lineTo(cx + 4.5, cy + 5.5); g.lineTo(cx - 4.5, cy + 5.5); g.lineTo(cx - 4.5, cy); g.closePath(); g.fill();
    if (type === 'vacant' || type === 'offer') { g.fillStyle = type === 'offer' ? '#3e9b4f' : '#e0392b'; g.beginPath(); g.arc(cx + 10, cy - 10, 4.5, 0, TAU); g.fill(); g.strokeStyle = '#fff'; g.lineWidth = 1.4; g.stroke(); }
  }
  s = { c, W, H, ay: H - 3 };
  _pinCache.set(k, s);
  return s;
}
function pinType(L, st) {
  if (st && st.s) return 'sale';
  if (!st || !st.o) return typeof Net !== 'undefined' && Net.on && (Net.watching(L.id) || Net.friendsWatch.has(L.id)) ? 'watch' : null;
  if (G.home === L.id) return 'home';
  if (st.build) return 'build';
  if (st.mode === 'stay') return 'stay';
  if (st.offers && st.offers.length && !st.auto) return 'offer';
  if (st.units && st.units.some((u) => u && !u.r && !u.home)) return 'vacant';
  return 'own';
}

// ── frame ──
function drawFrame(dt) {
  const ctx = View.ctx, c = View.cam, dpr = View.dpr, W = View.W, H = View.H;
  View.t += dt;
  if (View.fly) {
    const f = View.fly; f.t += dt;
    const k = 1 - Math.pow(0.0025, dt);
    c.x += (f.x - c.x) * k; c.y += (f.y - c.y) * k; c.z += (f.z - c.z) * k;
    if ((Math.abs(f.x - c.x) < 0.5 && Math.abs(f.y - c.y) < 0.5 && Math.abs(f.z - c.z) < 0.002) || f.t > 3) View.fly = null;
    clampCam();
  } else if (Math.abs(View.vel.x) + Math.abs(View.vel.y) > 1 && !Input.down) {
    c.x -= View.vel.x * dt / c.z; c.y -= View.vel.y * dt / c.z;
    const k = Math.pow(0.04, dt); View.vel.x *= k; View.vel.y *= k;
    clampCam();
  }
  updateTraffic(dt);
  updateSky(dt);

  const want = bucket(c.z * dpr);
  View.zoomStill += dt;
  const ratio = c.z * dpr / View.sprB;
  if (want !== View.sprB && (View.zoomStill > 0.18 || ratio > 1.9 || ratio < 0.5)) {
    View.sprPrev = View.spr; View.spr = new Map(); View.sprB = want;
  }
  const B = View.sprB;
  const pageB = Math.min(B, 1.5);

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const tx = Math.round(dpr * (W / 2 - c.x * c.z)), ty = Math.round(dpr * (H / 2 - c.y * c.z));
  if (View.waterPat && View.waterPat.setTransform) {
    const ws = c.z * dpr * 1.5;
    View.waterPat.setTransform(new DOMMatrix([ws, 0, 0, ws, tx + View.t * 6 * dpr * c.z, ty]));
  }
  ctx.fillStyle = View.waterPat || '#4c9fc8';
  ctx.fillRect(0, 0, View.canvas.width, View.canvas.height);

  const S = dpr * c.z;
  ctx.setTransform(S, 0, 0, S, tx, ty);
  const [vx0, vy0] = screenToWorld(0, 0), [vx1, vy1] = screenToWorld(W, H);
  const N = MAP_N, iMin = Math.floor(-N * HW / PAGE) - 1, iMax = Math.ceil(N * HW / PAGE), jMax = Math.ceil(N * 2 * HH / PAGE);

  const i0 = Math.floor(vx0 / PAGE), i1 = Math.floor(vx1 / PAGE), j0 = Math.floor((vy0 - 20) / PAGE), j1 = Math.floor((vy1 + 20) / PAGE);
  let built = 0;
  const ov = 1 / S;
  for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
    if (j < -1 || j > jMax || i < iMin || i > iMax) continue;
    let p = getPage(i, j, pageB, false);
    if (!p && built < 3) { p = getPage(i, j, pageB, true); built++; }
    if (!p) for (const b of [1, 0.71, 1.41, 1.5, 0.5, 0.35]) { p = View.pages.get(b + '|' + i + '|' + j); if (p) break; }
    if (!p) { p = getPage(i, j, pageB, true); built++; }
    ctx.drawImage(p, i * PAGE, j * PAGE, PAGE + ov, PAGE + ov);
  }

  for (const b of View.boats) {
    const x = wx(b.x, b.y), y = wy(b.x, b.y);
    if (x < vx0 - 40 || x > vx1 + 40 || y < vy0 - 40 || y > vy1 + 40) continue;
    drawBoat(ctx, b, false);
  }
  for (const b of View.myBoats) drawBoat(ctx, b, true);

  // objects: lots (pre-sorted) merged with cars & people (sorted per frame)
  const budget = { left: 9, missed: false };
  const movers = [];
  for (const cr of View.cars) {
    const [gx, gy] = carPos(cr);
    const x = wx(gx, gy), y = wy(gx, gy);
    if (x < vx0 - 30 || x > vx1 + 30 || y < vy0 - 30 || y > vy1 + 30) continue;
    movers.push({ d: gx + gy, x, y, cr });
  }
  if (c.z > 0.55) for (const p of View.peds) {
    const [gx, gy] = pedPos(p);
    const x = wx(gx, gy), y = wy(gx, gy);
    if (x < vx0 - 10 || x > vx1 + 10 || y < vy0 - 20 || y > vy1 + 10) continue;
    movers.push({ d: gx + gy, x, y, pd: p });
  }
  movers.sort((a, b) => a.d - b.d);
  const order = CITY.order, lots = CITY.lots;
  let ci = 0;
  View.pins.length = 0;
  const drawMover = (o) => {
    if (o.cr) { const s = carSprite(o.cr.color, o.cr.dir % 2 === 0, o.cr.bus, B); ctx.drawImage(s.c, o.x - s.ax, o.y - s.ay, s.w, s.h); return; }
    const p = o.pd, bob = Math.abs(Math.sin(View.t * 8 + p.ph)) * 0.8;
    ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(o.x, o.y, 2, 0.9, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#3b3b44'; ctx.fillRect(o.x - 1, o.y - 3.5, 0.9, 3.5); ctx.fillRect(o.x + 0.2, o.y - 3.5, 0.9, 3.5);
    ctx.fillStyle = p.color; ctx.beginPath(); ctx.ellipse(o.x, o.y - 5.5 - bob, 1.8, 2.4, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = p.skin; ctx.beginPath(); ctx.arc(o.x, o.y - 9.2 - bob, 1.8, 0, TAU); ctx.fill();
  };
  const smokers = [];
  for (let n = 0; n < order.length; n++) {
    const L = lots[order[n]];
    const depth = L.x + L.w / 2 + L.y + L.d / 2;
    while (ci < movers.length && movers[ci].d < depth) drawMover(movers[ci++]);
    const E = visualLot(L);
    const ox = wx(L.x, L.y), oy = wy(L.x, L.y);
    const bx = spriteBox(E);
    if (ox - bx.ax > vx1 || ox - bx.ax + bx.w < vx0 || oy - bx.ay > vy1 || oy - bx.ay + bx.h < vy0) continue;
    const s = getSprite(E, B, budget);
    ctx.drawImage(s.c, ox - s.ax, oy - s.ay, s.w, s.h);
    if (View.venues && G) for (const club in View.venues) if (View.venues[club] === L) drawVenue(ctx, L, club, B, c.z);
    if (s.smoke && s.smoke.length) smokers.push([L, s.smoke]);
    if (isProperty(L.kind) && G && (View.showPins || L.id === View.sel)) {
      const st = G.lots[L.id];
      const type = pinType(L, st);
      if (type) View.pins.push({ L, type, top: s.topZ });
    }
  }
  while (ci < movers.length) drawMover(movers[ci++]);
  if (!budget.missed && View.sprPrev) View.sprPrev = null;

  // chimney & factory smoke
  if (View.quality !== 'low') for (const [L, pts] of smokers) {
    for (let k = 0; k < pts.length; k++) {
      if (rnd() > dt * 0.9 || View.puffs.length > 160) continue;
      const [px, py, pz] = pts[k];
      const [sx, sy] = P(L.x + px, L.y + py, pz);
      View.puffs.push({ x: sx, y: sy, t: 0 });
    }
  }
  for (const p of View.puffs) {
    const a = 0.45 * (1 - p.t / 3.5);
    ctx.fillStyle = `rgba(235,235,240,${a})`;
    ctx.beginPath(); ctx.arc(p.x, p.y, 3 + p.t * 3, 0, TAU); ctx.fill();
  }

  const outline = (id, col, w) => {
    const L = lots[id];
    if (!L) return;
    ctx.strokeStyle = col; ctx.lineWidth = w / S;
    path(ctx, [[L.x, L.y, 0], [L.x + L.w, L.y, 0], [L.x + L.w, L.y + L.d, 0], [L.x, L.y + L.d, 0]]);
    ctx.stroke();
  };
  if (View.hover >= 0 && View.hover !== View.sel) outline(View.hover, 'rgba(255,255,255,.85)', 2);
  if (View.sel >= 0) outline(View.sel, `rgba(255,${190 + Math.sin(View.t * 5) * 40 | 0},60,.95)`, 3.2);

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const ps = clamp(0.55 + c.z * 0.4, 0.62, 1.05);
  View.pins.sort((a, b) => (a.L.x + a.L.y) - (b.L.x + b.L.y));
  const fewPins = c.z < 0.42;
  for (const p of View.pins) {
    if (fewPins && p.type === 'sale' && p.L.id !== View.sel) continue;
    const [x, y] = lotCenterWorld(p.L);
    const bob = Math.sin(View.t * 2.4 + p.L.id) * 3;
    const [sx, sy] = worldToScreen(x, y - p.top * 0.92);
    const sp = pinSprite(p.type, dpr);
    const w = sp.W * ps, h = sp.H * ps;
    p.sx = sx; p.sy = sy - h * 0.62 + bob; p.r = 15 * ps;
    ctx.drawImage(sp.c, sx - w / 2, sy - sp.ay * ps + bob, w, h);
  }
  ctx.textAlign = 'center';
  for (let i = View.parts.length - 1; i >= 0; i--) {
    const p = View.parts[i];
    p.t += dt;
    if (p.t > 1.8) { View.parts.splice(i, 1); continue; }
    const [sx, sy] = worldToScreen(p.x, p.y);
    const a = p.t < 1.2 ? 1 : 1 - (p.t - 1.2) / 0.6;
    ctx.globalAlpha = a;
    ctx.font = '800 15px "Baloo 2", system-ui, sans-serif';
    ctx.lineWidth = 4; ctx.strokeStyle = 'rgba(70,40,10,.85)';
    ctx.strokeText(p.text, sx, sy - 30 - p.t * 34);
    ctx.fillStyle = p.color; ctx.fillText(p.text, sx, sy - 30 - p.t * 34);
    ctx.globalAlpha = 1;
  }
  if (View.balloon) drawBalloon(ctx, View.balloon, c.z);
  if (View.plane) drawPlane(ctx, View.plane, c.z);
  const ca = clamp((0.95 - c.z) * 1.4, 0, 0.55);
  if (ca > 0.02) for (const cl of View.clouds) drawCloud(ctx, cl, c.z, ca);
}

// ── club venues: your vehicles (and your friends') hang out here ──
function venueCrowd(club) {
  const list = [];
  const mine = G && G.clubs && G.clubs[club];
  if (mine) {
    for (const uid of mine.placed) { const a = G.assets.find((x) => x.uid === uid); if (a) list.push({ id: a.id, color: ASSET_BY_ID[a.id].color, label: G.fam ? famHead().first : 'You', mine: true }); }
    if (!list.length) list.push({ id: 'person', color: CLUB_BY_ID[club].color, label: G.fam ? famHead().first : 'You', mine: true });
  }
  if (typeof Net !== 'undefined' && Net.venue && Net.venue[club]) for (const v of Net.venue[club]) list.push(v);
  return list.slice(0, 8);
}
function venueLabel(ctx, x, y, text, mine, z) {
  if (z < 0.5) return;
  ctx.font = '800 9px "Baloo 2", system-ui, sans-serif'; ctx.textAlign = 'center';
  ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(40,24,10,.85)'; ctx.strokeText(text, x, y);
  ctx.fillStyle = mine ? '#fff3b0' : '#bfe6ff'; ctx.fillText(text, x, y);
}
function drawVenue(ctx, L, club, B, z) {
  const crowd = venueCrowd(club);
  if (!crowd.length) return;
  const n = crowd.length, t = View.t;
  crowd.forEach((v, i) => {
    if (club === 'car') {
      const a = t * (0.45 + i * 0.05) + i * TAU / n;
      const gx = L.x + 2 + Math.cos(a) * 1.42, gy = L.y + 2.15 + Math.sin(a) * 1.04;
      const x = wx(gx, gy), y = wy(gx, gy);
      if (v.id === 'person') { venueLabel(ctx, x, y - 6, v.label, v.mine, z); return; }
      const dx = -Math.sin(a) * 1.42, dy = Math.cos(a) * 1.04;
      const sp = carSprite(v.color || '#d64b3c', Math.abs(dx) > Math.abs(dy), false, B);
      ctx.drawImage(sp.c, x - sp.ax, y - sp.ay, sp.w, sp.h);
      venueLabel(ctx, x, y - 16, v.label, v.mine, z);
    } else if (club === 'yacht') {
      const gx = L.x + 0.97 + (i % 4) * 0.85, gy = L.y + 2.9 + Math.floor(i / 4) * 0.6 + Math.sin(t * 1.5 + i) * 0.03;
      const kind = v.id === 'yacht' ? 'yacht' : v.id === 'sail' ? 'sail' : 'runabout';
      if (v.id !== 'person') drawBoat(ctx, { x: gx, y: gy, a: Math.PI / 2, kind, sail: kind === 'sail' }, false);
      venueLabel(ctx, wx(gx, gy), wy(gx, gy) - (kind === 'yacht' ? 30 : 22), v.label, v.mine, z);
    } else if (club === 'ski') {
      const k = (t * 0.12 + i / n) % 1;
      const gx = L.x + lerp(1.55, 0.95, k), gy = L.y + lerp(1.55, 3.5, k), zz = lerp(82, 0, k);
      const x = wx(gx, gy), y = wy(gx, gy) - zz;
      ctx.fillStyle = v.color || '#d64b3c'; ctx.beginPath(); ctx.ellipse(x, y - 4, 2, 3, 0.4, 0, TAU); ctx.fill();
      circle(ctx, x + 0.5, y - 8, 1.8, '#f0c9a4');
      ctx.strokeStyle = '#2b2d3a'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(x - 4, y + 1); ctx.lineTo(x + 4, y - 1); ctx.stroke();
      venueLabel(ctx, x, y - 13, v.label, v.mine, z);
    } else {
      const gx = L.x + 1.1 + (i % 3) * 0.5, gy = L.y + 1.4 + Math.floor(i / 3) * 0.4 + Math.sin(t * 0.6 + i) * 0.08;
      const x = wx(gx, gy), y = wy(gx, gy);
      ctx.fillStyle = v.color || '#3e9b4f'; ctx.beginPath(); ctx.ellipse(x, y - 5, 2, 2.8, 0, 0, TAU); ctx.fill();
      circle(ctx, x, y - 9.5, 1.9, '#f0c9a4');
      venueLabel(ctx, x, y - 14, v.label, v.mine, z);
    }
  });
}

// ── picking ──
function pointInPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
function pickAt(sx, sy) {
  for (let i = View.pins.length - 1; i >= 0; i--) {
    const p = View.pins[i];
    if (p.sx != null && Math.hypot(sx - p.sx, sy - p.sy) < p.r + 6) return p.L.id;
  }
  const [x, y] = screenToWorld(sx, sy);
  const order = CITY.order, lots = CITY.lots;
  for (let n = order.length - 1; n >= 0; n--) {
    const L = lots[order[n]];
    const foot = [P(L.x, L.y, 0), P(L.x + L.w, L.y, 0), P(L.x + L.w, L.y + L.d, 0), P(L.x, L.y + L.d, 0)];
    if (pointInPoly(x, y, foot)) return L.id;
    const top = lotTop(L), m = Math.min(L.w, L.d) * 0.18;
    if (top > 20) {
      const a = L.x + m, b = L.y + m, c2 = L.x + L.w - m, d = L.y + L.d - m;
      const hex = [P(a, b, top), P(c2, b, top), P(c2, b, 0), P(c2, d, 0), P(a, d, 0), P(a, d, top)];
      if (pointInPoly(x, y, hex)) return L.id;
    }
  }
  return -1;
}

// ── input ──
const Input = { ptrs: new Map(), down: false, drag: false, start: null, pinch: null, lastMove: 0, hoverQueued: false, hx: 0, hy: 0 };
function bindInput(cv) {
  const pos = (e) => { const r = cv.getBoundingClientRect(); return [e.clientX - r.left, e.clientY - r.top]; };
  cv.addEventListener('pointerdown', (e) => {
    cv.setPointerCapture?.(e.pointerId);
    const [x, y] = pos(e);
    Input.ptrs.set(e.pointerId, { x, y });
    Input.down = true; View.fly = null; View.vel.x = View.vel.y = 0;
    if (Input.ptrs.size === 1) {
      Input.drag = false;
      Input.start = { x, y, cx: View.cam.x, cy: View.cam.y };
      Input.lastMove = performance.now();
    } else if (Input.ptrs.size === 2) {
      const [a, b] = [...Input.ptrs.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      Input.pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: View.cam.z, w: screenToWorld(mx, my) };
      Input.drag = true;
    }
  });
  cv.addEventListener('pointermove', (e) => {
    const [x, y] = pos(e);
    if (!Input.ptrs.has(e.pointerId)) {
      if (e.pointerType === 'mouse') { Input.hx = x; Input.hy = y; queueHover(); }
      return;
    }
    const prev = Input.ptrs.get(e.pointerId);
    Input.ptrs.set(e.pointerId, { x, y });
    if (Input.ptrs.size === 2 && Input.pinch) {
      const [a, b] = [...Input.ptrs.values()];
      const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      const d = Math.hypot(a.x - b.x, a.y - b.y);
      View.cam.z = clamp(Input.pinch.z * d / Math.max(10, Input.pinch.d), ZMIN, ZMAX);
      View.cam.x = Input.pinch.w[0] - (mx - View.W / 2) / View.cam.z;
      View.cam.y = Input.pinch.w[1] - (my - View.H / 2) / View.cam.z;
      View.zoomStill = 0;
      clampCam();
      return;
    }
    const s = Input.start;
    if (!s) return;
    if (!Input.drag && Math.hypot(x - s.x, y - s.y) > 7) Input.drag = true;
    if (Input.drag) {
      View.cam.x = s.cx - (x - s.x) / View.cam.z;
      View.cam.y = s.cy - (y - s.y) / View.cam.z;
      clampCam();
      const now = performance.now(), dtm = Math.max(1, now - Input.lastMove) / 1000;
      View.vel.x = lerp(View.vel.x, (x - prev.x) / dtm, 0.35);
      View.vel.y = lerp(View.vel.y, (y - prev.y) / dtm, 0.35);
      Input.lastMove = now;
      View.hover = -1;
    }
  });
  const end = (e) => {
    const had = Input.ptrs.has(e.pointerId);
    Input.ptrs.delete(e.pointerId);
    if (Input.ptrs.size === 1) {
      const [p] = [...Input.ptrs.values()];
      Input.start = { x: p.x, y: p.y, cx: View.cam.x, cy: View.cam.y };
      Input.pinch = null;
      View.vel.x = View.vel.y = 0;
      return;
    }
    if (Input.ptrs.size > 0) return;
    Input.down = false;
    Input.pinch = null;
    if (had && !Input.drag && e.type === 'pointerup') {
      const [x, y] = pos(e);
      const id = pickAt(x, y);
      View.vel.x = View.vel.y = 0;
      if (View.onTap) View.onTap(id);
    } else if (performance.now() - Input.lastMove > 80) { View.vel.x = View.vel.y = 0; }
    Input.start = null;
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', (e) => { if (e.pointerType === 'mouse') { View.hover = -1; View.onHover?.(-1); } });
  cv.addEventListener('wheel', (e) => {
    e.preventDefault();
    const [x, y] = pos(e);
    const k = e.ctrlKey ? 0.012 : 0.0018;
    const dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
    zoomAt(x, y, Math.exp(-dy * k));
  }, { passive: false });
}
function queueHover() {
  if (Input.hoverQueued) return;
  Input.hoverQueued = true;
  requestAnimationFrame(() => {
    Input.hoverQueued = false;
    if (Input.down) return;
    const id = pickAt(Input.hx, Input.hy);
    if (id !== View.hover) { View.hover = id; View.onHover?.(id, Input.hx, Input.hy); }
    else if (id >= 0) View.onHover?.(id, Input.hx, Input.hy, true);
    View.canvas.style.cursor = id >= 0 ? 'pointer' : 'grab';
  });
}
