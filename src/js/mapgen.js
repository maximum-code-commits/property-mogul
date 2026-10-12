'use strict';
// ───────────────────────── world generator ─────────────────────────
// Centropolis sits in the middle of the island. Alpine Ridge (north), Lake Serene (east),
// Haybrook (west) and Portside hang off it by land; Coral Key is its own island to the south.
// A river runs from the mountains through the city into the harbour bay.
const MAP_N = 100;
const T_WATER = 0, T_GRASS = 1, T_ROAD = 2, T_SAND = 3, T_BRIDGE = 4, T_TRACK = 5;
const BLOCK = 5;

function segDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const t = clamp(((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy), 0, 1);
  return Math.hypot(px - ax - dx * t, py - ay - dy * t);
}

const BLOBS = [
  { x: 50, y: 52, r: 27.5 },  // Centropolis
  { x: 17, y: 17, r: 16 },    // Alpine Ridge
  { x: 82, y: 18, r: 15.5 },  // Lake Serene
  { x: 17, y: 82, r: 16.5 },  // Haybrook
  { x: 85, y: 55, r: 10.5 },  // Portside
  { x: 85, y: 86, r: 10 },    // Coral Key
];
const NECKS = [[24, 24, 37, 35, 6.5], [75, 25, 64, 35, 6.5], [24, 76, 35, 66, 6.5], [76, 54, 84, 55, 6]];

