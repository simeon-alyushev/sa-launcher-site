'use strict';
// Technic Platform: поиск и установка сборок.
//  • Публичный API https://api.technicpack.net : /search?q=…, /modpack/{slug} (параметр build обязателен, значение любое).
//  • Сборка двух видов: (1) прямая ссылка `url` на zip; (2) Solder — API-репозиторий (`solder`), отдающий список zip-архивов модов с MD5.
//  • Адреса файлов задаёт автор сборки (это устройство самой платформы Technic), поэтому принимаем только публичный https
//    (http поднимается до https, адреса localhost/локальных сетей/IP отвергаются), размер ограничен, MD5 из Solder проверяется.
const U = require('./util');

const API = 'https://api.technicpack.net', BUILD = 999;
const SLUG = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/, MD5 = /^[a-f0-9]{32}$/i, MCV = /^[0-9A-Za-z._+-]{1,40}$/;
const MAX_ZIP = 1200 * 1048576;
const text = (s, n) => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

const get = p => U.fetchJSON(`${API}${p}${p.includes('?') ? '&' : '?'}build=${BUILD}`);
async function pack(slug) {
  if (!SLUG.test(String(slug))) throw new Error('Bad Technic pack');
  const p = await get(`/modpack/${encodeURIComponent(slug)}`);
  if (!p || typeof p !== 'object' || p.error || typeof p.name !== 'string') throw new Error('Technic API: ' + String((p && p.error) || 'unexpected response').slice(0, 200));
  return p;
}
const hit = p => ({ id: String(p.name), slug: String(p.name), title: text(p.displayName || p.name, 100), desc: text(p.description, 300), icon: U.publicHttps(p.icon && p.icon.url) || '', downloads: Number(p.downloads) || 0, author: text(p.user, 60), type: 'modpack', src: 'technic', loaders: [] });
// Без запроса — подборка: /trending (если отдаёт), иначе несколько известных запросов. Кэш 10 минут.
const SEEDS = ['tekkit', 'hexxit', 'voltz', 'skyfactory', 'create', 'ftb', 'rlcraft', 'all the mods'];
let feat = { t: 0, hits: null };
const slugsOf = d => (Array.isArray(d) ? d : Array.isArray(d && d.modpacks) ? d.modpacks : Array.isArray(d && d.packs) ? d.packs : []).map(m => m && (m.slug || m.name)).filter(s => typeof s === 'string' && SLUG.test(s));
async function featured() {
  if (feat.hits && Date.now() - feat.t < 600000) return feat.hits;
  let slugs = [];
  try { slugs = slugsOf(await get('/trending')); } catch (_) {}
  if (!slugs.length) {
    const lists = []; await U.pool(SEEDS, 4, async (q, k) => { try { lists[k] = slugsOf(await get('/search?q=' + encodeURIComponent(q).replace(/%20/g, '+'))).slice(0, 3); } catch (_) {} });
    slugs = lists.flat().filter(Boolean);
  }
  slugs = [...new Set(slugs)].slice(0, 18); const out = [];
  await U.pool(slugs, 4, async (s, k) => { try { const p = await pack(s); if (!p.isServer) out[k] = hit(p); } catch (_) {} });
  const hits = out.filter(Boolean); if (hits.length) feat = { t: Date.now(), hits }; return hits;
}
async function search({ query = '' }) {
  const q = String(query).trim().slice(0, 60);
  if (!q) { const hits = await featured(); return hits.length ? { total: -1, limit: 18, hits } : { total: 0, limit: 0, hits: [], hint: 'techType' }; }
  const d = await get('/search?q=' + encodeURIComponent(q).replace(/%20/g, '+'));
  if (!d || typeof d !== 'object' || d.error) throw new Error('Technic API: ' + String((d && d.error) || 'unexpected response').slice(0, 200));
  const slugs = (Array.isArray(d.modpacks) ? d.modpacks : []).map(m => m && m.slug).filter(s => typeof s === 'string' && SLUG.test(s)).slice(0, 12), out = [];
  await U.pool(slugs, 4, async (s, k) => { try { const p = await pack(s); if (!p.isServer) out[k] = hit(p); } catch (_) {} });
  return { total: -1, limit: 12, hits: out.filter(Boolean) };
}

