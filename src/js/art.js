'use strict';
// ───────────────────────── isometric art ─────────────────────────
// Local space: tile units on x/y, pixels on z. One tile = 64×32 screen px.
const HW = 32, HH = 16;
const OUTLINE = 'rgba(70,42,22,0.32)';
const LW = 0.75;
const R2 = Math.SQRT2;
let SNOW = false;        // alpine sprites get snowy roofs
let LAST_ROOF = null;    // the most recent visible roof plane (solar panels / rooftop gardens sit on it)
let SMOKE = null;        // chimney points recorded while drawing

function P(x, y, z) { return [(x - y) * HW, (x + y) * HH - (z || 0)]; }
function path(ctx, pts) {
  ctx.beginPath();
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const sx = (p[0] - p[1]) * HW, sy = (p[0] + p[1]) * HH - (p[2] || 0);
    if (i === 0) ctx.moveTo(sx, sy); else ctx.lineTo(sx, sy);
  }
  ctx.closePath();
}
function face(ctx, pts, fill, stroke = true) {
  path(ctx, pts);
  ctx.fillStyle = fill; ctx.fill();
  if (stroke) { ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW; ctx.stroke(); }
}
function flat(ctx, x0, y0, x1, y1, z, fill, stroke = false) {
  face(ctx, [[x0, y0, z], [x1, y0, z], [x1, y1, z], [x0, y1, z]], fill, stroke);
}
function box(ctx, x0, y0, x1, y1, z0, h, c, o = {}) {
  const z1 = z0 + h;
  face(ctx, [[x0, y1, z0], [x1, y1, z0], [x1, y1, z1], [x0, y1, z1]], o.left || c);
  face(ctx, [[x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [x1, y0, z1]], o.right || shade(c, -0.17));
  if (!o.noTop) face(ctx, [[x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]], o.top || (SNOW && o.snowTop !== false ? '#f4f8fb' : shade(c, 0.14)));
}
function faceL(ctx, x0, y, z0, fn) {
  const [ox, oy] = P(x0, y, z0);
  ctx.save(); ctx.transform(HW, HH, 0, -1, ox, oy); fn(); ctx.restore();
}
function faceR(ctx, x, y0, z0, fn) {
  const [ox, oy] = P(x, y0, z0);
  ctx.save(); ctx.transform(-HW, HH, 0, -1, ox, oy); fn(); ctx.restore();
}
function textL(ctx, x0, y, z, txt, size, color, len) {
  const [ox, oy] = P(x0, y, z);
  ctx.save(); ctx.transform(1, 0.5, 0, 1, ox, oy);
  ctx.font = `800 ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  ctx.fillStyle = color; ctx.textBaseline = 'alphabetic'; ctx.textAlign = 'center';
  ctx.fillText(txt, (len * HW) / 2, 0, len * HW * 0.92);
  ctx.restore();
}
function ellipse(ctx, x, y, z, r, fill, stroke) {
  const [cx, cy] = P(x, y, z);
  ctx.beginPath(); ctx.ellipse(cx, cy, r * HW * R2, r * HH * R2, 0, 0, TAU);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = LW; ctx.stroke(); }
}
function circle(ctx, x, y, r, fill) { ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fillStyle = fill; ctx.fill(); }
function cyl(ctx, x, y, z, r, h, c, top) {
  const [cx, cy] = P(x, y, z);
  const rx = r * HW * R2, ry = r * HH * R2;
  const g = ctx.createLinearGradient(cx - rx, 0, cx + rx, 0);
  g.addColorStop(0, shade(c, 0.12)); g.addColorStop(0.55, c); g.addColorStop(1, shade(c, -0.25));
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI); ctx.lineTo(cx - rx, cy - h); ctx.ellipse(cx, cy - h, rx, ry, 0, Math.PI, 0, true); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW; ctx.stroke();
  ctx.beginPath(); ctx.ellipse(cx, cy - h, rx, ry, 0, 0, TAU); ctx.fillStyle = top || shade(c, 0.18); ctx.fill(); ctx.stroke();
}
function smokeAt(x, y, z) { if (SMOKE) SMOKE.push([x, y, z]); }

// ── palettes ──
const WALLS = ['#f4e7cc', '#efd3a8', '#f2c6a5', '#cfe0ea', '#d6e8c8', '#f6f1e7', '#e8d0e2', '#f1dc9a'];
const BRICKS = ['#c9735a', '#b8664f', '#d08a63', '#a95c48'];
const ROOFS = ['#cf4f3e', '#db7a3f', '#566275', '#3f8a8a', '#8a5a3c', '#3f527d', '#a64a5c', '#5f7f45'];
const GLASS = ['#7fb8d8', '#5f9fc7', '#6fb3b8', '#8aa6c9', '#76a9c2'];
const LEAVES = ['#4f9a3f', '#5aa846', '#3f8a3a', '#6bb04c', '#58a05a'];
const AUTUMN = ['#d98a2b', '#c9542f', '#e0b03a', '#b8462f', '#5aa846'];
const CARS = ['#d64b3c', '#3d78c2', '#f0c23a', '#f6f1e7', '#4a4f5a', '#3e9b6a', '#e07a3a', '#8d5fbf'];
const AWNINGS = [['#d64b3c', '#fff6e8'], ['#2f7d6d', '#fff6e8'], ['#3d78c2', '#ffffff'], ['#e0a43a', '#fff6e8'], ['#8d5fbf', '#f4ecff'], ['#e86a8a', '#fff1f4']];
const WOOD = ['#9a6a3e', '#8a5a34', '#a8784a', '#7a4f2c'];
const COASTAL = ['#9fdce0', '#f7c6b5', '#fff4d6', '#c9e8c0', '#f6f1e7', '#b9d4f2'];
// picks a colour; a chosen appearance ("look") overrides the random one but keeps the sequence stable
function lp(L, r, list, k = 0) { const v = pick(r, list); return L.look != null ? list[(L.look * 3 + k * 5) % list.length] : v; }
function lawnFor(L) {
  const d = DISTRICT_BY_ID[L.dist];
  if (!d) return '#8cc35a';
  if (d.style === 'snow') return '#eaf2f7';
  if (d.style === 'beach') return '#9ad26e';
  return shade(d.grass, 0.05);
}
const treeCols = (L) => (L.dist === 'maple' ? AUTUMN : LEAVES);
const treeKind = (L, r) => (DISTRICT_BY_ID[L.dist]?.style === 'snow' ? 'pine' : DISTRICT_BY_ID[L.dist]?.style === 'beach' ? 'palm' : r() < 0.2 ? 'pine' : 'round');

// ── props ──
function tree(ctx, x, y, s, col, kind) {
  const [cx, cy] = P(x, y, 0);
  ctx.fillStyle = 'rgba(28,48,18,0.2)';
  ctx.beginPath(); ctx.ellipse(cx + 3 * s, cy + 1.2 * s, 9 * s, 4.4 * s, 0, 0, TAU); ctx.fill();
  if (kind === 'pine') {
    ctx.fillStyle = '#6e4a2c'; ctx.fillRect(cx - 1.3 * s, cy - 6 * s, 2.6 * s, 6 * s);
    for (let i = 0; i < 3; i++) {
      const by = cy - 5 * s - i * 6.5 * s, hw = (8 - i * 2) * s;
      ctx.beginPath(); ctx.moveTo(cx - hw, by); ctx.lineTo(cx + hw, by); ctx.lineTo(cx, by - 10 * s); ctx.closePath();
      ctx.fillStyle = i % 2 ? shade('#3f7a4a', -0.1) : '#3f7a4a'; ctx.fill();
      if (SNOW) { ctx.beginPath(); ctx.moveTo(cx - hw * 0.45, by - 5.5 * s); ctx.lineTo(cx + hw * 0.45, by - 5.5 * s); ctx.lineTo(cx, by - 10 * s); ctx.closePath(); ctx.fillStyle = '#f7fbff'; ctx.fill(); }
    }
    return;
  }
  if (kind === 'palm') {
    ctx.strokeStyle = '#8a6a44'; ctx.lineWidth = 2.2 * s; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(cx, cy); ctx.quadraticCurveTo(cx + 5 * s, cy - 12 * s, cx + 2 * s, cy - 24 * s); ctx.stroke();
    const tx = cx + 2 * s, ty = cy - 24 * s;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + 0.3;
      ctx.save(); ctx.translate(tx, ty); ctx.rotate(a);
      ctx.fillStyle = i % 2 ? '#3f8a3a' : '#58a046';
      ctx.beginPath(); ctx.ellipse(7 * s, 0, 8 * s, 2.4 * s, 0.25, 0, TAU); ctx.fill();
      ctx.restore();
    }
    circle(ctx, tx - 1, ty + 1.5, 1.6 * s, '#7a5434'); circle(ctx, tx + 2, ty + 2, 1.6 * s, '#7a5434');
    return;
  }
  ctx.fillStyle = '#7a5434'; ctx.fillRect(cx - 1.4 * s, cy - 9 * s, 2.8 * s, 9 * s);
  const dk = shade(col, -0.2);
  circle(ctx, cx - 4.2 * s, cy - 12 * s, 6 * s, dk);
  circle(ctx, cx + 4.4 * s, cy - 12.5 * s, 6.3 * s, dk);
  circle(ctx, cx, cy - 16.5 * s, 7.6 * s, col);
  circle(ctx, cx + 3.5 * s, cy - 13 * s, 5 * s, col);
  circle(ctx, cx - 2.6 * s, cy - 19.5 * s, 3.2 * s, shade(col, 0.22));
  if (SNOW) { ctx.fillStyle = 'rgba(250,253,255,.9)'; ctx.beginPath(); ctx.ellipse(cx - 1 * s, cy - 21 * s, 5 * s, 2.4 * s, 0, 0, TAU); ctx.fill(); }
}
function bush(ctx, x, y, s, col) {
  const [cx, cy] = P(x, y, 0);
  circle(ctx, cx - 2.5 * s, cy - 2.5 * s, 3.4 * s, shade(col, -0.15));
  circle(ctx, cx + 2 * s, cy - 2.8 * s, 3.6 * s, col);
  circle(ctx, cx, cy - 4.6 * s, 3 * s, shade(col, 0.12));
  if (SNOW) { ctx.fillStyle = '#f7fbff'; ctx.beginPath(); ctx.ellipse(cx, cy - 6.2 * s, 2.6 * s, 1.3 * s, 0, 0, TAU); ctx.fill(); }
}
function flowers(ctx, x0, y0, x1, y1, n, r) {
  const cols = ['#f05a7e', '#ffd34d', '#ffffff', '#b07cf0', '#ff8a3d'];
  for (let i = 0; i < n; i++) {
    const t = i / Math.max(1, n - 1);
    const [cx, cy] = P(lerp(x0, x1, t), lerp(y0, y1, t), 0);
    circle(ctx, cx, cy - 1.5, 1.7, pick(r, cols));
    circle(ctx, cx + 0.4, cy - 1.9, 0.6, '#fff6c8');
  }
}
function hedge(ctx, x0, y0, x1, y1, col = '#4c8d3c') { box(ctx, x0, y0, x1, y1, 0, 5, col, { top: SNOW ? '#f2f7fa' : shade(col, 0.15) }); }
function car(ctx, x, y, alongX, color) {
  const L = 0.36, W = 0.19;
  const x0 = alongX ? x - L / 2 : x - W / 2, x1 = alongX ? x + L / 2 : x + W / 2;
  const y0 = alongX ? y - W / 2 : y - L / 2, y1 = alongX ? y + W / 2 : y + L / 2;
  const sv = SNOW; SNOW = false;
  box(ctx, x0, y0, x1, y1, 0.5, 4, color);
  const ix = alongX ? 0.07 : 0.025, iy = alongX ? 0.025 : 0.07;
  box(ctx, x0 + ix, y0 + iy, x1 - ix, y1 - iy, 4.5, 3.5, '#bfe2f2', { top: shade(color, 0.2) });
  SNOW = sv;
}
function pool(ctx, x0, y0, x1, y1) {
  flat(ctx, x0 - 0.06, y0 - 0.06, x1 + 0.06, y1 + 0.06, 0, '#eef0ea', true);
  flat(ctx, x0, y0, x1, y1, 0, '#4fb4dd');
  flat(ctx, x0, y0, x1, lerp(y0, y1, 0.35), 0, '#7ccbea');
  ctx.strokeStyle = 'rgba(255,255,255,.6)'; ctx.lineWidth = 0.8;
  const [ax, ay] = P(lerp(x0, x1, 0.3), lerp(y0, y1, 0.6), 0), [bx, by] = P(lerp(x0, x1, 0.6), lerp(y0, y1, 0.6), 0);
  ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(bx, by); ctx.stroke();
}
function windows(ctx, len, floors, fh, base, per, glass, opt = {}) {
  const cnt = Math.max(1, Math.round(len * per));
  const gap = len / cnt, ww = gap * (opt.wide || 0.5);
  for (let f = 0; f < floors; f++) {
    const v = base + f * fh + fh * (opt.sill || 0.3), h = fh * (opt.tall || 0.5);
    for (let i = 0; i < cnt; i++) {
      if (opt.skip && opt.skip(f, i)) continue;
      const u = i * gap + (gap - ww) / 2;
      ctx.fillStyle = opt.frame || 'rgba(255,255,255,.78)'; ctx.fillRect(u - 0.012, v - 0.8, ww + 0.024, h + 1.6);
      ctx.fillStyle = glass; ctx.fillRect(u, v, ww, h);
      ctx.fillStyle = 'rgba(255,255,255,.38)'; ctx.fillRect(u, v + h * 0.55, ww * 0.42, h * 0.45);
      if (opt.boxes && f === 0) { ctx.fillStyle = '#7a5434'; ctx.fillRect(u - 0.01, v - 2.4, ww + 0.02, 1.8); ctx.fillStyle = opt.boxes; ctx.fillRect(u, v - 1.2, ww, 1.4); }
    }
  }
}
function door(ctx, u, w, h, col = '#7a4a2a') {
  ctx.fillStyle = shade(col, 0.5); ctx.fillRect(u - 0.015, 0, w + 0.03, h + 1);
  ctx.fillStyle = col; ctx.fillRect(u, 0, w, h);
  ctx.fillStyle = '#f2d36b'; ctx.fillRect(u + w * 0.72, h * 0.45, w * 0.12, 1.2);
}
function lamp(ctx, x, y) {
  const [cx, cy] = P(x, y, 0);
  ctx.fillStyle = '#3b3b44'; ctx.fillRect(cx - 0.6, cy - 16, 1.2, 16);
  circle(ctx, cx, cy - 17, 2.2, '#fff3b0');
}

// ── roofs ──
function snowCap(ctx, quadEave, ridgeA, ridgeB, t = 0.45) {
  if (!SNOW) return;
  const [e0, e1] = quadEave;
  const a = [lerp(ridgeA[0], e0[0], t), lerp(ridgeA[1], e0[1], t), lerp(ridgeA[2], e0[2], t)];
  const b = [lerp(ridgeB[0], e1[0], t), lerp(ridgeB[1], e1[1], t), lerp(ridgeB[2], e1[2], t)];
  face(ctx, [a, b, ridgeB, ridgeA], '#f6fafd', false);
}
function gable(ctx, x0, y0, x1, y1, z, rh, axis, roof, wall, o = 0.07) {
  const X0 = x0 - o, X1 = x1 + o, Y0 = y0 - o, Y1 = y1 + o;
  if (SNOW) roof = mix(roof, '#ffffff', 0.15);
  if (axis === 'x') {
    const ym = (y0 + y1) / 2;
    const R0 = [X0, ym, z + rh], R1 = [X1, ym, z + rh];
    face(ctx, [[X0, Y0, z], [X1, Y0, z], R1, R0], shade(roof, -0.28));
    face(ctx, [[x1, y0, z], [x1, y1, z], [x1, ym, z + rh]], shade(wall, -0.17));
    const fr = [[X0, Y1, z], [X1, Y1, z], R1, R0];
    face(ctx, fr, roof);
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 0.6;
    for (let t = 0.33; t < 1; t += 0.33) { path(ctx, [[X0, lerp(Y1, ym, t), z + rh * t], [X1, lerp(Y1, ym, t), z + rh * t]]); ctx.stroke(); }
    snowCap(ctx, [fr[0], fr[1]], R0, R1);
    LAST_ROOF = fr;
  } else {
    const xm = (x0 + x1) / 2;
    const R0 = [xm, Y0, z + rh], R1 = [xm, Y1, z + rh];
    face(ctx, [[X0, Y0, z], [X0, Y1, z], R1, R0], shade(roof, -0.28));
    face(ctx, [[x0, y1, z], [x1, y1, z], [xm, y1, z + rh]], wall);
    const fr = [[X1, Y0, z], [X1, Y1, z], R1, R0];
    face(ctx, fr, shade(roof, -0.14));
    ctx.strokeStyle = 'rgba(0,0,0,.12)'; ctx.lineWidth = 0.6;
    for (let t = 0.33; t < 1; t += 0.33) { path(ctx, [[lerp(X1, xm, t), Y0, z + rh * t], [lerp(X1, xm, t), Y1, z + rh * t]]); ctx.stroke(); }
    snowCap(ctx, [fr[0], fr[1]], R0, R1);
    LAST_ROOF = fr;
  }
}
function hip(ctx, x0, y0, x1, y1, z, rh, roof, o = 0.06) {
  const X0 = x0 - o, X1 = x1 + o, Y0 = y0 - o, Y1 = y1 + o;
  if (SNOW) roof = mix(roof, '#ffffff', 0.15);
  const w = X1 - X0, d = Y1 - Y0;
  if (w >= d) {
    const ym = (Y0 + Y1) / 2, ins = d / 2;
    const R0 = [X0 + ins, ym, z + rh], R1 = [X1 - ins, ym, z + rh];
    face(ctx, [[X0, Y0, z], [X1, Y0, z], R1, R0], shade(roof, -0.28));
    face(ctx, [[X1, Y0, z], [X1, Y1, z], R1], shade(roof, -0.15));
    const fr = [[X0, Y1, z], [X1, Y1, z], R1, R0];
    face(ctx, fr, roof); snowCap(ctx, [fr[0], fr[1]], R0, R1); LAST_ROOF = fr;
  } else {
    const xm = (X0 + X1) / 2, ins = w / 2;
    const R0 = [xm, Y0 + ins, z + rh], R1 = [xm, Y1 - ins, z + rh];
    face(ctx, [[X0, Y0, z], [X0, Y1, z], R1, R0], shade(roof, -0.28));
    face(ctx, [[X0, Y1, z], [X1, Y1, z], R1], roof);
    const fr = [[X1, Y0, z], [X1, Y1, z], R1, R0];
    face(ctx, fr, shade(roof, -0.15)); snowCap(ctx, [fr[0], fr[1]], R0, R1); LAST_ROOF = fr;
  }
}
function parapetRoof(ctx, x0, y0, x1, y1, z, col) {
  const i = 0.07;
  flat(ctx, x0 + i, y0 + i, x1 - i, y1 - i, z, SNOW ? '#eef4f8' : shade(col, -0.1));
  ctx.strokeStyle = 'rgba(0,0,0,.08)'; ctx.lineWidth = 0.6;
  path(ctx, [[x0 + i, y0 + i, z], [x1 - i, y0 + i, z], [x1 - i, y1 - i, z], [x0 + i, y1 - i, z]]); ctx.stroke();
  LAST_ROOF = [[x0 + i, y1 - i, z], [x1 - i, y1 - i, z], [x1 - i, y0 + i, z], [x0 + i, y0 + i, z]];
  LAST_ROOF.flat = true;
}
function acUnits(ctx, x0, y0, x1, y1, z, r) {
  const n = 1 + Math.floor(r() * 3);
  for (let i = 0; i < n; i++) {
    const ax = lerp(x0 + 0.15, x1 - 0.3, r()), ay = lerp(y0 + 0.15, y1 - 0.3, r());
    box(ctx, ax, ay, ax + 0.16, ay + 0.13, z, 4, '#c9ccd2');
  }
  if (r() < 0.5) {
    const tx = lerp(x0 + 0.25, x1 - 0.25, r()), ty = lerp(y0 + 0.25, y1 - 0.25, r());
    cyl(ctx, tx, ty, z, 0.09, 11, '#8f7a63');
  }
}
function lawn(ctx, w, d, col, mow = true) {
  flat(ctx, 0, 0, w, d, 0, col);
  if (mow && !SNOW) {
    ctx.fillStyle = 'rgba(255,255,255,.05)';
    for (let i = 0; i < w * 3; i += 2) { path(ctx, [[i / 3, 0, 0], [(i + 1) / 3, 0, 0], [(i + 1) / 3, d, 0], [i / 3, d, 0]]); ctx.fill(); }
  }
  ctx.strokeStyle = 'rgba(40,60,20,.16)'; ctx.lineWidth = 0.8;
  path(ctx, [[0.02, 0.02, 0], [w - 0.02, 0.02, 0], [w - 0.02, d - 0.02, 0], [0.02, d - 0.02, 0]]); ctx.stroke();
}
function paved(ctx, w, d, col = '#d8d2c4', grid = true) {
  flat(ctx, 0, 0, w, d, 0, SNOW ? mix(col, '#ffffff', 0.4) : col);
  if (grid) {
    ctx.strokeStyle = 'rgba(0,0,0,.06)'; ctx.lineWidth = 0.6;
    for (let i = 0.5; i < w; i += 0.5) { path(ctx, [[i, 0, 0], [i, d, 0]]); ctx.stroke(); }
    for (let i = 0.5; i < d; i += 0.5) { path(ctx, [[0, i, 0], [w, i, 0]]); ctx.stroke(); }
  }
}
function picket(ctx, x0, y0, x1, y1, col = '#ffffff') {
  const n = Math.round(Math.hypot(x1 - x0, y1 - y0) * 9);
  ctx.strokeStyle = col; ctx.lineWidth = 0.9;
  for (let i = 0; i <= n; i++) {
    const t = i / n, x = lerp(x0, x1, t), y = lerp(y0, y1, t);
    const [ax, ay] = P(x, y, 0);
    ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay - 5); ctx.stroke();
  }
  const [a1, b1] = P(x0, y0, 3.5), [a2, b2] = P(x1, y1, 3.5);
  ctx.beginPath(); ctx.moveTo(a1, b1); ctx.lineTo(a2, b2); ctx.stroke();
}
function awningL(ctx, x0, x1, y, z, depth, cols) {
  const n = Math.max(2, Math.round((x1 - x0) * 8));
  for (let i = 0; i < n; i++) {
    const a = lerp(x0, x1, i / n), b = lerp(x0, x1, (i + 1) / n);
    face(ctx, [[a, y, z], [b, y, z], [b, y + depth, z - 5], [a, y + depth, z - 5]], cols[i % 2], false);
  }
  path(ctx, [[x0, y, z], [x1, y, z], [x1, y + depth, z - 5], [x0, y + depth, z - 5]]);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW; ctx.stroke();
}
function awningR(ctx, x, y0, y1, z, depth, cols) {
  const n = Math.max(2, Math.round((y1 - y0) * 8));
  for (let i = 0; i < n; i++) {
    const a = lerp(y0, y1, i / n), b = lerp(y0, y1, (i + 1) / n);
    face(ctx, [[x, a, z], [x, b, z], [x + depth, b, z - 5], [x + depth, a, z - 5]], shade(cols[i % 2], -0.12), false);
  }
  path(ctx, [[x, y0, z], [x, y1, z], [x + depth, y1, z - 5], [x + depth, y0, z - 5]]);
  ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW; ctx.stroke();
}
function parkingLot(ctx, x0, y0, x1, y1, alongX, r, fill = 0.55) {
  flat(ctx, x0, y0, x1, y1, 0, SNOW ? '#c9ced6' : '#6c717a');
  ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 0.8;
  const spots = [];
  if (alongX) {
    for (let x = x0 + 0.05; x < x1; x += 0.28) {
      path(ctx, [[x, y0 + 0.05, 0], [x, y0 + 0.38, 0]]); ctx.stroke();
      path(ctx, [[x, y1 - 0.38, 0], [x, y1 - 0.05, 0]]); ctx.stroke();
      if (x + 0.28 < x1) { spots.push([x + 0.14, y0 + 0.22]); spots.push([x + 0.14, y1 - 0.22]); }
    }
  } else {
    for (let y = y0 + 0.05; y < y1; y += 0.28) {
      path(ctx, [[x0 + 0.05, y, 0], [x0 + 0.38, y, 0]]); ctx.stroke();
      path(ctx, [[x1 - 0.38, y, 0], [x1 - 0.05, y, 0]]); ctx.stroke();
      if (y + 0.28 < y1) { spots.push([x0 + 0.22, y + 0.14]); spots.push([x1 - 0.22, y + 0.14]); }
    }
  }
  spots.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
  for (const s of spots) if (r() < fill) car(ctx, s[0], s[1], !alongX, pick(r, CARS));
}
function pyramid(ctx, x0, y0, x1, y1, h, rock, snowT = 0.38) {
  const ax = (x0 + x1) / 2, ay = (y0 + y1) / 2, A = [ax, ay, h];
  const L1 = [x0, y1, 0], L2 = [x1, y1, 0], R1 = [x1, y0, 0];
  face(ctx, [L1, L2, A], rock);
  face(ctx, [R1, L2, A], shade(rock, -0.2));
  if (snowT <= 0) return;
  const sl = (p) => [lerp(A[0], p[0], snowT), lerp(A[1], p[1], snowT), lerp(A[2], p[2], snowT)];
  face(ctx, [sl(L1), sl(L2), A], '#f7fbff', false);
  face(ctx, [sl(R1), sl(L2), A], '#dde8f1', false);
  ctx.fillStyle = '#f7fbff';
  const a = sl(L1), b = sl(L2);
  for (let i = 0; i < 4; i++) {
    const t0 = i / 4, t1 = (i + 0.5) / 4, t2 = (i + 1) / 4;
    const p0 = [lerp(a[0], b[0], t0), lerp(a[1], b[1], t0), lerp(a[2], b[2], t0)];
    const p1 = [lerp(a[0], b[0], t1), lerp(a[1], b[1], t1), lerp(a[2], b[2], t1) - h * 0.08];
    const p2 = [lerp(a[0], b[0], t2), lerp(a[1], b[1], t2), lerp(a[2], b[2], t2)];
    path(ctx, [p0, p1, p2]); ctx.fill();
  }
}
function person(ctx, x, y, shirt, skin = '#f0c9a4') {
  const [cx, cy] = P(x, y, 0);
  ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.beginPath(); ctx.ellipse(cx, cy, 2.4, 1.1, 0, 0, TAU); ctx.fill();
  ctx.fillStyle = '#3b3b44'; ctx.fillRect(cx - 1.2, cy - 4, 1, 4); ctx.fillRect(cx + 0.2, cy - 4, 1, 4);
  ctx.fillStyle = shirt; ctx.beginPath(); ctx.ellipse(cx, cy - 6, 2, 2.8, 0, 0, TAU); ctx.fill();
  circle(ctx, cx, cy - 10.3, 2, skin);
}
function umbrella(ctx, x, y, col) {
  const [ux, uy] = P(x, y, 0);
  ctx.fillStyle = '#6a4a32'; ctx.fillRect(ux - 0.5, uy - 12, 1, 12);
  ctx.beginPath(); ctx.moveTo(ux - 9, uy - 11); ctx.quadraticCurveTo(ux, uy - 20, ux + 9, uy - 11); ctx.closePath(); ctx.fillStyle = col; ctx.fill();
}

// ───────────────────────── building models ─────────────────────────
// Each returns the roof height (px) so pins can float above it.
const MODELS = {
  trees(ctx, L, r) {
    const n = 1 + Math.floor(r() * 2.6);
    const pts = [];
    for (let i = 0; i < n; i++) pts.push([0.2 + r() * 0.6, 0.2 + r() * 0.6]);
    pts.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    for (const p of pts) tree(ctx, p[0], p[1], 0.75 + r() * 0.35, pick(r, treeCols(L)), treeKind(L, r));
    return 30;
  },

  land(ctx, L, r) {
    const { w, d } = L;
    const g = lawnFor(L);
    flat(ctx, 0, 0, w, d, 0, SNOW ? '#eef3f6' : mix(g, '#c8b78a', 0.35));
    for (let i = 0; i < w * d * 3; i++) {
      const x = 0.1 + r() * (w - 0.2), y = 0.1 + r() * (d - 0.2);
      if (r() < 0.5) ellipse(ctx, x, y, 0, 0.08 + r() * 0.08, SNOW ? '#dfe8ee' : 'rgba(150,120,80,.35)');
      else bush(ctx, x, y, 0.4, SNOW ? '#c8d6c0' : '#7aa84a');
    }
    for (const [x, y] of [[0.08, 0.08], [w - 0.08, 0.08], [w - 0.08, d - 0.08], [0.08, d - 0.08]]) { const [cx, cy] = P(x, y, 0); ctx.fillStyle = '#e07a3a'; ctx.fillRect(cx - 0.7, cy - 5, 1.4, 5); }
    const [sx, sy] = P(w - 0.4, d - 0.3, 0);
    ctx.fillStyle = '#6e4a2c'; ctx.fillRect(sx - 4, sy - 14, 1.4, 14); ctx.fillRect(sx + 3, sy - 14, 1.4, 14);
    ctx.fillStyle = '#fff6e2'; ctx.fillRect(sx - 6, sy - 21, 13, 9); ctx.strokeStyle = '#c25e14'; ctx.lineWidth = 0.8; ctx.strokeRect(sx - 6, sy - 21, 13, 9);
    ctx.fillStyle = '#c25e14'; ctx.font = '800 4.6px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('LAND', sx + 0.5, sy - 15);
    return 26;
  },

  site(ctx, L, r) {
    const { w, d } = L;
    flat(ctx, 0, 0, w, d, 0, '#c9a77a');
    const tgt = KINDS[L.target] || KINDS.house;
    const full = Math.min(320, tgt.fl ? (L.floors || tgt.fl[0]) * 10.5 : tgt.top * 0.55);
    const stage = L.stage || 0;
    const m = 0.28, x0 = m, y0 = m, x1 = w - m, y1 = d - m;
    if (stage === 0) {
      flat(ctx, x0, y0, x1, y1, 0, '#8f6d45');
      box(ctx, x0 + 0.1, y0 + 0.1, x1 - 0.1, y1 - 0.1, 0, 2, '#b9b2a4');
    } else {
      const h = full * stage / 4;
      box(ctx, x0, y0, x1, y1, 0, h, '#c9c5bc', { top: '#b9b2a4', snowTop: false });
      faceL(ctx, x0, y1, 0, () => { ctx.fillStyle = 'rgba(60,60,70,.35)'; for (let v = 10; v < h; v += 10.5) ctx.fillRect(0.04, v - 6, x1 - x0 - 0.08, 5); });
      faceR(ctx, x1, y0, 0, () => { ctx.fillStyle = 'rgba(40,40,50,.35)'; for (let v = 10; v < h; v += 10.5) ctx.fillRect(0.04, v - 6, y1 - y0 - 0.08, 5); });
      ctx.strokeStyle = '#e0a43a'; ctx.lineWidth = 0.8;
      for (let t = 0; t <= 1; t += 0.25) {
        const [a, b] = P(lerp(x0, x1, t), y1 + 0.05, 0), [c, e] = P(lerp(x0, x1, t), y1 + 0.05, h + 4);
        ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c, e); ctx.stroke();
      }
    }
    const cx = x1 - 0.1, cy = y0 + 0.1;
    const mast = full + 40;
    const [mx, my] = P(cx, cy, 0);
    ctx.strokeStyle = '#f0c23a'; ctx.lineWidth = 2.2; ctx.beginPath(); ctx.moveTo(mx, my); ctx.lineTo(mx, my - mast); ctx.stroke();
    ctx.lineWidth = 0.6; for (let v = 6; v < mast; v += 6) { ctx.beginPath(); ctx.moveTo(mx - 1, my - v); ctx.lineTo(mx + 1, my - v - 6); ctx.stroke(); }
    ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(mx - 46, my - mast + 6); ctx.lineTo(mx + 18, my - mast - 4); ctx.stroke();
    ctx.fillStyle = '#4a4f5a'; ctx.fillRect(mx + 10, my - mast - 4, 8, 6);
    ctx.strokeStyle = '#3b3b44'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(mx - 36, my - mast + 5); ctx.lineTo(mx - 36, my - mast + 40); ctx.stroke();
    ctx.fillStyle = '#d64b3c'; ctx.fillRect(mx - 39, my - mast + 40, 6, 4);
    for (let t = 0; t < w; t += 0.25) { const [a, b] = P(t, d - 0.04, 0); ctx.fillStyle = (t * 4) % 2 < 1 ? '#e07a3a' : '#ffffff'; ctx.fillRect(a - 3, b - 4.5, 6, 3); }
    for (let t = 0; t < d; t += 0.25) { const [a, b] = P(w - 0.04, t, 0); ctx.fillStyle = (t * 4) % 2 < 1 ? '#e07a3a' : '#ffffff'; ctx.fillRect(a - 3, b - 4.5, 6, 3); }
    box(ctx, 0.15, d - 0.6, 0.65, d - 0.25, 0, 7, '#3d78c2', { snowTop: false });
    person(ctx, w * 0.45, d - 0.35, '#f0c23a', '#c68a5b');
    return mast + 10;
  },

  cottage(ctx, L, r) {
    const { w, d } = L;
    lawn(ctx, w, d, lawnFor(L));
    const wall = lp(L, r, WALLS, 0), roof = lp(L, r, ROOFS, 1);
    hedge(ctx, 0.05, 0.05, w - 0.05, 0.15);
    tree(ctx, 1.6, 0.45, 0.8, pick(r, treeCols(L)), treeKind(L, r));
    flat(ctx, 0.85, 1.35, 1.05, d, 0, '#e3dccb');
    const ext = L.ups && L.ups.extension;
    const x0 = ext ? 0.35 : 0.5, x1 = ext ? 1.45 : 1.35, y0 = 0.5, y1 = 1.3, h = 15;
    box(ctx, x0, y0, x1, y1, 0, h, wall);
    const doorU = 0.85 - x0 - 0.07;
    faceL(ctx, x0, y1, 0, () => {
      door(ctx, doorU, 0.15, 10, pick(r, ['#7a4a2a', '#3d78c2', '#d64b3c', '#2f7d6d']));
      const n = Math.max(1, Math.round((x1 - x0) * 3.4)), gap = (x1 - x0) / n;
      windows(ctx, x1 - x0, 1, h, 0, 3.4, '#9fd3ef', { skip: (f, i) => Math.abs((i + 0.5) * gap - (doorU + 0.075)) < 0.16, boxes: '#f05a7e' });
    });
    faceR(ctx, x1, y0, 0, () => windows(ctx, 0.8, 1, h, 0, 2.4, '#9fd3ef'));
    const axis = r() < 0.5 ? 'x' : 'y';
    gable(ctx, x0, y0, x1, y1, h, 17, axis, roof, wall);
    const keep = LAST_ROOF;
    box(ctx, x0 + 0.12, y0 + 0.1, x0 + 0.24, y0 + 0.22, h, 19, '#a65a44');
    LAST_ROOF = keep;
    smokeAt(x0 + 0.18, y0 + 0.16, h + 20);
    bush(ctx, 0.45, 1.5, 0.8, '#5aa846');
    flowers(ctx, 1.15, 1.42, 1.35, 1.42, 4, r);
    picket(ctx, 0.05, d - 0.06, 0.8, d - 0.06);
    picket(ctx, 1.1, d - 0.06, w - 0.06, d - 0.06);
    picket(ctx, w - 0.06, 0.1, w - 0.06, d - 0.06);
    return h + 17;
  },

  house(ctx, L, r) {
    const { w, d } = L;
    lawn(ctx, w, d, lawnFor(L));
    const wall = r() < 0.3 ? lp(L, r, BRICKS, 0) : lp(L, r, WALLS, 0), roof = lp(L, r, ROOFS, 1);
    hedge(ctx, 0.05, 0.05, w - 0.05, 0.14);
    hedge(ctx, 0.05, 0.14, 0.14, d - 0.05);
    tree(ctx, 0.4, 0.42, 0.9, pick(r, treeCols(L)), treeKind(L, r));
    flat(ctx, 1.48, 1.3, 1.86, d, 0, '#dcd6c9');
    const ext = L.ups && L.ups.extension;
    const two = r() < 0.55 || ext, fh = 13, h = two ? fh * 2 : fh + 2;
    const x0 = ext ? 0.25 : 0.38, x1 = 1.42, y0 = ext ? 0.3 : 0.42, y1 = 1.32;
    box(ctx, x0, y0, x1, y1, 0, h, wall);
    faceL(ctx, x0, y1, 0, () => { door(ctx, 0.45 + (0.38 - x0), 0.16, 10.5); windows(ctx, x1 - x0, two ? 2 : 1, fh, 0, 2.9, '#9fd3ef', { skip: (f, i) => f === 0 && i === 1, boxes: L.lux >= 2 ? '#ffd34d' : null }); });
    faceR(ctx, x1, y0, 0, () => windows(ctx, y1 - y0, two ? 2 : 1, fh, 0, 2.2, '#9fd3ef'));
    const axis = r() < 0.5 ? 'x' : 'y';
    gable(ctx, x0, y0, x1, y1, h, 15, axis, roof, wall);
    const keep = LAST_ROOF;
    if (r() < 0.7) { box(ctx, x0 + 0.16, y0 + 0.12, x0 + 0.29, y0 + 0.25, h, 19, '#a65a44'); smokeAt(x0 + 0.22, y0 + 0.18, h + 20); }
    box(ctx, 1.42, 0.78, 1.86, 1.3, 0, 11, shade(wall, -0.05));
    faceL(ctx, 1.42, 1.3, 0, () => { ctx.fillStyle = '#ece6da'; ctx.fillRect(0.05, 0, 0.34, 8.5); ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let v = 2; v < 8; v += 2) ctx.fillRect(0.05, v, 0.34, 0.5); });
    flat(ctx, 1.4, 0.76, 1.88, 1.32, 11, SNOW ? '#f2f7fa' : shade(roof, -0.1), true);
    LAST_ROOF = keep;
    if (r() < 0.6) car(ctx, 1.67, 1.68, false, pick(r, CARS));
    bush(ctx, 0.5, 1.5, 0.75, '#5aa846'); bush(ctx, 1.25, 1.5, 0.7, '#4c9a44');
    flowers(ctx, 0.62, 1.42, 1.0, 1.42, 5, r);
    return h + 15;
  },

  duplex(ctx, L, r) {
    const { w, d } = L;
    lawn(ctx, w, d, lawnFor(L));
    const wall = lp(L, r, WALLS, 0), wall2 = shade(wall, -0.07), roof = lp(L, r, ROOFS, 1);
    hedge(ctx, 0.05, 0.05, w - 0.05, 0.14);
    const x0 = 0.3, xm = 1.0, x1 = 1.7, y0 = 0.45, y1 = 1.35, fh = 13, h = fh * 2;
    box(ctx, x0, y0, xm, y1, 0, h, wall);
    box(ctx, xm, y0, x1, y1, 0, h, wall2);
    faceL(ctx, x0, y1, 0, () => {
      door(ctx, 0.12, 0.14, 10.5, '#2f7d6d'); door(ctx, 1.12, 0.14, 10.5, '#d64b3c');
      windows(ctx, 1.4, 2, fh, 0, 3.6, '#9fd3ef', { skip: (f, i) => f === 0 && (i === 0 || i === 3), boxes: '#ff8a3d' });
    });
    faceR(ctx, x1, y0, 0, () => windows(ctx, 0.9, 2, fh, 0, 2.2, '#9fd3ef'));
    hip(ctx, x0, y0, x1, y1, h, 13, roof);
    const keep = LAST_ROOF;
    box(ctx, 0.62, 0.62, 0.74, 0.74, h, 17, '#a65a44');
    box(ctx, 1.3, 0.62, 1.42, 0.74, h, 17, '#a65a44');
    LAST_ROOF = keep;
    flat(ctx, 0.4, 1.35, 0.6, d, 0, '#e3dccb'); flat(ctx, 1.4, 1.35, 1.6, d, 0, '#e3dccb');
    bush(ctx, 0.85, 1.6, 0.75, '#5aa846'); tree(ctx, 1.85, 1.75, 0.65, pick(r, treeCols(L)), treeKind(L, r));
    return h + 13;
  },

  townhouse(ctx, L, r) {
    const { w, d } = L;
    lawn(ctx, w, d, lawnFor(L));
    const alongX = w >= d;
    const long = alongX ? w : d;
    const n = Math.round(long * 1.5);
    const span = long - 0.4, uw = span / n;
    const fh = 12;
    for (let i = 0; i < n; i++) {
      const wall = WALLS[(i + (L.look != null ? L.look * 2 : Math.floor(r() * 8))) % WALLS.length];
      const roof = ROOFS[(i * 3 + (L.look != null ? L.look : Math.floor(r() * 3))) % ROOFS.length];
      const floors = 2 + (r() < 0.4 ? 1 : 0), h = floors * fh;
      if (alongX) {
        const x0 = 0.2 + i * uw, x1 = x0 + uw, y0 = 0.4, y1 = 1.35;
        box(ctx, x0, y0, x1, y1, 0, h, wall);
        faceL(ctx, x0, y1, 0, () => { door(ctx, uw * 0.2, uw * 0.28, 10); windows(ctx, uw, floors, fh, 0, 1 / uw * 1.4, '#9fd3ef', { skip: (f, j) => f === 0 && j === 0 }); });
        gable(ctx, x0, y0, x1, y1, h, 13, 'y', roof, wall, 0.03);
        flat(ctx, x0 + uw * 0.15, 1.35, x0 + uw * 0.55, d, 0, '#e3dccb');
        if (i === n - 1) faceR(ctx, x1, y0, 0, () => windows(ctx, 0.95, floors, fh, 0, 2, '#9fd3ef'));
      } else {
        const y0 = 0.2 + i * uw, y1 = y0 + uw, x0 = 0.4, x1 = 1.35;
        box(ctx, x0, y0, x1, y1, 0, h, wall);
        faceR(ctx, x1, y0, 0, () => { door(ctx, uw * 0.2, uw * 0.28, 10); windows(ctx, uw, floors, fh, 0, 1 / uw * 1.4, '#9fd3ef', { skip: (f, j) => f === 0 && j === 0 }); });
        gable(ctx, x0, y0, x1, y1, h, 13, 'x', roof, wall, 0.03);
        flat(ctx, 1.35, y0 + uw * 0.15, w, y0 + uw * 0.55, 0, '#e3dccb');
        if (i === n - 1) faceL(ctx, x0, y1, 0, () => windows(ctx, 0.95, floors, fh, 0, 2, '#9fd3ef'));
      }
    }
    for (let i = 0; i < n; i++) {
      const t = 0.2 + (i + 0.75) * uw;
      if (alongX) bush(ctx, t, 1.6, 0.6, '#5aa846'); else bush(ctx, 1.6, t, 0.6, '#5aa846');
    }
    return 3 * fh + 13;
  },

  villa(ctx, L, r) {
    const { w, d } = L;
    lawn(ctx, w, d, lawnFor(L));
    const wall = lp(L, r, ['#f6f1e7', '#f3ece0', '#efe6d6', '#e9eef0', '#2b2d33'], 0);
    const accent = lp(L, r, ['#c98a4b', '#8a5a3c', '#5f6b7a', '#d9b48a'], 1);
    hedge(ctx, 0.05, 0.05, w - 0.05, 0.14, '#467f37');
    tree(ctx, 0.35, 0.35, 0.8, pick(r, treeCols(L)), treeKind(L, r));
    const x0 = 0.3, x1 = 1.7, y0 = 0.3, y1 = 1.05;
    box(ctx, x0, y0, x1, y1, 0, 15, wall);
    faceL(ctx, x0, y1, 0, () => { ctx.fillStyle = '#6fb3d6'; ctx.fillRect(0.12, 1.5, 0.9, 10); ctx.fillStyle = 'rgba(255,255,255,.5)'; for (let u = 0.12; u < 1.02; u += 0.22) ctx.fillRect(u, 1.5, 0.012, 10); ctx.fillStyle = accent; ctx.fillRect(1.05, 0, 0.3, 15); });
    faceR(ctx, x1, y0, 0, () => windows(ctx, 0.75, 1, 15, 0, 2, '#7fc0e0', { tall: 0.6 }));
    flat(ctx, x0, y0, x1, y1, 15, '#e8e2d4', true);
    const ux0 = 0.55, ux1 = 1.5, uy0 = 0.3, uy1 = 0.92;
    box(ctx, ux0, uy0, ux1, uy1, 15, 13, wall);
    faceL(ctx, ux0, uy1, 15, () => { ctx.fillStyle = '#6fb3d6'; ctx.fillRect(0.08, 2, 0.6, 8.5); ctx.fillStyle = accent; ctx.fillRect(0.72, 0, 0.23, 13); });
    faceR(ctx, ux1, uy0, 15, () => windows(ctx, 0.62, 1, 13, 0, 2, '#7fc0e0'));
    flat(ctx, ux0 - 0.05, uy0 - 0.05, ux1 + 0.05, uy1 + 0.05, 28, SNOW ? '#f2f7fa' : shade(accent, 0.2), true);
    LAST_ROOF = [[ux0, uy1, 28], [ux1, uy1, 28], [ux1, uy0, 28], [ux0, uy0, 28]]; LAST_ROOF.flat = true;
    flat(ctx, 0.3, 1.12, 1.75, 1.88, 0, '#d9b48a');
    ctx.strokeStyle = 'rgba(120,80,40,.25)'; ctx.lineWidth = 0.6;
    for (let y = 1.2; y < 1.88; y += 0.1) { path(ctx, [[0.3, y, 0], [1.75, y, 0]]); ctx.stroke(); }
    pool(ctx, 0.45, 1.25, 1.35, 1.72);
    box(ctx, 1.45, 1.3, 1.62, 1.38, 0, 2.5, '#ffffff'); box(ctx, 1.45, 1.48, 1.62, 1.56, 0, 2.5, '#ffffff');
    const pk = treeKind(L, r) === 'pine' ? 'pine' : 'palm';
    tree(ctx, 1.82, 1.82, 0.85, '#4f9a3f', pk);
    tree(ctx, 1.85, 0.4, 0.8, '#4f9a3f', pk);
    return 30;
  },

  mansion(ctx, L, r) {
    const { w, d } = L;
    lawn(ctx, w, d, lawnFor(L));
    const wall = lp(L, r, ['#f3ead7', '#efe1c4', '#e9d9c9', '#f6f1e7'], 0), roof = lp(L, r, ['#566275', '#3f527d', '#8a5a3c', '#5f7f45'], 1);
    hedge(ctx, 0.08, 0.08, w - 0.08, 0.2, '#3f7a33');
    hedge(ctx, 0.08, 0.2, 0.2, d - 0.08, '#3f7a33');
    for (let i = 0; i < 4; i++) tree(ctx, 0.5 + i * 0.95, 0.45, 0.85, pick(r, treeCols(L)), i % 2 ? 'pine' : treeKind(L, r));
    ellipse(ctx, 2.3, 3.0, 0, 0.75, '#e4dac4');
    ellipse(ctx, 2.3, 3.0, 0, 0.42, shade(lawnFor(L), -0.05));
    flat(ctx, 2.1, 3.6, 2.5, d, 0, '#e4dac4');
    const fh = 14;
    box(ctx, 0.6, 0.9, 1.25, 2.0, 0, fh, wall);
    faceL(ctx, 0.6, 2.0, 0, () => windows(ctx, 0.65, 1, fh, 0, 3, '#9fd3ef'));
    hip(ctx, 0.6, 0.9, 1.25, 2.0, fh, 12, roof);
    box(ctx, 1.25, 0.8, 3.0, 2.15, 0, fh * 2, wall);
    faceL(ctx, 1.25, 2.15, 0, () => { windows(ctx, 1.75, 2, fh, 0, 3.4, '#9fd3ef', { skip: (f, i) => f === 0 && (i === 2 || i === 3), boxes: '#f05a7e' }); door(ctx, 0.74, 0.28, 12, '#5a3a22'); });
    faceR(ctx, 3.0, 0.8, 0, () => windows(ctx, 1.35, 2, fh, 0, 2.6, '#9fd3ef'));
    hip(ctx, 1.25, 0.8, 3.0, 2.15, fh * 2, 18, roof);
    const mainRoof = LAST_ROOF;
    box(ctx, 3.0, 0.9, 3.55, 2.0, 0, fh, wall);
    faceL(ctx, 3.0, 2.0, 0, () => windows(ctx, 0.55, 1, fh, 0, 3, '#9fd3ef'));
    faceR(ctx, 3.55, 0.9, 0, () => windows(ctx, 1.1, 1, fh, 0, 2.6, '#9fd3ef'));
    hip(ctx, 3.0, 0.9, 3.55, 2.0, fh, 12, roof);
    for (let i = 0; i < 4; i++) box(ctx, 1.85 + i * 0.17, 2.32, 1.9 + i * 0.17, 2.37, 0, 20, '#ffffff');
    box(ctx, 1.8, 2.15, 2.45, 2.42, 20, 4, '#ffffff');
    gable(ctx, 1.8, 2.15, 2.45, 2.42, 24, 8, 'y', roof, '#ffffff', 0.02);
    LAST_ROOF = mainRoof;
    ellipse(ctx, 2.3, 3.0, 0, 0.3, '#d9d2c3', OUTLINE);
    ellipse(ctx, 2.3, 3.0, 1, 0.24, SNOW ? '#d6e8f2' : '#5fbde0');
    const [fx, fy] = P(2.3, 3.0, 0);
    ctx.fillStyle = '#e8e2d4'; ctx.fillRect(fx - 1.5, fy - 9, 3, 9);
    circle(ctx, fx, fy - 10, 3, 'rgba(190,235,255,.9)');
    pool(ctx, 0.4, 2.6, 1.4, 3.3);
    tree(ctx, 0.6, 3.6, 0.9, pick(r, treeCols(L)), treeKind(L, r)); tree(ctx, 3.6, 3.0, 0.9, pick(r, treeCols(L)), treeKind(L, r)); tree(ctx, 3.4, 3.6, 0.8, pick(r, LEAVES), 'pine');
    return fh * 2 + 18;
  },

  apartment(ctx, L, r) {
    const { w, d } = L;
    lawn(ctx, w, d, lawnFor(L));
    flat(ctx, 0.1, 0.1, w - 0.1, d - 0.1, 0, SNOW ? '#e3e9ee' : '#d8d2c4');
    const wall = lp(L, r, ['#f2e6d0', '#e9d3b4', '#d6e3ea', '#efd7c9', '#e3e6d4', '#c9735a'], 0);
    const trim = lp(L, r, ['#ffffff', '#5f6b7a', '#3f8a8a', '#c9542f'], 1);
    const floors = L.floors || 5, fh = 12, h = floors * fh;
    const x0 = 0.28, x1 = w - 0.28, y0 = 0.28, y1 = d - 0.28;
    box(ctx, x0, y0, x1, y1, 0, h, wall);
    faceL(ctx, x0, y1, 0, () => {
      const lenL = x1 - x0;
      windows(ctx, lenL, floors, fh, 0, 3.2, '#9fd3ef', { skip: (f, i) => f === 0 && i === 1 });
      door(ctx, lenL * 0.3, 0.16, 10, '#5f6b7a');
      ctx.fillStyle = trim;
      for (let f = 1; f < floors; f++) ctx.fillRect(0, f * fh - 0.8, lenL, 1.6);
      ctx.fillStyle = 'rgba(255,255,255,.55)';
      const cnt = Math.round(lenL * 1.6);
      for (let f = 1; f < floors; f++) for (let i = 0; i < cnt; i++) ctx.fillRect((i + 0.18) * (lenL / cnt), f * fh, (lenL / cnt) * 0.64, 4);
      if (L.lux >= 2) { ctx.fillStyle = '#7fc06a'; for (let f = 1; f < floors; f++) for (let i = 0; i < cnt; i++) ctx.fillRect((i + 0.2) * (lenL / cnt), f * fh + 3.2, (lenL / cnt) * 0.2, 1.4); }
    });
    faceR(ctx, x1, y0, 0, () => {
      const lenR = y1 - y0;
      windows(ctx, lenR, floors, fh, 0, 2.6, '#8cc7e6');
      ctx.fillStyle = trim;
      for (let f = 1; f < floors; f++) ctx.fillRect(0, f * fh - 0.8, lenR, 1.6);
    });
    parapetRoof(ctx, x0, y0, x1, y1, h, wall);
    if (!(L.ups && (L.ups.rooftop || L.ups.solar))) acUnits(ctx, x0, y0, x1, y1, h, r);
    tree(ctx, w - 0.15, d - 0.12, 0.7, pick(r, treeCols(L)), treeKind(L, r));
    bush(ctx, 0.2, d - 0.15, 0.6, '#5aa846');
    return h + 14;
  },

  condotower(ctx, L, r) {
    const { w, d } = L;
    paved(ctx, w, d, '#dcd5c6');
    const wall = lp(L, r, ['#f4f1ea', '#e7eef2', '#f1e6d6', '#dfe9e6'], 0);
    const glass = lp(L, r, GLASS, 1);
    const floors = L.floors || 18, fh = 10;
    box(ctx, 0.18, 0.18, 1.82, 1.82, 0, 16, shade(wall, -0.08));
    faceL(ctx, 0.18, 1.82, 0, () => { ctx.fillStyle = glass; ctx.fillRect(0.1, 1.5, 1.44, 11); ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(0.1, 8, 1.44, 4.5); });
    faceR(ctx, 1.82, 0.18, 0, () => { ctx.fillStyle = shade(glass, -0.1); ctx.fillRect(0.1, 1.5, 1.44, 11); });
    flat(ctx, 0.18, 0.18, 1.82, 1.82, 16, '#9ccf72', true);
    const x0 = 0.45, x1 = 1.55, y0 = 0.45, y1 = 1.55, h = floors * fh;
    box(ctx, x0, y0, x1, y1, 16, h, glass, { left: glass, right: shade(glass, -0.18), top: wall });
    faceL(ctx, x0, y1, 16, () => {
      ctx.fillStyle = 'rgba(255,255,255,.22)'; ctx.fillRect(0, h * 0.5, 1.1, h * 0.5);
      ctx.fillStyle = wall;
      for (let f = 0; f <= floors; f++) ctx.fillRect(0, f * fh - 1.6, 1.1, 3.2);
      ctx.fillStyle = 'rgba(0,0,0,.08)';
      for (let u = 0.275; u < 1.1; u += 0.275) ctx.fillRect(u, 0, 0.01, h);
    });
    faceR(ctx, x1, y0, 16, () => { ctx.fillStyle = shade(wall, -0.15); for (let f = 0; f <= floors; f++) ctx.fillRect(0, f * fh - 1.6, 1.1, 3.2); });
    const top = 16 + h;
    parapetRoof(ctx, x0, y0, x1, y1, top, wall);
    if (!(L.ups && (L.ups.rooftop || L.ups.solar)) && r() < 0.5) {
      ellipse(ctx, 1.0, 1.0, top, 0.32, '#5f6b7a'); ellipse(ctx, 1.0, 1.0, top, 0.25, '#7a8594');
      const [hx, hy] = P(1.0, 1.0, top);
      ctx.fillStyle = '#ffffff'; ctx.font = '800 9px system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillText('H', hx, hy + 3);
    }
    tree(ctx, 0.12, 1.9, 0.6, pick(r, treeCols(L)), treeKind(L, r)); tree(ctx, 1.9, 0.12, 0.6, pick(r, treeCols(L)), treeKind(L, r));
    return top + 14;
  },

  chalet(ctx, L, r) {
    const { w, d } = L;
    lawn(ctx, w, d, lawnFor(L));
    const wood = lp(L, r, WOOD, 0), roof = lp(L, r, ['#5a3a2a', '#3f527d', '#8a3a2a', '#3f5f3a'], 1);
    tree(ctx, 0.3, 0.3, 0.9, '#3f7a4a', 'pine'); tree(ctx, 1.75, 0.35, 0.8, '#3f7a4a', 'pine');
    const ext = L.ups && L.ups.extension;
    const x0 = ext ? 0.3 : 0.45, x1 = 1.5, y0 = 0.45, y1 = 1.35, h = 16;
    box(ctx, x0, y0, x1, y1, 0, 6, '#9a958c');
    box(ctx, x0, y0, x1, y1, 6, h, wood);
    faceL(ctx, x0, y1, 6, () => {
      ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let v = 2; v < h; v += 3) ctx.fillRect(0, v, x1 - x0, 0.6);
      windows(ctx, x1 - x0, 1, h, 0, 2.6, '#ffe7a8', { tall: 0.55 });
    });
    faceR(ctx, x1, y0, 6, () => { ctx.fillStyle = 'rgba(0,0,0,.14)'; for (let v = 2; v < h; v += 3) ctx.fillRect(0, v, y1 - y0, 0.6); windows(ctx, y1 - y0, 1, h, 0, 2, '#ffe7a8'); });
    box(ctx, x0 - 0.02, y1, x1 + 0.02, y1 + 0.18, 6 + h * 0.55, 1.5, shade(wood, 0.1));
    for (let t = x0; t <= x1; t += 0.12) { const [a, b] = P(t, y1 + 0.17, 6 + h * 0.55); ctx.fillStyle = shade(wood, -0.2); ctx.fillRect(a - 0.4, b - 4, 0.8, 4); }
    gable(ctx, x0, y0, x1, y1, 6 + h, 30, 'y', roof, wood, 0.12);
    const keep = LAST_ROOF;
    const [tx, ty] = P((x0 + x1) / 2, y1, 6 + h + 6);
    ctx.fillStyle = '#ffe7a8'; ctx.beginPath(); ctx.moveTo(tx - 6, ty + 5); ctx.lineTo(tx + 6, ty + 5); ctx.lineTo(tx, ty - 6); ctx.closePath(); ctx.fill();
    box(ctx, x1 - 0.25, y0 + 0.15, x1 - 0.12, y0 + 0.28, 6 + h, 22, '#8f877c');
    LAST_ROOF = keep;
    smokeAt(x1 - 0.18, y0 + 0.22, 6 + h + 24);
    box(ctx, 1.6, 1.4, 1.9, 1.6, 0, 5, '#8a5a34', { top: '#c9a26a', snowTop: false });
    const [kx, ky] = P(0.3, 1.6, 0); ctx.strokeStyle = '#d64b3c'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(kx, ky); ctx.lineTo(kx + 2, ky - 14); ctx.moveTo(kx + 3, ky); ctx.lineTo(kx + 5, ky - 14); ctx.stroke();
    return 6 + h + 30;
  },

  cabin(ctx, L, r) {
    const { w, d } = L;
    lawn(ctx, w, d, lawnFor(L));
    const wood = lp(L, r, WOOD, 0), roof = lp(L, r, ['#5f7f45', '#8a3a2a', '#566275', '#6b4424'], 1);
    tree(ctx, 0.3, 0.4, 0.9, '#3f7a4a', 'pine'); tree(ctx, 1.7, 0.3, 1, '#3f7a4a', 'pine');
    const ext = L.ups && L.ups.extension;
    const x0 = 0.5, x1 = ext ? 1.55 : 1.4, y0 = 0.55, y1 = 1.3, h = 13;
    box(ctx, x0, y0, x1, y1, 0, h, wood);
    const logs = (len) => { for (let v = 1.5; v < h; v += 2.4) { ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(0, v, len, 1); ctx.fillStyle = 'rgba(0,0,0,.18)'; ctx.fillRect(0, v - 0.6, len, 0.6); } };
    faceL(ctx, x0, y1, 0, () => { logs(x1 - x0); door(ctx, 0.15, 0.17, 10, '#5a3a22'); windows(ctx, x1 - x0, 1, h, 0, 2.4, '#ffe7a8', { skip: (f, i) => i === 0 }); });
    faceR(ctx, x1, y0, 0, () => { logs(y1 - y0); windows(ctx, y1 - y0, 1, h, 0, 2, '#ffe7a8'); });
    gable(ctx, x0, y0, x1, y1, h, 16, 'x', roof, wood, 0.1);
    const keep = LAST_ROOF;
    box(ctx, x0 + 0.1, y0 + 0.08, x0 + 0.24, y0 + 0.22, h - 2, 18, '#8f877c');
    LAST_ROOF = keep;
    smokeAt(x0 + 0.17, y0 + 0.15, h + 18);
    box(ctx, 1.5, 1.45, 1.85, 1.7, 0, 5, '#8a5a34', { top: '#c9a26a', snowTop: false });
    flat(ctx, 0.7, 1.3, 0.9, d, 0, SNOW ? '#dfe7ec' : '#c9b08a');
    return h + 16;
  },

  lakehouse(ctx, L, r) {
    const { w, d } = L;
    lawn(ctx, w, d, lawnFor(L));
    const wall = lp(L, r, ['#f6f1e7', '#2b2d33', '#e9e1d2', '#3a4a5a'], 0), timber = lp(L, r, ['#b07a4a', '#8a5a34', '#c9a26a'], 1);
    tree(ctx, 0.3, 0.35, 0.9, pick(r, LEAVES), 'pine'); tree(ctx, 1.75, 0.3, 0.8, pick(r, treeCols(L)), treeKind(L, r));
    box(ctx, 0.3, 0.35, 1.25, 1.2, 0, 15, wall);
    faceL(ctx, 0.3, 1.2, 0, () => { ctx.fillStyle = '#7fc0e0'; ctx.fillRect(0.05, 1, 0.85, 12); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(0.05, 7, 0.4, 6); });
    faceR(ctx, 1.25, 0.35, 0, () => { ctx.fillStyle = timber; ctx.fillRect(0, 0, 0.85, 15); ctx.fillStyle = 'rgba(0,0,0,.15)'; for (let u = 0.08; u < 0.85; u += 0.08) ctx.fillRect(u, 0, 0.01, 15); });
    flat(ctx, 0.3, 0.35, 1.25, 1.2, 15, '#6b7280', true);
    box(ctx, 0.75, 0.3, 1.75, 0.95, 15, 13, timber);
    faceL(ctx, 0.75, 0.95, 15, () => { ctx.fillStyle = '#7fc0e0'; ctx.fillRect(0.05, 1.5, 0.9, 10); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(0.05, 6.5, 0.35, 5); });
    faceR(ctx, 1.75, 0.3, 15, () => { ctx.fillStyle = '#7fc0e0'; ctx.fillRect(0.1, 2, 0.45, 9); });
    flat(ctx, 0.72, 0.27, 1.78, 0.98, 28, SNOW ? '#f2f7fa' : '#3b3f47', true);
    LAST_ROOF = [[0.75, 0.95, 28], [1.75, 0.95, 28], [1.75, 0.3, 28], [0.75, 0.3, 28]]; LAST_ROOF.flat = true;
    flat(ctx, 0.25, 1.25, 1.9, 1.9, 0, '#c9a26a');
    ctx.strokeStyle = 'rgba(120,80,40,.3)'; ctx.lineWidth = 0.6;
    for (let x = 0.35; x < 1.9; x += 0.1) { path(ctx, [[x, 1.25, 0], [x, 1.9, 0]]); ctx.stroke(); }
    box(ctx, 0.5, 1.45, 0.8, 1.6, 0, 3, '#ffffff'); box(ctx, 1.0, 1.45, 1.3, 1.6, 0, 3, '#ffffff');
    const [fx, fy] = P(1.6, 1.6, 0); ctx.fillStyle = '#5a5a60'; ctx.beginPath(); ctx.ellipse(fx, fy - 2, 5, 2.5, 0, 0, TAU); ctx.fill(); circle(ctx, fx, fy - 4, 2.2, '#ff8a3d');
    return 30;
  },

  beachvilla(ctx, L, r) {
    const { w, d } = L;
    flat(ctx, 0, 0, w, d, 0, '#f3e2a9');
    flat(ctx, 0.05, 0.05, w - 0.05, 1.3, 0, lawnFor(L));
    const wall = lp(L, r, COASTAL, 0), roof = lp(L, r, ['#ffffff', '#f2c6a5', '#3f8a8a', '#e86a8a'], 1);
    tree(ctx, 0.25, 0.3, 0.9, '#4f9a3f', 'palm');
    const ext = L.ups && L.ups.extension;
    const x0 = ext ? 0.35 : 0.45, x1 = 1.5, y0 = 0.4, y1 = 1.25, h = 15;
    box(ctx, x0 - 0.06, y0, x1 + 0.08, y1 + 0.18, 0, 3, '#d9c39a');
    box(ctx, x0, y0, x1, y1, 3, h, wall);
    faceL(ctx, x0, y1, 3, () => { door(ctx, 0.4, 0.2, 10, '#3d78c2'); windows(ctx, x1 - x0, 1, h, 0, 3, '#7fd0e8', { skip: (f, i) => i === 1, tall: 0.6 }); });
    faceR(ctx, x1, y0, 3, () => windows(ctx, y1 - y0, 1, h, 0, 2, '#7fd0e8', { tall: 0.6 }));
    for (let t = x0; t <= x1 + 0.01; t += 0.18) { const [a, b] = P(t, y1 + 0.16, 3); ctx.fillStyle = '#ffffff'; ctx.fillRect(a - 0.5, b - 12, 1, 12); }
    hip(ctx, x0 - 0.05, y0, x1 + 0.08, y1 + 0.2, 3 + h, 14, roof, 0.05);
    const sb = (x, y, c) => { const [a, b] = P(x, y, 0); ctx.save(); ctx.translate(a, b - 9); ctx.rotate(0.15); ctx.fillStyle = c; ctx.beginPath(); ctx.ellipse(0, 0, 1.8, 9, 0, 0, TAU); ctx.fill(); ctx.restore(); };
    sb(1.7, 0.6, '#ff8a3d'); sb(1.8, 0.75, '#3d78c2');
    umbrella(ctx, 0.6, 1.65, '#e86a8a');
    box(ctx, 1.1, 1.55, 1.45, 1.68, 0, 1.6, '#ffffff');
    tree(ctx, 1.85, 1.75, 0.85, '#4f9a3f', 'palm');
    return 3 + h + 14;
  },

  cornerstore(ctx, L, r) {
    const { w, d } = L;
    paved(ctx, w, d, '#dcd5c6');
    const wall = lp(L, r, ['#f2e6d0', '#c9735a', '#e9d3b4', '#d6e3ea', '#f1dc9a'], 0);
    const aw = lp(L, r, AWNINGS, 1);
    const x0 = 0.35, x1 = 1.55, y0 = 0.4, y1 = 1.45, h = 17;
    box(ctx, x0, y0, x1, y1, 0, h, wall);
    faceL(ctx, x0, y1, 0, () => { ctx.fillStyle = '#86c3e3'; ctx.fillRect(0.08, 1, 0.65, 9.5); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(0.08, 6, 0.3, 4.5); door(ctx, 0.85, 0.2, 10.5, '#5a3a22'); });
    faceR(ctx, x1, y0, 0, () => { ctx.fillStyle = '#76b4d4'; ctx.fillRect(0.12, 1, 0.8, 9.5); });
    flat(ctx, x0, y0, x1, y1, h, SNOW ? '#f2f7fa' : shade(wall, -0.12), true);
    LAST_ROOF = [[x0, y1, h], [x1, y1, h], [x1, y0, h], [x0, y0, h]]; LAST_ROOF.flat = true;
    box(ctx, x0 + 0.1, y1 - 0.02, x1 - 0.1, y1, h, 6, aw[0], { top: shade(aw[0], 0.2), snowTop: false });
    textL(ctx, x0 + 0.1, y1, h + 1.2, pick(r, ['DELI', 'MARKET', 'GROCER', 'NEWS', '24/7']), 5, '#ffffff', x1 - x0 - 0.2);
    awningL(ctx, x0 + 0.04, x1 - 0.04, y1, 13, 0.24, aw);
    awningR(ctx, x1, y0 + 0.05, y1 - 0.05, 13, 0.22, aw);
    box(ctx, 0.5, 1.78, 0.7, 1.9, 0, 4, '#c98a4b', { snowTop: false }); box(ctx, 0.75, 1.78, 0.95, 1.9, 0, 4, '#8db36b', { snowTop: false });
    tree(ctx, 1.85, 1.8, 0.6, pick(r, treeCols(L)), treeKind(L, r));
    person(ctx, 1.2, 1.7, pick(r, CARS));
    return h + 8;
  },

  cafe(ctx, L, r) {
    const { w, d } = L;
    paved(ctx, w, d, '#e3d8c3');
    const wall = lp(L, r, ['#2f7d6d', '#3f527d', '#c9542f', '#f2e6d0', '#8a5a3c'], 0);
    const aw = lp(L, r, AWNINGS, 1);
    const x0 = 0.3, x1 = 1.35, y0 = 0.3, y1 = 1.2, h = 16;
    box(ctx, x0, y0, x1, y1, 0, h, wall);
    faceL(ctx, x0, y1, 0, () => { ctx.fillStyle = '#fbe7b5'; ctx.fillRect(0.06, 1, 0.6, 9); ctx.fillStyle = 'rgba(255,255,255,.4)'; ctx.fillRect(0.06, 6, 0.28, 4); door(ctx, 0.75, 0.18, 10.5, '#3a2a1e'); });
    faceR(ctx, x1, y0, 0, () => { ctx.fillStyle = '#fbe7b5'; ctx.fillRect(0.1, 1, 0.7, 9); });
    flat(ctx, x0, y0, x1, y1, h, SNOW ? '#f2f7fa' : shade(wall, -0.15), true);
    LAST_ROOF = [[x0, y1, h], [x1, y1, h], [x1, y0, h], [x0, y0, h]]; LAST_ROOF.flat = true;
    textL(ctx, x0, y1, h - 3.5, 'CAFÉ', 5.5, '#ffffff', x1 - x0);
    awningL(ctx, x0 + 0.04, x1 - 0.04, y1, 12.5, 0.22, aw);
    const spots = [[1.6, 0.55], [1.6, 1.15], [0.55, 1.6], [1.15, 1.62], [1.65, 1.7]];
    for (const [tx, ty] of spots) {
      const [cx, cy] = P(tx, ty, 0);
      ctx.fillStyle = 'rgba(0,0,0,.15)'; ctx.beginPath(); ctx.ellipse(cx + 2, cy + 1, 7, 3.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#6a4a32'; ctx.fillRect(cx - 0.6, cy - 13, 1.2, 13);
      ctx.beginPath(); ctx.ellipse(cx, cy - 5, 4, 2, 0, 0, TAU); ctx.fillStyle = '#ffffff'; ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 9, cy - 12); ctx.quadraticCurveTo(cx, cy - 21, cx + 9, cy - 12); ctx.closePath(); ctx.fillStyle = aw[0]; ctx.fill();
      ctx.beginPath(); ctx.moveTo(cx - 3, cy - 12.5); ctx.quadraticCurveTo(cx, cy - 19, cx + 3, cy - 12.5); ctx.closePath(); ctx.fillStyle = aw[1]; ctx.fill();
    }
    person(ctx, 0.9, 1.55, '#e86a8a'); person(ctx, 1.45, 0.9, '#3d78c2', '#8a5a3c');
    return h + 6;
  },

  skishop(ctx, L, r) {
    const { w, d } = L;
    paved(ctx, w, d, '#dcd5c6');
    const wood = lp(L, r, WOOD, 0), aw = lp(L, r, AWNINGS, 1);
    const x0 = 0.35, x1 = 1.55, y0 = 0.4, y1 = 1.4, h = 16;
    box(ctx, x0, y0, x1, y1, 0, h, wood);
    faceL(ctx, x0, y1, 0, () => { ctx.fillStyle = '#ffe7a8'; ctx.fillRect(0.08, 1, 0.7, 9); door(ctx, 0.88, 0.2, 10.5, '#3a2a1e'); });
    faceR(ctx, x1, y0, 0, () => { ctx.fillStyle = '#ffe7a8'; ctx.fillRect(0.12, 1, 0.7, 9); });
    gable(ctx, x0, y0, x1, y1, h, 20, 'y', '#8a3a2a', wood, 0.1);
    textL(ctx, x0 + 0.15, y1, h - 3, 'SKI HIRE', 4.6, '#ffffff', x1 - x0 - 0.3);
    awningL(ctx, x0 + 0.04, x1 - 0.04, y1, 11.5, 0.2, aw);
    for (let i = 0; i < 5; i++) { const [a, b] = P(1.65, 0.6 + i * 0.15, 0); ctx.fillStyle = CARS[i]; ctx.fillRect(a - 0.7, b - 16, 1.4, 16); }
    person(ctx, 0.9, 1.7, '#d64b3c'); person(ctx, 1.25, 1.75, '#3d78c2', '#c68a5b');
    return h + 20;
  },

  beachbar(ctx, L, r) {
    flat(ctx, 0, 0, L.w, L.d, 0, '#f3e2a9');
    const thatch = '#d9b46a';
    box(ctx, 0.4, 0.4, 1.4, 1.2, 0, 12, '#a8784a');
    faceL(ctx, 0.4, 1.2, 0, () => { ctx.fillStyle = '#6a4a32'; ctx.fillRect(0, 6, 1, 1.6); ctx.fillStyle = '#ffe7a8'; ctx.fillRect(0.1, 8, 0.8, 3.5); });
    for (const [x, y] of [[0.4, 1.2], [1.4, 1.2], [1.4, 0.4]]) { const [a, b] = P(x, y, 12); ctx.fillStyle = '#7a5434'; ctx.fillRect(a - 0.8, b - 8, 1.6, 8); }
    hip(ctx, 0.3, 0.3, 1.5, 1.3, 20, 16, thatch, 0.1);
    ctx.strokeStyle = 'rgba(120,80,30,.35)'; ctx.lineWidth = 0.6;
    for (let t = 0; t < 1; t += 0.08) { path(ctx, [[lerp(0.2, 1.6, t), 1.4, 20], [lerp(0.6, 1.2, t), 0.8, 34]]); ctx.stroke(); }
    textL(ctx, 0.45, 1.2, 14.5, 'TIKI', 5, '#fff3b0', 0.9);
    for (let i = 0; i < 4; i++) { const [a, b] = P(0.5 + i * 0.25, 1.45, 0); ctx.fillStyle = '#7a5434'; ctx.fillRect(a - 0.5, b - 5, 1, 5); circle(ctx, a, b - 5.5, 2, '#d64b3c'); }
    umbrella(ctx, 1.7, 1.7, '#3d78c2');
    tree(ctx, 1.8, 0.3, 0.9, '#4f9a3f', 'palm');
    person(ctx, 0.9, 1.65, '#ffd34d', '#c68a5b');
    return 40;
  },

  retail(ctx, L, r) {
    const { w, d } = L;
    paved(ctx, w, d, '#dcd5c6', false);
    const alongX = w >= d;
    const wall = lp(L, r, ['#f2e6d0', '#e9d3b4', '#d6e3ea', '#efd7c9'], 0);
    const h = 18, shops = 4;
    if (alongX) {
      const x0 = 0.2, x1 = w - 0.2, y0 = 0.2, y1 = 1.0;
      box(ctx, x0, y0, x1, y1, 0, h, wall);
      const sw = (x1 - x0) / shops;
      faceL(ctx, x0, y1, 0, () => { for (let i = 0; i < shops; i++) { ctx.fillStyle = '#86c3e3'; ctx.fillRect(i * sw + 0.08, 1, sw - 0.32, 9.5); door(ctx, i * sw + sw - 0.22, 0.14, 10.5, '#5a3a22'); } });
      faceR(ctx, x1, y0, 0, () => { ctx.fillStyle = '#76b4d4'; ctx.fillRect(0.1, 1, 0.55, 9.5); });
      parapetRoof(ctx, x0, y0, x1, y1, h, wall);
      if (!(L.ups && L.ups.solar)) acUnits(ctx, x0, y0, x1, y1, h, r);
      for (let i = 0; i < shops; i++) awningL(ctx, x0 + i * sw + 0.04, x0 + (i + 1) * sw - 0.04, y1, 13, 0.22, AWNINGS[(i + Math.floor(r() * 6)) % AWNINGS.length]);
      parkingLot(ctx, 0.2, 1.3, w - 0.2, d - 0.1, true, r);
    } else {
      const x0 = 0.2, x1 = 1.0, y0 = 0.2, y1 = d - 0.2;
      box(ctx, x0, y0, x1, y1, 0, h, wall);
      const sw = (y1 - y0) / shops;
      faceR(ctx, x1, y0, 0, () => { for (let i = 0; i < shops; i++) { ctx.fillStyle = '#76b4d4'; ctx.fillRect(i * sw + 0.08, 1, sw - 0.32, 9.5); door(ctx, i * sw + sw - 0.22, 0.14, 10.5, '#5a3a22'); } });
      faceL(ctx, x0, y1, 0, () => { ctx.fillStyle = '#86c3e3'; ctx.fillRect(0.1, 1, 0.55, 9.5); });
      parapetRoof(ctx, x0, y0, x1, y1, h, wall);
      if (!(L.ups && L.ups.solar)) acUnits(ctx, x0, y0, x1, y1, h, r);
      for (let i = 0; i < shops; i++) awningR(ctx, x1, y0 + i * sw + 0.04, y0 + (i + 1) * sw - 0.04, 13, 0.22, AWNINGS[(i + Math.floor(r() * 6)) % AWNINGS.length]);
      parkingLot(ctx, 1.3, 0.2, w - 0.1, d - 0.2, false, r);
    }
    return h + 6;
  },

  office(ctx, L, r) {
    const { w, d } = L;
    paved(ctx, w, d, '#d6d1c6');
    const wall = lp(L, r, ['#e9e6df', '#d9d4ca', '#c9ced6', '#e3d6c3'], 0);
    const glass = lp(L, r, GLASS, 1);
    const floors = L.floors || 6, fh = 11, h = floors * fh;
    const x0 = 0.3, x1 = 1.7, y0 = 0.3, y1 = 1.7;
    box(ctx, x0, y0, x1, y1, 0, h, wall);
    const bands = (len) => {
      for (let f = 0; f < floors; f++) {
        ctx.fillStyle = glass; ctx.fillRect(0.05, f * fh + 3, len - 0.1, fh - 5);
        ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(0.05, f * fh + 3 + (fh - 5) * 0.5, len - 0.1, (fh - 5) * 0.5);
        ctx.fillStyle = 'rgba(0,0,0,.1)'; for (let u = 0.2; u < len; u += 0.2) ctx.fillRect(u, f * fh + 3, 0.01, fh - 5);
      }
    };
    faceL(ctx, x0, y1, 0, () => bands(x1 - x0));
    faceR(ctx, x1, y0, 0, () => bands(y1 - y0));
    parapetRoof(ctx, x0, y0, x1, y1, h, wall);
    if (!(L.ups && (L.ups.rooftop || L.ups.solar))) acUnits(ctx, x0, y0, x1, y1, h, r);
    box(ctx, 0.75, 1.7, 1.25, 1.95, 0, 9, '#5f6b7a', { top: '#7a8594' });
    tree(ctx, 0.15, 1.85, 0.6, pick(r, treeCols(L)), treeKind(L, r)); tree(ctx, 1.85, 0.2, 0.6, pick(r, treeCols(L)), treeKind(L, r));
    person(ctx, 1.4, 1.9, '#2b2d3a');
    return h + 8;
  },

  hotel(ctx, L, r) {
    const { w, d } = L;
    paved(ctx, w, d, '#e1d7c4');
    const wall = lp(L, r, ['#f2dcc0', '#e8c7a8', '#f6efe2', '#e7d3e0'], 0);
    const accent = lp(L, r, ['#b23a48', '#2f7d6d', '#3f527d', '#c9822e'], 1);
    const floors = L.floors || 12, fh = 10, h = floors * fh;
    const x0 = 0.4, x1 = 1.6, y0 = 0.4, y1 = 1.6;
    box(ctx, x0, y0, x1, y1, 0, h, wall);
    faceL(ctx, x0, y1, 0, () => { windows(ctx, 1.2, floors - 1, fh, fh, 3.4, '#8cc7e6'); ctx.fillStyle = accent; ctx.fillRect(0.5, fh, 0.2, h - fh); ctx.fillStyle = '#86c3e3'; ctx.fillRect(0.05, 1, 1.1, 7.5); });
    faceR(ctx, x1, y0, 0, () => windows(ctx, 1.2, floors - 1, fh, fh, 3, '#8cc7e6'));
    parapetRoof(ctx, x0, y0, x1, y1, h, wall);
    const keep = LAST_ROOF;
    box(ctx, x0 + 0.15, y1 - 0.12, x1 - 0.15, y1 - 0.05, h, 11, accent, { snowTop: false });
    LAST_ROOF = keep;
    textL(ctx, x0 + 0.15, y1 - 0.05, h + 2.3, 'HOTEL', 7.5, '#ffffff', x1 - x0 - 0.3);
    box(ctx, 0.75, 1.6, 1.25, 1.95, 7, 2, accent, { snowTop: false });
    for (const px of [0.78, 1.22]) box(ctx, px - 0.02, 1.91, px + 0.02, 1.95, 0, 7, '#e8e2d4');
    const pk = treeKind(L, r) === 'pine' ? 'pine' : 'palm';
    tree(ctx, 0.15, 1.85, 0.6, '#4f9a3f', pk); tree(ctx, 1.85, 0.2, 0.6, '#4f9a3f', pk);
    return h + 13;
  },

  officetower(ctx, L, r) {
    const { w, d } = L;
    paved(ctx, w, d, '#d3d0c8');
    const glass = lp(L, r, ['#5f9fc7', '#4f86a8', '#6aa9b8', '#7e93b0', '#4a7a8c', '#c9a46a'], 0);
    const floors = L.floors || 26, fh = 10, h = floors * fh;
    const x0 = 0.38, x1 = 1.62, y0 = 0.38, y1 = 1.62;
    box(ctx, x0, y0, x1, y1, 0, h, glass, { right: shade(glass, -0.22), top: shade(glass, 0.3) });
    const skin = (len, dark) => {
      const g = ctx.createLinearGradient(0, 0, 0, h);
      g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(1, dark ? 'rgba(255,255,255,.12)' : 'rgba(255,255,255,.3)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, len, h);
      ctx.fillStyle = 'rgba(20,40,60,.18)';
      for (let f = 1; f < floors; f++) ctx.fillRect(0, f * fh - 0.5, len, 1);
      ctx.fillStyle = 'rgba(255,255,255,.25)';
      for (let u = 0.155; u < len; u += 0.155) ctx.fillRect(u, 0, 0.012, h);
      ctx.fillStyle = 'rgba(255,255,255,.18)'; ctx.fillRect(len * 0.1, h * 0.35, len * 0.25, h * 0.6);
    };
    faceL(ctx, x0, y1, 0, () => skin(x1 - x0, false));
    faceR(ctx, x1, y0, 0, () => skin(y1 - y0, true));
    const cx0 = 0.58, cx1 = 1.42;
    const crown = L.lux >= 3 ? '#d9a21c' : shade(glass, -0.1);
    box(ctx, cx0, cx0, cx1, cx1, h, 16, crown, { top: L.lux >= 3 ? '#ffe08a' : '#d9dde3' });
    LAST_ROOF = [[cx0, cx1, h + 16], [cx1, cx1, h + 16], [cx1, cx0, h + 16], [cx0, cx0, h + 16]]; LAST_ROOF.flat = true;
    if (L.lux >= 3 && !(L.ups && (L.ups.rooftop || L.ups.solar))) {
      ctx.save(); ctx.translate(0, -(h + 16)); pyramid(ctx, cx0, cx0, cx1, cx1, 34, '#e7b52c', 0); ctx.restore();
    } else {
      box(ctx, 0.88, 0.88, 1.12, 1.12, h + 16, 8, '#c9ccd2');
      const [ax, ay] = P(1.0, 1.0, h + 24);
      ctx.strokeStyle = '#8a8f99'; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(ax, ay); ctx.lineTo(ax, ay - 26); ctx.stroke();
      circle(ctx, ax, ay - 27, 2, '#f04a3c');
    }
    box(ctx, 0.7, 1.62, 1.3, 1.92, 0, 8, '#4a4f5a', { top: '#6c717a' });
    tree(ctx, 0.15, 1.85, 0.6, pick(r, treeCols(L)), treeKind(L, r)); tree(ctx, 1.85, 0.2, 0.6, pick(r, treeCols(L)), treeKind(L, r));
    person(ctx, 1.5, 1.85, '#2b2d3a'); person(ctx, 0.5, 1.9, '#b23a48', '#8a5a3c');
    return h + 50;
  },

  mall(ctx, L, r) {
    const { w, d } = L;
    paved(ctx, w, d, '#cfc9bb', false);
    const wall = lp(L, r, ['#efe6d6', '#e3d6c3', '#dfe5ea'], 0);
    const accent = lp(L, r, ['#d64b3c', '#2f7d6d', '#3f527d', '#e0a43a'], 1);
    parkingLot(ctx, 0.25, 2.75, w - 0.25, d - 0.15, true, r, 0.7);
    const x0 = 0.35, x1 = w - 0.35, y0 = 0.3, y1 = 2.5, h = 26;
    box(ctx, x0, y0, x1, y1, 0, h, wall);
    faceL(ctx, x0, y1, 0, () => { ctx.fillStyle = accent; ctx.fillRect(0, h - 5, x1 - x0, 5); ctx.fillStyle = '#86c3e3'; ctx.fillRect(0.2, 1, 0.7, 10); ctx.fillRect(2.4, 1, 0.7, 10); });
    faceR(ctx, x1, y0, 0, () => { ctx.fillStyle = accent; ctx.fillRect(0, h - 5, y1 - y0, 5); ctx.fillStyle = '#76b4d4'; ctx.fillRect(0.3, 1, 1.4, 9); });
    parapetRoof(ctx, x0, y0, x1, y1, h, wall);
    const keep = LAST_ROOF;
    if (!(L.ups && L.ups.solar)) for (let i = 0; i < 3; i++) { const sx = 0.8 + i * 0.95; face(ctx, [[sx, 0.8, h], [sx + 0.5, 0.8, h], [sx + 0.5, 1.9, h + 6], [sx, 1.9, h + 6]], '#a9d4ea'); }
    acUnits(ctx, x0, y0, x1, 0.8, h, r);
    box(ctx, 1.45, 2.5, 2.55, 2.72, 0, 20, '#86c3e3', { top: accent, snowTop: false });
    LAST_ROOF = keep;
    textL(ctx, 1.45, 2.72, 13, 'CENTRO MALL', 5.5, '#ffffff', 1.1);
    tree(ctx, 0.2, 2.65, 0.6, pick(r, treeCols(L)), treeKind(L, r)); tree(ctx, w - 0.2, 2.6, 0.6, pick(r, treeCols(L)), treeKind(L, r));
    return h + 22;
  },

  resort(ctx, L, r) {
    const { w, d } = L;
    flat(ctx, 0, 0, w, d, 0, '#f3e2a9');
    flat(ctx, 0.1, 0.1, w - 0.1, 2.2, 0, lawnFor(L));
    const wall = lp(L, r, ['#fff4d6', '#f7c6b5', '#9fdce0', '#f6f1e7'], 0), roof = lp(L, r, ['#d9b46a', '#e86a8a', '#3f8a8a'], 1);
    box(ctx, 0.4, 0.3, 2.6, 1.3, 0, 26, wall);
    faceL(ctx, 0.4, 1.3, 0, () => windows(ctx, 2.2, 2, 13, 0, 4, '#7fd0e8', { tall: 0.6 }));
    faceR(ctx, 2.6, 0.3, 0, () => windows(ctx, 1.0, 2, 13, 0, 3, '#7fd0e8', { tall: 0.6 }));
    hip(ctx, 0.35, 0.25, 2.65, 1.35, 26, 18, roof);
    const keep = LAST_ROOF;
    for (const [bx, by] of [[3.0, 0.3], [3.0, 1.2], [3.0, 2.1]]) { box(ctx, bx, by, bx + 0.7, by + 0.6, 0, 11, wall); hip(ctx, bx - 0.05, by - 0.05, bx + 0.75, by + 0.65, 11, 11, '#d9b46a'); }
    LAST_ROOF = keep;
    const [px, py] = P(1.4, 1.95, 0);
    ctx.fillStyle = '#eef0ea'; ctx.beginPath(); ctx.ellipse(px, py, 56, 20, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#4fc3e6'; ctx.beginPath(); ctx.ellipse(px, py, 52, 17, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#8ad8f0'; ctx.beginPath(); ctx.ellipse(px - 10, py - 4, 26, 7, 0, 0, TAU); ctx.fill();
    for (let i = 0; i < 6; i++) { const [a, b] = P(0.4 + i * 0.5, 2.85, 0); ctx.fillStyle = '#ffffff'; ctx.fillRect(a - 4, b - 2, 8, 2); umbrella(ctx, 0.45 + i * 0.5, 2.9, i % 2 ? '#e86a8a' : '#ffd34d'); }
    for (const [tx, ty] of [[0.2, 2.4], [2.7, 2.5], [3.8, 3.4], [0.5, 3.6], [2.0, 3.7]]) tree(ctx, tx, ty, 1, '#4f9a3f', 'palm');
    person(ctx, 1.9, 2.5, '#e86a8a', '#c68a5b'); person(ctx, 1.0, 2.6, '#ffd34d');
    return 26 + 18;
  },

  skilodge(ctx, L, r) {
    const { w, d } = L;
    lawn(ctx, w, d, lawnFor(L));
    const wood = lp(L, r, WOOD, 0), roof = lp(L, r, ['#5a3a2a', '#3f527d', '#8a3a2a'], 1);
    for (const [tx, ty] of [[0.3, 0.3], [3.7, 0.4], [0.3, 3.6], [3.7, 3.7]]) tree(ctx, tx, ty, 1.1, '#3f7a4a', 'pine');
    box(ctx, 0.5, 0.6, 1.6, 2.4, 0, 6, '#9a958c'); box(ctx, 0.5, 0.6, 1.6, 2.4, 6, 18, wood);
    faceL(ctx, 0.5, 2.4, 6, () => windows(ctx, 1.1, 1, 18, 0, 3, '#ffe7a8'));
    gable(ctx, 0.5, 0.6, 1.6, 2.4, 24, 26, 'x', roof, wood, 0.1);
    box(ctx, 1.6, 0.8, 3.4, 2.0, 0, 6, '#9a958c'); box(ctx, 1.6, 0.8, 3.4, 2.0, 6, 24, wood);
    faceL(ctx, 1.6, 2.0, 6, () => { windows(ctx, 1.8, 2, 12, 0, 4, '#ffe7a8'); });
    faceR(ctx, 3.4, 0.8, 6, () => windows(ctx, 1.2, 2, 12, 0, 3, '#ffe7a8'));
    gable(ctx, 1.6, 0.8, 3.4, 2.0, 30, 30, 'y', roof, wood, 0.12);
    const mainRoof = LAST_ROOF;
    box(ctx, 2.8, 1.0, 2.98, 1.18, 30, 30, '#8f877c'); smokeAt(2.89, 1.09, 62);
    LAST_ROOF = mainRoof;
    flat(ctx, 1.5, 2.1, 3.5, 3.0, 0, '#c9a26a');
    for (let i = 0; i < 4; i++) { const [a, b] = P(1.8 + i * 0.45, 2.6, 0); ctx.fillStyle = '#5a5a60'; ctx.beginPath(); ctx.ellipse(a, b - 3, 5, 2.5, 0, 0, TAU); ctx.fill(); }
    const [fx, fy] = P(2.6, 2.75, 0); circle(ctx, fx, fy - 4, 3, '#ff8a3d'); circle(ctx, fx, fy - 7, 2, '#ffd34d');
    for (let i = 0; i < 6; i++) person(ctx, 1.7 + (i % 3) * 0.6, 3.1 + (i > 2 ? 0.4 : 0), CARS[i]);
    return 60;
  },

  warehouse(ctx, L, r) {
    const { w, d } = L;
    paved(ctx, w, d, '#cfc9bb', false);
    const wall = lp(L, r, ['#b9c3cc', '#c8b79a', '#a9b7a0', '#c98f6a', '#9fb2c4'], 0);
    const x0 = 0.22, x1 = w - 0.22, y0 = 0.22, y1 = d - 0.5, h = 22;
    box(ctx, x0, y0, x1, y1, 0, h, wall);
    const corr = (len) => { ctx.fillStyle = 'rgba(0,0,0,.09)'; for (let u = 0.06; u < len; u += 0.09) ctx.fillRect(u, 0, 0.02, h); };
    faceL(ctx, x0, y1, 0, () => {
      corr(x1 - x0);
      const n = Math.max(2, Math.round((x1 - x0) * 1.3));
      for (let i = 0; i < n; i++) { const u = (i + 0.2) * ((x1 - x0) / n); ctx.fillStyle = '#e4e0d6'; ctx.fillRect(u, 0, 0.42, 12); ctx.fillStyle = 'rgba(0,0,0,.1)'; for (let v = 2; v < 12; v += 2) ctx.fillRect(u, v, 0.42, 0.5); }
    });
    faceR(ctx, x1, y0, 0, () => corr(y1 - y0));
    const alongX = (x1 - x0) >= (y1 - y0);
    flat(ctx, x0, y0, x1, y1, h, shade(wall, -0.1), true);
    LAST_ROOF = [[x0, y1, h], [x1, y1, h], [x1, y0, h], [x0, y0, h]]; LAST_ROOF.flat = true;
    if (!(L.ups && L.ups.solar)) {
      if (alongX) {
        for (let x = x0 + 0.05; x < x1 - 0.3; x += 0.42) {
          face(ctx, [[x, y0 + 0.05, h], [x, y1 - 0.05, h], [x + 0.3, y1 - 0.05, h + 7], [x + 0.3, y0 + 0.05, h + 7]], shade(wall, 0.05));
          face(ctx, [[x + 0.3, y0 + 0.05, h], [x + 0.3, y1 - 0.05, h], [x + 0.3, y1 - 0.05, h + 7], [x + 0.3, y0 + 0.05, h + 7]], '#a9d4ea');
        }
      } else {
        for (let y = y0 + 0.05; y < y1 - 0.3; y += 0.42) {
          face(ctx, [[x0 + 0.05, y, h], [x1 - 0.05, y, h], [x1 - 0.05, y + 0.3, h + 7], [x0 + 0.05, y + 0.3, h + 7]], shade(wall, 0.05));
          face(ctx, [[x0 + 0.05, y + 0.3, h], [x1 - 0.05, y + 0.3, h], [x1 - 0.05, y + 0.3, h + 7], [x0 + 0.05, y + 0.3, h + 7]], '#a9d4ea');
        }
      }
    }
    const tx = lerp(x0 + 0.3, x1 - 0.8, r());
    box(ctx, tx, d - 0.4, tx + 0.55, d - 0.18, 0.5, 9, '#f6f1e7', { snowTop: false });
    box(ctx, tx + 0.55, d - 0.38, tx + 0.72, d - 0.2, 0.5, 7, pick(r, ['#d64b3c', '#3d78c2', '#e0a43a']), { snowTop: false });
    return h + 9;
  },

  factory(ctx, L, r) {
    const { w, d } = L;
    paved(ctx, w, d, '#c4beb2', false);
    const brick = lp(L, r, BRICKS.concat(['#8f9aa6']), 0);
    const x0 = 0.25, x1 = w - 0.25, y0 = 0.25, y1 = d - 0.35, h = 26;
    box(ctx, x0, y0, x1, y1, 0, h, brick);
    const win = (len) => { ctx.fillStyle = '#a9c4d6'; const n = Math.round(len * 3); for (let i = 0; i < n; i++) ctx.fillRect((i + 0.2) * len / n, 10, len / n * 0.6, 10); ctx.fillStyle = 'rgba(0,0,0,.15)'; for (let i = 0; i < n; i++) ctx.fillRect((i + 0.2) * len / n, 15, len / n * 0.6, 0.6); };
    faceL(ctx, x0, y1, 0, () => { win(x1 - x0); ctx.fillStyle = '#5f6b7a'; ctx.fillRect(0.2, 0, 0.5, 9); });
    faceR(ctx, x1, y0, 0, () => win(y1 - y0));
    flat(ctx, x0, y0, x1, y1, h, '#7a7f88', true);
    LAST_ROOF = [[x0, y1, h], [x1, y1, h], [x1, y0, h], [x0, y0, h]]; LAST_ROOF.flat = true;
    const alongX = (x1 - x0) >= (y1 - y0);
    if (!(L.ups && L.ups.solar)) {
      if (alongX) for (let x = x0 + 0.05; x < x1 - 0.3; x += 0.45) face(ctx, [[x, y0 + 0.05, h], [x, y1 - 0.05, h], [x + 0.3, y1 - 0.05, h + 8], [x + 0.3, y0 + 0.05, h + 8]], '#9aa0aa');
      else for (let y = y0 + 0.05; y < y1 - 0.3; y += 0.45) face(ctx, [[x0 + 0.05, y, h], [x1 - 0.05, y, h], [x1 - 0.05, y + 0.3, h + 8], [x0 + 0.05, y + 0.3, h + 8]], '#9aa0aa');
    }
    const sx = x0 + 0.35, sy = y0 + 0.3;
    cyl(ctx, sx, sy, h, 0.12, 60, '#b8664f');
    for (let k = 0; k < 2; k++) { const [a, b] = P(sx, sy, h + 46 + k * 7); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(a, b, 0.12 * HW * R2, 0.12 * HH * R2 + 1, 0, 0, Math.PI); ctx.fill(); }
    smokeAt(sx, sy, h + 62);
    if (w * d > 8) { cyl(ctx, sx + 0.5, sy, h, 0.1, 48, '#8f9aa6'); smokeAt(sx + 0.5, sy, h + 50); }
    box(ctx, w - 0.9, d - 0.3, w - 0.3, d - 0.08, 0.5, 9, '#f6f1e7', { snowTop: false });
    return h + 70;
  },

  containeryard(ctx, L, r) {
    const { w, d } = L;
    paved(ctx, w, d, '#bdb7aa', false);
    const cols = ['#d64b3c', '#3d78c2', '#f0c23a', '#3e9b6a', '#e07a3a', '#8d5fbf', '#2f7d6d'];
    for (let row = 0; row < 3; row++) for (let i = 0; i < 4; i++) {
      const x0 = 0.3 + i * 0.85, y0 = 0.4 + row * 1.15;
      const stack = 1 + Math.floor(r() * 3);
      for (let s = 0; s < stack; s++) {
        box(ctx, x0, y0, x0 + 0.75, y0 + 0.32, s * 8, 8, pick(r, cols));
        faceL(ctx, x0, y0 + 0.32, s * 8, () => { ctx.fillStyle = 'rgba(0,0,0,.14)'; for (let u = 0.05; u < 0.75; u += 0.07) ctx.fillRect(u, 0, 0.012, 8); });
      }
    }
    const gx0 = 0.2, gx1 = w - 0.2, gy = d - 0.35, gh = 60;
    for (const x of [gx0, gx1]) { const [a, b] = P(x, gy, 0); ctx.fillStyle = '#e0a43a'; ctx.fillRect(a - 1.5, b - gh, 3, gh); }
    box(ctx, gx0, gy - 0.08, gx1, gy + 0.08, gh, 5, '#f0c23a');
    const [ha, hb] = P(1.6, gy, gh); ctx.strokeStyle = '#3b3b44'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(ha, hb); ctx.lineTo(ha, hb + 30); ctx.stroke();
    box(ctx, 1.4, gy - 0.12, 1.8, gy + 0.05, gh - 34, 4, '#3d78c2');
    return gh + 10;
  },

  farm(ctx, L, r) {
    const crop = lp(L, r, ['#e2c25a', '#8cc35a', '#d9a843'], 0);
    flat(ctx, 0, 0, L.w, L.d, 0, '#b5cf6e');
    flat(ctx, 0.2, 2.2, 3.8, 3.8, 0, shade(crop, -0.12));
    ctx.strokeStyle = shade(crop, 0.18); ctx.lineWidth = 1.6;
    for (let y = 2.3; y < 3.8; y += 0.16) { path(ctx, [[0.25, y, 0], [3.75, y, 0]]); ctx.stroke(); }
    const wall = lp(L, r, ['#f6f1e7', '#f1dc9a', '#cfe0ea'], 1);
    box(ctx, 0.3, 0.35, 1.3, 1.2, 0, 22, wall);
    faceL(ctx, 0.3, 1.2, 0, () => { windows(ctx, 1, 2, 11, 0, 3, '#9fd3ef'); door(ctx, 0.42, 0.16, 9); });
    faceR(ctx, 1.3, 0.35, 0, () => windows(ctx, 0.85, 2, 11, 0, 2, '#9fd3ef'));
    gable(ctx, 0.3, 0.35, 1.3, 1.2, 22, 14, 'x', '#5f6b7a', wall);
    const keep = LAST_ROOF;
    box(ctx, 0.3, 1.2, 1.3, 1.45, 0, 1, '#d9c39a');
    for (let t = 0.35; t <= 1.3; t += 0.24) { const [a, b] = P(t, 1.43, 0); ctx.fillStyle = '#fff'; ctx.fillRect(a - 0.5, b - 10, 1, 10); }
    box(ctx, 1.8, 0.3, 3.1, 1.4, 0, 18, '#c0392b');
    faceL(ctx, 1.8, 1.4, 0, () => { ctx.fillStyle = '#ffffff'; ctx.fillRect(0.45, 0, 0.4, 13); ctx.fillStyle = '#c0392b'; ctx.fillRect(0.48, 0.5, 0.34, 12); });
    gable(ctx, 1.8, 0.3, 3.1, 1.4, 18, 16, 'y', '#5a3a2a', '#c0392b');
    LAST_ROOF = keep;
    cyl(ctx, 3.45, 0.55, 0, 0.22, 44, '#cfd3da', '#b9bec7');
    const [dx, dy] = P(3.45, 0.55, 44); ctx.fillStyle = '#b9bec7'; ctx.beginPath(); ctx.ellipse(dx, dy, 0.22 * HW * R2, 9, 0, Math.PI, 0); ctx.fill();
    const [mx, my] = P(0.4, 1.85, 0);
    ctx.fillStyle = '#9a958c'; ctx.beginPath(); ctx.moveTo(mx - 3, my); ctx.lineTo(mx + 3, my); ctx.lineTo(mx + 1, my - 36); ctx.lineTo(mx - 1, my - 36); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = '#f6f1e7'; ctx.lineWidth = 1.6;
    for (let k = 0; k < 6; k++) { const a = k * TAU / 6 + 0.3; ctx.beginPath(); ctx.moveTo(mx, my - 36); ctx.lineTo(mx + Math.cos(a) * 11, my - 36 + Math.sin(a) * 11); ctx.stroke(); }
    for (let i = 0; i < 4; i++) {
      const [cx, cy] = P(1.9 + r() * 1.6, 1.6 + r() * 0.45, 0);
      ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(cx, cy - 3, 4, 2.4, 0, 0, TAU); ctx.fill();
      ctx.fillStyle = '#2b2420'; ctx.beginPath(); ctx.ellipse(cx - 1, cy - 3.5, 1.4, 1, 0, 0, TAU); ctx.fill();
      circle(ctx, cx + 4, cy - 4, 1.5, '#f6e0d6');
    }
    picket(ctx, 1.75, 2.1, 3.9, 2.1, '#c9b08a');
    return 50;
  },

  field(ctx, L, r) {
    const { w, d } = L;
    const crop = lp(L, r, ['#e8c95e', '#d9b048', '#9ccf5a', '#e2a84a'], 0);
    flat(ctx, 0, 0, w, d, 0, shade(crop, -0.08));
    ctx.strokeStyle = shade(crop, 0.2); ctx.lineWidth = 1.8;
    const alongX = r() < 0.5;
    for (let t = 0.12; t < 4; t += 0.2) { if (alongX) path(ctx, [[0.05, t, 0], [w - 0.05, t, 0]]); else path(ctx, [[t, 0.05, 0], [t, d - 0.05, 0]]); ctx.stroke(); }
    const bales = [];
    for (let i = 0; i < 5; i++) bales.push([0.5 + r() * 3, 0.5 + r() * 3]);
    bales.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    for (const [x, y] of bales) cyl(ctx, x, y, 0, 0.1, 6, '#e8c46a', '#d9b048');
    const tx = 0.6 + r() * 2.5, ty = 0.6 + r() * 2.5;
    box(ctx, tx, ty, tx + 0.3, ty + 0.2, 2, 6, '#3e9b4f'); box(ctx, tx + 0.05, ty + 0.03, tx + 0.18, ty + 0.17, 8, 6, '#bfe2f2', { top: '#3e9b4f' });
    const [wx_, wy_] = P(tx, ty + 0.2, 0); circle(ctx, wx_ + 2, wy_ - 3, 3, '#2b2420');
    const [sx, sy] = P(3.4, 3.3, 0); ctx.fillStyle = '#7a5434'; ctx.fillRect(sx - 0.6, sy - 16, 1.2, 16); ctx.fillRect(sx - 6, sy - 12, 12, 1.2); circle(ctx, sx, sy - 17, 2.6, '#e8c46a'); ctx.fillStyle = '#d64b3c'; ctx.fillRect(sx - 3, sy - 12, 6, 6);
    return 24;
  },

  vineyard(ctx, L, r) {
    flat(ctx, 0, 0, L.w, L.d, 0, '#c9b08a');
    for (let y = 0.25; y < 2.6; y += 0.28) {
      for (let x = 0.2; x < 3.8; x += 0.18) { const [a, b] = P(x, y, 0); circle(ctx, a, b - 3.5, 2.6, '#5a8f3a'); if (r() < 0.35) circle(ctx, a + 1, b - 2.4, 1, '#6b2a5a'); }
    }
    const wall = lp(L, r, ['#e8d9bd', '#f1e6d6', '#d9c3a3'], 0);
    box(ctx, 0.5, 2.8, 2.2, 3.7, 0, 16, wall);
    faceL(ctx, 0.5, 3.7, 0, () => { windows(ctx, 1.7, 1, 16, 0, 3, '#9fd3ef'); door(ctx, 0.75, 0.25, 11, '#5a3a22'); });
    hip(ctx, 0.45, 2.75, 2.25, 3.75, 16, 12, '#c9542f');
    textL(ctx, 0.6, 3.7, 13, 'WINERY', 4.6, '#7a3b1c', 1.5);
    for (let i = 0; i < 4; i++) { const [a, b] = P(2.6 + i * 0.25, 3.5, 0); ctx.fillStyle = '#8a5a34'; ctx.beginPath(); ctx.ellipse(a, b - 3, 3, 3.6, 0, 0, TAU); ctx.fill(); ctx.strokeStyle = '#3b2412'; ctx.lineWidth = 0.6; ctx.stroke(); }
    tree(ctx, 3.6, 3.0, 0.9, '#4f9a3f', 'round');
    return 30;
  },

  orchard(ctx, L, r) {
    flat(ctx, 0, 0, L.w, L.d, 0, '#9ccf5a');
    const fruit = lp(L, r, ['#d64b3c', '#f08a24', '#f0c23a', '#e86a8a'], 0);
    const pts = [];
    for (let y = 0.4; y < 3.8; y += 0.55) for (let x = 0.4; x < 3.8; x += 0.55) if (!(x > 2.8 && y > 2.8)) pts.push([x, y]);
    pts.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    for (const [x, y] of pts) {
      tree(ctx, x, y, 0.7, '#4f9a3f', 'round');
      const [a, b] = P(x, y, 0);
      for (let k = 0; k < 4; k++) circle(ctx, a + (r() - 0.5) * 9, b - 12 - r() * 8, 1.2, fruit);
    }
    box(ctx, 3.0, 3.0, 3.7, 3.6, 0, 12, '#a8784a'); gable(ctx, 3.0, 3.0, 3.7, 3.6, 12, 9, 'x', '#6b4424', '#a8784a');
    for (let i = 0; i < 3; i++) box(ctx, 2.6 + i * 0.12, 3.75, 2.7 + i * 0.12, 3.85, 0, 3, '#c98a4b', { top: fruit });
    return 30;
  },

  park(ctx, L, r) {
    const { w, d } = L;
    lawn(ctx, w, d, shade(lawnFor(L), 0.06), false);
    ctx.strokeStyle = SNOW ? '#d9e3ea' : '#e8dcc0'; ctx.lineWidth = 5; ctx.lineCap = 'round';
    path(ctx, [[0, d / 2, 0], [w, d / 2, 0]]); ctx.stroke();
    path(ctx, [[w / 2, 0, 0], [w / 2, d, 0]]); ctx.stroke();
    const [cx, cy] = P(w / 2, d / 2, 0);
    ctx.beginPath(); ctx.ellipse(cx, cy, 1.1 * HW * R2, 1.1 * HH * R2, 0, 0, TAU); ctx.stroke();
    ellipse(ctx, 1.0, 1.0, 0, 0.62, '#d9cfa8');
    ellipse(ctx, 1.0, 1.0, 0, 0.55, '#5fb3d9');
    ellipse(ctx, 0.92, 0.9, 0, 0.3, '#7cc7e6');
    const [dx, dy] = P(1.1, 1.15, 0); circle(ctx, dx, dy - 1, 1.6, '#ffffff'); circle(ctx, dx + 3, dy + 1, 1.4, '#ffd34d');
    box(ctx, 2.8, 2.7, 3.2, 2.8, 0, 8, '#d64b3c'); box(ctx, 3.2, 2.7, 3.3, 3.2, 0, 12, '#3d78c2');
    face(ctx, [[2.75, 2.8, 8], [3.15, 2.8, 8], [3.15, 3.25, 0], [2.75, 3.25, 0]], '#f0c23a');
    const spots = [];
    for (let i = 0; i < 11; i++) {
      const tx = 0.2 + r() * (w - 0.4), ty = 0.2 + r() * (d - 0.4);
      if (Math.abs(tx - w / 2) < 0.25 || Math.abs(ty - d / 2) < 0.25 || Math.hypot(tx - 1, ty - 1) < 0.75) continue;
      if (tx > 2.6 && ty > 2.5) continue;
      spots.push([tx, ty]);
    }
    spots.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    for (const [tx, ty] of spots) tree(ctx, tx, ty, 0.8 + r() * 0.35, pick(r, treeCols(L)), treeKind(L, r));
    box(ctx, 2.3, 1.75, 2.6, 1.82, 0, 2.5, '#8a5a3c'); box(ctx, 1.3, 2.3, 1.37, 2.6, 0, 2.5, '#8a5a3c');
    person(ctx, 2.0, 2.2, '#e86a8a'); person(ctx, 2.15, 2.25, '#3d78c2', '#8a5a3c');
    return 30;
  },

  sportsfield(ctx, L, r) {
    const { w, d } = L;
    lawn(ctx, w, d, lawnFor(L), false);
    flat(ctx, 0.35, 0.75, w - 0.35, d - 0.25, 0, '#c4674a');
    flat(ctx, 0.55, 0.95, w - 0.55, d - 0.45, 0, '#6bb04c');
    ctx.fillStyle = 'rgba(255,255,255,.08)';
    for (let i = 0; i < 6; i++) { const x = 0.55 + i * 0.483; if (i % 2) { path(ctx, [[x, 0.95, 0], [x + 0.483, 0.95, 0], [x + 0.483, d - 0.45, 0], [x, d - 0.45, 0]]); ctx.fill(); } }
    ctx.strokeStyle = 'rgba(255,255,255,.85)'; ctx.lineWidth = 0.9;
    path(ctx, [[0.7, 1.1, 0], [w - 0.7, 1.1, 0], [w - 0.7, d - 0.6, 0], [0.7, d - 0.6, 0]]); ctx.stroke();
    path(ctx, [[w / 2, 1.1, 0], [w / 2, d - 0.6, 0]]); ctx.stroke();
    const [cx, cy] = P(w / 2, (1.1 + d - 0.6) / 2, 0);
    ctx.beginPath(); ctx.ellipse(cx, cy, 0.38 * HW * R2, 0.38 * HH * R2, 0, 0, TAU); ctx.stroke();
    for (const gx of [0.75, w - 0.75]) { const [a, b] = P(gx, 2.2, 0); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1.2; ctx.strokeRect(a - 4, b - 8, 8, 8); }
    for (let i = 0; i < 4; i++) box(ctx, 0.4, 0.1 + i * 0.12, w - 0.4, 0.22 + i * 0.12, 0, 12 - i * 3, i % 2 ? '#3d78c2' : '#f6f1e7');
    face(ctx, [[0.4, 0.05, 18], [w - 0.4, 0.05, 18], [w - 0.4, 0.55, 15], [0.4, 0.55, 15]], '#d64b3c');
    for (const fx of [0.15, w - 0.15]) { const [a, b] = P(fx, d - 0.15, 0); ctx.fillStyle = '#8a8f99'; ctx.fillRect(a - 0.8, b - 40, 1.6, 40); ctx.fillStyle = '#fff6c2'; ctx.fillRect(a - 4, b - 44, 8, 5); }
    const pl = [];
    for (let i = 0; i < 8; i++) pl.push([1 + r() * 2, 1.3 + r() * 1.8, i < 4 ? '#d64b3c' : '#3d78c2']);
    pl.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    for (const p of pl) person(ctx, p[0], p[1], p[2]);
    return 45;
  },

  plaza(ctx, L, r) {
    const { w, d } = L;
    paved(ctx, w, d, '#e4dccb');
    ctx.fillStyle = 'rgba(180,120,80,.15)';
    path(ctx, [[w / 2 - 0.15, 0, 0], [w / 2 + 0.15, 0, 0], [w / 2 + 0.15, d, 0], [w / 2 - 0.15, d, 0]]); ctx.fill();
    path(ctx, [[0, d / 2 - 0.15, 0], [w, d / 2 - 0.15, 0], [w, d / 2 + 0.15, 0], [0, d / 2 + 0.15, 0]]); ctx.fill();
    const s = w / 4;
    ellipse(ctx, w / 2, d / 2, 0, 0.62 * s * 1.3, '#cfc6b2', OUTLINE);
    ellipse(ctx, w / 2, d / 2, 2, 0.52 * s * 1.3, '#5fbde0');
    const [fx, fy] = P(w / 2, d / 2, 0);
    ctx.fillStyle = '#e8e2d4'; ctx.fillRect(fx - 2, fy - 14, 4, 14);
    circle(ctx, fx, fy - 15, 4, 'rgba(200,240,255,.85)');
    circle(ctx, fx, fy - 19, 2.5, 'rgba(230,250,255,.9)');
    const tp = w >= 4 ? [[0.5, 0.5], [3.5, 0.5], [0.5, 3.5], [3.5, 3.5], [0.5, 2], [3.5, 2]] : [[0.3, 0.3], [1.7, 1.7], [0.3, 1.7], [1.7, 0.3]];
    tp.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    for (const [tx, ty] of tp) { box(ctx, tx - 0.12, ty - 0.12, tx + 0.12, ty + 0.12, 0, 3, '#b9a98a'); tree(ctx, tx, ty, 0.75 * Math.min(1, s), pick(r, treeCols(L)), 'round'); }
    if (w >= 4) { const pl = []; for (let i = 0; i < 6; i++) pl.push([0.8 + r() * 2.4, 0.8 + r() * 2.4, pick(r, CARS), pick(r, ['#f0c9a4', '#8a5a3c', '#c68a5b'])]); pl.sort((a, b) => a[0] + a[1] - b[0] - b[1]); for (const p of pl) person(ctx, p[0], p[1], p[2], p[3]); }
    return 30;
  },

  mountain(ctx, L, r) {
    const { w, d } = L;
    flat(ctx, 0, 0, w, d, 0, '#e6eef4');
    const rock = pick(r, ['#8d97a6', '#7f8a99', '#94a0ad']);
    const peaks = [[0.2, 0.2, 2.6, 2.4, 120 + r() * 50], [1.6, 0.4, 3.9, 2.8, 90 + r() * 40], [0.4, 1.6, 2.8, 3.9, 80 + r() * 40], [1.4, 1.3, 3.8, 3.8, 150 + r() * 70]];
    let top = 0;
    for (const [a, b, c, e, h] of peaks) { pyramid(ctx, a, b, c, e, h, rock); top = Math.max(top, h); }
    const tr = [];
    for (let i = 0; i < 6; i++) { const t = r(); tr.push(t < 0.5 ? [0.15 + r() * 3.7, 3.85] : [3.85, 0.15 + r() * 3.7]); }
    tr.sort((a, b) => a[0] + a[1] - b[0] - b[1]);
    for (const [x, y] of tr) tree(ctx, x, y, 0.8, '#3f7a4a', 'pine');
    return top;
  },

  skislope(ctx, L, r) {
    flat(ctx, 0, 0, L.w, L.d, 0, '#eef4f8');
    pyramid(ctx, 0.1, 0.1, 3.0, 2.8, 110, '#dfe9f1', 1);
    face(ctx, [[0.6, 3.6, 0], [1.4, 3.8, 0], [1.6, 1.6, 85], [1.3, 1.5, 88]], '#cfe2f0', false);
    const [a, b] = P(3.4, 3.4, 0), [c, e] = P(1.5, 1.3, 104);
    ctx.strokeStyle = '#3b3b44'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(a, b - 16); ctx.lineTo(c, e - 16); ctx.stroke();
    for (let t = 0; t <= 1; t += 0.25) { const x = lerp(a, c, t), y = lerp(b, e, t); ctx.fillStyle = '#6a6f78'; ctx.fillRect(x - 0.8, y - 16, 1.6, 16); }
    for (let t = 0.1; t < 1; t += 0.14) { const x = lerp(a, c, t), y = lerp(b, e, t) - 16; ctx.fillStyle = CARS[Math.floor(t * 10) % CARS.length]; ctx.fillRect(x - 2, y + 2, 4, 3); }
    box(ctx, 3.2, 3.2, 3.8, 3.75, 0, 10, '#8a5a34');
    gable(ctx, 3.2, 3.2, 3.8, 3.75, 10, 8, 'x', '#8a3a2a', '#8a5a34');
    for (let i = 0; i < 5; i++) { const t = 0.2 + r() * 0.6; const [sx, sy] = P(lerp(0.8, 1.5, t), lerp(3.5, 1.7, t), lerp(0, 82, t)); circle(ctx, sx, sy - 3, 1.6, pick(r, CARS)); }
    for (let i = 0; i < 5; i++) tree(ctx, 3.85, 0.3 + i * 0.6, 0.8, '#3f7a4a', 'pine');
    return 130;
  },

  powerplant(ctx, L, r) {
    const { w, d } = L;
    paved(ctx, w, d, '#bdb7aa', false);
    box(ctx, 0.3, 0.3, 2.0, 1.6, 0, 30, '#b9c3cc');
    faceL(ctx, 0.3, 1.6, 0, () => { ctx.fillStyle = 'rgba(0,0,0,.1)'; for (let u = 0.1; u < 1.7; u += 0.1) ctx.fillRect(u, 0, 0.02, 30); });
    flat(ctx, 0.3, 0.3, 2.0, 1.6, 30, '#8f9aa6', true);
    for (const [x, y] of [[2.9, 1.0], [2.9, 2.6]]) {
      const [cx, cy] = P(x, y, 0);
      const rx = 0.55 * HW * R2, ry = 0.55 * HH * R2, h = 80;
      ctx.fillStyle = '#d9dde3';
      ctx.beginPath(); ctx.moveTo(cx - rx, cy); ctx.quadraticCurveTo(cx - rx * 0.55, cy - h * 0.6, cx - rx * 0.7, cy - h); ctx.lineTo(cx + rx * 0.7, cy - h); ctx.quadraticCurveTo(cx + rx * 0.55, cy - h * 0.6, cx + rx, cy); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = OUTLINE; ctx.lineWidth = LW; ctx.stroke();
      ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(cx + rx * 0.1, cy - h, rx * 0.6, h);
      ctx.beginPath(); ctx.ellipse(cx, cy - h, rx * 0.7, ry * 0.7, 0, 0, TAU); ctx.fillStyle = '#8f9aa6'; ctx.fill();
      smokeAt(x, y, h + 4);
    }
    cyl(ctx, 0.8, 2.6, 0, 0.12, 70, '#d64b3c'); smokeAt(0.8, 2.6, 72);
    for (let i = 0; i < 3; i++) { const [a, b] = P(1.2 + i * 0.5, 3.5, 0); ctx.fillStyle = '#6a6f78'; ctx.fillRect(a - 0.6, b - 30, 1.2, 30); ctx.fillRect(a - 5, b - 28, 10, 1); }
    return 90;
  },

  golf(ctx, L, r) {
    flat(ctx, 0, 0, L.w, L.d, 0, '#6fb84a');
    ctx.fillStyle = '#8ad05e';
    const [a, b] = P(1.2, 1.5, 0); ctx.beginPath(); ctx.ellipse(a, b, 70, 26, -0.5, 0, TAU); ctx.fill();
    ellipse(ctx, 3.0, 3.0, 0, 0.45, '#9fe070');
    ellipse(ctx, 2.2, 1.0, 0, 0.3, '#f3e2a9'); ellipse(ctx, 0.8, 2.9, 0, 0.25, '#f3e2a9');
    ellipse(ctx, 2.6, 2.0, 0, 0.35, '#5fb3d9');
    const [fx, fy] = P(3.0, 3.0, 0); ctx.fillStyle = '#ffffff'; ctx.fillRect(fx - 0.5, fy - 18, 1, 18); ctx.fillStyle = '#d64b3c'; ctx.beginPath(); ctx.moveTo(fx + 0.5, fy - 18); ctx.lineTo(fx + 8, fy - 15); ctx.lineTo(fx + 0.5, fy - 12); ctx.fill();
    for (const [tx, ty] of [[0.3, 0.3], [3.7, 0.4], [0.3, 3.7], [3.6, 1.5], [1.5, 3.7]]) tree(ctx, tx, ty, 0.9, pick(r, LEAVES), 'round');
    box(ctx, 1.4, 2.6, 1.7, 2.75, 0.5, 5, '#ffffff', { top: '#3e9b4f' });
    person(ctx, 1.0, 1.4, '#ffd34d'); person(ctx, 1.2, 1.6, '#e86a8a');
    return 30;
  },
};

// ── upgrades that show on the map ──
function drawUpgrades(ctx, L, r) {
  const u = L.ups || {};
  const K = KINDS[L.kind];
  const small = L.w === 2 && L.d === 2;
  if (u.pool && !K.pool && small) pool(ctx, 0.2, 1.5, 0.95, 1.88);
  if (u.suite && small) {
    box(ctx, 1.48, 1.45, 1.9, 1.88, 0, 12, '#f6f1e7');
    faceL(ctx, 1.48, 1.88, 0, () => { door(ctx, 0.08, 0.12, 8, '#3d78c2'); ctx.fillStyle = '#9fd3ef'; ctx.fillRect(0.25, 4, 0.12, 5); });
    const keep = LAST_ROOF; gable(ctx, 1.48, 1.45, 1.9, 1.88, 12, 9, 'y', '#3f8a8a', '#f6f1e7', 0.04); LAST_ROOF = keep;
  }
  if (u.garage && small && L.kind !== 'house') {
    box(ctx, 1.55, 0.25, 1.92, 0.75, 0, 10, '#e9e1d2');
    faceR(ctx, 1.92, 0.25, 0, () => { ctx.fillStyle = '#f6f1e7'; ctx.fillRect(0.06, 0, 0.38, 8); ctx.fillStyle = 'rgba(0,0,0,.12)'; for (let v = 2; v < 8; v += 2) ctx.fillRect(0.06, v, 0.38, 0.5); });
  }
  if (u.hottub && small) {
    const [cx, cy] = P(1.72, 0.45, 0);
    ctx.fillStyle = '#8a5a34'; ctx.beginPath(); ctx.ellipse(cx, cy - 2, 7, 3.5, 0, 0, TAU); ctx.fill();
    ctx.fillStyle = '#7fd0e8'; ctx.beginPath(); ctx.ellipse(cx, cy - 3, 5.6, 2.6, 0, 0, TAU); ctx.fill();
    circle(ctx, cx - 2, cy - 7, 1.6, 'rgba(255,255,255,.6)'); circle(ctx, cx + 1, cy - 10, 2, 'rgba(255,255,255,.45)');
  }
  if (u.landscaping) {
    flowers(ctx, 0.08, L.d - 0.1, L.w - 0.1, L.d - 0.1, Math.round(L.w * 7), r);
    flowers(ctx, L.w - 0.1, 0.1, L.w - 0.1, L.d - 0.15, Math.round(L.d * 6), r);
    bush(ctx, 0.12, L.d - 0.35, 0.7, '#4f9a3f'); bush(ctx, L.w - 0.3, 0.15, 0.7, '#4f9a3f');
  }
  if (u.dock) {
    flat(ctx, 0.05, L.d - 0.22, 1.1, L.d - 0.02, 1, '#b07a4a', true);
    for (let x = 0.12; x < 1.1; x += 0.08) { const [a, b] = P(x, L.d - 0.12, 1); ctx.fillStyle = 'rgba(80,50,20,.3)'; ctx.fillRect(a - 0.3, b - 2, 0.6, 3); }
    const [bx, by] = P(0.7, L.d - 0.3, 1); ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.ellipse(bx, by - 2, 7, 2.6, -0.45, 0, TAU); ctx.fill(); ctx.fillStyle = '#3d78c2'; ctx.fillRect(bx - 2, by - 5, 4, 3);
  }
  if (u.solar && LAST_ROOF) {
    const R = LAST_ROOF;
    const q = (s, t) => {
      const a = R[0], b = R[1], c = R[2], d = R[3];
      const x0 = lerp(a[0], b[0], s), y0 = lerp(a[1], b[1], s), z0 = lerp(a[2], b[2], s);
      const x1 = lerp(d[0], c[0], s), y1 = lerp(d[1], c[1], s), z1 = lerp(d[2], c[2], s);
      return [lerp(x0, x1, t), lerp(y0, y1, t), lerp(z0, z1, t) + 0.6];
    };
    const s0 = 0.15, s1 = 0.85, t0 = R.flat ? 0.15 : 0.12, t1 = R.flat ? 0.85 : 0.75;
    face(ctx, [q(s0, t0), q(s1, t0), q(s1, t1), q(s0, t1)], '#2c4f86');
    ctx.strokeStyle = 'rgba(160,200,255,.55)'; ctx.lineWidth = 0.5;
    for (let k = 1; k < 4; k++) { const s = lerp(s0, s1, k / 4); path(ctx, [q(s, t0), q(s, t1)]); ctx.stroke(); }
    for (let k = 1; k < 3; k++) { const t = lerp(t0, t1, k / 3); path(ctx, [q(s0, t), q(s1, t)]); ctx.stroke(); }
  }
  if (u.rooftop && LAST_ROOF && LAST_ROOF.flat) {
    const R = LAST_ROOF, z = R[0][2];
    const xs = R.map((p) => p[0]), ys = R.map((p) => p[1]);
    const x0 = Math.min(...xs) + 0.08, x1 = Math.max(...xs) - 0.08, y0 = Math.min(...ys) + 0.08, y1 = Math.max(...ys) - 0.08;
    flat(ctx, x0, y0, x1, y1, z + 0.5, '#8cc35a');
    const [a, b] = P(lerp(x0, x1, 0.3), lerp(y0, y1, 0.3), z), [c, e] = P(lerp(x0, x1, 0.7), lerp(y0, y1, 0.6), z);
    circle(ctx, a, b - 5, 4.5, '#4f9a3f'); circle(ctx, c, e - 4, 4, '#5aa846');
    const [ux, uy] = P(lerp(x0, x1, 0.6), lerp(y0, y1, 0.3), z); ctx.fillStyle = '#ffd34d'; ctx.beginPath(); ctx.moveTo(ux - 6, uy - 7); ctx.quadraticCurveTo(ux, uy - 13, ux + 6, uy - 7); ctx.fill();
  }
  if (u.irrigation && L.w >= 4) {
    ctx.strokeStyle = 'rgba(120,200,240,.8)'; ctx.lineWidth = 0.8; ctx.setLineDash([2, 2]);
    for (let i = 0; i < 4; i++) { const [a, b] = P(0.6 + i * 0.9, 2.8, 0); ctx.beginPath(); ctx.arc(a, b - 2, 9, Math.PI, TAU); ctx.stroke(); }
    ctx.setLineDash([]);
  }
  if (L.lux >= 3 && small && (K.cat === 'res' || K.cat === 'com')) { lamp(ctx, 0.1, L.d - 0.12); lamp(ctx, L.w - 0.12, 0.12); }
}

// ───────────────────────── sprite cache ─────────────────────────
function strHash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function upsKey(u) { if (!u) return ''; return Object.keys(u).filter((k) => u[k]).sort().join(','); }
function baseKey(L) { return L.kind + '|' + L.variant + '|' + L.w + '|' + L.d + '|' + L.dist + '|' + (L.floors || 1) + '|' + (L.look ?? '') + '|' + (L.target || ''); }
function spriteKey(L) { return baseKey(L) + '|' + (L.lux ?? '') + '|' + upsKey(L.ups) + '|' + (L.stage ?? ''); }
function spriteTop(L) {
  const K = KINDS[L.kind];
  let top = K.top;
  if (L.kind === 'site') top = Math.min(380, KINDS[L.target]?.fl ? (L.floors || 6) * 10.5 : 90) + 60;
  else if (K.fl && L.floors) top = L.floors * (L.kind === 'apartment' ? 12 : L.kind === 'office' ? 11 : 10) + (L.kind === 'condotower' ? 34 : L.kind === 'officetower' ? 90 : 24);
  return top + 24;
}
function spriteBox(L) {
  const top = spriteTop(L);
  return { ax: L.d * HW + 6, ay: top, w: (L.w + L.d) * HW + 12, h: (L.w + L.d) * HH + top + 10 };
}
function drawModel(ctx, L) {
  const r = mulberry32(strHash(baseKey(L)));
  SNOW = DISTRICT_BY_ID[L.dist]?.style === 'snow';
  LAST_ROOF = null;
  const top = (MODELS[L.kind] || MODELS.land)(ctx, L, r);
  if (L.kind !== 'site') drawUpgrades(ctx, L, mulberry32(strHash(spriteKey(L))));
  SNOW = false;
  return top;
}
function makeSprite(L, B) {
  const bx = spriteBox(L);
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.ceil(bx.w * B)); c.height = Math.max(1, Math.ceil(bx.h * B));
  const ctx = c.getContext('2d');
  ctx.setTransform(B, 0, 0, B, bx.ax * B, bx.ay * B);
  ctx.lineJoin = 'round';
  SMOKE = [];
  const topZ = drawModel(ctx, L);
  const smoke = SMOKE; SMOKE = null;
  return { c, ax: bx.ax, ay: bx.ay, w: bx.w, h: bx.h, topZ, smoke };
}

// A lot standing on a little diorama slab (dialogs, thumbnails, the building designer)
function drawDiorama(canvas, L, pad = 0.35, cssW, cssH) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(cssW * dpr); canvas.height = Math.round(cssH * dpr);
  const ctx = canvas.getContext('2d');
  const known = typeof View !== 'undefined' ? View.topZ.get(spriteKey(L)) : null;
  const top = (known != null ? known : spriteTop(L) - 24) + 22, slab = 12;
  const lw = (L.w + L.d + pad * 4) * HW, lh = (L.w + L.d + pad * 2) * HH + top + slab;
  const s = Math.min(cssW / lw, cssH / lh) * 0.96 * dpr;
  const ox = (canvas.width - lw * s) / 2 + (L.d + pad * 2) * HW * s;
  const oy = (canvas.height - lh * s) / 2 + top * s;
  ctx.setTransform(s, 0, 0, s, ox, oy);
  ctx.lineJoin = 'round';
  const g = lawnFor(L);
  const x0 = -pad, y0 = -pad, x1 = L.w + pad, y1 = L.d + pad;
  face(ctx, [[x0, y1, -slab], [x1, y1, -slab], [x1, y1, 0], [x0, y1, 0]], '#8a6a48');
  face(ctx, [[x1, y0, -slab], [x1, y1, -slab], [x1, y1, 0], [x1, y0, 0]], '#6e5238');
  flat(ctx, x0, y0, x1, y1, 0, shade(g, -0.06), true);
  ctx.strokeStyle = '#3a2a1e'; ctx.lineWidth = 2.2;
  path(ctx, [[-0.04, -0.04, 0], [L.w + 0.04, -0.04, 0], [L.w + 0.04, L.d + 0.04, 0], [-0.04, L.d + 0.04, 0]]); ctx.stroke();
  const topZ = drawModel(ctx, L);
  if (typeof View !== 'undefined' && known == null) View.topZ.set(spriteKey(L), topZ);
}
const _thumbCache = new Map();
function thumbURL(L, w = 96, h = 72) {
  const k = spriteKey(L) + '@' + w;
  let u = _thumbCache.get(k);
  if (!u) {
    const c = document.createElement('canvas');
    drawDiorama(c, L, 0.2, w, h);
    u = c.toDataURL('image/png');
    _thumbCache.set(k, u);
    if (_thumbCache.size > 300) _thumbCache.delete(_thumbCache.keys().next().value);
  }
  return u;
}