function generateCity(seed) {
  const N = MAP_N;
  const rng = mulberry32(seed);
  const idx = (x, y) => y * N + x;
  const inb = (x, y) => x >= 0 && y >= 0 && x < N && y < N;
  const water = new Uint8Array(N * N);
  const river = new Uint8Array(N * N);
  const tiles = new Uint8Array(N * N);

  const rp = [];
  const riverPts = [[21, 6], [27, 18], [36, 30], [43, 41], [46, 53], [51, 64], [54, 74], [55, 80]];
  for (let i = 0; i < riverPts.length - 1; i++) {
    for (let k = 0; k < 8; k++) {
      const t = k / 8, a = riverPts[i], b = riverPts[i + 1];
      const wob = Math.sin((i * 8 + k) * 0.55) * 1.6;
      rp.push([lerp(a[0], b[0], t) + wob, lerp(a[1], b[1], t) - wob * 0.4]);
    }
  }
  rp.push(riverPts[riverPts.length - 1]);

  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const px = x + 0.5, py = y + 0.5;
      let land = false;
      for (let b = 0; b < BLOBS.length; b++) {
        const B = BLOBS[b];
        const ang = Math.atan2(py - B.y, px - B.x);
        const R = B.r + (fbm(Math.cos(ang) * 1.7 + b * 11, Math.sin(ang) * 1.7 + b * 7, seed) - 0.5) * 6.5;
        if (Math.hypot(px - B.x, py - B.y) < R) { land = true; break; }
      }
      if (!land) for (const n of NECKS) if (segDist(px, py, n[0], n[1], n[2], n[3]) < n[4] + (fbm(px * 0.3, py * 0.3, seed + 5) - 0.5) * 2) { land = true; break; }
      let w = !land;
      // harbour bay and the lake
      if (Math.hypot(px - 55, py - 80) < 6.8 + (fbm(px * 0.35, py * 0.35, seed + 3) - 0.5) * 3) w = true;
      if (Math.hypot((px - 84) * 0.9, py - 14) < 6.2 + (fbm(px * 0.4, py * 0.4, seed + 9) - 0.5) * 2.5) w = true;
      if (!w) {
        let d = 99;
        for (let i = 0; i < rp.length - 1; i++) d = Math.min(d, segDist(px, py, rp[i][0], rp[i][1], rp[i + 1][0], rp[i + 1][1]));
        if (d < 1.25) { w = true; river[idx(x, y)] = 1; }
      }
      if (x < 1 || y < 1 || x > N - 2 || y > N - 2) w = true;
      water[idx(x, y)] = w ? 1 : 0;
    }
  }
  const isW = (x, y) => !inb(x, y) || water[idx(x, y)] === 1;

  // districts per tile (nearest seed with a little wobble)
  const distGrid = new Uint8Array(N * N);
  const distAt = (px, py) => {
    let best = 0, bd = 1e9;
    DISTRICTS.forEach((d, k) => {
      const dd = Math.hypot(px - d.seed[0], py - d.seed[1]) + (fbm(px * 0.15, py * 0.15, seed + k * 31) - 0.5) * 6;
      if (dd < bd) { bd = dd; best = k; }
    });
    return best;
  };
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) distGrid[idx(x, y)] = distAt(x + 0.5, y + 0.5);
  const styleAt = (x, y) => DISTRICTS[distGrid[idx(clamp(x, 0, N - 1), clamp(y, 0, N - 1))]].style;

  // roads: a 5-tile grid; farmland only keeps every other line (the rest become farm tracks)
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = idx(x, y);
    if (water[i]) { tiles[i] = T_WATER; continue; }
    const on5 = x % BLOCK === 0 || y % BLOCK === 0;
    if (!on5) { tiles[i] = T_GRASS; continue; }
    if (styleAt(x, y) === 'farm') tiles[i] = (x % 10 === 0 || y % 10 === 0) ? T_ROAD : T_TRACK;
    else tiles[i] = T_ROAD;
  }
  const isRoadT = (t) => t === T_ROAD || t === T_BRIDGE;
  // short river bridges on some lines
  const bridgeLine = (horizontal, line, maxLen, needRiver) => {
    let k = 0;
    while (k < N) {
      const x = horizontal ? k : line, y = horizontal ? line : k;
      if (water[idx(x, y)] && (!needRiver || river[idx(x, y)])) {
        let k2 = k;
        while (k2 < N && water[horizontal ? idx(k2, line) : idx(line, k2)]) k2++;
        const before = horizontal ? idx(k - 1, line) : idx(line, k - 1), after = horizontal ? idx(k2, line) : idx(line, k2);
        if (k > 0 && k2 < N && k2 - k <= maxLen && isRoadT(tiles[before]) && isRoadT(tiles[after])) {
          for (let j = k; j < k2; j++) tiles[horizontal ? idx(j, line) : idx(line, j)] = T_BRIDGE;
        }
        k = k2;
      } else k++;
    }
  };
  for (let l = 5; l < N; l += 5) {
    if (l % 10 === 0 || l === 25 || l === 45 || l === 65) bridgeLine(true, l, 5, true);
    if (l % 15 === 0) bridgeLine(false, l, 5, true);
  }
  // drop isolated road stubs
  for (let pass = 0; pass < 3; pass++) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const i = idx(x, y);
      if (tiles[i] !== T_ROAD) continue;
      let n = 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (inb(x + dx, y + dy) && isRoadT(tiles[idx(x + dx, y + dy)])) n++;
      if (n === 0) tiles[i] = T_GRASS;
    }
  }
  // connect every sizeable road network to the main one with a straight bridge or road
  const label = () => {
    const comp = new Int32Array(N * N).fill(-1);
    const sizes = [];
    for (let i = 0; i < N * N; i++) {
      if (comp[i] >= 0 || !isRoadT(tiles[i])) continue;
      const c = sizes.length; let size = 0;
      const st = [i]; comp[i] = c;
      while (st.length) {
        const j = st.pop(); size++;
        const x = j % N, y = (j / N) | 0;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!inb(nx, ny)) continue;
          const k = idx(nx, ny);
          if (comp[k] < 0 && isRoadT(tiles[k])) { comp[k] = c; st.push(k); }
        }
      }
      sizes.push(size);
    }
    return { comp, sizes };
  };
  for (let guard = 0; guard < 12; guard++) {
    const { comp, sizes } = label();
    if (sizes.length < 2) break;
    const main = sizes.indexOf(Math.max(...sizes));
    let best = null;
    for (let i = 0; i < N * N; i++) {
      const c = comp[i];
      if (c < 0 || c === main || sizes[c] < 10) continue;
      const x0 = i % N, y0 = (i / N) | 0;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        if ((dx !== 0 && y0 % BLOCK !== 0) || (dy !== 0 && x0 % BLOCK !== 0)) continue;
        let x = x0 + dx, y = y0 + dy, len = 0;
        while (inb(x, y) && len < 24) {
          const k = idx(x, y);
          if (comp[k] === main) { if (len > 0 && (!best || len < best.len)) best = { x0, y0, dx, dy, len }; break; }
          if (comp[k] >= 0) break;
          x += dx; y += dy; len++;
        }
      }
    }
    if (!best) break;
    for (let s = 1; s <= best.len; s++) {
      const k = idx(best.x0 + best.dx * s, best.y0 + best.dy * s);
      tiles[k] = water[k] ? T_BRIDGE : T_ROAD;
    }
  }

  // lots
  const lots = [];
  const lotAt = new Int16Array(N * N).fill(-1);
  const near = (x, y, r) => {
    for (let yy = y - r; yy <= y + r; yy++) for (let xx = x - r; xx <= x + r; xx++) if (isW(xx, yy)) return true;
    return false;
  };
  const addLot = (x, y, w, d, kind, distIdx) => {
    let wf = false;
    for (let yy = y; yy < y + d; yy++) for (let xx = x; xx < x + w; xx++) if (near(xx, yy, 2)) wf = true;
    const dist = DISTRICTS[distIdx];
    const bx = Math.floor(x / BLOCK), by = Math.floor(y / BLOCK);
    const onX = (x % BLOCK === 1) || rng() < 0.5;
    const street = onX ? STREETS_X[bx % STREETS_X.length] : STREETS_Y[by % STREETS_Y.length];
    const num = onX ? 1 + (y % 50) * 2 + (x % 2) : 1 + (x % 50) * 2 + (y % 2);
    const K = KINDS[kind];
    const lot = {
      id: lots.length, x, y, w, d, kind, variant: Math.floor(rng() * 6), dist: dist.id,
      factor: 0.86 + rng() * 0.28, water: wf, addr: num + ' ' + street,
      floors: K.fl ? K.fl[0] + Math.floor(rng() * (K.fl[1] - K.fl[0] + 1)) : 1,
    };
    // age and build quality come from the position, so they never disturb the city's other randomness
    const ERA = { city: [1965, 2024], suburb: [1885, 2022], snow: [1950, 2023], beach: [1960, 2024], farm: [1860, 2012], lake: [1905, 2023], industrial: [1910, 2018] }[dist.style] || [1900, 2020];
    const h1 = hash2(x * 7 + 1, y * 13 + 5, seed), h2 = hash2(x * 3 + 11, y * 5 + 17, seed + 1);
    const lo = K.fl && K.fl[0] >= 10 ? Math.max(ERA[0], 1978) : ERA[0];
    lot.built = Math.round(lerp(lo, ERA[1], Math.pow(h1, 0.75)));
    lot.q = Math.round(clamp(0.3 + (K.lux || 1) * 0.13 + h2 * 0.42, 0.2, 1) * 100) / 100;
    lots.push(lot);
    for (let yy = y; yy < y + d; yy++) for (let xx = x; xx < x + w; xx++) lotAt[idx(xx, yy)] = lot.id;
    return lot;
  };
  const sizeOk = (k, w, d) => KINDS[k].lots.some((s) => s[0] === w && s[1] === d);
  const pickKind = (dist, w, d) => {
    const ent = Object.entries(dist.w).filter(([k, wt]) => wt > 0 && sizeOk(k, w, d));
    return ent.length ? weighted(rng, ent) : (w === 4 && d === 4 ? 'park' : 'land');
  };

  const NB = Math.ceil(N / BLOCK);
  for (let by = 0; by < NB; by++) for (let bx = 0; bx < NB; bx++) {
    const x0 = bx * BLOCK + 1, y0 = by * BLOCK + 1;
    let clean = true;
    for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 4; x++) if (!inb(x, y) || water[idx(x, y)]) clean = false;
    const di = distAt(x0 + 2, y0 + 2);
    const dist = DISTRICTS[di];
    if (!clean) {
      for (let y = y0; y < y0 + 4; y++) for (let x = x0; x < x0 + 4; x++) {
        if (!inb(x, y) || water[idx(x, y)]) continue;
        let adj = false;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) if (isW(x + dx, y + dy)) adj = true;
        if (adj && dist.style !== 'snow') tiles[idx(x, y)] = T_SAND;
        else if (rng() < 0.45) addLot(x, y, 1, 1, 'trees', di);
      }
      continue;
    }
    const lead = weighted(rng, Object.entries(dist.w).filter((e) => e[1] > 0));
    const L = KINDS[lead].lots;
    const has44 = L.some((s) => s[0] === 4 && s[1] === 4);
    const has24 = L.some((s) => s[0] === 2 && s[1] === 4);
    const only44 = L.length === 1 && has44;
    if (only44 || (has44 && rng() < 0.4)) {
      addLot(x0, y0, 4, 4, lead, di);
    } else if (has24 && (['retail', 'warehouse', 'factory'].includes(lead) || rng() < 0.35)) {
      const alongX = rng() < 0.5;
      const w = alongX ? 4 : 2, d = alongX ? 2 : 4;
      addLot(x0, y0, w, d, lead, di);
      const ox = alongX ? x0 : x0 + 2, oy = alongX ? y0 + 2 : y0;
      if (rng() < 0.35) addLot(ox, oy, w, d, pickKind(dist, w, d), di);
      else {
        const a = alongX ? [[0, 0], [2, 0]] : [[0, 0], [0, 2]];
        for (const [ax, ay] of a) addLot(ox + ax, oy + ay, 2, 2, pickKind(dist, 2, 2), di);
      }
    } else {
      const k0 = sizeOk(lead, 2, 2) ? lead : pickKind(dist, 2, 2);
      addLot(x0, y0, 2, 2, k0, di);
      addLot(x0 + 2, y0, 2, 2, pickKind(dist, 2, 2), di);
      addLot(x0, y0 + 2, 2, 2, pickKind(dist, 2, 2), di);
      addLot(x0 + 2, y0 + 2, 2, 2, pickKind(dist, 2, 2), di);
    }
  }

  // club venues: a raceway in Ironvale, marinas on the harbour and the lake
  const convert = (distId, tx, ty, kind) => {
    let best = null, bd = 1e9;
    for (const l of lots) if (l.dist === distId && l.w === 4 && l.d === 4 && KINDS[l.kind].cat !== 'civic') { const dd = Math.hypot(l.x + 2 - tx, l.y + 2 - ty); if (dd < bd) { bd = dd; best = l; } }
    if (!best) for (const l of lots) if (l.dist === distId && l.w === 4 && l.d === 4 && !['mountain', 'racetrack', 'marina', 'golf'].includes(l.kind)) { const dd = Math.hypot(l.x + 2 - tx, l.y + 2 - ty); if (dd < bd) { bd = dd; best = l; } }
    if (best) best.kind = kind;
    return best;
  };
  if (!lots.some((l) => l.kind === 'golf')) convert('lake', 78, 24, 'golf');
  convert('iron', 70, 52, 'racetrack');
  convert('harbour', 55, 76, 'marina');
  convert('lake', 84, 18, 'marina');

  // a starter cottage in Lychee
  let start = null, bd = 1e9;
  const ly = DISTRICT_BY_ID.lychee;
  for (const l of lots) {
    if (l.dist !== 'lychee' || l.w !== 2 || l.d !== 2 || KINDS[l.kind].cat !== 'res') continue;
    const dd = Math.hypot(l.x - ly.seed[0], l.y - ly.seed[1]) + (l.kind === 'cottage' ? 0 : 6);
    if (dd < bd) { bd = dd; start = l; }
  }
  if (!start) start = lots.find((l) => isBuilding(l.kind) && l.w === 2 && l.d === 2);
  start.kind = 'cottage';

  const order = lots.map((l) => l.id).sort((a, b) => {
    const A = lots[a], B = lots[b];
    return (A.x + A.w / 2 + A.y + A.d / 2) - (B.x + B.w / 2 + B.y + B.d / 2);
  });
  const roadTiles = [];
  for (let i = 0; i < N * N; i++) if (isRoadT(tiles[i])) roadTiles.push(i);
  return { N, seed, tiles, water, river, distGrid, lots, lotAt, order, startLot: start.id, roadTiles, idx, inb };
}
