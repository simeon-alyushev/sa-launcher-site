'use strict';
/* SA Launcher — интерфейс. Работает через window.sa (preload). */
const $ = (s, e = document) => e.querySelector(s);
const $$ = (s, e = document) => [...e.querySelectorAll(s)];
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const P = {
  home: '<path d="M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10"/>', library: '<rect x="3" y="3" width="7" height="7" rx="2.5"/><rect x="14" y="3" width="7" height="7" rx="2.5"/><rect x="3" y="14" width="7" height="7" rx="2.5"/><rect x="14" y="14" width="7" height="7" rx="2.5"/>',
  compass: '<circle cx="12" cy="12" r="9"/><path d="M15.5 8.5l-2 5-5 2 2-5z"/>', gear: '<circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor"/>', stop: '<rect x="6" y="6" width="12" height="12" rx="3" fill="currentColor"/>', plus: '<path d="M12 5v14M5 12h14"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', folder: '<path d="M3 7a2 2 0 012-2h4l2 2h8a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"/>',
  download: '<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>', refresh: '<path d="M20 11a8 8 0 10-2.3 5.7M20 4v7h-7"/>', bolt: '<path d="M13 2L4 14h7l-1 8 9-12h-7z"/>', check: '<path d="M5 12l5 5 9-10"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>', back: '<path d="M15 5l-7 7 7 7"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="3"/><path d="M16 8V6a2 2 0 00-2-2H6a2 2 0 00-2 2v8a2 2 0 002 2h2"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0116 0"/>', globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18"/>', import: '<path d="M12 3v12M7 10l5 5 5-5M4 21h16"/>'
};
const ic = n => `<svg class="i" viewBox="0 0 24 24">${P[n]}</svg>`;

const S = { settings: { lang: 'en', theme: 'dark', accent: '#4ade80' }, accounts: [], instances: [], view: 'home', instId: null, tab: 'mods', target: null, logs: {}, tasks: {}, site: '', catalog: { type: 'mod', q: '', loader: '', version: '', res: null, busy: false }, popular: null, mcv: null };
const t = k => ((LANGS[S.settings.lang] || LANGS.en).t[k]) || LANGS.en.t[k] || k;
const api = (n, a) => sa.call(n, a);
const LOADERS = ['vanilla', 'fabric', 'quilt', 'forge', 'neoforge'];
const LN = { vanilla: 'Vanilla', fabric: 'Fabric', quilt: 'Quilt', forge: 'Forge', neoforge: 'NeoForge' };
const ACCENTS = ['#4ade80', '#22d3ee', '#60a5fa', '#a78bfa', '#f472b6', '#fb7185', '#fb923c', '#facc15'];
const THEMES = [['dark', '#0f1115', '#4ade80'], ['light', '#eef1f6', '#4ade80'], ['amoled', '#000', '#4ade80'], ['glass', 'linear-gradient(135deg,#7c5cff,#22b8ff 60%,#4ade80)', '#fff'], ['glasslight', 'linear-gradient(135deg,#ffd6e8,#cfe3ff 60%,#d9ffe8)', '#fff'], ['cold', 'linear-gradient(135deg,#0a1626,#7cc4ff)', '#fff'], ['warm', 'linear-gradient(135deg,#fff3dc,#ffb347)', '#fff'], ['autumn', 'linear-gradient(135deg,#1d120b,#e8742c)', '#fff'], ['spring', 'linear-gradient(135deg,#0b1a1c,#5ec8d8)', '#fff'], ['custom', 'conic-gradient(#f472b6,#facc15,#4ade80,#22d3ee,#a78bfa,#f472b6)', '#fff']];

