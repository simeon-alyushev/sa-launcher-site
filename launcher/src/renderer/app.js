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
  box: '<path d="M3 8l9-5 9 5v8l-9 5-9-5zM3 8l9 5 9-5M12 13v8"/>'
};
const ic = n => `<svg class="i" viewBox="0 0 24 24">${P[n]}</svg>`;

const S = { settings: { lang: 'en', theme: 'dark', accent: '#4ade80' }, accounts: [], instances: [], view: 'home', instId: null, tab: 'mods', target: null, logs: {}, tasks: {}, site: '', catalog: { type: 'mod', q: '', loader: '', version: '', res: null, busy: false, page: 0, src: 'modrinth', hasNext: false }, popular: null, mcv: null };
const t = k => ((LANGS[S.settings.lang] || LANGS.en).t[k]) || LANGS.en.t[k] || k;
const api = (n, a) => sa.call(n, a);
const LOADERS = ['vanilla', 'fabric', 'quilt', 'forge', 'neoforge'];
const LN = { vanilla: 'Vanilla', fabric: 'Fabric', quilt: 'Quilt', forge: 'Forge', neoforge: 'NeoForge' };
const ACCENTS = ['#1bd96a', '#4f8cff', '#f87171'];   // как на сайте (Modrinth / Prism / SA); 4-й вариант — свой цвет
const THEMES = [['dark', '#0f1115', '#4ade80'], ['light', '#eef1f6', '#4ade80'], ['amoled', '#000', '#4ade80'], ['glass', 'linear-gradient(135deg,#7c5cff,#22b8ff 60%,#4ade80)', '#fff'], ['glasslight', 'linear-gradient(135deg,#ffd6e8,#cfe3ff 60%,#d9ffe8)', '#fff'], ['cold', 'linear-gradient(135deg,#0a1626,#7cc4ff)', '#fff'], ['warm', 'linear-gradient(135deg,#fff3dc,#ffb347)', '#fff'], ['autumn', 'linear-gradient(135deg,#1d120b,#e8742c)', '#fff'], ['spring', 'linear-gradient(135deg,#0b1a1c,#5ec8d8)', '#fff'], ['custom', 'conic-gradient(#f472b6,#facc15,#4ade80,#22d3ee,#a78bfa,#f472b6)', '#fff']];

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
  const body = a.p === 'ms' ? `<img src="https://crafatar.com/avatars/${esc(a.id)}?size=64&overlay" alt="">` : '';
  return `<span class="hd">${l}${body}</span>`;
};
const cur = () => S.accounts.find(a => a.id === S.settings.selected) || S.accounts[0];
const inst = id => S.instances.find(i => i.id === id);
const fmtTime = s => s >= 3600 ? Math.floor(s / 3600) + ' h ' + Math.floor(s % 3600 / 60) + ' m' : Math.floor(s / 60) + ' m';

