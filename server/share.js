// Public, link-friendly portfolio page: /p/<handle>. Rendered on the server so
// chat apps and social sites can unfurl it with a proper title and description.
import { profile } from './api.js';
import { config } from './config.js';

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const money = (n) => {
  const a = Math.abs(n), s = n < 0 ? '−$' : '$';
  if (a >= 1e9) return `${s}${(a / 1e9).toFixed(2)}B`;
  if (a >= 1e6) return `${s}${(a / 1e6).toFixed(2)}M`;
  if (a >= 1e3) return `${s}${Math.round(a / 1e3)}K`;
  return `${s}${Math.round(a)}`;
};
const KIND = {
  cottage: 'Cottage', house: 'House', villa: 'Villa', mansion: 'Mansion', terrace: 'Terraces', duplex: 'Duplex', apartments: 'Apartments',
  tower: 'Tower', shop: 'Shop', cafe: 'Café', office: 'Offices', mall: 'Mall', hotel: 'Hotel', warehouse: 'Warehouse', factory: 'Factory',
  land: 'Land', farm: 'Farm', chalet: 'Chalet', beachhouse: 'Beach house', lakehouse: 'Lake house', loft: 'Loft',
};
const kindName = (k) => KIND[k] || (k ? k[0].toUpperCase() + k.slice(1) : 'Property');

function spark(hist) {
  if (!hist || hist.length < 2) return '';
  const min = Math.min(...hist), max = Math.max(...hist), w = 320, h = 70;
  const pts = hist.map((v, i) => `${(i / (hist.length - 1) * w).toFixed(1)},${(h - 6 - (max > min ? (v - min) / (max - min) : 0.5) * (h - 12)).toFixed(1)}`);
  return `<svg viewBox="0 0 ${w} ${h}" class="spark" aria-hidden="true"><polyline points="${pts.join(' ')}" fill="none" stroke="currentColor" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

export async function sharePage(handle) {
  const p = await profile(handle, null);
  if (!p) return null;
  const s = p.snapshot || {};
  const name = s.fam ? `${p.user.name} ${s.fam}` : p.user.name;
  const title = `${name}’s portfolio · Property Mogul`;
  const desc = s.net != null
    ? `Net worth ${money(s.net)} · ${s.props || 0} properties${s.year ? ` · year ${s.year}` : ''}${s.gen > 1 ? ` · generation ${s.gen}` : ''}. Come build a city empire with me.`
    : 'Come build a city empire with me in Property Mogul.';
  const url = `${config.PUBLIC_URL}/p/${encodeURIComponent(p.user.handle)}`;
  const rows = (s.top || []).map((t) => `
      <li><b>${esc(t.addr)}</b><span>${esc(t.kn || kindName(t.kind))} · ${esc(t.dist)}${t.historic ? ' · <i>Historic</i>' : ''}${t.str ? ' · Holiday let' : ''}${t.tier && t.tier !== 'Ordinary' ? ` · ${esc(t.tier)}` : ''}</span><em>${money(t.value)}</em></li>`).join('');
  const watch = p.watch.slice(0, 8).map((w) => `<li><b>${esc(w.addr || `Lot ${w.lot}`)}</b><span>${esc(kindName(w.kind))}${w.dist ? ` · ${esc(w.dist)}` : ''}${w.note ? ` · “${esc(w.note)}”` : ''}</span><em>${w.price ? money(w.price) : ''}</em></li>`).join('');
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta property="og:type" content="profile"><meta property="og:title" content="${esc(title)}"><meta property="og:description" content="${esc(desc)}"><meta property="og:url" content="${esc(url)}">
<meta name="twitter:card" content="summary"><meta name="twitter:title" content="${esc(title)}"><meta name="twitter:description" content="${esc(desc)}">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@500;700;800&family=Lilita+One&display=swap">
<style>
:root{--bg:#bfe6ff;--card:#fffaf0;--ink:#3b2a1a;--soft:#8a6d52;--accent:#e8743b;--good:#3f9b4a;--line:#ecdcc4}
@media (prefers-color-scheme:dark){:root{--bg:#18202c;--card:#25211c;--ink:#f6ead8;--soft:#c8b296;--line:#40362b}}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:500 16px/1.4 "Baloo 2",system-ui,sans-serif;padding:24px 16px}
.card{max-width:560px;margin:0 auto;background:var(--card);border-radius:22px;padding:22px;box-shadow:0 10px 0 rgba(0,0,0,.08)}
h1{font:400 30px/1.1 "Lilita One",system-ui;margin:0 0 4px}h2{font:400 19px "Lilita One",system-ui;margin:22px 0 8px}
.sub{color:var(--soft)}.stats{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-top:16px}
.stat{background:rgba(0,0,0,.04);border-radius:14px;padding:10px}.stat b{display:block;font-size:20px}.stat span{font-size:13px;color:var(--soft)}
.spark{width:100%;height:70px;color:var(--good);margin-top:12px}
ul{list-style:none;margin:0;padding:0}li{display:grid;grid-template-columns:1fr auto;gap:0 10px;padding:9px 0;border-top:1px solid var(--line)}
li span{grid-column:1;color:var(--soft);font-size:14px}li em{grid-row:1/3;grid-column:2;align-self:center;font-style:normal;font-weight:800}
.cta{display:block;text-align:center;margin-top:22px;background:var(--accent);color:#fff;text-decoration:none;font:400 20px "Lilita One",system-ui;padding:12px;border-radius:16px}
</style></head><body><main class="card">
<h1>${esc(name)}</h1><div class="sub">@${esc(p.user.handle)}${s.year ? ` · Year ${s.year}` : ''}${s.gen > 1 ? ` · Generation ${s.gen}` : ''}${p.user.repaid ? ` · ${p.user.repaid} loans repaid` : ''}</div>
<div class="stats"><div class="stat"><b>${money(s.net || 0)}</b><span>Net worth</span></div><div class="stat"><b>${s.props || 0}</b><span>Properties</span></div><div class="stat"><b>${s.rep ?? 0}</b><span>Reputation</span></div></div>
${spark(s.hist)}
${rows ? `<h2>Portfolio highlights</h2><ul>${rows}</ul>` : ''}
${watch ? `<h2>Properties of interest</h2><ul>${watch}</ul>` : ''}
<a class="cta" href="/?ref=${encodeURIComponent(p.user.handle)}">Play Property Mogul</a>
</main></body></html>`;
}