/* ---------- утилиты ---------- */
function lum(hex) { const n = parseInt(hex.slice(1), 16), c = [n >> 16, (n >> 8) & 255, n & 255].map(v => { v /= 255; return v <= .03928 ? v / 12.92 : ((v + .055) / 1.055) ** 2.4; }); return .2126 * c[0] + .7152 * c[1] + .0722 * c[2]; }
function h2x(h) { const s = .85, l = .58, a = s * Math.min(l, 1 - l), f = n => { const k = (n + h / 30) % 12; return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1)))).toString(16).padStart(2, '0'); }; return '#' + f(0) + f(8) + f(4); }
function x2h(hex) { const n = parseInt(hex.slice(1), 16), r = (n >> 16) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255, mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); if (!d) return 0; const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return Math.round((h * 60 + 360) % 360); }
const hue = s => { let h = 0; for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0; return h % 360; };
const tile = (i, cls = '') => `<div class="tile ${cls}" style="background:linear-gradient(135deg,hsl(${hue(i.id)} 70% 56%),hsl(${(hue(i.id) + 45) % 360} 70% 42%))">${esc([...(i.name || '?')][0].toUpperCase())}</div>`;
const fmt = n => n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? (n / 1e3).toFixed(1) + 'K' : String(n || 0);
const head = a => {
  if (!a) return `<span class="hd">?</span>`;
  const l = esc([...(a.name || '?')][0].toUpperCase());
  const body = a.p === 'ms' ? `<img src="https://crafatar.com/avatars/${esc(a.id)}?size=64&overlay" alt="">` : `<span class="sk" style="--sk:url(&quot;https://skinsystem.ely.by/skins/${encodeURIComponent(a.name)}.png&quot;)"></span>`;
  return `<span class="hd">${l}${body}</span>`;
};
const cur = () => S.accounts.find(a => a.id === S.settings.selected) || S.accounts[0];
const inst = id => S.instances.find(i => i.id === id);
const fmtTime = s => s >= 3600 ? Math.floor(s / 3600) + ' h ' + Math.floor(s % 3600 / 60) + ' m' : Math.floor(s / 60) + ' m';