function toast(msg, kind = '') { const e = document.createElement('div'); e.className = 'toast ' + kind; e.textContent = msg; $('#toasts').append(e); setTimeout(() => e.remove(), kind === 'err' ? 6000 : 3000); }
const fail = e => { const m = String(e.message || e).replace(/^Error invoking remote method '[^']+': (Error: )?/, ''); if (m.endsWith('nolicense')) { toast(t('noLicense'), 'err'); return accountsModal(); } if (m === 'noaccount' || m === 'relogin') { toast(t('noAcc'), 'err'); return accountsModal(); } toast(m.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'err'); };
async function run(fn) { try { return await fn(); } catch (e) { fail(e); } }

/* ---------- тема ---------- */
function applyTheme() {
  const s = S.settings, r = document.documentElement;
  r.dataset.theme = s.theme; r.lang = s.lang;
  if (typeof SAFx !== 'undefined') SAFx.set(s.anims === false ? 'dark' : s.theme);
  r.style.setProperty('--ac', s.accent); r.style.setProperty('--acx', lum(s.accent) > .5 ? '#08130c' : '#ffffff');
  if ((s.theme === 'glass' || s.theme === 'glasslight') && s.blur != null) r.style.setProperty('--bl', s.blur + 'px'); else r.style.removeProperty('--bl');
  const custom = s.theme === 'custom';
  if (custom) {
    const dark = lum(s.customBg) < .4; r.dataset.mode = dark ? 'dark' : 'light';
    r.style.setProperty('--bg', s.customBg); r.style.setProperty('--card', s.customCard); r.style.setProperty('--card2', `color-mix(in srgb,${s.customCard},${dark ? '#fff' : '#000'} 8%)`);
    r.style.setProperty('--tx', dark ? '#f2f4f8' : '#14171d'); r.style.setProperty('--mu', dark ? '#9aa3b2' : '#667085');
  } else { delete r.dataset.mode; ['--bg', '--card', '--card2', '--tx', '--mu'].forEach(p => r.style.removeProperty(p)); }
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
  const a = cur(), nav = (v, i, tt) => `<button class="nav ${S.view === v || (v === 'library' && S.view === 'inst') ? 'on' : ''}" data-go="${v}" title="${esc(tt)}">${ic(i)}</button>`;
  $('#rail').innerHTML = `<div class="rail-in"><img class="logo" src="logo.png" alt="SA" data-site>${nav('home', 'home', t('home'))}${nav('library', 'library', t('library'))}${nav('discover', 'compass', t('discover'))}${nav('builds', 'box', t('saBuilds'))}${railQuick() ? `<div class="sep"></div><div class="rq">${railQuick()}</div>` : ''}<div class="sp"></div>
  <button class="nav" data-acc title="${esc(t('accounts'))}">${a ? head(a) : ic('user')}</button>${nav('settings', 'gear', t('settings'))}</div>`;
}
function go(view, id) {
  S.view = view; if (id !== undefined) S.instId = id;
  renderRail(); renderView(); $('#view').scrollTop = 0;
}
function renderView() {
  const v = S.view;
  if (v === 'home') return viewHome(); if (v === 'library') return viewLibrary(); if (v === 'inst') return viewInst();
  if (v === 'discover') return viewDiscover(); if (v === 'settings') return viewSettings(); if (v === 'builds') return viewBuilds();
}
const V = html => { $('#view').innerHTML = html; };

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
  <div class="grid" style="grid-template-columns:repeat(auto-fill,minmax(320px,1fr))">${S.builds.map(b => `<div class="card bcard" data-build="${esc(b.id)}" style="cursor:pointer"><div class="row gap">${tile({ id: b.id, name: b.name }, 'lg')}<div class="grow"><b style="font-size:18px">${esc(b.name)}</b><div class="mu sm">${LN[b.loader]} · ${esc(t('mods'))} ${b.mods.length} · ${esc(t('packs'))} ${b.resourcepacks.length} · ${esc(t('shaders'))} ${b.shaders.length}</div></div></div>
  <p class="mu sm" style="margin:12px 0">${esc(b.desc)}</p><button class="btn p" data-build="${esc(b.id)}">${ic('download')}${esc(t('install'))}</button></div>`).join('')}</div>`);
}
async function buildModal(id) {
  const b = (S.builds || []).find(x => x.id === id); if (!b) return;
  let rel = []; try { rel = await api('build:versions'); } catch (_) {}
  const chips = (arr) => arr.map(n => `<span class="tag">${esc(n)}</span>`).join(' ');
  modal(`<h2>${ic('box')} ${esc(b.name)}</h2><p class="mu" style="margin-top:-6px">${esc(b.desc)}</p>
  <label class="lab">${esc(t('name'))}</label><input id="bn" style="width:100%" value="${esc(b.name)}">
  <label class="lab">${esc(t('mcVersion'))}</label><select id="bv" style="width:100%"><option value="auto">${esc(t('auto'))}</option>${rel.map(v => `<option>${esc(v)}</option>`).join('')}</select>
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
  <button class="fab ${run ? 'run' : ''}" data-play="${esc(i.id)}" title="${esc(run ? t('stop') : t('play'))}">${ic(run ? 'stop' : 'play')}</button></div>`;
}
function sortedInst() {
  const m = S.settings.sort || 'recent', a = [...S.instances];
  if (m === 'name') a.sort((x, y) => x.name.localeCompare(y.name)); else if (m === 'playtime') a.sort((x, y) => (y.playtime || 0) - (x.playtime || 0));
  return a;
}
function viewLibrary() {
  V(`<div class="top"><h1>${esc(t('library'))}</h1><div class="row"><button class="btn" data-import>${ic('import')}${esc(t('importPack'))}</button><button class="btn p" data-new>${ic('plus')}${esc(t('newInst'))}</button></div></div>
  ${S.instances.length ? `<div class="grid">${sortedInst().map(instCard).join('')}</div>` : `<div class="card empty">${esc(t('emptyLib'))}</div>`}`);
}

/* ---------- Страница сборки ---------- */
async function viewInst() {
  const i = inst(S.instId); if (!i) return go('library');
  const tabs = [['mods', t('mods')], ['resourcepack', t('packs')], ['shader', t('shaders')], ['logs', t('logs')], ['settings', t('settings')]];
  V(`<button class="back" data-go="library">${ic('back')}${esc(t('library'))}</button>
  <div class="row gap wrap" style="margin:8px 0 20px">${tile(i, 'lg')}<div class="grow"><h1 style="margin:0">${esc(i.name)}</h1><div class="mu">${esc(i.mc)} · ${LN[i.loader]}${i.loaderVersion ? ' ' + esc(i.loaderVersion) : ''}${i.playtime ? ' · ' + fmtTime(i.playtime) : ''}</div></div>
  <div class="row wrap"><button class="btn p" data-play="${esc(i.id)}">${ic(i.running ? 'stop' : 'play')}${esc(i.running ? t('stop') : t('play'))}</button>
  <button class="btn" data-upd>${ic('refresh')}${esc(t('update'))}</button><button class="btn" data-opt>${ic('bolt')}${esc(t('optimize'))}</button>
  <button class="btn ic" data-folder title="${esc(t('openFolder'))}">${ic('folder')}</button></div></div>
  ${i.trimmed && i.trimmed.length ? `<div class="card" style="border-color:var(--warn);margin-bottom:14px"><b>⚠ ${esc(t('trimmedT'))}</b><div class="sm mu" style="margin-top:4px">${esc(t('trimmedD').replace('{v}', i.mc))}</div><div class="chips" style="margin-top:8px">${i.trimmed.map(n => `<span class="tag">${esc(n)}</span>`).join(' ')}</div></div>` : ''}
  <div class="pill" style="margin-bottom:18px;flex-wrap:wrap">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div><div id="tabc"></div>`);
  renderTab();
}
async function renderTab() {
  const i = inst(S.instId), box = $('#tabc'); if (!i || !box) return;
  if (S.tab === 'logs') { box.innerHTML = `<pre class="log" id="logbox">${esc((S.logs[i.id] || []).join('\n'))}</pre>`; const b = $('#logbox'); b.scrollTop = b.scrollHeight; return; }
  if (S.tab === 'settings') {
    box.innerHTML = `<div class="card"><label class="lab" style="margin-top:0">${esc(t('name'))}</label><input id="sn" value="${esc(i.name)}" style="width:100%">
    <label class="lab">${esc(t('memory'))}: <b id="mv">${i.memory || S.settings.memory}</b></label><input type="range" id="sm" min="1024" max="16384" step="512" value="${i.memory || S.settings.memory}">
    <label class="lab">${esc(t('photo'))}</label><div class="row gap">${tile(i, 'lg')}<button class="btn" data-seticon>${ic('import')}${esc(t('choosePhoto'))}</button>${i.iconData ? `<button class="btn bad" data-clricon>${ic('trash')}${esc(t('removePhoto'))}</button>` : ''}</div>
    <label class="lab">${esc(t('jvmArgs'))}</label><textarea id="sj" rows="3" placeholder="${esc(S.settings.jvmArgs || '')}">${esc(i.jvmArgs || '')}</textarea>
    <label class="lab">Java</label><input id="sjp" style="width:100%" placeholder="auto" value="${esc(i.javaPath || '')}">
    <label class="lab">${esc(t('window'))}</label><div class="row gap wrap"><input id="sw" type="number" min="320" placeholder="${esc(t('width'))}" value="${esc(i.width || '')}" style="width:110px"><span class="mu">×</span><input id="sh" type="number" min="240" placeholder="${esc(t('height'))}" value="${esc(i.height || '')}" style="width:110px"><label class="row sm mu"><button class="sw ${i.fullscreen ? 'on' : ''}" id="sfs"></button>${esc(t('fullscreen'))}</label></div>
    <div class="foot" style="justify-content:space-between"><div class="row"><button class="btn" data-dup>${ic('copy')}${esc(t('dup'))}</button><button class="btn bad" data-del>${ic('trash')}${esc(t('del'))}</button></div><button class="btn p" data-savei>${ic('check')}${esc(t('save'))}</button></div></div>`;
    $('#sm').oninput = e => $('#mv').textContent = e.target.value; $('#sfs').onclick = e => e.currentTarget.classList.toggle('on'); return;
  }
  box.innerHTML = `<div class="mu">${esc(t('loading'))}</div>`;
  try {
    const rows = await api('inst:content', { id: i.id, kind: S.tab });
    if (!$('#tabc')) return;
    $('#tabc').innerHTML = `<div class="row" style="margin-bottom:12px"><button class="btn sm p" data-addc>${ic('plus')}${esc(t('install'))}</button><span class="mu sm">${rows.length}</span></div>` +
      (rows.length ? rows.map(r => `<div class="card item ${r.enabled ? '' : 'off'}" style="padding:10px 14px">${r.icon ? `<img class="ico" src="${esc(r.icon)}" alt="">` : `<div class="ico"></div>`}<div class="grow"><b>${esc(r.title)}</b><div class="mu sm">${esc(r.version || r.file)}</div></div>
      ${r.pid ? `<button class="btn sm" data-ver="${esc(r.file)}" title="${esc(t('pickVer'))}">${ic('tag')}${esc(t('pickVer'))}</button>` : ''}<button class="sw ${r.enabled ? 'on' : ''}" data-tg="${esc(r.file)}"></button><button class="btn ic bad" data-rm="${esc(r.file)}">${ic('trash')}</button></div>`).join('') : `<div class="card empty">${esc(t('empty'))}</div>`);
  } catch (e) { $('#tabc').innerHTML = `<div class="card empty">${esc(e.message)}</div>`; }
}

/* ---------- Каталог ---------- */
function viewDiscover() {
  const c = S.catalog, tg = S.target && inst(S.target);
  if (tg && !c.version) { c.version = tg.mc; c.loader = tg.loader === 'vanilla' ? '' : tg.loader; }
  const types = [['mod', t('mods')], ['modpack', t('modpacks')], ['resourcepack', t('packs')], ['shader', t('shaders')]];
  V(`<div class="top"><h1>${esc(t('discover'))}</h1>${tg ? `<button class="btn sm" data-untarget>${esc(t('install'))}: <b>${esc(tg.name)}</b> ${ic('x')}</button>` : ''}</div>
  <div class="search">${ic('search')}<input id="q" type="search" placeholder="${esc(t('search'))}" value="${esc(c.q)}"><select id="cl"><option value="">${esc(t('loader'))}: ${esc(t('any'))}</option>${LOADERS.slice(1).map(l => `<option value="${l}" ${c.loader === l ? 'selected' : ''}>${LN[l]}</option>`).join('')}</select>
  <input id="cv" placeholder="1.21.1" size="7" value="${esc(c.version)}" style="width:96px"></div>
  <div class="row" style="margin-top:12px;gap:10px;flex-wrap:wrap"><span class="mu sm">${esc(t('srcLabel'))}</span><div class="pill">${[['modrinth', 'Modrinth'], ['curseforge', 'CurseForge']].map(([k, n]) => `<button data-src="${k}" class="${(c.src || 'modrinth') === k ? 'on' : ''}">${n}</button>`).join('')}</div>${c.src === 'curseforge' ? `<span class="mu sm">${esc(t('cfNote'))}</span>` : ''}</div>
  <div class="pill" style="margin:14px 0">${types.filter(([k]) => !(c.src === 'curseforge' && k === 'modpack')).map(([k, n]) => `<button data-ctype="${k}" class="${c.type === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div><div id="res" style="display:grid;gap:10px"></div>`);
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
  <button class="btn p sm" data-getp="${esc(h.id)}" data-ptype="${esc(h.type)}" data-psrc="${esc(h.src || 'modrinth')}">${ic('download')}${esc(t('install'))}</button></div>`).join('') || `<div class="card empty">${esc(t('empty'))}</div>`;
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
    if (type === 'modpack') { const i = await api('inst:installModpack', { project: id }); await refresh(); toast(t('done') + ': ' + i.name, 'ok'); return go('inst', i.id); }
    S.pendingKind = type || S.catalog.type || 'mod';
    const tg = S.target && inst(S.target);
    if (!tg) return pickInstanceModal(id);
    return versionChoice(tg.id, id);
  });
}
// Deep link salauncher://install: подтверждение -> выбор сборки -> выбор версии (с предвыбранной запрошенной)
async function deepLink(l) {
  if (!l) return; S.pendingVer = l.version || ''; S.pendingSrc = l.src; S.pendingKind = l.type;
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
    if (l.type === 'modpack') { closeModal(); const i = await api('inst:installModpack', { project: l.project }); await refresh(); toast(t('done') + ': ' + i.name, 'ok'); return go('inst', i.id); }
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
function viewSettings() {
  const s = S.settings;
  V(`<div class="top"><h1>${esc(t('settings'))}</h1><button class="btn" data-site>${ic('globe')}${esc(t('openSite'))}</button></div>
  <h2 style="margin-top:6px">${esc(t('appearance'))}</h2><div class="card">
   <label class="lab" style="margin-top:0">${esc(t('theme'))}</label><div class="themes">${THEMES.map(([k, bg, c]) => `<button class="th ${s.theme === k ? 'on' : ''}" data-th="${k}"><div class="pv" style="background:${bg};--c:${k === 'custom' ? '#fff' : s.accent}"></div>${esc(t({ dark: 'dark', light: 'light', amoled: 'amoled', glass: 'glass', glasslight: 'glass', cold: 'snow', warm: 'sun', autumn: 'leaves', spring: 'rain', custom: 'custom' }[k]))}${k === 'glasslight' ? ' ☀' : ''}</button>`).join('')}</div>
   <label class="lab">${esc(t('accent'))}</label><div class="row wrap">${ACCENTS.map(c => `<button class="swatch ${s.accent === c ? 'on' : ''}" data-acc-c="${c}" style="background:${c}"></button>`).join('')}<label class="swatch cust ${ACCENTS.includes(s.accent) ? '' : 'on'}" title="${esc(t('custom'))}" style="background:${ACCENTS.includes(s.accent) ? 'conic-gradient(#f87171,#facc15,#4ade80,#22d3ee,#4f8cff,#a78bfa,#f87171)' : esc(s.accent)}"><input type="color" id="accc" value="${esc(s.accent)}" style="opacity:0;width:100%;height:100%;cursor:pointer"></label></div>
   ${s.theme === 'custom' ? `<div class="row gap wrap" style="margin-top:6px"><div><label class="lab">${esc(t('bg'))}</label><input type="color" id="cbg" value="${esc(s.customBg)}"></div><div><label class="lab">${esc(t('card'))}</label><input type="color" id="ccd" value="${esc(s.customCard)}"></div></div>` : ''}</div>
  <h2>${esc(t('language'))}</h2><div class="langs">${LANG_LIST.map(([c, n]) => `<button class="${s.lang === c ? 'on' : ''}" data-lang="${c}">${esc(n)}</button>`).join('')}</div>
  <h2>${esc(t('secGame'))}</h2><div class="card">
   <label class="lab" style="margin-top:0">${esc(t('memory'))}: <b id="gm">${s.memory}</b></label><input type="range" id="gmr" min="1024" max="16384" step="512" value="${s.memory}">
   <label class="lab">${esc(t('jvmArgs'))}</label><input id="gj" style="width:100%" value="${esc(s.jvmArgs || '')}"><label class="lab">Java</label><input id="gjp" style="width:100%" placeholder="auto" value="${esc(s.javaPath || '')}">
   <label class="lab">${esc(t('defWindow'))}</label><div class="row gap wrap"><input id="gw" type="number" min="320" placeholder="${esc(t('width'))}" value="${esc(s.width || '')}" style="width:120px"><span class="mu">×</span><input id="gh" type="number" min="240" placeholder="${esc(t('height'))}" value="${esc(s.height || '')}" style="width:120px"><label class="row sm mu"><button class="sw ${s.fullscreen ? 'on' : ''}" data-tgf="fullscreen"></button>${esc(t('fullscreen'))}</label></div>
   <div style="margin-top:10px"><div class="setrow"><div class="grow">${esc(t('autoMem'))}<small>${esc(t('autoMemD'))}</small></div><button class="sw ${s.autoMem ? 'on' : ''}" data-tgf="autoMem"></button></div><div class="setrow"><div class="grow">${esc(t('aikar'))}<small>${esc(t('aikarD'))}</small></div><button class="sw ${s.aikar ? 'on' : ''}" data-tgf="aikar"></button></div><div class="setrow"><div class="grow">${esc(t('minimize'))}</div><button class="sw ${s.minimizeOnLaunch ? 'on' : ''}" data-tgf="minimizeOnLaunch"></button></div><div class="setrow"><div class="grow">${esc(t('reopen'))}</div><button class="sw ${s.reopen ? 'on' : ''}" data-tgf="reopen"></button></div><div class="setrow"><div class="grow">${esc(t('openLogs'))}</div><button class="sw ${s.openLogs ? 'on' : ''}" data-tgf="openLogs"></button></div><div class="setrow"><div class="grow">${esc(t('notify'))}</div><button class="sw ${s.notify !== false ? 'on' : ''}" data-tgl="notify"></button></div><div class="setrow"><div class="grow">${esc(t('autoFix'))}</div><button class="sw ${s.autoFix !== false ? 'on' : ''}" data-tgl="autoFix"></button></div><div class="setrow"><div class="grow">${esc(t('discord'))}</div><button class="sw ${s.discord !== false ? 'on' : ''}" data-tgl="discord"></button></div></div>
   <label class="lab">${esc(t('discordId'))}</label><input id="gdi" style="width:100%" placeholder="1234567890123456789" value="${esc(s.discordClientId || '')}"></div>
  <h2>${esc(t('secUi'))}</h2><div class="card">
   <div class="setrow"><div class="grow">${esc(t('uiScale'))}</div><input type="range" id="gus" min="80" max="130" step="5" value="${s.uiScale || 100}"><b id="gusv" style="width:48px;text-align:right">${s.uiScale || 100}%</b></div>
   <div class="setrow"><div class="grow">${esc(t('blur'))}</div><input type="range" id="gbl" min="0" max="60" step="2" value="${s.blur == null ? 30 : s.blur}"></div>
   <div class="setrow"><div class="grow">${esc(t('anims'))}</div><button class="sw ${s.anims !== false ? 'on' : ''}" data-tgl="anims"></button></div>
   <div class="setrow"><div class="grow">${esc(t('sortLib'))}</div><select id="gsort">${[['recent', t('sRecent')], ['name', t('sName')], ['playtime', t('sPlay')]].map(([k, n]) => `<option value="${k}" ${(s.sort || 'recent') === k ? 'selected' : ''}>${esc(n)}</option>`).join('')}</select></div>
   <div class="setrow"><div class="grow">${esc(t('defLoader'))}</div><select id="gdl">${LOADERS.map(l => `<option value="${l}" ${(s.defLoader || 'fabric') === l ? 'selected' : ''}>${LN[l]}</option>`).join('')}</select></div>
   <div class="setrow"><div class="grow">${esc(t('defSnaps'))}</div><button class="sw ${s.defSnaps ? 'on' : ''}" data-tgf="defSnaps"></button></div></div>
  <h2>${esc(t('secSys'))}</h2><div class="card">
   <div class="setrow"><div class="grow">${esc(t('startup'))}</div><button class="sw ${s.startup ? 'on' : ''}" data-tgf="startup"></button></div>
   <div class="setrow"><div class="grow">${esc(t('checkUpd'))}</div><button class="sw ${s.checkUpdates !== false ? 'on' : ''}" data-tgl="checkUpdates"></button></div>
   <div class="foot" style="margin-top:10px"><button class="btn" data-opendata>${ic('folder')}${esc(t('openData'))}</button><button class="btn" data-clrcache>${ic('trash')}${esc(t('clearCache'))}</button><button class="btn bad" data-resets>${ic('refresh')}${esc(t('resetS'))}</button></div></div>
  <h2>${esc(t('launcher'))}</h2><div class="card"><div class="row"><div class="grow"><b>SA Launcher ${esc(S.version || '')}</b><div class="mu sm" id="lstat">${esc(S.lupd ? (S.lupd.available ? t('newVer') + ': ' + S.lupd.latest : t('upToDate')) : '')}</div></div><button class="btn p" data-launcher-upd>${ic('refresh')}${esc(t('updLauncher'))}</button></div></div>
  <h2>${esc(t('accounts'))}</h2><div id="accs" class="card">${accountsHTML()}</div>`);
  $('#gdi').onchange = e => setS({ discordClientId: e.target.value.trim() });
  $('#gmr').oninput = e => { $('#gm').textContent = e.target.value; }; $('#gmr').onchange = e => setS({ memory: +e.target.value });
  $('#gw').onchange = e => setS({ width: e.target.value.trim() }); $('#gh').onchange = e => setS({ height: e.target.value.trim() });
  $('#gus').oninput = e => { $('#gusv').textContent = e.target.value + '%'; }; $('#gus').onchange = e => setS({ uiScale: +e.target.value });
  $('#gbl').oninput = e => setS({ blur: +e.target.value }); $('#gsort').onchange = e => setS({ sort: e.target.value }); $('#gdl').onchange = e => setS({ defLoader: e.target.value });
  $('#gj').onchange = e => setS({ jvmArgs: e.target.value }); $('#gjp').onchange = e => setS({ javaPath: e.target.value.trim() });
  $('#accc').oninput = e => { setS({ accent: e.target.value }); const c = e.target.closest('.cust'); c.style.background = e.target.value; document.querySelectorAll('.swatch.on').forEach(x => x.classList.remove('on')); c.classList.add('on'); renderRail(); };
  if ($('#cbg')) { $('#cbg').oninput = e => setS({ customBg: e.target.value }); $('#ccd').oninput = e => setS({ customCard: e.target.value }); }
}
function accountsHTML() {
  return (S.accounts.length ? S.accounts.map(a => `<div class="row" style="padding:6px 0">${head(a)}<div class="grow"><b>${esc(a.name)}</b><div class="mu sm">${esc(t('ms'))}</div></div>
  ${a.id === S.settings.selected ? `<span class="tag">✓</span>` : `<button class="btn sm" data-selacc="${esc(a.id)}">${esc(t('play'))}</button>`}<button class="btn ic sm bad" data-rmacc="${esc(a.id)}">${ic('x')}</button></div>`).join('') : `<div class="mu" style="padding:6px 0">${esc(t('noAcc'))}</div>`)
    + `<div class="foot" style="justify-content:flex-start"><button class="btn p" data-login>${ic('user')}${esc(S.accounts.length ? t('addAcc') : t('signIn'))}</button></div><div class="mu sm">${esc(t('ms'))}</div>`;
}

/* ---------- модальные окна ---------- */
function modal(html) { const m = $('#modal'); m.classList.remove('hide'); m.innerHTML = `<div class="modal-box">${html}</div>`; m.onclick = e => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); }; }
const closeModal = () => { $('#modal').classList.add('hide'); $('#modal').innerHTML = ''; $('#modal').onclick = null; };

function accountsModal() {
  modal(`<h2>${esc(t('accounts'))}</h2><div id="accm">${accountsHTML()}</div><div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button></div>`);
}
async function doLogin(btn) {
  if (btn) { btn.disabled = true; btn.innerHTML = esc(t('waiting')); }
  const fin = () => { if (!$('#modal').classList.contains('hide')) closeModal(); renderRail(); renderView(); };
  try { const r = await api('auth:login'); S.accounts = r.accounts; S.settings.selected = r.selected; toast(t('done'), 'ok'); fin(); }
  catch (e) { if (e.message.includes('cancel')) return; fail(e); if (btn) { btn.disabled = false; } renderView(); }
}

async function newInstanceModal() {
  if (!S.mcv) { try { S.mcv = await api('mc:versions'); } catch (e) { return fail(e); } }
  const st = { name: '', mc: '', loader: S.settings.defLoader || 'fabric', snaps: !!S.settings.defSnaps, lv: [], ok: true };
  const list = () => S.mcv.filter(v => st.snaps || v.type === 'release');
  st.mc = list()[0].id;
  const draw = () => {
    modal(`<h2>${esc(t('newInst'))}</h2><label class="lab" style="margin-top:0">${esc(t('name'))}</label><input id="nn" style="width:100%" value="${esc(st.name)}" placeholder="My world">
    <label class="lab">${esc(t('mcVersion'))}</label><div class="row"><select id="nv" class="grow">${list().map(v => `<option ${v.id === st.mc ? 'selected' : ''}>${esc(v.id)}</option>`).join('')}</select><label class="row sm mu"><button class="sw ${st.snaps ? 'on' : ''}" id="ns"></button>${esc(t('snapshots'))}</label></div>
    <label class="lab">${esc(t('loader'))}</label><div class="seg">${LOADERS.map(l => `<button data-l="${l}" class="${st.loader === l ? 'on' : ''}">${LN[l]}</button>`).join('')}</div>
    <div class="mu sm" id="ls" style="margin-top:8px;min-height:18px"></div>
    <div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn p" id="nc" ${st.ok ? '' : 'disabled'}>${ic('plus')}${esc(t('create'))}</button></div>`);
    $('#nn').oninput = e => st.name = e.target.value; $('#nv').onchange = e => { st.mc = e.target.value; check(); };
    $('#ns').onclick = () => { st.snaps = !st.snaps; if (!list().some(v => v.id === st.mc)) st.mc = list()[0].id; draw(); };
    $$('[data-l]').forEach(b => b.onclick = () => { st.loader = b.dataset.l; draw(); });
    $('#nc').onclick = async () => { const name = st.name.trim() || `${LN[st.loader]} ${st.mc}`; closeModal(); await run(async () => { const i = await api('inst:create', { name, mc: st.mc, loader: st.loader }); await refresh(); go('inst', i.id); }); };
    check();
  };
  const check = async () => {
    const ls = $('#ls'), nc = $('#nc'); if (!ls) return;
    if (st.loader === 'vanilla') { st.ok = true; ls.textContent = ''; nc.disabled = false; return; }
    ls.textContent = t('loading'); nc.disabled = true;
    const key = st.loader + st.mc; let v = []; try { v = await api('loader:versions', { loader: st.loader, mc: st.mc }); } catch (_) {}
    if (key !== st.loader + st.mc || !$('#ls')) return;
    st.ok = v.length > 0; $('#ls').textContent = st.ok ? `${LN[st.loader]} ${v[0]}` : t('noLoader'); $('#nc').disabled = !st.ok;
  };
  draw();
}

