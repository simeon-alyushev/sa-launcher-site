'use strict';
/* SA Launcher — интерфейс. Работает через window.sa (preload). */
const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => [...e.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>', library: '<rect x="3" y="3" width="7" height="7" rx="2.5"/><rect x="14" y="3" width="7" height="7" rx="2.5"/><rect x="3" y="14" width="7" height="7" rx="2.5"/><rect x="14" y="14" width="7" height="7" rx="2.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 11-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 11-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 112.83-2.83l.06.06a1.65 1.65 0 001.82.33H9a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 112.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', refresh: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>', bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', back: '<path d="M15 5l-7 7 7 7"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>', tag: '<path d="M3 12V4h8l9 9-8 8z"/><circle cx="7.5" cy="8.5" r="1.2"/>', import: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>',
  tool: '<path d="M14.7 6.3a4 4 0 00-5 5L3 18l3 3 6.7-6.7a4 4 0 005-5l-2.5 2.5-2.2-.5-.5-2.2z"/>',
  box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/>', gem: '<path d="M6 3h12l4 6-10 12L2 9z"/><path d="M2 9h20M9 3l3 6 3-6M12 21L9 9M12 21l3-12"/>',
  shirt: '<path d="M8 3l-5 3 2 5 3-1v11h8V10l3 1 2-5-5-3a4 4 0 01-8 0z"/>', cloud: '<path d="M7 18a4 4 0 010-8 5.5 5.5 0 0110.6 1.3A3.4 3.4 0 0117 18z"/>', info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7.5v.5"/>', share: '<circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="6" r="2.5"/><circle cx="18" cy="18" r="2.5"/><path d="M8.2 10.8l7.6-3.6M8.2 13.2l7.6 3.6"/>', history: '<path d="M3 12a9 9 0 109-9 9 9 0 00-6.4 2.6L3 8M3 3v5h5M12 7v5l3 2"/>'
};
const ic = n => `<svg class="i" viewBox="0 0 24 24">${P[n]}</svg>`;

const S = { settings: { lang: 'en', theme: 'dark', accent: '#4ade80' }, accounts: [], instances: [], view: 'home', instId: null, tab: 'mods', target: null, logs: {}, tasks: {}, site: '', catalog: { type: 'mod', q: '', loader: '', version: '', res: null, busy: false, page: 0, src: 'modrinth', hasNext: false }, popular: null, mcv: null, heads: {}, skins: null, skinSaved: null, skView: 'front' };
const adv = () => S.settings.uiMode === 'advanced';
const t = k => ((LANGS[S.settings.lang] || LANGS.en).t[k]) || LANGS.en.t[k] || k;
const api = (n, a) => sa.call(n, a);
const LOADERS = ['vanilla', 'fabric', 'quilt', 'forge', 'neoforge'];
const LN = { vanilla: 'Vanilla', fabric: 'Fabric', quilt: 'Quilt', forge: 'Forge', neoforge: 'NeoForge' };
const ACCENTS = ['#1bd96a', '#4f8cff', '#f87171'];   // как на сайте (Modrinth / Prism / SA); 4-й вариант — свой цвет
const THEMES = [['dark', '#0f1115', '#4ade80'], ['light', '#eef1f6', '#4ade80'], ['amoled', '#000', '#4ade80'], ['glass', 'linear-gradient(135deg,#7c5cff,#22b8ff 60%,#4ade80)', '#fff'], ['glasslight', 'linear-gradient(135deg,#ffd6e8,#cfe3ff 60%,#d9ffe8)', '#fff'], ['cold', 'linear-gradient(135deg,#0a1626,#7cc4ff)', '#fff'], ['warm', 'linear-gradient(135deg,#fff3dc,#ffb347)', '#fff'], ['autumn', 'linear-gradient(135deg,#1d120b,#e8742c)', '#fff'], ['spring', 'linear-gradient(135deg,#0b1a1c,#5ec8d8)', '#fff'], ['night', 'linear-gradient(135deg,#050816,#2b3a7a)', '#fff'], ['custom', 'conic-gradient(#f472b6,#facc15,#4ade80,#22d3ee,#a78bfa,#f472b6)', '#fff']];

/* ---------- утилиты ---------- */
function lum(hex) { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
function h2x(h) { const s = .85, l = .58, a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }; return '#' + f(0) + f(8) + f(4); }
function x2h(hex) { const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); if (!d) return 0; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return Math.round((h * 60 + 360) % 360); }
const hue = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };
const tile = (i, cls = '') => i.iconData ? `<div class="tile ${cls}"><img src="${esc(i.iconData)}" alt=""></div>` : `<div class="tile ${cls}" style="background:linear-gradient(135deg,hsl(${hue(i.id)} 70% 56%),hsl(${(hue(i.id) + 45) % 360} 70% 42%))">${esc([...(i.name || '?')][0].toUpperCase())}</div>`;
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n || 0);
const head = a => {
  if (!a) return `<span class="hd">?</span>`;
  const l = esc([...(a.name || '?')][0].toUpperCase());
  const body = S.heads[a.id] ? `<img src="${esc(S.heads[a.id])}" alt="" style="image-rendering:pixelated">` : '';
  return `<span class="hd">${l}${body}</span>`;
};
const cur = () => S.accounts.find(a => a.id === S.settings.selected) || S.accounts[0];
const inst = id => S.instances.find(i => i.id === id);
const fmtTime = s => s >= 3600 ? Math.floor(s / 3600) + ' h ' + Math.floor(s % 3600 / 60) + ' m' : Math.floor(s / 60) + ' m';

function toast(msg, kind = '') { const e = document.createElement('div'); e.className = 'toast ' + kind; e.textContent = msg; $('#toasts').append(e); setTimeout(() => e.remove(), kind === 'err' ? 6000 : 3000); }
const clean = e => String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
const errText = e => { const m = clean(e); if (m.startsWith('err:')) { const [k, ...a] = m.slice(4).split('|'); return tf(k, a); } return m; };
const tf = (k, a) => (a || []).reduce((s, v, i) => s.replace('{' + i + '}', v), t(k));
const fail = e => { const m = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, '');
  if (m.startsWith('err:')) { const [k, ...a] = m.slice(4).split('|'); return toast(tf(k, a), 'err'); }
  if (m.startsWith('noloader:')) { const [, l, v] = m.split(':'); return toast(tf('noLoaderMsg', [LN[l] || l, v]), 'err'); } if (m.endsWith('nolicense')) { toast(t('noLicense'), 'err'); return accountsModal(); } if (m === 'noaccount' || m === 'relogin') { toast(t('noAcc'), 'err'); return accountsModal(); } toast(m.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'err'); };
async function run(fn) { try { return await fn(); } catch (e) { fail(e); } }

/* ---------- тема ---------- */
// Режим погодных эффектов: full — всё; static — «Экономия ресурсов» (только статичный аксессуар на логотипе); off — выключено
function wxMode(s) {
  if (!SAWeather.KEY[s.theme] || s.anims === false) return 'off';
  return s.lite === true || SAWeather.reduced() ? 'static' : 'full';
}
const bgItem = () => { const s = S.settings; return s.theme === 'custom' && (s.customBgs || []).find(b => b.id === s.customBgSel) || null; };
const bgUrl = b => window.saBgUrl ? window.saBgUrl(b) : 'sa-bg://f/' + b.id + '?v=' + (b.v || 0);
let bgKey = '';
// Свой фон: <img> (GIF проигрывается как анимация). В режиме экономии GIF заменяется первым кадром.
function applyBg() {
  const r = document.documentElement, s = S.settings, b = bgItem();
  let el = $('#bgimg'); if (!el) { el = document.createElement('div'); el.id = 'bgimg'; document.body.prepend(el); }
  if (!b) { r.removeAttribute('data-bgimg'); el.innerHTML = ''; bgKey = ''; return; }
  const frozen = b.ext === 'gif' && s.lite === true, key = b.id + ':' + b.v + ':' + frozen;
  r.dataset.bgimg = '1'; el.style.setProperty('--dim', String(Math.min(85, Math.max(0, +s.customBgDim == null || isNaN(+s.customBgDim) ? 40 : +s.customBgDim)))); el.style.setProperty('--fit', s.customBgFit === 'contain' ? 'contain' : 'cover');
  if (key === bgKey) return; bgKey = key;
  const im = new Image(); im.alt = ''; im.draggable = false; im.decoding = 'async';
  im.onload = () => { if (bgKey !== key) return;
    if (frozen) { try { const c = document.createElement('canvas'); c.width = im.naturalWidth; c.height = im.naturalHeight; c.getContext('2d').drawImage(im, 0, 0); im.src = c.toDataURL('image/jpeg', .9); im.onload = null; } catch (_) {} }
    el.replaceChildren(im); };
  im.onerror = () => { if (bgKey === key) { r.removeAttribute('data-bgimg'); el.innerHTML = ''; } };
  im.src = bgUrl(b);
}
function applyTheme(o = {}) {
  const s = S.settings, r = document.documentElement;
  r.lang = s.lang; if (s.lite === true) r.dataset.lite = '1'; else delete r.dataset.lite;   // «экономия ресурсов» (по умолчанию ВЫКЛЮЧЕНА): без размытия, анимаций и погодного декора
  r.style.setProperty('--ac', s.accent); r.style.setProperty('--acx', lum(s.accent) > .5 ? '#08130c' : '#ffffff');
  if ((s.theme === 'glass' || s.theme === 'glasslight') && s.blur != null) r.style.setProperty('--bl', s.blur + 'px'); else r.style.removeProperty('--bl');
  // Палитра применяется контроллером погоды в нужный момент перехода (после «завершения» прошлой темы)
  const palette = () => {
    const t = S.settings.theme, c = S.settings; r.dataset.theme = t;
    if (t === 'custom') {
      const dark = lum(c.customBg) < .4; r.dataset.mode = dark ? 'dark' : 'light';
      r.style.setProperty('--bg', c.customBg); r.style.setProperty('--card', c.customCard); r.style.setProperty('--card2', `color-mix(in srgb,${c.customCard},${dark ? '#fff' : '#000'} 8%)`);
      r.style.setProperty('--tx', dark ? '#f2f4f8' : '#14171d'); r.style.setProperty('--mu', dark ? '#9aa3b2' : '#667085');
    } else { delete r.dataset.mode; ['--bg', '--card', '--card2', '--tx', '--mu'].forEach(p => r.style.removeProperty(p)); }
    applyBg();
  };
  SAWeather.setMax(s.paneMax == null ? 14 : s.paneMax);
  SAWeather.apply({ theme: s.theme, mode: wxMode(s), instant: !!o.instant, palette });
}
const setS = patch => { Object.assign(S.settings, patch); applyTheme(); api('settings:set', patch).catch(() => {}); };

/* ---------- каркас ---------- */
const qIcon = (x, fb) => x.icon ? `<img src="${esc(x.icon)}" alt="">` : `<span>${fb}</span>`;
function railQuick() {
  const r = S.recent || { worlds: [], servers: [] };
  return r.worlds.slice(0, 3).map(w => `<button class="nav q" data-qw="${esc(w.inst)}" data-q="${esc(w.folder)}" title="${esc(w.name)} · ${esc(w.instName)}">${qIcon(w, '🌍')}</button>`).join('')
    + r.servers.slice(0, 3).map(v => `<button class="nav q" data-qs="${esc(v.inst)}" data-q="${esc(v.ip)}" title="${esc(v.name)} · ${esc(v.ip)}">${qIcon(v, '🖥')}</button>`).join('');
}
async function loadRecent() { try { S.recent = await api('inst:recent'); renderRail(); } catch (_) {} }
function renderRail() {
  const a = cur(); loadHead(a);
  const  nav = (v, i, tt) => `<button class="nav ${S.view === v || (v === 'library' && S.view === 'inst') ? 'on' : ''}" data-go="${v}" title="${esc(tt)}">${ic(i)}</button>`;
  $('#rail').innerHTML = `<div class="rail-in"><img class="logo" src="logo.png" alt="SA" data-site>${nav('home', 'home', t('home'))}${nav('library', 'library', t('library'))}${nav('discover', 'compass', t('discover'))}${nav('builds', 'box', t('saBuilds'))}${nav('skins', 'shirt', t('skins'))}${S.platform === 'win32' ? nav('bedrock', 'gem', 'Bedrock') : ''}${railQuick() ? `<div class="sep"></div><div class="rq">${railQuick()}</div>` : ''}<div class="sp"></div>
  <button class="nav" data-acc title="${esc(t('accounts'))}">${a ? head(a) : ic('user')}</button>${nav('settings', 'gear', t('settings'))}</div>`;
  SAWeather.sync();
}
function go(view, id) {
  S.view = view; if (id !== undefined) S.instId = id;
  renderRail(); renderView(); $('#view').scrollTop = 0;
}
function loadHead(a) {
  if (!a || (a.p !== 'ms' && a.p !== 'ely') || S.heads[a.id] !== undefined) return; S.heads[a.id] = '';
  api('skin:head', a.id).then(async d => { if (!d) return; const im = await loadImg(d), c = document.createElement('canvas'); c.width = c.height = 32; const g = c.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(im, 8, 8, 8, 8, 0, 0, 32, 32); g.drawImage(im, 40, 8, 8, 8, 0, 0, 32, 32); S.heads[a.id] = c.toDataURL(); renderRail(); }).catch(() => { delete S.heads[a.id]; });
}
function renderView() {
  const v = S.view;
  if (v === 'home') return viewHome(); if (v === 'library') return viewLibrary(); if (v === 'inst') return viewInst();
  if (v === 'discover') return viewDiscover(); if (v === 'settings') return viewSettings(); if (v === 'builds') return viewBuilds();
  if (v === 'skins') return viewSkins(); if (v === 'about') return viewAbout(); if (v === 'bedrock') return viewBedrock();
}
let setObs = null;   // наблюдатель подсветки пункта в навигации настроек
const V = html => { if (setObs) { setObs.disconnect(); setObs = null; } $('#view').innerHTML = html; };

/* ---------- Главная ---------- */
function viewHome() {
  const a = cur(), recent = S.instances.slice(0, 4);
  V(`<div class="hero"><img src="logo.png" style="width:84px;height:84px;border-radius:28px" alt=""><div class="grow"><h1>SA Launcher</h1><div class="mu">${a ? esc(a.name) + ' · ' + 'Microsoft' : esc(t('noAcc'))}</div></div>
   ${a ? '' : `<button class="btn p" data-acc>${ic('user')}${esc(t('signIn'))}</button>`}<button class="btn p" data-new>${ic('plus')}${esc(t('newInst'))}</button></div>
   <h2>${esc(t('recent'))}</h2>${recent.length ? `<div class="grid">${recent.map(instCard).join('')}</div>` : `<div class="card empty">${esc(t('emptyLib'))}</div>`}
   <h2>${esc(t('popular'))}</h2><div id="pop" class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${S.popular ? S.popular.map(projCard).join('') : `<div class="mu">${esc(t('loading'))}</div>`}</div>`);
  if (!S.popular) api('cat:search', { type: 'mod' }).then(r => { S.popular = r.hits.slice(0, 6); if (S.view === 'home') $('#pop').innerHTML = S.popular.map(projCard).join(''); }).catch(() => { if ($('#pop')) $('#pop').innerHTML = ''; });
}
const projCard = (h, i) => `<div class="card item" style="padding:14px;border-radius:26px;cursor:pointer" data-proj="${esc(h.id)}"><img class="ico" src="${esc(h.icon || '')}" alt=""><div class="grow"><b>${esc(h.title)}</b><div class="ds">${esc(h.desc)}</div><span class="mu sm">⬇ ${fmt(h.downloads)} · ${esc(h.author || '')}</span></div></div>`;

/* ---------- Сборки SA ---------- */
async function viewBuilds() {
  V(`<div class="top"><h1>${esc(t('saBuilds'))}</h1></div><p class="mu" style="margin-top:-6px">${esc(t('saBuildsD'))}</p><div class="mu">${esc(t('loading'))}</div>`);
  if (!S.builds) { try { S.builds = await api('build:list'); } catch (e) { return fail(e); } }
  if (S.view !== 'builds') return;
  V(`<div class="top"><h1>${esc(t('saBuilds'))}</h1></div><p class="mu" style="margin-top:-6px">${esc(t('saBuildsD'))}</p>
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">${S.builds.map(b => `<div class="card bcard" data-build="${esc(b.id)}" style="cursor:pointer"><div class="row gap">${tile({ id: b.id, name: b.name, iconData: b.icon }, 'lg')}<div class="grow"><b style="font-size:18px">${esc(b.name)}</b><div class="mu sm">${LN[b.loader]} · ${esc(t('mods'))} ${b.mods.length} · ${esc(t('packs'))} ${b.resourcepacks.length} · ${esc(t('shaders'))} ${b.shaders.length}</div></div></div>
  <p class="mu sm" style="margin:12px 0">${esc(b.desc)}</p><button class="btn p" data-build="${esc(b.id)}">${ic('download')}${esc(t('install'))}</button></div>`).join('')}</div>`);
}
async function buildModal(id) {
  const b = (S.builds || []).find(x => x.id === id); if (!b) return;
  let rel = []; try { rel = await api('build:versions'); } catch (_) {}
  if (!S.mcv) { try { S.mcv = await api('mc:versions'); } catch (_) {} }
  const chips = (arr) => arr.map(n => `<span class="tag">${esc(n)}</span>`).join(' ');
  modal(`<h2>${ic('box')} ${esc(b.name)}</h2><p class="mu" style="margin-top:-6px">${esc(b.desc)}</p>
  <label class="lab">${esc(t('name'))}</label><input id="bn" style="width:100%" value="${esc(b.name)}">
  <div class="row gap" style="margin-top:12px">${tile({ id: b.id, name: b.name, iconData: b.icon }, 'lg')}<button class="btn sm" data-bicon="${esc(b.id)}">${ic('import')}${esc(t('bicon'))}</button>${b.icon ? `<button class="btn sm bad" data-biconclr="${esc(b.id)}">${ic('refresh')}${esc(t('biconClr'))}</button>` : ''}</div>
  <label class="lab">${esc(t('mcVersion'))}</label><select id="bv" style="width:100%"><option value="auto">${esc(t('auto'))}</option>${rel.map(v => `<option value="${esc(v)}">${esc(v)}${isNew(v) ? ' · ★ ' + esc(t('newBadge')) : ''}</option>`).join('')}</select>
  <div class="mu sm" style="margin-top:6px">${esc(t('buildNote'))}</div>
  <div style="max-height:34vh;overflow:auto;margin-top:12px"><label class="lab" style="margin-top:0">${esc(t('mods'))} (${b.mods.length})</label><div class="chips">${chips(b.mods)}</div>
  <label class="lab">${esc(t('packs'))} (${b.resourcepacks.length})</label><div class="chips">${chips(b.resourcepacks)}</div>
  <label class="lab">${esc(t('shaders'))} (${b.shaders.length})</label><div class="chips">${chips(b.shaders)}</div>
  <label class="lab">${esc(t('optimize'))}</label><div class="mu sm">${esc(t('optD'))}</div></div>
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn p" id="bgo">${ic('download')}${esc(t('install'))}</button></div>`);
  $('#bgo').onclick = async () => {
    const name = $('#bn').value.trim() || b.name, mc = $('#bv').value;
    modal(`<h2>${ic('box')} ${esc(name)}</h2><p class="mu">${esc(t('buildWait'))}</p><div class="bar"><i style="width:100%;opacity:.35"></i></div>`);
    $('#modal').onclick = null;
    try {
      const r = await api('build:install', { id: b.id, mc, name }); await refresh();
      modal(`<h2>${esc(t('done'))}: ${esc(r.instance.name)} · ${esc(r.instance.mc)}</h2><p class="mu sm">✓ ${r.installed.length}${r.skipped.length ? ` · ✕ ${r.skipped.length}` : ''}</p>
      ${r.skipped.length ? `<div class="card" style="border-color:var(--warn)"><b>⚠ ${esc(t('trimmedT'))}</b><div class="sm mu" style="margin-top:4px">${esc(t('trimmedD').replace('{v}', r.instance.mc))}</div></div>` : ''}
      ${r.skipped.length ? `<label class="lab">${esc(t('buildSkipped'))}</label><div class="chips">${chips(r.skipped)}</div>` : ''}
      ${r.other.length ? `<label class="lab">${esc(t('buildOther'))}</label><div class="chips">${chips(r.other)}</div>` : ''}
      <div class="foot"><button class="btn p" data-opensa="${esc(r.instance.id)}">${ic('play')}${esc(t('open'))}</button></div>`);
    } catch (e) { closeModal(); fail(e); }
  };
}

