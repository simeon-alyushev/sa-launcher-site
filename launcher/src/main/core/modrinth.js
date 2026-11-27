'use strict';
const fs = require('fs');
const path = require('path');
const U = require('./util');
const API = 'https://api.modrinth.com/v2';
const q = o => Object.entries(o).filter(([, v]) => v !== undefined && v !== '' && v !== null).map(([k, v]) => `${k}=${encodeURIComponent(typeof v === 'object' ? JSON.stringify(v) : v)}`).join('&');

// ---- кэш метаданных ----
// Свежие ответы берутся из памяти (TTL). Если сети нет или Modrinth отвечает ошибкой 5xx/429, отдаём последний известный ответ, даже устаревший
// (так починка и подбор версий работают без интернета на тех модах, которые уже запрашивались). 404 и другие ошибки 4xx в кэш не попадают.
// persist(файл) сохраняет кэш на диск между запусками (с ограничением по размеру).
const TTL = { project: 15 * 60e3, versions: 10 * 60e3, version: 60 * 60e3, projects: 15 * 60e3, search: 5 * 60e3 };
const MAX_ENTRIES = 400, MAX_DISK = 12 * 1048576;
const cache = new Map();          // ключ -> { t: время истечения, at: время записи, v: значение }
let diskFile = '', flushTimer = null;
const stats = { hit: 0, miss: 0, stale: 0 };

function persist(file) {
  diskFile = file || '';
  if (!diskFile) return;
  try {
    const d = JSON.parse(fs.readFileSync(diskFile, 'utf8'));
    for (const [k, e] of Object.entries(d.entries || {})) if (e && e.v !== undefined && !cache.has(k)) cache.set(k, { t: 0, at: e.at || 0, v: e.v });   // с диска всё считаем устаревшим: используется только при ошибке сети
  } catch (_) {}
}
function scheduleFlush() {
  if (!diskFile || flushTimer) return;
  flushTimer = setTimeout(() => { flushTimer = null; flush(); }, 4000); if (flushTimer.unref) flushTimer.unref();
}
function flush() {
  if (!diskFile) return false;
  try {
    const rows = [...cache.entries()].sort((a, b) => b[1].at - a[1].at); const entries = {}; let size = 0;
    for (const [k, e] of rows) { const s = JSON.stringify(e.v).length; if (size + s > MAX_DISK) continue; size += s; entries[k] = { at: e.at, v: e.v }; }
    fs.mkdirSync(path.dirname(diskFile), { recursive: true });
    fs.writeFileSync(diskFile + '.tmp', JSON.stringify({ v: 1, entries })); fs.renameSync(diskFile + '.tmp', diskFile);
    return true;
  } catch (_) { return false; }
}
const clone = v => (typeof structuredClone === 'function' ? structuredClone(v) : JSON.parse(JSON.stringify(v)));
const softError = e => !e.status || e.status >= 500 || e.status === 429;   // сеть, таймаут, 5xx, лимит запросов

async function cached(kind, key, fn) {
  const hit = cache.get(key), now = Date.now();
  if (hit && hit.t > now) { stats.hit++; return clone(hit.v); }
  try {
    const v = await fn(); stats.miss++;
    cache.set(key, { t: now + TTL[kind], at: now, v: clone(v) });
    if (cache.size > MAX_ENTRIES) { const old = [...cache.entries()].sort((a, b) => a[1].at - b[1].at).slice(0, cache.size - MAX_ENTRIES); for (const [k] of old) cache.delete(k); }
    scheduleFlush(); return v;
  } catch (e) {
    if (hit && softError(e)) { stats.stale++; return clone(hit.v); }
    throw e;
  }
}
const clear = () => { cache.clear(); if (diskFile) { try { fs.rmSync(diskFile, { force: true }); } catch (_) {} } };

// U.fetchJSON берём при каждом вызове (а не один раз при загрузке модуля), чтобы его можно было подменить в тестах
const get = (url, o) => U.fetchJSON(url, o);

async function search({ query = '', type = 'mod', loader, version, offset = 0, limit = 24 }) {
  const facets = [[`project_type:${type}`]];
  if (loader && loader !== 'vanilla' && (type === 'mod' || type === 'modpack')) facets.push([`categories:${loader}`]);
  if (version) facets.push([`versions:${version}`]);
  const url = `${API}/search?` + q({ query, facets, limit, offset, index: query ? 'relevance' : 'downloads' });
  const d = await cached('search', url, () => get(url));
  return { total: d.total_hits, limit, hits: d.hits.map(h => ({ id: h.project_id, slug: h.slug, title: h.title, desc: h.description, icon: h.icon_url, downloads: h.downloads, author: h.author, type: h.project_type, url: `https://modrinth.com/${h.project_type}/${h.slug}`, loaders: h.display_categories, categories: h.categories || h.display_categories })) };
}
const project = id => { const u = `${API}/project/${encodeURIComponent(id)}`; return cached('project', u, () => get(u)); };
const projects = ids => { if (!ids.length) return Promise.resolve([]); const u = `${API}/projects?` + q({ ids }); return cached('projects', u, () => get(u)); };
const versions = (id, { loaders, game_versions } = {}) => { const u = `${API}/project/${encodeURIComponent(id)}/version?` + q({ loaders, game_versions }); return cached('versions', u, () => get(u)); };
const version = id => { const u = `${API}/version/${id}`; return cached('version', u, () => get(u)); };
const lookupHashes = hashes => hashes.length ? get(`${API}/version_files`, { method: 'POST', body: { hashes, algorithm: 'sha1' } }) : Promise.resolve({});
const updateHashes = (hashes, loaders, game_versions) => hashes.length ? get(`${API}/version_files/update`, { method: 'POST', body: { hashes, algorithm: 'sha1', loaders, game_versions } }) : Promise.resolve({});
const primaryFile = v => v.files.find(f => f.primary) || v.files[0];
// предпочитаем release > beta > alpha, внутри — самый свежий
const best = list => { const r = { release: 0, beta: 1, alpha: 2 }; return [...list].sort((a, b) => (r[a.version_type] - r[b.version_type]) || (new Date(b.date_published) - new Date(a.date_published)))[0]; };

module.exports = { search, project, projects, versions, version, lookupHashes, updateHashes, primaryFile, best, persist, flush, clear, stats };
