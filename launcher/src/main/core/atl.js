'use strict';
// ATLauncher: каталог и установка сборок.
//  • Каталог и версия пака — ПУБЛИЧНЫЙ API ATLauncher (https://wiki.atlauncher.com/api-docs/v1/): /packs/simple, /pack/{safeName}/{version|latest}.
//    Лимит публичного API — 60 запросов в минуту, обязателен User-Agent (он у нас всегда есть), поэтому список кэшируется.
//  • Манифест версии (моды, загрузчик) и Configs.zip берутся с CDN ATLauncher так же, как это делает сам ATLauncher.
//    Этот CDN официально НЕ документирован, поэтому разбор максимально строгий: если ответ не похож на ожидаемый,
//    установка честно завершается ошибкой, а не «успехом». Всё, что пришло из сети, считается недоверенным.
const fs = require('fs');
const path = require('path');
const U = require('./util');

const API = 'https://api.atlauncher.com/v1';
const CDN = 'https://download.nodecdn.net/containers/atl';
const HOSTS = ['nodecdn.net', 'atlauncher.com', 'modrinth.com', 'forgecdn.net', 'curseforge.com', 'github.com', 'githubusercontent.com'];   // откуда разрешено скачивать моды
const SAFE = /^[A-Za-z0-9]{1,80}$/, VER = /^[A-Za-z0-9._+ -]{1,60}$/, MD5 = /^[a-f0-9]{32}$/i, MCV = /^[0-9A-Za-z._+-]{1,40}$/;
const LOADERS = ['fabric', 'forge', 'neoforge', 'quilt'];
const MAX_MOD = 512 * 1048576, MAX_CFG = 1024 * 1048576;