async function updateModal() {
  const i = inst(S.instId); if (!i) return;
  modal(`<h2>${esc(t('updT'))} — ${esc(i.name)}</h2><div class="mu">${esc(t('loading'))}</div>`);
  let r; try { r = await api('inst:checkUpdate', i.id); } catch (e) { closeModal(); return fail(e); }
  const upc = r.candidates.filter(c => c.dir !== 'down');
  let sel = (upc.find(c => c.loaderOk && c.ok === c.total) || upc.find(c => c.loaderOk) || r.candidates.find(c => c.loaderOk) || {}).mc;
  const draw = () => {
    const c = r.candidates.find(x => x.mc === sel);
    const row = x => { const pct = x.total ? Math.round(x.ok / x.total * 100) : 100; return `<button class="opt ${x.mc === sel ? 'on' : ''}" data-sel="${esc(x.mc)}" ${x.loaderOk ? '' : 'disabled style="opacity:.45"'}><div style="min-width:64px"><b>${esc(x.mc)}</b></div><div class="bar"><i class="${pct < 100 ? 'part' : ''}" style="width:${x.loaderOk ? pct : 0}%"></i></div><span class="mu sm" style="min-width:110px;text-align:right">${x.loaderOk ? `${x.ok} ${esc(t('of'))} ${x.total} ${esc(t('compat'))}` : esc(t('noLoader'))}</span></button>`; };
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
  await run(async () => {
    const r = await api('launcher:check'); S.lupd = r;
    if (st) st.textContent = r.available ? t('newVer') + ': ' + r.latest : t('upToDate');
    if (!r.available) return toast(t('upToDate'), 'ok');
    modal(`<h2>${ic('refresh')} ${esc(t('newVer'))}</h2><p class="mu">${esc(r.current)} → <b>${esc(r.latest)}</b></p><div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button><button class="btn p" id="lgo">${ic('download')}${esc(t('updLauncher'))}</button></div>`);
    $('#lgo').onclick = async () => { $('#lgo').disabled = true; $('#lgo').textContent = t('loading'); await run(async () => { await api('launcher:update'); closeModal(); }); };
  });
}

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
  if ((b = q('[data-go]'))) return go(b.dataset.go);
  if ((b = q('[data-build]'))) return buildModal(b.dataset.build);
  if ((b = q('[data-opensa]'))) { closeModal(); S.tab = 'mods'; return go('inst', b.dataset.opensa); }
  if (q('[data-site]')) return api('shell:site');
  if (q('[data-acc]')) return accountsModal();
  if ((b = q('[data-ext]'))) return api('shell:open', b.dataset.ext);
  if (q('[data-new]')) return newInstanceModal();
  if (q('[data-import]')) return run(async () => { const i = await api('inst:importFile'); if (i) { await refresh(); go('inst', i.id); } });
  if ((b = q('[data-play]'))) { e.stopPropagation(); const id = b.dataset.play, i = inst(id); if (i && i.running) return api('inst:stop', id); if (!cur()) return accountsModal(); return run(async () => { if (S.view !== 'inst') {} await api('inst:play', id); }); }
  if ((b = q('[data-qw]'))) return run(async () => { if (!cur()) return accountsModal(); await api('inst:play', { id: b.dataset.qw, quick: { world: b.dataset.q } }); });
  if ((b = q('[data-qs]'))) return run(async () => { if (!cur()) return accountsModal(); await api('inst:play', { id: b.dataset.qs, quick: { server: b.dataset.q } }); });
  if ((b = q('[data-inst]'))) { S.tab = 'mods'; return go('inst', b.dataset.inst); }
  if ((b = q('[data-tab]'))) { S.tab = b.dataset.tab; $$('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); return renderTab(); }
  if (q('[data-upd]')) return updateModal(); if (q('[data-opt]')) return optimizeModal();
  if (q('[data-folder]')) return api('inst:folder', { id: S.instId });
  if (q('[data-addc]')) { S.target = S.instId; S.catalog.type = S.tab === 'mods' ? 'mod' : S.tab; S.catalog.version = ''; S.catalog.res = null; return go('discover'); }
  if (q('[data-untarget]')) { S.target = null; S.catalog.version = ''; S.catalog.loader = ''; S.catalog.res = null; return renderView(); }
  if ((b = q('[data-tg]'))) return run(async () => { await api('inst:toggle', { id: S.instId, kind: S.tab, file: b.dataset.tg }); renderTab(); });
  if ((b = q('[data-rm]'))) return run(async () => { await api('inst:removeFile', { id: S.instId, kind: S.tab, file: b.dataset.rm }); renderTab(); });
  if (q('[data-savei]')) return run(async () => { await api('inst:update', { id: S.instId, patch: { name: $('#sn').value.trim() || inst(S.instId).name, memory: +$('#sm').value, jvmArgs: $('#sj').value.trim(), javaPath: $('#sjp').value.trim(), width: $('#sw').value.trim(), height: $('#sh').value.trim(), fullscreen: $('#sfs').classList.contains('on') } }); await refresh(); toast(t('done'), 'ok'); renderView(); });
  if (q('[data-seticon]')) return run(async () => { if (await api('inst:setIcon', S.instId)) { await refresh(); S.tab = 'settings'; viewInst(); } });
  if (q('[data-clricon]')) return run(async () => { await api('inst:clearIcon', S.instId); await refresh(); S.tab = 'settings'; viewInst(); });
  if (q('[data-dup]')) return run(async () => { const i = await api('inst:duplicate', S.instId); await refresh(); go('inst', i.id); });
  if (q('[data-del]')) { if (confirm(t('confirmDel'))) return run(async () => { await api('inst:delete', S.instId); await refresh(); go('library'); }); return; }
  if ((b = q('[data-ctype]'))) { S.catalog.type = b.dataset.ctype; S.catalog.res = null; S.catalog.page = 0; return viewDiscover(); }
  if (q('[data-retry]')) return search(true);
  if ((b = q('[data-pg]'))) { S.catalog.page = Math.max(0, S.catalog.page + +b.dataset.pg); search(true); return void ($('#view').scrollTop = 0); }
  if ((b = q('[data-getp]'))) { e.stopPropagation(); const id = b.dataset.getp, ty = b.dataset.ptype; if ($('#modal') && !$('#modal').classList.contains('hide')) closeModal(); return installProject(id, ty, b.dataset.psrc); }
  if ((b = q('[data-src]'))) { S.catalog.src = b.dataset.src; S.catalog.res = null; S.catalog.page = 0; if (b.dataset.src === 'curseforge' && S.catalog.type === 'modpack') S.catalog.type = 'mod'; return viewDiscover(); }
  if ((b = q('[data-proj]'))) { if ((S.catalog.src || 'modrinth') === 'curseforge' && S.view === 'discover') { const h = (S.catalog.res || []).find(x => String(x.id) === b.dataset.proj); return h && h.url ? api('shell:open', h.url) : null; } return projectModal(b.dataset.proj); }
  if ((b = q('[data-ver]'))) return versionModal(b.dataset.ver);
  if (q('[data-launcher-upd]')) return updateLauncher();
  if ((b = q('[data-fixplay]'))) { closeModal(); return run(async () => { await api('inst:play', b.dataset.fixplay); }); }
  if ((b = q('[data-tgf]'))) { const k = b.dataset.tgf, v = !S.settings[k]; b.classList.toggle('on', v); return setS({ [k]: v }); }
  if (q('[data-clrcache]')) return run(async () => { const n = await api('app:clearCache'); toast(t('cleared') + ' · ' + (n / 1048576).toFixed(0) + ' MB ' + t('freed'), 'ok'); });
  if (q('[data-opendata]')) return api('app:openData');
  if (q('[data-resets]')) { if (confirm(t('resetS') + '?')) return run(async () => { Object.assign(S.settings, await api('settings:reset')); applyTheme(); renderRail(); viewSettings(); }); return; }
  if ((b = q('[data-tgl]'))) { const k = b.dataset.tgl; const v = !(S.settings[k] !== false); b.classList.toggle('on', !v); return setS({ [k]: !v }); }
  if ((b = q('[data-th]'))) { setS({ theme: b.dataset.th }); return viewSettings(); }
  if ((b = q('[data-acc-c]'))) { setS({ accent: b.dataset.accC }); renderRail(); return viewSettings(); }
  if ((b = q('[data-lang]'))) { setS({ lang: b.dataset.lang }); renderRail(); return renderView(); }
  if (q('[data-login]')) return doLogin(q('[data-login]'));
  if ((b = q('[data-selacc]'))) { await api('auth:select', b.dataset.selacc); S.settings.selected = b.dataset.selacc; renderRail(); return refreshAcc(); }
  if ((b = q('[data-rmacc]'))) return run(async () => { const r = await api('auth:remove', b.dataset.rmacc); S.accounts = r.accounts; S.settings.selected = r.selected; renderRail(); refreshAcc(); });
});
function refreshAcc() { if ($('#accm')) $('#accm').innerHTML = accountsHTML(); if ($('#accs')) $('#accs').innerHTML = accountsHTML(); }

addEventListener('error', e => { if (e.target && e.target.tagName === 'IMG') e.target.style.visibility = 'hidden'; }, true);

/* ---------- старт ---------- */
(async function init() {
  const info = await api('app:init'); Object.assign(S, { accounts: info.accounts, site: info.site, version: info.version });
  Object.assign(S.settings, info.settings);
  if (!S.settings.lang) { const l = (info.locale || 'en').toLowerCase().slice(0, 2); S.settings.lang = LANGS[l] ? l : 'en'; api('settings:set', { lang: S.settings.lang }).catch(() => {}); }
  applyTheme(); await refresh(); renderRail(); renderView(); loadRecent();
  api('app:pendingLink').then(l => { if (l) deepLink(l); }).catch(() => {});
  if (S.settings.checkUpdates !== false) api('launcher:check').then(r => { S.lupd = r; if (r.available) toast(t('newVer') + ': ' + r.latest, 'ok'); }).catch(() => {});
  sa.on((ch, d) => {
    if (ch === 'progress') { if (d.done) delete S.tasks[d.task]; else { const o = S.tasks[d.task]; S.tasks[d.task] = { ...d, t0: o ? o.t0 : Date.now() }; if (!o) setTimeout(renderDock, 380); } renderDock(); }
    else if (ch === 'log') { const a = S.logs[d.id] || (S.logs[d.id] = []); a.push(d.line); if (a.length > 600) a.splice(0, 100); if (S.view === 'inst' && S.tab === 'logs' && S.instId === d.id) { const b = $('#logbox'); if (b) { b.textContent += (b.textContent ? '\n' : '') + d.line; b.scrollTop = b.scrollHeight; } } }
    else if (ch === 'state') { const i = inst(d.id); if (i) i.running = d.running; if (d.running && S.settings.openLogs) { S.tab = 'logs'; S.instId = d.id; S.view = 'inst'; renderRail(); } if (S.view === 'library' || S.view === 'home') renderView(); if (S.view === 'inst' && S.instId === d.id) viewInst(); if (!d.running) loadRecent(); if (!d.running && d.code && d.code !== 0) toast(`${t('error')}: exit ${d.code}`, 'err'); }
    else if (ch === 'crash') { if (d.problems.length || true) crashModal(d); }
    else if (ch === 'error') toast(d.message, 'err');
    else if (ch === 'deeplink') deepLink(d);
  });
})().catch(e => { document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f87171;position:fixed;inset:60px 20px;z-index:99">${esc(e.stack || e)}</pre>`); });