/* ---------- Библиотека ---------- */
function instCard(i) {
  const run = i.running;
  return `<div class="card inst" data-inst="${esc(i.id)}">${tile(i)}<div><b style="font-size:16px">${esc(i.name)}</b><div class="mu sm">${esc(i.mc)} · ${LN[i.loader] || i.loader}</div></div>
  <button class="cfold" data-cardfolder="${esc(i.id)}" title="${esc(t('openFolder'))}">${ic('folder')}</button>
  <button class="fab ${run ? 'run' : ''}" data-play="${esc(i.id)}" title="${esc(run ? t('stop') : t('play'))}">${ic(run ? 'stop' : 'play')}</button></div>`;
}
function sortedInst() {
  const m = S.settings.sort || 'recent', a = [...S.instances];
  if (m === 'name') a.sort((x, y) => x.name.localeCompare(y.name)); else if (m === 'playtime') a.sort((x, y) => (y.playtime || 0) - (x.playtime || 0));
  return a;
}
function viewLibrary() {
  V(`<div class="top"><h1>${esc(t('library'))}</h1><div class="row"><button class="btn" data-import>${ic('import')}${esc(t('importPack'))}</button><button class="btn p" data-new>${ic('plus')}${esc(t('newInst'))}</button></div></div>
  ${S.instances.length ? groupedGrid() : `<div class="card empty">${esc(t('emptyLib'))}</div>`}`);
}
function groupedGrid() {
  const list = sortedInst(), gs = [...new Set(list.map(i => i.group || ''))].sort((a, b) => !a ? -1 : !b ? 1 : a.localeCompare(b));
  if (gs.length === 1 && gs[0] === '') return `<div class="grid">${list.map(instCard).join('')}</div>`;
  return gs.map(g => `<h2 style="margin:20px 0 10px">${g ? esc(g) : esc(t('noGroup'))}</h2><div class="grid">${list.filter(i => (i.group || '') === g).map(instCard).join('')}</div>`).join('');
}

/* ---------- Страница сборки ---------- */
async function viewInst() {
  const i = inst(S.instId); if (!i) return go('library');
  const tabs = adv() ? [['mods', t('mods')], ['resourcepack', t('packs')], ['shader', t('shaders')], ['worlds', t('tabWorlds')], ['notes', t('tabNotes')], ['logs', t('logs')], ['settings', t('settings')]] : [['mods', t('mods')], ['settings', t('settings')]];
  if (!tabs.some(x => x[0] === S.tab)) S.tab = 'mods';
  V(`<button class="back" data-go="library">${ic('back')}${esc(t('library'))}</button>
  <div class="row gap wrap" style="margin:8px 0 20px">${tile(i, 'lg')}<div class="grow"><h1 style="margin:0">${esc(i.name)}</h1><div class="mu">${esc(i.mc)} · ${LN[i.loader]}${adv() && i.loaderVersion ? ' ' + esc(i.loaderVersion) : ''}${i.playtime ? ' · ' + fmtTime(i.playtime) : ''}</div></div>
  <div class="row wrap"><button class="btn p" data-play="${esc(i.id)}">${ic(i.running ? 'stop' : 'play')}${esc(i.running ? t('stop') : t('play'))}</button>
  <button class="btn" data-upd>${ic('refresh')}${esc(t('update'))}</button><button class="btn" data-opt>${ic('bolt')}${esc(t('optimize'))}</button><button class="btn" data-boost>${ic('bolt')}${esc(t('boost'))}${i.boost ? ' ✓' : ''}</button>
  <button class="btn ic" data-restore title="${esc(t('bkpRestore'))}">${ic('history')}</button><button class="btn ic" data-tools title="${esc(t('tools'))}">${ic('tool')}</button><button class="btn ic" data-folder title="${esc(t('openFolder'))}">${ic('folder')}</button></div></div>
  ${i.trimmed && i.trimmed.length ? `<div class="card" style="border-color:var(--warn);margin-bottom:14px"><b>⚠ ${esc(t('trimmedT'))}</b><div class="sm mu" style="margin-top:4px">${esc(t('trimmedD').replace('{v}', i.mc))}</div><div class="chips" style="margin-top:8px">${i.trimmed.map(n => `<span class="tag">${esc(n)}</span>`).join(' ')}</div></div>` : ''}
  ${i.manual && i.manual.length ? `<div class="card" style="border-color:var(--warn);margin-bottom:14px"><div class="row gap wrap"><div class="grow"><b>⚠ ${esc(t('manT'))}: ${i.manual.length}</b><div class="sm mu" style="margin-top:4px">${esc(t('manD'))}</div></div><button class="btn sm" data-manual="${esc(i.id)}">${esc(t('manShow'))}</button></div></div>` : ''}
  ${i.loaderFallback ? `<div class="card" style="margin-bottom:14px"><span class="sm">${esc(t('packLoaderFb').replace('{v}', i.loaderFallback))}</span></div>` : ''}
  <div class="pill" style="margin-bottom:18px;flex-wrap:wrap">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div><div id="tabc"></div>`);
  renderTab();
}
async function renderTab() {
  const i = inst(S.instId), box = $('#tabc'); if (!i || !box) return;
  if (S.tab === 'logs') { box.innerHTML = `<pre class="log" id="logbox">${esc((S.logs[i.id] || []).join('\n'))}</pre>`; const b = $('#logbox'); b.scrollTop = b.scrollHeight; return; }
  if (S.tab === 'settings') {
    const sec = (ttl, body) => `<div class="card" style="margin-bottom:12px"><div style="margin-bottom:4px"><b>${esc(t(ttl))}</b></div>${body}</div>`;
    const tog = (id, on, label) => `<label class="row sm" style="margin-top:10px"><button class="sw ${on ? 'on' : ''}" id="${id}"></button>${esc(t(label))}</label>`;
    const gm = S.settings.memory || 4096, v = x => esc(x || '');
    box.innerHTML =
      sec('setGeneral', `<label class="lab" style="margin-top:0">${esc(t('name'))}</label><input id="sn" value="${v(i.name)}" style="width:100%" maxlength="80">
      <label class="lab">${esc(t('group'))}</label><input id="sg" list="sgl" style="width:100%" placeholder="${esc(t('groupPh'))}" value="${v(i.group)}"><datalist id="sgl">${[...new Set(S.instances.map(x => x.group).filter(Boolean))].map(g => `<option value="${esc(g)}">`).join('')}</datalist>
      <label class="lab">${esc(t('photo'))}</label><div class="row gap">${tile(i, 'lg')}<button class="btn" data-seticon>${ic('import')}${esc(t('choosePhoto'))}</button>${i.iconData ? `<button class="btn bad" data-clricon>${ic('trash')}${esc(t('removePhoto'))}</button>` : ''}</div>`) +
      sec('setJava', `<label class="lab" style="margin-top:0">${esc(t('memory'))}: <b id="mv">${i.memory || gm}</b></label><input type="range" id="sm" min="1024" max="16384" step="512" value="${i.memory || gm}">
      ${adv() ? `<label class="lab">${esc(t('minMem'))}</label><input id="smm" type="number" min="128" step="128" placeholder="512" value="${v(i.minMemory)}" style="width:140px">
      <label class="lab">Java</label><input id="sjp" style="width:100%" placeholder="auto" value="${v(i.javaPath)}">
      <label class="lab">${esc(t('jvmArgs'))}</label><textarea id="sj" rows="3" placeholder="${v(S.settings.jvmArgs)}">${v(i.jvmArgs)}</textarea>` : ''}`) +
      sec('setWindow', `<div class="row gap wrap" style="margin-top:6px"><input id="sw" type="number" min="320" placeholder="${esc(t('width'))}" value="${v(i.width)}" style="width:110px"><span class="mu">×</span><input id="sh" type="number" min="240" placeholder="${esc(t('height'))}" value="${v(i.height)}" style="width:110px"></div>${tog('sfs', i.fullscreen, 'fullscreen')}`) +
      sec('setLaunch', `<label class="lab" style="margin-top:0">${esc(t('autoJoin'))}</label><input id="saj" style="width:100%" placeholder="play.example.com:25565" value="${v(i.autoJoin)}">${tog('sco', i.openLogs, 'showConsole')}${tog('srp', i.recordPlaytime !== false, 'recPlaytime')}`) +
      (adv() ? sec('setCommands', `<div class="mu sm" style="margin-bottom:6px">${esc(t('cmdHint'))}</div>
      <label class="lab" style="margin-top:0">${esc(t('preLaunch'))}</label><input id="spl" style="width:100%" value="${v(i.preLaunch)}">
      <label class="lab">${esc(t('wrapperCmd'))}</label><input id="swr" style="width:100%" placeholder="gamemoderun" value="${v(i.wrapper)}">
      <label class="lab">${esc(t('postExit'))}</label><input id="spe" style="width:100%" value="${v(i.postExit)}">`) +
      sec('setEnv', `<div class="mu sm" style="margin-bottom:6px">${esc(t('envHint'))}</div><textarea id="sev" rows="4" style="width:100%" placeholder="KEY=VALUE">${v(i.envVars)}</textarea>`) : '') +
      `<div class="foot" style="justify-content:space-between"><div class="row"><button class="btn" data-dup>${ic('copy')}${esc(t('dup'))}</button><button class="btn" data-folder>${ic('folder')}${esc(t('openFolder'))}</button><button class="btn bad" data-del>${ic('trash')}${esc(t('del'))}</button></div><button class="btn p" data-savei>${ic('check')}${esc(t('save'))}</button></div>`;
    $('#sm').oninput = e => $('#mv').textContent = e.target.value; ['sfs', 'sco', 'srp'].forEach(id => $('#' + id).onclick = e => e.currentTarget.classList.toggle('on')); return;
  }
  if (S.tab === 'notes') {
    box.innerHTML = `<div class="card"><textarea id="nt" rows="10" style="width:100%" maxlength="20000" placeholder="${esc(t('notesPh'))}">${esc(i.notes || '')}</textarea></div>`;
    let tm; $('#nt').oninput = e => { clearTimeout(tm); tm = setTimeout(() => api('inst:update', { id: i.id, patch: { notes: e.target.value } }).then(r => { i.notes = r.notes; }).catch(() => {}), 600); }; return;
  }
  if (S.tab === 'worlds') {
    box.innerHTML = `<div class="mu">${esc(t('loading'))}</div>`;
    try { const w = await api('inst:worlds', i.id); if (!$('#tabc')) return;
      $('#tabc').innerHTML = `<div class="row" style="margin-bottom:12px"><button class="btn sm" data-worldsdir>${ic('folder')}${esc(t('openFolder'))}</button><button class="btn sm" data-restore>${ic('history')}${esc(t('bkpRestore'))}</button></div>` +
        (w.length ? w.map(x => `<div class="card item" style="padding:10px 14px"><div class="grow"><b>${esc(x.name)}</b><div class="mu sm">${esc(sizeMB(x.size))} · ${esc(fmtDate(x.time))}</div></div></div>`).join('') : `<div class="card empty">${esc(t('worldsEmpty'))}</div>`);
    } catch (e) { $('#tabc').innerHTML = `<div class="card empty">${esc(e.message)}</div>`; } return;
  }
  box.innerHTML = `<div class="mu">${esc(t('loading'))}</div>`;
  try {
    const rows = await api('inst:content', { id: i.id, kind: S.tab });
    if (!$('#tabc')) return;
    $('#tabc').innerHTML = `<div class="row" style="margin-bottom:12px"><button class="btn sm p" data-addc>${ic('plus')}${esc(t('install'))}</button><button class="btn sm" data-addfile>${ic('import')}${esc(t('addFile'))}</button><button class="btn sm ic" data-tabfolder title="${esc(t('openFolder'))}">${ic('folder')}</button>${S.tab === 'mods' ? `<button class="btn sm" data-updall>${ic('refresh')}${esc(t('updAll'))}</button>` : ''}<span class="mu sm">${rows.length}</span></div>` +
      (rows.length ? rows.map(r => `<div class="card item ${r.enabled ? '' : 'off'}" style="padding:10px 14px">${r.icon ? `<img class="ico" src="${esc(r.icon)}" alt="">` : `<div class="ico"></div>`}<div class="grow"><b>${esc(r.title)}</b><div class="mu sm">${esc(r.version || r.file)}</div></div>
      ${r.pid ? `<button class="btn sm" data-ver="${esc(r.file)}" title="${esc(t('pickVer'))}">${ic('tag')}${esc(t('pickVer'))}</button>` : ''}<button class="sw ${r.enabled ? 'on' : ''}" data-tg="${esc(r.file)}"></button><button class="btn ic bad" data-rm="${esc(r.file)}">${ic('trash')}</button></div>`).join('') : `<div class="card empty">${esc(t('empty'))}</div>`);
  } catch (e) { $('#tabc').innerHTML = `<div class="card empty">${esc(e.message)}</div>`; }
}

/* ---------- Каталог ---------- */
function viewDiscover() {
  const c = S.catalog, tg = S.target && inst(S.target);
  if (tg && !c.version) { c.version = tg.mc; c.loader = tg.loader === 'vanilla' ? '' : tg.loader; }
  const types = [['mod', t('mods')], ['modpack', t('modpacks')], ['resourcepack', t('packs')], ['shader', t('shaders')]];
  V(`<div class="top"><h1>${esc(t('discover'))}</h1>${tg ? `<div class="row"><button class="btn sm" data-untarget>${esc(t('install'))}: <b>${esc(tg.name)}</b> ${ic('x')}</button><button class="btn sm p" data-donetarget="${esc(tg.id)}">${ic('check')}${esc(t('done'))}</button></div>` : ''}</div>
  <div class="search">${ic('search')}<input id="q" type="search" placeholder="${esc(t('search'))}" value="${esc(c.q)}"><select id="cl"><option value="">${esc(t('loader'))}: ${esc(t('any'))}</option>${LOADERS.slice(1).map(l => `<option value="${l}" ${c.loader === l ? 'selected' : ''}>${LN[l]}</option>`).join('')}</select>
  <input id="cv" placeholder="1.21.1" size="7" value="${esc(c.version)}" style="width:96px"></div>
  <div class="row" style="margin-top:12px;gap:10px;flex-wrap:wrap"><span class="mu sm">${esc(t('srcLabel'))}</span><div class="pill">${[['modrinth', 'Modrinth'], ['curseforge', 'CurseForge']].map(([k, n]) => `<button data-src="${k}" class="${(c.src || 'modrinth') === k ? 'on' : ''}">${n}</button>`).join('')}</div>${c.src === 'curseforge' ? `<span class="mu sm">${esc(t('cfNote'))}</span>` : ''}</div>
  <div class="pill" style="margin:14px 0">${types.map(([k, n]) => `<button data-ctype="${k}" class="${c.type === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div><div id="res" style="display:grid;gap:10px"></div>`);
  const q = $('#q'); let tm; q.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { c.q = q.value; search(); }, 350); };
  $('#cl').onchange = e => { c.loader = e.target.value; search(); }; $('#cv').onchange = e => { c.version = e.target.value.trim(); search(); };
  if (c.res) drawRes(); else search();
}
async function search(keep) {
  const c = S.catalog; if (!keep) c.page = 0; $('#res').innerHTML = `<div class="mu">${esc(t('loading'))}</div>`;
  try { const r = await api('cat:search', { query: c.q, type: c.type, loader: c.loader, version: c.version, src: c.src || 'modrinth', offset: c.page * 20 }); c.res = r.hits; c.total = r.total; c.hasNext = r.total >= 0 ? (c.page + 1) * 20 < r.total : r.hits.length >= 20; drawRes(); }
  catch (e) { if ($('#res')) $('#res').innerHTML = `<div class="card empty">${esc(e.message)} <button class="btn sm" data-retry>${ic('refresh')}</button></div>`; }
}
function drawRes() {
  const r = $('#res'); if (!r) return;
  r.innerHTML = (S.catalog.res || []).map(h => `<div class="card item" data-proj="${esc(h.id)}" style="cursor:pointer"><img class="ico" src="${esc(h.icon || '')}" alt=""><div class="grow"><b>${esc(h.title)}</b> <span class="mu sm">· ${esc(h.author || '')}</span><div class="ds">${esc(h.desc)}</div><div class="mu sm">⬇ ${fmt(h.downloads)} ${(h.loaders || []).slice(0, 4).map(l => `<span class="tag">${esc(l)}</span>`).join(' ')}</div></div>
  <button class="btn p sm" data-getp="${esc(h.id)}" data-ptype="${esc(h.type)}" data-psrc="${esc(h.src || 'modrinth')}" data-ptitle="${esc(h.title)}">${ic('download')}${esc(t('install'))}</button></div>`).join('') || `<div class="card empty">${esc(t('empty'))}</div>`;
  const c = S.catalog;
  if ((c.res || []).length && (c.page > 0 || c.hasNext)) r.insertAdjacentHTML('beforeend', `<div class="row" style="justify-content:center;gap:14px;padding:10px"><button class="btn" data-pg="-1" ${c.page ? '' : 'disabled'}>${ic('back')}${esc(t('prev'))}</button><span class="mu">${esc(t('page'))} ${c.page + 1}${c.total > 0 ? ' / ' + Math.ceil(c.total / 20) : ''}</span><button class="btn" data-pg="1" ${c.hasNext ? '' : 'disabled'}>${esc(t('next'))}</button></div>`);
}
const doInstall = async (instId, id, src, ver) => {
  if (src === 'curseforge') { const h = (S.catalog.res || []).find(x => String(x.id) === String(id)) || {}; return api('inst:installCF', { id: instId, project: id, file: ver || undefined, meta: { title: h.title, icon: h.icon, type: S.pendingKind || S.catalog.type } }); }
  return api('inst:install', { id: instId, project: id });
};
async function installProject(id, type, src) {
  S.pendingSrc = src || 'modrinth'; S.pendingVer = '';
  await run(async () => {
    if (type === 'modpack') return afterPack(await api('inst:installModpack', { project: id, src: S.pendingSrc, title: S.pendingTitle || ((S.catalog.res || []).find(x => String(x.id) === String(id)) || {}).title }));
    S.pendingKind = type || S.catalog.type || 'mod';
    const tg = S.target && inst(S.target);
    if (!tg) return pickInstanceModal(id);
    return versionChoice(tg.id, id);
  });
}
// Deep link salauncher://install: подтверждение -> выбор сборки -> выбор версии (с предвыбранной запрошенной)
async function deepLink(l) {
  if (!l) return;
  if (l.kind === 'build') { go('builds'); if (!S.builds) { try { S.builds = await api('build:list'); } catch (e) { return fail(e); } } if (!(S.builds || []).some(b => b.id === l.id)) return toast(t('dlBad'), 'err'); return buildModal(l.id); } S.pendingVer = l.version || ''; S.pendingSrc = l.src; S.pendingKind = l.type;
  modal(`<div class="mu">${esc(t('loading'))}</div>`);
  let p = null;
  if (l.src === 'modrinth') { try { p = await api('cat:project', l.project); } catch (e) { closeModal(); return fail(e); } if (p.project_type !== l.type) { closeModal(); return toast(t('dlBad'), 'err'); } }
  const tn = { mod: t('mods'), modpack: t('modpacks'), resourcepack: t('packs'), shader: t('shaders') }[l.type];
  modal(`<h2>${ic('download')} ${esc(t('dlT'))}</h2>
  <div class="row gap">${p && p.icon_url ? `<img class="ico" style="width:64px;height:64px;border-radius:20px" src="${esc(p.icon_url)}" alt="">` : ''}<div class="grow"><b>${esc(p ? p.title : 'CurseForge #' + l.project)}</b>${p ? `<div class="mu sm">${esc(p.description || '')}</div>` : ''}</div></div>
  <p class="mu sm">${esc(t('srcLabel'))}: <b>${l.src === 'curseforge' ? 'CurseForge' : 'Modrinth'}</b> · ${esc(t('dlType'))}: <span class="tag">${esc(tn)}</span></p>
  <div class="card"><span class="sm">${esc(t('dlWarn'))}</span></div>
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn p" id="dlgo">${esc(t('dlNext'))}</button></div>`);
  $('#dlgo').onclick = () => run(async () => {
    if (l.type === 'modpack') { closeModal(); return afterPack(await api('inst:installModpack', { project: l.project, version: l.src === 'curseforge' ? l.version : undefined, src: l.src })); }
    S.catalog.res = S.catalog.res || []; S.catalog.res.push({ id: l.project, src: l.src, title: p ? p.title : '', icon: p ? p.icon_url : '', type: l.type });
    return pickInstanceModal(l.project);
  });
}
async function pickInstanceModal(projectId) {
  if (!S.instances.length) { toast(t('emptyLib'), 'err'); return newInstanceModal(); }
  modal(`<h2>${esc(t('choose'))}</h2><div class="mu">${esc(t('loading'))}</div>`);
  let ok = {}; try { ok = await api('inst:compat', { project: projectId, src: S.pendingSrc, kind: S.pendingKind }); } catch (_) {}
  modal(`<h2>${esc(t('install'))}</h2>${S.instances.map(i => { const good = ok[i.id] !== false; return `<button class="opt" ${good ? `data-pick="${esc(i.id)}"` : 'disabled'} style="${good ? '' : 'opacity:.45;filter:grayscale(1);cursor:not-allowed'}">${tile(i, 'sm')}<div class="grow"><b>${esc(i.name)}</b><div class="mu sm">${good ? `${esc(i.mc)} · ${LN[i.loader]}` : esc(t('unavailable'))}</div></div></button>`; }).join('')}<div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button></div>`);
  $('#modal').onclick = e => {
    if (e.target.id === 'modal' || e.target.closest('[data-close]')) return closeModal();
    const b = e.target.closest('[data-pick]'); if (b) versionChoice(b.dataset.pick, projectId);
  };
}
// Выбор версии мода перед установкой (по умолчанию — последняя подходящая)
async function versionChoice(instId, projectId, all) {
  const i = inst(instId);
  modal(`<h2>${ic('tag')} ${esc(t('pickVer'))}</h2><div class="mu">${esc(t('loading'))}</div>`);
  let vs; try { vs = await api('inst:projVersions', { id: instId, project: projectId, src: S.pendingSrc, kind: S.pendingKind, all: !!all }); } catch (e) { closeModal(); return fail(e); }
  const doit = async ver => { closeModal(); await run(async () => {
    const l = S.pendingSrc === 'curseforge'
      ? await doInstall(instId, projectId, 'curseforge', ver)
      : await api('inst:install', { id: instId, project: projectId, version: ver || undefined });
    toast(t('installed') + ': ' + l.join(', '), 'ok'); if (S.view === 'inst' && S.instId === instId) renderTab(); }); };
  if (!vs.length && !all) { modal(`<h2>${ic('tag')} ${esc(t('pickVer'))} · ${esc(i.name)}</h2><div class="card empty">${esc(t('unavailable'))}</div><label class="row sm mu" style="margin-top:10px"><button class="sw" id="va"></button>${esc(t('allVer'))}</label><div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button></div>`); $('#va').onclick = () => versionChoice(instId, projectId, true); return; }
  const rq = S.pendingVer ? vs.find(v => String(v.id) === String(S.pendingVer) && v.ok) : null;
  if (rq) vs = [rq, ...vs.filter(v => v !== rq)];
  modal(`<h2>${ic('tag')} ${esc(t('pickVer'))} · ${esc(i.name)} (${esc(i.mc)})</h2>
  <label class="row sm mu" style="margin-bottom:8px"><button class="sw ${all ? 'on' : ''}" id="va"></button>${esc(t('allVer'))}</label>
  <div style="max-height:52vh;overflow:auto;display:grid;gap:6px">
  ${vs.length && !rq ? `<button class="opt on" data-v=""><div class="grow"><b>${esc(t('latest'))}</b></div></button>` : ''}
  ${vs.map(v => `<button class="opt ${rq && v === rq ? 'on' : ''}" data-v="${esc(v.id)}" ${v.ok ? '' : 'disabled style="opacity:.45"'}><div class="grow"><b>${esc(v.number || v.name)}</b> <span class="tag">${esc(rq && v === rq ? t('dlReq') : (v.type || ''))}</span><div class="mu sm">${esc((v.mc || []).slice(-4).join(', '))} · ${esc((v.loaders || []).join(', '))}</div></div></button>`).join('')}</div>
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button></div>`);
  $('#va').onclick = () => versionChoice(instId, projectId, !all);
  $$('[data-v]').forEach(b => b.onclick = () => doit(b.dataset.v));
  $('#modal').onclick = e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); };
}