// ---- загрузчик из bin/modpack.jar (внутри version.json — профиль Minecraft) ----
function loaderOf(v, mcHint) {
  const o = { mc: '', loader: 'vanilla', loaderVersion: '' };
  if (!v || typeof v !== 'object') return o;
  if (typeof v.inheritsFrom === 'string' && MCV.test(v.inheritsFrom)) o.mc = v.inheritsFrom;
  const libs = (Array.isArray(v.libraries) ? v.libraries : []).map(l => String((l && l.name) || ''));
  for (const n of libs) {
    let m;
    if ((m = n.match(/^net\.minecraftforge:minecraftforge:([^:]+)(?::.*)?$/))) { o.loader = 'forge'; o.loaderVersion = m[1]; }   // Forge 1.5–1.6: старое имя артефакта
    else if ((m = n.match(/^net\.minecraftforge:forge:([^:]+)(?::.*)?$/))) { const p = m[1].split('-'); if (p.length >= 2) { o.loader = 'forge'; o.loaderVersion = p[1]; if (!o.mc && MCV.test(p[0])) o.mc = p[0]; } }
    else if ((m = n.match(/^net\.neoforged:neoforge:([^:]+)$/))) { o.loader = 'neoforge'; o.loaderVersion = m[1]; }
    else if ((m = n.match(/^net\.fabricmc:fabric-loader:([^:]+)$/))) { o.loader = 'fabric'; o.loaderVersion = m[1]; }
    else if ((m = n.match(/^org\.quiltmc:quilt-loader:([^:]+)$/))) { o.loader = 'quilt'; o.loaderVersion = m[1]; }
  }
  if (o.loader === 'vanilla') { const m = String(v.id || '').match(/forge[-_]?(?:\d+\.\d+(?:\.\d+)?-)?(\d+\.\d+\.\d+\.\d+)/i); if (m) { o.loader = 'forge'; o.loaderVersion = m[1]; } }
  if (!o.mc) { const m = String(v.id || '').match(/^(\d+\.\d+(?:\.\d+)?)/); o.mc = m ? m[1] : (mcHint || ''); }
  if (!/^[0-9A-Za-z._+-]{0,60}$/.test(o.loaderVersion)) o.loaderVersion = '';
  return o;
}
// Что внутри zip: версия загрузчика (bin/modpack.jar) и общий верхний каталог (если всё лежит в одной папке)
const GAME_DIRS = ['bin/', 'mods/', 'config/', 'coremods/', 'resources/', 'resourcepacks/', 'shaderpacks/', 'scripts/', 'libraries/', 'saves/', 'defaultconfigs/', 'kubejs/', 'flan/', 'structures/', 'schematics/', 'data/', 'assets/', 'jarmods/'];
function inspect(buf, opt = {}) {
  const z = U.readZip(buf), names = z.entries.map(e => e.name).filter(n => !n.endsWith('/'));
  let strip = '';
  const tops = new Set(names.map(n => n.split('/')[0] + (n.includes('/') ? '/' : '')));
  if (opt.strip !== false && tops.size === 1 && [...tops][0].endsWith('/') && !GAME_DIRS.includes([...tops][0].toLowerCase())) strip = [...tops][0];   // у архивов Solder корень не срезаем: каждый zip — один мод, папки внутри — это папки игры
  let info = null;
  const jarEntry = z.entries.find(e => e.name === strip + 'bin/modpack.jar');
  if (jarEntry && jarEntry.usize < 64 * 1048576) {
    try { const j = U.readZip(z.data(jarEntry)), vj = j.read('version.json'); if (vj && vj.length < 2e6) info = loaderOf(JSON.parse(vj.toString('utf8'))); } catch (_) {}
  }
  return { strip, info, files: names.length };
}
function extract(buf, dest, strip) {
  U.extractZip(buf, dest, n => !(strip ? n.slice(strip.length) : n).startsWith('bin/') && n.startsWith(strip), strip);
}
function direct(u) {   // страницы общего доступа Dropbox → прямая загрузка
  try { const x = new URL(u); if (/(^|\.)dropbox\.com$/i.test(x.hostname)) { x.searchParams.set('dl', '1'); return x.href; } } catch (_) {}
  return u;
}
const isZip = b => b && b.length > 22 && b[0] === 0x50 && b[1] === 0x4b;
async function download(url) {
  const u = U.publicHttps(url); if (!u) throw new Error('err:techUrl');
  const b = await U.fetchBufMax(direct(u), MAX_ZIP);
  if (!isZip(b)) throw new Error('err:techEmpty');     // вместо архива пришла веб-страница (ссылка не прямая)
  return b;
}

// ---- Solder ----
async function solderBuild(base, slug, want) {
  const b = U.publicHttps(base); if (!b) throw new Error('err:techUrl');
  const root = b.endsWith('/') ? b : b + '/';
  const ok = d => { if (!d || typeof d !== 'object' || d.error) throw new Error('Solder: ' + String((d && d.error) || 'unexpected response').slice(0, 200)); return d; };
  const mp = ok(await U.fetchJSON(`${root}modpack/${encodeURIComponent(slug)}`));
  const builds = Array.isArray(mp.builds) ? mp.builds.map(String) : [];
  const build = want || (typeof mp.recommended === 'string' && mp.recommended) || (typeof mp.latest === 'string' && mp.latest) || builds[builds.length - 1];
  if (!build || !/^[A-Za-z0-9._+-]{1,60}$/.test(build)) throw new Error('err:techNoBuild');
  const d = ok(await U.fetchJSON(`${root}modpack/${encodeURIComponent(slug)}/${encodeURIComponent(build)}?include=mods`));
  const mods = (Array.isArray(d.mods) ? d.mods : []).slice(0, 400).map(m => {
    const url = U.publicHttps(m && m.url); if (!url) throw new Error('err:techUrl');
    const md5 = MD5.test(String(m.md5 || '')) ? m.md5.toLowerCase() : '';
    return { name: text(m.pretty_name || m.name, 80) || 'mod', version: text(m.version, 40), url, md5, size: Number(m.filesize) || 0 };
  });
  if (!mods.length) throw new Error('err:techNoBuild');
  return { build, minecraft: typeof d.minecraft === 'string' && MCV.test(d.minecraft) ? d.minecraft : '', mods };
}
async function solderZip(m) {
  const buf = await U.fetchBufMax(direct(m.url), MAX_ZIP);
  if (!isZip(buf)) throw new Error('err:techEmpty');
  if (m.md5 && U.md5(buf) !== m.md5) throw new Error('err:techMd5|' + m.name);      // повреждённый или подменённый архив — не ставим
  return buf;
}
module.exports = { search, pack, inspect, extract, download, loaderOf, solderBuild, solderZip };
