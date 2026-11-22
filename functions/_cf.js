// CurseForge API через ключ CF_API_KEY (Pages → Environment variables, тип Secret). Ключ наружу не отдаётся.
const BASE = 'https://api.curseforge.com/v1', GAME = 432;
export const CLASS = { mod: 6, modpack: 4471, resourcepack: 12, shader: 6552 };
const LOADER = { forge: 1, fabric: 4, quilt: 5, neoforge: 6 };
const LNAME = { forge: 'forge', fabric: 'fabric', quilt: 'quilt', neoforge: 'neoforge' };
export const json = (o, s = 200, cache = 'public, max-age=60') => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', 'Cache-Control': cache } });

export async function cf(env, path, opt = {}) {
  if (!env.CF_API_KEY) { const e = new Error('CF_API_KEY не задан на сервере'); e.status = 501; throw e; }
  const r = await fetch(BASE + path, { method: opt.method || 'GET', headers: { 'x-api-key': env.CF_API_KEY, Accept: 'application/json', 'User-Agent': 'SA-Launcher-Site', ...(opt.body ? { 'Content-Type': 'application/json' } : {}) }, body: opt.body ? JSON.stringify(opt.body) : undefined });
  if (!r.ok) { const e = new Error('CurseForge: HTTP ' + r.status); e.status = 502; throw e; }
  return r.json();
}
export const fail = e => json({ error: String(e.message || e) }, e.status || 502, 'no-store');

export async function search(env, g) {
  const type = CLASS[g('type')] ? g('type') : 'mod', q = new URLSearchParams({ gameId: GAME, classId: CLASS[type], pageSize: 20, sortField: g('q') ? 1 : 2, sortOrder: 'desc' });
  if (g('q')) q.set('searchFilter', g('q'));
  if (/^[\w.-]+$/.test(g('version'))) q.set('gameVersion', g('version'));
  if (LOADER[g('loader')] && type !== 'modpack') q.set('modLoaderType', LOADER[g('loader')]);
  const off = parseInt(g('offset')); if (off > 0) q.set('index', Math.min(off, 9980));
  const d = await cf(env, '/mods/search?' + q);
  return { results: (d.data || []).map(m => ({ src: 'curseforge', id: String(m.id), title: m.name, desc: m.summary, icon: m.logo && m.logo.thumbnailUrl, downloads: m.downloadCount, author: ((m.authors || [])[0] || {}).name, url: (m.links && m.links.websiteUrl) || 'https://www.curseforge.com/minecraft/mc-mods/' + m.slug, type })) };
}
const sha1 = f => { const h = (f.hashes || []).find(x => x.algo === 1); return h ? String(h.value).toLowerCase() : ''; };
export const mapFile = f => ({
  id: String(f.id), name: f.displayName || f.fileName, file: f.fileName, fileName: f.fileName,
  mc: (f.gameVersions || []).filter(v => /^\d/.test(v)), loaders: (f.gameVersions || []).map(v => String(v).toLowerCase()).filter(v => LNAME[v]),
  url: f.downloadUrl || '', sha1: sha1(f), projectID: f.modId
});
export async function versions(env, g) {
  const id = g('id'); if (!/^\d{1,10}$/.test(id)) { const e = new Error('bad id'); e.status = 400; throw e; }
  const q = new URLSearchParams({ pageSize: 50 });
  if (/^[\w.-]+$/.test(g('version'))) q.set('gameVersion', g('version'));
  if (LOADER[g('loader')]) q.set('modLoaderType', LOADER[g('loader')]);
  const d = await cf(env, `/mods/${id}/files?` + q);
  return { versions: (d.data || []).map(mapFile) };
}
// Пакетно: [{projectID,fileID}] -> файлы с адресом скачивания и classId (мод/ресурспак/шейдер)
export async function filesBatch(env, refs) {
  const ids = [...new Set(refs.map(r => +r.fileID).filter(n => Number.isInteger(n) && n > 0))].slice(0, 50);
  if (!ids.length) return { files: [] };
  const d = await cf(env, '/mods/files', { method: 'POST', body: { fileIds: ids } });
  const mods = [...new Set((d.data || []).map(f => f.modId))].slice(0, 50), cls = new Map();
  try { const m = await cf(env, '/mods', { method: 'POST', body: { modIds: mods } }); for (const x of m.data || []) cls.set(x.id, x.classId); } catch (_) {}
  return { files: (d.data || []).map(f => ({ ...mapFile(f), classId: cls.get(f.modId) })) };
}
