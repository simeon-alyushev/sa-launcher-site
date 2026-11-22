'use strict';
// Каталог Feed The Beast (публичный API без ключа). Всё из ответов API — недоверенные данные: формат и адреса проверяются.
// Формат ответов описан по документации API FTB; на реальном сервере не проверялся (см. README).
const U = require('./util');
const API = 'https://api.feed-the-beast.com/v1/modpacks/public';
const HOSTS = ['feed-the-beast.com', 'forgecdn.net', 'curseforge.com'];     // откуда разрешено скачивать файлы
const ID = /^\d{1,10}$/;
const num = v => Number.isInteger(v) && v > 0;

async function pack(id) {
  if (!ID.test(String(id))) throw new Error('Bad FTB id');
  const p = await U.fetchJSON(`${API}/modpack/${id}`);
  if (!p || typeof p !== 'object' || !num(p.id)) throw new Error('Unexpected FTB response');
  return p;
}
const hit = p => ({ id: String(p.id), slug: '', title: String(p.name || '').slice(0, 100), desc: String(p.synopsis || '').slice(0, 300), icon: U.safeUrl(((p.art || []).find(a => a && a.type === 'square') || (p.art || [])[0] || {}).url, HOSTS) || '', downloads: Number(p.installs) || 0, author: String(((p.authors || [])[0] || {}).name || ''), type: 'modpack', src: 'ftb', loaders: [] });
async function search({ query = '' }) {
  const q = String(query).trim().slice(0, 60);
  const list = await U.fetchJSON(q ? `${API}/modpack/search/20?term=${encodeURIComponent(q)}` : `${API}/modpack/popular/installs/20`);
  const ids = (Array.isArray(list.packs) ? list.packs : []).filter(num).slice(0, 20), out = [];
  await U.pool(ids, 5, async (id, k) => { try { out[k] = hit(await pack(id)); } catch (_) {} });
  return { total: -1, limit: 20, hits: out.filter(Boolean) };
}
// Последняя релизная версия пака
const latest = p => { const v = (p.versions || []).filter(x => x && num(x.id)); const r = v.filter(x => x.type === 'release'); return String(((r.length ? r : v).sort((a, b) => a.id - b.id).pop() || {}).id || ''); };
async function version(packId, versionId) {
  if (!ID.test(String(packId)) || !ID.test(String(versionId))) throw new Error('Bad FTB id');
  const v = await U.fetchJSON(`${API}/modpack/${packId}/${versionId}`);
  if (!v || !Array.isArray(v.files)) throw new Error('Unexpected FTB response');
  return v;
}
// Версия игры и загрузчик из targets
function targets(v) {
  const t = Array.isArray(v.targets) ? v.targets : [];
  const g = t.find(x => x && x.type === 'game' && x.name === 'minecraft'), m = t.find(x => x && x.type === 'modloader');
  if (!g || typeof g.version !== 'string' || !/^[0-9A-Za-z._+-]{1,40}$/.test(g.version)) throw new Error('bad ftb manifest');
  const ok = m && ['forge', 'neoforge', 'fabric', 'quilt'].includes(String(m.name).toLowerCase());
  return { mc: g.version, loader: ok ? String(m.name).toLowerCase() : 'vanilla', loaderVersion: ok && /^[0-9A-Za-z._+-]{1,60}$/.test(String(m.version)) ? String(m.version) : '' };
}
const safeUrl = u => U.safeUrl(u, HOSTS);
module.exports = { search, pack, latest, version, targets, safeUrl };
