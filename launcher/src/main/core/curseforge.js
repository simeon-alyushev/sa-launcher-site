'use strict';
// CurseForge через API сайта (ключ CF_API_KEY хранится на сервере, в лаунчере его нет).
const U = require('./util');
const q = o => new URLSearchParams(Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && v !== ''))).toString();
// Файлы CurseForge можно скачивать только с этих доменов (или с домена нашего сайта, если он проксирует загрузку)
const CDN = ['forgecdn.net', 'curseforge.com'];
const hostOf = u => { try { return new URL(u).hostname.toLowerCase(); } catch (_) { return ''; } };
const safeUrl = (site, u) => U.safeUrl(u, [...CDN, hostOf(site)].filter(Boolean));
const CLASS_DIR = { 6: 'mod', 12: 'resourcepack', 6552: 'shader' };   // classId CurseForge -> тип контента

async function search(site, { query = '', type = 'mod', loader, version, offset = 0 }) {
  const d = await U.fetchJSON(`${site}/api/search?` + q({ src: 'curseforge', q: query, type, loader: type === 'modpack' || loader === 'vanilla' ? '' : loader, version, offset }));
  return { total: -1, limit: 20, hits: (d.results || []).map(r => ({ id: String(r.id), slug: '', title: r.title, desc: r.desc, icon: r.icon, downloads: r.downloads, author: r.author, type, url: r.url, src: 'curseforge', loaders: [] })) };
}
async function files(site, id, loader, version) {
  const d = await U.fetchJSON(`${site}/api/versions?` + q({ src: 'curseforge', id, loader: loader === 'vanilla' ? '' : loader, version }));
  return d.versions || [];
}

// ---- модпаки ----
// Файл модпака (.zip) для установки: выбранный fileId или самый свежий с доступной загрузкой
async function packFile(site, projectId, fileId) {
  const list = await files(site, projectId, '', '');
  const f = fileId ? list.find(x => String(x.id) === String(fileId)) : list.find(x => x.url);
  const url = f && safeUrl(site, f.url);
  if (!f || !url) throw new Error('This modpack file cannot be downloaded outside the CurseForge website');
  return { id: String(f.id), name: f.name, url, sha1: /^[a-f0-9]{40}$/i.test(f.sha1 || '') ? f.sha1.toLowerCase() : '' };
}

// Разбор manifest.json (CurseForge). Всё в нём — недоверенные данные: проверяем формат и размеры.
function parseManifest(buf) {
  let m; try { m = JSON.parse(buf.toString('utf8')); } catch (_) { throw new Error('bad curseforge manifest'); }
  if (!m || typeof m !== 'object' || (m.manifestType && m.manifestType !== 'minecraftModpack')) throw new Error('bad curseforge manifest');
  const mcv = m.minecraft && m.minecraft.version;
  if (typeof mcv !== 'string' || !/^[0-9A-Za-z._+-]{1,40}$/.test(mcv)) throw new Error('bad curseforge manifest');
  const ml = ((m.minecraft.modLoaders || []).find(x => x && x.primary) || (m.minecraft.modLoaders || [])[0] || {}).id;
  let loader = 'vanilla', lv = '';
  if (typeof ml === 'string') {
    const k = ml.indexOf('-'), name = (k < 0 ? ml : ml.slice(0, k)).toLowerCase(), ver = k < 0 ? '' : ml.slice(k + 1);
    if (['forge', 'fabric', 'quilt', 'neoforge'].includes(name)) { loader = name; lv = /^[0-9A-Za-z._+-]{1,60}$/.test(ver) ? ver : ''; }
  }
  const refs = (Array.isArray(m.files) ? m.files : []).slice(0, 5000)
    .filter(f => f && Number.isInteger(f.projectID) && Number.isInteger(f.fileID) && f.projectID > 0 && f.fileID > 0 && f.required !== false)
    .map(f => ({ projectID: f.projectID, fileID: f.fileID }));
  const overrides = typeof m.overrides === 'string' && /^[A-Za-z0-9_.-]{1,40}$/.test(m.overrides) ? m.overrides : 'overrides';
  return { name: String(m.name || '').replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, 80), mc: mcv, loader, loaderVersion: lv, refs, overrides };
}

// По списку (projectID, fileID) находит имя и адрес скачивания.
// 1) пробуем пакетный маршрут сайта POST /api/cf/files (см. README: «что нужно на сервере») — если его нет, не страшно;
// 2) иначе по каждому проекту запрашиваем список файлов /api/versions и ищем нужный fileID.
async function resolveFiles(site, refs, onStep = () => {}) {
  const out = new Map(); const key = r => r.projectID + ':' + r.fileID;
  let batch = true;
  for (let i = 0; i < refs.length && batch; i += 50) {
    try {
      const d = await U.fetchJSON(`${site}/api/cf/files`, { method: 'POST', body: { files: refs.slice(i, i + 50) } });
      for (const f of (d.files || [])) { const r = { projectID: +f.projectID, fileID: +(f.id || f.fileID) }; if (r.projectID && r.fileID) out.set(key(r), f); }
    } catch (e) { batch = false; }
  }
  const missing = refs.filter(r => !out.has(key(r)));
  const byProject = new Map(); for (const r of missing) (byProject.get(r.projectID) || byProject.set(r.projectID, []).get(r.projectID)).push(r);
  let n = 0;
  await U.pool([...byProject.entries()], 6, async ([pid, rs]) => {
    try { const list = await files(site, pid, '', ''); for (const r of rs) { const f = list.find(x => String(x.id) === String(r.fileID)); if (f) out.set(key(r), { ...f, projectID: pid }); } } catch (_) {}
    onStep(++n / byProject.size);
  });
  return out;
}
// Тип контента: classId/kind от сервера, иначе по расширению (.jar — мод, .zip — ресурспак)
const kindOf = (f, name) => CLASS_DIR[f && f.classId] || (f && ['mod', 'resourcepack', 'shader'].includes(f.kind) ? f.kind : /\.jar$/i.test(name) ? 'mod' : 'resourcepack');

module.exports = { search, files, packFile, parseManifest, resolveFiles, safeUrl, kindOf };