// Все ответы API: { error, code, message, data }
async function api(p) {
  const d = await U.fetchJSON(API + p);
  if (!d || typeof d !== 'object' || d.error !== false || d.data == null) throw new Error('ATLauncher API: ' + String((d && d.message) || 'unexpected response').slice(0, 200));
  return d.data;
}
const text = (s, n) => String(s == null ? '' : s).replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/[*_`#>]+/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
// Иконка пака лежит на CDN ATLauncher (как в самом лаунчере); если файла нет — интерфейс подставит заглушку
const icon = safe => `${CDN}/launcher/images/${safe.toLowerCase()}.png`;
let cache = { t: 0, list: null };
async function packs() {
  if (cache.list && Date.now() - cache.t < 10 * 60 * 1000) return cache.list;
  const d = await api('/packs/simple');
  if (!Array.isArray(d)) throw new Error('ATLauncher API: unexpected response');
  // Описания: полный список (необязательно — если не пришёл, показываем без описаний)
  const info = new Map();
  try { const f = await api('/packs/full'); if (Array.isArray(f)) for (const p of f) if (p && SAFE.test(String(p.safeName))) info.set(String(p.safeName), text(p.description, 300)); } catch (_) {}
  const list = d.filter(p => p && typeof p.name === 'string' && SAFE.test(String(p.safeName)) && (p.type === undefined || p.type === 'public'))
    .map(p => ({ id: Number(p.id) || 0, name: p.name.slice(0, 100), safeName: String(p.safeName), desc: info.get(String(p.safeName)) || text(p.description, 300) }));
  cache = { t: Date.now(), list }; return list;
}
async function search({ query = '' }) {
  const q = String(query).trim().toLowerCase().slice(0, 60);
  let l = await packs();
  l = q ? l.filter(p => p.name.toLowerCase().includes(q) || p.safeName.toLowerCase().includes(q)) : l.slice().sort((a, b) => b.id - a.id);
  const hits = l.slice(0, 20).map(p => ({ id: p.safeName, slug: p.safeName, title: p.name, desc: p.desc || '', icon: icon(p.safeName), downloads: 0, author: '', type: 'modpack', src: 'atl', loaders: [] }));
  return { total: l.length, limit: 20, hits };
}
// Версия пака: "latest" или конкретная. Возвращает { version, minecraft }
async function version(safeName, ver) {
  if (!SAFE.test(String(safeName))) throw new Error('Bad ATLauncher pack');
  const v = ver && ver !== 'latest' ? String(ver) : 'latest'; if (v !== 'latest' && !VER.test(v)) throw new Error('Bad ATLauncher version');
  let d;
  try { d = await api(`/pack/${safeName}/${encodeURIComponent(v)}`); }
  catch (e) {
    if (v !== 'latest') throw e;
    // запасной путь: берём самую новую версию из описания пака
    let rec = null;
    try { const pk = await api(`/pack/${safeName}`), vs = Array.isArray(pk && pk.versions) ? pk.versions.filter(x => x && typeof x.version === 'string' && VER.test(x.version)) : []; rec = vs.find(x => x.recommended === true) || vs[0]; } catch (_) {}
    if (!rec) throw e;          // настоящая причина — первая ошибка
    d = rec;
  }
  if (!d || typeof d.version !== 'string' || !VER.test(d.version)) throw new Error('ATLauncher API: unexpected response');
  const mcv = [d.minecraftVersion, d.minecraft].find(x => typeof x === 'string' && MCV.test(x));
  return { version: d.version, minecraft: mcv || '' };
}
const packUrl = (safe, ver, file, alt) => `${CDN}${alt ? '/launcher/json' : ''}/packs/${safe}/versions/${encodeURIComponent(ver)}/${file}`;
async function manifest(safeName, ver) {
  if (!SAFE.test(String(safeName)) || !VER.test(String(ver))) throw new Error('Bad ATLauncher pack');
  try { return await U.fetchJSON(packUrl(safeName, ver, 'Configs.json')); }
  catch (e) { if (e.status !== 404) throw e; return U.fetchJSON(packUrl(safeName, ver, 'Configs.json', true)); }
}
// Configs.zip (конфиги и прочее, что кладётся в папку сборки). Нет файла (404) — значит, пак без конфигов.
async function configs(safeName, ver) {
  for (const alt of [false, true]) {
    try { return await U.fetchBufMax(packUrl(safeName, ver, 'Configs.zip', alt), MAX_CFG); }
    catch (e) { if (e.status !== 404) throw e; }
  }
  return null;
}

// Тип файла из манифеста -> папка сборки. Остальные типы (jar-патчи, распаковка в произвольные папки и т. п.) не поддерживаем и не скрываем это.
const KIND = { texturepack: 'resourcepack', mods: 'mod', mod: 'mod', dependency: 'mod', depandency: 'mod', coremods: 'mod', resourcepack: 'resourcepack', shaderpack: 'shader' };
// Разбор манифеста версии. Бросает ошибку, если это не манифест ATLauncher.
function parse(m, info = {}) {
  if (!m || typeof m !== 'object' || Array.isArray(m)) throw new Error('err:atlBad');
  const mc = typeof m.minecraft === 'string' && MCV.test(m.minecraft) ? m.minecraft : info.minecraft;
  if (!mc || !MCV.test(mc)) throw new Error('err:atlBad');
  let loader = 'vanilla', loaderVersion = '';
  if (m.loader && typeof m.loader === 'object') {
    const t = String(m.loader.type || '').toLowerCase();
    if (t) { if (!LOADERS.includes(t)) throw new Error('err:atlLoader|' + t.slice(0, 30)); loader = t; const lv = String(m.loader.version || ''); loaderVersion = /^[0-9A-Za-z._+-]{1,60}$/.test(lv) ? lv : ''; }
  }
  if (!Array.isArray(m.mods)) throw new Error('err:atlBad');
  const mods = [], skipped = [];
  for (const x of m.mods.slice(0, 2000)) {
    if (!x || typeof x !== 'object') continue;
    if (x.client === false) continue;                          // нужен только на сервере
    if (x.optional === true && x.selected !== true) continue;  // необязательные моды по умолчанию не ставим
    const kind = KIND[String(x.type || 'mods').toLowerCase()];
    const url = typeof x.url === 'string' ? x.url : '', dl = String(x.download || (/^https?:/i.test(url) ? 'direct' : 'server')).toLowerCase();
    let file = U.safeFileName(x.file || (url ? decodeURIComponent(url.split('?')[0].split('/').pop() || '') : ''));
    const name = String(x.name || file || '?').slice(0, 100);
    if (!kind) { skipped.push({ name, reason: 'unsupported' }); continue; }
    if (!file) { skipped.push({ name, reason: 'noFile' }); continue; }
    if (!/\.(jar|zip)$/i.test(file)) file += kind === 'mod' ? '.jar' : '.zip';
    const urls = [];
    if (dl === 'direct') { const u = U.safeUrl(url, HOSTS); if (u) urls.push(u); }
    else if (dl === 'server' && url && !/^[a-z]+:/i.test(url)) {   // файл на CDN ATLauncher: точное расположение не документировано, пробуем два варианта; контрольная сумма защищает от подмены
      const rel = url.replace(/^\/+/, '').split('/').map(encodeURIComponent).join('/');
      urls.push(`${CDN}/files/${rel}`, `${CDN}/${rel}`);
    }
    mods.push({ name, file, kind, urls, md5: MD5.test(String(x.md5 || '')) ? x.md5.toLowerCase() : '', page: dl === 'browser' ? (U.publicHttps(url) || '') : '', browser: dl === 'browser', hostBlocked: dl === 'direct' && !urls.length });
  }
  return { mc, loader, loaderVersion, mods, skipped };
}
// Скачать файл по первому рабочему адресу, проверить MD5 (если он указан), записать атомарно
async function fetchFile(urls, dest, md5) {
  if (md5 && U.exists(dest) && U.md5(fs.readFileSync(dest)) === md5) return false;
  let err = new Error('no url');
  for (const u of urls) {
    try {
      const buf = await U.fetchBufMax(u, MAX_MOD);
      if (md5 && U.md5(buf) !== md5) throw new Error('md5 mismatch');
      fs.mkdirSync(path.dirname(dest), { recursive: true }); fs.writeFileSync(dest + '.part', buf); fs.renameSync(dest + '.part', dest); return true;
    } catch (e) { err = e; }
  }
  throw err;
}
module.exports = { search, version, manifest, configs, parse, fetchFile, packs, HOSTS, CDN, API };