/* ---------- Настройки ---------- */
// Полоска навигации по разделам настроек (вверху, в одной строке с заголовком; липкая): прокрутка к разделу и подсветка текущего
const SETSEC = [['sx-mode', 'tool', 'uiMode'], ['sx-look', 'shirt', 'appearance'], ['sx-lang', 'globe', 'language'], ['sx-game', 'play', 'secGame'], ['sx-ui', 'compass', 'secUi'], ['sx-sys', 'gear', 'secSys'], ['sx-app', 'refresh', 'launcher'], ['sx-acc', 'user', 'accounts']];
function setNav() {
  const nav = $('#setnav'), view = $('#view'); if (!nav) return;
  const mark = id => nav.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.sx === id));
  mark(SETSEC[0][0]);
  nav.onclick = e => { const b = e.target.closest('[data-sx]'); if (!b) return; const h = document.getElementById(b.dataset.sx); if (!h) return; mark(b.dataset.sx); h.scrollIntoView({ behavior: document.documentElement.dataset.lite ? 'auto' : 'smooth', block: 'start' }); };
  let raf = 0;
  const spy = () => { raf = 0; const vt = view.getBoundingClientRect().top + 96; let cur = SETSEC[0][0];
    for (const [id] of SETSEC) { const h = document.getElementById(id); if (h && h.getBoundingClientRect().top <= vt) cur = id; }
    if (view.scrollTop + view.clientHeight >= view.scrollHeight - 4) cur = SETSEC[SETSEC.length - 1][0];
    mark(cur); };
  const onScroll = () => { if (!raf) raf = requestAnimationFrame(spy); };
  view.addEventListener('scroll', onScroll, { passive: true });
  setObs = { disconnect() { view.removeEventListener('scroll', onScroll); if (raf) cancelAnimationFrame(raf); } };
}
function viewSettings() {
  const s = S.settings;
  V(`<div class="top settop"><h1>${esc(t('settings'))}</h1><nav class="setnav" id="setnav">${SETSEC.map(([id, ic_, k]) => `<button data-sx="${id}" title="${esc(t(k))}">${ic(ic_)}<span>${esc(t(k))}</span></button>`).join('')}</nav><button class="btn" data-site>${ic('globe')}${esc(t('openSite'))}</button></div>
  <div class="setwrap"><div class="setmain">
  <h2 id="sx-mode" style="margin-top:6px">${esc(t('uiMode'))}</h2><div class="card"><div class="seg">${[['simple', t('modeSimple')], ['advanced', t('modeAdv')]].map(([k, n]) => `<button data-uimode="${k}" class="${(adv() ? 'advanced' : 'simple') === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div><div class="mu sm" style="margin-top:8px">${esc(adv() ? t('modeAdvD') : t('modeSimpleD'))}</div></div>
  <h2 id="sx-look">${esc(t('appearance'))}</h2><div class="card">
   <label class="lab" style="margin-top:0">${esc(t('theme'))}</label><div class="themes">${THEMES.map(([k, bg, c]) => `<button class="th ${s.theme === k ? 'on' : ''}" data-th="${k}"><div class="pv" style="background:${bg};--c:${k === 'custom' ? '#fff' : s.accent}"></div>${esc(t({ dark: 'dark', light: 'light', amoled: 'amoled', glass: 'glass', glasslight: 'glass', cold: 'snow', warm: 'sun', autumn: 'leaves', spring: 'rain', night: 'night', custom: 'custom' }[k]))}${k === 'glasslight' ? ' ☀' : ''}</button>`).join('')}</div>
   <label class="lab">${esc(t('accent'))}</label><div class="row wrap">${ACCENTS.map(c => `<button class="swatch ${s.accent === c ? 'on' : ''}" data-acc-c="${c}" style="background:${c}"></button>`).join('')}<label class="swatch cust ${ACCENTS.includes(s.accent) ? '' : 'on'}" title="${esc(t('custom'))}" style="background:${ACCENTS.includes(s.accent) ? 'conic-gradient(#f87171,#facc15,#4ade80,#22d3ee,#4f8cff,#a78bfa,#f87171)' : esc(s.accent)}"><input type="color" id="accc" value="${esc(s.accent)}" style="opacity:0;width:100%;height:100%;cursor:pointer"></label></div>
   ${s.theme === 'custom' ? `<div class="row gap wrap" style="margin-top:6px"><div><label class="lab">${esc(t('bg'))}</label><input type="color" id="cbg" value="${esc(s.customBg)}"></div><div><label class="lab">${esc(t('card'))}</label><input type="color" id="ccd" value="${esc(s.customCard)}"></div></div>${bgSettingsHTML()}` : ''}</div>
  <h2 id="sx-lang">${esc(t('language'))}</h2><div class="langs">${LANG_LIST.map(([c, n]) => `<button class="${s.lang === c ? 'on' : ''}" data-lang="${c}">${esc(n)}</button>`).join('')}</div>
  <h2 id="sx-game">${esc(t('secGame'))}</h2><div class="card">
   <label class="lab" style="margin-top:0">${esc(t('memory'))}: <b id="gm">${s.memory}</b></label><input type="range" id="gmr" min="1024" max="16384" step="512" value="${s.memory}">
   ${adv() ? `<label class="lab">${esc(t('jvmArgs'))}</label><input id="gj" style="width:100%" value="${esc(s.jvmArgs || '')}"><label class="lab">Java</label><input id="gjp" style="width:100%" placeholder="auto" value="${esc(s.javaPath || '')}">` : ''}
   <label class="lab">${esc(t('defWindow'))}</label><div class="row gap wrap"><input id="gw" type="number" min="320" placeholder="${esc(t('width'))}" value="${esc(s.width || '')}" style="width:120px"><span class="mu">×</span><input id="gh" type="number" min="240" placeholder="${esc(t('height'))}" value="${esc(s.height || '')}" style="width:120px"><label class="row sm mu"><button class="sw ${s.fullscreen ? 'on' : ''}" data-tgf="fullscreen"></button>${esc(t('fullscreen'))}</label></div>
   <div style="margin-top:10px"><div class="setrow"><div class="grow">${esc(t('autoMem'))}<small>${esc(t('autoMemD'))}</small></div><button class="sw ${s.autoMem ? 'on' : ''}" data-tgf="autoMem"></button></div><div class="setrow"><div class="grow">${esc(t('aikar'))}<small>${esc(t('aikarD'))}</small></div><button class="sw ${s.aikar ? 'on' : ''}" data-tgf="aikar"></button></div><div class="setrow"><div class="grow">${esc(t('minimize'))}</div><button class="sw ${s.minimizeOnLaunch ? 'on' : ''}" data-tgf="minimizeOnLaunch"></button></div><div class="setrow"><div class="grow">${esc(t('reopen'))}</div><button class="sw ${s.reopen ? 'on' : ''}" data-tgf="reopen"></button></div><div class="setrow"><div class="grow">${esc(t('openLogs'))}</div><button class="sw ${s.openLogs ? 'on' : ''}" data-tgf="openLogs"></button></div><div class="setrow"><div class="grow">${esc(t('notify'))}</div><button class="sw ${s.notify !== false ? 'on' : ''}" data-tgl="notify"></button></div><div class="setrow"><div class="grow">${esc(t('autoFix'))}</div><button class="sw ${s.autoFix !== false ? 'on' : ''}" data-tgl="autoFix"></button></div><div class="setrow"><div class="grow">${esc(t('bkpAuto'))}<small>${esc(t('bkpAutoD'))}</small></div><button class="sw ${s.backupWorlds !== false ? 'on' : ''}" data-tgl="backupWorlds"></button></div><div class="setrow"><div class="grow">${esc(t('discord'))}</div><button class="sw ${s.discord !== false ? 'on' : ''}" data-tgl="discord"></button></div></div>
   ${adv() ? `<label class="lab">${esc(t('discordId'))}</label><input id="gdi" style="width:100%" placeholder="1234567890123456789" value="${esc(s.discordClientId || '')}">` : ''}</div>
  <h2 id="sx-ui">${esc(t('secUi'))}</h2><div class="card">
   <div class="setrow"><div class="grow">${esc(t('uiScale'))}</div><input type="range" id="gus" min="80" max="130" step="5" value="${s.uiScale || 100}"><b id="gusv" style="width:48px;text-align:right">${s.uiScale || 100}%</b></div>
   <div class="setrow"><div class="grow">${esc(t('blur'))}</div><input type="range" id="gbl" min="0" max="60" step="2" value="${s.blur == null ? 30 : s.blur}"></div>
   <div class="setrow"><div class="grow">${esc(t('anims'))}</div><button class="sw ${s.anims !== false ? 'on' : ''}" data-tgl="anims"></button></div>
   <div class="setrow"><div class="grow">${esc(t('lite'))}<small>${esc(t('liteD'))}</small></div><button class="sw ${s.lite === true ? 'on' : ''}" data-tgf="lite"></button></div>
   <div class="setrow"><div class="grow">${esc(t('paneMax'))}<small>${esc(t('paneMaxD'))}</small></div><input type="range" id="gpm" min="0" max="20" step="1" value="${s.paneMax == null ? 14 : s.paneMax}"><b id="gpmv" style="width:28px;text-align:right">${s.paneMax == null ? 14 : s.paneMax}</b></div>
   <div class="setrow"><div class="grow">${esc(t('sortLib'))}</div><select id="gsort">${[['recent', t('sRecent')], ['name', t('sName')], ['playtime', t('sPlay')]].map(([k, n]) => `<option value="${k}" ${(s.sort || 'recent') === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
   <div class="setrow"><div class="grow">${esc(t('defLoader'))}</div><select id="gdl">${LOADERS.map(l => `<option value="${l}" ${(s.defLoader || 'fabric') === l ? 'selected' : ''}>${LN[l]}</option>`).join('')}</select></div>
   <div class="setrow"><div class="grow">${esc(t('defSnaps'))}</div><button class="sw ${s.defSnaps ? 'on' : ''}" data-tgf="defSnaps"></button></div></div>
  <h2 id="sx-sys">${esc(t('secSys'))}</h2><div class="card">
   <div class="setrow"><div class="grow">${esc(t('startup'))}</div><button class="sw ${s.startup ? 'on' : ''}" data-tgf="startup"></button></div>
   <div class="setrow"><div class="grow">${esc(t('checkUpd'))}</div><button class="sw ${s.checkUpdates !== false ? 'on' : ''}" data-tgl="checkUpdates"></button></div>
   <div class="foot" style="margin-top:10px"><button class="btn" data-opendata>${ic('folder')}${esc(t('openData'))}</button><button class="btn" data-clrcache>${ic('trash')}${esc(t('clearCache'))}</button><button class="btn bad" data-resets>${ic('refresh')}${esc(t('resetS'))}</button></div></div>
  <h2 id="sx-app">${esc(t('launcher'))}</h2><div class="card"><div class="row"><div class="grow"><b>SA Launcher ${esc(S.version || '')}</b><div class="mu sm" id="lstat">${esc(S.lupd ? (S.lupd.available ? t('newVer') + ': ' + S.lupd.latest : t('upToDate')) : '')}</div></div><button class="btn" data-go="about">${ic('info')}${esc(t('aboutBtn'))}</button><button class="btn p" data-launcher-upd>${ic('refresh')}${esc(t('updLauncher'))}</button></div></div>
  <h2 id="sx-acc">${esc(t('accounts'))}</h2><div id="accs" class="card">${accountsHTML()}</div></div></div>`);
  setNav();
  if ($('#gdi')) $('#gdi').onchange = e => setS({ discordClientId: e.target.value.trim() });
  $('#gmr').oninput = e => { $('#gm').textContent = e.target.value; }; $('#gmr').onchange = e => setS({ memory: +e.target.value });
  $('#gw').onchange = e => setS({ width: e.target.value.trim() }); $('#gh').onchange = e => setS({ height: e.target.value.trim() });
  $('#gus').oninput = e => { $('#gusv').textContent = e.target.value + '%'; }; $('#gus').onchange = e => setS({ uiScale: +e.target.value });
  $('#gpm').oninput = e => { const v = +e.target.value; $('#gpmv').textContent = v; S.settings.paneMax = v; SAWeather.setMax(v); api('settings:set', { paneMax: v }).catch(() => {}); }; $('#gbl').oninput = e => setS({ blur: +e.target.value }); $('#gsort').onchange = e => setS({ sort: e.target.value }); $('#gdl').onchange = e => setS({ defLoader: e.target.value });
  if ($('#gj')) { $('#gj').onchange = e => setS({ jvmArgs: e.target.value }); $('#gjp').onchange = e => setS({ javaPath: e.target.value.trim() }); }
  $('#accc').oninput = e => { setS({ accent: e.target.value }); const c = e.target.closest('.cust'); c.style.background = e.target.value; document.querySelectorAll('.swatch.on').forEach(x => x.classList.remove('on')); c.classList.add('on'); renderRail(); };
  if ($('#bgdim')) $('#bgdim').oninput = e => { const v = +e.target.value; setS({ customBgDim: v }); document.querySelectorAll('.bgbig').forEach(x => x.style.setProperty('--dim', v)); };
  if ($('#cbg')) { $('#cbg').oninput = e => setS({ customBg: e.target.value }); $('#ccd').oninput = e => setS({ customCard: e.target.value }); }
}

// «Своя тема»: свой фон (PNG/JPG/WEBP/GIF) — список загруженных, предпросмотр, замена, удаление, затемнение для читаемости
function bgSettingsHTML() {
  const s = S.settings, list = s.customBgs || [], cur = list.find(b => b.id === s.customBgSel);
  const dim = s.customBgDim == null ? 40 : s.customBgDim, fit = s.customBgFit === 'contain' ? 'contain' : 'cover';
  return `<label class="lab">${esc(t('bgImage'))}</label>
  ${cur ? `<div class="bgbig" style="--dim:${dim};--fit:${fit}"><img id="bgprev" src="${esc(bgUrl(cur))}" alt=""><i class="fk"></i><i class="fk2"></i></div><div class="mu sm" style="margin-top:6px">${esc(cur.name)} · ${esc(cur.ext.toUpperCase())} · ${(cur.size / 1048576).toFixed(1)} MB</div>` : `<div class="mu sm">${esc(t('bgNone'))}</div>`}
  <div class="row wrap" style="margin-top:10px"><button class="btn p sm" data-bgadd>${ic('plus')}${esc(t('bgUpload'))}</button>${cur ? `<button class="btn sm" data-bgrep="${esc(cur.id)}">${ic('refresh')}${esc(t('bgReplace'))}</button><button class="btn sm bad" data-bgdel="${esc(cur.id)}">${ic('trash')}${esc(t('bgDelete'))}</button>` : ''}</div>
  ${list.length > 1 ? `<div class="bgp">${list.map(b => `<button class="bgt ${b.id === s.customBgSel ? 'on' : ''}" data-bgsel="${esc(b.id)}" title="${esc(b.name)}"><img src="${esc(bgUrl(b))}" alt="" loading="lazy">${b.ext === 'gif' ? '<span class="tag">GIF</span>' : ''}</button>`).join('')}</div>` : ''}
  ${cur ? `<div class="setrow"><div class="grow">${esc(t('bgDim'))}<small>${esc(t('bgDimD'))}</small></div><input type="range" id="bgdim" min="0" max="85" step="5" value="${dim}"></div>
  <div class="setrow"><div class="grow">${esc(t('bgFit'))}</div><div class="seg">${[['cover', t('bgFill')], ['contain', t('bgContain')]].map(([k, n]) => `<button data-bgfit="${k}" class="${fit === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div></div>` : ''}`;
}
function accountsHTML() {
  return (S.accounts.length ? S.accounts.map(a => `<div class="row" style="padding:6px 0">${head(a)}<div class="grow"><b>${esc(a.name)}</b><div class="mu sm">${esc(a.p === 'ely' ? 'Ely.by' : t('ms'))}</div></div>
  ${a.id === S.settings.selected ? `<span class="tag">✓</span>` : `<button class="btn sm" data-selacc="${esc(a.id)}">${esc(t('play'))}</button>`}<button class="btn ic sm bad" data-rmacc="${esc(a.id)}">${ic('x')}</button></div>`).join('') : `<div class="mu" style="padding:6px 0">${esc(t('noAcc'))}</div>`)
    + `<div class="foot" style="justify-content:flex-start"><button class="btn p" data-login>${ic('user')}${esc(S.accounts.length ? t('addAcc') : t('signIn'))}</button><button class="btn" data-ely>${ic('user')}${esc(t('elyBtn'))}</button></div><div class="mu sm">${esc(t('ms'))}</div><div class="mu sm" style="margin-top:6px">${esc(t('elyNote'))}</div>`;
}

/* ---------- модальные окна ---------- */
function modal(html) { const m = $('#modal'); m.classList.remove('hide'); m.innerHTML = `<div class="modal-box">${html}</div>`; m.onclick = e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); }; }
const closeModal = () => { $('#modal').classList.add('hide'); $('#modal').innerHTML = ''; $('#modal').onclick = null; };

function accountsModal() {
  modal(`<h2>${esc(t('accounts'))}</h2><div id="accm">${accountsHTML()}</div><div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button></div>`);
}
function elyModal() {
  modal(`<h2>${esc(t('elyTitle'))}</h2><div class="mu sm" style="margin-bottom:12px">${esc(t('elyNote'))}</div>
  <div style="display:grid;gap:8px"><input id="elyu" placeholder="${esc(t('elyUser'))}" autocomplete="username" spellcheck="false"><input id="elyp" type="password" placeholder="${esc(t('elyPass'))}" autocomplete="current-password"><input id="elyt" placeholder="${esc(t('elyTotp'))}" inputmode="numeric" maxlength="8" autocomplete="one-time-code" style="display:none"></div>
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn p" id="elygo">${esc(t('signIn'))}</button></div>`);
  const go = async () => {
    const b = $('#elygo'); if (!b || b.disabled) return; b.disabled = true;
    try {
      const r = await api('auth:ely', { username: $('#elyu').value, password: $('#elyp').value, totp: $('#elyt').value });
      S.accounts = r.accounts; S.settings.selected = r.selected; toast(t('done'), 'ok'); closeModal(); renderRail(); renderView();
      if (S.afterLogin) { const f = S.afterLogin; S.afterLogin = null; f(); }
    } catch (e) {
      const bb = $('#elygo'); if (bb) bb.disabled = false;
      if (String(e.message).includes('err:ely2fa')) { const x = $('#elyt'); if (x) { x.style.display = ''; x.focus(); } }
      fail(e);
    }
  };
  $('#elygo').onclick = go; ['#elyu', '#elyp', '#elyt'].forEach(id => { $(id).onkeydown = e => { if (e.key === 'Enter') go(); }; }); $('#elyu').focus();
}
async function doLogin(btn) {
  if (btn) { btn.disabled = true; btn.innerHTML = esc(t('waiting')); }
  const fin = () => { if (!$('#modal').classList.contains('hide')) closeModal(); renderRail(); renderView(); };
  try { const r = await api('auth:login'); S.accounts = r.accounts; S.settings.selected = r.selected; toast(t('done'), 'ok'); fin(); if (S.afterLogin) { const f = S.afterLogin; S.afterLogin = null; f(); } }
  catch (e) {
    // Окно Microsoft закрыли или вход не удался: возвращаем кнопки в рабочий вид (раньше при «cancel» кнопка оставалась «Ждём вход…» и не нажималась)
    if (!String(e.message).includes('cancel')) fail(e);
    refreshAcc(); if (!$('#accm')) renderView();
  }
}

// «Новая сборка»: две большие кнопки — своя (как в Prism) и из каталога (как в Modrinth)
async function newInstanceModal(mode) {
  if (!mode) return modeModal();
  return ['modrinth', 'curseforge', 'ftb', 'atl', 'technic'].includes(mode) ? packModal(mode) : adv() ? prismModal() : wizardModal();
}
// Переключатель «Простой / Расширенный» — тот же, что в настройках, но прямо в окне создания сборки
const uiSeg = () => `<div class="seg uiseg">${[['simple', t('modeSimple')], ['advanced', t('modeAdv')]].map(([k, n]) => `<button data-uimodal="${k}" class="${(adv() ? 'advanced' : 'simple') === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div>`;
// Две главные кнопки: своя сборка (как в Prism) и сборка из каталога (как в Modrinth). Остальное — мелкими кнопками ниже.
function modeModal() {
  const small = (i, label, attrs) => `<button class="btn sm" ${attrs}>${ic(i)}${esc(label)}</button>`;
  modal(`<div class="row gap wrap" style="justify-content:space-between;align-items:center"><h2 style="margin:0">${ic('plus')} ${esc(t('newInst'))}</h2>${uiSeg()}</div>
  <div class="modes" style="margin-top:12px"><button class="mode" data-nmode="custom">${ic('gear')}<b>${esc(t('modeCustom'))}</b><span>${esc(t('modeCustomD'))}</span><i class="tag">Prism</i></button>
  <button class="mode" data-nmode="modrinth">${ic('compass')}<b>${esc(t('modeMr'))}</b><span>${esc(t('modeMrD'))}</span><i class="tag">Modrinth</i></button></div>
  <div class="row gap wrap" style="margin-top:14px">${small('import', t('importPack'), 'data-import data-close')}${small('box', t('saBuilds'), 'data-go="builds" data-close')}${small('share', t('shareHave'), 'data-code')}</div>
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button></div>`);
}
// Окно «Своя сборка» в стиле Prism: слева источники (Пользовательский, Импорт, ATLauncher, CurseForge, FTB, Modrinth, Technic),
// справа — форма своей сборки. Новый источник подключается записью в этот список (soon: true — «скоро»).
const PACK_SOURCES = [
  { k: 'custom', i: 'gear', n: () => t('modeCustom'), d: 'modeCustomD', form: true },
  { k: 'import', i: 'import', n: () => t('importPack'), d: 'srcImportD', act: 'data-import data-close' },
  { k: 'atl', i: 'box', n: () => 'ATLauncher', cat: true },
  { k: 'curseforge', i: 'compass', n: () => 'CurseForge', cat: true },
  { k: 'ftb', i: 'box', n: () => 'FTB', cat: true },
  { k: 'modrinth', i: 'compass', n: () => 'Modrinth', cat: true },
  { k: 'technic', i: 'box', n: () => 'Technic', cat: true }
];
function prismModal(sel = 'custom') {
  const pane = k => {
    const x = PACK_SOURCES.find(y => y.k === k) || PACK_SOURCES[0];
    if (x.form || x.cat) return '<div id="cf"></div>';
    return `<h2 style="margin-top:0">${ic(x.i)} ${esc(x.n())}</h2><p class="mu">${esc(t(x.d))}</p>` + (x.soon
      ? `<div class="card" style="border-color:var(--warn)"><b>${esc(t('srcSoon'))}</b><div class="sm mu" style="margin-top:4px">${esc(tf('srcSoonD', [x.n()]))}</div></div><div class="row gap wrap" style="margin-top:14px"><button class="btn p" data-import data-close>${ic('import')}${esc(t('importPack'))}</button></div>`
      : `<div class="row gap wrap" style="margin-top:14px"><button class="btn p" ${x.act}>${ic(x.i)}${esc(t('importPack'))}</button></div>`);
  };
  const mount = k => { const x = PACK_SOURCES.find(y => y.k === k); if (x && x.form) customModal($('#cf')); else if (x && x.cat) packPane($('#cf'), x.k, false); };
  modal(`<i class="wide" hidden></i><div class="row gap wrap" style="justify-content:space-between;align-items:center"><h2 style="margin:0">${ic('gear')} ${esc(t('modeCustom'))}</h2>${uiSeg()}</div><div class="srcs" style="margin-top:12px"><div class="srcl">${PACK_SOURCES.map(x => `<button class="src ${x.k === sel ? 'on' : ''}" data-srcsel="${x.k}">${ic(x.i)}<span>${esc(x.n())}</span>${x.soon ? `<small>${esc(t('srcSoon'))}</small>` : ''}</button>`).join('')}</div><div class="srcp" id="srcp">${pane(sel)}</div></div>
  <div class="foot"><button class="btn" data-nmode="">${ic('back')}${esc(t('prev'))}</button><button class="btn" data-close>${esc(t('cancel'))}</button></div>`);
  $('.srcl').onclick = e => { const b = e.target.closest('[data-srcsel]'); if (!b) return; $$('.src').forEach(x => x.classList.toggle('on', x === b)); $('#srcp').innerHTML = pane(b.dataset.srcsel); mount(b.dataset.srcsel); };
  mount(sel);
}
// Поиск готовых сборок прямо в окне: Modrinth (.mrpack) и CurseForge (.zip)
/* ---------- Мастер создания сборки SA (простой режим): версия и ядро → моды и ресурспаки → проверка → создать ---------- */
let W = null;
async function wizardModal() {
  if (!S.mcv) { try { S.mcv = await api('mc:versions'); } catch (e) { return fail(e); } }
  const rel = S.mcv.filter(v => v.type === 'release');
  W = { step: 1, name: '', mc: (rel[0] || S.mcv[0]).id, loader: 'fabric', snap: false, ok: null, ctype: 'mod', q: '', items: [], hits: {} };
  wz1();
}
const wzHead = n => `<div class="row gap wrap" style="justify-content:space-between;align-items:center"><h2 style="margin:0">${ic('plus')} ${esc(t('newInst'))} · ${n}/3 — ${esc(t(['', 'wz1', 'wz2', 'wz3'][n]))}</h2>${n === 1 ? uiSeg() : ''}</div>`;
function wz1() {
  const list = S.mcv.filter(v => v.type === 'release' || (W.snap && v.type === 'snapshot')).slice(0, 80);
  modal(`<i class="wide" hidden></i>${wzHead(1)}
  <label class="lab" style="margin-top:0">${esc(t('name'))}</label><input id="wn" style="width:100%" maxlength="60" placeholder="${esc(t('wzNamePh'))}" value="${esc(W.name)}">
  <label class="lab">${esc(t('mcVersion'))}</label><div id="wl" style="max-height:24vh;overflow:auto;display:grid;gap:4px">${list.map(v => `<button class="opt ${v.id === W.mc ? 'on' : ''}" data-wv="${esc(v.id)}" style="padding:8px 12px"><b>${esc(v.id)}</b>${isNew(v.id) ? `<span class="tag">★ ${esc(t('newBadge'))}</span>` : ''}${v.type === 'snapshot' ? `<span class="tag">${esc(t('typeSnap'))}</span>` : ''}</button>`).join('')}</div>
  <label class="row sm" style="margin-top:8px"><button class="sw ${W.snap ? 'on' : ''}" id="wsn"></button>${esc(t('wzShowSnap'))}</label>
  <label class="lab">${esc(t('wzCore'))}</label><div class="seg" id="wlo">${LOADERS.map(l => `<button data-wl="${l}" class="${l === W.loader ? 'on' : ''}">${LN[l]}</button>`).join('')}</div><div class="sm mu" id="wls" style="margin-top:6px;min-height:20px"></div>
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn p" id="wnx" disabled>${esc(t('wzNext'))}</button></div>`);
  $('#wn').oninput = e => { W.name = e.target.value; };
  $('#wsn').onclick = () => { W.snap = !W.snap; wz1(); };
  $('#wl').onclick = e => { const b = e.target.closest('[data-wv]'); if (!b) return; W.mc = b.dataset.wv; $$('[data-wv]').forEach(x => x.classList.toggle('on', x === b)); wzCheck(); };
  $('#wlo').onclick = e => { const b = e.target.closest('[data-wl]'); if (!b) return; W.loader = b.dataset.wl; $$('[data-wl]').forEach(x => x.classList.toggle('on', x === b)); wzCheck(); };
  $('#wls').onclick = e => { const b = e.target.closest('[data-usev]'); if (b) { W.mc = b.dataset.usev; wz1(); } };
  $('#wnx').onclick = () => W.loader === 'vanilla' ? wzCreate() : (W.step = 2, wz2());
  wzCheck();
}
// Проверяем, вышло ли выбранное ядро для этой версии игры; если нет — понятное сообщение и ближайшая старая версия
async function wzCheck() {
  const key = W.loader + '|' + W.mc, s = $('#wls'), n = $('#wnx'); if (!s || !n) return; W.ok = null; n.disabled = true;
  n.innerHTML = W.loader === 'vanilla' ? `${ic('plus')}${esc(t('create'))}` : esc(t('wzNext'));
  if (W.loader === 'vanilla') { s.textContent = t('wzNoMods'); W.ok = true; n.disabled = false; return; }
  s.textContent = t('loading'); let v = []; try { v = await api('loader:versions', { loader: W.loader, mc: W.mc }); } catch (_) {}
  if (key !== W.loader + '|' + W.mc || !$('#wls')) return;
  W.ok = v.length > 0; n.disabled = !W.ok;
  if (W.ok) { s.textContent = ''; return; }
  s.textContent = tf('noLoaderMsg', [LN[W.loader], W.mc]);
  api('loader:fallback', { loader: W.loader, mc: W.mc }).then(fb => { if (fb && key === W.loader + '|' + W.mc && $('#wls')) $('#wls').innerHTML = `${esc(tf('noLoaderMsg', [LN[W.loader], W.mc]))} <button class="btn sm" data-usev="${esc(fb)}">${esc(tf('useOlder', [fb]))}</button>`; }).catch(() => {});
}
function wz2() {
  const tabs = [['mod', t('mods')], ['resourcepack', t('packs')], ['shader', t('shaders')]];
  modal(`<i class="wide" hidden></i>${wzHead(2)}
  <div class="row gap wrap"><div class="pill" id="wct">${tabs.map(([k, n]) => `<button data-wt="${k}" class="${k === W.ctype ? 'on' : ''}">${esc(n)}</button>`).join('')}</div><div class="grow"></div><span class="tag">${esc(t('wzAddedN'))}: <b id="wcnt">${W.items.length}</b></span></div>
  <div class="search" style="margin-top:10px">${ic('search')}<input id="wq" type="search" value="${esc(W.q)}" placeholder="${esc(t('search'))}"></div>
  <div id="wr" style="max-height:38vh;overflow:auto;display:grid;gap:8px;margin-top:10px"></div>
  <div class="foot"><button class="btn" id="wbk">${ic('back')}${esc(t('prev'))}</button><button class="btn p" id="wnx2">${esc(t('wzNext'))}</button></div>`);
  let seq = 0, tm;
  const btn = h => { const has = W.items.some(x => x.project === h.id); return `<button class="btn sm ${has ? '' : 'p'}" data-wadd="${esc(h.id)}">${has ? '✓ ' + esc(t('wzAdded')) : '+ ' + esc(t('wzAdd'))}</button>`; };
  const load = async () => {
    const my = ++seq, box = $('#wr'); if (!box) return; box.innerHTML = `<div class="mu">${esc(t('loading'))}</div>`;
    try {
      const r = await api('cat:search', { query: W.q.trim(), type: W.ctype, src: 'modrinth', loader: W.ctype === 'mod' ? W.loader : undefined, version: W.mc }); if (my !== seq || !$('#wr')) return;
      r.hits.forEach(h => { W.hits[h.id] = { project: h.id, title: h.title, icon: h.icon || '', type: W.ctype }; });
      $('#wr').innerHTML = r.hits.map(h => `<div class="card item" style="padding:10px 14px"><img class="ico" src="${esc(h.icon || '')}" alt=""><div class="grow"><b>${esc(h.title)}</b><div class="ds">${esc(h.desc)}</div>${h.downloads > 0 ? `<div class="mu sm">⬇ ${fmt(h.downloads)}</div>` : ''}</div>${btn(h)}</div>`).join('') || `<div class="card empty">${esc(t('empty'))}</div>`;
    } catch (e) { if ($('#wr')) $('#wr').innerHTML = `<div class="card empty">${esc(errText(e))}</div>`; }
  };
  $('#wr').onclick = e => {
    const b = e.target.closest('[data-wadd]'); if (!b) return; const id = b.dataset.wadd, k = W.items.findIndex(x => x.project === id);
    if (k >= 0) W.items.splice(k, 1); else if (W.hits[id]) W.items.push(W.hits[id]);
    b.outerHTML = btn({ id }); $('#wcnt').textContent = W.items.length;
  };
  $('#wct').onclick = e => { const b = e.target.closest('[data-wt]'); if (!b) return; W.ctype = b.dataset.wt; $$('[data-wt]').forEach(x => x.classList.toggle('on', x === b)); load(); };
  $('#wq').oninput = e => { W.q = e.target.value; clearTimeout(tm); tm = setTimeout(load, 350); };
  $('#wbk').onclick = () => { W.step = 1; wz1(); };
  $('#wnx2').onclick = () => { W.step = 3; wz3(); };
  load(); $('#wq').focus();
}
// Проверка перед созданием: что выбрано, что нужно для работы (зависимости), что не подходит
async function wz3() {
  modal(`<i class="wide" hidden></i>${wzHead(3)}<div class="mu">${esc(t('wzPlanning'))}</div>`);
  let plan; try { plan = await api('wizard:plan', { mc: W.mc, loader: W.loader, items: W.items }); } catch (e) { closeModal(); return fail(e); }
  if (!Array.isArray(plan)) plan = [];
  const mine = plan.filter(e => W.items.some(x => x.project === e.project)), deps = plan.filter(e => !W.items.some(x => x.project === e.project));
  const row = (e, own) => `<div class="card item" style="padding:8px 12px${e.ok ? '' : ';border-color:var(--warn)'}"><img class="ico" src="${esc(e.icon)}" alt=""><div class="grow"><b>${esc(e.title)}</b> <span class="mu sm">${esc(e.versionName)}</span>${e.neededBy.length ? `<div class="mu sm">${esc(tf('wzNeedFor', [e.neededBy.join(', ')]))}</div>` : ''}${e.ok ? '' : `<div class="sm" style="color:var(--warn)">⚠ ${esc(t('wzBad'))}</div>`}</div>${own ? `<button class="btn sm ic bad" data-wdel="${esc(e.project)}">${ic('trash')}</button>` : ''}</div>`;
  modal(`<i class="wide" hidden></i>${wzHead(3)}
  <div class="row gap wrap"><b>${esc(W.name.trim() || LN[W.loader] + ' ' + W.mc)}</b><span class="tag">${esc(W.mc)}</span><span class="tag">${esc(LN[W.loader])}</span></div>
  <div style="max-height:46vh;overflow:auto;margin-top:10px;display:grid;gap:8px" id="wsum">
  ${mine.length ? `<label class="lab" style="margin:0">${esc(t('wzYours'))}</label>${mine.map(e => row(e, true)).join('')}` : `<div class="card empty">${esc(t('wzEmpty'))}</div>`}
  ${deps.length ? `<label class="lab" style="margin:6px 0 0">${esc(t('wzDeps'))}</label>${deps.map(e => row(e, false)).join('')}` : ''}</div>
  <div class="foot"><button class="btn" id="wbk3">${ic('back')}${esc(t('prev'))}</button><button class="btn p" id="wgo">${ic('plus')}${esc(t('create'))}</button></div>`);
  $('#wsum').onclick = e => { const b = e.target.closest('[data-wdel]'); if (!b) return; W.items = W.items.filter(x => x.project !== b.dataset.wdel); wz3(); };
  $('#wbk3').onclick = () => { W.step = 2; wz2(); };
  $('#wgo').onclick = wzCreate;
}
async function wzCreate() {
  const name = W.name.trim() || `${LN[W.loader]} ${W.mc}`;
  modal(`<h2>${ic('plus')} ${esc(name)}</h2><p class="mu">${esc(t('buildWait'))}</p><div class="bar"><i style="width:100%;opacity:.35"></i></div>`);
  try {
    const r = await api('wizard:create', { name, mc: W.mc, loader: W.loader, loaderVersion: '', items: W.items });
    closeModal(); await refresh(); S.tab = 'mods';
    toast(r.failed.length ? tf('wzFailed', [r.failed.join(', ')]) : t('wzDone'), r.failed.length ? 'err' : 'ok'); go('inst', r.instance.id);
  } catch (e) { closeModal(); fail(e); }
}

// Каталог сборок: поле поиска + результаты. Встраивается в окно «Своя сборка» (pills = false) или показывается отдельным окном (pills = true).
function packPane(into, start, pills) {
  let src = ['curseforge', 'ftb', 'atl', 'technic'].includes(start) ? start : 'modrinth';
  into.innerHTML = `<div class="search">${ic('search')}<input id="pq" type="search" placeholder="${esc(t('searchPacks'))}"></div>
  ${pills ? `<div class="row" style="margin-top:10px"><div class="pill" id="psrc">${[['modrinth', 'Modrinth'], ['curseforge', 'CurseForge'], ['ftb', 'FTB'], ['atl', 'ATLauncher'], ['technic', 'Technic']].map(([k, n]) => `<button data-ps="${k}" class="${k === src ? 'on' : ''}">${n}</button>`).join('')}</div></div>` : ''}
  <div id="pr" style="max-height:${pills ? 46 : 40}vh;overflow:auto;display:grid;gap:8px;margin-top:12px"></div>`;
  let seq = 0, tm;
  const load = async () => {
    const my = ++seq, box = $('#pr'); if (!box) return; box.innerHTML = `<div class="mu">${esc(t('loading'))}</div>`;
    try {
      const r = await api('cat:search', { query: $('#pq').value.trim(), type: 'modpack', src }); if (my !== seq || !$('#pr')) return;
      $('#pr').innerHTML = r.hits.map(h => `<div class="card item" style="padding:10px 14px">${h.icon ? `<img class="ico" src="${esc(h.icon)}" alt="">` : `<span class="ico ph">${esc((h.title || '?').trim().charAt(0).toUpperCase())}</span>`}<div class="grow"><b>${esc(h.title)}</b>${h.author ? ` <span class="mu sm">· ${esc(h.author)}</span>` : ''}${h.desc ? `<div class="ds">${esc(h.desc)}</div>` : ''}${h.downloads > 0 ? `<div class="mu sm">⬇ ${fmt(h.downloads)}</div>` : ''}</div><button class="btn p sm" data-getp="${esc(h.id)}" data-ptype="modpack" data-psrc="${src}" data-ptitle="${esc(h.title)}">${ic('download')}${esc(t('install'))}</button></div>`).join('') || `<div class="card empty">${esc(r.hint ? t(r.hint) : t('empty'))}</div>`;
      $$('#pr img.ico').forEach(im => { im.onerror = () => { const s = document.createElement('span'); s.className = 'ico ph'; s.textContent = ((im.closest('.item').querySelector('b') || {}).textContent || '?').trim().charAt(0).toUpperCase(); im.replaceWith(s); }; });   // нет картинки → буква
      if (src === 'technic' || src === 'atl') $('#pr').insertAdjacentHTML('beforeend', `<div class="mu sm" style="padding:2px 6px">${esc(t(src === 'technic' ? 'techNote' : 'atlNote'))}</div>`);
    } catch (e) { if ($('#pr')) $('#pr').innerHTML = `<div class="card empty">${esc(errText(e))}</div>`; }
  };
  $('#pq').oninput = () => { clearTimeout(tm); tm = setTimeout(load, 350); };
  if (pills) $('#psrc').onclick = e => { const b = e.target.closest('[data-ps]'); if (!b) return; src = b.dataset.ps; $$('[data-ps]').forEach(x => x.classList.toggle('on', x === b)); load(); };
  load(); $('#pq').focus();
}
function packModal(start) {
  modal(`<i class="wide" hidden></i><h2>${ic('compass')} ${esc(t('modeMr'))}</h2><div id="pp"></div>
  <div class="foot"><button class="btn" data-nmode="">${ic('back')}${esc(t('prev'))}</button><button class="btn" data-close>${esc(t('cancel'))}</button></div>`);
  packPane($('#pp'), start, true);
}

// Что делать после установки/импорта модпака: открыть сборку и, если часть файлов нельзя скачать автоматически, показать их список
async function afterPack(i) {
  await refresh(); if ($('#modal') && !$('#modal').classList.contains('hide')) closeModal();
  toast(t('done') + ': ' + i.name, 'ok'); S.tab = 'mods'; go('inst', i.id);
  if (i.manual && i.manual.length) manualModal(i.id);
  else if (i.loaderFallback) toast(t('packLoaderFb').replace('{v}', i.loaderFallback), '');
}
// Файлы, которые автор запретил скачивать вне сайта CurseForge (или которые не удалось скачать): название + ссылка
function manualModal(id) {
  const i = inst(id); if (!i || !(i.manual || []).length) return closeModal();
  const why = { blocked: 'manBlocked', notfound: 'manNotFound', host: 'manHost', failed: 'manFailed', browser: 'manBrowser', unsupported: 'manUnsupported' };
  modal(`<h2>⚠ ${esc(t('manT'))} — ${esc(i.name)}</h2><p class="mu sm" style="margin-top:-6px">${esc(t('manD'))}</p>
  <div style="max-height:44vh;overflow:auto;display:grid;gap:6px">${i.manual.map(m => `<div class="card item" style="padding:8px 12px"><div class="grow"><b>${esc(m.name)}</b><div class="mu sm">${esc(t(why[m.reason] || 'manFailed'))}</div></div>${m.url ? `<button class="btn sm" data-ext="${esc(m.url)}">${ic('globe')}${esc((() => { try { return new URL(m.url).hostname.replace(/^www\./, ''); } catch (_) { return 'Web'; } })())}</button>` : ''}</div>`).join('')}</div>
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn" data-folder>${ic('folder')}${esc(t('openFolder'))}</button><button class="btn p" data-addmanual="${esc(id)}">${ic('import')}${esc(t('manAdd'))}</button></div>`);
}
// Prism-стиль: имя, группа, список версий с фильтрами, загрузчик и его версия
async function customModal(into) {
  if (!S.mcv) { try { S.mcv = await api('mc:versions'); } catch (e) { return fail(e); } }
  const st = { name: '', group: '', mc: '', loader: S.settings.defLoader || 'fabric', lv: '', lvs: [], f: '', types: { release: true, snapshot: !!S.settings.defSnaps, old: false }, ok: true };
  const groups = [...new Set(S.instances.map(i => i.group).filter(Boolean))];
  const kind = v => v.type === 'release' ? 'release' : v.type === 'snapshot' ? 'snapshot' : 'old';
  const list = () => S.mcv.filter(v => st.types[kind(v)] && (!st.f || v.id.toLowerCase().includes(st.f.toLowerCase())));
  st.mc = (S.mcv.find(v => v.type === 'release') || S.mcv[0]).id;
  const body = `<div class="row gap wrap"><div class="grow" style="min-width:200px"><label class="lab" style="margin-top:0">${esc(t('name'))}</label><input id="nn" style="width:100%" placeholder="My world"></div>
  <div class="grow" style="min-width:160px"><label class="lab" style="margin-top:0">${esc(t('group'))}</label><input id="ng" list="ngl" style="width:100%" placeholder="${esc(t('groupPh'))}"><datalist id="ngl">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist></div></div>
  <label class="lab">${esc(t('mcVersion'))}</label>
  <div class="row gap wrap"><input id="nf" type="search" placeholder="${esc(t('filterV'))}" style="flex:1;min-width:120px"><div class="pill" id="nt">${[['release', t('typeRel')], ['snapshot', t('typeSnap')], ['old', t('typeOld')]].map(([k, n]) => `<button data-nt="${k}" class="${st.types[k] ? 'on' : ''}">${esc(n)}</button>`).join('')}</div></div>
  <div id="nvl" class="vlist"></div>
  <label class="lab">${esc(t('loader'))}</label><div class="seg">${LOADERS.map(l => `<button data-l="${l}" class="${st.loader === l ? 'on' : ''}">${LN[l]}</button>`).join('')}</div>
  <div class="row gap" style="margin-top:10px;${adv() ? '' : 'display:none'}"><select id="nlv" class="grow"></select></div>
  <div class="mu sm" id="ls" style="margin-top:8px;min-height:18px"></div>
  `;
  const foot = `<div class="foot">${into ? '' : `<button class="btn" data-nmode="">${ic('back')}${esc(t('prev'))}</button>`}<button class="btn p" id="nc">${ic('plus')}${esc(t('create'))}</button></div>`;
  if (into) into.innerHTML = body + foot; else modal(`<i class="wide" hidden></i><h2>${ic('gear')} ${esc(t('modeCustom'))}</h2>` + body + foot);
  const drawList = () => {
    const l = list(); if (!l.some(v => v.id === st.mc) && l.length) { st.mc = l[0].id; check(); }
    $('#nvl').innerHTML = l.slice(0, 250).map(v => `<button class="vrow ${v.id === st.mc ? 'on' : ''}" data-nv="${esc(v.id)}"><b>${esc(v.id)}</b><span class="tag">${esc(v.type === 'release' ? t('typeRel') : v.type === 'snapshot' ? t('typeSnap') : t('typeOld'))}</span>${isNew(v.id) ? `<span class="tag" style="background:var(--ac);color:var(--acx);border-color:transparent">★ ${esc(t('newBadge'))}</span>` : ''}</button>`).join('') || `<div class="mu" style="padding:10px">${esc(t('empty'))}</div>`;
    const on = $('#nvl .on'); if (on) on.scrollIntoView({ block: 'nearest' });
  };
  const check = async () => {
    const ls = $('#ls'), nc = $('#nc'), sel = $('#nlv'); if (!ls) return;
    if (st.loader === 'vanilla') { st.ok = true; st.lvs = []; st.lv = ''; sel.innerHTML = ''; sel.style.display = 'none'; ls.textContent = ''; nc.disabled = false; return; }
    sel.style.display = ''; ls.textContent = t('loading'); nc.disabled = true; sel.innerHTML = '';
    const key = st.loader + '|' + st.mc; let v = []; try { v = await api('loader:versions', { loader: st.loader, mc: st.mc }); } catch (_) {}
    if (key !== st.loader + '|' + st.mc || !$('#ls')) return;
    st.lvs = v; st.ok = v.length > 0; st.lv = '';
    $('#nlv').innerHTML = v.length ? `<option value="">${esc(t('loaderLatest'))} (${esc(v[0])})</option>` + v.map(x => `<option>${esc(x)}</option>`).join('') : '';
    $('#ls').textContent = st.ok ? '' : tf('noLoaderMsg', [LN[st.loader], st.mc]); $('#nc').disabled = !st.ok;
    if (!st.ok) api('loader:fallback', { loader: st.loader, mc: st.mc }).then(fb => { if (fb && key === st.loader + '|' + st.mc && $('#ls')) $('#ls').innerHTML = `${esc(tf('noLoaderMsg', [LN[st.loader], st.mc]))} <button class="btn sm" data-usev="${esc(fb)}">${esc(tf('useOlder', [fb]))}</button>`; }).catch(() => {});
  };
  $('#ls').onclick = e => { const b = e.target.closest('[data-usev]'); if (b) { st.mc = b.dataset.usev; drawList(); check(); } };
  $('#nn').oninput = e => st.name = e.target.value; $('#ng').oninput = e => st.group = e.target.value;
  $('#nf').oninput = e => { st.f = e.target.value.trim(); drawList(); };
  $('#nlv').onchange = e => st.lv = e.target.value;
  $('#nt').onclick = e => { const b = e.target.closest('[data-nt]'); if (!b) return; const k = b.dataset.nt; st.types[k] = !st.types[k]; if (!Object.values(st.types).some(Boolean)) st.types.release = true; $$('[data-nt]').forEach(x => x.classList.toggle('on', !!st.types[x.dataset.nt])); drawList(); };
  $('#nvl').onclick = e => { const b = e.target.closest('[data-nv]'); if (!b) return; st.mc = b.dataset.nv; $$('[data-nv]').forEach(x => x.classList.toggle('on', x === b)); check(); };
  $$('[data-l]').forEach(b => b.onclick = () => { st.loader = b.dataset.l; $$('[data-l]').forEach(x => x.classList.toggle('on', x === b)); check(); });
  $('#nc').onclick = async () => { const name = st.name.trim() || `${LN[st.loader]} ${st.mc}`; closeModal(); await run(async () => { const i = await api('inst:create', { name, mc: st.mc, loader: st.loader, loaderVersion: st.lv, group: st.group.trim() }); await refresh();
    if (i.loader === 'vanilla') return go('inst', i.id);
    S.target = i.id; S.tab = 'mods'; Object.assign(S.catalog, { q: '', type: 'mod', src: 'modrinth', version: i.mc, loader: i.loader, res: null, page: 0 }); toast(t('pickModsHint'), 'ok'); go('discover'); }); };
  drawList(); check();
}

async function updateModal() {
  const i = inst(S.instId); if (!i) return;
  modal(`<h2>${esc(t('updT'))} — ${esc(i.name)}</h2><div class="mu">${esc(t('loading'))}</div>`);
  let r; try { r = await api('inst:checkUpdate', i.id); } catch (e) { closeModal(); return fail(e); }
  if (!S.mcv) { try { S.mcv = await api('mc:versions'); } catch (_) {} }
  const upc = r.candidates.filter(c => c.dir !== 'down');
  let sel = (upc.find(c => c.loaderOk && c.ok === c.total) || upc.find(c => c.loaderOk) || r.candidates.find(c => c.loaderOk) || {}).mc;
  const draw = () => {
    const c = r.candidates.find(x => x.mc === sel);
    const row = x => { const pct = x.total ? Math.round(x.ok / x.total * 100) : 100; return `<button class="opt ${x.mc === sel ? 'on' : ''}" data-sel="${esc(x.mc)}" ${x.loaderOk ? '' : 'disabled style="opacity:.45"'}><div style="min-width:64px"><b>${esc(x.mc)}</b>${isNew(x.mc) ? ' <span class="tag">★ ' + esc(t('newBadge')) + '</span>' : ''}</div><div class="bar"><i class="${pct < 100 ? 'part' : ''}" style="width:${x.loaderOk ? pct : 0}%"></i></div><span class="mu sm" style="min-width:110px;text-align:right">${x.loaderOk ? `${x.ok} ${esc(t('of'))} ${x.total} ${esc(t('compat'))}` : esc(t('noLoader'))}</span></button>`; };
    const up = r.candidates.filter(x => x.dir !== 'down'), down = r.candidates.filter(x => x.dir === 'down');
    modal(`<h2>${esc(t('updT'))} — ${esc(i.name)}</h2><p class="mu" style="margin-top:-6px">${esc(t('updD'))}<br>${esc(t('version'))}: <b>${esc(i.mc)}</b></p>
    <div style="max-height:46vh;overflow:auto">
    ${up.length ? `<label class="lab" style="margin-top:0">↑ ${esc(t('newerV'))}</label>${up.map(row).join('')}` : ''}
    ${down.length ? `<label class="lab">↓ ${esc(t('olderV'))}</label>${down.map(row).join('')}` : ''}
    ${!r.candidates.length ? `<div class="empty">${esc(t('empty'))}</div>` : ''}
    ${c && c.missing.length ? `<label class="lab">✕ ${c.missing.length}</label>${c.missing.map(m => `<div class="row sm" style="padding:3px 0">${m.icon ? `<img src="${esc(m.icon)}" style="width:24px;height:24px;border-radius:8px" alt="">` : ''}<span>${esc(m.title)}</span></div>`).join('')}` : ''}</div>
    <p class="mu sm">${esc(t('backupNote'))}${c && c.dir === 'down' ? '<br>⚠ ' + esc(t('downNote')) : ''}</p>
    <div class="foot"><button class="btn" data-close>${esc(t('stay'))}</button>${c ? `<button class="btn p" id="ua">${ic('refresh')}${esc(c.dir === 'down' ? t('downgrade') : c.missing.length ? t('removeInc') : t('upgrade'))} → ${esc(c.mc)}</button>` : ''}</div>`);
    $$('[data-sel]').forEach(b => b.onclick = () => { sel = b.dataset.sel; draw(); });
    if ($('#ua')) $('#ua').onclick = async () => { const target = c.mc, rm = c.missing.length > 0; closeModal(); await run(async () => { await api('inst:applyUpdate', { id: i.id, mc: target, removeMissing: rm }); await refresh(); toast(t('done'), 'ok'); renderView(); }); };
  };
  draw();
}
async function boostModal(preset) {
  const i = inst(S.instId); if (!i) return;
  let b; try { b = await api('boost:info', { id: i.id, preset }); } catch (e) { return fail(e); }
  const N = { balanced: ['boostBal', 'boostBalD'], fps: ['boostFps', 'boostFpsD'], weak: ['boostWeak', 'boostWeakD'] }, p = b.plan, o = b.opts;
  const card = k => `<button class="card" data-bp="${k}" style="text-align:left;flex:1;min-width:150px;align-self:stretch;${b.preset === k ? 'border-color:var(--acc,#5aa)' : ''}"><b>${esc(t(N[k][0]))}</b><div class="sm" style="color:var(--acc,#7c9cff);min-height:16px">${b.rec === k ? '★ ' + esc(t('boostRec')) : ''}</div><div class="mu sm">${esc(t(N[k][1]))}</div></button>`;
  const ch = o.changes.map(c => `<div class="sm mu">${esc(c.key)}: ${esc(c.from)} → <b>${esc(c.to)}</b></div>`).join('');
  modal(`<h2>${ic('bolt')} ${esc(t('boostT'))} — ${esc(i.name)}</h2><p class="mu">${esc(t('boostD'))}</p>
  <div class="mu sm">${esc(t('boostPc'))}: ${(b.hw.ram / 1024).toFixed(1)} GB · ${b.hw.cores} CPU · Java ${p.java}</div>
  <div class="row gap wrap" style="margin:10px 0">${['balanced', 'fps', 'weak'].map(card).join('')}</div>
  <label class="lab">${esc(t('boostPlan'))}</label><div class="sm">${p.mem} MB (Xmx) · Xms ${p.xms} MB · ${esc(t('boostGc'))}: ${p.gc}</div><div class="mu sm" style="word-break:break-all">${esc(p.flags)}</div>
  ${b.userMem || b.userFlags ? `<div class="sm" style="color:var(--warn);margin-top:8px">${esc(t('boostUser'))}</div>` : ''}
  <label class="row sm" style="margin-top:12px"><button class="sw ${o.exists && o.changes.length ? 'on' : ''}" id="bopt"></button><span><b>${esc(t('boostOpt'))}</b><div class="mu">${esc(t('boostOptD'))}</div></span></label>
  <div id="bch" style="margin-top:6px">${!o.exists ? `<div class="mu sm">${esc(t('boostNoOpt'))}</div>` : ch || `<div class="mu sm">${esc(t('boostNoChg'))}</div>`}</div>
  ${b.running ? `<div class="sm" style="color:var(--warn)">${esc(t('boostRun'))}</div>` : ''}
  <p class="mu sm">${esc(t('boostLaw'))}</p>
  <div class="foot">${b.current ? `<button class="btn bad" id="boff">${esc(o.backup ? t('boostOffRev') : t('boostOff'))}</button>` : ''}<button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn p" id="bgo">${esc(t('boostApply'))}</button></div>`);
  document.querySelectorAll('[data-bp]').forEach(x => x.onclick = () => boostModal(x.dataset.bp));
  const sw = $('#bopt'); sw.onclick = e => { e.preventDefault(); sw.classList.toggle('on'); };
  $('#bgo').onclick = async () => { try { const r = await api('boost:apply', { id: i.id, preset: b.preset, options: sw.classList.contains('on') && o.exists && !b.running }); await refresh(); closeModal(); toast(`${t('boostApplied')}${r.changed ? ` · ${r.changed} ${t('boostChanged')}` : ''}`); } catch (e) { closeModal(); fail(e); } };
  if ($('#boff')) $('#boff').onclick = async () => { try { await api('boost:off', { id: i.id, revert: !!o.backup && !b.running }); await refresh(); closeModal(); toast(t('boostIsOff')); } catch (e) { closeModal(); fail(e); } };
}
async function optimizeModal() {
  const i = inst(S.instId); if (!i) return;
  if (i.loader === 'vanilla') { toast(t('noLoader') + ' (Vanilla)', 'err'); return; }
  modal(`<h2>${ic('bolt')} ${esc(t('optimize'))} — ${esc(i.name)}</h2><p class="mu">${esc(t('optD'))}</p><div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn p" id="go">${ic('bolt')}${esc(t('optimize'))}</button></div>`);
  $('#go').onclick = async () => {
    $('#go').disabled = true; $('#go').textContent = t('loading');
    try { const r = await api('inst:optimize', i.id); await refresh(); modal(`<h2>${esc(t('done'))}</h2>${r.installed.map(n => `<div class="row" style="padding:3px 0">${ic('check')}${esc(n)}</div>`).join('') || `<div class="mu">—</div>`}${r.skipped.length ? `<p class="mu sm">${esc(r.skipped.join(', '))}: ${esc(t('noCompat'))}</p>` : ''}<div class="foot"><button class="btn p" data-close>OK</button></div>`); if (S.view === 'inst') renderTab(); }
    catch (e) { closeModal(); fail(e); }
  };
}
async function projectModal(id) {
  modal(`<div class="mu">${esc(t('loading'))}</div>`);
  try {
    const p = await api('cat:project', id); const url = `https://modrinth.com/${p.project_type}/${p.slug}`;
    modal(`<div class="row gap">${p.icon_url ? `<img class="ico" style="width:72px;height:72px;border-radius:24px" src="${esc(p.icon_url)}" alt="">` : ''}<div class="grow"><h2 style="margin:0">${esc(p.title)}</h2><div class="mu">${esc(p.description)}</div></div></div>
    <p class="mu sm">⬇ ${fmt(p.downloads)} · ${(p.loaders || []).map(l => `<span class="tag">${esc(l)}</span>`).join(' ')} · ${(p.game_versions || []).slice(-6).reverse().map(esc).join(', ')}</p>
    <div class="foot"><button class="btn" data-ext="${esc(url)}">${ic('globe')}Modrinth</button><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn p" data-getp="${esc(p.id)}" data-ptype="${esc(p.project_type)}">${ic('download')}${esc(t('install'))}</button></div>`);
  } catch (e) { closeModal(); fail(e); }
}

async function versionModal(file, all) {
  const i = inst(S.instId); if (!i) return;
  modal(`<h2>${ic('tag')} ${esc(t('pickVer'))}</h2><div class="mu">${esc(t('loading'))}</div>`);
  let r; try { r = await api('inst:modVersions', { id: i.id, kind: S.tab === 'mods' ? 'mod' : S.tab, file, all: !!all }); } catch (e) { closeModal(); return fail(e); }
  modal(`<h2>${ic('tag')} ${esc(t('pickVer'))} · Minecraft ${esc(i.mc)}</h2>
  <label class="row sm mu" style="margin-bottom:8px"><button class="sw ${all ? 'on' : ''}" id="va"></button>${esc(t('allVer'))}</label>
  <div style="max-height:52vh;overflow:auto;display:grid;gap:6px">${r.versions.map(v => `<button class="opt ${v.id === r.current ? 'on' : ''}" data-setv="${esc(v.id)}"><div class="grow"><b>${esc(v.number || v.name)}</b> <span class="tag">${esc(v.type || '')}</span><div class="mu sm">${esc((v.mc || []).slice(-4).join(', '))} · ${esc((v.loaders || []).join(', '))}</div></div>${v.id === r.current ? `<span class="tag">✓ ${esc(t('curVer'))}</span>` : ''}</button>`).join('') || `<div class="card empty">${esc(t('noCompat'))}</div>`}</div>
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button></div>`);
  $('#va').onclick = () => versionModal(file, !all);
  $$('[data-setv]').forEach(b => b.onclick = async () => { if (b.dataset.setv === r.current) return closeModal(); closeModal(); await run(async () => { await api('inst:setModVersion', { id: i.id, kind: S.tab === 'mods' ? 'mod' : S.tab, file, version: b.dataset.setv }); toast(t('versionSet'), 'ok'); renderTab(); }); });
}
function crashModal(d) {
  const i = inst(d.id) || { name: '' };
  const ttl = x => x.title || x.id;
  const act = x => ({ installed: t('aInstalled'), updated: t('aUpdated'), disabled: t('aDisabled') }[x.action] || (x.action === 'memory' ? `${t('aMem')} ${x.value} MB` : x.action));
  modal(`<h2>⚠ ${esc(t('crashT'))} — ${esc(i.name)}</h2>
  ${d.fixed.length ? `<label class="lab" style="margin-top:0">✓ ${esc(t('crashFixed'))}</label>${d.fixed.map(x => `<div class="row sm" style="padding:3px 0">${ic('check')}${x.action === 'memory' ? '' : `<b>${esc(ttl(x))}</b> — `}${esc(act(x))}</div>`).join('')}` : ''}
  ${d.failed.length ? `<label class="lab">${esc(t('crashNoFix'))}</label>${d.failed.map(x => `<div class="row sm mu" style="padding:3px 0">✕ ${esc(x.id)}${x.type ? ' (' + esc(x.type) + ')' : ''}</div>`).join('')}` : ''}
  ${!d.problems.length ? `<p class="mu">${esc(t('crashNone'))}</p>` : ''}
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button>${d.fixed.length ? `<button class="btn p" data-fixplay="${esc(d.id)}">${ic('play')}${esc(t('fixAgain'))}</button>` : ''}</div>`);
}
async function updateLauncher() {
  const st = $('#lstat'); if (st) st.textContent = t('checking');
  let r;
  try { r = await api('launcher:check'); }
  catch (e) { if ($('#lstat')) $('#lstat').textContent = ''; return fail(e); }     // не оставляем «Проверка…» навсегда
  S.lupd = r;
  if ($('#lstat')) $('#lstat').textContent = r.available ? t('newVer') + ': ' + r.latest : t('upToDate');
  if (!r.available) return toast(t('upToDate'), 'ok');
  modal(`<h2>${ic('refresh')} ${esc(t('newVer'))}</h2><p class="mu">${esc(r.current)} → <b>${esc(r.latest)}</b></p><div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn p" id="lgo">${ic('download')}${esc(t('updLauncher'))}</button></div>`);
  $('#lgo').onclick = async () => {
    const b = $('#lgo'), label = b.innerHTML; b.disabled = true; b.textContent = t('loading');
    try { await api('launcher:update'); closeModal(); }
    catch (e) { const bb = $('#lgo'); if (bb) { bb.disabled = false; bb.innerHTML = label; } fail(e); }   // кнопка снова живая
  };
}

/* ---------- Инструменты сборки ---------- */
const isNew = id => { const v = (S.mcv || []).find(x => x.id === id); return !!(v && v.type === 'release' && v.time && Date.now() - v.time < 14 * 864e5); };
const sizeMB = n => (n / 1048576).toFixed(n > 1e8 ? 0 : 1) + ' MB';
function toolsModal() {
  const i = inst(S.instId); if (!i) return;
  const row = (k, icn, ttl, d) => `<button class="opt" data-tool="${k}">${ic(icn)}<div class="grow"><b>${esc(t(ttl))}</b><div class="mu sm">${esc(t(d))}</div></div></button>`;
  const base = row('backup', 'folder', 'toolBkp', 'toolBkpD') + row('restore', 'history', 'bkpRestore', 'bkpRestoreD') + row('export', 'download', 'toolExp', 'toolExpD') + row('share', 'share', 'shareT', 'shareS');
  modal(`<h2>${ic('tool')} ${esc(t('tools'))} — ${esc(i.name)}</h2><div style="display:grid;gap:8px">
  ${adv() ? row('check', 'check', 'toolCheck', 'toolCheckD') + row('updall', 'refresh', 'updAll', 'toolUpdD') + row('dup', 'copy', 'toolDup', 'toolDupD') + row('sync', 'gear', 'toolSync', 'toolSyncD') + base + row('cloud', 'cloud', 'cloudT', 'cloudS') + row('bkopen', 'folder', 'toolBkpOpen', 'toolBkpOpenD') : base}</div>
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button></div>`);
}
function toolAction(k) {
  const i = inst(S.instId); if (!i) return;
  if (k === 'check') return checkModal();
  if (k === 'updall') return updAllModal();
  if (k === 'dup') return dupModal();
  if (k === 'sync') return syncModal();
  if (k === 'restore') return restoreModal(i.id);
  if (k === 'cloud') return cloudModal(i.id);
  if (k === 'share') return shareModal(i.id);
  closeModal();
  if (k === 'export') return run(async () => { const r = await api('inst:export', i.id); if (r) toast(`${t('exported')}: ${r.linked} + ${r.bundled}`, 'ok'); });
  if (k === 'backup') return run(async () => { const r = await api('inst:backup', i.id); toast(r ? `${t('bkpDone')} · ${sizeMB(r.size)}` : t('bkpNone'), r ? 'ok' : ''); });
  if (k === 'bkopen') return api('inst:backupsFolder', i.id);
}
async function checkModal() {
  const i = inst(S.instId); if (!i) return;
  modal(`<h2>${ic('check')} ${esc(t('toolCheck'))} — ${esc(i.name)}</h2><div class="mu">${esc(t('loading'))}</div>`);
  let r; try { r = await api('inst:inspect', i.id); } catch (e) { closeModal(); return fail(e); }
  const line = p => p.type === 'dup' ? `<div class="row sm" style="padding:3px 0">⚠ <b>${esc(t('checkDup'))}:</b> ${esc(p.id)} <span class="mu">(${p.files.map(esc).join(', ')})</span></div>` : `<div class="row sm" style="padding:3px 0">✕ <b>${esc(t('checkMissing'))}:</b> ${esc(p.id)} <span class="mu">(${esc(t('checkNeeded'))}: ${p.by.map(esc).join(', ')})</span></div>`;
  modal(`<h2>${ic('check')} ${esc(t('toolCheck'))} — ${esc(i.name)}</h2><p class="mu sm" style="margin-top:-6px">${esc(t('mods'))}: ${r.mods}</p>
  ${r.problems.length ? r.problems.map(line).join('') : `<div class="card" style="border-color:var(--ac)">✓ ${esc(t('checkOk'))}</div>`}
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button>${r.problems.length ? `<button class="btn p" id="cfix">${ic('bolt')}${esc(t('checkFix'))}</button>` : ''}</div>`);
  if ($('#cfix')) $('#cfix').onclick = async () => { $('#cfix').disabled = true; $('#cfix').textContent = t('loading'); await run(async () => { const f = await api('inst:fixCrash', { id: i.id, problems: r.problems }); await refresh(); toast(`${t('checkFixed')}: ${f.fixed.length}${f.failed.length ? ` · ✕ ${f.failed.length}` : ''}`, f.failed.length ? '' : 'ok'); if (S.view === 'inst') renderTab(); }); checkModal(); };
}
async function updAllModal() {
  const i = inst(S.instId); if (!i) return;
  modal(`<h2>${ic('refresh')} ${esc(t('updAll'))} — ${esc(i.name)}</h2><div class="mu">${esc(t('loading'))}</div>`);
  let list; try { list = await api('inst:modUpdates', i.id); } catch (e) { closeModal(); return fail(e); }
  modal(`<h2>${ic('refresh')} ${esc(t('updAll'))} — ${esc(i.name)} (${esc(i.mc)})</h2>
  ${list.length ? `<div style="max-height:46vh;overflow:auto">${list.map(u => `<div class="row sm" style="padding:6px 0">${u.icon ? `<img src="${esc(u.icon)}" style="width:28px;height:28px;border-radius:9px" alt="">` : ''}<b class="grow">${esc(u.title)}</b><span class="mu">${esc(u.from)} → ${esc(u.to)}</span></div>`).join('')}</div><p class="mu sm">${esc(t('backupNote'))}</p>` : `<div class="card" style="border-color:var(--ac)">✓ ${esc(t('updAllNone'))}</div>`}
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button>${list.length ? `<button class="btn p" id="uago">${ic('refresh')}${esc(t('updAllBtn'))} (${list.length})</button>` : ''}</div>`);
  if ($('#uago')) $('#uago').onclick = async () => { closeModal(); await run(async () => { const r = await api('inst:updateMods', { id: i.id }); toast(`${t('updAllDone')}: ${r.updated}`, 'ok'); if (S.view === 'inst') renderTab(); }); };
}
function dupModal() {
  const i = inst(S.instId); if (!i) return;
  const items = [['saves', 'cSaves', 1], ['options', 'cOptions', 1], ['resourcepacks', 'cRes', 1], ['shaders', 'cShaders', 1], ['mods', 'cMods', 1], ['config', 'cConfig', 1], ['servers', 'cServers', 1], ['screenshots', 'cShots', 0], ['playtime', 'cPlay', 0]];
  const groups = [...new Set(S.instances.map(x => x.group).filter(Boolean))];
  modal(`<h2>${ic('copy')} ${esc(t('toolDup'))} — ${esc(i.name)}</h2>
  <div class="row gap wrap"><div class="grow" style="min-width:200px"><label class="lab" style="margin-top:0">${esc(t('name'))}</label><input id="dn" style="width:100%" value="${esc(i.name)} (copy)"></div><div class="grow" style="min-width:160px"><label class="lab" style="margin-top:0">${esc(t('group'))}</label><input id="dg" list="dgl" style="width:100%" value="${esc(i.group || '')}" placeholder="${esc(t('groupPh'))}"><datalist id="dgl">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist></div></div>
  <label class="lab">${esc(t('dupWhat'))}</label><div style="display:grid;grid-template-columns:1fr 1fr;gap:4px 16px">${items.map(([k, n, on]) => `<label class="row sm" style="padding:5px 0"><button class="sw ${on ? 'on' : ''}" data-ck="${k}"></button>${esc(t(n))}</label>`).join('')}</div>
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn p" id="dgo">${ic('copy')}${esc(t('dupCopy'))}</button></div>`);
  $$('[data-ck]').forEach(b => b.onclick = () => b.classList.toggle('on'));
  $('#dgo').onclick = async () => { const o = { id: i.id, name: $('#dn').value.trim(), group: $('#dg').value.trim() }; $$('[data-ck]').forEach(b => o[b.dataset.ck] = b.classList.contains('on')); closeModal(); await run(async () => { const n = await api('inst:duplicate', o); await refresh(); go('inst', n.id); }); };
}
function syncModal() {
  const i = inst(S.instId); if (!i) return;
  const others = S.instances.filter(x => x.id !== i.id);
  if (!others.length) return toast(t('empty'), 'err');
  let mode = 'keys';
  modal(`<h2>${ic('gear')} ${esc(t('toolSync'))} — ${esc(i.name)}</h2><p class="mu sm" style="margin-top:-6px">${esc(t('syncNote'))}</p>
  <label class="lab">${esc(t('syncFrom'))}</label><select id="sf" style="width:100%">${others.map(x => `<option value="${esc(x.id)}">${esc(x.name)} · ${esc(x.mc)}</option>`).join('')}</select>
  <div class="seg" style="margin-top:12px"><button data-sm="keys" class="on">${esc(t('syncKeys'))}</button><button data-sm="all">${esc(t('syncAll'))}</button></div>
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn p" id="sgo">${ic('check')}${esc(t('apply'))}</button></div>`);
  $$('[data-sm]').forEach(b => b.onclick = () => { mode = b.dataset.sm; $$('[data-sm]').forEach(x => x.classList.toggle('on', x === b)); });
  $('#sgo').onclick = async () => { const from = $('#sf').value; closeModal(); await run(async () => { await api('inst:syncOptions', { from, to: i.id, mode }); toast(t('syncDone'), 'ok'); }); };
}

/* ---------- Скины ---------- */
const loadImg = src => new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
// Рисует фигурку игрока (вид спереди/сзади) из PNG скина: слой тела + второй слой (шляпа, куртка, рукава, штаны)
function drawSkin(cv, img, slim, back, sc) {
  const legacy = img.height < 64, g = cv.getContext('2d'), f = !back, aw = slim ? 3 : 4;
  cv.width = 16 * sc; cv.height = 32 * sc; g.imageSmoothingEnabled = false; g.clearRect(0, 0, cv.width, cv.height);
  const L = [], add = (o, sx, sy, w, h, dx, dy, fl) => L.push([o, sx, sy, w, h, dx, dy, fl]);
  add(0, f ? 8 : 24, 8, 8, 8, 4, 0); add(1, f ? 40 : 56, 8, 8, 8, 4, 0);
  add(0, f ? 20 : 32, 20, 8, 12, 4, 8); if (!legacy) add(1, f ? 20 : 32, 36, 8, 12, 4, 8);
  const rAx = f ? (slim ? 1 : 0) : 12, lAx = f ? 12 : (slim ? 1 : 0), rLx = f ? 4 : 8, lLx = f ? 8 : 4;
  const RA = f ? 44 : slim ? 51 : 52, LA = f ? 36 : slim ? 43 : 44, LAo = f ? 52 : slim ? 59 : 60, RL = f ? 4 : 12, LL = f ? 20 : 28;
  add(0, RA, 20, aw, 12, rAx, 8); add(0, RL, 20, 4, 12, rLx, 20);
  if (legacy) { add(0, RA, 20, aw, 12, lAx, 8, 1); add(0, RL, 20, 4, 12, lLx, 20, 1); }
  else { add(1, RA, 36, aw, 12, rAx, 8); add(0, LA, 52, aw, 12, lAx, 8); add(1, LAo, 52, aw, 12, lAx, 8); add(1, RL, 36, 4, 12, rLx, 20); add(0, LL, 52, 4, 12, lLx, 20); add(1, f ? 4 : 12, 52, 4, 12, lLx, 20); }
  L.sort((a, b) => a[0] - b[0]);
  for (const [, sx, sy, w, h, dx, dy, fl] of L) { if (fl) { g.save(); g.translate((dx + w) * sc, dy * sc); g.scale(-1, 1); g.drawImage(img, sx, sy, w, h, 0, 0, w * sc, h * sc); g.restore(); } else g.drawImage(img, sx, sy, w, h, dx * sc, dy * sc, w * sc, h * sc); }
}
function drawCape(cv, img, sc) {
  const r = img.width % 22 === 0 && img.height % 17 === 0 ? img.width / 22 : img.width / 64; cv.width = 10 * sc; cv.height = 16 * sc;
  const g = cv.getContext('2d'); g.imageSmoothingEnabled = false; g.drawImage(img, r, r, 10 * r, 16 * r, 0, 0, cv.width, cv.height);
}
async function paintCanvases(root = document) {
  for (const c of $$('canvas[data-skin]', root)) { try { const im = await loadImg(c.dataset.skin); drawSkin(c, im, c.dataset.slim === '1', c.dataset.back === '1', +c.dataset.sc || 4); } catch (_) {} }
  for (const c of $$('canvas[data-cape]', root)) { try { drawCape(c, await loadImg(c.dataset.cape), +c.dataset.sc || 4); } catch (_) {} }
}
/* ---------- 3D-модель скина: тяните мышью, чтобы вращать, колесо — масштаб, двойной щелчок — сброс ---------- */
// Собирается из CSS-кубов (по раскладке текстур Minecraft): работает без WebGL и сторонних библиотек.
function skin3d(el, src, slim, o = {}) {
  if (!el) return;
  const U = o.u || 8, im = new Image();
  im.onload = () => {
    if (!el.isConnected) return;
    const leg = im.naturalHeight <= 32, TH = leg ? 32 : 64, aw = slim ? 3 : 4;
    // [u, v, w, h, d, x, y, рост, зеркало]  — координаты в пикселях скина, центр модели в (0,0)
    const P = [[0, 0, 8, 8, 8, 0, -12, 0], [32, 0, 8, 8, 8, 0, -12, .5],
      [16, 16, 8, 12, 4, 0, -2, 0], [40, 16, aw, 12, 4, -(4 + aw / 2), -2, 0], [0, 16, 4, 12, 4, -2, 10, 0]];
    if (leg) P.push([40, 16, aw, 12, 4, 4 + aw / 2, -2, 0, 1], [0, 16, 4, 12, 4, 2, 10, 0, 1]);
    else P.push([16, 32, 8, 12, 4, 0, -2, .25], [40, 32, aw, 12, 4, -(4 + aw / 2), -2, .25], [0, 32, 4, 12, 4, -2, 10, .25],
      [32, 48, aw, 12, 4, 4 + aw / 2, -2, 0], [48, 48, aw, 12, 4, 4 + aw / 2, -2, .25], [16, 48, 4, 12, 4, 2, 10, 0], [0, 48, 4, 12, 4, 2, 10, .25]);
    const css = (u, v, tw, th, g) => { const sx = (tw + 2 * g) / tw, sy = (th + 2 * g) / th;
      return `width:${(tw + 2 * g) * U}px;height:${(th + 2 * g) * U}px;left:${-(tw + 2 * g) * U / 2}px;top:${-(th + 2 * g) * U / 2}px;background-image:url(&quot;${esc(src)}&quot;);background-size:${64 * U * sx}px ${TH * U * sy}px;background-position:${-u * U * sx}px ${-v * U * sy}px`; };
    const parts = P.map(([u, v, w, h, d, x, y, g, mir]) => {
      const F = [[u + d, v + d, w, h, `translateZ(${(d / 2 + g) * U}px)`], [u + 2 * d + w, v + d, w, h, `rotateY(180deg) translateZ(${(d / 2 + g) * U}px)`],
        [u, v + d, d, h, `rotateY(-90deg) translateZ(${(w / 2 + g) * U}px)`], [u + d + w, v + d, d, h, `rotateY(90deg) translateZ(${(w / 2 + g) * U}px)`],
        [u + d, v, w, d, `rotateX(90deg) translateZ(${(h / 2 + g) * U}px)`], [u + d + w, v, w, d, `rotateX(-90deg) translateZ(${(h / 2 + g) * U}px)`]];
      return `<div class="p" style="transform:translate3d(${x * U}px,${y * U}px,0)${mir ? ' scaleX(-1)' : ''}">${F.map(([a, b, c, e, tr]) => `<i class="f" style="${css(a, b, c, e, g)};transform:${tr}"></i>`).join('')}</div>`;
    }).join('');
    el.innerHTML = `<div class="m">${parts}</div>`;
    const m = el.firstChild; let rx = o.rx == null ? -8 : o.rx, ry = o.ry == null ? -28 : o.ry, z = 1, drag = null;
    const set = () => { m.style.transform = `scale(${z}) rotateX(${rx}deg) rotateY(${ry}deg)`; };
    el._skSet = (a, b) => { rx = a; ry = b; set(); };
    el.onpointerdown = e => { drag = { x: e.clientX, y: e.clientY }; try { el.setPointerCapture(e.pointerId); } catch (_) {} };
    el.onpointermove = e => { if (!drag) return; ry += (e.clientX - drag.x) * .7; rx = Math.max(-80, Math.min(80, rx - (e.clientY - drag.y) * .5)); drag = { x: e.clientX, y: e.clientY }; set(); };
    el.onpointerup = el.onpointercancel = () => { drag = null; };
    el.onwheel = e => { e.preventDefault(); z = Math.max(.5, Math.min(2.2, z * (e.deltaY < 0 ? 1.1 : .9))); set(); };
    el.ondblclick = () => { rx = -8; ry = -28; z = 1; set(); };
    set();
  };
  im.src = src;
}

async function viewSkins() {
  const a = cur();
  if (!a) return V(`<div class="top"><h1>${esc(t('skins'))}</h1></div><div class="card empty">${esc(t('skinNeedAcc'))}<div class="foot" style="justify-content:center"><button class="btn p" data-acc>${ic('user')}${esc(t('signIn'))}</button></div></div>`);
  V(`<div class="top"><h1>${esc(t('skins'))}</h1></div><div class="mu">${esc(t('loading'))}</div>`);
  try { if (!S.skins) S.skins = await api('skin:profile'); S.skinSaved = await api('skin:saved'); }
  catch (e) { if (S.view !== 'skins') return; V(`<div class="top"><h1>${esc(t('skins'))}</h1></div><div class="card empty">${esc(errText(e))} <button class="btn sm" data-skretry>${ic('refresh')}</button></div>`); return; }
  if (S.view === 'skins') renderSkins();
}
function renderSkins() {
  const p = S.skins, sv = S.skinSaved || [], back = S.skView === 'back';
  V(`<div class="top"><h1>${esc(t('skins'))}</h1><div class="row"><button class="btn" data-skretry>${ic('refresh')}</button></div></div>
  <div class="row gap wrap" style="align-items:flex-start">
  <div class="card" style="width:300px;text-align:center"><div style="background:var(--card2);border-radius:22px;padding:6px;overflow:hidden"><div class="sk3d" id="sk3d" title="${esc(t('skRot'))}"></div></div><div class="mu sm" style="margin-top:8px">${esc(t('skRot'))}</div>
  <div class="seg" style="justify-content:center;margin-top:12px"><button data-skv="front" class="${back ? '' : 'on'}">${esc(t('skinFront'))}</button><button data-skv="back" class="${back ? 'on' : ''}">${esc(t('skinBack'))}</button></div>
  <div style="margin-top:12px"><b>${esc(p.name)}</b> <span class="tag">${esc(p.variant === 'slim' ? t('skinSlim') : t('skinClassic'))}</span></div></div>
  <div class="grow" style="min-width:300px"><div class="card"><div class="row gap wrap"><button class="btn p" data-skpick>${ic('import')}${esc(t('skinUpload'))}</button><button class="btn" data-sksave>${ic('check')}${esc(t('skinSaveCur'))}</button><button class="btn bad" data-skreset>${ic('refresh')}${esc(t('skinReset'))}</button></div><div class="mu sm" style="margin-top:10px">${esc(t('skinRules'))}</div></div>
  <h2>${esc(t('skinCapes'))}</h2><div class="card"><div class="row gap wrap"><button class="opt ${p.capes.some(c => c.active) ? '' : 'on'}" data-skcape="" style="width:auto;padding:10px 16px">${esc(t('skinNoCape'))}</button>${p.capes.map(c => `<button class="opt ${c.active ? 'on' : ''}" data-skcape="${esc(c.id)}" style="width:auto;padding:10px 14px">${c.data ? `<canvas data-cape="${esc(c.data)}" data-sc="4" style="image-rendering:pixelated"></canvas>` : ''}<b class="sm">${esc(c.alias || 'Cape')}</b></button>`).join('')}</div>${p.capes.length ? '' : `<div class="mu sm" style="margin-top:8px">${esc(t('skinNoCapes'))}</div>`}</div></div></div>
  <h2>${esc(t('skinSaved'))}</h2>${sv.length ? `<div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(150px,1fr))">${sv.map(x => `<div class="card" style="text-align:center;padding:12px"><canvas data-skin="${esc(x.data)}" data-slim="${x.variant === 'slim' ? 1 : 0}" data-sc="4" style="image-rendering:pixelated"></canvas><div class="sm" style="margin:6px 0"><b>${esc(x.name)}</b><div class="mu sm">${esc(x.variant === 'slim' ? t('skinSlim') : t('skinClassic'))}</div></div><div class="row" style="justify-content:center"><button class="btn sm p" data-skuse="${esc(x.id)}">${esc(t('skinUse'))}</button><button class="btn sm ic bad" data-skdel="${esc(x.id)}">${ic('trash')}</button></div></div>`).join('')}</div>` : `<div class="card empty">${esc(t('skinEmpty'))}</div>`}`);
  paintCanvases(); skin3d($('#sk3d'), p.skin, p.variant === 'slim', back ? { rx: 0, ry: 180 } : {});
}
async function skinPick() {
  const f = await api('skin:pick'); if (!f) return;
  let slim = S.skins && S.skins.variant === 'slim', save = true;
  const draw = () => {
    modal(`<h2>${ic('shirt')} ${esc(t('skinUpload'))}</h2><div class="row gap wrap" style="align-items:flex-start"><div style="background:var(--card2);border-radius:22px;padding:6px;width:240px;overflow:hidden"><div class="sk3d" id="skp" style="height:280px"></div></div>
    <div class="grow" style="min-width:220px"><div class="mu sm">${f.w}×${f.h} · ${(f.size / 1024).toFixed(1)} KB</div><label class="lab">${esc(t('skinModel'))}</label><div class="seg"><button data-m="classic" class="${slim ? '' : 'on'}">${esc(t('skinClassic'))}</button><button data-m="slim" class="${slim ? 'on' : ''}">${esc(t('skinSlim'))}</button></div>
    <label class="lab">${esc(t('name'))}</label><input id="skn" style="width:100%" value="${esc(f.name)}"><label class="row sm" style="margin-top:12px"><button class="sw ${save ? 'on' : ''}" id="sks"></button>${esc(t('skinSaveToo'))}</label></div></div>
    <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn p" id="ska">${ic('check')}${esc(t('skinApply'))}</button></div>`);
    skin3d($('#skp'), f.data, slim, { u: 6 });
    $$('[data-m]').forEach(b => b.onclick = () => { const n = $('#skn').value; slim = b.dataset.m === 'slim'; draw(); $('#skn').value = n; });
    $('#sks').onclick = e => { save = !save; e.currentTarget.classList.toggle('on', save); };
    $('#ska').onclick = async () => { const name = $('#skn').value.trim(), v = slim ? 'slim' : 'classic'; $('#ska').disabled = true; $('#ska').textContent = t('loading');
      await run(async () => { await api('skin:apply', { data: f.data, variant: v, save, name }); closeModal(); S.skins = null; delete S.heads[S.settings.selected]; toast(t('skinChanged'), 'ok'); viewSkins(); renderRail(); }); closeModalIf(); };
  };
  draw();
}
const closeModalIf = () => { const b = $('#ska'); if (b) { b.disabled = false; b.textContent = t('skinApply'); } };

/* ---------- Копии миров: локальные и облачные ---------- */
const fmtDate = ms => new Date(ms).toLocaleString(S.settings.lang || undefined, { dateStyle: 'medium', timeStyle: 'short' });
async function restoreModal(id) {
  const i = inst(id || S.instId); if (!i) return; id = i.id;
  modal(`<h2>${ic('history')} ${esc(t('bkpRestore'))} — ${esc(i.name)}</h2><div class="mu">${esc(t('loading'))}</div>`);
  let list; try { list = await api('inst:backups', id); } catch (e) { closeModal(); return fail(e); }
  modal(`<h2>${ic('history')} ${esc(t('bkpRestore'))} — ${esc(i.name)}</h2><p class="mu sm" style="margin-top:-6px">${esc(t('bkpRestoreD'))}</p>
  <div style="max-height:46vh;overflow:auto;display:grid;gap:8px">${list.map(b => `<div class="card item" style="padding:10px 14px"><div class="grow"><b>${esc(fmtDate(b.time))}</b><div class="mu sm">${esc(sizeMB(b.size))} · ${b.worlds} ${esc(t('bkpWorlds'))}${b.reason ? ' · ' + esc(b.reason) : ''}</div></div><button class="btn sm p" data-bkrestore="${esc(b.name)}">${esc(t('bkpRestoreBtn'))}</button><button class="btn sm ic bad" data-bkdel="${esc(b.name)}">${ic('trash')}</button></div>`).join('') || `<div class="card empty">${esc(t('bkpEmpty'))}</div>`}</div>
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn" data-cloudm="${esc(id)}">${ic('cloud')}${esc(t('cloudT'))}</button><button class="btn" data-bkmake="${esc(id)}">${ic('folder')}${esc(t('toolBkp'))}</button></div>`);
  S.bkId = id;
}
async function cloudModal(id) {
  const i = inst(id || S.instId); if (!i) return; id = i.id; S.bkId = id;
  const lim = await api('cloud:limits').catch(() => ({ cloud: { keep: 5, maxBytes: 157286400 } }));
  if (!S.settings.cloudBackups) {
    return modal(`<h2>${ic('cloud')} ${esc(t('cloudT'))}</h2><p class="mu">${esc(tf('cloudD', [lim.cloud.keep, Math.round(lim.cloud.maxBytes / 1048576)]))}</p>
    <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn p" id="cen">${esc(t('cloudEnable'))}</button></div>`), $('#cen').onclick = () => { setS({ cloudBackups: true }); cloudModal(id); };
  }
  modal(`<h2>${ic('cloud')} ${esc(t('cloudT'))} — ${esc(i.name)}</h2><div class="mu">${esc(t('loading'))}</div>`);
  let list = []; try { list = await api('cloud:list', id); } catch (e) { const m = String(e.message); if (!m.includes('cloudNoServer') && !m.includes('relogin') && !m.includes('noaccount')) { closeModal(); return fail(e); } list = null; S.cloudErr = m; }
  modal(`<h2>${ic('cloud')} ${esc(t('cloudT'))} — ${esc(i.name)}</h2><p class="mu sm" style="margin-top:-6px">${esc(tf('cloudD', [lim.cloud.keep, Math.round(lim.cloud.maxBytes / 1048576)]))}</p>
  ${list === null ? `<div class="card" style="border-color:var(--warn)">⚠ ${esc(S.cloudErr.includes('cloudNoServer') ? t('cloudNoServer') : t('noAcc'))}</div>` : `
  <label class="lab">${esc(t('cloudPass'))}</label><input id="cpw" type="password" autocomplete="off" style="width:100%">
  <div class="foot" style="justify-content:flex-start;margin-top:10px"><button class="btn p" id="cup">${ic('cloud')}${esc(t('cloudUp'))}</button></div>
  <label class="lab">${esc(t('cloudList'))}</label><div style="max-height:30vh;overflow:auto;display:grid;gap:8px">${list.map(c => `<div class="card item" style="padding:10px 14px"><div class="grow"><b>${esc(fmtDate(c.created))}</b><div class="mu sm">${esc(sizeMB(c.size))}</div></div><button class="btn sm p" data-cloudrest="${esc(c.id)}">${esc(t('bkpRestoreBtn'))}</button><button class="btn sm ic bad" data-clouddel="${esc(c.id)}">${ic('trash')}</button></div>`).join('') || `<div class="card empty">${esc(t('cloudEmpty'))}</div>`}</div>`}
  <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn bad" id="coff">${esc(t('cloudOff'))}</button></div>`);
  $('#coff').onclick = () => { setS({ cloudBackups: false }); closeModal(); };
  if ($('#cup')) $('#cup').onclick = () => { const pass = $('#cpw').value; closeModal(); run(async () => { await api('cloud:upload', { id, pass }); toast(t('cloudUploaded'), 'ok'); }).then(() => cloudModal(id)); };
}
/* ---------- Обмен сборкой по коду ---------- */
async function shareModal(id) {
  const i = inst(id || S.instId); if (!i) return; const lim = await api('cloud:limits').catch(() => ({ share: { maxBytes: 26214400, ttlDays: 7 } }));
  modal(`<h2>${ic('share')} ${esc(t('shareT'))} — ${esc(i.name)}</h2><p class="mu">${esc(tf('shareD', [lim.share.ttlDays, Math.round(lim.share.maxBytes / 1048576)]))}</p><div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn p" id="sgo2">${ic('share')}${esc(t('shareGo'))}</button></div>`);
  $('#sgo2').onclick = async () => {
    $('#sgo2').disabled = true; $('#sgo2').textContent = t('loading');
    try { const r = await api('share:upload', i.id);
      modal(`<h2>${ic('share')} ${esc(t('shareCode'))}</h2><div class="card" style="text-align:center"><div style="font-size:38px;font-weight:800;letter-spacing:.18em">${esc(r.code)}</div><div class="mu sm">${esc(t('shareExp'))}: ${esc(fmtDate(r.expiresAt))}</div></div><div class="foot"><button class="btn" data-close>OK</button><button class="btn p" data-copy="${esc(r.code)}">${ic('copy')}${esc(t('shareCopy'))}</button></div>`);
    } catch (e) { closeModal(); fail(e); }
  };
}
function codeModal() {
  modal(`<h2>${ic('share')} ${esc(t('shareHave'))}</h2><label class="lab" style="margin-top:0">${esc(t('shareEnter'))}</label><input id="shc" maxlength="12" style="width:100%;text-transform:uppercase;letter-spacing:.2em;font-size:22px;text-align:center" placeholder="ABC234">
  <div class="foot"><button class="btn" data-nmode="">${ic('back')}${esc(t('prev'))}</button><button class="btn p" id="shg">${ic('download')}${esc(t('shareInstall'))}</button></div>`); $('#shc').focus();
  $('#shg').onclick = async () => { const code = $('#shc').value; modal(`<h2>${ic('share')} ${esc(t('shareHave'))}</h2><p class="mu">${esc(t('buildWait'))}</p><div class="bar"><i style="width:100%;opacity:.35"></i></div>`); $('#modal').onclick = null;
    try { await afterPack(await api('share:download', code)); } catch (e) { closeModal(); fail(e); } };
}

/* ---------- О лаунчере ---------- */
function viewAbout() {
  const row = (n, d) => `<div class="setrow"><div class="grow"><b>${esc(n)}</b><small>${esc(d)}</small></div></div>`;
  V(`<button class="back" data-go="settings">${ic('back')}${esc(t('settings'))}</button><div class="hero"><img src="logo.png" style="width:84px;height:84px;border-radius:28px" alt=""><div class="grow"><h1>SA Launcher ${esc(S.version || '')}</h1><div class="mu">${esc(t('aboutNoAds'))}</div></div></div>
  <h2>${esc(t('aboutSends'))}</h2><div class="card"><p class="mu sm" style="margin-top:0">${esc(t('aboutNothing'))}</p>
  ${row('Modrinth', t('aMr'))}${row('CurseForge', t('aCf'))}${row('Feed The Beast', t('aFtb'))}${row('Mojang', t('aMj'))}${row('Microsoft', t('aMs'))}${row(t('aLdr'), t('aLdrD'))}${row(S.site.replace(/^https?:\/\//, ''), t('aSite'))}${row(t('aExplicit'), t('aExplicitD'))}${row('Discord', t('aDc'))}</div>
  <h2>${esc(t('aboutNever'))}</h2><div class="card"><div class="chips"><span class="tag">${esc(t('aNoAds'))}</span><span class="tag">${esc(t('aNoTele'))}</span><span class="tag">${esc(t('aNoThird'))}</span><span class="tag">${esc(t('aLicense'))}</span></div></div>
  <div class="foot" style="justify-content:flex-start;margin-top:16px"><button class="btn" data-opendata>${ic('folder')}${esc(t('openData'))}</button><button class="btn" data-site>${ic('globe')}${esc(t('openSite'))}</button></div>`);
}

/* ---------- Приветствие (3 шага) ---------- */
function welcome(step = 1) {
  const steps = [[1, 'user', 'w1T', 'w1D'], [2, 'box', 'w2T', 'w2D'], [3, 'play', 'w3T', 'w3D']], cur2 = steps[step - 1];
  const act = step === 1 ? `<button class="btn p" id="wa">${ic('user')}${esc(cur() ? t('done') : t('signIn'))}</button>` : step === 2 ? `<div class="row gap wrap"><button class="btn p" data-go="builds" data-wclose>${ic('box')}${esc(t('saBuilds'))}</button><button class="btn" data-new data-wclose>${ic('plus')}${esc(t('newInst'))}</button></div>` : '';
  modal(`<div class="row" style="justify-content:center;gap:8px;margin-bottom:14px">${steps.map(x => `<span class="tag" style="${x[0] === step ? 'background:var(--ac);color:var(--acx)' : ''}">${x[0]}</span>`).join('')}</div>
  <div style="text-align:center"><div class="bigi">${ic(cur2[1])}</div><h2>${esc(t(cur2[2]))}</h2><p class="mu">${esc(t(cur2[3]))}</p>${act}</div>
  <div class="foot" style="justify-content:space-between"><button class="btn" data-wend>${esc(t('wSkip'))}</button><button class="btn p" data-wnext="${step}">${esc(step === 3 ? t('wStart') : t('wNext'))}</button></div>`);
  if ($('#wa')) $('#wa').onclick = () => { closeModal(); S.afterLogin = () => welcome(2); doLogin(); };
}
const welcomeEnd = () => { closeModal(); setS({ welcomed: true }); };

/* ---------- прогресс ---------- */
// Панель прогресса обновляется «на месте»: элементы не пересоздаются (раньше innerHTML заменялся на каждое событие — всё мигало).
// Короткие задачи (<350 мс) вообще не показываем.
function renderDock() {
  const d = $('#dock'), now = Date.now();
  [...d.children].forEach(el => { if (!S.tasks[el.dataset.k]) el.remove(); });
  for (const [k, v] of Object.entries(S.tasks)) {
    if (now - (v.t0 || now) < 350) continue;
    let el = [...d.children].find(x => x.dataset.k === k);
    if (!el) { el = document.createElement('div'); el.className = 'task'; el.dataset.k = k; el.innerHTML = '<b></b><div class="bar"><i></i></div>'; d.append(el); }
    const b = el.firstChild, w = Math.round((v.pct || 0) * 100) + '%';
    if (b.textContent !== v.label) b.textContent = v.label || '';
    el.querySelector('i').style.width = w;
  }
}
async function refresh() { try { S.instances = await api('inst:list'); } catch (_) {} }

/* ---------- события ---------- */
document.addEventListener('click', async e => {
  const q = s => e.target.closest(s);
  let b;
  if ((b = q('[data-wclose]'))) { welcomeEnd(); }
  if (q('[data-wend]')) return welcomeEnd();
  if ((b = q('[data-wnext]'))) { const n = +b.dataset.wnext; return n >= 3 ? welcomeEnd() : welcome(n + 1); }
  if ((b = q('[data-uimodal]'))) { if (b.dataset.uimodal === (adv() ? 'advanced' : 'simple')) return; setS({ uiMode: b.dataset.uimodal }); return newInstanceModal('custom'); }
  if ((b = q('[data-uimode]'))) { setS({ uiMode: b.dataset.uimode }); return viewSettings(); }
  if (q('[data-skretry]')) { S.skins = null; return viewSkins(); }
  if ((b = q('[data-skv]'))) { S.skView = b.dataset.skv; return renderSkins(); }
  if (q('[data-skpick]')) return run(skinPick);
  if (q('[data-sksave]')) return run(async () => { await api('skin:saveCurrent', (cur() || {}).name); toast(t('skinSavedOk'), 'ok'); viewSkins(); });
  if (q('[data-skreset]')) { if (confirm(t('skinReset') + '?')) return run(async () => { await api('skin:reset'); S.skins = null; delete S.heads[S.settings.selected]; toast(t('skinChanged'), 'ok'); viewSkins(); renderRail(); }); return; }
  if ((b = q('[data-skcape]'))) return run(async () => { await api('skin:cape', b.dataset.skcape || null); S.skins = null; toast(t('skinChanged'), 'ok'); viewSkins(); });
  if ((b = q('[data-skuse]'))) return run(async () => { await api('skin:use', b.dataset.skuse); S.skins = null; delete S.heads[S.settings.selected]; toast(t('skinChanged'), 'ok'); viewSkins(); renderRail(); });
  if ((b = q('[data-skdel]'))) return run(async () => { await api('skin:delete', b.dataset.skdel); viewSkins(); });
  if (q('[data-restore]')) return restoreModal(S.instId);
  if ((b = q('[data-bkrestore]'))) { if (confirm(t('bkpConfirm'))) return run(async () => { await api('inst:restore', { id: S.bkId, name: b.dataset.bkrestore }); toast(t('bkpRestored'), 'ok'); restoreModal(S.bkId); }); return; }
  if ((b = q('[data-bkdel]'))) return run(async () => { await api('inst:delBackup', { id: S.bkId, name: b.dataset.bkdel }); restoreModal(S.bkId); });
  if (q('[data-bkmake]')) return run(async () => { const r = await api('inst:backup', S.bkId); toast(r ? `${t('bkpDone')} · ${sizeMB(r.size)}` : t('bkpNone'), r ? 'ok' : ''); restoreModal(S.bkId); });
  if (q('[data-cloudm]')) return cloudModal(S.bkId);
  if ((b = q('[data-cloudrest]'))) { const pass = ($('#cpw') || {}).value || ''; if (confirm(t('bkpConfirm'))) return run(async () => { await api('cloud:restore', { id: S.bkId, cloudId: b.dataset.cloudrest, pass }); toast(t('cloudRestored'), 'ok'); }); return; }
  if ((b = q('[data-clouddel]'))) return run(async () => { await api('cloud:delete', { id: S.bkId, cloudId: b.dataset.clouddel }); cloudModal(S.bkId); });
  if (q('[data-code]')) return codeModal();
  if ((b = q('[data-copy]'))) { try { await navigator.clipboard.writeText(b.dataset.copy); toast(t('shareCopy') + ' ✓', 'ok'); } catch (_) {} return; }
  if ((b = q('[data-bicon]'))) return run(async () => { if (await api('build:setIcon', b.dataset.bicon)) { S.builds = null; S.builds = await api('build:list'); buildModal(b.dataset.bicon); if (S.view === 'builds') viewBuilds(); } });
  if ((b = q('[data-biconclr]'))) return run(async () => { await api('build:clearIcon', b.dataset.biconclr); S.builds = await api('build:list'); buildModal(b.dataset.biconclr); if (S.view === 'builds') viewBuilds(); });
  if ((b = q('[data-go]'))) return go(b.dataset.go);
  if ((b = q('[data-build]'))) return buildModal(b.dataset.build);
  if ((b = q('[data-opensa]'))) { closeModal(); S.tab = 'mods'; return go('inst', b.dataset.opensa); }
  if (q('[data-site]')) return api('shell:site');
  if (q('[data-acc]')) return accountsModal();
  if ((b = q('[data-ext]'))) return api('shell:open', b.dataset.ext);
  if (q('[data-new]')) return newInstanceModal();
  if ((b = q('[data-nmode]'))) return newInstanceModal(b.dataset.nmode);
  if (q('[data-import]')) return run(async () => { const i = await api('inst:importFile'); if (i) await afterPack(i); });
  if ((b = q('[data-cardfolder]'))) { e.stopPropagation(); return api('inst:folder', { id: b.dataset.cardfolder, sub: '' }).catch(fail); }
  if ((b = q('[data-play]'))) { e.stopPropagation(); const id = b.dataset.play, i = inst(id); if (i && i.running) return api('inst:stop', id); if (!cur()) return accountsModal(); return run(async () => { if (S.view !== 'inst') {} await api('inst:play', id); }); }
  if ((b = q('[data-qw]'))) return run(async () => { if (!cur()) return accountsModal(); await api('inst:play', { id: b.dataset.qw, quick: { world: b.dataset.q } }); });
  if ((b = q('[data-qs]'))) return run(async () => { if (!cur()) return accountsModal(); await api('inst:play', { id: b.dataset.qs, quick: { server: b.dataset.q } }); });
  if ((b = q('[data-inst]'))) { S.tab = 'mods'; return go('inst', b.dataset.inst); }
  if ((b = q('[data-tab]'))) { S.tab = b.dataset.tab; $$('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); return renderTab(); }
  if (q('[data-upd]')) return updateModal(); if (q('[data-opt]')) return optimizeModal(); if (q('[data-boost]')) return boostModal();
  if (q('[data-folder]')) return api('inst:folder', { id: S.instId });
  if (q('[data-addc]')) { S.target = S.instId; S.catalog.type = S.tab === 'mods' ? 'mod' : S.tab; S.catalog.version = ''; S.catalog.res = null; return go('discover'); }
  if (q('[data-untarget]')) { S.target = null; S.catalog.version = ''; S.catalog.loader = ''; S.catalog.res = null; return renderView(); }
  if ((b = q('[data-tg]'))) return run(async () => { await api('inst:toggle', { id: S.instId, kind: S.tab, file: b.dataset.tg }); renderTab(); });
  if ((b = q('[data-rm]'))) return run(async () => { await api('inst:removeFile', { id: S.instId, kind: S.tab, file: b.dataset.rm }); renderTab(); });
  if (q('[data-savei]')) return run(async () => { const on = id => $('#' + id).classList.contains('on'), val = id => ($('#' + id).value || '').trim();
    await api('inst:update', { id: S.instId, patch: { name: val('sn') || inst(S.instId).name, group: val('sg'), memory: +$('#sm').value, width: val('sw'), height: val('sh'), fullscreen: on('sfs'), autoJoin: val('saj'), openLogs: on('sco'), recordPlaytime: on('srp'),
      ...(adv() ? { minMemory: val('smm'), javaPath: val('sjp'), jvmArgs: val('sj'), preLaunch: val('spl'), wrapper: val('swr'), postExit: val('spe'), envVars: $('#sev').value } : {}) } }); await refresh(); toast(t('done'), 'ok'); renderView(); });
  if (q('[data-seticon]')) return run(async () => { if (await api('inst:setIcon', S.instId)) { await refresh(); S.tab = 'settings'; viewInst(); } });
  if (q('[data-clricon]')) return run(async () => { await api('inst:clearIcon', S.instId); await refresh(); S.tab = 'settings'; viewInst(); });
  if (q('[data-dup]')) return dupModal();
  if (q('[data-tools]')) return toolsModal();
  if (q('[data-updall]')) return updAllModal();
  if ((b = q('[data-tool]'))) return toolAction(b.dataset.tool);
  if (q('[data-del]')) { if (confirm(t('confirmDel'))) return run(async () => { await api('inst:delete', S.instId); await refresh(); go('library'); }); return; }
  if ((b = q('[data-ctype]'))) { S.catalog.type = b.dataset.ctype; S.catalog.res = null; S.catalog.page = 0; return viewDiscover(); }
  if (q('[data-retry]')) return search(true);
  if ((b = q('[data-pg]'))) { S.catalog.page = Math.max(0, S.catalog.page + +b.dataset.pg); search(true); return void ($('#view').scrollTop = 0); }
  if ((b = q('[data-soon]'))) return toast(tf('srcSoonD', [b.dataset.soon]), '');
  if ((b = q('[data-donetarget]'))) { S.target = null; return go('inst', b.dataset.donetarget); }
  if ((b = q('[data-manual]'))) return manualModal(b.dataset.manual);
  if (q('[data-addfile]')) return run(async () => { const kind = S.tab === 'mods' ? 'mod' : S.tab, r = await api('inst:addFiles', { id: S.instId, kind }); if (r) { toast(t('filesAdded') + ': ' + r.length, r.length ? 'ok' : 'err'); renderTab(); } });
  if (q('[data-tabfolder]')) return api('inst:folder', { id: S.instId, sub: { mods: 'mods', resourcepack: 'resourcepacks', shader: 'shaderpacks' }[S.tab] || '' });
  if (q('[data-worldsdir]')) return api('inst:folder', { id: S.instId, sub: 'saves' });
  if ((b = q('[data-addmanual]'))) return run(async () => { const id = b.dataset.addmanual, r = await api('inst:addManual', id); if (!r) return; await refresh(); toast(t('manAdded') + ': ' + r.added, 'ok'); if (S.view === 'inst') viewInst(); r.left ? manualModal(id) : closeModal(); });
  if ((b = q('[data-getp]'))) { e.stopPropagation(); S.pendingTitle = b.dataset.ptitle || ''; const id = b.dataset.getp, ty = b.dataset.ptype; if ($('#modal') && !$('#modal').classList.contains('hide')) closeModal(); return installProject(id, ty, b.dataset.psrc); }
  if ((b = q('[data-src]'))) { S.catalog.src = b.dataset.src; S.catalog.res = null; S.catalog.page = 0; return viewDiscover(); }
  if ((b = q('[data-proj]'))) { if ((S.catalog.src || 'modrinth') === 'curseforge' && S.view === 'discover') { const h = (S.catalog.res || []).find(x => String(x.id) === b.dataset.proj); return h && h.url ? api('shell:open', h.url) : null; } return projectModal(b.dataset.proj); }
  if ((b = q('[data-ver]'))) return versionModal(b.dataset.ver);
  if (q('[data-launcher-upd]')) return updateLauncher();
  if ((b = q('[data-fixplay]'))) { closeModal(); return run(async () => { await api('inst:play', b.dataset.fixplay); }); }
  if ((b = q('[data-tgf]'))) { const k = b.dataset.tgf, v = !S.settings[k]; b.classList.toggle('on', v); if (k === 'lite') toast(t('liteRestart'), ''); return setS({ [k]: v }); }
  if (q('[data-clrcache]')) return run(async () => { const n = await api('app:clearCache'); toast(t('cleared') + ' · ' + (n / 1048576).toFixed(0) + ' MB ' + t('freed'), 'ok'); });
  if (q('[data-opendata]')) return api('app:openData');
  if (q('[data-resets]')) { if (confirm(t('resetS') + '?')) return run(async () => { Object.assign(S.settings, await api('settings:reset')); applyTheme({ instant: true }); renderRail(); viewSettings(); }); return; }
  if ((b = q('[data-tgl]'))) { const k = b.dataset.tgl; const v = !(S.settings[k] !== false); b.classList.toggle('on', !v); setS({ [k]: !v }); return; }
  if (q('[data-bgadd]') || (b = q('[data-bgrep]'))) return run(async () => { const r = await api('bg:add', b ? b.dataset.bgrep : undefined); if (!r) return; Object.assign(S.settings, { customBgs: r.list, customBgSel: r.sel }); applyTheme(); viewSettings(); });
  if ((b = q('[data-bgdel]'))) return run(async () => { const r = await api('bg:remove', b.dataset.bgdel); Object.assign(S.settings, { customBgs: r.list, customBgSel: r.sel }); applyTheme(); viewSettings(); });
  if ((b = q('[data-bgsel]'))) { setS({ customBgSel: b.dataset.bgsel }); return viewSettings(); }
  if ((b = q('[data-bgfit]'))) { setS({ customBgFit: b.dataset.bgfit }); return viewSettings(); }
  if ((b = q('[data-th]'))) { setS({ theme: b.dataset.th }); return viewSettings(); }
  if ((b = q('[data-acc-c]'))) { setS({ accent: b.dataset.accC }); renderRail(); return viewSettings(); }
  if ((b = q('[data-lang]'))) { setS({ lang: b.dataset.lang }); renderRail(); return renderView(); }
  if (q('[data-ely]')) return elyModal();
  if (q('[data-login]')) return doLogin(q('[data-login]'));
  if ((b = q('[data-selacc]'))) { await api('auth:select', b.dataset.selacc); S.settings.selected = b.dataset.selacc; renderRail(); return refreshAcc(); }
  if ((b = q('[data-rmacc]'))) return run(async () => { const r = await api('auth:remove', b.dataset.rmacc); S.accounts = r.accounts; S.settings.selected = r.selected; renderRail(); refreshAcc(); });
});
function refreshAcc() { if ($('#accm')) $('#accm').innerHTML = accountsHTML(); if ($('#accs')) $('#accs').innerHTML = accountsHTML(); }

addEventListener('error', e => { if (e.target && e.target.tagName === 'IMG') e.target.style.visibility = 'hidden'; }, true);

/* ---------- Minecraft: Bedrock Edition (только Windows) ---------- */
// Игра ставится и запускается через Microsoft Store / Xbox; лаунчер находит её, запускает (в том числе сразу на сервер),
// показывает миры и паки, ставит файлы .mcworld/.mcpack/.mcaddon и делает копии миров.
const BR_KIND = { resource: 'brResource', behavior: 'brBehavior', skin: 'brSkin' };
const brIco = (u, e) => u ? `<img class="ico" src="${esc(u)}" alt="">` : `<span class="ico" style="display:grid;place-items:center;font-size:22px;background:var(--card2)">${e}</span>`;
const brName = id => t(id === 'preview' ? 'brPreview' : 'brRelease');
async function viewBedrock(force) {
  const head_ = `<div class="top"><div><h1>${esc(t('brTitle'))}</h1><div class="mu sm">${esc(t('brSub'))}</div></div></div>`;
  if (S.platform !== 'win32') return V(head_ + `<div class="card empty">${esc(t('brWinOnly'))}</div>`);
  const B = S.br || (S.br = { ed: 'release', tab: 'worlds' });
  V(head_ + `<div class="card empty">${esc(t('loading'))}</div>`);
  let info; try { info = await api('bedrock:info', !!force); } catch (e) { return fail(e); }
  if (S.view !== 'bedrock') return;
  const eds = info.editions || [];
  // Сам выбирает установленное издание только пока пользователь не нажимал кнопки изданий; иначе выбор «Preview» сразу сбрасывался назад
  if (!B.picked && !(eds.find(x => x.id === B.ed) || {}).installed) { const i = eds.find(x => x.installed); if (i) B.ed = i.id; }
  const e = eds.find(x => x.id === B.ed) || eds[0] || { id: 'release', installed: false };
  const top = `<div class="top"><div><h1>${esc(t('brTitle'))}</h1><div class="mu sm">${esc(t('brSub'))}</div></div>
    <div class="row wrap"><div class="seg">${eds.map(x => `<button data-bred="${x.id}" class="${x.id === e.id ? 'on' : ''}">${esc(brName(x.id))}${x.installed ? '' : ' ·&nbsp;—'}</button>`).join('')}</div>
    <button class="btn ic" data-brscan title="${esc(t('brRescan'))}">${ic('refresh')}</button>
    ${e.installed ? `<button class="btn p" data-brplay>${ic('play')}${esc(t('play'))}</button>` : ''}</div></div>`;
  if (!e.installed) return V(top + `<div class="card empty"><div style="font-size:17px;color:var(--tx);font-weight:700;margin-bottom:6px">${esc(tf('brNotInst', [brName(e.id)]))}</div><div style="margin-bottom:16px">${esc(t('brNotInstD'))}</div><button class="btn p" data-brstore>${ic('download')}${esc(t('brGet'))}</button></div>`);
  const tabs = [['worlds', t('brWorlds')], ['packs', t('brPacks')], ['servers', t('brServers')]];
  const bar = `<div class="card" style="margin-bottom:14px"><div class="row wrap"><div class="grow mu sm">${esc(brName(e.id))}${e.version ? ' · ' + esc(e.version) : ''}<br>${esc(t('brLoginNote'))}</div>
    <button class="btn" data-brimport>${ic('import')}${esc(t('brImport'))}</button><button class="btn" data-brfolder>${ic('folder')}${esc(t('openFolder'))}</button></div></div>
    <div class="seg" style="margin-bottom:14px">${tabs.map(([k, n]) => `<button data-brtab="${k}" class="${B.tab === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div><div id="brbody"></div>`;
  V(top + bar);
  const box = $('#brbody');
  try {
    if (B.tab === 'worlds') {
      const w = await api('bedrock:worlds', e.id); if (S.view !== 'bedrock' || !$('#brbody')) return;
      box.innerHTML = (w.length ? w.map((x, i) => `<div class="card item">${brIco(x.icon, '🌍')}<div class="grow"><b>${esc(x.name)}</b><div class="mu sm">${esc(fmtDate(x.time))} · ${esc(sizeMB(x.size))}</div></div><button class="btn sm" data-brbackup="${i}">${ic('copy')}${esc(t('brBackup'))}</button></div>`).join('') : `<div class="card empty">${esc(t('brNoWorlds'))}</div>`)
        + `<div class="foot" style="justify-content:flex-start;margin-top:12px"><button class="btn" data-brbackups>${ic('folder')}${esc(t('brBackups'))}</button></div>`;
      S.br.list = w;
    } else if (B.tab === 'packs') {
      const p = await api('bedrock:packs', e.id); if (S.view !== 'bedrock' || !$('#brbody')) return;
      box.innerHTML = p.length ? p.map((x, i) => `<div class="card item">${brIco(x.icon, '📦')}<div class="grow"><b>${esc(x.name)}</b> <span class="tag">${esc(t(BR_KIND[x.kind]))}</span><div class="mu sm">${esc(x.desc || '')}${x.version ? (x.desc ? ' · ' : '') + 'v' + esc(x.version) : ''} · ${esc(sizeMB(x.size))}</div></div><button class="btn ic sm bad" data-brrm="${i}" title="${esc(t('del'))}">${ic('trash')}</button></div>`).join('') : `<div class="card empty">${esc(t('brNoPacks'))}</div>`;
      S.br.list = p;
    } else {
      const sv = await api('bedrock:servers'); if (S.view !== 'bedrock' || !$('#brbody')) return;
      S.br.list = sv;
      box.innerHTML = `<div class="card" style="margin-bottom:12px"><div class="row wrap"><input id="brsn" placeholder="${esc(t('brSrvName'))}" style="flex:1;min-width:140px"><input id="brsh" placeholder="play.example.com" style="flex:2;min-width:180px" spellcheck="false"><input id="brsp" type="number" min="1" max="65535" value="19132" style="width:100px"><button class="btn p" data-bradd>${ic('plus')}${esc(t('brSrvAdd'))}</button></div></div>`
        + (sv.length ? sv.map((x, i) => `<div class="card item"><div class="grow"><b>${esc(x.name || x.host)}</b><div class="mu sm">${esc(x.host)}:${x.port}</div></div><button class="btn p sm" data-brjoin="${i}">${ic('play')}${esc(t('brJoin'))}</button><button class="btn sm" data-braddg="${i}">${esc(t('brAddGame'))}</button><button class="btn ic sm bad" data-brsdel="${i}" title="${esc(t('del'))}">${ic('x')}</button></div>`).join('') : `<div class="mu sm" style="padding:4px 6px">${esc(t('brNoSrv'))}</div>`);
    }
  } catch (err) { fail(err); }
}
document.addEventListener('click', async ev => {
  const q = s => ev.target.closest(s); let b;
  if (S.view !== 'bedrock') return;
  const B = S.br || (S.br = { ed: 'release', tab: 'worlds' }), re = () => viewBedrock();
  if ((b = q('[data-bred]'))) { B.ed = b.dataset.bred; B.picked = true; return re(); }
  if ((b = q('[data-brtab]'))) { B.tab = b.dataset.brtab; return re(); }
  if (q('[data-brscan]')) return viewBedrock(true);
  if (q('[data-brstore]')) return run(() => api('bedrock:store', B.ed));
  if (q('[data-brplay]')) return run(async () => { await api('bedrock:launch', { edition: B.ed }); toast(t('brStarting'), 'ok'); });
  if (q('[data-brfolder]')) return run(() => api('bedrock:folder', { edition: B.ed }));
  if (q('[data-brbackups]')) return run(() => api('bedrock:backups'));
  if (q('[data-brimport]')) return run(async () => { const n = await api('bedrock:import'); if (n) toast(tf('brImported', [n]), 'ok'); });
  if ((b = q('[data-brbackup]'))) { const w = B.list[+b.dataset.brbackup]; b.disabled = true; return run(async () => { await api('bedrock:backup', { edition: B.ed, owner: w.owner, folder: w.folder }); toast(t('brBackupDone'), 'ok'); }).finally(() => { b.disabled = false; }); }
  if ((b = q('[data-brrm]'))) { const p = B.list[+b.dataset.brrm]; if (!confirm(t('brDelPack') + '\n' + p.name)) return; return run(async () => { await api('bedrock:removePack', { edition: B.ed, kind: p.kind, folder: p.folder }); re(); }); }
  if (q('[data-bradd]')) {
    const name = $('#brsn').value.trim(), host = $('#brsh').value.trim().replace(/^[a-z]+:\/\//i, ''), port = +$('#brsp').value || 19132;
    if (!host) return $('#brsh').focus();
    return run(async () => { const l = await api('bedrock:servers'); const nl = await api('bedrock:servers', [...l, { name: name || host, host, port }]); if (nl.length === l.length) throw new Error('err:brBadHost'); re(); });
  }
  if ((b = q('[data-brjoin]'))) return run(async () => { await api('bedrock:launch', { edition: B.ed, server: B.list[+b.dataset.brjoin] }); toast(t('brStarting'), 'ok'); });
  if ((b = q('[data-braddg]'))) return run(async () => { await api('bedrock:addServer', { edition: B.ed, server: B.list[+b.dataset.braddg] }); toast(t('brStarting'), 'ok'); });
  if ((b = q('[data-brsdel]'))) return run(async () => { const l = B.list.filter((_, i) => i !== +b.dataset.brsdel); await api('bedrock:servers', l); re(); });
});

/* ---------- старт ---------- */
(async function init() {
  const info = await api('app:init'); Object.assign(S, { accounts: info.accounts, site: info.site, version: info.version, platform: info.platform });
  Object.assign(S.settings, info.settings);
  if (!S.settings.lang) { const l = (info.locale || 'en').toLowerCase().slice(0, 2); S.settings.lang = LANGS[l] ? l : 'en'; api('settings:set', { lang: S.settings.lang }).catch(() => {}); }
  applyTheme({ instant: true }); await refresh(); renderRail(); renderView(); loadRecent();
  if (S.settings.welcomed === false) welcome(1);
  api('app:pendingLink').then(l => { if (l) deepLink(l); }).catch(() => {});
  if (S.settings.checkUpdates !== false) api('launcher:check').then(r => { S.lupd = r; if (r.available) toast(t('newVer') + ': ' + r.latest, 'ok'); }).catch(() => {});
  sa.on((ch, d) => {
    if (ch === 'progress') { if (d.done) delete S.tasks[d.task]; else { const o = S.tasks[d.task]; S.tasks[d.task] = { ...d, t0: o ? o.t0 : Date.now() }; if (!o) setTimeout(renderDock, 380); } renderDock(); }
    else if (ch === 'log') { const a = S.logs[d.id] || (S.logs[d.id] = []); a.push(d.line); if (a.length > 600) a.splice(0, 100); if (S.view === 'inst' && S.tab === 'logs' && S.instId === d.id) { const b = $('#logbox'); if (b) { b.textContent += (b.textContent ? '\n' : '') + d.line; b.scrollTop = b.scrollHeight; } } }
    else if (ch === 'state') { const i = inst(d.id); if (i) i.running = d.running; if (d.running && (S.settings.openLogs || (inst(d.id) || {}).openLogs)) { S.tab = 'logs'; S.instId = d.id; S.view = 'inst'; renderRail(); } if (S.view === 'library' || S.view === 'home') renderView(); if (S.view === 'inst' && S.instId === d.id) viewInst(); if (!d.running) loadRecent(); if (!d.running && d.code && d.code !== 0) toast(`${t('error')}: exit ${d.code}`, 'err'); }
    else if (ch === 'crash') { if (d.problems.length || true) crashModal(d); }
    else if (ch === 'error') toast(d.message, 'err');
    else if (ch === 'deeplink') deepLink(d);
    else if (ch === 'trim') { S.popular = null; S.builds = null; S.skins = null; S.skinSaved = null; S.catalog.res = null; S.mcv = null; S.recent = null; }
  });
})().catch(e => { document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f87171;position:fixed;inset:60px 20px;z-index:99">${esc(e.stack || e)}</pre>`); });