function toast(msg, kind = '') { const e = document.createElement('div'); e.className = 'toast ' + kind; e.textContent = msg; $('#toasts').append(e); setTimeout(() => e.remove(), kind === 'err' ? 6000 : 3000); }
const fail = e => { const m = String(e.message || e); if (m === 'noaccount' || m === 'relogin') { toast(t('noAcc'), 'err'); return accountsModal(); } toast(m.replace(/^Error invoking remote method '[^']+': (Error: )?/, ''), 'err'); };
async function run(fn) { try { return await fn(); } catch (e) { fail(e); } }

/* ---------- тема ---------- */
function applyTheme() {
  const s = S.settings, r = document.documentElement;
  r.dataset.theme = s.theme; r.lang = s.lang;
  if (typeof SAFx !== 'undefined') SAFx.set(s.theme);
  r.style.setProperty('--ac', s.accent); r.style.setProperty('--acx', lum(s.accent) > .5 ? '#08130c' : '#ffffff');
  const custom = s.theme === 'custom';
  if (custom) {
    const dark = lum(s.customBg) < .4; r.dataset.mode = dark ? 'dark' : 'light';
    r.style.setProperty('--bg', s.customBg); r.style.setProperty('--card', s.customCard); r.style.setProperty('--card2', `color-mix(in srgb,${s.customCard},${dark ? '#fff' : '#000'} 8%)`);
    r.style.setProperty('--tx', dark ? '#f2f4f8' : '#14171d'); r.style.setProperty('--mu', dark ? '#9aa3b2' : '#667085');
  } else { delete r.dataset.mode; ['--bg', '--card', '--card2', '--tx', '--mu'].forEach(p => r.style.removeProperty(p)); }
}
const setS = patch => { Object.assign(S.settings, patch); applyTheme(); api('settings:set', patch).catch(() => {}); };

/* ---------- каркас ---------- */
function renderRail() {
  const a = cur(), nav = (v, i, tt) => `<button class="nav ${S.view === v || (v === 'library' && S.view === 'inst') ? 'on' : ''}" data-go="${v}" title="${esc(tt)}">${ic(i)}</button>`;
  $('#rail').innerHTML = `<div class="rail-in"><img class="logo" src="logo.png" alt="SA" data-site>${nav('home', 'home', t('home'))}${nav('library', 'library', t('library'))}${nav('discover', 'compass', t('discover'))}<div class="sp"></div>
  <button class="nav" data-acc title="${esc(t('accounts'))}">${a ? head(a) : ic('user')}</button>${nav('settings', 'gear', t('settings'))}</div>`;
}
function go(view, id) {
  S.view = view; if (id !== undefined) S.instId = id;
  renderRail(); renderView(); $('#view').scrollTop = 0;
}
function renderView() {
  const v = S.view;
  if (v === 'home') return viewHome(); if (v === 'library') return viewLibrary(); if (v === 'inst') return viewInst();
  if (v === 'discover') return viewDiscover(); if (v === 'settings') return viewSettings();
}
const V = html => { $('#view').innerHTML = html; };

/* ---------- Главная ---------- */
function viewHome() {
  const a = cur(), recent = S.instances.slice(0, 4);
  V(`<div class="hero"><img src="logo.png" style="width:84px;height:84px;border-radius:28px" alt=""><div class="grow"><h1>SA Launcher</h1><div class="mu">${a ? esc(a.name) + ' · ' + (a.p === 'ely' ? 'Ely.by' : 'Microsoft') : esc(t('noAcc'))}</div></div>
   ${a ? '' : `<button class="btn p" data-acc>${ic('user')}${esc(t('signIn'))}</button>`}<button class="btn p" data-new>${ic('plus')}${esc(t('newInst'))}</button></div>
   <h2>${esc(t('recent'))}</h2>${recent.length ? `<div class="grid">${recent.map(instCard).join('')}</div>` : `<div class="card empty">${esc(t('emptyLib'))}</div>`}
   <h2>${esc(t('popular'))}</h2><div id="pop" class="grid" style="grid-template-columns:repeat(auto-fill,minmax(300px,1fr))">${S.popular ? S.popular.map(projCard).join('') : `<div class="mu">${esc(t('loading'))}</div>`}</div>`);
  if (!S.popular) api('cat:search', { type: 'mod' }).then(r => { S.popular = r.hits.slice(0, 6); if (S.view === 'home') $('#pop').innerHTML = S.popular.map(projCard).join(''); }).catch(() => { if ($('#pop')) $('#pop').innerHTML = ''; });
}
const projCard = (h, i) => `<div class="card item" style="padding:14px;border-radius:26px;cursor:pointer" data-proj="${esc(h.id)}"><img class="ico" src="${esc(h.icon || '')}" alt=""><div class="grow"><b>${esc(h.title)}</b><div class="ds">${esc(h.desc)}</div><span class="mu sm">⬇ ${fmt(h.downloads)} · ${esc(h.author || '')}</span></div></div>`;

/* ---------- Библиотека ---------- */
function instCard(i) {
  const run = i.running;
  return `<div class="card inst" data-inst="${esc(i.id)}">${tile(i)}<div><b style="font-size:16px">${esc(i.name)}</b><div class="mu sm">${esc(i.mc)} · ${LN[i.loader] || i.loader}</div></div>
  <button class="fab ${run ? 'run' : ''}" data-play="${esc(i.id)}" title="${esc(run ? t('stop') : t('play'))}">${ic(run ? 'stop' : 'play')}</button></div>`;
}
function viewLibrary() {
  V(`<div class="top"><h1>${esc(t('library'))}</h1><div class="row"><button class="btn" data-import>${ic('import')}${esc(t('importPack'))}</button><button class="btn p" data-new>${ic('plus')}${esc(t('newInst'))}</button></div></div>
  ${S.instances.length ? `<div class="grid">${S.instances.map(instCard).join('')}</div>` : `<div class="card empty">${esc(t('emptyLib'))}</div>`}`);
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
  <div class="pill" style="margin-bottom:18px;flex-wrap:wrap">${tabs.map(([k, n]) => `<button data-tab="${k}" class="${S.tab === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div><div id="tabc"></div>`);
  renderTab();
}
async function renderTab() {
  const i = inst(S.instId), box = $('#tabc'); if (!i || !box) return;
  if (S.tab === 'logs') { box.innerHTML = `<pre class="log" id="logbox">${esc((S.logs[i.id] || []).join('\n'))}</pre>`; const b = $('#logbox'); b.scrollTop = b.scrollHeight; return; }
  if (S.tab === 'settings') {
    box.innerHTML = `<div class="card"><label class="lab" style="margin-top:0">${esc(t('name'))}</label><input id="sn" value="${esc(i.name)}" style="width:100%">
    <label class="lab">${esc(t('memory'))}: <b id="mv">${i.memory || S.settings.memory}</b></label><input type="range" id="sm" min="1024" max="16384" step="512" value="${i.memory || S.settings.memory}">
    <label class="lab">${esc(t('jvmArgs'))}</label><textarea id="sj" rows="3" placeholder="${esc(S.settings.jvmArgs || '')}">${esc(i.jvmArgs || '')}</textarea>
    <div class="foot" style="justify-content:space-between"><div class="row"><button class="btn" data-dup>${ic('copy')}${esc(t('dup'))}</button><button class="btn bad" data-del>${ic('trash')}${esc(t('del'))}</button></div><button class="btn p" data-savei>${ic('check')}${esc(t('save'))}</button></div></div>`;
    $('#sm').oninput = e => $('#mv').textContent = e.target.value; return;
  }
  box.innerHTML = `<div class="mu">${esc(t('loading'))}</div>`;
  try {
    const rows = await api('inst:content', { id: i.id, kind: S.tab });
    if (!$('#tabc')) return;
    $('#tabc').innerHTML = `<div class="row" style="margin-bottom:12px"><button class="btn sm p" data-addc>${ic('plus')}${esc(t('install'))}</button><span class="mu sm">${rows.length}</span></div>` +
      (rows.length ? rows.map(r => `<div class="card item ${r.enabled ? '' : 'off'}" style="padding:10px 14px">${r.icon ? `<img class="ico" src="${esc(r.icon)}" alt="">` : `<div class="ico"></div>`}<div class="grow"><b>${esc(r.title)}</b><div class="mu sm">${esc(r.version || r.file)}</div></div>
      <button class="sw ${r.enabled ? 'on' : ''}" data-tg="${esc(r.file)}"></button><button class="btn ic bad" data-rm="${esc(r.file)}">${ic('trash')}</button></div>`).join('') : `<div class="card empty">${esc(t('empty'))}</div>`);
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
  <div class="pill" style="margin:14px 0">${types.map(([k, n]) => `<button data-ctype="${k}" class="${c.type === k ? 'on' : ''}">${esc(n)}</button>`).join('')}</div><div id="res" style="display:grid;gap:10px"></div>`);
  const q = $('#q'); let tm; q.oninput = () => { clearTimeout(tm); tm = setTimeout(() => { c.q = q.value; search(); }, 350); };
  $('#cl').onchange = e => { c.loader = e.target.value; search(); }; $('#cv').onchange = e => { c.version = e.target.value.trim(); search(); };
  if (c.res) drawRes(); else search();
}
async function search() {
  const c = S.catalog; $('#res').innerHTML = `<div class="mu">${esc(t('loading'))}</div>`;
  try { c.res = (await api('cat:search', { query: c.q, type: c.type, loader: c.loader, version: c.version })).hits; drawRes(); }
  catch (e) { if ($('#res')) $('#res').innerHTML = `<div class="card empty">${esc(e.message)} <button class="btn sm" data-retry>${ic('refresh')}</button></div>`; }
}
function drawRes() {
  const r = $('#res'); if (!r) return;
  r.innerHTML = (S.catalog.res || []).map(h => `<div class="card item" data-proj="${esc(h.id)}" style="cursor:pointer"><img class="ico" src="${esc(h.icon || '')}" alt=""><div class="grow"><b>${esc(h.title)}</b> <span class="mu sm">· ${esc(h.author || '')}</span><div class="ds">${esc(h.desc)}</div><div class="mu sm">⬇ ${fmt(h.downloads)} ${(h.loaders || []).slice(0, 4).map(l => `<span class="tag">${esc(l)}</span>`).join(' ')}</div></div>
  <button class="btn p sm" data-getp="${esc(h.id)}" data-ptype="${esc(h.type)}">${ic('download')}${esc(t('install'))}</button></div>`).join('') || `<div class="card empty">${esc(t('empty'))}</div>`;
}
async function installProject(id, type) {
  await run(async () => {
    if (type === 'modpack') { const i = await api('inst:installModpack', { project: id }); await refresh(); toast(t('done') + ': ' + i.name, 'ok'); return go('inst', i.id); }
    const tg = S.target && inst(S.target);
    if (!tg) return pickInstanceModal(id);
    const list = await api('inst:install', { id: tg.id, project: id }); toast(t('installed') + ': ' + list.join(', '), 'ok');
  });
}
function pickInstanceModal(projectId) {
  if (!S.instances.length) { toast(t('emptyLib'), 'err'); return newInstanceModal(); }
  modal(`<h2>${esc(t('install'))}</h2>${S.instances.map(i => `<button class="opt" data-pick="${esc(i.id)}">${tile(i, 'sm')}<div class="grow"><b>${esc(i.name)}</b><div class="mu sm">${esc(i.mc)} · ${LN[i.loader]}</div></div></button>`).join('')}<div class="foot"><button class="btn" data-close>${esc(t('cancel'))}</button></div>`);
  $('#modal').onclick = async e => {
    if (e.target.id === 'modal' || e.target.closest('[data-close]')) return closeModal();
    const b = e.target.closest('[data-pick]'); if (!b) return; closeModal();
    await run(async () => { const l = await api('inst:install', { id: b.dataset.pick, project: projectId }); toast(t('installed') + ': ' + l.join(', '), 'ok'); });
  };
}

/* ---------- Настройки ---------- */
function viewSettings() {
  const s = S.settings;
  V(`<div class="top"><h1>${esc(t('settings'))}</h1><button class="btn" data-site>${ic('globe')}${esc(t('openSite'))}</button></div>
  <h2 style="margin-top:6px">${esc(t('appearance'))}</h2><div class="card">
   <label class="lab" style="margin-top:0">${esc(t('theme'))}</label><div class="themes">${THEMES.map(([k, bg, c]) => `<button class="th ${s.theme === k ? 'on' : ''}" data-th="${k}"><div class="pv" style="background:${bg};--c:${k === 'custom' ? '#fff' : s.accent}"></div>${esc(t({ dark: 'dark', light: 'light', amoled: 'amoled', glass: 'glass', glasslight: 'glass', cold: 'snow', warm: 'sun', autumn: 'leaves', spring: 'rain', custom: 'custom' }[k]))}${k === 'glasslight' ? ' ☀' : ''}</button>`).join('')}</div>
   <label class="lab">${esc(t('accent'))}</label><div class="row wrap">${ACCENTS.map(c => `<button class="swatch ${s.accent === c ? 'on' : ''}" data-acc-c="${c}" style="background:${c}"></button>`).join('')}<input type="color" id="accc" value="${esc(s.accent)}"></div>
   <label class="lab">${esc(t('custom'))}</label><input type="range" class="hue" id="hue" min="0" max="360" value="${x2h(s.accent)}">
   ${s.theme === 'custom' ? `<div class="row gap wrap" style="margin-top:6px"><div><label class="lab">${esc(t('bg'))}</label><input type="color" id="cbg" value="${esc(s.customBg)}"></div><div><label class="lab">${esc(t('card'))}</label><input type="color" id="ccd" value="${esc(s.customCard)}"></div></div>` : ''}</div>
  <h2>${esc(t('language'))}</h2><div class="langs">${LANG_LIST.map(([c, n]) => `<button class="${s.lang === c ? 'on' : ''}" data-lang="${c}">${esc(n)}</button>`).join('')}</div>
  <h2>${esc(t('general'))}</h2><div class="card"><label class="lab" style="margin-top:0">${esc(t('memory'))}: <b id="gm">${s.memory}</b></label><input type="range" id="gmr" min="1024" max="16384" step="512" value="${s.memory}">
   <label class="lab">${esc(t('jvmArgs'))}</label><input id="gj" style="width:100%" value="${esc(s.jvmArgs || '')}"><label class="lab">Java</label><input id="gjp" style="width:100%" placeholder="auto" value="${esc(s.javaPath || '')}"></div>
  <h2>${esc(t('accounts'))}</h2><div id="accs" class="card">${accountsHTML()}</div>`);
  $('#gmr').oninput = e => { $('#gm').textContent = e.target.value; }; $('#gmr').onchange = e => setS({ memory: +e.target.value });
  $('#gj').onchange = e => setS({ jvmArgs: e.target.value }); $('#gjp').onchange = e => setS({ javaPath: e.target.value.trim() });
  $('#accc').oninput = e => { setS({ accent: e.target.value }); renderRail(); };
  $('#hue').oninput = e => { const c = h2x(+e.target.value); setS({ accent: c }); $('#accc').value = c; document.querySelectorAll('.swatch.on').forEach(x => x.classList.remove('on')); renderRail(); };
  if ($('#cbg')) { $('#cbg').oninput = e => setS({ customBg: e.target.value }); $('#ccd').oninput = e => setS({ customCard: e.target.value }); }
}
function accountsHTML() {
  return (S.accounts.length ? S.accounts.map(a => `<div class="row" style="padding:6px 0">${head(a)}<div class="grow"><b>${esc(a.name)}</b><div class="mu sm">${a.p === 'ely' ? esc(t('ely')) : esc(t('ms'))}</div></div>
  ${a.id === S.settings.selected ? `<span class="tag">✓</span>` : `<button class="btn sm" data-selacc="${esc(a.id)}">${esc(t('play'))}</button>`}<button class="btn ic sm bad" data-rmacc="${esc(a.id)}">${ic('x')}</button></div>`).join('') : `<div class="mu" style="padding:6px 0">${esc(t('noAcc'))}</div>`)
    + `<div class="foot" style="justify-content:flex-start"><button class="btn p" data-login>${ic('user')}${esc(S.accounts.length ? t('addAcc') : t('signIn'))}</button></div><div class="mu sm">${esc(t('ms'))} · ${esc(t('ely'))}</div>`;
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
  const st = { name: '', mc: '', loader: 'fabric', snaps: false, lv: [], ok: true };
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
  let sel = (r.candidates.find(c => c.loaderOk && c.ok === c.total) || r.candidates.find(c => c.loaderOk) || {}).mc;
  const draw = () => {
    const c = r.candidates.find(x => x.mc === sel);
    modal(`<h2>${esc(t('updT'))} — ${esc(i.name)}</h2><p class="mu" style="margin-top:-6px">${esc(t('updD'))}<br>${esc(t('version'))}: <b>${esc(i.mc)}</b></p>
    ${r.candidates.map(x => { const pct = x.total ? Math.round(x.ok / x.total * 100) : 100; return `<button class="opt ${x.mc === sel ? 'on' : ''}" data-sel="${esc(x.mc)}" ${x.loaderOk ? '' : 'disabled style="opacity:.45"'}><div style="min-width:64px"><b>${esc(x.mc)}</b></div><div class="bar"><i class="${pct < 100 ? 'part' : ''}" style="width:${x.loaderOk ? pct : 0}%"></i></div><span class="mu sm" style="min-width:110px;text-align:right">${x.loaderOk ? `${x.ok} ${esc(t('of'))} ${x.total} ${esc(t('compat'))}` : esc(t('noLoader'))}</span></button>`; }).join('') || `<div class="empty">${esc(t('empty'))}</div>`}
    ${c && c.missing.length ? `<label class="lab">✕ ${c.missing.length}</label>${c.missing.map(m => `<div class="row sm" style="padding:3px 0">${m.icon ? `<img src="${esc(m.icon)}" style="width:24px;height:24px;border-radius:8px" alt="">` : ''}<span>${esc(m.title)}</span></div>`).join('')}` : ''}
    <p class="mu sm">${esc(t('backupNote'))}</p>
    <div class="foot"><button class="btn" data-close>${esc(t('stay'))}</button>${c ? `<button class="btn p" id="ua">${ic('refresh')}${esc(c.missing.length ? t('removeInc') : t('upgrade'))} → ${esc(c.mc)}</button>` : ''}</div>`);
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

/* ---------- прогресс ---------- */
function renderDock() {
  $('#dock').innerHTML = Object.entries(S.tasks).map(([k, v]) => `<div class="task"><b>${esc(v.label)}</b><div class="bar"><i style="width:${Math.round((v.pct || 0) * 100)}%"></i></div></div>`).join('');
}
async function refresh() { try { S.instances = await api('inst:list'); } catch (_) {} }

/* ---------- события ---------- */
document.addEventListener('click', async e => {
  const q = s => e.target.closest(s);
  let b;
  if ((b = q('[data-go]'))) return go(b.dataset.go);
  if (q('[data-site]')) return api('shell:site');
  if (q('[data-acc]')) return accountsModal();
  if ((b = q('[data-ext]'))) return api('shell:open', b.dataset.ext);
  if (q('[data-new]')) return newInstanceModal();
  if (q('[data-import]')) return run(async () => { const i = await api('inst:importFile'); if (i) { await refresh(); go('inst', i.id); } });
  if ((b = q('[data-play]'))) { e.stopPropagation(); const id = b.dataset.play, i = inst(id); if (i && i.running) return api('inst:stop', id); if (!cur()) return accountsModal(); return run(async () => { if (S.view !== 'inst') {} await api('inst:play', id); }); }
  if ((b = q('[data-inst]'))) { S.tab = 'mods'; return go('inst', b.dataset.inst); }
  if ((b = q('[data-tab]'))) { S.tab = b.dataset.tab; $$('[data-tab]').forEach(x => x.classList.toggle('on', x === b)); return renderTab(); }
  if (q('[data-upd]')) return updateModal(); if (q('[data-opt]')) return optimizeModal();
  if (q('[data-folder]')) return api('inst:folder', { id: S.instId });
  if (q('[data-addc]')) { S.target = S.instId; S.catalog.type = S.tab === 'mods' ? 'mod' : S.tab; S.catalog.version = ''; S.catalog.res = null; return go('discover'); }
  if (q('[data-untarget]')) { S.target = null; S.catalog.version = ''; S.catalog.loader = ''; S.catalog.res = null; return renderView(); }
  if ((b = q('[data-tg]'))) return run(async () => { await api('inst:toggle', { id: S.instId, kind: S.tab, file: b.dataset.tg }); renderTab(); });
  if ((b = q('[data-rm]'))) return run(async () => { await api('inst:removeFile', { id: S.instId, kind: S.tab, file: b.dataset.rm }); renderTab(); });
  if (q('[data-savei]')) return run(async () => { await api('inst:update', { id: S.instId, patch: { name: $('#sn').value.trim() || inst(S.instId).name, memory: +$('#sm').value, jvmArgs: $('#sj').value.trim() } }); await refresh(); toast(t('done'), 'ok'); renderView(); });
  if (q('[data-dup]')) return run(async () => { const i = await api('inst:duplicate', S.instId); await refresh(); go('inst', i.id); });
  if (q('[data-del]')) { if (confirm(t('confirmDel'))) return run(async () => { await api('inst:delete', S.instId); await refresh(); go('library'); }); return; }
  if ((b = q('[data-ctype]'))) { S.catalog.type = b.dataset.ctype; S.catalog.res = null; return viewDiscover(); }
  if (q('[data-retry]')) return search();
  if ((b = q('[data-getp]'))) { e.stopPropagation(); const id = b.dataset.getp, ty = b.dataset.ptype; if ($('#modal') && !$('#modal').classList.contains('hide')) closeModal(); return installProject(id, ty); }
  if ((b = q('[data-proj]'))) return projectModal(b.dataset.proj);
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
  const info = await api('app:init'); Object.assign(S, { accounts: info.accounts, site: info.site });
  Object.assign(S.settings, info.settings);
  if (!S.settings.lang) { const l = (info.locale || 'en').toLowerCase().slice(0, 2); S.settings.lang = LANGS[l] ? l : 'en'; api('settings:set', { lang: S.settings.lang }).catch(() => {}); }
  applyTheme(); await refresh(); renderRail(); renderView();
  sa.on((ch, d) => {
    if (ch === 'progress') { if (d.done) delete S.tasks[d.task]; else S.tasks[d.task] = d; renderDock(); }
    else if (ch === 'log') { const a = S.logs[d.id] || (S.logs[d.id] = []); a.push(d.line); if (a.length > 600) a.splice(0, 100); if (S.view === 'inst' && S.tab === 'logs' && S.instId === d.id) { const b = $('#logbox'); if (b) { b.textContent += (b.textContent ? '\n' : '') + d.line; b.scrollTop = b.scrollHeight; } } }
    else if (ch === 'state') { const i = inst(d.id); if (i) i.running = d.running; if (S.view === 'library' || S.view === 'home') renderView(); if (S.view === 'inst' && S.instId === d.id) viewInst(); if (!d.running && d.code && d.code !== 0) toast(`${t('error')}: exit ${d.code}`, 'err'); }
    else if (ch === 'error') toast(d.message, 'err');
  });
})().catch(e => { document.body.insertAdjacentHTML('beforeend', `<pre style="color:#f87171;position:fixed;inset:60px 20px;z-index:99">${esc(e.stack || e)}</pre>`); });
